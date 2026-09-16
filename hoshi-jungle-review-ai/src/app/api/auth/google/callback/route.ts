import { NextResponse, type NextRequest } from 'next/server';

import { encryptToken } from '@/lib/crypto';
import { env } from '@/lib/env';
import { exchangeCodeForTokens, parseIdentity } from '@/lib/google/oauth';
import { consumeOAuthState, createSessionCookie } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Google からのコールバック。
 *   code → トークン交換 → users に upsert → セッション Cookie 発行 → 元のページへ
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const error = params.get('error');

  if (error) {
    // ユーザーが同意画面でキャンセルした場合など。
    return redirectWithError(request, error === 'access_denied'
      ? 'Google の連携がキャンセルされました。'
      : `Google 認証エラー: ${error}`);
  }

  const code = params.get('code');
  if (!code) {
    return redirectWithError(request, '認可コードが返されませんでした。');
  }

  const state = await consumeOAuthState(params.get('state'));
  if (!state) {
    return redirectWithError(
      request,
      '認証リクエストの検証に失敗しました。もう一度お試しください。',
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.idToken) {
      return redirectWithError(request, 'Google から id_token が返されませんでした。');
    }
    const identity = parseIdentity(tokens.idToken);

    // business.manage スコープが無いとレビュー取得も返信もできない。ここで止める。
    if (!tokens.scope.includes('https://www.googleapis.com/auth/business.manage')) {
      return redirectWithError(
        request,
        'ビジネスプロフィールの管理権限が許可されていません。同意画面ですべての項目にチェックを入れてください。',
      );
    }

    const db = supabaseAdmin();

    const { data: existing } = await db
      .from('users')
      .select('user_id, google_refresh_token_encrypted')
      .eq('google_account_id', identity.sub)
      .maybeSingle();

    // prompt=consent を付けているので通常は毎回 refresh_token が返るが、
    // 万一返らなかった場合は既存の値を維持する（null で上書きしない）。
    const refreshTokenEncrypted = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : (existing?.google_refresh_token_encrypted ?? null);

    if (!refreshTokenEncrypted) {
      return redirectWithError(
        request,
        'Google から refresh token を取得できませんでした。Google アカウントのセキュリティ設定から本アプリのアクセス権を削除したうえで、再度お試しください。',
      );
    }

    const { data: user, error: upsertError } = await db
      .from('users')
      .upsert(
        {
          google_account_id: identity.sub,
          email: identity.email,
          display_name: identity.name ?? null,
          picture_url: identity.picture ?? null,
          google_refresh_token_encrypted: refreshTokenEncrypted,
          google_token_scope: tokens.scope,
          token_revoked_at: null,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: 'google_account_id' },
      )
      .select('user_id')
      .single();

    if (upsertError || !user) {
      throw new Error(upsertError?.message ?? 'ユーザーの保存に失敗しました。');
    }

    await createSessionCookie({
      userId: user.user_id,
      email: identity.email,
      displayName: identity.name,
      pictureUrl: identity.picture,
    });

    // セットアップ済みならダッシュボード、未設定ならウィザードへ。
    const { count } = await db
      .from('locations')
      .select('location_id', { count: 'exact', head: true })
      .eq('user_id', user.user_id)
      .eq('setup_complete', true);

    const destination = (count ?? 0) > 0 ? '/dashboard' : state.returnTo;
    return NextResponse.redirect(new URL(destination, env.appUrl));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return redirectWithError(request, message);
  }
}

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL('/', env.appUrl);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}
