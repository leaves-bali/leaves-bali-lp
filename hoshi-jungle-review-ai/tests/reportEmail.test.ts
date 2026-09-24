import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatPeriod, renderMonthlyReportEmail } from '../src/lib/reports/renderEmail';
import type { MonthlyReportRow } from '../src/lib/database.types';

/**
 * 月次レポートのメール本文。
 *
 * メールは送ったら取り消せない。数字が抜けた・壊れたメールをお店に送ると、
 * その1通で信用が落ちる。組み立てだけを切り出してテストで固定している。
 */

function report(overrides: Partial<MonthlyReportRow> = {}): MonthlyReportRow {
  return {
    monthly_report_id: 'r1',
    location_id: 'l1',
    period: '2026-08-01',
    review_count: 12,
    prev_review_count: 8,
    average_rating: 4.25,
    prev_average_rating: 3.875,
    by_language: { ja: 9, en: 3 },
    reply_rate: 0.75,
    prev_reply_rate: 0.5,
    praised_themes: [{ topic: '朝食', count: 5 }],
    complained_themes: [{ topic: '駐車場の分かりにくさ', count: 3 }],
    next_actions: ['駐車場の入口の看板を大きくする'],
    model: 'claude-haiku-4-5',
    generation_meta: {},
    emailed_at: null,
    created_at: '2026-09-01T01:00:00.000Z',
    ...overrides,
  };
}

const input = {
  storeName: '寿司 まつおか',
  period: '2026-08-01',
  report: report(),
  reportUrl: 'https://example.com/dashboard/report',
};

test('件名にお店の名前と対象の月が入る', () => {
  const mail = renderMonthlyReportEmail(input);
  assert.ok(mail.subject.includes('寿司 まつおか'));
  assert.ok(mail.subject.includes('2026年8月'));
});

test('本文に数字と前月比が入る', () => {
  const mail = renderMonthlyReportEmail(input);
  for (const expected of ['12件', '8件', '4.25', '3.88', '75%', '50%']) {
    assert.ok(mail.html.includes(expected), `HTML に ${expected} が無い`);
    assert.ok(mail.text.includes(expected), `テキストに ${expected} が無い`);
  }
});

test('話題と来月やることが入る', () => {
  const mail = renderMonthlyReportEmail(input);
  assert.ok(mail.html.includes('朝食'));
  assert.ok(mail.html.includes('駐車場の分かりにくさ'));
  assert.ok(mail.html.includes('駐車場の入口の看板を大きくする'));
  assert.ok(mail.text.includes('駐車場の入口の看板を大きくする'));
});

test('HTMLを読まない環境向けのテキスト版が必ず付く', () => {
  // text が無いメールは迷惑メール判定されやすい。
  const mail = renderMonthlyReportEmail(input);
  assert.ok(mail.text.length > 50);
  assert.ok(!mail.text.includes('<'));
});

test('該当が無い項目は見出しごと出さない', () => {
  // 空の見出しが並ぶと「壊れている」と受け取られる。
  const mail = renderMonthlyReportEmail({
    ...input,
    report: report({ praised_themes: [], complained_themes: [], next_actions: [] }),
  });
  // 脚注には「来月やること」という語が説明として残るので、見出しの markup で判定する。
  assert.ok(!mail.html.includes('>褒められた点<'));
  assert.ok(!mail.html.includes('>来月やること<'));
  assert.ok(!mail.html.includes('<ol'));
  assert.ok(!mail.html.includes('<ul'));
  // 数字は残る
  assert.ok(mail.html.includes('12件'));
});

test('前月のデータが無い月でも壊れない', () => {
  const mail = renderMonthlyReportEmail({
    ...input,
    report: report({ average_rating: null, prev_average_rating: null, reply_rate: null, prev_reply_rate: null }),
  });
  assert.ok(mail.html.includes('前の月のデータなし'));
  assert.ok(!mail.html.includes('NaN'));
  assert.ok(!mail.text.includes('NaN'));
});

test('店名や話題に記号が入ってもHTMLが壊れない', () => {
  // 店名は人が入力し、話題は AI が書く。どちらも < や & が入りうる。
  const mail = renderMonthlyReportEmail({
    ...input,
    storeName: '寿司 <まつおか> & Co.',
    report: report({ praised_themes: [{ topic: '"朝食"', count: 2 }] }),
  });
  assert.ok(mail.html.includes('&lt;まつおか&gt;'));
  assert.ok(mail.html.includes('&amp; Co.'));
  assert.ok(!mail.html.includes('<まつおか>'));
  assert.ok(mail.html.includes('&quot;朝食&quot;'));
});

test('レポート画面へのリンクが入る', () => {
  const mail = renderMonthlyReportEmail(input);
  assert.ok(mail.html.includes('https://example.com/dashboard/report'));
  assert.ok(mail.text.includes('https://example.com/dashboard/report'));
});

test('対象月の表記', () => {
  assert.equal(formatPeriod('2026-08-01'), '2026年8月');
  assert.equal(formatPeriod('2026-12-01'), '2026年12月');
  // 想定外の値でもそのまま返す（例外で送信を止めない）
  assert.equal(formatPeriod('こわれた値'), 'こわれた値');
});
