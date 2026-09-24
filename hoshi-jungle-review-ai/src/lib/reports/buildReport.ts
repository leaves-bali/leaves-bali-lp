import 'server-only';

import { getBudgetState, recordUsage } from '@/lib/ai/budget';
import { estimateCostUsd } from '@/lib/ai/pricing';
import {
  monthRange,
  periodKey,
  previousMonth,
  splitByPeriod,
  summarizePeriod,
  toReportReview,
  type RawReportReview,
} from '@/lib/reports/aggregate';
import { summarizeReviews } from '@/lib/reports/summarize';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { MonthlyReportRow } from '@/lib/database.types';

/**
 * 月次レポートを 1 店舗ぶん作って保存する。
 *
 * 呼び出し元は scripts/monthly-report.ts（毎月1日の GitHub Actions）。
 * Web 側からは呼ばない。AI 呼び出しを含むため Netlify Free の 10 秒には収まらない。
 */

export type BuildReportOutcome =
  | { status: 'created'; report: MonthlyReportRow }
  | { status: 'skipped'; reason: string };

export interface BuildReportOptions {
  /** 既に作ってあっても作り直す（手動での再生成用） */
  force?: boolean;
}

export async function buildMonthlyReport(
  locationId: string,
  period: Date,
  options: BuildReportOptions = {},
): Promise<BuildReportOutcome> {
  const db = supabaseAdmin();
  const key = periodKey(period);

  const { data: location } = await db
    .from('locations')
    .select('location_id, name, report_enabled')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!location) return { status: 'skipped', reason: '店舗が見つかりません' };

  // オプション契約。契約していない店に AI 費用をかけない。
  if (!location.report_enabled) {
    return { status: 'skipped', reason: '月次レポートを契約していません' };
  }

  // 同じ月を二重に作らない。DB にも unique 制約があるが、
  // ここで止めないと AI を呼んでから制約違反で捨てることになる（費用が無駄になる）。
  if (!options.force) {
    const { data: existing } = await db
      .from('monthly_reports')
      .select('monthly_report_id')
      .eq('location_id', locationId)
      .eq('period', key)
      .maybeSingle();
    if (existing) return { status: 'skipped', reason: 'この月のレポートは作成済みです' };
  }

  const rows = await loadReviews(db, locationId, period);
  const split = splitByPeriod(rows, period);

  const current = summarizePeriod(split.current.map(toReportReview));
  const prev = summarizePeriod(split.previous.map(toReportReview));

  // --- AI がまとめる部分 ---------------------------------------------------
  // クチコミが 0 件の月は AI を呼ばない。まとめる材料が無い。
  let summary: Awaited<ReturnType<typeof summarizeReviews>> | null = null;

  if (current.reviewCount > 0) {
    // 返信生成と同じ財布。ここを通さないと月次予算がすり抜ける。
    const budget = await getBudgetState(locationId);
    if (budget.exhausted) {
      return { status: 'skipped', reason: '今月の AI 予算に達しているため作成を見送りました' };
    }

    summary = await summarizeReviews({
      storeName: location.name,
      reviews: split.current.map((row) => ({
        rating: row.rating,
        language: row.language,
        text: row.text,
      })),
    });

    await recordUsage({
      locationId,
      reviewId: null,
      model: summary.meta.model,
      inputTokens: summary.meta.input_tokens,
      outputTokens: summary.meta.output_tokens,
      estimatedCostUsd: estimateCostUsd(
        summary.meta.model,
        summary.meta.input_tokens,
        summary.meta.output_tokens,
      ),
      purpose: 'report',
    });
  }

  const payload = {
    location_id: locationId,
    period: key,
    review_count: current.reviewCount,
    prev_review_count: prev.reviewCount,
    average_rating: current.averageRating,
    prev_average_rating: prev.averageRating,
    by_language: current.byLanguage,
    reply_rate: current.replyRate,
    prev_reply_rate: prev.replyRate,
    praised_themes: summary?.praisedThemes ?? [],
    complained_themes: summary?.complainedThemes ?? [],
    next_actions: summary?.nextActions ?? [],
    model: summary?.meta.model ?? null,
    generation_meta: summary ? { ...summary.meta } : {},
  };

  // 同じ月を作り直せるように upsert。制約 (location_id, period) が効く。
  const { data: saved, error } = await db
    .from('monthly_reports')
    .upsert(payload, { onConflict: 'location_id,period' })
    .select('*')
    .single();

  if (error || !saved) {
    throw new Error(`月次レポートの保存に失敗しました: ${error?.message}`);
  }

  return { status: 'created', report: saved };
}

/**
 * 対象月と前月のクチコミを読む。
 *
 * 投稿日（google_create_time）が入っている行と、入っていない行（貼り付け分の一部）で
 * 見る列が変わるため、2 回に分けて読んでいる。
 * PostgREST の or() に日時を埋め込むとエスケープが必要になり、壊れたときに
 * 気づきにくい。素直な条件を 2 回投げる方が安全。
 */
async function loadReviews(
  db: ReturnType<typeof supabaseAdmin>,
  locationId: string,
  period: Date,
): Promise<RawReportReview[]> {
  const from = monthRange(previousMonth(period)).start.toISOString();
  const to = monthRange(period).end.toISOString();

  // supabase-js は select 文字列**リテラル**から戻り値の型を組み立てる。
  // 変数に切り出すと型が失われるので、同じ文字列を 2 回書いている。
  const byPostedAt = await db
    .from('reviews')
    .select(
      'rating, language, text, google_create_time, created_at, has_google_reply, replies ( published_at, externally_replied_at )',
    )
    .eq('location_id', locationId)
    .gte('google_create_time', from)
    .lt('google_create_time', to);

  if (byPostedAt.error) {
    throw new Error(`クチコミの読み込みに失敗しました: ${byPostedAt.error.message}`);
  }

  const byCreatedAt = await db
    .from('reviews')
    .select(
      'rating, language, text, google_create_time, created_at, has_google_reply, replies ( published_at, externally_replied_at )',
    )
    .eq('location_id', locationId)
    .is('google_create_time', null)
    .gte('created_at', from)
    .lt('created_at', to);

  if (byCreatedAt.error) {
    throw new Error(`クチコミの読み込みに失敗しました: ${byCreatedAt.error.message}`);
  }

  return [...(byPostedAt.data ?? []), ...(byCreatedAt.data ?? [])].map((row) => ({
    rating: row.rating,
    language: row.language,
    text: row.text,
    google_create_time: row.google_create_time,
    created_at: row.created_at,
    has_google_reply: row.has_google_reply,
    // replies は 1 対 1 だが、埋め込み select の戻りは配列になることがある
    reply: normalizeReply(row.replies),
  }));
}

function normalizeReply(
  value: unknown,
): { published_at: string | null; externally_replied_at: string | null } | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  return {
    published_at: (record.published_at as string | null) ?? null,
    externally_replied_at: (record.externally_replied_at as string | null) ?? null,
  };
}
