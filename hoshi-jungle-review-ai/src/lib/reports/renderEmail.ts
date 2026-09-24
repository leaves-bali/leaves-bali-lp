import { LANGUAGE_LABELS } from '@/lib/constants';
import type { MonthlyReportRow, ReviewLanguage } from '@/lib/database.types';

/**
 * 月次レポートのメール本文を組み立てる。
 *
 * 【なぜ送信処理と分けているのか】
 * 文面の組み立ては通信を伴わないので、ここを分けておくとテストで固定できる。
 * 「数字が抜けたメールをお店に送ってしまった」は取り返しがつかない。
 *
 * 【なぜ CSS を全部インラインで書くのか】
 * Gmail は <style> の多くを落とす。外部 CSS も読まない。
 * メールでは要素ごとに style を書くのが確実な方法で、これは古い作法ではなく
 * 現在も必要な制約。同じ理由でレイアウトも <table> で組んでいる。
 */

export interface MonthlyReportEmailContent {
  subject: string;
  html: string;
  /** HTML を表示しない環境向け。これが無いと迷惑メール判定されやすくなる。 */
  text: string;
}

export interface RenderInput {
  storeName: string;
  /** 対象月（YYYY-MM-01） */
  period: string;
  report: MonthlyReportRow;
  reportUrl: string;
}

const RED = '#c8102e';
const RED_DARK = '#93091f';
const INK = '#1f1f1f';
const INK_MID = '#444444';
const INK_SOFT = '#5a5a5a';
const LINE = '#dcdcdc';
const TINT = '#fdf1f1';

export function renderMonthlyReportEmail(input: RenderInput): MonthlyReportEmailContent {
  const month = formatPeriod(input.period);

  const subject = `${input.storeName} ${month}のクチコミレポート`;
  return {
    subject,
    html: renderHtml(input, month, subject),
    text: renderText(input, month),
  };
}

