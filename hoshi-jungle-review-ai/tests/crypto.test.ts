import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

// env.* は遅延評価（呼び出し時に process.env を読む）なので、import より後の設定でも効く。
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

import { decryptToken, encryptToken } from '../src/lib/crypto';

test('暗号化して復号すると元に戻る', () => {
  const token = '1//0abcdefgHIJKLMNOP-refresh-token';
  assert.equal(decryptToken(encryptToken(token)), token);
});

test('同じ平文でも毎回異なる暗号文になる（IV がランダム）', () => {
  assert.notEqual(encryptToken('same'), encryptToken('same'));
});

test('改ざんされた暗号文は復号に失敗する', () => {
  // 暗号文の部分だけを差し替える。IV と認証タグはそのまま使う。
  const [iv, , tag] = encryptToken('secret').split(':');
  const tampered = [iv, Buffer.from('tampered').toString('base64'), tag].join(':');
  assert.throws(() => decryptToken(tampered));
});

test('形式が不正な入力は明示的にエラーになる', () => {
  assert.throws(() => decryptToken('not-a-valid-payload'), /形式が不正/);
});
