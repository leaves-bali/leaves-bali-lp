import 'server-only';

import { REPLY_MAX_LENGTH } from '@/lib/constants';

/**
 * Google Business Profile API クライアント。
 *
 * 【重要】Google のビジネスプロフィール API は 2022 年に 1 本の v4 API から
 * 用途別の複数 API に分割されたが、**レビュー関連だけは新 API に移行されておらず、
 * 旧 v4 エンドポイント (mybusiness.googleapis.com/v4) が現役**である。
 * そのため本クライアントは 3 つのホストを使い分ける:
 *
 *   1. mybusinessaccountmanagement.googleapis.com/v1  … アカウント一覧
 *   2. mybusinessbusinessinformation.googleapis.com/v1 … ロケーション一覧
 *   3. mybusiness.googleapis.com/v4                    … レビュー取得 / 返信投稿
 *
 * v4 の 1・2 に相当するエンドポイントは廃止済みなので、新旧を混ぜる必要がある。
 */

const ACCOUNT_MGMT_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const LEGACY_V4_BASE = 'https://mybusiness.googleapis.com/v4';

/** Google 側の返信本文の上限。超過すると 400 が返るのでクライアント側で弾く。 */
export { REPLY_MAX_LENGTH } from '@/lib/constants';

export class GoogleApiError extends Error {
  readonly status: number;
  readonly reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.reason = reason;
  }

  /** 時間をおけば直る種類のエラーか（レート制限 / 一時障害）。 */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }

  /** 再認証が必要か。 */
  get requiresReauth(): boolean {
    return this.status === 401;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** 429 / 5xx に対する最大リトライ回数 */
  maxRetries?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T>(
  accessToken: string,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, maxRetries = 3 } = options;

  const target = new URL(url);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) target.searchParams.set(key, String(value));
  }

  let lastError: GoogleApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(target.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    if (response.ok) {
      // DELETE は 204 / 空ボディを返すことがある
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    }

    const text = await response.text();
    let reason: string | undefined;
    let message = text || response.statusText;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; status?: string } };
      message = parsed.error?.message ?? message;
      reason = parsed.error?.status;
    } catch {
      // JSON でないエラー本文はそのまま使う
    }

    lastError = new GoogleApiError(
      `Google API ${method} ${target.pathname} が失敗しました (${response.status}): ${message}`,
      response.status,
      reason,
    );

    if (!lastError.isRetryable || attempt === maxRetries) throw lastError;

    // 指数バックオフ + ジッタ。429 は Google 側のクォータなので素直に待つ。
    const delay = 2 ** attempt * 1000 + Math.floor(Math.random() * 500);
    await sleep(delay);
  }

  throw lastError ?? new GoogleApiError('不明な Google API エラー', 500);
}

// -----------------------------------------------------------------------------
// アカウント / ロケーション
// -----------------------------------------------------------------------------

export interface GoogleAccount {
  /** "accounts/106123456789012345678" */
  name: string;
  accountName: string;
  type?: string;
  verificationState?: string;
}

