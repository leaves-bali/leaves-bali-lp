import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { MonthlyReportRow } from '@/lib/database.types';

/** 画面に出す月次レポート。新しい月から順に返す。 */
export async function loadMonthlyReports(
  locationId: string,
  limit = 12,
): Promise<MonthlyReportRow[]> {
  const { data } = await supabaseAdmin()
    .from('monthly_reports')
    .select('*')
    .eq('location_id', locationId)
    .order('period', { ascending: false })
    .limit(limit);

  return data ?? [];
}
