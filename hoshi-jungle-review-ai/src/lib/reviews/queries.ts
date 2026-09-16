import 'server-only';

import type { ReviewLanguage, ReviewQueueRow } from '@/lib/database.types';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** ダッシュボード用の読み取りクエリ。 */

export interface LocationSummary {
  location_id: string;
  name: string;
  address: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

export async function getUserLocations(userId: string): Promise<LocationSummary[]> {
  const { data } = await supabaseAdmin()
    .from('locations')
    .select('location_id, name, address, last_synced_at, last_sync_error')
    .eq('user_id', userId)
    .eq('setup_complete', true)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export type QueueView = 'inbox' | 'attention' | 'archive';

export interface QueueFilters {
  view: QueueView;
  language?: ReviewLanguage | 'all';
}

export async function getReviewQueue(
  userId: string,
  filters: QueueFilters,
): Promise<ReviewQueueRow[]> {
  const locations = await getUserLocations(userId);
  if (locations.length === 0) return [];

  const query = supabaseAdmin()
    .from('review_queue')
    .select('*')
    .in(
      'location_id',
      locations.map((l) => l.location_id),
    );

  switch (filters.view) {
    case 'inbox':
      // 未公開かつ対応が必要なもの（スキップ済みは除く）
      query.in('status', ['draft', 'edited', 'failed']);
      break;
    case 'attention':
      query.eq('needs_human_attention', true).in('status', ['draft', 'edited', 'failed']);
      break;
    case 'archive':
      query.in('status', ['published', 'skipped']);
      break;
  }

  if (filters.language && filters.language !== 'all') {
    query.eq('language', filters.language);
  }

  const orderColumn = filters.view === 'archive' ? 'published_at' : 'google_create_time';
  const { data } = await query.order(orderColumn, { ascending: false, nullsFirst: false }).limit(200);

  return data ?? [];
}

export interface QueueCounts {
  inbox: number;
  attention: number;
  archive: number;
  byLanguage: Record<ReviewLanguage, number>;
}

export async function getQueueCounts(userId: string): Promise<QueueCounts> {
  const locations = await getUserLocations(userId);
  const empty: QueueCounts = {
    inbox: 0,
    attention: 0,
    archive: 0,
    byLanguage: { ja: 0, en: 0, id: 0, other: 0 },
  };
  if (locations.length === 0) return empty;

  const locationIds = locations.map((l) => l.location_id);

  // 集計はビュー 1 回の読み取りで済ませる（行数が数百程度のため）。
  const { data } = await supabaseAdmin()
    .from('review_queue')
    .select('status, language, needs_human_attention')
    .in('location_id', locationIds);

  const counts = { ...empty, byLanguage: { ...empty.byLanguage } };

  for (const row of data ?? []) {
    const open = row.status === 'draft' || row.status === 'edited' || row.status === 'failed';
    if (open) {
      counts.inbox += 1;
      counts.byLanguage[row.language] += 1;
      if (row.needs_human_attention) counts.attention += 1;
    } else if (row.status === 'published' || row.status === 'skipped') {
      counts.archive += 1;
    }
  }

  return counts;
}
