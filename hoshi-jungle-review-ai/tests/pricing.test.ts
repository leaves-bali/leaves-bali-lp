import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  estimateCostUsd,
  estimatedCostPerReply,
  evaluateBudget,
  priceFor,
  repliesPerBudget,
} from '../src/lib/ai/pricing';

test('既知モデルの単価を返す', () => {
  assert.deepEqual(priceFor('claude-haiku-4-5'), { input: 1, output: 5 });
  assert.deepEqual(priceFor('claude-opus-5'), { input: 5, output: 25 });
});

test('日付サフィックス付きのモデル名でも単価を引ける', () => {
  // API のレスポンスはサフィックス付きのことがある
  assert.deepEqual(priceFor('claude-haiku-4-5-20251001'), { input: 1, output: 5 });
});

test('未知のモデルは最も高い単価で見積もる（予算超過を防ぐ安全側）', () => {
  assert.deepEqual(priceFor('claude-unknown-future-model'), { input: 5, output: 25 });
});

test('コスト計算が正しい', () => {
  // haiku: 100万入力 = $1、100万出力 = $5
  assert.equal(estimateCostUsd('claude-haiku-4-5', 1_000_000, 0), 1);
  assert.equal(estimateCostUsd('claude-haiku-4-5', 0, 1_000_000), 5);
  assert.equal(estimateCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000), 6);
});

test('コストは小数第6位に丸める（numeric(12,6) の桁あふれ防止）', () => {
  const cost = estimateCostUsd('claude-haiku-4-5', 1_337, 733);
  assert.equal(cost, Math.round(cost * 1e6) / 1e6);
});

test('予算を使い切ったら exhausted になる', () => {
  const perReply = estimatedCostPerReply('claude-haiku-4-5');
  const nearlyFull = evaluateBudget(0.4 - perReply / 2, 0.4, 'claude-haiku-4-5');
  assert.equal(nearlyFull.exhausted, true, '次の1件が入らない時点で止める');

  const roomLeft = evaluateBudget(0.4 - perReply * 3, 0.4, 'claude-haiku-4-5');
  assert.equal(roomLeft.exhausted, false);
  assert.equal(roomLeft.remainingReplies, 3);
});

test('予算ゼロなら最初から生成しない', () => {
  const state = evaluateBudget(0, 0, 'claude-haiku-4-5');
  assert.equal(state.exhausted, true);
  assert.equal(state.remainingReplies, 0);
});

test('超過しても残額はマイナスにならない', () => {
  const state = evaluateBudget(10, 0.4, 'claude-haiku-4-5');
  assert.equal(state.remainingUsd, 0);
  assert.equal(state.remainingReplies, 0);
  assert.equal(state.exhausted, true);
});

test('無料クレジット $5 の想定件数（ドキュメント記載値の回帰テスト）', () => {
  assert.equal(repliesPerBudget('claude-haiku-4-5', 5), 892);
  assert.equal(repliesPerBudget('claude-sonnet-5', 5), 446);
  assert.equal(repliesPerBudget('claude-opus-5', 5), 178);
});

test('月 $0.40 で haiku なら 71 件（ドキュメント記載値の回帰テスト）', () => {
  assert.equal(repliesPerBudget('claude-haiku-4-5', 0.4), 71);
});
