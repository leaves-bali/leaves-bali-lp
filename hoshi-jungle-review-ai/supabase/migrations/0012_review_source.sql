-- =============================================================================
-- クチコミの出どころ（Google以外のサイトへの対応）
-- -----------------------------------------------------------------------------
-- 【なぜ貼り付けなのか】
-- 完全自動で返信できるのは Google だけ。Agoda・トリップアドバイザー・Trip.com・
-- 食べログは、返信を投稿するための API を外部に公開していない。技術的に回避できない。
-- さらに食べログは利用規約第 9 条で情報の自動収集を禁じている。
-- したがって Google 以外は「人が貼り付け、AI が返信案を書き、人が貼り戻す」形にする。
-- スクレイピングはしない。
--
-- 【google_review_id を作り変えていない理由】
-- この列は not null かつ unique で、再同期時の冪等キーとして機能している。
-- 制約を緩めると Google 側の取り込みが壊れかねない。貼り付けたクチコミには
-- 'manual:<uuid>' という内部採番の ID を入れ、制約はそのまま活かす。
-- =============================================================================

alter table reviews
  add column if not exists source text not null default 'google';

comment on column reviews.source is
  'クチコミの出どころ。google は自動取得、それ以外は人が貼り付けたもの。';
comment on column reviews.google_review_id is
  '外部のクチコミID。Google は Google 側のID、貼り付けたものは manual:<uuid> を内部採番する。再同期の冪等キー。';

do $$ begin
  alter table reviews
    add constraint reviews_source_check
    check (source in (
      'google', 'booking', 'expedia', 'agoda',
      'tripadvisor', 'trip_com', 'tabelog', 'other'
    ));
exception when duplicate_object then null; end $$;

-- 画面はサイトごとに絞り込む。既定の google が大半を占めるので、
-- それ以外を引くときだけ効けばよい部分索引にする。
create index if not exists reviews_source_idx
  on reviews (location_id, source) where source <> 'google';

-- -----------------------------------------------------------------------------
-- Google以外の「返信済みの印」
-- -----------------------------------------------------------------------------
-- Google 以外はこのシステムから投稿できない。スタッフが管理画面に貼り戻したことを
-- 記録して、未対応の一覧から外す。replies.status の enum を増やすより、
-- 時刻を 1 列足すほうが既存の判定を壊さない。
alter table replies
  add column if not exists externally_replied_at timestamptz;

comment on column replies.externally_replied_at is
  'Google以外のサイトで、スタッフが管理画面に返信を貼り戻した時刻。押した記録であって、投稿されたことの保証ではない。';

-- -----------------------------------------------------------------------------
-- ダッシュボード用ビューに列を足す
--   create or replace view は列の挿入ができない（末尾への追加のみ）
-- -----------------------------------------------------------------------------
create or replace view review_queue as
select
  r.review_id, r.location_id, r.google_review_id, r.reviewer_display_name,
  r.rating, r.text, r.language, r.language_confidence, r.google_create_time,
  r.has_google_reply,
  p.reply_id, p.ai_generated_text, p.edited_text, p.final_text, p.status,
  p.needs_human_attention, p.attention_reason, p.published_at, p.publish_error,
  p.regenerated_count, p.options, p.selected_style,
  p.attention_codes, p.attention_reason_i18n,
  r.source, p.externally_replied_at
from reviews r
left join replies p on p.review_id = r.review_id;
