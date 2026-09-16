import 'server-only';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import { env } from '@/lib/env';

/**
 * ログインセッション。
 *
 * Supabase Auth は使わず、Google OAuth の結果を自前の署名付き Cookie で保持する。
 * 理由: 認証の主目的が「Business Profile API を叩く権限の取得」であり、
 * 認証基盤を二重に持つと refresh_token の所在が分散して事故りやすいため。
 */

const COOKIE_NAME = 'hj_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7日

export interface SessionPayload {
  userId: string;
  email: string;
  displayName?: string;
  pictureUrl?: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // OAuth コールバックはクロスサイトのリダイレクトで戻ってくるため Strict は不可。
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      displayName: typeof payload.displayName === 'string' ? payload.displayName : undefined,
      pictureUrl: typeof payload.pictureUrl === 'string' ? payload.pictureUrl : undefined,
    };
  } catch {
    // 署名不正 / 期限切れ。どちらも「未ログイン」として扱う。
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** OAuth の state を CSRF 対策として署名付きで発行・検証する。 */
const STATE_COOKIE = 'hj_oauth_state';

export async function issueOAuthState(returnTo: string): Promise<string> {
  const nonce = crypto.randomUUID();
  const state = await new SignJWT({ nonce, returnTo })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secretKey());

  const store = await cookies();
  store.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return state;
}

export async function consumeOAuthState(
  state: string | null,
): Promise<{ returnTo: string } | null> {
  if (!state) return null;
  const store = await cookies();
  const nonce = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  if (!nonce) return null;

  try {
    const { payload } = await jwtVerify(state, secretKey());
    if (payload.nonce !== nonce) return null;
    return {
      returnTo: typeof payload.returnTo === 'string' ? payload.returnTo : '/dashboard',
    };
  } catch {
    return null;
  }
}
