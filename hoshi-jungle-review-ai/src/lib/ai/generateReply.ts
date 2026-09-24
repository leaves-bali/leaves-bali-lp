import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { env } from '@/lib/env';
import { buildSystemPrompt, buildUserPrompt, type ReviewPromptInput } from '@/lib/ai/prompt';
import type { LocationSettings } from '@/lib/settings/locationSettings';
import { REPLY_MAX_LENGTH } from '@/lib/google/businessProfile';
import type { ReviewLanguage } from '@/lib/database.types';

/**
 * Claude による返信案生成。
 *
 * Structured Outputs（output_config.format）を使って JSON スキーマを強制している。
 * 自由文で返させて正規表現で切り出す実装は、言語が 3 つに増えた時点で必ず壊れる。
 */

export const REPLY_STYLES = ['warm', 'standard', 'concise'] as const;
export type ReplyStyle = (typeof REPLY_STYLES)[number];

/** 画面に出す日本語ラベル。順番もこの通りに表示する。 */
export const STYLE_LABELS: Record<ReplyStyle, string> = {
  warm: '丁寧',
  standard: '標準',
  concise: '簡潔',
};

const ReplyDraftSchema = z.object({
  options: z
    .array(
      z.object({
        style: z
          .enum(REPLY_STYLES)
          .describe('warm=丁寧・厚め / standard=標準 / concise=簡潔'),
        text: z
          .string()
          .describe('Google に投稿する返信本文。クチコミと同じ言語。署名を最終行に含める。'),
      }),
    )
    .length(3)
    .describe('温度感と言い回しを変えた3案。warm / standard / concise を各1つずつ。'),
  detected_language: z
    .enum(['ja', 'en', 'id', 'other'])
    .describe('クチコミ本文の実際の言語'),
  tone_used: z
    .enum(['five_star', 'four_star', 'three_star', 'low_rating'])
    .describe('適用した評点別トーン'),
  needs_human_attention: z
    .boolean()
    .describe('公開前に人間の確認が必須かどうか'),
  attention_reason: z
    .object({
      ja: z.string().describe('日本語'),
      en: z.string().describe('English'),
      id: z.string().describe('Bahasa Indonesia'),
    })
    .describe(
      'needs_human_attention が true の理由を、画面を使うスタッフの3言語すべてで。' +
        'false の場合は3つとも空文字。1文で簡潔に。',
    ),
});

export type ReplyDraft = z.infer<typeof ReplyDraftSchema>;
export type ReplyOption = ReplyDraft['options'][number];

export interface GenerateReplyResult {
  draft: ReplyDraft;
  meta: {
    model: string;
    effort: string;
    input_tokens: number;
    output_tokens: number;
    stop_reason: string | null;
    generated_at: string;
  };
}

export class ReplyGenerationError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'ReplyGenerationError';
    this.retryable = retryable;
  }
}

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export async function generateReply(
  input: ReviewPromptInput,
  settings: LocationSettings,
): Promise<GenerateReplyResult> {
  let response;
  try {
    response = await anthropic().messages.parse({
      model: env.anthropicModel,
      // 3案ぶんの本文 + adaptive thinking の思考トークンが max_tokens に含まれる。
      max_tokens: 6000,
      system: buildSystemPrompt(settings),
      // クチコミ返信は難問ではないので effort は low 既定。品質不足なら env で上げられる。
      thinking: { type: 'adaptive' },
      output_config: {
        effort: env.anthropicEffort,
        format: zodOutputFormat(ReplyDraftSchema),
      },
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
    });
  } catch (err) {
    // 429 / 接続断 / 5xx は時間をおけば通る可能性がある。400 系は投げっぱなしにしない。
    const isRateLimit =
      err instanceof Anthropic.RateLimitError || err instanceof Anthropic.APIConnectionError;
    const isServerError =
      err instanceof Anthropic.APIError && typeof err.status === 'number' && err.status >= 500;
    throw new ReplyGenerationError(
      `Claude API の呼び出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      isRateLimit || isServerError,
    );
  }

  // 安全性分類器が応答を拒否した場合。content は空なので読む前に必ず見る。
  if (response.stop_reason === 'refusal') {
    throw new ReplyGenerationError(
      'Claude が応答を拒否しました。このクチコミは人間が手動で返信してください。',
      false,
    );
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ReplyGenerationError('生成が max_tokens で打ち切られました。', true);
  }

  const draft = response.parsed_output;
  if (!draft) {
    throw new ReplyGenerationError('Claude の応答を JSON として解釈できませんでした。', true);
  }

  // 3案すべてを検証する。1案でも壊れていれば再生成させる
  // （壊れた案を画面に出すと、スタッフがそれを選んでしまう）。
  const options = draft.options.map((o) => ({ ...o, text: o.text.trim() }));

  if (options.length !== 3) {
    throw new ReplyGenerationError(
      `返信案が3つ生成されませんでした（${options.length}件）。`,
      true,
    );
  }
  const styles = new Set(options.map((o) => o.style));
  if (styles.size !== 3) {
    throw new ReplyGenerationError('返信案の3つのトーンが重複しています。', true);
  }
  for (const option of options) {
    if (!option.text) {
      throw new ReplyGenerationError(`返信案（${option.style}）が空です。`, true);
    }
    if (option.text.length > REPLY_MAX_LENGTH) {
      throw new ReplyGenerationError(
        `返信案（${option.style}）が Google の上限 ${REPLY_MAX_LENGTH} 文字を超えました。`,
        true,
      );
    }
  }

  return {
    draft: { ...draft, options: sortByStyle(options) },
    meta: {
      model: response.model,
      effort: env.anthropicEffort,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      stop_reason: response.stop_reason,
      generated_at: new Date().toISOString(),
    },
  };
}

/** 画面表示の順（丁寧 → 標準 → 簡潔）に揃える。モデルの出力順に依存させない。 */
function sortByStyle(options: ReplyOption[]): ReplyOption[] {
  return [...options].sort(
    (a, b) => REPLY_STYLES.indexOf(a.style) - REPLY_STYLES.indexOf(b.style),
  );
}

/** 既定で採用する案。多くの場合これが選ばれる想定。 */
export function defaultOption(options: ReplyOption[]): ReplyOption {
  return options.find((o) => o.style === 'standard') ?? options[0];
}

export function claudeLanguageToReviewLanguage(
  language: ReplyDraft['detected_language'],
): ReviewLanguage {
  return language;
}
