import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { destroySession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  await destroySession();
  return NextResponse.redirect(new URL('/', env.appUrl));
}
