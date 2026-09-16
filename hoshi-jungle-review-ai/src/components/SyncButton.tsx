'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** 「今すぐ同期」ボタン。Cron を待たずに手動で取り込みたいとき用。 */
export function SyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await response.json();
      if (!response.ok) {
        setMessage(json.error ?? '同期に失敗しました。');
        return;
      }
      const totals = (json.results as Array<{ reviewsNew: number; repliesGenerated: number }>).reduce(
        (acc, r) => ({
          reviewsNew: acc.reviewsNew + r.reviewsNew,
          repliesGenerated: acc.repliesGenerated + r.repliesGenerated,
        }),
        { reviewsNew: 0, repliesGenerated: 0 },
      );
      setMessage(
        `新規 ${totals.reviewsNew} 件 / 返信案 ${totals.repliesGenerated} 件を作成しました。`,
      );
      startTransition(() => router.refresh());
    } catch {
      setMessage('ネットワークエラーが発生しました。');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-xs text-jungle-600">{message}</span> : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={running || isPending}
        className="btn-secondary"
      >
        {running ? '同期中…' : '今すぐ同期'}
      </button>
    </div>
  );
}
