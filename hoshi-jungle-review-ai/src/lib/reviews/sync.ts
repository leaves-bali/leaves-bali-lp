import 'server-only';

import { getBudgetState, recordUsage } from '@/lib/ai/budget';
import { estimateCostUsd } from '@/lib/ai/pricing';
import { defaultOption, generateReply, ReplyGenerationError } from '@/lib/ai/generateReply';
import type { ReviewLanguage } from '@/lib/database.types';
import { env } from '@/lib/env';
import { getAccessTokenForUser } from '@/lib/google/accessToken';
import {
  GoogleApiError,
  listReviews,
  reviewParentPath,
  starRatingToNumber,
  updateReviewReply,
  type GoogleReview,
} from '@/lib/google/businessProfile';
import { detectLanguage, reconcileLanguage } from '@/lib/lang/detect';
import { evaluateAttention, shouldAutoPublish } from '@/lib/reviews/policy';
import { loadLocationSettings } from '@/lib/settings/loadLocationSettings';
import type { LocationSettings } from '@/lib/settings/locationSettings';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * レビュー同期パイプライン。
 *
 *   Google からフェッチ → DB に upsert → 未返信のものに AI 返信案を生成 →
 *   ポリシー次第で自動公開 → 実行結果を sync_runs に記録
 *
 * 冪等性: google_review_id を一意キーにしているため、同じ実行を何度繰り返しても
 * レビューが重複せず、返信案も 1 レビュー 1 件しか作られない。
 * Cron が二重起動しても壊れない。
 *
 * ── 時間予算という考え方 ──────────────────────────────────────────
 * 無料ホスティング（Netlify Free）の関数タイムアウトは 10 秒しかない。
 * 一方 AI 生成は 1 件あたり数秒かかるため、全件を 1 回の呼び出しで処理できない。
 *
 * そこで `timeBudgetMs` を受け取り、その時間内で処理できるところまで進めて
 * `hasMore` を返す。呼び出し側（ブラウザ / GitHub Actions）が hasMore が
 * false になるまで繰り返せばよい。途中で中断しても DB は常に整合した状態になる。
 *
 * これにより「長時間実行できるサーバー」が一切不要になり、
 * どのホスティングでも動く。
 */

export type TriggerSource = 'cron' | 'manual' | 'onboarding';

export interface SyncOptions {
  /** この時間を超えたら生成ループを打ち切って hasMore=true を返す */
  timeBudgetMs?: number;
  /** 1 回の呼び出しで生成する最大件数 */
  maxGenerations?: number;
}

export interface SyncResult {
  locationId: string;
  reviewsFetched: number;
  reviewsNew: number;
  repliesGenerated: number;
  repliesPublished: number;
  /** まだ未生成のレビューが残っているか。true なら再度呼ぶ */
  hasMore: boolean;
  /** 月次 AI 予算を使い切って生成を止めたか */
  budgetExhausted: boolean;
  errors: string[];
}

