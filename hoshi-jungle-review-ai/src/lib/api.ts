import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { ReauthRequiredError } from '@/lib/google/accessToken';
import { t, type UiLang } from '@/lib/i18n';
import { PlanNotIncludedError } from '@/lib/settings/locationPlan';
import { getSession, type SessionPayload } from '@/lib/session';
import { getUiLang } from '@/lib/uiLang';

/**
 * API ルート共通の認証・認可ガードとエラー整形。
 *
 * 【エラー文言を「コード」で投げる理由】
 * このシステムを操作するのは日本人・インドネシア人・アメリカ人のスタッフ。
 * 文言を直接投げると、どの言語の画面にも同じ言語のエラーが出てしまう。
 * コードだけを投げ、レスポンスを組み立てる直前に画面の言語へ翻訳する。
 *
 * Supabase や Google から返る生のメッセージは翻訳しようがないため、
 * コードを持たないエラーはそのまま通す（原因調査には原文のほうが役に立つ）。
 */

/** 翻訳できるエラーの種類。 */
export type ErrorCode =
  | 'login_required'
  | 'owner_only'
  | 'not_found'
  | 'already_published'
  | 'empty_reply'
  | 'published_no_edit';

const ERROR_CODES: readonly ErrorCode[] = [
  'login_required',
  'owner_only',
  'not_found',
  'already_published',
  'empty_reply',
  'published_no_edit',
];

/**
 * 翻訳できるコードかどうか。
 *
 * Node の 'ECONNREFUSED' や Postgres の '23505' のように、まったく無関係な
 * エラーにも code プロパティは付く。それを translate() に渡すと
 * どの case にも一致せず undefined が返り、画面にエラーが出なくなる。
 */
function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

export class HttpError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;

  constructor(message: string, status = 400, code?: ErrorCode) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function translate(lang: UiLang, code: ErrorCode): string {
  const d = t(lang);
  switch (code) {
    case 'login_required':
      return d.errLoginRequired;
    case 'owner_only':
      return d.errOwnerOnly;
    case 'not_found':
      return d.errNotFound;
    case 'already_published':
      return d.errAlreadyPublished;
    case 'empty_reply':
      return d.errEmptyReply;
    case 'published_no_edit':
      return d.errPublishedNoEdit;
  }
}

/** ログインしていれば通す（owner / staff の両方）。 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new HttpError('Login required.', 401, 'login_required');
  return session;
}

/**
 * オーナー専用の操作（Google 連携、ロケーション登録、パスコード発行）。
 * スタッフがここに到達した場合は 403 を返す。
 */
export async function requireOwner(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== 'owner') {
    throw new HttpError('Owner only.', 403, 'owner_only');
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

/** リバースプロキシ配下でのクライアント IP 取得（Vercel/Netlify は x-forwarded-for を付与する）。 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function errorResponse(err: unknown): Promise<NextResponse> {
  const lang = await getUiLang();

  if (err instanceof ReauthRequiredError) {
    return NextResponse.json(
      { error: t(lang).reauthNeeded, code: 'REAUTH_REQUIRED' },
      { status: 401 },
    );
  }

  // 契約していない機能は「無い」ものとして扱う。
  // 画面から隠していても URL を直接叩けば API には届くため、ここでも止める。
  if (err instanceof PlanNotIncludedError) {
    return NextResponse.json({ error: translate(lang, 'not_found') }, { status: 404 });
  }

  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: err.code ? translate(lang, err.code) : err.message },
      { status: err.status },
    );
  }

  // PublishError など、HttpError 以外でも「翻訳できるコード」を持つものは翻訳する
  const maybe = err as { statusCode?: unknown; code?: unknown };
  const status = typeof maybe?.statusCode === 'number' ? maybe.statusCode : 500;

  if (status >= 500) console.error('[api]', err);

  if (isErrorCode(maybe?.code)) {
    return NextResponse.json({ error: translate(lang, maybe.code) }, { status });
  }

  // 想定外のエラーの本文はそのまま返さない。
  // 環境変数名・DB のエラー・内部パスなどがそのまま利用者に見えてしまうため、
  // 詳細はサーバーのログに残し、画面には定型文を出す。
  if (status >= 500) {
    return NextResponse.json({ error: t(lang).errUnexpected }, { status });
  }

  return NextResponse.json(
    { error: err instanceof Error ? err.message : t(lang).errUnexpected },
    { status },
  );
}
