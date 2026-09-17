import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StaffLoginForm } from '@/components/StaffLoginForm';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** スタッフ用のパスコード入室画面。 */
export default async function StaffLoginPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium tracking-widest text-jungle-500">HOSHI JUNGLE</p>
          <h1 className="mt-2 text-2xl font-bold text-jungle-800">Review AI</h1>
          <p className="mt-2 text-sm text-jungle-600">スタッフ用ログイン</p>
        </div>

        <StaffLoginForm />

        <p className="mt-6 text-center text-xs text-jungle-400">
          パスコードが分からない場合は、ホテルの管理者に確認してください。
        </p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-xs text-jungle-400 underline hover:text-jungle-600">
            オーナー・管理者の方はこちら
          </Link>
        </p>
      </div>
    </main>
  );
}
