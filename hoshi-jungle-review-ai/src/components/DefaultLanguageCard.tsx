'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { t, UI_LANGUAGES, UI_LANG_LABELS, type UiLang } from '@/lib/i18n';

/**
 * ホテルの既定表示言語。
 *
 * 共有端末（フロントの共用 PC）が待機状態のときに戻る言語を決める。
 * スタッフがその場で切り替えた言語は 30 分で失効し、必ずここへ戻るため、
 * 「誰も設定しなくても読める画面が出る」状態を保証するのがこの設定の役目。
 */
export function DefaultLanguageCard({
  locationId,
  initial,
  lang,
}: {
  locationId: string;
  initial: UiLang;
  lang: UiLang;
}) {
  const d = t(lang);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<UiLang>(initial);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(next: UiLang) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setNote(null);
    try {
      const response = await fetch('/api/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, defaultUiLang: next }),
      });
      if (!response.ok) {
        setValue(previous); // 保存できていないのに選択済みに見せない
        setNote({ ok: false, text: d.defaultLangFailed });
        return;
      }
      setNote({ ok: true, text: d.defaultLangSaved });
      startTransition(() => router.refresh());
    } catch {
      setValue(previous);
      setNote({ ok: false, text: d.networkError });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-jungle-800">{d.defaultLangTitle}</h3>
      <p className="mt-1 text-xs leading-relaxed text-jungle-500">{d.defaultLangLead}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div
          className="inline-flex overflow-hidden rounded-full border border-jungle-200 bg-white"
          role="group"
          aria-label={d.defaultLangTitle}
        >
          {UI_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => save(l)}
              disabled={saving || l === value}
              aria-pressed={l === value}
              className={[
                'px-3 py-1.5 text-xs font-medium transition',
                l === value ? 'bg-jungle-600 text-white' : 'text-jungle-600 hover:bg-jungle-50',
              ].join(' ')}
            >
              {UI_LANG_LABELS[l]}
            </button>
          ))}
        </div>

        {saving ? <span className="text-xs text-jungle-400">{d.defaultLangSaving}</span> : null}
        {note ? (
          <span className={`text-xs ${note.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {note.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
