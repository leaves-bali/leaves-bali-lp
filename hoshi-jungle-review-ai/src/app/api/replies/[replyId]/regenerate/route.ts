import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireSession } from '@/lib/api';
import { defaultOption, generateReply } from '@/lib/ai/generateReply';
import { evaluateAttention } from '@/lib/reviews/policy';
import { loadLocationSettings } from '@/lib/settings/loadLocationSettings';
import { loadReplyContext } from '@/lib/reviews/publish';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * 返信案の再生成。
 * スタッフが「この案は違う」と思ったときに、人手で書き直す前の選択肢を提供する。
 * 人間の編集内容（edited_text）は上書きしない。
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ replyId: string }> },
) {
  try {
    const session = await requireSession();
    const { replyId } = await params;
    await loadReplyContext(replyId, session); // 所有権チェック

    const db = supabaseAdmin();
    const { data: reply, error } = await db
      .from('replies')
      .select(
        `reply_id, status, regenerated_count, review_id,
         reviews!inner ( location_id, rating, text, reviewer_display_name, language, language_confidence )`,
      )
      .eq('reply_id', replyId)
      .single();

    if (error || !reply) throw new HttpError('返信が見つかりません。', 404);
    if (reply.status === 'published') {
      throw new HttpError('公開済みの返信は再生成できません。', 409);
    }

    const review = Array.isArray(reply.reviews) ? reply.reviews[0] : reply.reviews;
    if (!review) throw new HttpError('レビュー情報を取得できませんでした。', 500);

    const languageIsUncertain = (review.language_confidence ?? 0) < 0.3;

    // 作り直しでも、毎時バッチと同じ店舗設定（店名・署名・魅力）で書かせる。
    // ここだけ環境変数を見ていると、店ごとの設定が反映されない返信が混ざる。
    const settings = await loadLocationSettings(review.location_id);

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

    const attention = evaluateAttention({
      rating: review.rating,
      language: review.language,
      languageIsUncertain,
      aiFlagged: draft.needs_human_attention,
    });

    const chosen = defaultOption(draft.options);

    const { data: updated, error: updateError } = await db
      .from('replies')
      .update({
        ai_generated_text: chosen.text,
        options: draft.options,
        selected_style: chosen.style,
        status: 'draft',
        needs_human_attention: attention.needsAttention,
        attention_codes: attention.codes,
        attention_reason_i18n: draft.needs_human_attention ? draft.attention_reason : {},
        attention_reason: null,
        model: meta.model,
        generation_meta: { ...meta, tone_used: draft.tone_used },
        regenerated_count: (reply.regenerated_count ?? 0) + 1,
        publish_error: null,
      })
      .eq('reply_id', replyId)
      .select('reply_id, ai_generated_text, edited_text, final_text, status, regenerated_count, options, selected_style')
      .single();

    if (updateError) throw new HttpError(`再生成結果の保存に失敗: ${updateError.message}`, 500);

    return NextResponse.json({ reply: updated });
  } catch (err) {
    return await errorResponse(err);
  }
}
