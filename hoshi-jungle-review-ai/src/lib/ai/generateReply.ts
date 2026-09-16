import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { env } from '@/lib/env';
import { buildSystemPrompt, buildUserPrompt, type ReviewPromptInput } from '@/lib/ai/prompt';
import { REPLY_MAX_LENGTH } from '@/lib/google/businessProfile';
import type { ReviewLanguage } from '@/lib/database.types';

/**
 * Claude による返信案生成。
 *
 * Structured Outputs（output_config.format）を使って JSON スキーマを強制している。
 * 自由文で返させて正規表現で切り出す実装は、言語が 3 つに増えた時点で必ず壊れる。
 */

const ReplyDraftSchema = z.object({
  reply_text: z
    .string()
    .describe('Google に投稿する返信本文。クチコミと同じ言語。署名を最終行に含める。'),
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
    .string()
    .describe('needs_human_attention が true の理由（日本語）。false の場合は空文字。'),
});

export type ReplyDraft = z.infer<typeof ReplyDraftSchema>;

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
): Promise<GenerateReplyResult> {
  let response;
  try {
    response = await anthropic().messages.parse({
      model: env.anthropicModel,
      // 返信は短文だが、adaptive thinking の思考トークンも max_tokens に含まれるため余裕を持たせる。
      max_tokens: 4000,
      system: buildSystemPrompt(),
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

  const replyText = draft.reply_text.trim();
  if (!replyText) {
    throw new ReplyGenerationError('生成された返信本文が空です。', true);
  }
  if (replyText.length > REPLY_MAX_LENGTH) {
    throw new ReplyGenerationError(
      `生成された返信が Google の上限 ${REPLY_MAX_LENGTH} 文字を超えました。`,
      true,
    );
  }

  return {
    draft: { ...draft, reply_text: replyText },
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

export function claudeLanguageToReviewLanguage(
  language: ReplyDraft['detected_language'],
): ReviewLanguage {
  return language;
}