export async function listAccounts(accessToken: string): Promise<GoogleAccount[]> {
  const accounts: GoogleAccount[] = [];
  let pageToken: string | undefined;

  do {
    const page = await apiFetch<{ accounts?: GoogleAccount[]; nextPageToken?: string }>(
      accessToken,
      `${ACCOUNT_MGMT_BASE}/accounts`,
      { query: { pageSize: 20, pageToken } },
    );
    accounts.push(...(page.accounts ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return accounts;
}

export interface GoogleLocation {
  /** "locations/12345678901234567890" */
  name: string;
  title: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    regionCode?: string;
  };
  metadata?: { placeId?: string; mapsUri?: string };
}

export async function listLocations(
  accessToken: string,
  accountName: string,
): Promise<GoogleLocation[]> {
  const locations: GoogleLocation[] = [];
  let pageToken: string | undefined;

  do {
    // Business Information API は readMask 必須。要らないフィールドを取らないことが
    // レスポンスサイズとクォータ消費の両方に効く。
    const page = await apiFetch<{ locations?: GoogleLocation[]; nextPageToken?: string }>(
      accessToken,
      `${BUSINESS_INFO_BASE}/${accountName}/locations`,
      {
        query: {
          readMask: 'name,title,storefrontAddress,metadata',
          pageSize: 100,
          pageToken,
        },
      },
    );
    locations.push(...(page.locations ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return locations;
}

export function formatAddress(location: GoogleLocation): string | null {
  const a = location.storefrontAddress;
  if (!a) return null;
  return [...(a.addressLines ?? []), a.locality, a.administrativeArea, a.regionCode]
    .filter(Boolean)
    .join(', ');
}

// -----------------------------------------------------------------------------
// レビュー（レガシー v4）
// -----------------------------------------------------------------------------

export type GoogleStarRating =
  | 'STAR_RATING_UNSPECIFIED'
  | 'ONE'
  | 'TWO'
  | 'THREE'
  | 'FOUR'
  | 'FIVE';

export interface GoogleReview {
  /** "accounts/{aid}/locations/{lid}/reviews/{reviewId}" */
  name: string;
  reviewId: string;
  reviewer?: { profilePhotoUrl?: string; displayName?: string; isAnonymous?: boolean };
  starRating: GoogleStarRating;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

const STAR_TO_NUMBER: Record<GoogleStarRating, number> = {
  STAR_RATING_UNSPECIFIED: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export function starRatingToNumber(rating: GoogleStarRating): number {
  return STAR_TO_NUMBER[rating] ?? 0;
}

/**
 * v4 のレビューリソースパスを組み立てる。
 * accountName: "accounts/111", googleLocationId: "locations/222"
 *   → "accounts/111/locations/222"
 */
export function reviewParentPath(accountName: string, googleLocationId: string): string {
  const account = accountName.replace(/\/$/, '');
  const location = googleLocationId.startsWith('locations/')
    ? googleLocationId
    : `locations/${googleLocationId}`;
  return `${account}/${location}`;
}

export interface ListReviewsResult {
  reviews: GoogleReview[];
  totalReviewCount: number;
  averageRating: number;
}

/**
 * レビューを新しい順に取得する。
 *
 * @param maxReviews 取得上限。毎時バッチでは全件舐める必要がないので、
 *                   updateTime の降順で上から必要な分だけ取って打ち切る。
 */
export async function listReviews(
  accessToken: string,
  parentPath: string,
  options: { maxReviews?: number } = {},
): Promise<ListReviewsResult> {
  const { maxReviews = 200 } = options;

  const reviews: GoogleReview[] = [];
  let pageToken: string | undefined;
  let totalReviewCount = 0;
  let averageRating = 0;

  do {
    const page = await apiFetch<{
      reviews?: GoogleReview[];
      nextPageToken?: string;
      totalReviewCount?: number;
      averageRating?: number;
    }>(accessToken, `${LEGACY_V4_BASE}/${parentPath}/reviews`, {
      query: {
        pageSize: 50, // v4 の上限
        orderBy: 'updateTime desc',
        pageToken,
      },
    });

    reviews.push(...(page.reviews ?? []));
    totalReviewCount = page.totalReviewCount ?? totalReviewCount;
    averageRating = page.averageRating ?? averageRating;
    pageToken = page.nextPageToken;
  } while (pageToken && reviews.length < maxReviews);

  return { reviews: reviews.slice(0, maxReviews), totalReviewCount, averageRating };
}

/**
 * レビューに返信を投稿する（既存の返信があれば上書き）。
 * PUT .../reviews/{reviewId}/reply
 */
export async function updateReviewReply(
  accessToken: string,
  parentPath: string,
  reviewId: string,
  comment: string,
): Promise<{ comment: string; updateTime: string }> {
  const trimmed = comment.trim();
  if (!trimmed) {
    throw new GoogleApiError('返信本文が空です。', 400);
  }
  if (trimmed.length > REPLY_MAX_LENGTH) {
    throw new GoogleApiError(
      `返信本文が Google の上限 ${REPLY_MAX_LENGTH} 文字を超えています (${trimmed.length} 文字)。`,
      400,
    );
  }

  return apiFetch<{ comment: string; updateTime: string }>(
    accessToken,
    `${LEGACY_V4_BASE}/${parentPath}/reviews/${reviewId}/reply`,
    { method: 'PUT', body: { comment: trimmed } },
  );
}

export async function deleteReviewReply(
  accessToken: string,
  parentPath: string,
  reviewId: string,
): Promise<void> {
  await apiFetch(accessToken, `${LEGACY_V4_BASE}/${parentPath}/reviews/${reviewId}/reply`, {
    method: 'DELETE',
  });
}
