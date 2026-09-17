import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SetupWizard } from '@/components/SetupWizard';
import { UiLangSwitcher } from '@/components/UiLangSwitcher';
import { t } from '@/lib/i18n';
import { getSession } from '@/lib/session';
import { getUiLang } from '@/lib/uiLang';

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

  const uiLang = await getUiLang();
  const d = t(uiLang);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-12">
      <header className="mb-10 flex flex-wrap items-start gap-4">
        <div>
          <p className="text-xs font-medium tracking-widest text-jungle-500">
            HOSHI JUNGLE REVIEW AI
          </p>
          <h1 className="mt-1 text-2xl font-bold text-jungle-800">{d.setupTitle}</h1>
        </div>
        <div className="ml-auto">
          <UiLangSwitcher current={uiLang} />
        </div>
      </header>

      {session ? (
        <SetupWizard userEmail={session.email ?? ''} lang={uiLang} />
      ) : (
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-jungle-600 text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="text-xs text-jungle-400">{d.stepOf(1, 3)}</p>
              <h2 className="text-base font-semibold text-jungle-800">{d.stepGoogleLogin}</h2>
            </div>
          </div>
          <p className="mt-3 text-sm text-jungle-600">{d.stepGoogleHint}</p>
          <Link
            href="/api/auth/google?returnTo=/onboarding"
            className="btn-primary mt-5"
            prefetch={false}
          >
            {d.signInWithGoogle}
          </Link>
        </div>
      )}
    </main>
  );
}