function renderHtml(input: RenderInput, month: string, subject: string): string {
  const { report } = input;

  const metrics = [
    metricRow('クチコミの件数', `${report.review_count}件`, `前の月: ${report.prev_review_count}件`),
    metricRow(
      '平均の評価',
      report.average_rating === null ? '—' : `★ ${report.average_rating.toFixed(2)}`,
      report.prev_average_rating === null
        ? '前の月のデータなし'
        : `前の月: ★ ${report.prev_average_rating.toFixed(2)}`,
    ),
    metricRow(
      '返信できた割合',
      formatRate(report.reply_rate),
      report.prev_reply_rate === null
        ? '前の月のデータなし'
        : `前の月: ${formatRate(report.prev_reply_rate)}`,
    ),
  ].join('');

  // 「ja: 18件」ではお店の人に伝わらない。原語表記の言語名で出す。
  const languages = Object.entries(report.by_language)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${escapeHtml(languageLabel(code))}: ${count}件`)
    .join(' &nbsp;/&nbsp; ');

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f7f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:8px;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;">

  <tr><td style="padding:28px 28px 8px 28px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:${RED};">MONTHLY REPORT</div>
    <div style="margin-top:10px;font-size:22px;font-weight:700;color:${RED_DARK};line-height:1.4;">
      ${escapeHtml(input.storeName)}<br>${escapeHtml(month)}のクチコミ
    </div>
  </td></tr>

  <tr><td style="padding:16px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${metrics}</table>
  </td></tr>

  ${
    languages
      ? `<tr><td style="padding:16px 28px 0 28px;">
    <div style="font-size:12px;font-weight:700;color:${INK};">言語ごとの件数</div>
    <div style="margin-top:6px;font-size:13px;color:${INK_MID};">${languages}</div>
  </td></tr>`
      : ''
  }

  ${themeBlock('褒められた点', report.praised_themes)}
  ${themeBlock('指摘された点', report.complained_themes)}
  ${actionBlock(report.next_actions)}

  <tr><td style="padding:24px 28px 8px 28px;">
    <a href="${escapeHtml(input.reportUrl)}"
       style="display:inline-block;background:${RED};color:#ffffff;text-decoration:none;
              font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;">
      画面で詳しく見る
    </a>
  </td></tr>

  <tr><td style="padding:20px 28px 28px 28px;">
    <div style="border-top:1px solid ${LINE};padding-top:14px;font-size:11px;color:${INK_SOFT};line-height:1.8;">
      件数・平均・返信率は実際のクチコミから数えた値です。<br>
      話題のまとめと「来月やること」はAIが書いています。
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function metricRow(label: string, value: string, previous: string): string {
  return `<tr><td style="padding:8px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${TINT};border-radius:6px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-size:12px;color:${INK_SOFT};">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:24px;font-weight:700;color:${RED_DARK};">${escapeHtml(value)}</div>
        <div style="margin-top:2px;font-size:11px;color:${INK_SOFT};">${escapeHtml(previous)}</div>
      </td></tr>
    </table>
  </td></tr>`;
}

function themeBlock(title: string, themes: Array<{ topic: string; count: number }>): string {
  // 該当が無い月は見出しごと出さない。空の見出しが並ぶと「壊れている」に見える。
  if (!themes.length) return '';
  const items = themes
    .map(
      (theme) =>
        `<li style="margin-bottom:4px;">${escapeHtml(theme.topic)}
         <span style="color:${INK_SOFT};font-size:12px;">（${theme.count}件）</span></li>`,
    )
    .join('');
  return `<tr><td style="padding:18px 28px 0 28px;">
    <div style="font-size:14px;font-weight:700;color:${INK};">${escapeHtml(title)}</div>
    <ul style="margin:8px 0 0 0;padding-left:20px;font-size:13px;color:${INK_MID};line-height:1.9;">${items}</ul>
  </td></tr>`;
}

function actionBlock(actions: string[]): string {
  if (!actions.length) return '';
  const items = actions
    .map((action) => `<li style="margin-bottom:8px;">${escapeHtml(action)}</li>`)
    .join('');
  return `<tr><td style="padding:20px 28px 0 28px;">
    <div style="font-size:14px;font-weight:700;color:${RED_DARK};">来月やること</div>
    <ol style="margin:8px 0 0 0;padding-left:20px;font-size:13px;color:${INK_MID};line-height:1.85;">${items}</ol>
  </td></tr>`;
}

function renderText(input: RenderInput, month: string): string {
  const { report } = input;
  const lines = [
    `${input.storeName} ${month}のクチコミレポート`,
    '',
    `クチコミの件数: ${report.review_count}件（前の月: ${report.prev_review_count}件）`,
    `平均の評価: ${report.average_rating === null ? '—' : report.average_rating.toFixed(2)}` +
      (report.prev_average_rating === null
        ? ''
        : `（前の月: ${report.prev_average_rating.toFixed(2)}）`),
    `返信できた割合: ${formatRate(report.reply_rate)}` +
      (report.prev_reply_rate === null ? '' : `（前の月: ${formatRate(report.prev_reply_rate)}）`),
  ];

  if (report.praised_themes.length) {
    lines.push('', '褒められた点:');
    for (const theme of report.praised_themes) lines.push(`- ${theme.topic}（${theme.count}件）`);
  }
  if (report.complained_themes.length) {
    lines.push('', '指摘された点:');
    for (const theme of report.complained_themes) lines.push(`- ${theme.topic}（${theme.count}件）`);
  }
  if (report.next_actions.length) {
    lines.push('', '来月やること:');
    report.next_actions.forEach((action, index) => lines.push(`${index + 1}. ${action}`));
  }

  lines.push(
    '',
    `画面で詳しく見る: ${input.reportUrl}`,
    '',
    '件数・平均・返信率は実際のクチコミから数えた値です。',
    '話題のまとめと「来月やること」はAIが書いています。',
  );
  return lines.join('\n');
}

/** 未知のコードが入っていてもそのまま出す（表示のために例外で止めない）。 */
export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code as ReviewLanguage] ?? code;
}

/** 「2026-08-01」→「2026年8月」 */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  return `${year}年${Number(month)}月`;
}

function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/**
 * 店名・話題・次の一手は、人が書いた文字列と AI が書いた文字列。
 * & や < がそのまま入るとレイアウトが壊れるので必ず通す。
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
