import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireOwner } from '@/lib/api';
import { isUiLang } from '@/lib/i18n';
import { generatePasscode, hashPasscode } from '@/lib/passcode';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 発行済みパスコードの一覧（平文は返さない）。 */
export async function GET() {
  try {
    const session = await requireOwner();
    const db = supabaseAdmin();

    const { data: locations } = await db
      .from('locations')
      .select('location_id')
      .eq('user_id', session.userId);

    const locationIds = (locations ?? []).map((l) => l.location_id);
    if (locationIds.length === 0) return NextResponse.json({ items: [] });

    const { data } = await db
      .from('staff_access')
      .select(
        'staff_access_id, location_id, label, ui_lang, is_active, last_used_at, created_at, rotated_at',
      )
      .in('location_id', locationIds)
      .order('created_at', { ascending: true });

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return await errorResponse(err);
  }
}

/**
 * パスコードの新規発行 / 再発行。
 *
 * 平文は **このレスポンスでしか返さない**（DB にはハッシュのみ保存）。
 * 画面側で「一度だけ表示」する前提。紛失したら再発行してもらう。
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireOwner();
    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      locationId?: string;
      staffAccessId?: string; // 指定があれば再発行
      uiLang?: string | null;  // このパスコードで入室したときの画面の言語
    };

    // null / 未指定 = 「ホテルの既定言語に従う」。空文字も同じ扱いにする。
    const uiLang = isUiLang(body.uiLang) ? body.uiLang : null;

    const db = supabaseAdmin();
    const passcode = generatePasscode();
    const passcodeHash = await hashPasscode(passcode);

    // --- 再発行 -------------------------------------------------------------
    if (body.staffAccessId) {
      const existing = await loadOwnedStaffAccess(body.staffAccessId, session.userId);
      const { error } = await db
        .from('staff_access')
        .update({
          passcode_hash: passcodeHash,
          rotated_at: new Date().toISOString(),
          is_active: true,
        })
        .eq('staff_access_id', existing.staff_access_id);
      if (error) throw new HttpError(`再発行に失敗しました: ${error.message}`, 500);

      return NextResponse.json({
        passcode,
        staffAccessId: existing.staff_access_id,
        label: existing.label,
        rotated: true,
      });
    }

    // --- 新規発行 -----------------------------------------------------------
    const label = body.label?.trim() || 'スタッフ用';

    const locationQuery = db
      .from('locations')
      .select('location_id')
      .eq('user_id', session.userId)
      .eq('setup_complete', true);

    // locationId の指定が無ければ、そのオーナーの最初のロケーションに発行する
    // （単独ホテル運用ではロケーションが 1 件しかないため）。
    if (body.locationId) locationQuery.eq('location_id', body.locationId);

    const { data: location, error: locationError } = await locationQuery
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (locationError || !location) {
      throw new HttpError('対象のロケーションが見つかりません。', 404);
    }

    const { data: created, error } = await db
      .from('staff_access')
      .insert({
        location_id: location.location_id,
        label,
        passcode_hash: passcodeHash,
        ui_lang: uiLang,
        created_by: session.userId,
      })
      .select('staff_access_id, label, ui_lang')
      .single();

    if (error || !created) {
      throw new HttpError(`パスコードの発行に失敗しました: ${error?.message}`, 500);
    }

    return NextResponse.json({
      passcode,
      staffAccessId: created.staff_access_id,
      label: created.label,
      uiLang: created.ui_lang,
      rotated: false,
    });
  } catch (err) {
    return await errorResponse(err);
  }
}

async function loadOwnedStaffAccess(staffAccessId: string, ownerUserId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('staff_access')
    .select('staff_access_id, label, locations!inner ( user_id )')
    .eq('staff_access_id', staffAccessId)
    .single();

  if (error || !data) throw new HttpError('パスコードが見つかりません。', 404);

  const location = Array.isArray(data.locations) ? data.locations[0] : data.locations;
  if (location?.user_id !== ownerUserId) {
    throw new HttpError('パスコードが見つかりません。', 404);
  }
  return data;
}
