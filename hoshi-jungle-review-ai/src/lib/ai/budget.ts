import 'server-only';

import { evaluateBudget, type BudgetState } from '@/lib/ai/pricing';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** 当月の AI 使用量を読み、生成してよいかを判定する。 */

export async function getBudgetState(locationId?: string): Promise<BudgetState> {
  const db = supabaseAdmin();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const query = db
    .from('ai_usage')
    .select('estimated_cost_usd')
    .gte('created_at', monthStart.toISOString());

  if (locationId) query.eq('location_id', locationId);

  const { data } = await query;
  const spent = (data ?? []).reduce(
    (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
    0,
  );

  return evaluateBudget(spent, env.aiMonthlyBudgetUsd, env.anthropicModel);
}

export async function recordUsage(params: {
  locationId: string | null;
  reviewId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  purpose: 'generate' | 'regenerate';
}): Promise<void> {
  await supabaseAdmin().from('ai_usage').insert({
    location_id: params.locationId,
    review_id: params.reviewId,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    estimated_cost_usd: params.estimatedCostUsd,
    purpose: params.purpose,
  });
}
