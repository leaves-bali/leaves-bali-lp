import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireOwner } from '@/lib/api';
import { isUiLang } from '@/lib/i18n';
import { sanitizeAutoPublishLanguages } from '@/lib/settings/locationSettings';
import type { LocationRow } from '@/lib/database.types';
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
 * 店舗ごとの設定の更新。
 *
 * 店名・所在地・署名・連絡先・お店の魅力・自動公開の条件・共有端末の既定言語。
 * もともと環境変数にあったもので、システム全体で 1 組しか持てなかった。
 * 複数店舗に売る以上、これらは店の属性として持たなければならない。
 *
 * 送られてきた項目だけを更新する（部分更新）。null を送ると「未設定に戻す」で、
 * その項目は環境変数の既定値に戻る。
 *
 * オーナー専用。スタッフの合言葉ログインでは requireOwner が通らない。
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireOwner();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Supabase の型に合わせるため、更新対象の列を明示した型で受ける
    const update: Partial<LocationRow> = {};

    if ('defaultUiLang' in body) {
      if (!isUiLang(body.defaultUiLang)) throw new HttpError('unsupported language', 400, 'not_found');
      update.default_ui_lang = body.defaultUiLang;
    }

    // 店名だけは空にできない。空だと AI が名乗れなくなる。
    if ('name' in body) {
      const name = text(body.name, 120);
      if (!name) throw new HttpError('店名は必須です。', 400);
      update.name = name;
    }

    if ('areaLabel' in body) update.area_label = text(body.areaLabel, 120);
    if ('replySignature' in body) update.reply_signature = text(body.replySignature, 120);
    if ('contactEmail' in body) update.contact_email = text(body.contactEmail, 200);

    if ('highlights' in body) {
      if (!Array.isArray(body.highlights)) throw new HttpError('お店の魅力の形式が不正です。', 400);
      const list = body.highlights
        .map((h) => text(h, 120))
        .filter((h): h is string => h !== null);
      // 増やしすぎるとプロンプトが薄まり、かえって具体性が落ちる（DB 側にも同じ制約）
      if (list.length > 5) throw new HttpError('お店の魅力は5つまでです。', 400);
      update.highlights = list;
    }

    if ('autoPublishEnabled' in body) {
      if (typeof body.autoPublishEnabled !== 'boolean' && body.autoPublishEnabled !== null) {
        throw new HttpError('自動公開の設定が不正です。', 400);
      }
      update.auto_publish_enabled = body.autoPublishEnabled as boolean | null;
    }

    if ('autoPublishMinRating' in body) {
      const n = Number(body.autoPublishMinRating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new HttpError('自動公開する最低評価は1〜5で指定してください。', 400);
      }
      update.auto_publish_min_rating = n;
    }

    if ('autoPublishLanguages' in body) {
      if (!Array.isArray(body.autoPublishLanguages)) {
        throw new HttpError('自動公開する言語の形式が不正です。', 400);
      }
      // インドネシア語と未対応の言語はここで落とす。DB 制約にも同じ条件がある。
      update.auto_publish_languages = sanitizeAutoPublishLanguages(
        body.autoPublishLanguages.map((l) => String(l)),
      );
    }

    if (Object.keys(update).length === 0) {
      throw new HttpError('更新内容がありません。', 400);
    }

    const db = supabaseAdmin();

    // 他人のロケーションを書き換えられないよう、必ず user_id で絞る
    const query = db.from('locations').update(update).eq('user_id', session.userId);
    if (typeof body.locationId === 'string') query.eq('location_id', body.locationId);

    const { data, error } = await query.select('location_id');

    if (error) throw new HttpError(error.message, 500);
    if (!data || data.length === 0) throw new HttpError('location not found', 404, 'not_found');

    return NextResponse.json({ ok: true });
  } catch (err) {
    return await errorResponse(err);
  }
}

/** 空文字と空白だけの入力は「未設定」として null にする。 */
function text(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  if (trimmed.length > max) throw new HttpError(`入力が長すぎます（${max}文字まで）。`, 400);
  return trimmed;
}
