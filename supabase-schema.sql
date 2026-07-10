-- =====================================================================
-- Leaves Bali 顧客管理ダッシュボード  Supabase スキーマ
-- ---------------------------------------------------------------------
-- Supabase の SQL Editor に貼り付けて実行してください。
-- 実行後、Project Settings > API から「Project URL」と「anon public key」
-- を取得し、dashboard.html の設定画面に入力すると連携が有効になります。
-- =====================================================================

-- 拡張（UUID 生成用）
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 顧客
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  name_kana    text,
  email        text,
  phone        text,
  company      text,
  country      text default '日本',
  status       text not null default 'lead',  -- lead / active / completed / churned
  source       text,                          -- 診断 / 紹介 / 広告 / セミナー 等
  assignee     text,                          -- 担当者
  tags         text[] default '{}',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 案件（サービス進捗パイプライン）
--   1 顧客が複数サービスを並行して進めることを想定
-- ---------------------------------------------------------------------
create table if not exists public.deals (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references public.customers(id) on delete cascade,
  service_type        text not null,          -- asset_report / bank_account / pma / real_estate
  stage               text not null default 'inquiry', -- inquiry / proposal / in_progress / review / completed / lost
  amount              numeric default 0,      -- 売上金額（円）
  expected_close_date date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 対応履歴・メモ
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references public.customers(id) on delete cascade,
  type         text not null default 'note',  -- note / call / email / meeting / line
  body         text not null,
  created_by   text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- タスク
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references public.customers(id) on delete set null,
  title        text not null,
  due_date     date,
  priority     text default 'normal',         -- low / normal / high
  done         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 予定（カレンダー / スケジュール）
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references public.customers(id) on delete set null,
  title        text not null,
  start_at     timestamptz not null,
  end_at       timestamptz,
  kind         text default 'meeting',        -- meeting / call / visit / deadline / other
  location     text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- 便利なインデックス
create index if not exists idx_deals_customer  on public.deals(customer_id);
create index if not exists idx_act_customer    on public.activities(customer_id);
create index if not exists idx_tasks_customer  on public.tasks(customer_id);
create index if not exists idx_events_start    on public.events(start_at);

-- ---------------------------------------------------------------------
-- updated_at 自動更新
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_customers_touch on public.customers;
create trigger trg_customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_deals_touch on public.deals;
create trigger trg_deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security
-- ---------------------------------------------------------------------
-- 下記はログイン済みユーザー全員に読み書きを許可する最小構成です。
-- 本番では自社スタッフのみに絞るなど、要件に応じて調整してください。
-- =====================================================================
alter table public.customers  enable row level security;
alter table public.deals      enable row level security;
alter table public.activities enable row level security;
alter table public.tasks      enable row level security;
alter table public.events     enable row level security;

-- 認証済みユーザーにフルアクセスを許可
do $$
declare t text;
begin
  foreach t in array array['customers','deals','activities','tasks','events'] loop
    execute format('drop policy if exists "auth_all_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "auth_all_%1$s" on public.%1$s
         for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ※ 認証を導入せず anon キーだけで手早く試したい場合は、上記 policy の
--    ロールを authenticated から anon に変更してください（社内限定・検証用途のみ推奨）。
