'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { t, UI_LANGUAGES, UI_LANG_LABELS, type UiLang } from '@/lib/i18n';

interface StaffAccessItem {
  staff_access_id: string;
  location_id: string;
  label: string;
  /** null = ホテルの既定言語に従う */
  ui_lang: UiLang | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  rotated_at: string | null;
}

interface LocationOption {
  location_id: string;
  name: string;
}

/**
 * パスコードの発行・再発行・停止。
 *
 * 発行された平文のパスコードは **この画面で一度だけ**表示される。
 * DB にはハッシュしか保存していないため、後から見返すことはできない。
 * この制約をユーザーに明示することが、運用事故（「あとで見ればいい」と閉じてしまう）を防ぐ。
 */
export function StaffAccessManager({
  initialItems,
  locations,
  appUrlHint,
  lang,
}: {
  initialItems: StaffAccessItem[];
  locations: LocationOption[];
  appUrlHint: string;
  lang: UiLang;
}) {
  const d = t(lang);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState('');
  // '' = ホテルの既定言語に従う
  const [newLang, setNewLang] = useState<UiLang | ''>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{
    passcode: string;
    label: string;
    rotated: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const staffUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${appUrlHint}` : appUrlHint;

  async function issue(payload: {
    label?: string;
    staffAccessId?: string;
    locationId?: string;
    uiLang?: UiLang | null;
  }) {
    setBusy(payload.staffAccessId ?? 'new');
    setError(null);
    setCopied(false);
    try {
      const response = await fetch('/api/staff-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? d.issueFailed);
        return;
      }
      setIssued({ passcode: json.passcode, label: json.label, rotated: json.rotated });
      setLabel('');
      setNewLang('');
      startTransition(() => router.refresh());
    } catch {
      setError(d.networkError);
    } finally {
      setBusy(null);
    }
  }

  async function patchItem(
    staffAccessId: string,
    body: { isActive?: boolean; uiLang?: UiLang | null },
  ) {
    setBusy(staffAccessId);
    setError(null);
    try {
      const response = await fetch(`/api/staff-access/${staffAccessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? d.updateFailed);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.staff_access_id === staffAccessId ? { ...i, ...json.item } : i)),
      );
      startTransition(() => router.refresh());
    } catch {
      setError(d.networkError);
    } finally {
      setBusy(null);
    }
  }

  async function copyHandover() {
    const text = [
      d.handoverTitle,
      '',
      `URL:      ${staffUrl}`,
      `passcode: ${issued?.passcode ?? ''}`,
      '',
      d.handoverWarn,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError(d.copyFailed);
    }
  }

  return (
    <div className="space-y-4">
      {/* --- 発行結果（一度だけ表示） --- */}
      {issued ? (
        <div className="card border-emerald-300 bg-emerald-50 p-5">
          <h3 className="text-sm font-semibold text-emerald-900">
            {issued.rotated ? d.rotatedTitle : d.issuedTitle}
            <span className="ml-2 font-normal">（{issued.label}）</span>
          </h3>
          <p className="mt-1 text-xs font-medium text-emerald-800">
            {d.onceOnly}
          </p>

          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs text-emerald-700">{d.staffUrlLabel}</dt>
              <dd className="mt-1 break-all rounded bg-white px-3 py-2 font-mono text-sm text-jungle-800">
                {staffUrl}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-emerald-700">{d.passcode}</dt>
              <dd className="mt-1 rounded bg-white px-3 py-3 text-center font-mono text-2xl tracking-widest text-jungle-900">
                {issued.passcode}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copyHandover} className="btn-primary">
              {copied ? d.copied : d.copyBoth}
            </button>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className="btn-secondary"
            >
              {d.closeNoted}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      {/* --- 新規発行 --- */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-jungle-800">{d.issueNew}</h3>
        <p className="mt-1 text-xs text-jungle-500">
          {d.issueNewHint}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={d.labelPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-jungle-200 px-3 py-2 text-sm
                       outline-none focus:border-jungle-500 focus:ring-1 focus:ring-jungle-500"
          />
          <select
            value={newLang}
            onChange={(e) => setNewLang(e.target.value as UiLang | '')}
            aria-label={d.passcodeLangLabel}
            className="rounded-lg border border-jungle-200 bg-white px-3 py-2 text-sm
                       outline-none focus:border-jungle-500 focus:ring-1 focus:ring-jungle-500"
          >
            <option value="">{d.passcodeLangInherit}</option>
            {UI_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {UI_LANG_LABELS[l]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              issue({
                label,
                locationId: locations[0]?.location_id,
                uiLang: newLang === '' ? null : newLang,
              })
            }
            disabled={busy !== null || locations.length === 0}
            className="btn-primary"
          >
            {busy === 'new' ? d.issuing : d.issue}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-jungle-500">{d.passcodeLangHint}</p>
      </div>

      {/* --- 発行済み一覧 --- */}
      {items.length > 0 ? (
        <div className="card divide-y divide-jungle-100">
          {items.map((item) => (
            <div key={item.staff_access_id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-jungle-800">
                  {item.label}
                  <span
                    className={`badge ml-2 ${
                      item.is_active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-jungle-100 text-jungle-400'
                    }`}
                  >
                    {item.is_active ? d.activeLabel : d.inactiveLabel}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-jungle-400">
                  {d.lastUsed}:{' '}
                  {item.last_used_at
                    ? new Date(item.last_used_at).toLocaleString()
                    : d.unused}
                  {item.rotated_at
                    ? ` · ${d.rotatedAt}: ${new Date(item.rotated_at).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-jungle-500">
                  <span className="sr-only sm:not-sr-only">{d.langColumn}</span>
                  <select
                    value={item.ui_lang ?? ''}
                    onChange={(e) =>
                      patchItem(item.staff_access_id, {
                        uiLang: e.target.value === '' ? null : (e.target.value as UiLang),
                      })
                    }
                    disabled={busy !== null}
                    className="rounded-lg border border-jungle-200 bg-white px-2 py-1.5 text-xs
                               outline-none focus:border-jungle-500 focus:ring-1 focus:ring-jungle-500"
                  >
                    <option value="">{d.passcodeLangInherit}</option>
                    {UI_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {UI_LANG_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => issue({ staffAccessId: item.staff_access_id })}
                  disabled={busy !== null}
                  className="btn-secondary"
                >
                  {d.rotate}
                </button>
                <button
                  type="button"
                  onClick={() => patchItem(item.staff_access_id, { isActive: !item.is_active })}
                  disabled={busy !== null}
                  className="btn-ghost"
                >
                  {item.is_active ? d.pause : d.resume}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-sm text-jungle-500">
          {d.noPasscodes}
        </div>
      )}
    </div>
  );
}
