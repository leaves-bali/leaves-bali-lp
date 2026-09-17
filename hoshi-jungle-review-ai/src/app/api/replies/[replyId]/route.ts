import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireSession } from '@/lib/api';
import { REPLY_MAX_LENGTH } from '@/lib/google/businessProfile';
import { loadReplyContext } from '@/lib/reviews/publish';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ReplyRow, ReplyStatus } from '@/lib/database.types';

export const runtime = 'nodejs';

/** 返信案の編集 / ステータス変更（スキップ・ドラフトに戻す）。 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ replyId: string }> },
) {
  try {
    const session = await requireSession();
    const { replyId } = await params;
    const context = await loadReplyContext(replyId, session);

    const body = (await request.json()) as {
      editedText?: string;
      status?: ReplyStatus;
      /** 3案のどれを採用したか。手で書き換えた場合は null を送る。 */
      selectedStyle?: string | null;
    };

    const update: Partial<ReplyRow> = {};

    if (body.editedText !== undefined) {
      const text = body.editedText.trim();
      if (!text) throw new HttpError('Reply is empty.', 400, 'empty_reply');
      if (text.length > REPLY_MAX_LENGTH) {
        throw new HttpError(
          `返信本文が Google の上限 ${REPLY_MAX_LENGTH} 文字を超えています（現在 ${text.length} 文字）。`,
        );
      }
      if (context.status === 'published') {
        // 公開済みの上書きは意図せぬ事故になりやすいので、明示的な再公開操作に限定する。
        throw new HttpError('Published replies cannot be edited.', 409, 'published_no_edit');
      }
      update.edited_text = text;
      update.status = 'edited';
    }

    if (body.selectedStyle !== undefined) {
      update.selected_style = body.selectedStyle;
    }

    if (body.status !== undefined) {
      const allowed: ReplyStatus[] = ['draft', 'edited', 'skipped'];
      if (!allowed.includes(body.status)) {
        throw new HttpError('この API で設定できるステータスは draft / edited / skipped のみです。');
      }
      update.status = body.status;
      if (body.status === 'skipped') update.needs_human_attention = false;
    }

    if (Object.keys(update).length === 0) {
      throw new HttpError('更新内容がありません。');
    }

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('replies')
      .update(update)
      .eq('reply_id', replyId)
      .select('reply_id, edited_text, final_text, status, selected_style, updated_at')
      .single();

    if (error) throw new HttpError(`更新に失敗しました: ${error.message}`, 500);

    return NextResponse.json({ reply: data });
  } catch (err) {
    return await errorResponse(err);
  }
}
