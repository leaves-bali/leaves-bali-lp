'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { StarRating } from '@/components/StarRating';
import {
  LANGUAGE_LABELS,
  REPLY_MAX_LENGTH,
  REPLY_RECOMMENDED_LENGTH,
  STATUS_LABELS,
  STATUS_STYLES,
} from '@/lib/constants';
import type { ReplyStatus, ReviewQueueRow } from '@/lib/database.types';

/**
 * 1 件のクチコミと、その AI 返信案を扱うカード。
 *
 * UI 上の原則:
 *  - 返信案は必ず編集可能な状態で表示する（読み取り専用にすると、直したい人が別画面を探す）
 *  - 公開ボタンは「今まさに公開される文面」を対象にする。編集中の未保存テキストで公開する
 *    ことは許さず、保存 → 公開の順を強制して事故を防ぐ
 */
export function ReviewCard({ row, readOnly = false }: { row: ReviewQueueRow; readOnly?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const initialText = row.final_text ?? '';
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [status, setStatus] = useState<ReplyStatus | null>(row.status);
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'regenerate' | 'skip'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isDirty = text !== savedText;
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
        setError(json.error ?? '操作に失敗しました。');
        return null;
      }
      startTransition(() => router.refresh());
      return json;
    } catch {
      setError('ネットワークエラーが発生しました。');
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
        body: JSON.stringify({ editedText: text }),
      }),
    );
    if (json) {
      setSavedText(text);
      setStatus('edited');
      setNotice('下書きを保存しました。');
    }
  }

  async function handlePublish() {
    if (isDirty) {
      setError('先に「保存」を押してから公開してください。');
      return;
    }
    const json = await call('publish', () =>
      fetch(`/api/replies/${row.reply_id}/publish`, { method: 'POST' }),
    );
    if (json) {
      setStatus('published');
      setNotice('Google に公開しました。');
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
      setStatus('draft');
      setNotice('返信案を作り直しました。');
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
      setNotice('このクチコミには返信しない設定にしました。');
    }
  }

  return (
    <article
      className={`card overflow-hidden ${
        isPriorityLanguage ? 'border-l-4 border-l-amber-500' : ''
      }`}
    >
      {/* --- クチコミ本体 --- */}
      <header className="border-b border-jungle-100 bg-sand-50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StarRating rating={row.rating} />
          <span className="text-sm font-medium text-jungle-800">
            {row.reviewer_display_name ?? '匿名'}
          </span>
          <span
            className={`badge ${
              isPriorityLanguage ? 'bg-amber-100 text-amber-800' : 'bg-jungle-100 text-jungle-600'
            }`}
          >
            {LANGUAGE_LABELS[row.language]}
          </span>
          {status ? (
            <span className={`badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
          ) : (
            <span className="badge bg-jungle-50 text-jungle-400">返信案なし</span>
          )}
          {row.google_create_time ? (
            <time className="ml-auto text-xs text-jungle-400">
              {new Date(row.google_create_time).toLocaleDateString('ja-JP')}
            </time>
          ) : null}
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-jungle-700">
          {row.text?.trim() || <span className="italic text-jungle-400">（本文なし・星評価のみ）</span>}
        </p>
      </header>

      {/* --- 要確認アラート --- */}
      {row.needs_human_attention && row.attention_reason ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-900">
          <span className="font-semibold">要確認: </span>
          {row.attention_reason}
        </div>
      ) : null}

      {/* --- 返信案 --- */}
      <div className="px-5 py-4">
        {!hasReply ? (
          <p className="text-sm text-jungle-500">
            返信案がまだありません。次回の同期で自動生成されます。
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor={`reply-${row.reply_id}`}
                className="text-xs font-medium text-jungle-600"
              >
                返信案{row.edited_text ? '（編集済み）' : '（AI生成）'}
                {row.regenerated_count ? (
                  <span className="ml-1 text-jungle-400">・{row.regenerated_count}回再生成</span>
                ) : null}
              </label>
              <span
                className={`text-xs ${
                  text.length > REPLY_MAX_LENGTH
                    ? 'font-medium text-red-600'
                    : text.length > REPLY_RECOMMENDED_LENGTH
                      ? 'text-amber-600'
                      : 'text-jungle-400'
                }`}
              >
                {text.length} / {REPLY_MAX_LENGTH}
              </span>
            </div>

            <textarea
              id={`reply-${row.reply_id}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              readOnly={readOnly || status === 'published'}
              rows={6}
              className="w-full resize-y rounded-lg border border-jungle-200 bg-white p-3 text-sm leading-relaxed
                         text-jungle-800 outline-none focus:border-jungle-500 focus:ring-1 focus:ring-jungle-500
                         read-only:bg-sand-50 read-only:text-jungle-600"
            />

            {row.publish_error ? (
              <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
                前回の公開失敗: {row.publish_error}
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
            ) : null}
            {notice ? (
              <p className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {notice}
              </p>
            ) : null}

            {!readOnly && status !== 'published' && status !== 'skipped' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={busy !== null || isDirty || text.trim().length === 0}
                  className="btn-primary"
                  title={isDirty ? '先に保存してください' : 'Google に公開します'}
                >
                  {busy === 'publish' ? '公開中…' : 'Google に公開'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy !== null || !isDirty}
                  className="btn-secondary"
                >
                  {busy === 'save' ? '保存中…' : '下書きを保存'}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={busy !== null}
                  className="btn-ghost"
                >
                  {busy === 'regenerate' ? '生成中…' : 'AIで作り直す'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={busy !== null}
                  className="btn-ghost ml-auto text-jungle-400"
                >
                  返信しない
                </button>
              </div>
            ) : null}

            {status === 'published' && row.published_at ? (
              <p className="mt-3 text-xs text-jungle-500">
                {new Date(row.published_at).toLocaleString('ja-JP')} に公開済み
              </p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
