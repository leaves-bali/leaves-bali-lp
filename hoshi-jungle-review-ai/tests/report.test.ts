import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isReplied,
  monthRange,
  periodKey,
  previousMonth,
  reviewDate,
  splitByPeriod,
  summarizePeriod,
  targetPeriodFor,
  toReportReview,
  type RawReportReview,
} from '../src/lib/reports/aggregate';
import { normalizeActions, normalizeThemes } from '../src/lib/reports/themes';

/**
 * 月次レポートの数字。
 *
 * 営業資料（P.13）で「導入前の1か月と比べてお伝えします」と約束している。
 * ここが狂うと、お店に渡す資料がそのまま嘘になる。
 * AI を通さず数えている部分なので、テストで固定できる。
 */

function review(overrides: Partial<RawReportReview> = {}): RawReportReview {
  return {
    rating: 5,
    language: 'ja',
    text: 'よかったです',
    google_create_time: '2026-08-10T00:00:00.000Z',
    created_at: '2026-08-11T00:00:00.000Z',
    has_google_reply: false,
    reply: null,
    ...overrides,
  };
}

// --- 数える部分 --------------------------------------------------------------

test('件数・平均・言語別・返信率を数える', () => {
  const metrics = summarizePeriod([
    { rating: 5, language: 'ja', replied: true },
    { rating: 4, language: 'ja', replied: true },
    { rating: 3, language: 'en', replied: false },
    { rating: 2, language: 'ko', replied: false },
  ]);

  assert.equal(metrics.reviewCount, 4);
  assert.equal(metrics.averageRating, 3.5);
  assert.deepEqual(metrics.byLanguage, { ja: 2, en: 1, ko: 1 });
  assert.equal(metrics.replyRate, 0.5);
});

test('クチコミが0件の月は平均も返信率も null', () => {
  // 0.00 と書くと「評価0」「返信率0%」に見える。データが無いことと区別する。
  const metrics = summarizePeriod([]);
  assert.equal(metrics.reviewCount, 0);
  assert.equal(metrics.averageRating, null);
  assert.equal(metrics.replyRate, null);
  assert.deepEqual(metrics.byLanguage, {});
});

test('星の無いクチコミを0点として平均に混ぜない', () => {
  const metrics = summarizePeriod([
    { rating: 5, language: 'ja', replied: false },
    { rating: 0, language: 'ja', replied: false },
  ]);
  // 0 を混ぜれば 2.5 になる。件数は2件のまま、平均は5.00。
  assert.equal(metrics.reviewCount, 2);
  assert.equal(metrics.averageRating, 5);
});

// --- 返信したかの判定 --------------------------------------------------------

test('導入前にGoogle側で返信済みだった分も「返信した」に数える', () => {
  // ここを落とすと「導入前の返信率0%」という比較にならない数字が出る。
  assert.equal(isReplied(review({ has_google_reply: true })), true);
});

test('公開済み・他サイトで貼り戻し済みを「返信した」に数える', () => {
  assert.equal(
    isReplied(review({ reply: { published_at: '2026-08-12T00:00:00.000Z', externally_replied_at: null } })),
    true,
  );
  assert.equal(
    isReplied(review({ reply: { published_at: null, externally_replied_at: '2026-08-12T00:00:00.000Z' } })),
    true,
  );
  // 下書きのままは返信していない
  assert.equal(isReplied(review({ reply: { published_at: null, externally_replied_at: null } })), false);
});

// --- 月の振り分け ------------------------------------------------------------

test('投稿日を優先し、無いときだけ取り込み日で数える', () => {
  assert.equal(
    reviewDate(review({ google_create_time: '2026-07-31T23:00:00.000Z' })).toISOString(),
    '2026-07-31T23:00:00.000Z',
  );
  assert.equal(
    reviewDate(review({ google_create_time: null, created_at: '2026-08-11T00:00:00.000Z' })).toISOString(),
    '2026-08-11T00:00:00.000Z',
  );
});

test('対象月と前月に振り分け、範囲外は捨てる', () => {
  // 取り込み日を優先すると、初回同期の月に過去のクチコミが全部積み上がる。
  const period = new Date(Date.UTC(2026, 7, 1)); // 2026-08
  const split = splitByPeriod(
    [
      review({ google_create_time: '2026-08-01T00:00:00.000Z' }),
      review({ google_create_time: '2026-08-31T23:59:59.000Z' }),
      review({ google_create_time: '2026-07-15T00:00:00.000Z' }),
      review({ google_create_time: '2026-09-01T00:00:00.000Z' }), // 翌月
      review({ google_create_time: '2026-06-30T23:59:59.000Z' }), // 前々月
      // 取り込み日は8月だが、投稿は2024年。過去のクチコミなので対象外。
      review({ google_create_time: '2024-08-10T00:00:00.000Z', created_at: '2026-08-11T00:00:00.000Z' }),
    ],
    period,
  );

  assert.equal(split.current.length, 2);
  assert.equal(split.previous.length, 1);
});

