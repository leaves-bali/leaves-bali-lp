import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireOwner } from '@/lib/api';
import { syncLocation } from '@/lib/reviews/sync';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * 初期設定ウィザード ステップ 3。
 * 選択したロケーションを登録し、その場で初回同期を実行して結果を返す。
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireOwner();
    const body = (await request.json()) as {
      googleAccountName?: string;
      googleLocationId?: string;
      name?: string;
      address?: string | null;
    };

    if (!body.googleAccountName || !body.googleLocationId || !body.name) {
      throw new HttpError('googleAccountName / googleLocationId / name は必須です。');
    }

    const db = supabaseAdmin();
    const { data: location, error } = await db
      .from('locations')
      .upsert(
        {
          user_id: session.userId,
          google_account_name: body.googleAccountName,
          google_location_id: body.googleLocationId,
          name: body.name,
          address: body.address ?? null,
          setup_complete: true,
        },
        { onConflict: 'user_id,google_location_id' },
      )
      .select('location_id')
      .single();

    if (error || !location) {
      throw new HttpError(`ロケーションの登録に失敗しました: ${error?.message}`, 500);
    }

    // 初回同期。件数が多いと時間がかかるので maxDuration を伸ばしてある。
    const result = await syncLocation(location.location_id, 'onboarding');

    return NextResponse.json({ locationId: location.location_id, sync: result });
  } catch (err) {
    return errorResponse(err);
  }
}
