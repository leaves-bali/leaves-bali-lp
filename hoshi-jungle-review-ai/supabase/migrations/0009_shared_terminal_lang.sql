-- =============================================================================
-- 共有端末での表示言語
-- -----------------------------------------------------------------------------
-- 【解決したい問題】
-- Hoshi Jungle ではフロントの共用 PC 1 台を日本人・インドネシア人・アメリカ人の
-- スタッフが回し使いする。表示言語をブラウザの Cookie に永続保存すると、
-- 前に座っていた人が選んだ言語のまま次の人が座ることになり、
-- 「画面が読めない」状態で固まってしまう。
--
-- 【設計】
-- 表示言語を 2 層に分ける。
--
--   恒久的な既定値（このマイグレーションで追加）
--     locations.default_ui_lang … そのホテルの「標準の言語」。誰も何も選んでいない
--                                 ときに必ずここへ戻る。共有端末の安全弁。
--     staff_access.ui_lang      … パスコードごとの言語。「フロント日本語用」
--                                 「Front Desk EN」のように発行すると、
--                                 ログインした瞬間にその言語で開く。
--                                 null なら locations.default_ui_lang を使う。
--
--   一時的な上書き（アプリ側の Cookie。DB には持たない）
--     いま端末に座っている人が切り替えたもの。30 分のスライド式有効期限を持ち、
--     操作が止まると失効して上の既定値に戻る。
--
-- つまり「その場の切り替えは残らない、既定値は残る」。共有端末はこれが正しい。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ホテル単位の既定言語
-- -----------------------------------------------------------------------------
alter table locations
  add column if not exists default_ui_lang text not null default 'ja';

do $$ begin
  alter table locations
    add constraint locations_default_ui_lang_check
    check (default_ui_lang in ('ja', 'en', 'id'));
exception when duplicate_object then null; end $$;

comment on column locations.default_ui_lang is
  '共有端末が待機状態のときに戻る表示言語。オーナーが設定画面から変更する。';

-- -----------------------------------------------------------------------------
-- パスコード単位の言語
--   null = 指定なし（locations.default_ui_lang に従う）
-- -----------------------------------------------------------------------------
alter table staff_access
  add column if not exists ui_lang text;

do $$ begin
  alter table staff_access
    add constraint staff_access_ui_lang_check
    check (ui_lang is null or ui_lang in ('ja', 'en', 'id'));
exception when duplicate_object then null; end $$;

comment on column staff_access.ui_lang is
  'このパスコードでログインしたときの表示言語。null ならホテルの既定言語を使う。';
