'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { StarRating } from '@/components/StarRating';
import {
  LANGUAGE_LABELS,
  REPLY_MAX_LENGTH,
  REPLY_RECOMMENDED_LENGTH,
  REPLY_STYLE_ORDER,
  STATUS_STYLES,
} from '@/lib/constants';
import type { ReplyStatus, ReviewQueueRow } from '@/lib/database.types';
import { canPublishDirectly, SOURCE_LABELS } from '@/lib/reviews/sources';
import { attentionText, t, type UiLang } from '@/lib/i18n';

/**
 * 1 件のクチコミと、その AI 返信案を扱うカード。
 *
 * UI 上の原則:
 *  - 返信案は必ず編集可能な状態で表示する（読み取り専用にすると、直したい人が別画面を探す）
 *  - 公開ボタンは「今まさに公開される文面」を対象にする。編集中の未保存テキストで公開する
 *    ことは許さず、保存 → 公開の順を強制して事故を防ぐ
 */
export function ReviewCard({
  row,
  lang,
  readOnly = false,
}: {
  row: ReviewQueueRow;
  lang: UiLang;
  readOnly?: boolean;
}) {
  const d = t(lang);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const initialText = row.final_text ?? '';
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [options, setOptions] = useState(row.options ?? []);
  const [style, setStyle] = useState<string | null>(
    // 人が編集済みならどの案でもないので、選択状態にしない
    row.edited_text ? null : (row.selected_style ?? null),
  );
  const [status, setStatus] = useState<ReplyStatus | null>(row.status);
  const [busy, setBusy] = useState<
    null | 'save' | 'publish' | 'regenerate' | 'skip' | 'copy' | 'mark'
  >(null);
  const [markedAt, setMarkedAt] = useState<string | null>(row.externally_replied_at);

  // Google だけがこのシステムから投稿できる。他サイトは API が無く、
  // 押しても何も起きないボタンを出すと「公開したつもり」の事故になる。
  const canPublish = canPublishDirectly(row.source);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const styleLabel = (key: string) =>
    key === 'warm' ? d.styleWarm : key === 'concise' ? d.styleConcise : d.styleStandard;
  const styleHint = (key: string) =>
    key === 'warm' ? d.styleWarmHint : key === 'concise' ? d.styleConciseHint : d.styleStandardHint;

  const isDirty = text !== savedText;
  // 3案が揃っていて、まだ公開していないときだけ切り替えを出す
  const showPicker =
    options.length > 1 && status !== 'published' && status !== 'skipped' && !readOnly;

  /** 別の案に切り替える。編集済みの内容を黙って捨てないよう確認する。 */
  function pickStyle(key: string) {
    const option = options.find((o) => o.style === key);
    if (!option || option.text === text) return;
    if (isDirty) {
      const ok = window.confirm(
        d.switchConfirm,
      );
      if (!ok) return;
    }
    setText(option.text);
    setStyle(key);
    setError(null);
    setNotice(null);
  }
  const isPriorityLanguage = row.language === 'id';
  const hasReply = Boolean(row.reply_id);

  async function call(
    action: 'save' | 'publish' | 'regenerate' | 'skip',
    request: () => Promise<Response>,
  ) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const response = await request();
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? d.networkError);
        return null;
      }
      startTransition(() => router.refresh());
      return json;
    } catch {
      setError(d.networkError);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    const json = await call('save', () =>
      fetch(`/api/replies/${row.reply_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedText: text, selectedStyle: style }),
      }),
    );
    if (json) {
      setSavedText(text);
      setStatus('edited');
      setNotice(d.savedNotice);
    }
  }

  async function handlePublish() {
    if (isDirty) {
      setError(d.saveFirst);
      return;
    }
    const json = await call('publish', () =>
      fetch(`/api/replies/${row.reply_id}/publish`, { method: 'POST' }),
    );
    if (json) {
      setStatus('published');
      setNotice(d.publishedNotice);
    }
  }

  async function handleRegenerate() {
    const json = await call('regenerate', () =>
      fetch(`/api/replies/${row.reply_id}/regenerate`, { method: 'POST' }),
    );
    if (json?.reply) {
      const next = json.reply.final_text ?? json.reply.ai_generated_text ?? '';
      setText(next);
      setSavedText(next);
      setOptions(json.reply.options ?? []);
      setStyle(json.reply.selected_style ?? null);
      setStatus('draft');
      setNotice(d.regeneratedNotice);
    }
  }

  /** 各サイトの管理画面に貼るため、返信本文をクリップボードに写す。 */
  async function handleCopy() {
    setBusy('copy');
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setNotice(d.copiedNotice);
    } catch {
      setError(d.copyFailed);
    } finally {
      setTimeout(() => setBusy(null), 900);
    }
  }

  /**
   * 「管理画面で返信した」の印を付ける。
   * 押した記録であって、投稿されたことの保証ではない（各サイトを読めないため）。
   */
  async function handleMarkReplied() {
    setBusy('mark');
    setError(null);
    try {
      const response = await fetch(`/api/replies/${row.reply_id}/mark-replied`, {
        method: 'POST',
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error ?? d.updateFailed);
        return;
      }
      setMarkedAt(new Date().toISOString());
      setNotice(d.markedRepliedNotice);
      startTransition(() => router.refresh());
    } catch {
      setError(d.networkError);
    } finally {
      setBusy(null);
    }
  }

  async function handleSkip() {
    const json = await call('skip', () =>
      fetch(`/api/replies/${row.reply_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' }),
      }),
    );
    if (json) {
      setStatus('skipped');
      setNotice(d.skippedNotice);
    }
  }

  return (
    <article
      className={`card overflow-hidden ${
        isPriorityLanguage ? 'border-l-4 border-l-amber-500' : ''
      }`}
    >
      {/* --- クチコミ本体 --- */}
      <header className="border-b border-ink-100 bg-ink-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StarRating rating={row.rating} />
          <span className="text-sm font-medium text-brand-700">
            {row.reviewer_display_name ?? d.anonymous}
          </span>
          <span
            className={`badge ${
              isPriorityLanguage ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-ink-600'
            }`}
          >
            {row.language === 'other' ? d.reviewLang.other : LANGUAGE_LABELS[row.language]}
          </span>
          {/* Google以外は、どのサイトのクチコミかが分からないと貼り戻す先が分からない。
              Google は既定なので表示しない（全件に同じ印が付くと情報にならない）。 */}
          {canPublish ? null : (
            <span className="badge bg-ink-100 text-ink-700">{SOURCE_LABELS[row.source]}</span>
          )}
          {status ? (
            <span className={`badge ${STATUS_STYLES[status]}`}>{d.status[status]}</span>
          ) : (
            <span className="badge bg-brand-50 text-ink-400">{d.noReplyYet}</span>
          )}
          {row.google_create_time ? (
            <time className="ml-auto text-xs text-ink-400">
              {new Date(row.google_create_time).toLocaleDateString()}
            </time>
          ) : null}
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
          {row.text?.trim() || <span className="italic text-ink-400">{d.noReviewText}</span>}
        </p>
      </header>

      {/* --- 要確認アラート --- */}
      {row.needs_human_attention ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-900">
          <span className="font-semibold">{d.needsCheck}: </span>
          {/* 理由は言語非依存のコードで保存されているので、画面の言語に翻訳して出す */}
          {(row.attention_codes ?? []).map((code) => attentionText(lang, code)).join(' / ')}
          {row.attention_reason_i18n?.[lang] ? (
            <span className="block pt-1">{row.attention_reason_i18n[lang]}</span>
          ) : null}
        </div>
      ) : null}

      {/* --- 返信案 --- */}
      <div className="px-5 py-4">
        {!hasReply ? (
          <p className="text-sm text-ink-500">{d.noReplyYet}</p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor={`reply-${row.reply_id}`}
                className="text-xs font-medium text-ink-600"
              >
                {status === 'published'
                  ? d.replyPublished
                  : style === null
                    ? d.replyEdited
                    : d.replyDraft}
                {row.regenerated_count ? (
                  <span className="ml-1 text-ink-400">· {row.regenerated_count}×</span>
                ) : null}
              </label>
              <span
                className={`text-xs ${
                  text.length > REPLY_MAX_LENGTH
                    ? 'font-medium text-brand-600'
                    : text.length > REPLY_RECOMMENDED_LENGTH
                      ? 'text-amber-600'
                      : 'text-ink-400'
                }`}
              >
                {text.length} / {REPLY_MAX_LENGTH}
              </span>
            </div>

            {showPicker ? (
              <div className="mb-2.5 flex flex-wrap gap-1.5" role="group" aria-label={d.pickStyle}>
                {REPLY_STYLE_ORDER.filter((k) =>
                  options.some((o) => o.style === k),
                ).map((key) => {
                  const active = style === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickStyle(key)}
                      title={styleHint(key)}
                      aria-pressed={active}
                      className={[
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        active
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-ink-200 bg-white text-ink-600 hover:bg-brand-50',
                      ].join(' ')}
                    >
                      {styleLabel(key)}
                    </button>
                  );
                })}
                <span className="self-center pl-1 text-[11px] text-ink-400">
                  {style ? styleHint(style) : d.edited}
                </span>
              </div>
            ) : null}

            <textarea
              id={`reply-${row.reply_id}`}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setStyle(null); // 手を入れた時点でどの案でもなくなる
              }}
              readOnly={readOnly || status === 'published'}
              rows={6}
              className="w-full resize-y rounded-lg border border-ink-200 bg-white p-3 text-sm leading-relaxed
                         text-brand-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500
                         read-only:bg-ink-50 read-only:text-ink-600"
            />

            {row.publish_error ? (
              <p className="mt-2 rounded bg-brand-50 px-3 py-2 text-xs text-brand-800">
                {d.publishFailed}: {row.publish_error}
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 rounded bg-brand-50 px-3 py-2 text-xs text-brand-800">{error}</p>
            ) : null}
            {notice ? (
              <p className="mt-2 rounded bg-ink-50 px-3 py-2 text-xs text-ink-800">
                {notice}
              </p>
            ) : null}

            {!readOnly && status !== 'published' && status !== 'skipped' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canPublish ? (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={busy !== null || isDirty || text.trim().length === 0}
                    className="btn-primary"
                    title={isDirty ? d.saveFirst : d.publish}
                  >
                    {busy === 'publish' ? d.publishing : d.publish}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={busy !== null || text.trim().length === 0}
                      className="btn-primary"
                    >
                      {busy === 'copy' ? d.copied : d.copyReply}
                    </button>
                    <button
                      type="button"
                      onClick={handleMarkReplied}
                      disabled={busy !== null || markedAt !== null}
                      className="btn-secondary"
                      title={d.markRepliedHint}
                    >
                      {markedAt ? d.markedReplied : d.markReplied}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy !== null || !isDirty}
                  className="btn-secondary"
                >
                  {busy === 'save' ? d.saving : d.saveDraft}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={busy !== null}
                  className="btn-ghost"
                >
                  {busy === 'regenerate' ? d.regenerating : d.regenerate}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={busy !== null}
                  className="btn-ghost ml-auto text-ink-400"
                >
                  {d.skip}
                </button>
              </div>
            ) : null}

            {status === 'published' && row.published_at ? (
              <p className="mt-3 text-xs text-ink-500">
                {d.publishedAt}: {new Date(row.published_at).toLocaleString()}
              </p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
