import 'server-only';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import { env } from '@/lib/env';

/**
 * ログインセッション。役割は 2 つ。
 *
 *   owner … Google OAuth でログインしたホテル側の管理者。
 *           Google の refresh_token を保持し、パスコードを発行できる。
 *   staff … 共通パスコードで入室したスタッフ。Google の認証情報には一切触れない。
 *           操作は「オーナーが保存したトークン」を使ってサーバー側で実行される。
 *
 * staff セッションには userId（＝オーナーの user_id）が入るが、これは
 * Google API を呼ぶための参照であって、オーナーの権限を与えるものではない。
 * 画面と API の権限判定は必ず role を見ること。
 */

const COOKIE_NAME = 'hj_session';
const STATE_COOKIE = 'hj_oauth_state';

const OWNER_TTL_SECONDS = 60 * 60 * 24 * 7; // 7日
// スタッフはフロントの共用端末で使う想定。放置された端末が翌日も開けないよう短くする。
const STAFF_TTL_SECONDS = 60 * 60 * 12; // 12時間

export type AppRole = 'owner' | 'staff';

export interface SessionPayload {
  role: AppRole;
  /** Google トークンの持ち主（オーナー）の user_id。staff セッションでも入る。 */
  userId: string;
  /** オーナーのみ */
  email?: string;
  displayName?: string;
  pictureUrl?: string;
  /** staff のみ: このロケーションに限定してアクセスできる */
  locationId?: string;
  staffAccessId?: string;
  staffLabel?: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

async function writeSession(payload: SessionPayload, ttlSeconds: number): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // OAuth コールバックはクロスサイトのリダイレクトで戻ってくるため Strict は不可。
    sameSite: 'lax',
    path: '/',
    maxAge: ttlSeconds,
  });
}

export async function createOwnerSession(
  payload: Omit<SessionPayload, 'role' | 'locationId' | 'staffAccessId' | 'staffLabel'>,
): Promise<void> {
  await writeSession({ ...payload, role: 'owner' }, OWNER_TTL_SECONDS);
}

export async function createStaffSession(payload: {
  userId: string;
  locationId: string;
  staffAccessId: string;
  staffLabel: string;
}): Promise<void> {
  await writeSession({ ...payload, role: 'staff' }, STAFF_TTL_SECONDS);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== 'string') return null;

    const role: AppRole = payload.role === 'staff' ? 'staff' : 'owner';

    // staff セッションは locationId が無ければ成立しない（スコープ不明のまま通さない）
    if (role === 'staff' && typeof payload.locationId !== 'string') return null;

    return {
      role,
      userId: payload.userId,
      email: str(payload.email),
      displayName: str(payload.displayName),
      pictureUrl: str(payload.pictureUrl),
      locationId: str(payload.locationId),
      staffAccessId: str(payload.staffAccessId),
      staffLabel: str(payload.staffLabel),
    };
  } catch {
    // 署名不正 / 期限切れ。どちらも「未ログイン」として扱う。
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** OAuth の state を CSRF 対策として署名付きで発行・検証する。 */
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
