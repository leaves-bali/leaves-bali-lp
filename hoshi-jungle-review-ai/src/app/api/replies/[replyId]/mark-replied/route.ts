import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireSession } from '@/lib/api';
import { canPublishDirectly } from '@/lib/reviews/sources';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ReviewSource } from '@/lib/database.types';

export const runtime = 'nodejs';

/**
 * 「各サイトの管理画面で返信した」の印を付ける。
 *
 * Google 以外はこのシステムから投稿できない。スタッフがコピーして貼り戻したあと、
 * この印を押して未対応の一覧から外す。
 *
 * これは**押した記録であって、実際に投稿されたことの保証ではない**。
 * 保証するには各サイトを読みに行くしかなく、規約上できない。
 * 画面の文言もそれが伝わる書き方にしてある。
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ replyId: string }> },
) {
  try {
    const session = await requireSession();
    const { replyId } = await params;
    const db = supabaseAdmin();

    const { data: reply, error } = await db
      .from('replies')
      .select(
        `reply_id, status, externally_replied_at,
         reviews!inner ( location_id, source,
           locations!inner ( user_id ) )`,
      )
      .eq('reply_id', replyId)
      .single();

    if (error || !reply) throw new HttpError('返信が見つかりません。', 404, 'not_found');

    const review = Array.isArray(reply.reviews) ? reply.reviews[0] : reply.reviews;
    const location = Array.isArray(review?.locations) ? review.locations[0] : review?.locations;

    // 他人の店舗のデータを触らせない
    if (!review || location?.user_id !== session.userId) {
      throw new HttpError('返信が見つかりません。', 404, 'not_found');
    }
    if (session.role === 'staff' && review.location_id !== session.locationId) {
      throw new HttpError('返信が見つかりません。', 404, 'not_found');
    }

    // Google はこのシステムから公開できるので、この印は使わせない。
    // 押せてしまうと「公開したつもりで公開されていない」が起きる。
    if (canPublishDirectly(review.source as ReviewSource)) {
      throw new HttpError('Googleのクチコミは「Googleに公開」から投稿してください。', 400);
    }

    const { error: updateError } = await db
      .from('replies')
      .update({ externally_replied_at: new Date().toISOString() })
      .eq('reply_id', replyId);

    if (updateError) throw new HttpError(`記録に失敗しました: ${updateError.message}`, 500);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return await errorResponse(err);
  }
}
