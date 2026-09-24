import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';

import {
  LOCATION_SETTINGS_COLUMNS,
  resolveLocationSettings,
  type LocationSettings,
  type LocationSettingsDefaults,
  type LocationSettingsRow,
} from '@/lib/settings/locationSettings';

/**
 * 店舗ごとの設定を DB から読む。
 *
 * 純粋な決定ロジック（locationSettings.ts）と DB アクセスを分けてある。
 * 「既存店の挙動が移行後も変わらない」ことを DB 無しでテストできるようにするため。
 */

/** まだ設定していない店に使う既定値。環境変数から作る。 */
export function envLocationDefaults(): LocationSettingsDefaults {
  return {
    name: env.hotelName,
    areaLabel: env.hotelLocation,
    replySignature: env.hotelSignature,
    contactEmail: env.hotelContactEmail,
    autoPublishEnabled: env.autoPublishEnabled,
    autoPublishMinRating: env.autoPublishMinRating,
    autoPublishLanguages: env.autoPublishLanguages,
  };
}

export async function loadLocationSettings(locationId: string): Promise<LocationSettings> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('locations')
    .select(LOCATION_SETTINGS_COLUMNS)
    .eq('location_id', locationId)
    .single();

  if (error || !data) {
    throw new Error(`店舗設定を読み込めませんでした (${locationId}): ${error?.message ?? 'not found'}`);
  }

  return resolveLocationSettings(data as unknown as LocationSettingsRow, envLocationDefaults());
}
