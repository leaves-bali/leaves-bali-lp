import 'server-only';

import { env } from '@/lib/env';
import { renderMonthlyReportEmail } from '@/lib/reports/renderEmail';
import type { MonthlyReportRow } from '@/lib/database.types';

/**
 * 月次レポートのメール送信（Resend）。
 *
 * 【なぜ Resend か】
 * 無料枠が月3,000通・1日100通あり、月1回・店舗数ぶんの送信なら当分無料で収まる。
 * SendGrid は無料枠が廃止され（月$19.95〜）、Amazon SES はサンドボックス解除の
 * 申請が要る。月0ドル運用を壊さずに、いちばん早く動かせるのが Resend だった。
 *
 * 【なぜ SDK を入れず fetch で呼ぶのか】
 * 使うのは「1通送る」だけ。依存を1つ増やすと、更新のたびに保守が必要になる。
 * Resend の API はエンドポイント1つ・JSON 1つで済む。
 *
 * 【失敗しても例外を投げない】
 * メールが送れないことは、レポートが作れないことより軽い。
 * ここで投げると、バッチが止まって次の店舗のレポートまで作られなくなる。
 * 送れなかった理由を返して、呼び出し側がログに残す。
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** 通信が返ってこないときにバッチを止めないための上限。 */
const TIMEOUT_MS = 10_000;

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
  /** 送れなかった理由。ログに出す */
  reason?: string;
  /** Resend が返すメールID。問い合わせの追跡に使う */
  messageId?: string;
}

export async function sendMonthlyReportEmail(
  email: MonthlyReportEmail,
): Promise<EmailDeliveryResult> {
  // 未設定のまま「送信済み」にしない。
  // ここで true を返すと、届いていないのに emailed_at が埋まってしまう。
  if (!env.resendApiKey) {
    return { sent: false, reason: 'RESEND_API_KEY が未設定です' };
  }
  if (!env.reportEmailFrom) {
    return { sent: false, reason: 'REPORT_EMAIL_FROM が未設定です' };
  }

  const content = renderMonthlyReportEmail({
    storeName: email.storeName,
    period: email.period,
    report: email.report,
    reportUrl: email.reportUrl,
  });

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.reportEmailFrom,
        to: [email.to],
        subject: content.subject,
        html: content.html,
        // HTML を表示しない環境向け。これが無いと迷惑メール判定されやすい。
        text: content.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // 本文に原因（ドメイン未認証・宛先不正など）が入っている。握りつぶさない。
      const detail = await response.text().catch(() => '');
      return { sent: false, reason: `Resend が ${response.status} を返しました: ${detail.slice(0, 300)}` };
    }

    const json = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, messageId: json.id };
  } catch (err) {
    return {
      sent: false,
      reason: `送信に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
