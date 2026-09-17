'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface StaffAccessItem {
  staff_access_id: string;
  location_id: string;
  label: string;
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
}: {
  initialItems: StaffAccessItem[];
  locations: LocationOption[];
  appUrlHint: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState('');
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

  async function issue(payload: { label?: string; staffAccessId?: string; locationId?: string }) {
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
        setError(json.error ?? 'パスコードの発行に失敗しました。');
        return;
      }
      setIssued({ passcode: json.passcode, label: json.label, rotated: json.rotated });
      setLabel('');
      startTransition(() => router.refresh());
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setBusy(null);
    }
  }

  async function setActive(staffAccessId: string, isActive: boolean) {
    setBusy(staffAccessId);
    setError(null);
    try {
      const response = await fetch(`/api/staff-access/${staffAccessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? '更新に失敗しました。');
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.staff_access_id === staffAccessId ? { ...i, ...json.item } : i)),
      );
      startTransition(() => router.refresh());
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setBusy(null);
    }
  }

  async function copyHandover() {
    const text = [
      'Hoshi Jungle Review AI ログイン情報',
      '',
      `URL:       ${staffUrl}`,
      `パスコード: ${issued?.passcode ?? ''}`,
      '',
      '※ このパスコードは他の人に共有しないでください。',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError('コピーできませんでした。手動で控えてください。');
    }
  }

  return (
    <div className="space-y-4">
      {/* --- 発行結果（一度だけ表示） --- */}
      {issued ? (
        <div className="card border-emerald-300 bg-emerald-50 p-5">
          <h3 className="text-sm font-semibold text-emerald-900">
            {issued.rotated ? 'パスコードを再発行しました' : 'パスコードを発行しました'}
            <span className="ml-2 font-normal">（{issued.label}）</span>
          </h3>
          <p className="mt-1 text-xs font-medium text-emerald-800">
            この画面を閉じると二度と表示できません。今すぐ控えてください。
          </p>

          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs text-emerald-700">スタッフが開く URL</dt>
              <dd className="mt-1 break-all rounded bg-white px-3 py-2 font-mono text-sm text-jungle-800">
                {staffUrl}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-emerald-700">パスコード</dt>
              <dd className="mt-1 rounded bg-white px-3 py-3 text-center font-mono text-2xl tracking-widest text-jungle-900">
                {issued.passcode}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copyHandover} className="btn-primary">
              {copied ? 'コピーしました' : 'URL とパスコードをコピー'}
            </button>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className="btn-secondary"
            >
              控えたので閉じる
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      {/* --- 新規発行 --- */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-jungle-800">新しいパスコードを発行</h3>
        <p className="mt-1 text-xs text-jungle-500">
          用途ごとに分けて発行すると、片方だけを停止できます（例: 「フロント用」「マネージャー用」）。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="用途の名前（例: フロントデスク用）"
            className="min-w-0 flex-1 rounded-lg border border-jungle-200 px-3 py-2 text-sm
                       outline-none focus:border-jungle-500 focus:ring-1 focus:ring-jungle-500"
          />
          <button
            type="button"
            onClick={() => issue({ label, locationId: locations[0]?.location_id })}
            disabled={busy !== null || locations.length === 0}
            className="btn-primary"
          >
            {busy === 'new' ? '発行中…' : '発行する'}
          </button>
        </div>
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
                    {item.is_active ? '有効' : '停止中'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-jungle-400">
                  最終利用:{' '}
                  {item.last_used_at
                    ? new Date(item.last_used_at).toLocaleString('ja-JP')
                    : '未使用'}
                  {item.rotated_at
                    ? ` ・ 再発行: ${new Date(item.rotated_at).toLocaleDateString('ja-JP')}`
                    : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => issue({ staffAccessId: item.staff_access_id })}
                  disabled={busy !== null}
                  className="btn-secondary"
                >
                  再発行
                </button>
                <button
                  type="button"
                  onClick={() => setActive(item.staff_access_id, !item.is_active)}
                  disabled={busy !== null}
                  className="btn-ghost"
                >
                  {item.is_active ? '停止' : '再開'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-sm text-jungle-500">
          まだパスコードを発行していません。上のフォームから発行してください。
        </div>
      )}
    </div>
  );
}
