import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireSession } from '@/lib/api';
import { syncLocation } from '@/lib/reviews/sync';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** ダッシュボードの「今すぐ同期」ボタン。 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await request.json().catch(() => ({}))) as { locationId?: string };

    const db = supabaseAdmin();
    const query = db
      .from('locations')
      .select('location_id')
      .eq('user_id', session.userId)
      .eq('setup_complete', true);

    if (body.locationId) query.eq('location_id', body.locationId);

    const { data: locations, error } = await query;
    if (error) throw new HttpError(`ロケーションの取得に失敗: ${error.message}`, 500);
    if (!locations || locations.length === 0) {
      throw new HttpError('同期対象のロケーションがありません。', 404);
    }

    const results = [];
    for (const location of locations) {
      results.push(await syncLocation(location.location_id, 'manual'));
    }

    return NextResponse.json({ results });
  } catch (err) {
    return errorResponse(err);
  }
}
