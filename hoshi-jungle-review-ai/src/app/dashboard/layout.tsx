import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SyncButton } from '@/components/SyncButton';
import { getQueueCounts, getUserLocations } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';
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
      <header className="border-b border-jungle-100 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-widest text-jungle-400">
              HOSHI JUNGLE REVIEW AI
            </p>
            <h1 className="truncate text-lg font-bold text-jungle-800">{location.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`badge ${
                isOwner ? 'bg-jungle-100 text-jungle-700' : 'bg-sand-200 text-jungle-700'
              }`}
              title={isOwner ? 'Google 連携とパスコード発行が行えます' : 'クチコミの確認・編集・公開が行えます'}
            >
              {isOwner ? 'オーナー' : `スタッフ${session.staffLabel ? `・${session.staffLabel}` : ''}`}
            </span>
            <SyncButton />
            {isOwner ? (
              <Link
                href="/dashboard/settings"
                className="text-xs text-jungle-500 hover:text-jungle-700"
              >
                パスコード管理
              </Link>
            ) : null}
            <Link
              href="/api/auth/logout"
              className="text-xs text-jungle-400 hover:text-jungle-600"
              prefetch={false}
            >
              ログアウト
            </Link>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 px-6">
          <NavLink href="/dashboard" label="未返信" count={counts.inbox} />
          <NavLink href="/dashboard/pending" label="要確認" count={counts.attention} highlight />
          <NavLink href="/dashboard/archive" label="履歴" count={counts.archive} />
        </nav>
      </header>

      {user?.token_revoked_at ? (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-center text-sm text-red-800">
          Google のアクセス権が失効しています。クチコミの取得と公開ができません。
          <Link href="/api/auth/google?returnTo=/dashboard" className="ml-2 font-medium underline" prefetch={false}>
            再認証する
          </Link>
        </div>
      ) : null}

      {location.last_sync_error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-center text-xs text-amber-900">
          直近の自動同期でエラーが発生しました: {location.last_sync_error}
        </div>
      ) : null}

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-jungle-400">
        最終同期:{' '}
        {location.last_synced_at
          ? new Date(location.last_synced_at).toLocaleString('ja-JP')
          : '未実行'}
        ・毎時自動で取得しています
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
  count: number;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative px-4 py-3 text-sm font-medium text-jungle-600 hover:text-jungle-800"
    >
      {label}
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
          highlight && count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-jungle-50 text-jungle-500'
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
