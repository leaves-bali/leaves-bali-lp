import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSystemPrompt, buildUserPrompt } from '../src/lib/ai/prompt';
import type { LocationSettings } from '../src/lib/settings/locationSettings';

/** 店舗設定はプロンプトの引数になった。環境変数はもう読んでいない。 */
function settings(over: Partial<LocationSettings> = {}): LocationSettings {
  return {
    locationId: '00000000-0000-0000-0000-000000000001',
    name: 'Hoshi Jungle',
    areaLabel: 'Ubud, Bali, Indonesia',
    replySignature: 'Hoshi Jungle Team',
    contactEmail: '',
    highlights: [],
    autoPublishEnabled: false,
    autoPublishMinRating: 4,
    autoPublishLanguages: [],
    ...over,
  };
}

test('システムプロンプトにホテル名・署名・4区分のトーンが含まれる', () => {
  const prompt = buildSystemPrompt(settings());
  assert.match(prompt, /Hoshi Jungle/);
  assert.match(prompt, /Hoshi Jungle Team/);
  for (const heading of ['5つ星', '4つ星', '3つ星', '1〜2つ星']) {
    assert.ok(prompt.includes(heading), `トーン区分 ${heading} が欠けている`);
  }
});

test('システムプロンプトが返金約束を明示的に禁止している', () => {
  assert.match(buildSystemPrompt(settings()), /返金・割引・無料宿泊・アップグレードを約束しない/);
});

test('本文なしレビューには専用の指示が入る', () => {
  const prompt = buildUserPrompt({
    rating: 5,
    text: null,
    reviewerName: null,
    detectedLanguage: 'other',
    languageIsUncertain: true,
  });
  assert.match(prompt, /本文なし/);
});

test('言語判定が低信頼のときは Claude に再判定を促す', () => {
  const prompt = buildUserPrompt({
    rating: 4,
    text: 'Bagus',
    reviewerName: 'Andi',
    detectedLanguage: 'id',
    languageIsUncertain: true,
  });
  assert.match(prompt, /確度が低い/);
});

test('店ごとに名前・所在地・署名が差し替わる', () => {
  // 同じシステムで複数店舗を扱えることの核。ここが固定だと店が増やせない。
  const prompt = buildSystemPrompt(
    settings({ name: '鮨 はやせ', areaLabel: '福岡市東区', replySignature: '鮨 はやせ 店主' }),
  );
  assert.match(prompt, /鮨 はやせ/);
  assert.match(prompt, /福岡市東区/);
  assert.match(prompt, /鮨 はやせ 店主/);
  assert.doesNotMatch(prompt, /Hoshi Jungle/);
});

test('登録した魅力だけを触れてよい範囲として示す', () => {
  const prompt = buildSystemPrompt(
    settings({ highlights: ['朝〆の地魚', 'カウンター8席のみ'] }),
  );
  assert.match(prompt, /朝〆の地魚/);
  assert.match(prompt, /カウンター8席のみ/);
  assert.match(prompt, /この範囲に限ります/);
});

test('魅力が未登録なら、本文以外に触れさせない指示になる', () => {
  // 空のときに指示ごと消えると、AI が一般的なホテル像から設備を補ってしまう。
  const prompt = buildSystemPrompt(settings({ highlights: [] }));
  assert.match(prompt, /クチコミ本文に書かれていること以外/);
});

test('連絡先が未設定なら具体的なアドレスを書かせない', () => {
  assert.match(buildSystemPrompt(settings({ contactEmail: '' })), /具体的なアドレスは書かず/);
  assert.match(
    buildSystemPrompt(settings({ contactEmail: 'stay@example.com' })),
    /stay@example\.com/,
  );
});
