import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolveLocationSettings,
  sanitizeAutoPublishLanguages,
  type LocationSettingsDefaults,
  type LocationSettingsRow,
} from '../src/lib/settings/locationSettings';
import { shouldAutoPublish } from '../src/lib/reviews/policy';

/**
 * 店舗ごとの設定の決まり方。
 *
 * ここでいちばん大事なのは「移行しても既存店の動きが変わらない」こと。
 * 列を足しただけの状態（すべて NULL）で、環境変数だけを見ていた頃と
 * 同じ結果になることを固定する。ここが崩れると、マイグレーションを当てた
 * 瞬間に稼働中の店の返信内容や自動公開の挙動が変わってしまう。
 */

/** 環境変数だけを設定していた頃の Hoshi Jungle 相当 */
const HOSHI_JUNGLE_ENV: LocationSettingsDefaults = {
  name: 'Hoshi Jungle',
  areaLabel: 'Ubud, Bali, Indonesia',
  replySignature: 'Hoshi Jungle Team',
  contactEmail: 'stay@hoshijungle.com',
  autoPublishEnabled: true,
  autoPublishMinRating: 4,
  autoPublishLanguages: ['ja', 'en'],
};

/** マイグレーションを当てた直後の行（設定列はすべて NULL） */
function untouchedRow(over: Partial<LocationSettingsRow> = {}): LocationSettingsRow {
  return {
    location_id: '00000000-0000-0000-0000-000000000001',
    name: 'Hoshi Jungle',
    area_label: null,
    reply_signature: null,
    contact_email: null,
    highlights: null,
    auto_publish_enabled: null,
    auto_publish_min_rating: null,
    auto_publish_languages: null,
    ...over,
  };
}

test('未設定の店は、環境変数だけで動いていた頃と同じ設定になる', () => {
  const s = resolveLocationSettings(untouchedRow(), HOSHI_JUNGLE_ENV);

  assert.equal(s.name, 'Hoshi Jungle');
  assert.equal(s.areaLabel, 'Ubud, Bali, Indonesia');
  assert.equal(s.replySignature, 'Hoshi Jungle Team');
  assert.equal(s.contactEmail, 'stay@hoshijungle.com');
  assert.equal(s.autoPublishEnabled, true);
  assert.equal(s.autoPublishMinRating, 4);
  assert.deepEqual(s.autoPublishLanguages, ['ja', 'en']);
});

test('未設定の店の自動公開の判定も、移行前と同じ結果になる', () => {
  // 設定の読み替えだけでなく、判定まで通して同じかを見る。
  const s = resolveLocationSettings(untouchedRow(), HOSHI_JUNGLE_ENV);
  assert.equal(shouldAutoPublish({ rating: 5, language: 'ja', needsAttention: false, settings: s }), true);
  assert.equal(shouldAutoPublish({ rating: 3, language: 'ja', needsAttention: false, settings: s }), false);
  assert.equal(shouldAutoPublish({ rating: 5, language: 'id', needsAttention: false, settings: s }), false);
  assert.equal(shouldAutoPublish({ rating: 5, language: 'ja', needsAttention: true, settings: s }), false);
});

test('自動公開を明示的に切った店は、環境変数が有効でも切れたまま', () => {
  // boolean を not null default false にしなかった理由がこれ。
  // NULL（未設定）と false（明示的に無効）を区別できないと、
  // 店ごとの意思が環境変数に上書きされる。
  const s = resolveLocationSettings(
    untouchedRow({ auto_publish_enabled: false }),
    HOSHI_JUNGLE_ENV,
  );
  assert.equal(s.autoPublishEnabled, false);
  assert.equal(shouldAutoPublish({ rating: 5, language: 'ja', needsAttention: false, settings: s }), false);
});

test('店で設定した値が環境変数より優先される', () => {
  const s = resolveLocationSettings(
    untouchedRow({
      name: '鮨 はやせ',
      area_label: '福岡市東区',
      reply_signature: '鮨 はやせ 店主',
      contact_email: 'info@example.com',
      highlights: ['朝〆の地魚', 'カウンター8席のみ'],
      auto_publish_min_rating: 5,
      auto_publish_languages: ['ja'],
    }),
    HOSHI_JUNGLE_ENV,
  );
  assert.equal(s.name, '鮨 はやせ');
  assert.equal(s.areaLabel, '福岡市東区');
  assert.equal(s.replySignature, '鮨 はやせ 店主');
  assert.equal(s.contactEmail, 'info@example.com');
  assert.deepEqual(s.highlights, ['朝〆の地魚', 'カウンター8席のみ']);
  assert.equal(s.autoPublishMinRating, 5);
  assert.deepEqual(s.autoPublishLanguages, ['ja']);
});

test('空文字は「未設定」として扱う', () => {
  // 設定画面で一度入力して消した場合に空文字が入る。
  // これを値として扱うと、署名が空のまま返信されてしまう。
  const s = resolveLocationSettings(
    untouchedRow({ reply_signature: '   ', contact_email: '' }),
    HOSHI_JUNGLE_ENV,
  );
  assert.equal(s.replySignature, 'Hoshi Jungle Team');
  assert.equal(s.contactEmail, 'stay@hoshijungle.com');
});

test('インドネシア語はどこから来ても自動公開の対象にしない', () => {
  const fromDb = resolveLocationSettings(
    untouchedRow({ auto_publish_languages: ['ja', 'id', 'en'] }),
    HOSHI_JUNGLE_ENV,
  );
  assert.deepEqual(fromDb.autoPublishLanguages, ['ja', 'en']);

  const fromEnv = resolveLocationSettings(untouchedRow(), {
    ...HOSHI_JUNGLE_ENV,
    autoPublishLanguages: ['ja', 'id'],
  });
  assert.deepEqual(fromEnv.autoPublishLanguages, ['ja']);
});

test('未対応の言語コードは落とす', () => {
  // 'other' や 'fr' が残ると、自動公開の判定が静かに外れる。
  assert.deepEqual(sanitizeAutoPublishLanguages(['ja', 'fr', 'other', 'EN', 'ja']), ['ja', 'en']);
  assert.deepEqual(sanitizeAutoPublishLanguages([]), []);
});

test('範囲外の最低評点は、緩い側ではなく厳しい側に倒す', () => {
  // 0 や 9 が入ったとき、1 に倒すと全件自動公開になってしまう。
  for (const bad of [0, 6, -1]) {
    const s = resolveLocationSettings(
      untouchedRow({ auto_publish_min_rating: bad }),
      HOSHI_JUNGLE_ENV,
    );
    assert.equal(s.autoPublishMinRating, 5, `${bad} は 5 に倒すべき`);
  }
});

test('魅力の空要素は取り除く', () => {
  const s = resolveLocationSettings(
    untouchedRow({ highlights: ['朝〆の地魚', '  ', ''] }),
    HOSHI_JUNGLE_ENV,
  );
  assert.deepEqual(s.highlights, ['朝〆の地魚']);
});
