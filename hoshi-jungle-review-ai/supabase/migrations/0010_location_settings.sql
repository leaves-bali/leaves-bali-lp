-- =============================================================================
-- 店舗ごとの設定
-- -----------------------------------------------------------------------------
-- 【解決したい問題】
-- 店名・所在地・署名・連絡先・自動公開の条件が環境変数（HOTEL_NAME など）に
-- 入っており、システム全体で 1 組しか持てなかった。この状態では店舗が増えるたびに
-- 別のシステムを立ち上げることになり、複数店舗への販売が成り立たない。
--
-- 【移行方針：既存店の動きを変えない】
-- 追加する列はすべて NULL 可にしてある。NULL は「この店では未設定」を意味し、
-- アプリ側は環境変数の値にフォールバックする。
-- したがって、このマイグレーションを当てただけでは Hoshi Jungle の挙動は
-- 一切変わらない。オーナーが設定画面で値を入れた時点で、その店だけが切り替わる。
--
-- 自動公開の 3 列も同じ理由で NULL 可にしている。boolean を not null default false に
-- すると、環境変数で自動公開を有効にしていた店が移行と同時に無効化されてしまう。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 返信文の内容に関わる設定
-- -----------------------------------------------------------------------------
alter table locations
  add column if not exists area_label      text,
  add column if not exists reply_signature text,
  add column if not exists contact_email   text,
  add column if not exists highlights      text[];

comment on column locations.area_label is
  '返信文で使う所在地の表記（例: 福岡市東区）。Google 由来の address とは別に、簡潔な表記を持たせる。NULL なら環境変数 HOTEL_LOCATION。';
comment on column locations.reply_signature is
  '返信の末尾に置く署名。NULL なら環境変数 HOTEL_SIGNATURE。';
comment on column locations.contact_email is
  '低評価のクチコミで案内してよい連絡先。NULL なら環境変数 HOTEL_CONTACT_EMAIL。空なら具体的なアドレスを書かせない。';
comment on column locations.highlights is
  'お客様に伝えたいお店の魅力（2〜3 個）。AI が触れてよい事実の範囲を定める。ここに無いことは書かせない。';

-- 魅力は増やしすぎるとプロンプトが薄まり、かえって具体性が落ちる。
do $$ begin
  alter table locations
    add constraint locations_highlights_len_check
    check (highlights is null or array_length(highlights, 1) <= 5);
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 自動公開の条件
-- -----------------------------------------------------------------------------
alter table locations
  add column if not exists auto_publish_enabled    boolean,
  add column if not exists auto_publish_min_rating smallint,
  add column if not exists auto_publish_languages  text[];

comment on column locations.auto_publish_enabled is
  '自動公開を使うか。NULL なら環境変数 AUTO_PUBLISH_ENABLED（既定 false）。';
comment on column locations.auto_publish_min_rating is
  '自動公開してよい最低の星の数。NULL なら環境変数 AUTO_PUBLISH_MIN_RATING（既定 4）。';
comment on column locations.auto_publish_languages is
  '自動公開してよい言語。NULL なら環境変数 AUTO_PUBLISH_LANGUAGES。インドネシア語は仕様上ここに入れられない。';

do $$ begin
  alter table locations
    add constraint locations_auto_publish_min_rating_check
    check (auto_publish_min_rating is null or auto_publish_min_rating between 1 and 5);
exception when duplicate_object then null; end $$;

-- インドネシア語の自動公開は仕様上の禁止事項。アプリ側でも弾いているが、
-- 設定画面の不具合や直接の SQL 操作で入り込まないよう DB でも拒否する。
do $$ begin
  alter table locations
    add constraint locations_auto_publish_languages_no_id_check
    check (auto_publish_languages is null or not ('id' = any(auto_publish_languages)));
exception when duplicate_object then null; end $$;

-- 対応していない言語コードが紛れ込むと、自動公開の判定が静かに外れる。
do $$ begin
  alter table locations
    add constraint locations_auto_publish_languages_known_check
    check (
      auto_publish_languages is null
      or auto_publish_languages <@ array['ja', 'en', 'zh', 'ko']::text[]
    );
exception when duplicate_object then null; end $$;
