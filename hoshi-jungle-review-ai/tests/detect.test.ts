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

test('かなを含む短い日本語は tinyld が判定不能でも ja と確定する', () => {
  // この長さは tinyld 単体では候補ゼロを返す。文字種チェックの存在意義そのもの。
  const r = detectLanguage('さいこう！');
  assert.equal(r.language, 'ja');
  assert.equal(r.source, 'script');
  assert.equal(r.needsConfirmation, false);
});

test('漢字のみの入力は日中の区別がつかないため、必ず要確認にする', () => {
  // 「最高」は日本語にも中国語にも存在する。どちらに倒しても誤りうるので、
  // ここで確定させず Claude の判断に委ねる契約になっている。
  for (const text of ['最高', '很好', '服務不錯']) {
    const r = detectLanguage(text);
    assert.ok(['ja', 'zh'].includes(r.language), `想定外の判定: ${r.language}`);
    assert.equal(r.source, 'script');
    assert.equal(r.needsConfirmation, true, '要確認フラグが立っていない');
  }
});

test('ハングルは ko と確定する', () => {
  const r = detectLanguage('직원분들이 정말 친절했어요. 다시 오고 싶습니다.');
  assert.equal(r.language, 'ko');
  assert.equal(r.source, 'script');
  assert.equal(r.needsConfirmation, false);
});

test('短いハングルでも ko と確定する', () => {
  assert.equal(detectLanguage('최고!').language, 'ko');
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

test('中国語の長文を zh と判定する', () => {
  const r = detectLanguage('酒店位置很好，服务人员非常热情，早餐也很丰富。下次还会再来。');
  assert.ok(['zh', 'ja'].includes(r.language));
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
