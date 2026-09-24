-- =============================================================================
-- 月次の改善レポート
-- -----------------------------------------------------------------------------
-- 営業資料（P.7）で見本を見せ、P.13 で「導入前の1か月と比べてお伝えします」と
-- 約束している機能。毎月1日に前月分を店舗ごとに作る。
--
-- 【なぜ保存するのか】
-- 毎回その場で作ると、同じ月のレポートを開くたびに AI 費用がかかり、
-- 文面も揺れる。月次予算の中で確実に収めるため、1 回作って保存する。
--
-- 【report_enabled の店だけ】
-- オプション契約。契約していない店には作らない（AI 費用が無駄になる）。
-- =============================================================================

create table if not exists monthly_reports (
  monthly_report_id uuid primary key default gen_random_uuid(),
  location_id       uuid not null references locations(location_id) on delete cascade,

  -- 対象月の 1 日（UTC）。月を一意に表す値として日付型で持つ。
  period            date not null,

  -- --- 数えて出す部分（AI を通さない。数字は必ず実データから） ---
  review_count        integer not null default 0,
  prev_review_count   integer not null default 0,
  average_rating      numeric(3, 2),
  prev_average_rating numeric(3, 2),
  -- { "ja": 12, "en": 3, ... }
  by_language         jsonb not null default '{}'::jsonb,
  -- 返信した割合（0.0〜1.0）。導入前との比較に使う。
  reply_rate          numeric(4, 3),
  prev_reply_rate     numeric(4, 3),

  -- --- AI がまとめる部分 ---
  -- [{ "topic": "朝食", "count": 7 }] の形。件数は実際のクチコミ数を超えない。
  praised_themes    jsonb not null default '[]'::jsonb,
  complained_themes jsonb not null default '[]'::jsonb,
  -- 来月やること3つ
  next_actions      jsonb not null default '[]'::jsonb,

  -- 生成のメタ情報（モデル・トークン数）。コスト追跡と再現のため。
  model             text,
  generation_meta   jsonb not null default '{}'::jsonb,

  -- メール送信の記録。送信サービスは未定のため、差し込み口だけ用意してある。
  emailed_at        timestamptz,

  created_at        timestamptz not null default now(),

  -- 同じ月を二重に作らない。毎月1日のバッチが再実行されても 1 行に保つ。
  constraint monthly_reports_location_period_key unique (location_id, period)
);

create index if not exists monthly_reports_location_period_idx
  on monthly_reports (location_id, period desc);

alter table monthly_reports enable row level security;
drop policy if exists monthly_reports_deny_all on monthly_reports;
create policy monthly_reports_deny_all on monthly_reports
  for all to anon, authenticated using (false) with check (false);
