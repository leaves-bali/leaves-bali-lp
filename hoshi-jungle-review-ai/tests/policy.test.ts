import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateAttention, shouldAutoPublish } from '../src/lib/reviews/policy';
import type { ReviewLanguage } from '../src/lib/database.types';

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

/**
 * 自動公開の条件は店舗ごとの設定から来る。
 * 以前は環境変数を直接読んでいたため、全店で同じ方針しか取れなかった。
 */
function settings(over: Partial<{
  autoPublishEnabled: boolean;
  autoPublishMinRating: number;
  autoPublishLanguages: ReviewLanguage[];
}> = {}) {
  return {
    autoPublishEnabled: false,
    autoPublishMinRating: 4,
    autoPublishLanguages: [] as ReviewLanguage[],
    ...over,
  };
}

test('自動公開が無効なら常に公開しない', () => {
  assert.equal(
    shouldAutoPublish({ rating: 5, language: 'en', needsAttention: false, settings: settings() }),
    false,
  );
});

test('有効にしてもインドネシア語は公開しない（設定に入っていても）', () => {
  // 設定を無理やり汚しても通らないことを確かめる。
  // DB 制約・設定の正規化・判定の 3 段で弾いているが、最後の砦がここ。
  const s = settings({
    autoPublishEnabled: true,
    autoPublishLanguages: ['ja', 'en', 'id' as ReviewLanguage],
  });
  assert.equal(shouldAutoPublish({ rating: 5, language: 'id', needsAttention: false, settings: s }), false);
  assert.equal(shouldAutoPublish({ rating: 5, language: 'ja', needsAttention: false, settings: s }), true);
});

test('閾値未満の評点は公開しない', () => {
  const s = settings({ autoPublishEnabled: true, autoPublishLanguages: ['ja', 'en'], autoPublishMinRating: 4 });
  assert.equal(shouldAutoPublish({ rating: 3, language: 'en', needsAttention: false, settings: s }), false);
  assert.equal(shouldAutoPublish({ rating: 4, language: 'en', needsAttention: false, settings: s }), true);
});

test('要確認フラグが立っていれば公開しない', () => {
  const s = settings({ autoPublishEnabled: true, autoPublishLanguages: ['ja', 'en'] });
  assert.equal(shouldAutoPublish({ rating: 5, language: 'en', needsAttention: true, settings: s }), false);
});

test('許可リストに無い言語は公開しない', () => {
  const s = settings({ autoPublishEnabled: true, autoPublishLanguages: ['ja'] });
  assert.equal(shouldAutoPublish({ rating: 5, language: 'en', needsAttention: false, settings: s }), false);
});

test('店ごとに方針が変えられる', () => {
  // 複数店舗に売る以上、これが成り立たないと意味がない。
  const 手動のみ = settings();
  const 日本語だけ自動 = settings({ autoPublishEnabled: true, autoPublishLanguages: ['ja'] });
  const input = { rating: 5, language: 'ja' as ReviewLanguage, needsAttention: false };
  assert.equal(shouldAutoPublish({ ...input, settings: 手動のみ }), false);
  assert.equal(shouldAutoPublish({ ...input, settings: 日本語だけ自動 }), true);
});
