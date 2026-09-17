import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * 入口。役割が 2 つあるので導線も 2 つに分ける。
 *   スタッフ … パスコードで入る（こちらを主動線として上に置く）
 *   オーナー … Google でログインする（初回設定と管理のみ）
 *
 * 日常的に開くのは圧倒的にスタッフなので、スタッフ用を先頭に置いている。
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();

  if (session) {
    if (session.role === 'staff') redirect('/dashboard');
    const { count } = await supabaseAdmin()
      .from('locations')
      .select('location_id', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('setup_complete', true);
    redirect((count ?? 0) > 0 ? '/dashboard' : '/onboarding');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium tracking-widest text-jungle-500">HOSHI JUNGLE</p>
          <h1 className="mt-2 text-3xl font-bold text-jungle-800">Review AI</h1>
          <p className="mt-3 text-sm leading-relaxed text-jungle-600">
            Google マップのクチコミに、日本語・英語・インドネシア語で
            <br />
            返信案を自動作成します。公開はスタッフの確認後です。
          </p>
        </div>

        {error ? (
          <div className="card mb-6 border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-jungle-800">スタッフの方</h2>
          <p className="mt-1 text-xs text-jungle-500">
            ホテルから配布されたパスコードで入室します。
          </p>
          <Link href="/staff" className="btn-primary mt-4 w-full">
            パスコードで入る
          </Link>
        </div>

        <div className="card mt-4 p-6">
          <h2 className="text-sm font-semibold text-jungle-800">オーナー・管理者の方</h2>
          <p className="mt-1 text-xs text-jungle-500">
            初回のGoogle連携と、スタッフ用パスコードの発行を行います。
          </p>
          <Link
            href="/api/auth/google?returnTo=/onboarding"
            className="btn-secondary mt-4 w-full"
            prefetch={false}
          >
            Google アカウントでログイン
          </Link>
          <p className="mt-3 text-[11px] leading-relaxed text-jungle-400">
            Hoshi Jungle の Google ビジネスプロフィールを管理している Google
            アカウントでログインしてください。
          </p>
        </div>
      </div>
    </main>
  );
}
