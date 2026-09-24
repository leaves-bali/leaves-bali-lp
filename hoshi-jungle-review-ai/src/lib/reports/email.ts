import 'server-only';

import type { MonthlyReportRow } from '@/lib/database.types';

/**
 * 月次レポートのメール送信口（差し込み口）。
 *
 * 【現時点では何も送りません】
 * 送信サービス（Resend / SendGrid / Amazon SES など）をまだ決めていないため、
 * ここは「決まったときに中身を書けばよい」1 つの関数として空けてある。
 *
 * サービスを選ぶときの判断材料:
 *  - Resend: 無料枠 月3,000通・1日100通。設定が最も短い。独自ドメイン推奨。
 *  - SendGrid: 無料枠が廃止され、現在は有料（月$19.95〜）。
 *  - Amazon SES: 月62,000通まで実質無料だが、サンドボックス解除の申請が要る。
 *
 * どれを選んでも、呼び出し側（scripts/monthly-report.ts）は変えずに済むように
 * 入口をこの 1 関数に絞っている。
 *
 * 【送信していないのに送信済みにしない】
 * 未設定のときは sent: false を返す。呼び出し側はこの値を見て
 * monthly_reports.emailed_at を更新するかどうかを決める。
 * ここで true を返してしまうと「送ったことになっているのに届かない」が起きる。
 */

export interface MonthlyReportEmail {
  /** 送り先。店舗の連絡先メールアドレス */
  to: string;
  storeName: string;
  /** 対象月（YYYY-MM-01） */
  period: string;
  report: MonthlyReportRow;
  /** レポートを開ける画面の URL */
  reportUrl: string;
}

export interface EmailDeliveryResult {
  sent: boolean;
  /** 送らなかった理由。ログに出す */
  reason?: string;
}

export async function sendMonthlyReportEmail(
  email: MonthlyReportEmail,
): Promise<EmailDeliveryResult> {
  // ここに送信処理を書く。例（Resend の場合）:
  //   const res = await fetch('https://api.resend.com/emails', {
  //     method: 'POST',
  //     headers: {
  //       Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       from: '...',
  //       to: email.to,
  //       subject: `${email.storeName} ${email.period} のクチコミレポート`,
  //       html: renderMonthlyReportHtml(email),
  //     }),
  //   });
  //   return { sent: res.ok, reason: res.ok ? undefined : await res.text() };
  void email;
  return { sent: false, reason: 'メール送信サービスが未設定です（送信処理は未実装）。' };
}
