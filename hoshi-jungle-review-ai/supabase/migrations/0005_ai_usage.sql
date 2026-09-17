-- =============================================================================
-- AI 使用量の記録と月次予算
-- -----------------------------------------------------------------------------
-- 「無料枠に収める」を運用ルールではなくシステムの保証にするためのテーブル。
--
-- Claude API は従量課金で、Anthropic の新規アカウントに付与される無料クレジットは
-- 有限である。生成のたびに実トークン数と概算コストを記録し、月初からの合計が
-- 予算に達したら生成を停止する。停止してもクチコミの取得は続くため、
-- スタッフは手動で返信を書ける（機能が壊れるのではなく、AI 支援だけが止まる）。
-- =============================================================================

create table if not exists ai_usage (
  ai_usage_id      uuid primary key default gen_random_uuid(),
  location_id      uuid references locations(location_id) on delete cascade,
  review_id        uuid references reviews(review_id) on delete set null,

  model            text not null,
  input_tokens     integer not null default 0,
  output_tokens    integer not null default 0,
  -- 概算コスト(USD)。モデル別の単価表から算出する（src/lib/ai/pricing.ts）
  estimated_cost_usd numeric(12, 6) not null default 0,

  -- 'generate' | 'regenerate'
  purpose          text not null default 'generate',

  created_at       timestamptz not null default now()
);

-- 月次集計を高速に引くためのインデックス
create index if not exists ai_usage_created_idx on ai_usage (created_at desc);
create index if not exists ai_usage_location_created_idx
  on ai_usage (location_id, created_at desc);

alter table ai_usage enable row level security;

drop policy if exists ai_usage_deny_all on ai_usage;
create policy ai_usage_deny_all on ai_usage
  for all to anon, authenticated using (false) with check (false);

-- 当月の使用量サマリ。予算判定とダッシュボード表示の両方がこれを読む。
create or replace view ai_usage_current_month as
select
  location_id,
  count(*)                                as generations,
  coalesce(sum(input_tokens), 0)          as input_tokens,
  coalesce(sum(output_tokens), 0)         as output_tokens,
  coalesce(sum(estimated_cost_usd), 0)    as cost_usd
from ai_usage
where created_at >= date_trunc('month', now() at time zone 'utc')
group by location_id;

alter view ai_usage_current_month set (security_invoker = on);
