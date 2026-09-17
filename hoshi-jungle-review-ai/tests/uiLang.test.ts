import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pickFromAcceptLanguage, resolveUiLang, UI_LANGUAGES } from '../src/lib/i18n';

/**
 * 共有端末（フロントの共用 PC）での表示言語の決まり方。
 *
 * ここで守りたい性質はひとつ。
 *   「その場の切り替えは残らない。既定値は残る。」
 * 前に座っていた人が選んだ言語のまま次の人が座る、という事故を防ぐための優先順位を
 * 固定しておく。順序を変えると共有端末が読めない言語で固まるため、回帰テストで縛る。
 */

test('いま座っている人の選択が最優先', () => {
  assert.equal(
    resolveUiLang({ override: 'id', sessionLang: 'ja', acceptLanguage: 'en-US' }),
    'id',
  );
});

test('選択が失効したらパスコード/ホテルの既定言語に戻る（前の人の言語では終わらない）', () => {
  // override が undefined = Cookie が失効して届かなくなった状態
  assert.equal(
    resolveUiLang({ override: undefined, sessionLang: 'ja', acceptLanguage: 'en-US' }),
    'ja',
  );
});

test('既定言語が無ければブラウザの言語を使う（未ログインの初回アクセス）', () => {
  assert.equal(resolveUiLang({ acceptLanguage: 'id-ID,id;q=0.9,en;q=0.8' }), 'id');
  assert.equal(resolveUiLang({ acceptLanguage: 'en-US,en;q=0.9' }), 'en');
});

test('手がかりが何も無ければ日本語', () => {
  assert.equal(resolveUiLang({}), 'ja');
  assert.equal(resolveUiLang({ acceptLanguage: null }), 'ja');
  assert.equal(resolveUiLang({ acceptLanguage: 'fr-FR,fr;q=0.9' }), 'ja');
});

test('壊れた値は無視して次の候補へ落ちる', () => {
  // Cookie は利用者が自由に書き換えられる。未対応の値で画面が壊れてはいけない。
  assert.equal(resolveUiLang({ override: 'xx', sessionLang: 'en' }), 'en');
  assert.equal(resolveUiLang({ override: '', sessionLang: 'en' }), 'en');
  assert.equal(resolveUiLang({ override: 42, sessionLang: 'en' }), 'en');
  assert.equal(resolveUiLang({ override: 'ja; drop table', sessionLang: 'en' }), 'en');
  assert.equal(resolveUiLang({ sessionLang: 'xx', acceptLanguage: 'id' }), 'id');
});

test('Accept-Language の地域付きタグを拾える', () => {
  assert.equal(pickFromAcceptLanguage('ja-JP'), 'ja');
  assert.equal(pickFromAcceptLanguage('en-GB,en;q=0.9'), 'en');
  // 対応外が先頭でも、後ろに対応言語があれば拾う
  assert.equal(pickFromAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'en');
  assert.equal(pickFromAcceptLanguage('zh-CN'), null);
  assert.equal(pickFromAcceptLanguage(''), null);
  assert.equal(pickFromAcceptLanguage(null), null);
});

test('対応言語はすべて解決できる（言語を足したら必ずここを通る）', () => {
  for (const lang of UI_LANGUAGES) {
    assert.equal(resolveUiLang({ override: lang }), lang);
    assert.equal(resolveUiLang({ sessionLang: lang }), lang);
  }
});
