import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * ログイン画面 兼 ランディング。
 * 既にログイン済みなら、セットアップ状況に応じて自動で振り分ける。
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();

  if (session) {
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
          <p className="text-sm font-medium tracking-widest text-jungle-500">
            HOSHI JUNGLE
          </p>
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
          <Link
            href="/api/auth/google?returnTo=/onboarding"
            className="btn-primary w-full"
            prefetch={false}
          >
            Google アカウントで始める
          </Link>
          <p className="mt-4 text-xs leading-relaxed text-jungle-500">
            Hoshi Jungle の Google ビジネスプロフィールを管理している Google
            アカウントでログインしてください。クチコミの読み取りと返信の投稿にのみ使用します。
          </p>
        </div>

        <ol className="mt-8 space-y-2 text-xs text-jungle-500">
          <li>1. Google でログイン</li>
          <li>2. 対象のロケーションを選ぶ</li>
          <li>3. 完了（以降は毎時自動でクチコミを取得します）</li>
        </ol>
      </div>
    </main>
  );
}
