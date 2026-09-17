import 'server-only';

import { getAccessTokenForUser } from '@/lib/google/accessToken';
import {
  REPLY_MAX_LENGTH,
  reviewParentPath,
  updateReviewReply,
} from '@/lib/google/businessProfile';
import type { ErrorCode } from '@/lib/api';
import type { SessionPayload } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * ダッシュボードからのワンクリック公開。
 *
 * 所有権チェックを含む。reply_id だけを受け取り、それが本当に
 * 「そのセッションが触ってよいロケーションのレビュー」に属するかを DB 側で確認する。
 * staff セッションの場合は、さらにセッションに紐づく 1 ロケーションに限定する。
 */

export class PublishError extends Error {
  readonly statusCode: number;
  /** 画面の言語に翻訳できるものはコードを持たせる（api.ts が翻訳する）。 */
  readonly code?: ErrorCode;

  constructor(message: string, statusCode = 400, code?: ErrorCode) {
    super(message);
    this.name = 'PublishError';
    this.statusCode = statusCode;
    this.code = code;
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
  session: SessionPayload,
): Promise<ReplyContext> {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from('replies')
    .select(
      `reply_id, review_id, final_text, status,
       reviews!inner (
         google_review_id,
         location_id,
         locations!inner ( user_id, google_account_name, google_location_id )
       )`,
    )
    .eq('reply_id', replyId)
    .single();

  if (error || !data) {
    throw new PublishError('Not found.', 404, 'not_found');
  }

  // Supabase の埋め込みリレーションは配列にもオブジェクトにもなりうるので正規化する。
  const review = normalizeRelation(data.reviews);
  const location = review ? normalizeRelation(review.locations) : null;

  if (!review || !location) {
    throw new PublishError('返信に紐づくレビュー情報を取得できませんでした。', 500);
  }
  // 存在を漏らさないよう、権限不足はすべて 404 で返す。
  if (location.user_id !== session.userId) {
    throw new PublishError('Not found.', 404, 'not_found');
  }
  if (session.role === 'staff' && review.location_id !== session.locationId) {
    throw new PublishError('Not found.', 404, 'not_found');
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
  session: SessionPayload,
): Promise<{ publishedAt: string; text: string }> {
  const db = supabaseAdmin();
  const context = await loadReplyContext(replyId, session);

  if (context.status === 'published') {
    throw new PublishError('Already published.', 409, 'already_published');
  }
  const text = context.final_text?.trim();
  if (!text) {
    throw new PublishError('Reply is empty.', 400, 'empty_reply');
  }
  if (text.length > REPLY_MAX_LENGTH) {
    throw new PublishError(
      `返信本文が Google の上限 ${REPLY_MAX_LENGTH} 文字を超えています（現在 ${text.length} 文字）。`,
    );
  }

  // staff が公開する場合も、Google への投稿はオーナーのトークンで行う。
  // スタッフは Google の認証情報に一切触れない。
  const accessToken = await getAccessTokenForUser(context.user_id);
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
      // 監査: オーナーなら user_id、スタッフならどのパスコード経由かを残す
      published_by: session.role === 'owner' ? session.userId : null,
      published_by_staff_access_id:
        session.role === 'staff' ? (session.staffAccessId ?? null) : null,
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
