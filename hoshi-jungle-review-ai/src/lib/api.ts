import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { ReauthRequiredError } from '@/lib/google/accessToken';
import { getSession, type SessionPayload } from '@/lib/session';

/** API ルート共通の認証・認可ガードとエラー整形。 */

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** ログインしていれば通す（owner / staff の両方）。 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError('ログインが必要です。', 401);
  return session;
}

/**
 * オーナー専用の操作（Google 連携、ロケーション登録、パスコード発行）。
 * スタッフがここに到達した場合は 403 を返す。
 */
export async function requireOwner(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== 'owner') {
    throw new HttpError('この操作はオーナーアカウントでのみ実行できます。', 403);
  }
  return session;
}

/**
 * セッションが触ってよいロケーション ID の集合を返す。
 * staff は自分のロケーション 1 件のみ。owner は null（＝自分の全ロケーション）。
 */
export function scopedLocationId(session: SessionPayload): string | null {
  return session.role === 'staff' ? (session.locationId ?? null) : null;
}

/** リバースプロキシ配下でのクライアント IP 取得（Vercel は x-forwarded-for を付与する）。 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
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
