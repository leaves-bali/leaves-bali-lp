import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { destroySession, getSession } from '@/lib/session';
import { clearUiLangOverride } from '@/lib/uiLang';

export const runtime = 'nodejs';

export async function POST() {
  await destroySession();
  // 共有端末では、席を立つ人の言語を次の人に残さない
  await clearUiLangOverride();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // ログアウト後の戻り先は役割で変える。スタッフをGoogleログイン画面に
  // 放り出すと「自分のアカウントで入るのか」と混乱するため。
  const session = await getSession();
  const destination = session?.role === 'staff' ? '/staff' : '/';
  await destroySession();
  await clearUiLangOverride();
  return NextResponse.redirect(new URL(destination, env.appUrl));
}
