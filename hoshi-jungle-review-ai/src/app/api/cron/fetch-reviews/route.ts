import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { syncLocation, type SyncResult } from '@/lib/reviews/sync';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * 毎時実行される同期バッチ（vercel.json の crons で登録）。
 *
 * 認証: Vercel Cron は Authorization: Bearer $CRON_SECRET を自動で付与する。
 * 公開エンドポイントなので、これが無ければ必ず 401 を返す。
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: locations, error } = await db
    .from('locations')
    .select('location_id, name, consecutive_failures')
    .eq('setup_complete', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<SyncResult & { name: string; skipped?: string }> = [];

  for (const location of locations ?? []) {
    // 連続失敗しているロケーションは毎時叩き続けても直らない（多くは再認証待ち）。
    // 10 回以上失敗したら 1 日 1 回だけ試す運用に落として、API クォータを守る。
    if (location.consecutive_failures >= 10 && new Date().getUTCHours() !== 0) {
      results.push({
        locationId: location.location_id,
        name: location.name,
        reviewsFetched: 0,
        reviewsNew: 0,
        repliesGenerated: 0,
        repliesPublished: 0,
        errors: [],
        skipped: `連続 ${location.consecutive_failures} 回失敗中のため、1日1回のみ再試行します`,
      });
      continue;
    }

    const result = await syncLocation(location.location_id, 'cron');
    results.push({ ...result, name: location.name });
  }

  const summary = results.reduce(
    (acc, r) => ({
      reviewsNew: acc.reviewsNew + r.reviewsNew,
      repliesGenerated: acc.repliesGenerated + r.repliesGenerated,
      repliesPublished: acc.repliesPublished + r.repliesPublished,
      errors: acc.errors + r.errors.length,
    }),
    { reviewsNew: 0, repliesGenerated: 0, repliesPublished: 0, errors: 0 },
  );

  return NextResponse.json({ ranAt: new Date().toISOString(), summary, results });
}
