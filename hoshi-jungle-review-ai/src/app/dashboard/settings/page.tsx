import { redirect } from 'next/navigation';

import { StaffAccessManager } from '@/components/StaffAccessManager';
import { t } from '@/lib/i18n';
import { getSession } from '@/lib/session';
import { getUiLang } from '@/lib/uiLang';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** オーナー専用: スタッフ用パスコードの発行・再発行・停止。 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/');
  // スタッフが URL を直接叩いても入れない
  if (session.role !== 'owner') redirect('/dashboard');

  const uiLang = await getUiLang();
  const d = t(uiLang);
  const db = supabaseAdmin();

  const { data: locations } = await db
    .from('locations')
    .select('location_id, name')
    .eq('user_id', session.userId)
    .eq('setup_complete', true)
    .order('created_at', { ascending: true });

  const locationIds = (locations ?? []).map((l) => l.location_id);

  const { data: items } = locationIds.length
    ? await db
        .from('staff_access')
        .select(
          'staff_access_id, location_id, label, is_active, last_used_at, created_at, rotated_at',
        )
        .in('location_id', locationIds)
        .order('created_at', { ascending: true })
    : { data: [] };

  // 直近 24 時間の失敗ログイン数（不審なアクセスの検知用）
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentFailures } = locationIds.length
    ? await db
        .from('staff_login_attempts')
        .select('attempt_id', { count: 'exact', head: true })
        .eq('succeeded', false)
        .gte('attempted_at', since)
    : { count: 0 };

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-jungle-800">{d.passcodeTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-jungle-500">
          {d.passcodeLead}
        </p>
      </div>

      <StaffAccessManager
        initialItems={items ?? []}
        locations={locations ?? []}
        appUrlHint="/staff"
        lang={uiLang}
      />

      <div className="card mt-6 p-5">
        <h3 className="text-sm font-semibold text-jungle-800">{d.securityStatus}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-jungle-500">{d.activePasscodes}</dt>
            <dd className="mt-0.5 font-bold text-jungle-800">
              {(items ?? []).filter((i) => i.is_active).length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-jungle-500">{d.failedLogins24h}</dt>
            <dd
              className={`mt-0.5 font-bold ${
                (recentFailures ?? 0) > 20 ? 'text-red-600' : 'text-jungle-800'
              }`}
            >
              {recentFailures ?? 0}
            </dd>
          </div>
        </dl>
        {(recentFailures ?? 0) > 20 ? (
          <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {d.bruteForceWarning}
          </p>
        ) : null}
      </div>
    </section>
  );
}
