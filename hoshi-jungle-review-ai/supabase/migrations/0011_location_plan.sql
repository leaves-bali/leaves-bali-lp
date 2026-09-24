-- =============================================================================
-- 店舗ごとの契約内容（オプションの有無）
-- -----------------------------------------------------------------------------
-- 料金は「導入費 ＋ 保守・運用費（必須）＋ オプション」の構成になっている。
-- どのオプションを契約しているかは店によって違うため、店の属性として持つ。
--
-- 【決済は作らない】
-- 請求・決済の仕組みはこのシステムに入れない。契約状態の切り替えは
-- 提供側（Leaves）が直接 SQL で行う。店舗数が二桁になるまでは管理画面を
-- 作る手間に見合わないため。切り替え手順は docs/04-runbook.md にある。
--
-- 【既定を false にした理由】
-- 設定を移した 0010 の列は NULL 可にしたが、こちらは not null default false。
-- 契約は「明示的に有効にするもの」で、未設定と無効を区別する意味がない。
-- 取りこぼして有効になるより、取りこぼして無効になるほうが安全でもある。
-- =============================================================================

alter table locations
  add column if not exists report_enabled      boolean not null default false,
  add column if not exists other_sites_enabled boolean not null default false;

comment on column locations.report_enabled is
  'オプション契約: 月次の改善レポート。false の店にはレポートを作らず、画面にも出さない。';
comment on column locations.other_sites_enabled is
  'オプション契約: Google以外のサイトのクチコミ（貼り付け）。false の店には貼り付け機能を出さない。';

-- 月次レポートの生成対象を毎月1日に引くため、有効な店だけの部分索引を置く。
create index if not exists locations_report_enabled_idx
  on locations (location_id) where report_enabled;
