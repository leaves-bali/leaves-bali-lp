import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireOwner } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** パスコードの有効化 / 無効化（＝スタッフの締め出し）。 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ staffAccessId: string }> },
) {
  try {
    const session = await requireOwner();
    const { staffAccessId } = await params;
    const body = (await request.json()) as { isActive?: boolean; label?: string };

    const db = supabaseAdmin();

    // 所有権チェック: このパスコードがログイン中オーナーのロケーションのものか
    const { data: existing, error: loadError } = await db
      .from('staff_access')
      .select('staff_access_id, locations!inner ( user_id )')
      .eq('staff_access_id', staffAccessId)
      .single();

    if (loadError || !existing) throw new HttpError('パスコードが見つかりません。', 404);
    const location = Array.isArray(existing.locations)
      ? existing.locations[0]
      : existing.locations;
    if (location?.user_id !== session.userId) {
      throw new HttpError('パスコードが見つかりません。', 404);
    }

    const update: { is_active?: boolean; label?: string } = {};
    if (typeof body.isActive === 'boolean') update.is_active = body.isActive;
    if (body.label?.trim()) update.label = body.label.trim();
    if (Object.keys(update).length === 0) throw new HttpError('更新内容がありません。');

    const { data, error } = await db
      .from('staff_access')
      .update(update)
      .eq('staff_access_id', staffAccessId)
      .select('staff_access_id, label, is_active, last_used_at, created_at, rotated_at')
      .single();

    if (error) throw new HttpError(`更新に失敗しました: ${error.message}`, 500);
    return NextResponse.json({ item: data });
  } catch (err) {
    return await errorResponse(err);
  }
}
