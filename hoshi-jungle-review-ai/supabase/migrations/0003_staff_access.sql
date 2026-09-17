-- =============================================================================
-- スタッフ用パスコード認証
-- -----------------------------------------------------------------------------
-- 【設計意図】
-- Google の business.manage スコープは「ビジネスプロフィール全体を管理できる」権限で、
-- 投稿の編集や写真の削除まで技術的に可能になる。フロントスタッフ全員にこの権限を持つ
-- Google アカウントを触らせるのは過剰であり、退職時の権限剥奪も煩雑になる。
--
-- そこで役割を 2 つに分ける:
--   オーナー (owner) … Google OAuth でログイン。連携を 1 回行い、パスコードを発行する
--   スタッフ (staff) … 共通パスコードで入室。クチコミの確認・編集・公開のみ行える
--
-- スタッフの操作は「オーナーが保存した Google トークン」を使ってサーバー側で実行される。
-- スタッフ自身は Google の認証情報に一切触れない。
-- 退職・漏洩時はパスコードを再発行（rotate）するだけで即座に締め出せる。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- staff_access : ロケーション単位のスタッフ用パスコード
--   1 ロケーションに複数発行できる（例: 「フロント用」「マネージャー用」）。
--   片方だけを失効させられるようにするため、1 対多にしている。
-- -----------------------------------------------------------------------------
create table if not exists staff_access (
  staff_access_id uuid primary key default gen_random_uuid(),
  location_id     uuid not null references locations(location_id) on delete cascade,

  label           text not null,                 -- 例: 「フロントデスク用」
  -- scrypt によるハッシュ。形式: scrypt$N$r$p$base64(salt)$base64(hash)
  -- 平文のパスコードはどこにも保存しない（発行直後に画面で 1 度だけ表示する）
  passcode_hash   text not null,

  is_active       boolean not null default true,

  -- ブルートフォース対策は「IP 単位のレート制限 + scrypt のコスト」で行う。
  -- レコード単位のロックは実装していない: パスコードはハッシュ保存のため不一致時に
  -- 「どのレコードが狙われたか」を特定できず、特定できる形にすると
  -- 他人のパスコードを故意にロックする嫌がらせが成立してしまうため。
  last_used_at    timestamptz,
  rotated_at      timestamptz,
  created_by      uuid references users(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists staff_access_location_idx
  on staff_access (location_id) where is_active;

create trigger staff_access_set_updated_at
  before update on staff_access
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- staff_login_attempts : ログイン試行の記録（レート制限と監査）
--   IP はハッシュ化して保存する。生 IP を貯め続ける必要はない。
-- -----------------------------------------------------------------------------
create table if not exists staff_login_attempts (
  attempt_id   uuid primary key default gen_random_uuid(),
  location_id  uuid references locations(location_id) on delete cascade,
  ip_hash      text not null,
  succeeded    boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists staff_login_attempts_ip_idx
  on staff_login_attempts (ip_hash, attempted_at desc);
create index if not exists staff_login_attempts_time_idx
  on staff_login_attempts (attempted_at desc);

-- -----------------------------------------------------------------------------
-- 監査: 誰が公開したか
--   published_by（users FK）はオーナーが公開した場合のみ入る。
--   スタッフが公開した場合はどのパスコード経由かを残す。
-- -----------------------------------------------------------------------------
alter table replies
  add column if not exists published_by_staff_access_id uuid
    references staff_access(staff_access_id) on delete set null;

-- -----------------------------------------------------------------------------
-- RLS（多層防御。アプリは service_role 経由でのみアクセスする）
-- -----------------------------------------------------------------------------
alter table staff_access         enable row level security;
alter table staff_login_attempts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['staff_access','staff_login_attempts'] loop
    execute format('drop policy if exists %I on %I', t || '_deny_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (false) with check (false)',
      t || '_deny_all', t
    );
  end loop;
end $$;
