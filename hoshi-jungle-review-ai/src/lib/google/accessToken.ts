import 'server-only';

import { decryptToken } from '@/lib/crypto';
import { GoogleAuthError, refreshAccessToken } from '@/lib/google/oauth';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * 保存済みの refresh_token から access_token を取り出す。
 *
 * access_token の寿命は約 1 時間。サーバーレスの実行単位をまたぐとキャッシュは消えるが、
 * 同一リクエスト内で複数回 Google API を叩くケース（レビュー取得 → 返信投稿）では
 * 効くのでプロセス内キャッシュを持つ。
 */

interface CacheEntry {
  accessToken: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** 期限ギリギリで使って 401 を踏まないよう、60 秒の安全マージンを取る。 */
const EXPIRY_MARGIN_MS = 60_000;

export class ReauthRequiredError extends Error {
  constructor(message = 'Google の再認証が必要です。ログインし直してください。') {
    super(message);
    this.name = 'ReauthRequiredError';
  }
}

export async function getAccessTokenForUser(userId: string): Promise<string> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
    return cached.accessToken;
  }

  const db = supabaseAdmin();
  const { data: user, error } = await db
    .from('users')
    .select('user_id, google_refresh_token_encrypted, token_revoked_at')
    .eq('user_id', userId)
    .single();

  if (error || !user) {
    throw new ReauthRequiredError('ユーザーが見つかりません。');
  }
  if (!user.google_refresh_token_encrypted) {
    throw new ReauthRequiredError(
      'Google の refresh token が保存されていません。ログインし直してください。',
    );
  }

  let tokens;
  try {
    tokens = await refreshAccessToken(decryptToken(user.google_refresh_token_encrypted));
  } catch (err) {
    if (err instanceof GoogleAuthError && err.requiresReauth) {
      // ユーザーが Google 側でアクセス権を取り消した / トークンが失効した。
      // 失効を記録して、ダッシュボードで再認証を促せるようにする。
      await db
        .from('users')
        .update({ token_revoked_at: new Date().toISOString() })
        .eq('user_id', userId);
      cache.delete(userId);
      throw new ReauthRequiredError();
    }
    throw err;
  }

  cache.set(userId, {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + tokens.expiresInSeconds * 1000,
  });

  if (user.token_revoked_at) {
    // 復旧したのでフラグを戻す
    await db.from('users').update({ token_revoked_at: null }).eq('user_id', userId);
  }

  return tokens.accessToken;
}

export function invalidateAccessToken(userId: string): void {
  cache.delete(userId);
}
