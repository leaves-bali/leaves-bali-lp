import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  generatePasscode,
  hashPasscode,
  normalizePasscode,
  verifyPasscode,
} from '../src/lib/passcode';

test('生成されるパスコードは HJ-XXXX-XXXX 形式', () => {
  for (let i = 0; i < 20; i += 1) {
    assert.match(generatePasscode(), /^HJ-[A-HJKMNP-TV-Z2-9]{4}-[A-HJKMNP-TV-Z2-9]{4}$/);
  }
});

test('紛らわしい文字（0 O 1 I L U）を含まない', () => {
  // 現場で紙に書き写して口頭で伝えるため、読み違いが起きる文字を除外している
  for (let i = 0; i < 50; i += 1) {
    const code = generatePasscode().replace(/^HJ-|-/g, '');
    assert.equal(/[0O1ILU]/.test(code), false, `紛らわしい文字を含む: ${code}`);
  }
});

test('生成されるパスコードは毎回異なる', () => {
  const codes = new Set(Array.from({ length: 200 }, () => generatePasscode()));
  assert.equal(codes.size, 200);
});

test('小文字・全角ハイフン・空白を正規化する', () => {
  assert.equal(normalizePasscode(' hj-4k7m-p2qx '), 'HJ-4K7M-P2QX');
  assert.equal(normalizePasscode('HJ−4K7M−P2QX'), 'HJ-4K7M-P2QX'); // 全角マイナス
  assert.equal(normalizePasscode('HJ 4K7M P2QX'), 'HJ4K7MP2QX');
});

test('正しいパスコードを検証できる', async () => {
  const code = generatePasscode();
  const hash = await hashPasscode(code);
  assert.equal(await verifyPasscode(code, hash), true);
});

test('小文字で入力しても検証が通る', async () => {
  const code = generatePasscode();
  const hash = await hashPasscode(code);
  assert.equal(await verifyPasscode(code.toLowerCase(), hash), true);
});

test('違うパスコードは弾かれる', async () => {
  const hash = await hashPasscode(generatePasscode());
  assert.equal(await verifyPasscode('HJ-AAAA-BBBB', hash), false);
});

test('同じパスコードでもハッシュは毎回異なる（ソルトがランダム）', async () => {
  const code = generatePasscode();
  assert.notEqual(await hashPasscode(code), await hashPasscode(code));
});

test('平文パスコードがハッシュ文字列に含まれない', async () => {
  const code = generatePasscode();
  const hash = await hashPasscode(code);
  assert.equal(hash.includes(code), false);
  assert.equal(hash.startsWith('scrypt$'), true);
});

test('壊れたハッシュ文字列で例外を投げずに false を返す', async () => {
  for (const broken of ['', 'garbage', 'scrypt$x$y$z$q$r', 'bcrypt$1$2$3$4$5']) {
    assert.equal(await verifyPasscode('HJ-AAAA-BBBB', broken), false);
  }
});
