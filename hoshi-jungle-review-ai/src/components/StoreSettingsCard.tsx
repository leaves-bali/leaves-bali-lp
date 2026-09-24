'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { t, type UiLang } from '@/lib/i18n';
import { AUTO_PUBLISHABLE_LANGUAGES } from '@/lib/settings/locationSettings';

/**
 * お店の設定（オーナー専用）。
 *
 * ここで入れた内容が、そのままAIの書ける範囲になる。
 * 空欄は「未設定」で、環境変数の初期値が使われる。空文字を値として保存すると
 * 署名が消えた返信が出てしまうため、送信時に null へ正規化している。
 *
 * この画面はオーナー専用のページ（/dashboard/settings）にだけ置く。
 * スタッフの合言葉ログインではそのページ自体に入れない。
 */

const LANG_LABEL: Record<string, string> = {
  ja: '日本語',
  en: 'English',
  zh: '中文',
  ko: '한국어',
};

export interface StoreSettingsValue {
  locationId: string;
  name: string;
  areaLabel: string;
  replySignature: string;
  contactEmail: string;
  highlights: string[];
  autoPublishEnabled: boolean;
  autoPublishMinRating: number;
  autoPublishLanguages: string[];
}

export function StoreSettingsCard({
  initial,
  lang,
}: {
  initial: StoreSettingsValue;
  lang: UiLang;
}) {
  const d = t(lang);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [value, setValue] = useState<StoreSettingsValue>(initial);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof StoreSettingsValue>(key: K, v: StoreSettingsValue[K]) {
    setValue((prev) => ({ ...prev, [key]: v }));
    setNote(null);
  }

  function setHighlight(index: number, text: string) {
    setValue((prev) => {
      const next = [...prev.highlights];
      next[index] = text;
      return { ...prev, highlights: next };
    });
    setNote(null);
  }

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const response = await fetch('/api/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: value.locationId,
          name: value.name.trim(),
          // 空欄は null（未設定）として送る。空文字を保存すると初期値に戻らなくなる。
          areaLabel: value.areaLabel.trim() || null,
          replySignature: value.replySignature.trim() || null,
          contactEmail: value.contactEmail.trim() || null,
          highlights: value.highlights.map((h) => h.trim()).filter(Boolean),
          autoPublishEnabled: value.autoPublishEnabled,
          autoPublishMinRating: value.autoPublishMinRating,
          autoPublishLanguages: value.autoPublishLanguages,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote({ ok: false, text: json.error ?? d.saveFailed });
        return;
      }
      setNote({ ok: true, text: d.saved });
      startTransition(() => router.refresh());
    } catch {
      setNote({ ok: false, text: d.networkError });
    } finally {
      setSaving(false);
    }
  }

  const field =
    'w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none ' +
    'focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-brand-700">{d.storeSettingsTitle}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{d.storeSettingsLead}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-ink-700">{d.fieldStoreName}</span>
          <input
            className={`mt-1 ${field}`}
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink-700">
            {d.fieldAreaLabel}
            <span className="ml-2 font-normal text-ink-400">{d.usesDefault}</span>
          </span>
          <input
            className={`mt-1 ${field}`}
            value={value.areaLabel}
            onChange={(e) => set('areaLabel', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink-700">
            {d.fieldSignature}
            <span className="ml-2 font-normal text-ink-400">{d.usesDefault}</span>
          </span>
          <input
            className={`mt-1 ${field}`}
            value={value.replySignature}
            onChange={(e) => set('replySignature', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink-700">
            {d.fieldContactEmail}
            <span className="ml-2 font-normal text-ink-400">{d.usesDefault}</span>
          </span>
          <input
            type="email"
            className={`mt-1 ${field}`}
            value={value.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </label>
      </div>

      {/* --- お店の魅力：AIが触れてよい範囲そのもの --- */}
      <div className="mt-5">
        <span className="text-xs font-medium text-ink-700">{d.fieldHighlights}</span>
        <p className="mt-1 text-xs text-ink-500">{d.highlightsHint}</p>
        <div className="mt-2 space-y-2">
          {value.highlights.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={field}
                value={h}
                onChange={(e) => setHighlight(i, e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() =>
                  set(
                    'highlights',
                    value.highlights.filter((_, idx) => idx !== i),
                  )
                }
              >
                {d.removeHighlight}
              </button>
            </div>
          ))}
        </div>
        {value.highlights.length < 5 ? (
          <button
            type="button"
            className="btn-secondary mt-2"
            onClick={() => set('highlights', [...value.highlights, ''])}
          >
            {d.addHighlight}
          </button>
        ) : null}
      </div>

      {/* --- 自動公開 --- */}
      <div className="mt-6 rounded-lg border border-ink-100 bg-ink-50 p-4">
        <h4 className="text-sm font-semibold text-brand-700">{d.autoPublishTitle}</h4>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">{d.autoPublishLead}</p>

        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={value.autoPublishEnabled}
            onChange={(e) => set('autoPublishEnabled', e.target.checked)}
          />
          {d.autoPublishOn}
        </label>

        {value.autoPublishEnabled ? (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-700">{d.autoPublishMinRating}</span>
              <select
                className={`mt-1 ${field}`}
                value={value.autoPublishMinRating}
                onChange={(e) => set('autoPublishMinRating', Number(e.target.value))}
              >
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-xs font-medium text-ink-700">{d.autoPublishLangs}</span>
              <div className="mt-2 flex flex-wrap gap-3">
                {AUTO_PUBLISHABLE_LANGUAGES.map((l) => (
                  <label key={l} className="flex items-center gap-1.5 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={value.autoPublishLanguages.includes(l)}
                      onChange={(e) =>
                        set(
                          'autoPublishLanguages',
                          e.target.checked
                            ? [...value.autoPublishLanguages, l]
                            : value.autoPublishLanguages.filter((x) => x !== l),
                        )
                      }
                    />
                    {LANG_LABEL[l] ?? l}
                  </label>
                ))}
              </div>
              {/* インドネシア語が選択肢に無い理由を明示する。無いと不具合に見える。 */}
              <p className="mt-2 text-xs text-amber-800">{d.autoPublishIdNote}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? d.saving : d.save}
        </button>
        {note ? (
          <span className={`text-xs ${note.ok ? 'text-ink-700' : 'text-brand-600'}`}>
            {note.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
