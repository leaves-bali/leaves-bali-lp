/**
 * 月次レポート作成バッチ（毎月1日に GitHub Actions から実行）。
 *
 * 対象は「前月」。1日の朝に動かすので、前月はすでに締まっている。
 *
 * 【なぜ Web 側でやらないのか】
 * 1 店舗ぶんでも AI 呼び出しが入るため、Netlify Free の 10 秒では終わらない。
 * 同期バッチ（sync-worker.ts）と同じ理由でここに置いている。
 *
 * 実行: npm run report
 *   REPORT_PERIOD=2026-08  … 対象月を指定（省略時は前月）
 *   REPORT_FORCE=true      … 作成済みでも作り直す
 */

import { buildMonthlyReport } from '../src/lib/reports/buildReport';
import { targetPeriodFor, periodKey } from '../src/lib/reports/aggregate';
import { sendMonthlyReportEmail } from '../src/lib/reports/email';
import { loadLocationSettings } from '../src/lib/settings/loadLocationSettings';
import { env } from '../src/lib/env';
import { supabaseAdmin } from '../src/lib/supabase/admin';

function resolvePeriod(): Date {
  const raw = process.env.REPORT_PERIOD?.trim();
  if (!raw) return targetPeriodFor(new Date());

  const matched = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!matched) {
    throw new Error(`REPORT_PERIOD は YYYY-MM の形で指定してください（受け取った値: ${raw}）`);
  }
  return new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, 1));
}

async function main(): Promise<void> {
  const period = resolvePeriod();
  const key = periodKey(period);
  const force = process.env.REPORT_FORCE?.trim().toLowerCase() === 'true';

  console.log(`[report] ${key} のレポートを作ります`);

  const db = supabaseAdmin();

  // 契約している店だけを対象にする。ここで絞っておくと、
  // 未契約の店に対して無駄なクエリも AI 呼び出しも発生しない。
  const { data: locations, error } = await db
    .from('locations')
    .select('location_id, name')
    .eq('report_enabled', true)
    .eq('setup_complete', true);

  if (error) {
    console.error(`[report] 店舗の取得に失敗: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!locations || locations.length === 0) {
    console.log('[report] 月次レポートを契約している店舗がありません。');
    return;
  }

  let created = 0;
  let failed = 0;

  for (const location of locations) {
    try {
      const outcome = await buildMonthlyReport(location.location_id, period, { force });

      if (outcome.status === 'skipped') {
        console.log(`[report] ${location.name}: 見送り（${outcome.reason}）`);
        continue;
      }

      created += 1;
      console.log(
        `[report] ${location.name}: 作成しました ` +
          `（クチコミ ${outcome.report.review_count} 件 / 前月 ${outcome.report.prev_review_count} 件）`,
      );

      // --- メール送信（差し込み口） ---------------------------------------
      // 送信サービスが未設定の間は何も送らず、emailed_at も更新しない。
      const settings = await loadLocationSettings(location.location_id);
      if (settings.contactEmail) {
        const delivery = await sendMonthlyReportEmail({
          to: settings.contactEmail,
          storeName: settings.name,
          period: key,
          report: outcome.report,
          reportUrl: `${env.appUrl}/dashboard/report`,
        });

        if (delivery.sent) {
          await db
            .from('monthly_reports')
            .update({ emailed_at: new Date().toISOString() })
            .eq('monthly_report_id', outcome.report.monthly_report_id);
          console.log(`[report] ${location.name}: メールを送信しました`);
        } else {
          console.log(`[report] ${location.name}: メール未送信（${delivery.reason}）`);
        }
      }
    } catch (err) {
      failed += 1;
      // 1 店舗の失敗で他の店舗を止めない。
      console.error(
        `[report] ${location.name}: 失敗 — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(`[report] 完了: 作成 ${created} 件 / 失敗 ${failed} 件`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[report] 予期しないエラー:', err);
  process.exit(1);
});
