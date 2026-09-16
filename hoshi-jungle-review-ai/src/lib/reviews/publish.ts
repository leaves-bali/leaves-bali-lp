import 'server-only';

import { getAccessTokenForUser } from '@/lib/google/accessToken';
import {
  REPLY_MAX_LENGTH,
  reviewParentPath,
  updateReviewReply,
} from '@/lib/google/businessProfile';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * ダッシュボードからのワンクリック公開。
 *
 * 所有権チェックを含む。reply_id だけを受け取り、それが本当に
 * 「そのログインユーザーのロケーションのレビュー」に属するかを DB 側で確認する。
 */

export class PublishError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PublishError';
    this.statusCode = statusCode;
  }
}

interface ReplyContext {
  reply_id: string;
  review_id: string;
  final_text: string | null;
  status: string;
  google_review_id: string;
  google_account_name: string;
  google_location_id: string;
  user_id: string;
}

export async function loadReplyContext(
  replyId: string,
  userId: string,
): Promise<ReplyContext> {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from('replies')
    .select(
      `reply_id, review_id, final_text, status,
       reviews!inner (
         google_review_id,
         locations!inner ( user_id, google_account_name, google_location_id )
       )`,
    )
    .eq('reply_id', replyId)
    .single();

  if (error || !data) {
    throw new PublishError('返信が見つかりません。', 404);
  }

  // Supabase の埋め込みリレーションは配列にもオブジェクトにもなりうるので正規化する。
  const review = normalizeRelation(data.reviews);
  const location = review ? normalizeRelation(review.locations) : null;

  if (!review || !location) {
    throw new PublishError('返信に紐づくレビュー情報を取得できませんでした。', 500);
  }
  if (location.user_id !== userId) {
    // 存在を漏らさないよう 404 を返す。
    throw new PublishError('返信が見つかりません。', 404);
  }

  return {
    reply_id: data.reply_id,
    review_id: data.review_id,
    final_text: data.final_text,
    status: data.status,
    google_review_id: review.google_review_id,
    google_account_name: location.google_account_name,
    google_location_id: location.google_location_id,
    user_id: location.user_id,
  };
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function publishReply(
  replyId: string,
  userId: string,
): Promise<{ publishedAt: string; text: string }> {
  const db = supabaseAdmin();
  const context = await loadReplyContext(replyId, userId);

  if (context.status === 'published') {
    throw new PublishError('この返信は既に公開されています。', 409);
  }
  const text = context.final_text?.trim();
  if (!text) {
    throw new PublishError('返信本文が空です。編集してから公開してください。');
  }
  if (text.length > REPLY_MAX_LENGTH) {
    throw new PublishError(
      `返信本文が Google の上限 ${REPLY_MAX_LENGTH} 文字を超えています（現在 ${text.length} 文字）。`,
    );
  }

  const accessToken = await getAccessTokenForUser(userId);
  const parentPath = reviewParentPath(
    context.google_account_name,
    context.google_location_id,
  );

  try {
    await updateReviewReply(accessToken, parentPath, context.google_review_id, text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from('replies')
      .update({ status: 'failed', publish_error: message, needs_human_attention: true })
      .eq('reply_id', replyId);
    throw new PublishError(`Google への公開に失敗しました: ${message}`, 502);
  }

  const publishedAt = new Date().toISOString();

  await db
    .from('replies')
    .update({
      status: 'published',
      published_at: publishedAt,
      published_by: userId,
      publish_error: null,
      needs_human_attention: false,
    })
    .eq('reply_id', replyId);

  await db
    .from('reviews')
    .update({
      has_google_reply: true,
      google_reply_comment: text,
      google_reply_time: publishedAt,
    })
    .eq('review_id', context.review_id);

  return { publishedAt, text };
}
