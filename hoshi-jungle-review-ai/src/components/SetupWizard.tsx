'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { t, type UiLang } from '@/lib/i18n';

interface AvailableLocation {
  googleAccountName: string;
  accountLabel: string;
  googleLocationId: string;
  name: string;
  address: string | null;
  mapsUri: string | null;
  alreadyRegistered: boolean;
}

interface SyncSummary {
  reviewsFetched: number;
  reviewsNew: number;
  repliesGenerated: number;
  hasMore: boolean;
  budgetExhausted: boolean;
  errors: string[];
}

/**
 * サーバーは 1 回の呼び出しを 7 秒で打ち切る（無料ホスティングの 10 秒制限のため）。
 * 残りがあれば hasMore=true が返るので、false になるまで呼び直す。
 */
const MAX_ROUNDS = 40;

/** ステップ 2（ロケーション選択）と 3（完了）を担当するクライアントコンポーネント。 */
export function SetupWizard({ userEmail, lang }: { userEmail: string; lang: UiLang }) {
  const d = t(lang);
  const router = useRouter();
  const [locations, setLocations] = useState<AvailableLocation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/locations');
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setLoadError(json.error ?? d.locationLoadFailed);
          return;
        }
        setLocations(json.locations);
        if (json.locations.length === 1) {
          setSelected(json.locations[0].googleLocationId);
        }
      } catch {
        if (!cancelled) setLoadError(d.networkError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    const location = locations?.find((l) => l.googleLocationId === selected);
    if (!location) return;

    setSubmitting(true);
    setLoadError(null);
    setProgress(null);
    try {
      // 1 回目: ロケーションを登録し、初回同期を時間予算内で開始する
      const response = await fetch('/api/locations/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleAccountName: location.googleAccountName,
          googleLocationId: location.googleLocationId,
          name: location.name,
          address: location.address,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setLoadError(json.error ?? d.registerFailed);
        return;
      }

      const totals: SyncSummary = { ...json.sync };

      // 2 回目以降: 残りがなくなるまで同期を続ける
      for (let round = 0; round < MAX_ROUNDS && totals.hasMore; round += 1) {
        setProgress(d.syncProgress(totals.reviewsNew, totals.repliesGenerated));
        const next = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const nextJson = await next.json();
        if (!next.ok) break;

        for (const r of nextJson.results ?? []) {
          totals.reviewsNew += r.reviewsNew;
          totals.reviewsFetched = Math.max(totals.reviewsFetched, r.reviewsFetched);
          totals.repliesGenerated += r.repliesGenerated;
          totals.errors.push(...r.errors);
        }
        totals.hasMore = Boolean(nextJson.hasMore);
        totals.budgetExhausted = totals.budgetExhausted || Boolean(nextJson.budgetExhausted);
      }

      setSummary(totals);
    } catch {
      setLoadError(d.networkError);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  // --- ステップ 3: 完了 ------------------------------------------------------
  if (summary) {
    return (
      <div className="card p-6">
        <p className="text-xs text-jungle-400">{d.stepOf(3, 3)}</p>
        <h2 className="mt-1 text-lg font-semibold text-jungle-800">{d.setupDone}</h2>
        <dl className="mt-5 grid grid-cols-3 gap-4 text-center">
          <Stat label={d.statFetched} value={summary.reviewsFetched} />
          <Stat label={d.statNew} value={summary.reviewsNew} />
          <Stat label={d.statGenerated} value={summary.repliesGenerated} />
        </dl>
        {summary.budgetExhausted ? (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            {d.wizardBudgetNote}
          </div>
        ) : null}
        {summary.errors.length > 0 ? (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-medium">{d.someErrors}</p>
            <ul className="mt-1 list-disc pl-4">
              {summary.errors.slice(0, 3).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-5 text-sm text-jungle-600">
          {d.afterSetupNote}
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="btn-primary mt-5 w-full"
        >
          {d.toDashboard}
        </button>
      </div>
    );
  }

  // --- ステップ 2: ロケーション選択 -----------------------------------------
  return (
    <div className="card p-6">
      <p className="text-xs text-jungle-400">{d.stepOf(2, 3)}</p>
      <h2 className="mt-1 text-lg font-semibold text-jungle-800">
        {d.stepSelectLocation}
      </h2>
      <p className="mt-1 text-xs text-jungle-500">{d.loggedInAs}: {userEmail}</p>

      {loadError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </div>
      ) : null}

      {locations === null && !loadError ? (
        <p className="mt-6 text-sm text-jungle-500">{d.loadingLocations}</p>
      ) : null}

      {locations && locations.length === 0 ? (
        <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          {d.noLocations}
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        {(locations ?? []).map((location) => (
          <label
            key={location.googleLocationId}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              selected === location.googleLocationId
                ? 'border-jungle-500 bg-jungle-50'
                : 'border-jungle-100 hover:bg-sand-50'
            }`}
          >
            <input
              type="radio"
              name="location"
              className="mt-1"
              checked={selected === location.googleLocationId}
              onChange={() => setSelected(location.googleLocationId)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-jungle-800">
                {location.name}
                {location.alreadyRegistered ? (
                  <span className="badge ml-2 bg-jungle-100 text-jungle-600">{d.alreadyRegistered}</span>
                ) : null}
              </span>
              {location.address ? (
                <span className="mt-0.5 block text-xs text-jungle-500">{location.address}</span>
              ) : null}
              <span className="mt-0.5 block text-[11px] text-jungle-400">
                {location.accountLabel}
              </span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className="btn-primary mt-6 w-full"
      >
        {submitting ? d.fetchingReviews : d.completeSetup}
      </button>
      {submitting ? (
        <p className="mt-2 text-center text-xs text-jungle-500">
          {progress ?? d.firstSyncNote}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-sand-50 p-3">
      <dt className="text-[11px] text-jungle-500">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-jungle-800">{value}</dd>
    </div>
  );
}
