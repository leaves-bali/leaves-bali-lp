-- =============================================================================
-- セキュリティ強化: トリガ関数の search_path を固定する
-- -----------------------------------------------------------------------------
-- Supabase のセキュリティリンタ (0011_function_search_path_mutable) の指摘対応。
-- search_path が可変のままだと、スキーマを差し替えられた場合に意図しない関数が
-- 呼ばれる余地が残る。空に固定して塞ぐ。
--
-- 本文で使う now() は pg_catalog に属し、search_path が空でも常に解決できるため
-- 動作に影響はない（実 DB でトリガの発火を確認済み）。
-- =============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