test('月の境界の計算が年をまたいでも合う', () => {
  const january = new Date(Date.UTC(2026, 0, 1));
  assert.equal(periodKey(previousMonth(january)), '2025-12-01');

  const december = monthRange(new Date(Date.UTC(2025, 11, 1)));
  assert.equal(december.start.toISOString(), '2025-12-01T00:00:00.000Z');
  assert.equal(december.end.toISOString(), '2026-01-01T00:00:00.000Z');

  // うるう年の2月
  const february = monthRange(new Date(Date.UTC(2028, 1, 1)));
  assert.equal(february.end.toISOString(), '2028-03-01T00:00:00.000Z');
});

test('毎月1日のバッチは前月を対象にする', () => {
  assert.equal(periodKey(targetPeriodFor(new Date('2026-09-01T01:00:00.000Z'))), '2026-08-01');
  assert.equal(periodKey(targetPeriodFor(new Date('2026-01-01T01:00:00.000Z'))), '2025-12-01');
});

test('生の行を集計用の形に落とせる', () => {
  const converted = toReportReview(review({ rating: 3, language: 'en', has_google_reply: true }));
  assert.deepEqual(converted, { rating: 3, language: 'en', replied: true });
});

// --- AI の出力の後始末 -------------------------------------------------------

test('話題の件数が実際のクチコミ数を超えない', () => {
  // 「朝食が好評（7件）」を読んだ店長は朝食に投資する。実際が1件なら判断ごと誤る。
  const themes = normalizeThemes([{ topic: '朝食', count: 99 }], 10);
  assert.deepEqual(themes, [{ topic: '朝食', count: 10 }]);
});

test('1件しか出ていない話題を傾向として扱わない', () => {
  const themes = normalizeThemes(
    [
      { topic: '朝食', count: 3 },
      { topic: '駐車場', count: 1 },
    ],
    20,
  );
  assert.deepEqual(themes, [{ topic: '朝食', count: 3 }]);
});

test('クチコミが少ない月は1件の話題も残す', () => {
  // 3件しか届かなかった月に「傾向なし」とだけ返しても、店長には何も残らない。
  const themes = normalizeThemes([{ topic: '駐車場', count: 1 }], 3);
  assert.deepEqual(themes, [{ topic: '駐車場', count: 1 }]);
});

test('言い換えの重複をまとめ、件数の多い順に最大5件まで', () => {
  const themes = normalizeThemes(
    [
      { topic: '朝食', count: 2 },
      { topic: '朝 食', count: 5 },
      { topic: '部屋の清潔さ', count: 9 },
      { topic: '立地', count: 8 },
      { topic: '接客', count: 7 },
      { topic: '価格', count: 6 },
      { topic: '眺め', count: 4 },
    ],
    20,
  );

  assert.equal(themes.length, 5);
  assert.deepEqual(
    themes.map((theme) => theme.topic),
    ['部屋の清潔さ', '立地', '接客', '価格', '朝 食'],
  );
});

test('壊れた話題（空文字・数字でない件数）を捨てる', () => {
  const themes = normalizeThemes(
    [
      { topic: '  ', count: 5 },
      { topic: '朝食', count: 'たくさん' },
      { topic: '立地', count: 4 },
    ],
    10,
  );
  assert.deepEqual(themes, [{ topic: '立地', count: 4 }]);
});

test('話題が配列でないときは空を返す', () => {
  assert.deepEqual(normalizeThemes(null, 10), []);
  assert.deepEqual(normalizeThemes(undefined, 10), []);
});

test('来月やることは最大3つ。重複と空白を落とす', () => {
  const actions = normalizeActions([
    '駐車場の入口に大きな看板を出す',
    '駐車場の入口に大きな看板を出す',
    '  ',
    '朝食のパンの種類を増やす',
    'チェックイン待ちの椅子を増やす',
    '4つ目は捨てられる',
  ]);

  assert.deepEqual(actions, [
    '駐車場の入口に大きな看板を出す',
    '朝食のパンの種類を増やす',
    'チェックイン待ちの椅子を増やす',
  ]);
});

test('材料が無ければ空のまま返す（一般論で埋めない）', () => {
  // 「顧客満足度の向上に努める」で埋まったレポートは読まれず、解約の理由になる。
  assert.deepEqual(normalizeActions([]), []);
  assert.deepEqual(normalizeThemes([], 30), []);
});
