'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  errors: string[];
}

/** ステップ 2（ロケーション選択）と 3（完了）を担当するクライアントコンポーネント。 */
export function SetupWizard({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [locations, setLocations] = useState<AvailableLocation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/locations');
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setLoadError(json.error ?? 'ロケーションの取得に失敗しました。');
          return;
        }
        setLocations(json.locations);
        if (json.locations.length === 1) {
          setSelected(json.locations[0].googleLocationId);
        }
      } catch {
        if (!cancelled) setLoadError('ネットワークエラーが発生しました。');
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
    try {
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
        setLoadError(json.error ?? '登録に失敗しました。');
        return;
      }
      setSummary(json.sync);
    } catch {
      setLoadError('ネットワークエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  }

  // --- ステップ 3: 完了 ------------------------------------------------------
  if (summary) {
    return (
      <div className="card p-6">
        <p className="text-xs text-jungle-400">ステップ 3 / 3</p>
        <h2 className="mt-1 text-lg font-semibold text-jungle-800">設定が完了しました</h2>
        <dl className="mt-5 grid grid-cols-3 gap-4 text-center">
          <Stat label="取得したクチコミ" value={summary.reviewsFetched} />
          <Stat label="新規" value={summary.reviewsNew} />
          <Stat label="返信案を作成" value={summary.repliesGenerated} />
        </dl>
        {summary.errors.length > 0 ? (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-medium">一部処理でエラーが発生しました:</p>
            <ul className="mt-1 list-disc pl-4">
              {summary.errors.slice(0, 3).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-5 text-sm text-jungle-600">
          以降は毎時自動でクチコミを取得し、返信案を作成します。
          返信案は<strong>ドラフトとして保存</strong>され、公開はスタッフの確認後に行われます。
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="btn-primary mt-5 w-full"
        >
          ダッシュボードへ
        </button>
      </div>
    );
  }

  // --- ステップ 2: ロケーション選択 -----------------------------------------
  return (
    <div className="card p-6">
      <p className="text-xs text-jungle-400">ステップ 2 / 3</p>
      <h2 className="mt-1 text-lg font-semibold text-jungle-800">
        対象のロケーションを選択
      </h2>
      <p className="mt-1 text-xs text-jungle-500">ログイン中: {userEmail}</p>

      {loadError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </div>
      ) : null}

      {locations === null && !loadError ? (
        <p className="mt-6 text-sm text-jungle-500">Google からロケーションを読み込んでいます…</p>
      ) : null}

      {locations && locations.length === 0 ? (
        <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          このアカウントで管理できるロケーションが見つかりませんでした。
          Google ビジネスプロフィールの管理者権限があるアカウントでログインし直してください。
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
                  <span className="badge ml-2 bg-jungle-100 text-jungle-600">登録済み</span>
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
        {submitting ? 'クチコミを取得しています…' : 'このロケーションで設定を完了する'}
      </button>
      {submitting ? (
        <p className="mt-2 text-center text-xs text-jungle-500">
          初回はクチコミの取得と返信案の生成を行うため、1〜2 分かかることがあります。
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