export async function syncLocation(
  locationId: string,
  triggerSource: TriggerSource,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const startedAt = Date.now();
  // 既定は 5 分。Netlify Free から呼ぶ場合は 7 秒など短い値を渡す。
  const timeBudgetMs = options.timeBudgetMs ?? 5 * 60_000;
  const db = supabaseAdmin();
  const result: SyncResult = {
    locationId,
    reviewsFetched: 0,
    reviewsNew: 0,
    repliesGenerated: 0,
    repliesPublished: 0,
    hasMore: false,
    budgetExhausted: false,
    errors: [],
  };

  const { data: run } = await db
    .from('sync_runs')
    .insert({ location_id: locationId, trigger_source: triggerSource })
    .select('sync_run_id')
    .single();

  try {
    const { data: location, error: locationError } = await db
      .from('locations')
      .select('location_id, user_id, google_account_name, google_location_id, name')
      .eq('location_id', locationId)
      .single();

    if (locationError || !location) {
      throw new Error(`ロケーション ${locationId} が見つかりません。`);
    }

    const accessToken = await getAccessTokenForUser(location.user_id);
    const parentPath = reviewParentPath(
      location.google_account_name,
      location.google_location_id,
    );

    // --- 1. フェッチ --------------------------------------------------------
    const { reviews } = await listReviews(accessToken, parentPath);
    result.reviewsFetched = reviews.length;

    // --- 2. DB へ反映 -------------------------------------------------------
    result.reviewsNew = await upsertReviews(locationId, reviews);

    // --- 3. 未返信レビューに AI 返信案を生成 --------------------------------
    // 店舗ごとの設定（店名・署名・魅力・自動公開の条件）は 1 回だけ読み、
    // 生成と自動公開の両方で使い回す。1 件ごとに引くと同じ行を何度も読むことになる。
    const settings = await loadLocationSettings(locationId);

    const generated = await generateMissingReplies(
      locationId,
      {
        deadline: startedAt + timeBudgetMs,
        maxGenerations: options.maxGenerations ?? env.maxGenerationsPerRun,
      },
      settings,
    );
    result.repliesGenerated = generated.generated;
    result.hasMore = generated.hasMore;
    result.budgetExhausted = generated.budgetExhausted;
    result.errors.push(...generated.errors);

    // --- 4. ポリシーが許す返信だけ自動公開 ----------------------------------
    const published = await publishAutoApproved(locationId, accessToken, parentPath, settings);
    result.repliesPublished = published.published;
    result.errors.push(...published.errors);

    await db
      .from('locations')
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        consecutive_failures: 0,
      })
      .eq('location_id', locationId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);

    const { data: current } = await db
      .from('locations')
      .select('consecutive_failures')
      .eq('location_id', locationId)
      .single();

    await db
      .from('locations')
      .update({
        last_sync_error: message,
        consecutive_failures: (current?.consecutive_failures ?? 0) + 1,
      })
      .eq('location_id', locationId);
  } finally {
    if (run?.sync_run_id) {
      await db
        .from('sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          reviews_fetched: result.reviewsFetched,
          reviews_new: result.reviewsNew,
          replies_generated: result.repliesGenerated,
          replies_published: result.repliesPublished,
          error: result.errors.length ? result.errors.join(' | ').slice(0, 2000) : null,
        })
        .eq('sync_run_id', run.sync_run_id);
    }
  }

  return result;
}

// -----------------------------------------------------------------------------

async function upsertReviews(
  locationId: string,
  reviews: GoogleReview[],
): Promise<number> {
  if (reviews.length === 0) return 0;

  const db = supabaseAdmin();
  const googleIds = reviews.map((r) => r.reviewId);

  const { data: existing } = await db
    .from('reviews')
    .select('review_id, google_review_id, text, language_source')
    .in('google_review_id', googleIds);

  const existingByGoogleId = new Map(
    (existing ?? []).map((row) => [row.google_review_id, row]),
  );

  const toInsert = [];
  let newCount = 0;

  for (const review of reviews) {
    const rating = starRatingToNumber(review.starRating);
    // starRating が UNSPECIFIED のものは DB の check 制約に引っかかるので捨てる。
    if (rating < 1) continue;

    const prior = existingByGoogleId.get(review.reviewId);
    const text = review.comment ?? null;

    if (!prior) {
      const detection = detectLanguage(text);
      toInsert.push({
        location_id: locationId,
        google_review_id: review.reviewId,
        reviewer_display_name: review.reviewer?.displayName ?? null,
        reviewer_photo_url: review.reviewer?.profilePhotoUrl ?? null,
        is_anonymous: review.reviewer?.isAnonymous ?? false,
        rating,
        text,
        language: detection.language,
        language_confidence: detection.confidence,
        language_source: detection.source,
        google_create_time: review.createTime,
        google_update_time: review.updateTime,
        has_google_reply: Boolean(review.reviewReply),
        google_reply_comment: review.reviewReply?.comment ?? null,
        google_reply_time: review.reviewReply?.updateTime ?? null,
      });
      newCount += 1;
      continue;
    }

    // 既存レビュー: Google 側で変わりうるフィールドだけ更新する。
    // 人間が言語を手修正している場合（language_source='manual'）は再判定しない。
    const textChanged = prior.text !== text;
    const languageUpdate =
      textChanged && prior.language_source !== 'manual'
        ? (() => {
            const d = detectLanguage(text);
            return {
              language: d.language,
              language_confidence: d.confidence,
              language_source: d.source,
            };
          })()
        : {};

    await db
      .from('reviews')
      .update({
        rating,
        text,
        google_update_time: review.updateTime,
        has_google_reply: Boolean(review.reviewReply),
        google_reply_comment: review.reviewReply?.comment ?? null,
        google_reply_time: review.reviewReply?.updateTime ?? null,
        ...languageUpdate,
      })
      .eq('review_id', prior.review_id);
  }

  if (toInsert.length > 0) {
    const { error } = await db.from('reviews').insert(toInsert);
    if (error) throw new Error(`レビューの保存に失敗しました: ${error.message}`);
  }

  return newCount;
}

