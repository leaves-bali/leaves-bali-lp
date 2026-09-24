/**
 * クチコミの出どころ。
 *
 * 【なぜ Google 以外は貼り付けなのか】
 * 完全自動で返信できるのは Google だけ。Agoda・トリップアドバイザー・Trip.com・
 * 食べログは、返信を投稿するための API を外部に公開していない。審査に通れば使える
 * という話ではなく、機能そのものが存在しない。Booking.com と Expedia には API が
 * あるが、認定パートナーに限られ、Booking.com は新規の受付を止めている。
 *
 * さらに食べログは利用規約第 9 条で情報の自動収集を禁じている。
 * したがって Google 以外は「人が貼り付け、AI が返信案を書き、人が貼り戻す」形にする。
 * スクレイピングはしない。規約違反であり、画面変更のたびに壊れる。
 */

export const REVIEW_SOURCES = [
  'google',
  'booking',
  'expedia',
  'agoda',
  'tripadvisor',
  'trip_com',
  'tabelog',
  'other',
] as const;

export type ReviewSource = (typeof REVIEW_SOURCES)[number];

/** 人が貼り付けるサイト（Google 以外）。貼り付けフォームの選択肢になる。 */
export const PASTEABLE_SOURCES: ReviewSource[] = REVIEW_SOURCES.filter(
  (s) => s !== 'google',
) as ReviewSource[];

/** 画面に出す名前。サイト名は翻訳しない（固有名詞のため）。 */
export const SOURCE_LABELS: Record<ReviewSource, string> = {
  google: 'Google',
  booking: 'Booking.com',
  expedia: 'Expedia / Hotels.com',
  agoda: 'Agoda',
  tripadvisor: 'トリップアドバイザー',
  trip_com: 'Trip.com',
  tabelog: '食べログ',
  other: 'その他',
};

export function isReviewSource(value: unknown): value is ReviewSource {
  return typeof value === 'string' && (REVIEW_SOURCES as readonly string[]).includes(value);
}

/**
 * このシステムから直接返信を投稿できるか。
 *
 * Google だけが true。他は公開ボタンを出さず、「コピー」と
 * 「管理画面で返信した」の印に差し替える。押せるのに何も起きないボタンは、
 * 現場では不具合として扱われる。
 */
export function canPublishDirectly(source: ReviewSource): boolean {
  return source === 'google';
}
