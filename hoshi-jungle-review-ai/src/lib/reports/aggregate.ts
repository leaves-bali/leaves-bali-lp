import type { ReviewLanguage } from '@/lib/database.types';

/**
 * 月次レポートの「数える部分」。
 *
 * 【なぜ AI を通さないのか】
 * 件数・平均評価・返信率は事実であって、文章ではない。
 * AI に数えさせると、桁を間違えたり、それらしい数字を作ったりする。
 * 営業資料（P.13）で「導入前の1か月と比べてお伝えします」と約束している以上、
 * ここが狂うと約束そのものが嘘になる。
 *
 * この module は DB に触らない純粋な関数だけで構成している。
 * そうすることで、数字の出し方をテストで固定できる。
 */

export interface ReportReviewInput {
  rating: number;
  language: ReviewLanguage;
  /** そのクチコミに実際に返信が出たか（公開済み、または他サイトで貼り戻し済み） */
  replied: boolean;
}

export interface PeriodMetrics {
  reviewCount: number;
  /** 小数第2位まで。クチコミが0件なら null（0.00 と書くと「評価0」に見える） */
  averageRating: number | null;
  /** { ja: 12, en: 3 } の形。0件の言語は載せない */
  byLanguage: Record<string, number>;
  /** 0.0〜1.0。クチコミが0件なら null */
  replyRate: number | null;
}

export function summarizePeriod(reviews: readonly ReportReviewInput[]): PeriodMetrics {
  const byLanguage: Record<string, number> = {};
  let ratingSum = 0;
  let ratingCount = 0;
  let repliedCount = 0;

  for (const review of reviews) {
    byLanguage[review.language] = (byLanguage[review.language] ?? 0) + 1;

    // 星の無いクチコミは平均に入れない（0として混ぜると平均が不当に下がる）
    if (Number.isFinite(review.rating) && review.rating >= 1 && review.rating <= 5) {
      ratingSum += review.rating;
      ratingCount += 1;
    }

    if (review.replied) repliedCount += 1;
  }

  return {
    reviewCount: reviews.length,
    averageRating: ratingCount > 0 ? round(ratingSum / ratingCount, 2) : null,
    byLanguage,
    replyRate: reviews.length > 0 ? round(repliedCount / reviews.length, 3) : null,
  };
}

/**
 * 対象月と、その前の月の期間（UTC）。
 *
 * period は「その月の1日 00:00 UTC」。月末の境界を自前で計算せず、
 * Date に翌月1日を作らせている（うるう年・月末日数のバグを持ち込まないため）。
 */
export interface PeriodRange {
  /** 対象月の1日 00:00 UTC */
  start: Date;
  /** 翌月の1日 00:00 UTC（この時刻は含まない） */
  end: Date;
}

export function monthRange(period: Date): PeriodRange {
  const start = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));
  const end = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1));
  return { start, end };
}

export function previousMonth(period: Date): Date {
  return new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() - 1, 1));
}

/** 「2026-08-01」の形。DB の date 列と画面表示の両方で使う。 */
export function periodKey(period: Date): string {
  const year = period.getUTCFullYear();
  const month = String(period.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/** 実行日から見た「前月」。毎月1日のバッチはこの月を対象にする。 */
export function targetPeriodFor(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// -----------------------------------------------------------------------------
// DB から読んだ行を、上の集計に渡せる形にする部分
// -----------------------------------------------------------------------------

export interface RawReportReview {
  rating: number;
  language: ReviewLanguage;
  text: string | null;
  /** 実際にクチコミが投稿された日時。貼り付け分では未入力のことがある */
  google_create_time: string | null;
  /** このシステムに取り込んだ日時 */
  created_at: string;
  /** 取り込む前から Google 側で返信済みだったか */
  has_google_reply: boolean;
  reply: {
    published_at: string | null;
    /** Google以外のサイトで、スタッフが管理画面に貼り戻した時刻 */
    externally_replied_at: string | null;
  } | null;
}

/**
 * どの月のクチコミとして数えるか。
 *
 * 投稿日が分かるならそれを使う。分からない場合だけ取り込み日で代用する。
 * 取り込み日を優先すると、初回同期の月に過去のクチコミが全部積み上がり、
 * 「今月は120件」のような嘘の数字になる。
 */
export function reviewDate(row: RawReportReview): Date {
  return new Date(row.google_create_time ?? row.created_at);
}

/**
 * 「返信した」の判定。
 *
 * 導入前の月と比べるには、**導入前に人が手で返していた分**も返信済みとして
 * 数える必要がある。それが has_google_reply。
 * これを無視すると「導入前の返信率0%」という、比較として意味のない数字が出る。
 */
export function isReplied(row: RawReportReview): boolean {
  if (row.reply?.published_at) return true;
  if (row.reply?.externally_replied_at) return true;
  return row.has_google_reply;
}

export interface SplitReviews {
  current: RawReportReview[];
  previous: RawReportReview[];
}

/** 対象月と前月に振り分ける。範囲外の行は捨てる。 */
export function splitByPeriod(
  rows: readonly RawReportReview[],
  period: Date,
): SplitReviews {
  const current = monthRange(period);
  const previous = monthRange(previousMonth(period));

  const result: SplitReviews = { current: [], previous: [] };
  for (const row of rows) {
    const at = reviewDate(row).getTime();
    if (Number.isNaN(at)) continue;
    if (at >= current.start.getTime() && at < current.end.getTime()) {
      result.current.push(row);
    } else if (at >= previous.start.getTime() && at < previous.end.getTime()) {
      result.previous.push(row);
    }
  }
  return result;
}

export function toReportReview(row: RawReportReview): ReportReviewInput {
  return { rating: row.rating, language: row.language, replied: isReplied(row) };
}
