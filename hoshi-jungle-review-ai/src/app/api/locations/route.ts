import { NextResponse } from 'next/server';

import { errorResponse, requireSession } from '@/lib/api';
import { getAccessTokenForUser } from '@/lib/google/accessToken';
import { formatAddress, listAccounts, listLocations } from '@/lib/google/businessProfile';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 初期設定ウィザード ステップ 2 用。
 * ログインユーザーが管理している Google ロケーションを一覧で返す。
 */
export async function GET() {
  try {
    const session = await requireSession();
    const accessToken = await getAccessTokenForUser(session.userId);

    const accounts = await listAccounts(accessToken);

    const results = await Promise.all(
      accounts.map(async (account) => {
        const locations = await listLocations(accessToken, account.name);
        return locations.map((location) => ({
          googleAccountName: account.name,
          accountLabel: account.accountName,
          googleLocationId: location.name,
          name: location.title,
          address: formatAddress(location),
          mapsUri: location.metadata?.mapsUri ?? null,
        }));
      }),
    );

    const flattened = results.flat();

    // 既に登録済みのものを示して二重登録を防ぐ
    const db = supabaseAdmin();
    const { data: registered } = await db
      .from('locations')
      .select('google_location_id')
      .eq('user_id', session.userId);
    const registeredIds = new Set((registered ?? []).map((r) => r.google_location_id));

    return NextResponse.json({
      locations: flattened.map((l) => ({ ...l, alreadyRegistered: registeredIds.has(l.googleLocationId) })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
