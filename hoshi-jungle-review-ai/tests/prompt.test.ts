import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.HOTEL_NAME = 'Hoshi Jungle';
process.env.HOTEL_LOCATION = 'Ubud, Bali, Indonesia';
process.env.HOTEL_SIGNATURE = 'Hoshi Jungle Team';

import { buildSystemPrompt, buildUserPrompt } from '../src/lib/ai/prompt';

test('システムプロンプトにホテル名・署名・4区分のトーンが含まれる', () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /Hoshi Jungle/);
  assert.match(prompt, /Hoshi Jungle Team/);
  for (const heading of ['5つ星', '4つ星', '3つ星', '1〜2つ星']) {
    assert.ok(prompt.includes(heading), `トーン区分 ${heading} が欠けている`);
  }
});

test('システムプロンプトが返金約束を明示的に禁止している', () => {
  assert.match(buildSystemPrompt(), /返金・割引・無料宿泊・アップグレードを約束しない/);
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
