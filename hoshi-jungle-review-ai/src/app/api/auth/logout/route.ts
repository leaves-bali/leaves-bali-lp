import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { destroySession, getSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // ログアウト後の戻り先は役割で変える。スタッフをGoogleログイン画面に
  // 放り出すと「自分のアカウントで入るのか」と混乱するため。
  const session = await getSession();
  const destination = session?.role === 'staff' ? '/staff' : '/';
  await destroySession();
  return NextResponse.redirect(new URL(destination, env.appUrl));
}
