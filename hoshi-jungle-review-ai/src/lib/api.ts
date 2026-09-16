import 'server-only';

import { NextResponse } from 'next/server';

import { ReauthRequiredError } from '@/lib/google/accessToken';
import { getSession, type SessionPayload } from '@/lib/session';

/** API ルート共通の認証ガードとエラー整形。 */

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError('ログインが必要です。', 401);
  return session;
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ReauthRequiredError) {
    return NextResponse.json(
      { error: err.message, code: 'REAUTH_REQUIRED' },
      { status: 401 },
    );
  }
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const status =
    typeof (err as { statusCode?: unknown })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500;
  const message = err instanceof Error ? err.message : '予期しないエラーが発生しました。';

  if (status >= 500) console.error('[api]', err);

  return NextResponse.json({ error: message }, { status });
}
