-- =============================================================================
-- 要確認の理由を「言語非依存のコード」で保存する
-- -----------------------------------------------------------------------------
-- 画面を使うスタッフは日本人・インドネシア人・アメリカ人の3通りいる。
-- 日本語の文言を DB に保存してしまうと、英語話者の画面にも日本語が出てしまう。
-- コードだけを保存し、表示するときに画面の言語へ翻訳する。
--
-- AI が書く自由文の理由だけは翻訳表を持てないため、生成時に3言語ぶん作って保存する。
-- =============================================================================

alter table replies
  add column if not exists attention_codes text[] not null default '{}',
  add column if not exists attention_reason_i18n jsonb not null default '{}'::jsonb;

comment on column replies.attention_codes is
  '要確認の理由コード（low_rating / indonesian / unsupported_language / low_confidence / ai_flagged）。表示時に翻訳する。';
comment on column replies.attention_reason_i18n is
  'AI が書いた要確認理由の3言語版。画面の言語に合わせて出し分ける。';

create or replace view review_queue as
select
  r.review_id, r.location_id, r.google_review_id, r.reviewer_display_name,
  r.rating, r.text, r.language, r.language_confidence, r.google_create_time,
  r.has_google_reply,
  p.reply_id, p.ai_generated_text, p.edited_text, p.final_text, p.status,
  p.needs_human_attention, p.attention_reason, p.published_at, p.publish_error,
  p.regenerated_count, p.options, p.selected_style,
  p.attention_codes, p.attention_reason_i18n
from reviews r
left join replies p on p.review_id = r.review_id;

alter view review_queue set (security_invoker = on);
