import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StaffLoginForm } from '@/components/StaffLoginForm';
import { UiLangSwitcher } from '@/components/UiLangSwitcher';
import { t } from '@/lib/i18n';
import { getSession } from '@/lib/session';
import { getUiLang } from '@/lib/uiLang';

export const dynamic = 'force-dynamic';

/** スタッフ用のパスコード入室画面。 */
export default async function StaffLoginPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const uiLang = await getUiLang();
  const d = t(uiLang);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <UiLangSwitcher current={uiLang} />
        </div>

        <div className="mb-8 text-center">
          <p className="text-sm font-medium tracking-widest text-jungle-500">HOSHI JUNGLE</p>
          <h1 className="mt-2 text-2xl font-bold text-jungle-800">Review AI</h1>
          <p className="mt-2 text-sm text-jungle-600">{d.staffLogin}</p>
        </div>

        <StaffLoginForm lang={uiLang} />

        <p className="mt-6 text-center text-xs text-jungle-400">{d.askAdmin}</p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-xs text-jungle-400 underline hover:text-jungle-600">
            {d.ownerLinkHere}
          </Link>
        </p>
      </div>
    </main>
  );
}
