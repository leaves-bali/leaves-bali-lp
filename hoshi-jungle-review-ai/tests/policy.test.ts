import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateAttention, shouldAutoPublish } from '../src/lib/reviews/policy';

const base = {
  rating: 5,
  language: 'en' as const,
  languageIsUncertain: false,
  aiFlagged: false,
};

test('5つ星の英語レビューは要確認にならない', () => {
  const r = evaluateAttention(base);
  assert.equal(r.needsAttention, false);
  assert.deepEqual(r.codes, []);
});

test('低評価は必ず要確認', () => {
  const r = evaluateAttention({ ...base, rating: 2 });
  assert.equal(r.needsAttention, true);
  assert.ok(r.codes.includes('low_rating'));
});

test('インドネシア語は必ず要確認', () => {
  const r = evaluateAttention({ ...base, language: 'id' });
  assert.equal(r.needsAttention, true);
  assert.ok(r.codes.includes('indonesian'));
});

test('対応外の言語は要確認', () => {
  const r = evaluateAttention({ ...base, language: 'other' });
  assert.ok(r.codes.includes('unsupported_language'));
});

test('中国語・韓国語は言語だけを理由に要確認にはならない', () => {
  // 5言語に対応済みなので、対応外扱いにしてはいけない
  for (const language of ['zh', 'ko'] as const) {
    const r = evaluateAttention({ ...base, language });
    assert.equal(r.needsAttention, false, `${language} が要確認になっている`);
  }
});

test('AI が要確認と判定したらコードが立つ', () => {
  const r = evaluateAttention({ ...base, aiFlagged: true });
  assert.equal(r.needsAttention, true);
  assert.ok(r.codes.includes('ai_flagged'));
});

test('理由は言語非依存のコードで返す（画面の言語で翻訳するため）', () => {
  const r = evaluateAttention({ ...base, rating: 1, language: 'id' });
  // 日本語の文言が混ざっていないこと
  for (const code of r.codes) {
    assert.match(code, /^[a-z_]+$/, `コードでない値が混ざっている: ${code}`);
  }
});

test('AUTO_PUBLISH_ENABLED が未設定なら常に自動公開しない', () => {
  delete process.env.AUTO_PUBLISH_ENABLED;
  assert.equal(shouldAutoPublish({ rating: 5, language: 'en', needsAttention: false }), false);
});

test('自動公開を有効にしても インドネシア語は公開しない', () => {
  process.env.AUTO_PUBLISH_ENABLED = 'true';
  process.env.AUTO_PUBLISH_LANGUAGES = 'ja,en,id';
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
