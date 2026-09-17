import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, HttpError, requireSession, scopedLocationId } from '@/lib/api';
import { syncLocation } from '@/lib/reviews/sync';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
// Vercel Pro 等では長く取れるが、無料ホスティング（Netlify Free = 10秒）でも
// 動くよう、下の TIME_BUDGET_MS で必ず打ち切る。
export const maxDuration = 60;

/**
 * 1 回の呼び出しで使ってよい時間。
 * Netlify Free の関数タイムアウト 10 秒に対し、レスポンス生成の余裕を見て 7 秒。
 */
const TIME_BUDGET_MS = 7_000;

/**
 * ダッシュボードの「今すぐ同期」ボタン。
 * スタッフも実行できるが、対象は自分のロケーションに限定される。
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await request.json().catch(() => ({}))) as { locationId?: string };

    const db = supabaseAdmin();
    const query = db
      .from('locations')
      .select('location_id')
      .eq('user_id', session.userId)
      .eq('setup_complete', true);

    // staff セッションは自分のロケーションに強制的に固定する。
    // リクエストボディの locationId は staff の場合は無視する。
    const forcedLocationId = scopedLocationId(session);
    const targetLocationId = forcedLocationId ?? body.locationId;
    if (targetLocationId) query.eq('location_id', targetLocationId);

    const { data: locations, error } = await query;
    if (error) throw new HttpError(`ロケーションの取得に失敗: ${error.message}`, 500);
    if (!locations || locations.length === 0) {
      throw new HttpError('同期対象のロケーションがありません。', 404);
    }

    // 時間予算で打ち切り、残りがあれば hasMore を返す。
    // 呼び出し側（SyncButton）が hasMore が false になるまで繰り返す。
    const results = [];
    const deadline = Date.now() + TIME_BUDGET_MS;

    for (const location of locations) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        // 時間切れ。残りのロケーションは次の呼び出しで処理する。
        results.push({
          locationId: location.location_id,
          reviewsFetched: 0,
          reviewsNew: 0,
          repliesGenerated: 0,
          repliesPublished: 0,
          hasMore: true,
          budgetExhausted: false,
          errors: [],
        });
        continue;
      }
      results.push(
        await syncLocation(location.location_id, 'manual', { timeBudgetMs: remaining }),
      );
    }

    return NextResponse.json({
      results,
      hasMore: results.some((r) => r.hasMore),
      budgetExhausted: results.some((r) => r.budgetExhausted),
    });
  } catch (err) {
    return await errorResponse(err);
  }
}
