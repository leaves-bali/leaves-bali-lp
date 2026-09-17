import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SetupWizard } from '@/components/SetupWizard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 初期設定ウィザード（3ステップ）。
 *   1. Google 認証  2. ロケーション選択  3. 完了
 * ステップ 1 はログイン前後で画面が変わるのでサーバー側で分岐する。
 */
export default async function OnboardingPage() {
  const session = await getSession();

  // 初期設定はオーナーの作業。スタッフが URL を直接開いてもダッシュボードへ戻す。
  if (session?.role === 'staff') redirect('/dashboard');

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-medium tracking-widest text-jungle-500">
          HOSHI JUNGLE REVIEW AI
        </p>
        <h1 className="mt-1 text-2xl font-bold text-jungle-800">初期設定</h1>
      </header>

      {session ? (
        <SetupWizard userEmail={session.email ?? ''} />
      ) : (
        <div className="card p-6">
          <StepHeader step={1} total={3} title="Google アカウントでログイン" active />
          <p className="mt-3 text-sm text-jungle-600">
            Hoshi Jungle の Google ビジネスプロフィールを管理しているアカウントでログインしてください。
          </p>
          <Link
            href="/api/auth/google?returnTo=/onboarding"
            className="btn-primary mt-5"
            prefetch={false}
          >
            Google でログイン
          </Link>
        </div>
      )}
    </main>
  );
}

function StepHeader({
  step,
  total,
  title,
  active,
}: {
  step: number;
  total: number;
  title: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          active ? 'bg-jungle-600 text-white' : 'bg-jungle-100 text-jungle-500'
        }`}
      >
        {step}
      </span>
      <div>
        <p className="text-xs text-jungle-400">
          ステップ {step} / {total}
        </p>
        <h2 className="text-base font-semibold text-jungle-800">{title}</h2>
      </div>
    </div>
  );
}
