import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectLanguage, reconcileLanguage } from '../src/lib/lang/detect';

test('長い日本語を ja と判定する', () => {
  const r = detectLanguage(
    'スタッフの方がとても親切で、ジャングルビューのプールが最高でした。また泊まりたいです。',
  );
  assert.equal(r.language, 'ja');
  assert.equal(r.source, 'script');
  assert.equal(r.needsConfirmation, false);
});

test('短い日本語（tinyld が判定不能な長さ）も文字種で ja と判定する', () => {
  // この入力は tinyld 単体では候補ゼロを返す。文字種チェックの存在意義そのもの。
  const r = detectLanguage('最高！');
  assert.equal(r.language, 'ja');
  assert.equal(r.source, 'script');
});

test('漢字のみの入力は ja だが要確認フラグを立てる', () => {
  const r = detectLanguage('最高');
  assert.equal(r.language, 'ja');
  assert.equal(r.source, 'script');
  assert.equal(r.needsConfirmation, true);
});

test('英語を en と判定する', () => {
  const r = detectLanguage(
    'Absolutely stunning place. The infinity pool overlooking the jungle is unreal.',
  );
  assert.equal(r.language, 'en');
});

test('インドネシア語を id と判定する', () => {
  const r = detectLanguage(
    'Tempatnya sangat bagus dan pelayanannya ramah sekali. Sarapannya enak, saya pasti akan kembali lagi.',
  );
  assert.equal(r.language, 'id');
});

test('本文なしは other + 要確認', () => {
  const r = detectLanguage(null);
  assert.equal(r.language, 'other');
  assert.equal(r.needsConfirmation, true);
});

test('高信頼のローカル判定は Claude の判定で上書きしない', () => {
  const local = { language: 'ja' as const, confidence: 1, source: 'script' as const, needsConfirmation: false };
  assert.equal(reconcileLanguage(local, 'en').language, 'ja');
});

test('低信頼のローカル判定は Claude の判定で上書きする', () => {
  const local = { language: 'en' as const, confidence: 0.1, source: 'tinyld' as const, needsConfirmation: true };
  const r = reconcileLanguage(local, 'id');
  assert.equal(r.language, 'id');
  assert.equal(r.source, 'claude');
  assert.equal(r.needsConfirmation, false);
});
