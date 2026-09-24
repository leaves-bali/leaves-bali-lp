import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SyncButton } from '@/components/SyncButton';
import { UiLangSwitcher } from '@/components/UiLangSwitcher';
import { t } from '@/lib/i18n';
import { getFallbackUiLang, getUiLang } from '@/lib/uiLang';
import { getBudgetState } from '@/lib/ai/budget';
import { getQueueCounts, getUserLocations } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';
import { loadLocationPlan } from '@/lib/settings/loadLocationPlan';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/');

  const locations = await getUserLocations(session);
  if (locations.length === 0) {
    // オーナーは初期設定へ。スタッフはロケーションが停止/削除された状態なので入口へ戻す。
    redirect(session.role === 'owner' ? '/onboarding' : '/');
  }

  const counts = await getQueueCounts(session);
  const uiLang = await getUiLang();
  // 一時的な切り替えが失効したときに戻る言語（共有端末での予告に使う）
  const fallbackLang = await getFallbackUiLang();
  const d = t(uiLang);
  const budget = await getBudgetState(locations[0]?.location_id);
  // 契約していないオプションはメニューにも出さない。押せない項目は不具合に見える。
  const plan = await loadLocationPlan(locations[0].location_id);

  const isOwner = session.role === 'owner';

  // 再認証バナーはオーナーにだけ意味がある（スタッフは Google 連携を直せない）。
  const { data: user } = isOwner
    ? await supabaseAdmin()
        .from('users')
        .select('token_revoked_at')
        .eq('user_id', session.userId)
        .single()
    : { data: null };

  const location = locations[0];

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-widest text-ink-400">
              {d.appName}
            </p>
            <h1 className="truncate text-lg font-bold text-brand-700">{location.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`badge ${
                isOwner ? 'bg-brand-100 text-ink-700' : 'bg-ink-100 text-ink-700'
              }`}

            >
              {isOwner ? d.owner : `${d.staff}${session.staffLabel ? ` · ${session.staffLabel}` : ''}`}
            </span>
            <UiLangSwitcher current={uiLang} fallback={fallbackLang} />
            <SyncButton lang={uiLang} />
            {isOwner ? (
              <Link
                href="/dashboard/settings"
                className="text-xs text-ink-500 hover:text-ink-900"
              >
                {d.passcodeAdmin}
              </Link>
            ) : null}
            <Link
              href="/api/auth/logout"
              className="text-xs text-ink-400 hover:text-ink-800"
              prefetch={false}
            >
              {d.logout}
            </Link>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 px-6">
          <NavLink href="/dashboard" label={d.navInbox} count={counts.inbox} />
          <NavLink href="/dashboard/pending" label={d.navAttention} count={counts.attention} highlight />
          <NavLink href="/dashboard/archive" label={d.navArchive} count={counts.archive} />
          {plan.reportEnabled ? <NavLink href="/dashboard/report" label={d.navReport} /> : null}
        </nav>
      </header>

      {user?.token_revoked_at ? (
        <div className="border-b border-brand-200 bg-brand-50 px-6 py-3 text-center text-sm text-brand-800">
          {d.reauthNeeded}
          <Link href="/api/auth/google?returnTo=/dashboard" className="ml-2 font-medium underline" prefetch={false}>
            {d.reauthLink}
          </Link>
        </div>
      ) : null}

      {location.last_sync_error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-center text-xs text-amber-900">
          {d.syncErrorPrefix} {location.last_sync_error}
        </div>
      ) : null}

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>

      <footer className="mx-auto max-w-5xl px-6 pb-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
          <span>
            {d.lastSync}:{' '}
            {location.last_synced_at
              ? new Date(location.last_synced_at).toLocaleString()
              : d.neverSynced}
          </span>
          <span>{d.autoHourly}</span>
          <span
            className={budget.exhausted ? 'font-medium text-amber-700' : ''}
            title={`$${budget.spentUsd.toFixed(4)} / $${budget.budgetUsd}`}
          >
            {d.remainingThisMonth} {budget.remainingReplies}
          </span>
        </div>

        {budget.exhausted ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            {d.budgetExhausted}
          </p>
        ) : null}
      </footer>
    </div>
  );
}

function NavLink({
  href,
  label,
  count,
  highlight = false,
}: {
  href: string;
  label: string;
  /** 件数のない項目（レポートなど）では省略する */
  count?: number;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative px-4 py-3 text-sm font-medium text-ink-600 hover:text-brand-800"
    >
      {label}
      {count === undefined ? null : (
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
            highlight && count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-brand-50 text-ink-500'
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
