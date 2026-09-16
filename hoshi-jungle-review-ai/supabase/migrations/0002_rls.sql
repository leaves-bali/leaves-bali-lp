-- =============================================================================
-- Row Level Security（多層防御）
-- -----------------------------------------------------------------------------
-- 本アプリの DB アクセスは 100% Next.js サーバー側（service_role キー）経由で行う。
-- service_role は RLS をバイパスするため、以下のポリシーはアプリの動作条件ではなく、
-- 「anon / authenticated キーが万一漏れても 1 行も読めない」ことを保証する保険である。
--
-- 将来クライアントから直接 Supabase を叩く設計に変える場合は、
-- auth.uid() ベースの SELECT ポリシーをここに追加する。
-- =============================================================================

alter table users     enable row level security;
alter table locations enable row level security;
alter table reviews   enable row level security;
alter table replies   enable row level security;
alter table sync_runs enable row level security;

-- ポリシーを 1 つも作らない = anon / authenticated からは全拒否。
-- 明示的に「拒否である」ことをコードとして残すため、偽の USING 句を置く。
do $$
declare t text;
begin
  foreach t in array array['users','locations','reviews','replies','sync_runs'] loop
    execute format('drop policy if exists %I on %I', t || '_deny_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (false) with check (false)',
      t || '_deny_all', t
    );
  end loop;
end $$;

-- ビューは作成者権限で動くため、security_invoker を有効にして
-- 参照元テーブルの RLS を継承させる（PostgreSQL 15+）。
alter view review_queue set (security_invoker = on);
