import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateAttention, shouldAutoPublish } from '../src/lib/reviews/policy';

const base = { rating: 5, language: 'en' as const, languageIsUncertain: false, aiFlagged: false, aiReason: null };

test('5つ星の英語レビューは要確認にならない', () => {
  assert.equal(evaluateAttention(base).needsAttention, false);
});

test('低評価は必ず要確認', () => {
  const r = evaluateAttention({ ...base, rating: 2 });
  assert.equal(r.needsAttention, true);
  assert.match(r.reasons.join(), /低評価/);
});

test('インドネシア語は必ず要確認', () => {
  const r = evaluateAttention({ ...base, language: 'id' });
  assert.equal(r.needsAttention, true);
  assert.match(r.reasons.join(), /インドネシア語/);
});

test('AI が要確認と判定したら理由を引き継ぐ', () => {
  const r = evaluateAttention({ ...base, aiFlagged: true, aiReason: '返金要求あり' });
  assert.equal(r.needsAttention, true);
  assert.match(r.reasons.join(), /返金要求あり/);
});

test('AUTO_PUBLISH_ENABLED が未設定なら常に自動公開しない', () => {
  delete process.env.AUTO_PUBLISH_ENABLED;
  assert.equal(shouldAutoPublish({ rating: 5, language: 'en', needsAttention: false }), false);
});

test('自動公開を有効にしても インドネシア語は公開しない', () => {
  process.env.AUTO_PUBLISH_ENABLED = 'true';
  process.env.AUTO_PUBLISH_LANGUAGES = 'ja,en,id'; // id を混ぜても env 層で除外される
  process.env.AUTO_PUBLISH_MIN_RATING = '4';
  assert.equal(shouldAutoPublish({ rating: 5, language: 'id', needsAttention: false }), false);
  assert.equal(shouldAutoPublish({ rating: 5, language: 'ja', needsAttention: false }), true);
});

test('自動公開を有効にしても 閾値未満の評点は公開しない', () => {
  process.env.AUTO_PUBLISH_ENABLED = 'true';
  process.env.AUTO_PUBLISH_LANGUAGES = 'ja,en';
  process.env.AUTO_PUBLISH_MIN_RATING = '4';
  assert.equal(shouldAutoPublish({ rating: 3, language: 'en', needsAttention: false }), false);
});

test('要確認フラグが立っていれば自動公開しない', () => {
  process.env.AUTO_PUBLISH_ENABLED = 'true';
  process.env.AUTO_PUBLISH_LANGUAGES = 'ja,en';
  assert.equal(shouldAutoPublish({ rating: 5, language: 'en', needsAttention: true }), false);
});
