/**
 * メール送信の動作確認（手動実行）。
 *
 * 【なぜ必要か】
 * 月次レポートが動くのは毎月1日。そこで初めて「メールが届かない」と分かるのでは遅い。
 * 鍵・差出人・ドメイン認証のどこかが間違っていても、設定した時点では気づけない。
 * 見本のレポートを1通送って、経路が通っていることを先に確かめる。
 *
 * 【本物のデータを使わない理由】
 * クチコミがまだ 1 件も入っていない段階でも確認できるようにするため。
 * 中身は見本と分かるように作ってある。
 *
 * 実行: TEST_EMAIL_TO=your@example.com npm run report:test-email
 * GitHub からは Actions タブの「Test Report Email」から実行できる。
 */

import { sendMonthlyReportEmail } from '../src/lib/reports/email';
import { env } from '../src/lib/env';
import type { MonthlyReportRow } from '../src/lib/database.types';

const SAMPLE: MonthlyReportRow = {
  monthly_report_id: '00000000-0000-0000-0000-000000000000',
  location_id: '00000000-0000-0000-0000-000000000000',
  period: '2026-08-01',
  review_count: 23,
  prev_review_count: 17,
  average_rating: 4.35,
  prev_average_rating: 4.06,
  by_language: { ja: 18, en: 3, ko: 2 },
  reply_rate: 0.87,
  prev_reply_rate: 0.41,
  praised_themes: [
    { topic: 'おまかせの内容', count: 9 },
    { topic: '大将の接客', count: 6 },
    { topic: '仕入れの鮮度', count: 4 },
  ],
  complained_themes: [
    { topic: '駐車場の分かりにくさ', count: 5 },
    { topic: '待ち時間', count: 3 },
  ],
  next_actions: [
    '駐車場の入口が分かりにくいという指摘が5件。入口の看板を大きくする',
    '待ち時間の指摘が3件。予約枠を15分刻みに変える',
    '韓国語のクチコミが2件入った。メニューの韓国語表記を用意する',
  ],
  model: 'sample',
  generation_meta: {},
  emailed_at: null,
  created_at: new Date().toISOString(),
};

async function main(): Promise<void> {
  const to = process.env.TEST_EMAIL_TO?.trim();
  if (!to) {
    console.error('[test-email] 送り先が指定されていません（TEST_EMAIL_TO）。');
    process.exit(1);
  }

  console.log(`[test-email] 送り先: ${to}`);
  console.log(`[test-email] 差出人: ${env.reportEmailFrom || '(未設定)'}`);
  console.log(`[test-email] 鍵: ${env.resendApiKey ? '設定あり' : '(未設定)'}`);

  const result = await sendMonthlyReportEmail({
    to,
    // 見本と分かる店名にする。本物のレポートと取り違えないように。
    storeName: '【見本】寿司 まつおか',
    period: SAMPLE.period,
    report: SAMPLE,
    reportUrl: `${env.appUrl}/dashboard/report`,
  });

  if (result.sent) {
    console.log(`[test-email] 送信しました（ID: ${result.messageId ?? '不明'}）`);
    console.log('[test-email] 数分たっても届かない場合は迷惑メールフォルダを見てください。');
    return;
  }

  console.error(`[test-email] 送れませんでした: ${result.reason}`);
  console.error('');
  console.error('よくある原因:');
  console.error('  - RESEND_API_KEY が未登録、または綴り違い');
  console.error('  - REPORT_EMAIL_FROM が未登録');
  console.error('  - 差出人のドメインが Resend で未認証');
  console.error('  - onboarding@resend.dev は Resend に登録した本人宛にしか送れない');
  process.exit(1);
}

main().catch((err) => {
  console.error('[test-email] 予期しないエラー:', err);
  process.exit(1);
});