// -----------------------------------------------------------------------------

async function generateMissingReplies(
  locationId: string,
  limits: { deadline: number; maxGenerations: number },
  settings: LocationSettings,
): Promise<{
  generated: number;
  hasMore: boolean;
  budgetExhausted: boolean;
  errors: string[];
}> {
  const db = supabaseAdmin();
  const errors: string[] = [];

  // --- 月次 AI 予算のチェック ---------------------------------------------
  // 無料クレジットを超えさせないため、1 件も生成する前に残額を見る。
  let budget = await getBudgetState(locationId);
  if (budget.exhausted) {
    return {
      generated: 0,
      hasMore: false,
      budgetExhausted: true,
      errors: [
        `今月の AI 生成予算 ($${budget.budgetUsd}) に達したため、返信案の生成を停止しました。` +
          'クチコミの取得は継続しています。スタッフは手動で返信できます。',
      ],
    };
  }

  // 返信案がまだ無く、Google 上でも未返信のものだけが対象。
  // 残り件数を知るために、1 回の処理上限より 1 件多く取得する。
  const { data: pending, error } = await db
    .from('review_queue')
    .select(
      'review_id, rating, text, reviewer_display_name, language, language_confidence, google_create_time',
    )
    .eq('location_id', locationId)
    .is('reply_id', null)
    .eq('has_google_reply', false)
    .order('google_create_time', { ascending: false })
    .limit(limits.maxGenerations + 1);

  if (error) {
    return {
      generated: 0,
      hasMore: false,
      budgetExhausted: false,
      errors: [`未返信レビューの取得に失敗: ${error.message}`],
    };
  }

  const queue = pending ?? [];
  // 上限より多く取れた = まだ残りがある
  let hasMore = queue.length > limits.maxGenerations;
  const targets = queue.slice(0, limits.maxGenerations);

  let generated = 0;
  let processed = 0;

  for (const review of targets) {
    // --- 時間予算 ---------------------------------------------------------
    // 次の 1 件を生成する余裕が無ければ打ち切る。中断しても DB は整合している。
    if (Date.now() >= limits.deadline) {
      hasMore = hasMore || processed < targets.length;
      break;
    }

    // --- 予算の再チェック（生成のたびに残額が減るため） -------------------
    if (budget.exhausted) {
      hasMore = false;
      errors.push(
        `今月の AI 生成予算 ($${budget.budgetUsd}) に達したため、残りの生成を停止しました。`,
      );
      break;
    }

    processed += 1;
    const languageIsUncertain = (review.language_confidence ?? 0) < 0.3;

    try {
      const { draft, meta } = await generateReply(
        {
          rating: review.rating,
          text: review.text,
          reviewerName: review.reviewer_display_name,
          detectedLanguage: review.language,
          languageIsUncertain,
        },
        settings,
      );

      // Claude の言語判定で、低信頼だったローカル判定を上書きする。
      const reconciled = reconcileLanguage(
        {
          language: review.language,
          confidence: review.language_confidence ?? 0,
          source: 'tinyld',
          needsConfirmation: languageIsUncertain,
        },
        draft.detected_language as ReviewLanguage,
      );

      const attention = evaluateAttention({
        rating: review.rating,
        language: reconciled.language,
        languageIsUncertain: reconciled.needsConfirmation,
        aiFlagged: draft.needs_human_attention,
      });

      if (reconciled.source === 'claude') {
        await db
          .from('reviews')
          .update({
            language: reconciled.language,
            language_confidence: reconciled.confidence,
            language_source: 'claude',
          })
          .eq('review_id', review.review_id);
      }

      // 実トークン数からコストを算出して記録する。
      // 生成が成功した時点で必ず課金されているので、DB 保存の成否に関わらず記録する。
      const costUsd = estimateCostUsd(meta.model, meta.input_tokens, meta.output_tokens);
      await recordUsage({
        locationId,
        reviewId: review.review_id,
        model: meta.model,
        inputTokens: meta.input_tokens,
        outputTokens: meta.output_tokens,
        estimatedCostUsd: costUsd,
        purpose: 'generate',
      });
      // 次のループで使う残額を更新する
      budget = await getBudgetState(locationId);

      // 3案すべてを保存し、既定は standard を採用する。
      // スタッフは画面でワンクリックで他の案に切り替えられる。
      const chosen = defaultOption(draft.options);

      const { error: insertError } = await db.from('replies').insert({
        review_id: review.review_id,
        ai_generated_text: chosen.text,
        options: draft.options,
        selected_style: chosen.style,
        status: 'draft',
        needs_human_attention: attention.needsAttention,
        attention_codes: attention.codes,
        attention_reason_i18n: draft.needs_human_attention ? draft.attention_reason : {},
        attention_reason: null,
        model: meta.model,
        generation_meta: { ...meta, tone_used: draft.tone_used, cost_usd: costUsd },
      });

      if (insertError) {
        // 一意制約違反 = 並行実行で他プロセスが先に作った。競合として無視してよい。
        if (!insertError.message.includes('duplicate key')) {
          errors.push(`返信案の保存に失敗 (${review.review_id}): ${insertError.message}`);
        }
        continue;
      }

      generated += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`返信生成に失敗 (${review.review_id}): ${message}`);

      // リトライ不能なエラー（Claude の拒否など）は失敗として記録し、
      // 次回以降の実行で無限に再試行しないようにする。
      if (err instanceof ReplyGenerationError && !err.retryable) {
        await db.from('replies').insert({
          review_id: review.review_id,
          status: 'failed',
          needs_human_attention: true,
          attention_reason: `AI 生成に失敗しました。手動で返信してください: ${message}`,
          publish_error: null,
        });
      }
    }
  }

  return {
    generated,
    hasMore,
    budgetExhausted: budget.exhausted,
    errors,
  };
}

