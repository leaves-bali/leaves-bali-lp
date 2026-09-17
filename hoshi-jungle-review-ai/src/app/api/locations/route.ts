import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireOwner } from '@/lib/api';
import { isUiLang } from '@/lib/i18n';
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
    const session = await requireOwner();
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
    return await errorResponse(err);
  }
}


/**
 * ロケーションの設定変更。いまのところ共有端末の既定言語のみ。
 *
 * 既定言語は「誰も言語を選んでいない共用端末が戻る先」。
 * 反映はスタッフの次回ログイン時（セッションに焼き込んでいるため、最長 12 時間）。
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireOwner();
    const body = (await request.json().catch(() => ({}))) as {
      locationId?: string;
      defaultUiLang?: string;
    };

    if (!isUiLang(body.defaultUiLang)) {
      throw new HttpError('unsupported language', 400, 'not_found');
    }

    const db = supabaseAdmin();

    // 他人のロケーションを書き換えられないよう、必ず user_id で絞る
    const query = db
      .from('locations')
      .update({ default_ui_lang: body.defaultUiLang })
      .eq('user_id', session.userId);

    if (body.locationId) query.eq('location_id', body.locationId);

    const { data, error } = await query.select('location_id, default_ui_lang');

    if (error) throw new HttpError(error.message, 500);
    if (!data || data.length === 0) throw new HttpError('location not found', 404, 'not_found');

    return NextResponse.json({ ok: true, defaultUiLang: body.defaultUiLang });
  } catch (err) {
    return await errorResponse(err);
  }
}
