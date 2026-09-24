'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { t, type UiLang } from '@/lib/i18n';
import { PASTEABLE_SOURCES, SOURCE_LABELS } from '@/lib/reviews/sources';

/**
 * Google以外のサイトのクチコミを貼り付ける。
 *
 * これらのサイトは返信を投稿する API を外部に公開していない（食べログは規約で
 * 自動収集も禁じている）。取り込みも投稿も自動化できないので、
 * 人が貼って、AI が書いて、人が貼り戻す。
 *
 * 契約していない店には親ページ側で出していない。
 */
export function PasteReviewForm({
  locationId,
  lang,
}: {
  locationId: string;
  lang: UiLang;
}) {
  const d = t(lang);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>(PASTEABLE_SOURCES[0]);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [postedAt, setPostedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const field =
    'w-full rounded-lg border border-jungle-200 px-3 py-2 text-sm outline-none ' +
    'focus:border-jungle-500 focus:ring-1 focus:ring-jungle-500';

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch('/api/reviews/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          source,
          rating,
          text: text.trim(),
          reviewerName: reviewerName.trim() || null,
          postedAt: postedAt || null,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote({ ok: false, text: json.error ?? d.updateFailed });
        return;
      }
      setNote({ ok: true, text: d.pasteDone });
      setText('');
      setReviewerName('');
      setPostedAt('');
      startTransition(() => router.refresh());
    } catch {
      setNote({ ok: false, text: d.networkError });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary mb-4" onClick={() => setOpen(true)}>
        ＋ {d.pasteTitle}
      </button>
    );
  }

  return (
    <div className="card mb-4 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-jungle-800">{d.pasteTitle}</h3>
          <p className="mt-1 text-xs leading-relaxed text-jungle-500">{d.pasteLead}</p>
        </div>
        <button type="button" className="btn-ghost shrink-0" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-jungle-700">{d.pasteSite}</span>
          <select
            className={`mt-1 ${field}`}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {PASTEABLE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-jungle-700">{d.pasteRating}</span>
          <select
            className={`mt-1 ${field}`}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {'★'.repeat(n)}
                {'☆'.repeat(5 - n)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-jungle-700">{d.pasteText}</span>
        <textarea
          className={`mt-1 min-h-[110px] ${field}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder=""
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-jungle-700">
            {d.pasteAuthor}
            <span className="ml-2 font-normal text-jungle-400">{d.pasteOptional}</span>
          </span>
          <input
            className={`mt-1 ${field}`}
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-jungle-700">
            {d.pasteDate}
            <span className="ml-2 font-normal text-jungle-400">{d.pasteOptional}</span>
          </span>
          <input
            type="date"
            className={`mt-1 ${field}`}
            value={postedAt}
            onChange={(e) => setPostedAt(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={submit}
          disabled={busy || !text.trim()}
        >
          {busy ? d.pasteSubmitting : d.pasteSubmit}
        </button>
        {note ? (
          <span className={`text-xs ${note.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {note.text}
          </span>
        ) : null}
      </div>

      {/* 投稿できないことを先に伝える。あとで気づくと「使えない」と受け取られる。 */}
      <p className="mt-3 text-xs leading-relaxed text-amber-800">{d.cannotPublishHere}</p>
    </div>
  );
}
