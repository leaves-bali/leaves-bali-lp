import { NextResponse, type NextRequest } from 'next/server';

import { buildAuthUrl } from '@/lib/google/oauth';
import { issueOAuthState } from '@/lib/session';

export const runtime = 'nodejs';

/** Google の同意画面へリダイレクトする。 */
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('returnTo') ?? '/onboarding';
  // オープンリダイレクト防止: 自サイト内のパスのみ許可する。
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//')
    ? returnTo
    : '/onboarding';

  const state = await issueOAuthState(safeReturnTo);
  return NextResponse.redirect(buildAuthUrl(state));
}
