/**
 * 定期同期ワーカー（GitHub Actions から実行される）。
 *
 * 【なぜ Web アプリの API ではなくここで動かすのか】
 * 無料ホスティング（Netlify Free）の関数タイムアウトは 10 秒しかなく、
 * 数十件の AI 生成を含むバッチ処理は収まらない。
 * GitHub Actions は 1 ジョブあたり最大 6 時間動かせて、
 * プライベートリポジトリでも月 2,000 分まで無料なので、
 * 重いバッチはこちらに置く。Web アプリは画面表示だけを担当する。
 *
 * 実行: npm run sync
 * 必要な環境変数は .env.example の通り（GitHub Secrets に登録する）。
 *
 * 【--conditions=react-server が必要な理由】
 * 本体のサーバー側モジュールは `import 'server-only'` でクライアントからの誤用を
 * 防いでいる。この marker パッケージは Node からそのまま読むと例外を投げるが、
 * `react-server` 条件を立てると空モジュールに解決される（package.json の exports 参照）。
 * そのため package.json の sync スクリプトでは
 *   node --conditions=react-server --import tsx scripts/sync-worker.ts
 * と指定している。ガードを外さずにワーカーからも再利用できる。
 */

import { syncLocation } from '../src/lib/reviews/sync';
import { getBudgetState } from '../src/lib/ai/budget';
import { supabaseAdmin } from '../src/lib/supabase/admin';

/** 1 ロケーションあたりの上限。GitHub Actions のジョブ時間を食いつぶさないため。 */
const PER_LOCATION_BUDGET_MS = 10 * 60_000; // 10分
const MAX_ROUNDS = 20;

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log(`[sync] 開始 ${new Date().toISOString()}`);

  const budget = await getBudgetState();
  console.log(
    `[sync] 今月の AI 使用量: $${budget.spentUsd.toFixed(4)} / $${budget.budgetUsd} ` +
      `(残りおよそ ${budget.remainingReplies} 件分)`,
  );

  if (budget.exhausted) {
    console.log(
      '[sync] 今月の AI 予算に達しているため、返信案の生成は行いません。' +
        'クチコミの取得のみ実行します。',
    );
  }

  const db = supabaseAdmin();
  const { data: locations, error } = await db
    .from('locations')
    .select('location_id, name, consecutive_failures')
    .eq('setup_complete', true);

  if (error) {
    console.error(`[sync] ロケーションの取得に失敗: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!locations || locations.length === 0) {
    console.log('[sync] 対象のロケーションがありません（初期設定が未完了）。');
    return;
  }

  let totalNew = 0;
  let totalGenerated = 0;
  let totalPublished = 0;
  let hadError = false;

  for (const location of locations) {
    // 連続失敗しているロケーションは毎時叩き続けても直らない（多くは再認証待ち）。
    // 10 回以上失敗したら 1 日 1 回だけ試して API クォータを守る。
    if (location.consecutive_failures >= 10 && new Date().getUTCHours() !== 0) {
      console.log(
        `[sync] ${location.name}: 連続 ${location.consecutive_failures} 回失敗中のためスキップ`,
      );
      continue;
    }

    const deadline = Date.now() + PER_LOCATION_BUDGET_MS;

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        console.log(`[sync] ${location.name}: 時間上限に達したため中断（次回に継続）`);
        break;
      }

      const result = await syncLocation(location.location_id, 'cron', {
        timeBudgetMs: remaining,
      });

      totalNew += result.reviewsNew;
      totalGenerated += result.repliesGenerated;
      totalPublished += result.repliesPublished;

      for (const message of result.errors) {
        console.error(`[sync] ${location.name}: ${message}`);
        hadError = true;
      }

      console.log(
        `[sync] ${location.name}: 取得 ${result.reviewsFetched} / 新着 ${result.reviewsNew} / ` +
          `生成 ${result.repliesGenerated} / 公開 ${result.repliesPublished}` +
          (result.hasMore ? '（続きあり）' : ''),
      );

      if (result.budgetExhausted) {
        console.log('[sync] 今月の AI 予算に達しました。生成を停止します。');
        break;
      }
      if (!result.hasMore) break;
    }
  }

  const after = await getBudgetState();
  console.log(
    `[sync] 完了 (${((Date.now() - startedAt) / 1000).toFixed(1)}秒) ` +
      `新着 ${totalNew} / 生成 ${totalGenerated} / 公開 ${totalPublished}`,
  );
  console.log(
    `[sync] 今月の AI 使用量: $${after.spentUsd.toFixed(4)} / $${after.budgetUsd} ` +
      `(残りおよそ ${after.remainingReplies} 件分)`,
  );

  // エラーがあっても exit 1 にはしない。1 件の生成失敗で
  // GitHub Actions が赤くなり続けると、本当の障害に気づけなくなるため。
  // 恒常的な失敗は locations.consecutive_failures とダッシュボードのバナーで検知する。
  if (hadError) console.log('[sync] 一部にエラーがありました（上のログを参照）');
}

main().catch((err) => {
  console.error('[sync] 予期しないエラー:', err);
  process.exitCode = 1;
});