// -----------------------------------------------------------------------------

async function publishAutoApproved(
  locationId: string,
  accessToken: string,
  parentPath: string,
  settings: LocationSettings,
): Promise<{ published: number; errors: string[] }> {
  const errors: string[] = [];

  // 自動公開が無効なら Google API を 1 度も叩かない。
  if (!settings.autoPublishEnabled) return { published: 0, errors };

  const db = supabaseAdmin();
  const { data: candidates, error } = await db
    .from('review_queue')
    .select('review_id, reply_id, google_review_id, rating, language, final_text, needs_human_attention')
    .eq('location_id', locationId)
    .eq('status', 'draft')
    .eq('needs_human_attention', false);

  if (error) return { published: 0, errors: [`自動公開候補の取得に失敗: ${error.message}`] };

  let published = 0;

  for (const candidate of candidates ?? []) {
    if (!candidate.reply_id || !candidate.final_text) continue;
    const eligible = shouldAutoPublish({
      rating: candidate.rating,
      language: candidate.language,
      needsAttention: Boolean(candidate.needs_human_attention),
      settings,
    });
    if (!eligible) continue;

    try {
      await updateReviewReply(
        accessToken,
        parentPath,
        candidate.google_review_id,
        candidate.final_text,
      );
      await db
        .from('replies')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          publish_error: null,
        })
        .eq('reply_id', candidate.reply_id);
      await db
        .from('reviews')
        .update({ has_google_reply: true, google_reply_comment: candidate.final_text })
        .eq('review_id', candidate.review_id);
      published += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`自動公開に失敗 (${candidate.review_id}): ${message}`);
      await db
        .from('replies')
        .update({ status: 'failed', publish_error: message, needs_human_attention: true })
        .eq('reply_id', candidate.reply_id);

      // 認証エラーなら以降も全部失敗するので即打ち切る。
      if (err instanceof GoogleApiError && err.requiresReauth) break;
    }
  }

  return { published, errors };
}
