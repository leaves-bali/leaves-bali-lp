import 'server-only';

import { decodeJwt } from 'jose';

import { env } from '@/lib/env';

/**
 * Google OAuth 2.0 (Authorization Code フロー)。
 *
 * google-auth-library を使わず素の fetch で実装している理由:
 *   - 必要なのは「認可 URL 生成」「code 交換」「refresh」の 3 つだけ
 *   - Vercel の Node ランタイムで依存を増やしたくない
 *   - トークンの保存先が独自（暗号化 + Supabase）なのでライブラリの管理機構が噛み合わない
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/**
 * business.manage は Google ビジネスプロフィール全体（レビュー読み取り・返信投稿を含む）への
 * 単一スコープ。レビューだけの細分化スコープは提供されていない。
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/business.manage',
];

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scope: string;
  idToken: string | null;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // refresh_token を得るために必須
    access_type: 'offline',
    // 既に同意済みのユーザーでも refresh_token を再発行させる。
    // これがないと 2 回目以降のログインで refresh_token が返らず、
    // DB に保存できていなかった場合に復旧できなくなる。
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function postToken(body: Record<string, string>): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    cache: 'no-store',
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const description = json.error_description ?? json.error ?? response.statusText;
    throw new GoogleAuthError(`Google トークンエンドポイントがエラーを返しました: ${description}`, {
      status: response.status,
      code: typeof json.error === 'string' ? json.error : undefined,
    });
  }

  return {
    accessToken: String(json.access_token),
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresInSeconds: typeof json.expires_in === 'number' ? json.expires_in : 3600,
    scope: typeof json.scope === 'string' ? json.scope : '',
    idToken: typeof json.id_token === 'string' ? json.id_token : null,
  };
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  return postToken({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: env.googleRedirectUri,
    grant_type: 'authorization_code',
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  return postToken({
    refresh_token: refreshToken,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    grant_type: 'refresh_token',
  });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
  });
}

/**
 * id_token からユーザー識別情報を取り出す。
 *
 * 署名検証を行っていないのは、この id_token を Google のトークンエンドポイントから
 * HTTPS で直接受け取っているため（Google 公式ドキュメントが認める条件）。
 * クライアント経由で受け取った id_token を扱う場合は必ず JWKS 検証を追加すること。
 */
export function parseIdentity(idToken: string): GoogleIdentity {
  const payload = decodeJwt(idToken);
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new GoogleAuthError('id_token に sub / email が含まれていません。');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

export class GoogleAuthError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = 'GoogleAuthError';
    this.status = options?.status;
    this.code = options?.code;
  }

  /** 再認証（同意画面のやり直し）が必要かどうか。 */
  get requiresReauth(): boolean {
    return this.code === 'invalid_grant' || this.status === 401;
  }
}
