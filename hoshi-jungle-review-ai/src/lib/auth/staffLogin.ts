import 'server-only';

import { createHash } from 'node:crypto';

import { normalizePasscode, verifyPasscode } from '@/lib/passcode';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * スタッフのパスコードログイン。
 *
 * 約 39 ビットのパスコードを守るのはレート制限と scrypt のコストである、という前提で設計している。
 *   - 照合 1 回あたり scrypt で約 100ms かかる
 *   - 同一 IP から 15 分あたり 10 回失敗すると遮断する
 *
 * レコード単位のロックは意図的に実装していない。パスコードはハッシュでしか保存して
 * いないため、不一致時に「どのレコードが狙われたか」を特定できない。特定できる形に
 * すると、他人のパスコードを故意にロックする嫌がらせが成立してしまう。
 */

const IP_WINDOW_MINUTES = 15;
const IP_MAX_FAILURES = 10;

export type StaffLoginOutcome =
  | {
      ok: true;
      userId: string;
      locationId: string;
      staffAccessId: string;
      staffLabel: string;
    }
  | { ok: false; status: number; message: string };

/** IP は生のまま保存しない。監査に必要なのは「同一送信元かどうか」だけ。 */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export async function loginWithPasscode(
  rawPasscode: string,
  ipHash: string,
): Promise<StaffLoginOutcome> {
  const db = supabaseAdmin();
  const passcode = normalizePasscode(rawPasscode);

  if (passcode.length < 6) {
    return { ok: false, status: 400, message: 'パスコードを入力してください。' };
  }

  // --- 1. IP 単位のレート制限 ---------------------------------------------
  const windowStart = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000).toISOString();
  const { count: recentFailures } = await db
    .from('staff_login_attempts')
    .select('attempt_id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('succeeded', false)
    .gte('attempted_at', windowStart);

  if ((recentFailures ?? 0) >= IP_MAX_FAILURES) {
    return {
      ok: false,
      status: 429,
      message: `試行回数が多すぎます。${IP_WINDOW_MINUTES} 分ほど待ってからもう一度お試しください。`,
    };
  }

  // --- 2. 有効なパスコードを総当たりで照合 ---------------------------------
  // パスコードから該当レコードを引くことはできない（ハッシュのみ保存しているため）。
  // 有効レコードは 1 ホテルあたり数件なので、全件に対して verify を回す。
  const { data: candidates } = await db
    .from('staff_access')
    .select(
      `staff_access_id, location_id, label, passcode_hash,
       locations!inner ( user_id, setup_complete )`,
    )
    .eq('is_active', true);

  for (const candidate of candidates ?? []) {
    const location = Array.isArray(candidate.locations)
      ? candidate.locations[0]
      : candidate.locations;
    if (!location?.setup_complete) continue;

    const matches = await verifyPasscode(passcode, candidate.passcode_hash);
    if (!matches) continue;

    await db
      .from('staff_access')
      .update({ last_used_at: new Date().toISOString() })
      .eq('staff_access_id', candidate.staff_access_id);

    await recordAttempt(candidate.location_id, ipHash, true);

    return {
      ok: true,
      userId: location.user_id,
      locationId: candidate.location_id,
      staffAccessId: candidate.staff_access_id,
      staffLabel: candidate.label,
    };
  }

  // --- 3. 不一致 -----------------------------------------------------------
  await recordAttempt(null, ipHash, false);

  return { ok: false, status: 401, message: 'パスコードが違います。' };
}

async function recordAttempt(
  locationId: string | null,
  ipHash: string,
  succeeded: boolean,
): Promise<void> {
  await supabaseAdmin()
    .from('staff_login_attempts')
    .insert({ location_id: locationId, ip_hash: ipHash, succeeded });
}
