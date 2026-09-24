import { randomUUID } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireSession } from '@/lib/api';
import { getBudgetState, recordUsage } from '@/lib/ai/budget';
import { defaultOption, generateReply } from '@/lib/ai/generateReply';
import { estimateCostUsd } from '@/lib/ai/pricing';
import { detectLanguage } from '@/lib/lang/detect';
import { evaluateAttention } from '@/lib/reviews/policy';
import { isReviewSource } from '@/lib/reviews/sources';
import { requireLocationPlan } from '@/lib/settings/loadLocationPlan';
import { loadLocationSettings } from '@/lib/settings/loadLocationSettings';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ReviewLanguage } from '@/lib/database.types';

export const runtime = 'nodejs';

/**
 * Google 以外のサイトのクチコミを貼り付けて、返信案を作る。
 *
 * Agoda・トリップアドバイザー・Trip.com・食べログには返信を投稿する API が無く、
 * 食べログは規約で自動収集も禁じている。取り込みは人が貼る形しかない。
 * 作られた返信案もこのシステムからは投稿できないので、スタッフがコピーして
 * 各サイトの管理画面に貼り戻す。
 *
 * 返信案の生成は Google と同じ仕組み（同じプロンプト・同じ3案・同じ予算管理）を通す。
 * ここだけ別系統にすると、店ごとの設定や月次予算がすり抜ける。
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = (await request.json().catch(() => ({}))) as {
      locationId?: string;
      source?: string;
      rating?: number;
      text?: string;
      reviewerName?: string | null;
      postedAt?: string | null;
    };

    // --- 入力の検証 ---------------------------------------------------------
    if (!isReviewSource(body.source) || body.source === 'google') {
      throw new HttpError('サイトを選んでください。', 400);
    }

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpError('評価は1〜5で選んでください。', 400);
    }

    const text = String(body.text ?? '').trim();
    if (!text) throw new HttpError('クチコミの本文を入力してください。', 400);
    if (text.length > 5000) throw new HttpError('クチコミの本文が長すぎます。', 400);

    const reviewerName = String(body.reviewerName ?? '').trim() || null;

    // 日付は任意。不正な文字列は黙って捨て、投稿日なしとして扱う。
    let postedAt: string | null = null;
    if (body.postedAt) {
      const parsed = new Date(String(body.postedAt));
      if (!Number.isNaN(parsed.getTime())) postedAt = parsed.toISOString();
    }

    // --- 対象店舗の決定 -----------------------------------------------------
    // スタッフはセッションに紐づく店舗しか触れない。オーナーは自分の店舗のみ。
    const db = supabaseAdmin();
    const locationId =
      session.role === 'staff' ? session.locationId : (body.locationId ?? undefined);
    if (!locationId) throw new HttpError('対象の店舗が指定されていません。', 400);

    const { data: owned } = await db
      .from('locations')
      .select('location_id')
      .eq('location_id', locationId)
      .eq('user_id', session.userId)
      .maybeSingle();
    if (!owned) throw new HttpError('店舗が見つかりません。', 404, 'not_found');

    // 契約していない店には機能自体を出していないが、URL を直接叩かれても通さない。
    await requireLocationPlan(locationId, 'otherSitesEnabled');

    // --- 月次 AI 予算 -------------------------------------------------------
    // 貼り付けからの生成も同じ財布から出る。ここを通さないと予算が意味を失う。
    const budget = await getBudgetState(locationId);
    if (budget.exhausted) {
      throw new HttpError(
        `今月のAI生成の予算（$${budget.budgetUsd}）に達しました。来月まで返信案は作れません。`,
        429,
      );
    }

    // --- クチコミを保存 -----------------------------------------------------
    const detected = detectLanguage(text);

    // google_review_id は not null かつ unique で、再同期の冪等キーとして効いている。
    // 制約を緩めると Google 側の取り込みが壊れかねないので、貼り付け分は内部で採番する。
    const externalId = `manual:${randomUUID()}`;

    const { data: review, error: reviewError } = await db
      .from('reviews')
      .insert({
        location_id: locationId,
        google_review_id: externalId,
        source: body.source,
        reviewer_display_name: reviewerName,
        rating,
        text,
        language: detected.language,
        language_confidence: detected.confidence,
        language_source: detected.source,
        google_create_time: postedAt,
      })
      .select('review_id')
      .single();

    if (reviewError || !review) {
      throw new HttpError(`クチコミを保存できませんでした: ${reviewError?.message}`, 500);
    }

    // --- 返信案の生成（Google と同じ仕組み） --------------------------------
    const settings = await loadLocationSettings(locationId);
    const languageIsUncertain = detected.needsConfirmation;

    const { draft, meta } = await generateReply(
      {
        rating,
        text,
        reviewerName,
        detectedLanguage: detected.language,
        languageIsUncertain,
      },
      settings,
    );

    // 生成が成功した時点で課金は発生している。保存の成否に関わらず記録する。
    await recordUsage({
      locationId,
      reviewId: review.review_id,
      model: meta.model,
      inputTokens: meta.input_tokens,
      outputTokens: meta.output_tokens,
      estimatedCostUsd: estimateCostUsd(meta.model, meta.input_tokens, meta.output_tokens),
      purpose: 'generate',
    });

    const attention = evaluateAttention({
      rating,
      language: draft.detected_language as ReviewLanguage,
      languageIsUncertain,
      aiFlagged: draft.needs_human_attention,
    });

    const chosen = defaultOption(draft.options);

    const { error: replyError } = await db.from('replies').insert({
      review_id: review.review_id,
      ai_generated_text: chosen.text,
      options: draft.options,
      selected_style: chosen.style,
      status: 'draft',
      needs_human_attention: attention.needsAttention,
      attention_codes: attention.codes,
      attention_reason_i18n: draft.attention_reason ?? {},
      model: meta.model,
      generation_meta: meta,
    });

    if (replyError) {
      throw new HttpError(`返信案を保存できませんでした: ${replyError.message}`, 500);
    }

    return NextResponse.json({ ok: true, reviewId: review.review_id });
  } catch (err) {
    return await errorResponse(err);
  }
}
