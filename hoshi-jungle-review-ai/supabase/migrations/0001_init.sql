-- =============================================================================
-- Hoshi Jungle Review AI — 初期スキーマ
-- 対象: Supabase (PostgreSQL 15+)
-- 適用: supabase db push  もしくは  Dashboard → SQL Editor に貼り付け
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUM 定義
-- -----------------------------------------------------------------------------

-- 対応言語。将来 'zh' 'ko' を足す場合は alter type ... add value で追加できる。
do $$ begin
  create type review_language as enum ('ja', 'en', 'id', 'other');
exception when duplicate_object then null; end $$;

-- 返信のライフサイクル。
--   draft     : AI が生成しただけ。人間未確認 → 「承認待ち」リストに出る
--   edited    : 人間が編集して保存済み。未公開 → 「承認待ち」リストに出る
--   published : Google Business Profile に公開済み
--   failed    : 公開を試みて Google API が失敗を返した（再試行可）
--   skipped   : 返信しないと人間が判断した
do $$ begin
  create type reply_status as enum ('draft', 'edited', 'published', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

-- 言語判定の出所。品質検証・しきい値調整のために記録する。
--   script  : 文字種（かな/漢字）による決定的判定
--   tinyld  : 統計的言語判定ライブラリ
--   claude  : tinyld が低信頼だったため Claude の判定を採用
--   manual  : 人間が画面から上書き
do $$ begin
  create type language_source as enum ('script', 'tinyld', 'claude', 'manual');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- updated_at 自動更新トリガ
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- users : Google アカウントでログインしたホテル側ユーザー
-- -----------------------------------------------------------------------------
create table if not exists users (
  user_id            uuid primary key default gen_random_uuid(),
  email              text        not null,
  google_account_id  text        not null,           -- Google の sub クレーム（不変の一意 ID）
  display_name       text,
  picture_url        text,

  -- Google の refresh_token。AES-256-GCM で暗号化して保存する（平文保存は禁止）。
  -- 形式: base64(iv):base64(ciphertext):base64(authTag) — src/lib/crypto.ts 参照
  google_refresh_token_encrypted text,
  google_token_scope text,
  token_revoked_at   timestamptz,                    -- 再認証が必要になった時刻

  last_login_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint users_google_account_id_key unique (google_account_id),
  constraint users_email_key unique (email)
);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- locations : 監視対象の Google ビジネスプロフィール（店舗/ホテル）
-- -----------------------------------------------------------------------------
create table if not exists locations (
  location_id          uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(user_id) on delete cascade,

  -- v4 Reviews API は accounts/{accountId}/locations/{locationId} 形式のパスを要求するため、
  -- account 側の ID も必ず保持する。
  google_account_name  text not null,                -- 例: "accounts/106123456789012345678"
  google_location_id   text not null,                -- 例: "locations/12345678901234567890"

  name                 text not null,                -- 例: "Hoshi Jungle"
  address              text,
  setup_complete       boolean not null default false,

  -- 同期状態
  last_synced_at       timestamptz,
  last_sync_error      text,
  consecutive_failures integer not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- 同じ Google ロケーションを同一ユーザーが二重登録できないようにする
  constraint locations_user_google_location_key unique (user_id, google_location_id)
);

create index if not exists locations_user_id_idx on locations (user_id);
create index if not exists locations_active_idx on locations (setup_complete) where setup_complete;

create trigger locations_set_updated_at
  before update on locations
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- reviews : Google から取得したクチコミ（読み取り専用のミラー）
-- -----------------------------------------------------------------------------
create table if not exists reviews (
  review_id             uuid primary key default gen_random_uuid(),
  location_id           uuid not null references locations(location_id) on delete cascade,

  -- Google 側の一意 ID。再同期時の冪等キー（upsert の衝突対象）。
  google_review_id      text not null,

  reviewer_display_name text,
  reviewer_photo_url    text,
  is_anonymous          boolean not null default false,

  rating                smallint not null,           -- 1..5 に正規化済み
  text                  text,                        -- 星だけで本文なしのクチコミは NULL

  language              review_language not null default 'other',
  language_confidence   real,                        -- 0.0..1.0
  language_source       language_source not null default 'tinyld',

  -- Google 側のタイムスタンプ（DB の created_at とは別物。ソートはこちらを使う）
  google_create_time    timestamptz,
  google_update_time    timestamptz,

  -- Google 上に既に返信が存在するか（他経路で返信された場合の検出用）
  has_google_reply      boolean not null default false,
  google_reply_comment  text,
  google_reply_time     timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint reviews_google_review_id_key unique (google_review_id),
  constraint reviews_rating_range check (rating between 1 and 5)
);

create index if not exists reviews_location_created_idx
  on reviews (location_id, google_create_time desc);
create index if not exists reviews_language_idx on reviews (location_id, language);
create index if not exists reviews_unreplied_idx
  on reviews (location_id, google_create_time desc) where not has_google_reply;

create trigger reviews_set_updated_at
  before update on reviews
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- replies : AI 生成の返信案 + 人間の編集 + 公開状態
-- 1 レビューにつき 1 行（Google 側も 1 レビュー 1 返信のため）
-- -----------------------------------------------------------------------------
create table if not exists replies (
  reply_id            uuid primary key default gen_random_uuid(),
  review_id           uuid not null references reviews(review_id) on delete cascade,

  ai_generated_text   text,
  edited_text         text,                          -- 人間が編集した場合のみ入る

  -- 実際に公開される本文。アプリ側での coalesce 忘れを防ぐため DB で確定させる。
  final_text          text generated always as (coalesce(edited_text, ai_generated_text)) stored,

  status              reply_status not null default 'draft',

  -- 品質管理
  needs_human_attention boolean not null default false,
  attention_reason      text,                        -- 例: "低評価", "インドネシア語", "AI が要確認と判定"

  -- 生成メタデータ（モデル、トークン数、生成理由など。コスト分析と再現に使う）
  model               text,
  generation_meta     jsonb not null default '{}'::jsonb,
  regenerated_count   integer not null default 0,

  -- 公開
  published_at        timestamptz,
  published_by        uuid references users(user_id) on delete set null,
  publish_error       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint replies_review_id_key unique (review_id),
  -- 公開済みなら必ず本文と公開時刻がある
  constraint replies_published_consistency
    check (status <> 'published' or (final_text is not null and published_at is not null))
);

create index if not exists replies_status_idx on replies (status);
create index if not exists replies_attention_idx on replies (needs_human_attention) where needs_human_attention;

create trigger replies_set_updated_at
  before update on replies
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_runs : 毎時バッチの実行記録（障害調査・コスト追跡用）
-- -----------------------------------------------------------------------------
create table if not exists sync_runs (
  sync_run_id       uuid primary key default gen_random_uuid(),
  location_id       uuid references locations(location_id) on delete cascade,
  trigger_source    text not null,                   -- 'cron' | 'manual' | 'onboarding'

  started_at        timestamptz not null default now(),
  finished_at       timestamptz,

  reviews_fetched   integer not null default 0,
  reviews_new       integer not null default 0,
  replies_generated integer not null default 0,
  replies_published integer not null default 0,
  error             text
);

create index if not exists sync_runs_location_started_idx
  on sync_runs (location_id, started_at desc);

-- -----------------------------------------------------------------------------
-- ダッシュボード用ビュー: レビュー + 返信を 1 行にまとめる
-- -----------------------------------------------------------------------------
create or replace view review_queue as
select
  r.review_id,
  r.location_id,
  r.google_review_id,
  r.reviewer_display_name,
  r.rating,
  r.text,
  r.language,
  r.language_confidence,
  r.google_create_time,
  r.has_google_reply,
  p.reply_id,
  p.ai_generated_text,
  p.edited_text,
  p.final_text,
  p.status,
  p.needs_human_attention,
  p.attention_reason,
  p.published_at,
  p.publish_error,
  p.regenerated_count
from reviews r
left join replies p on p.review_id = r.review_id;
