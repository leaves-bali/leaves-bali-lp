import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';

import {
  LOCATION_PLAN_COLUMNS,
  PlanNotIncludedError,
  resolveLocationPlan,
  type LocationPlan,
  type LocationPlanRow,
} from '@/lib/settings/locationPlan';

/** 契約内容を DB から読む。 */
export async function loadLocationPlan(locationId: string): Promise<LocationPlan> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('locations')
    .select(LOCATION_PLAN_COLUMNS)
    .eq('location_id', locationId)
    .single();

  // 読めなかったときは「契約なし」に倒す。安全側に倒すのが原則。
  if (error || !data) return resolveLocationPlan(null);
  return resolveLocationPlan(data as unknown as LocationPlanRow);
}

/**
 * 契約していなければ例外を投げる。API の入口で使う。
 *
 * 画面側で隠していても、URL を直接叩かれれば API には届く。
 * 契約の判定は必ずサーバー側でも行う。
 */
export async function requireLocationPlan(
  locationId: string,
  feature: keyof LocationPlan,
): Promise<LocationPlan> {
  const plan = await loadLocationPlan(locationId);
  if (!plan[feature]) throw new PlanNotIncludedError(feature);
  return plan;
}
