import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { env } from '@/lib/env';
import { normalizeActions, normalizeThemes, type ReportTheme } from '@/lib/reports/themes';
import type { ReviewLanguage } from '@/lib/database.types';

/**
 * 月次レポートの「文章にする部分」。
 *
 * 数字は aggregate.ts が数える。ここが作るのは
 *  - 褒められた話題 / 指摘された話題（それぞれ件数つき）
 *  - 来月やること（最大3つ）
 * の3つだけ。
 *
 * 【この機能で最も危ないこと】
 * もっともらしい一般論（「接客の質を高めましょう」）で埋まったレポートは、
 * 読んだ店長の時間を奪うだけで、次の月も同じ文章が出る。
 * そうなると「AIは当たり障りのないことしか言わない」という評価が定着し、
 * このオプション自体が解約される。
 * だから根拠の無いことは書かせず、書くことが無ければ空で返させる。
 */

const ReportSummarySchema = z.object({
  praised_themes: z
    .array(
      z.object({
        topic: z.string().describe('褒められた点。日本語の短い名詞句（例: 朝食、部屋の清潔さ）'),
        count: z.number().int().describe('その話題に触れていたクチコミの実数'),
      }),
    )
    .describe('褒められた話題。該当が無ければ空の配列。'),
  complained_themes: z
    .array(
      z.object({
        topic: z.string().describe('指摘された点。日本語の短い名詞句'),
        count: z.number().int().describe('その話題に触れていたクチコミの実数'),
      }),
    )
    .describe('指摘・不満の話題。該当が無ければ空の配列。'),
  next_actions: z
    .array(z.string().describe('来月やること。1文。具体的な対象を含める。'))
    .max(3)
    .describe('クチコミから根拠が示せるものだけ。無理に3つ出さない。'),
});

export type ReportSummary = {
  praisedThemes: ReportTheme[];
  complainedThemes: ReportTheme[];
  nextActions: string[];
  meta: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    reviews_used: number;
    generated_at: string;
  };
};

export interface SummarizeInput {
  storeName: string;
  reviews: ReadonlyArray<{
    rating: number;
    language: ReviewLanguage;
    text: string | null;
  }>;
}

/**
 * AI に渡すクチコミの上限。
 * 月200件を超える店でも入力トークンを一定に保ち、月次予算を守る。
 * 超えた場合は低評価を優先して残す（改善点の方が読む価値が高いため）。
 */
const MAX_REVIEWS_IN_PROMPT = 120;
/** 1件あたりの本文の長さ。長文クチコミ1件で予算を食わないようにする。 */
const MAX_TEXT_LENGTH = 400;

const SYSTEM_PROMPT = `あなたは飲食店・宿泊施設の運営を助ける分析担当です。
先月その店に届いたクチコミの一覧を読み、店長が次の月に何をすべきかをまとめます。

## 絶対に守ること

1. **クチコミに書かれていないことは書かない。**
   一般的な接客論・業界の常識・よくある改善策を、補って書いてはいけません。
   材料が無ければ空で返してください。空で返すことは失敗ではありません。

2. **件数を正確に数える。**
   topic の count は「その話題に触れていたクチコミの実数」です。
   推定や概算ではなく、実際に数えた数を入れてください。

3. **少ない話題を大きく見せない。**
   1件しか出ていない話題を「傾向」として書かないでください。

4. **日本語でまとめる。**
   英語・中国語・韓国語・インドネシア語のクチコミも、要点は日本語で書きます。
   店長は日本語で読みます。

5. **話題は短い名詞句で。**
   ○「朝食の品数」「駐車場の分かりにくさ」
   ✕「朝食についてお客様から高い評価をいただいております」

6. **next_actions は、そのクチコミを読んだから言えることだけ。**
   誰に何をするかが分かる書き方にしてください。
   ○「駐車場の入口が分かりにくいという指摘が3件。入口の看板を大きくする」
   ✕「顧客満足度の向上に努める」
   根拠のあるものが1つしか無ければ1つだけ返してください。`;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export async function summarizeReviews(input: SummarizeInput): Promise<ReportSummary> {
  const selected = selectReviews(input.reviews);

  const lines = selected.map((review, index) => {
    const body = (review.text ?? '').trim().slice(0, MAX_TEXT_LENGTH) || '(本文なし)';
    return `${index + 1}. [★${review.rating} / ${review.language}] ${body}`;
  });

  const userPrompt = `お店: ${input.storeName}
先月届いたクチコミ ${input.reviews.length} 件${
    selected.length < input.reviews.length
      ? `（うち ${selected.length} 件を抜粋。低い評価を優先して残しています）`
      : ''
  }

<reviews>
${lines.join('\n')}
</reviews>

この内容だけを根拠に、褒められた話題・指摘された話題・来月やることをまとめてください。`;

  const response = await anthropic().messages.parse({
    model: env.anthropicModel,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    thinking: { type: 'adaptive' },
    output_config: {
      // 「数えて、材料が無ければ空で返す」は返信の文章生成より判断が要る。
      // 返信案（low）より一段上げているが、月1回なので費用への影響は小さい。
      effort: 'medium',
      format: zodOutputFormat(ReportSummarySchema),
    },
    messages: [{ role: 'user', content: userPrompt }],
  });

  const parsed = response.parsed_output;

  return {
    // 件数の上限・重複・少数話題の扱いはコード側で最終的に落とす
    praisedThemes: normalizeThemes(parsed?.praised_themes, input.reviews.length),
    complainedThemes: normalizeThemes(parsed?.complained_themes, input.reviews.length),
    nextActions: normalizeActions(parsed?.next_actions),
    meta: {
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      reviews_used: selected.length,
      generated_at: new Date().toISOString(),
    },
  };
}

/**
 * 入力が多すぎる月の間引き。
 * 評価の低い順に残す。高評価が 100 件あっても打ち手は増えないが、
 * 低評価は 1 件でも打ち手になるため。
 */
function selectReviews<T extends { rating: number }>(reviews: readonly T[]): T[] {
  if (reviews.length <= MAX_REVIEWS_IN_PROMPT) return [...reviews];
  return [...reviews].sort((a, b) => a.rating - b.rating).slice(0, MAX_REVIEWS_IN_PROMPT);
}
