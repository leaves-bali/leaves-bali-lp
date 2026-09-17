-- =============================================================================
-- 返信案を 3 択にする
-- -----------------------------------------------------------------------------
-- 1 件のクチコミに対し、温度感と言い回しを変えた 3 案を生成して保存する。
-- スタッフは「書き直す」のではなく「選ぶ」だけで済むようになる。
--
--   warm     … 丁寧・厚め。気持ちを込めた言い方
--   standard … 標準。丁寧でバランスの取れた基本形
--   concise  … 簡潔。短く、要点だけ
--
-- 3 案は 1 回の API 呼び出しでまとめて生成する（3 回呼ぶより安い）。
-- =============================================================================

alter table replies
  -- [{ style: 'warm'|'standard'|'concise', text: '...' }, ...]
  add column if not exists options jsonb not null default '[]'::jsonb,
  -- 現在 ai_generated_text に入っている案がどれか
  add column if not exists selected_style text;

comment on column replies.options is
  '温度感を変えた返信案の3択。ai_generated_text には選択中の案が入る。';
comment on column replies.selected_style is
  'options のうち ai_generated_text に反映されている style。';

-- ダッシュボードは review_queue しか読まないため、3案をビューにも通す。
-- create or replace view は「末尾への追加」しかできないため、新しい列は最後に置く。
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
  p.regenerated_count,
  p.options,
  p.selected_style
from reviews r
left join replies p on p.review_id = r.review_id;

alter view review_queue set (security_invoker = on);
