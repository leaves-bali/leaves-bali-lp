'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface SyncResponse {
  results: Array<{ reviewsNew: number; repliesGenerated: number; errors: string[] }>;
  hasMore: boolean;
  budgetExhausted: boolean;
}

/**
 * 「今すぐ同期」ボタン。
 *
 * サーバー側は 1 回の呼び出しを 7 秒で打ち切り、残りがあれば hasMore を返す
 * （無料ホスティングの 10 秒制限に収めるため）。
 * そのため、このボタンは hasMore が false になるまで繰り返し呼ぶ。
 * 進捗を表示するので、利用者から見れば「1 回押したら最後まで終わる」ように見える。
 */
const MAX_ROUNDS = 40; // 暴走防止。7秒 × 40 = 最大およそ 5 分

export function SyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setMessage(null);
    setProgress(null);

    let totalNew = 0;
    let totalGenerated = 0;
    let budgetExhausted = false;
    const errors: string[] = [];

    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const json = (await response.json()) as SyncResponse & { error?: string };

        if (!response.ok) {
          setMessage(json.error ?? '同期に失敗しました。');
          return;
        }

        for (const r of json.results) {
          totalNew += r.reviewsNew;
          totalGenerated += r.repliesGenerated;
          errors.push(...r.errors);
        }
        budgetExhausted = budgetExhausted || json.budgetExhausted;

        if (!json.hasMore) break;

        setProgress(
          `処理中… 新着 ${totalNew} 件 / 返信案 ${totalGenerated} 件（続きを取得しています）`,
        );
      }

      const parts = [`新着 ${totalNew} 件 / 返信案 ${totalGenerated} 件を作成しました。`];
      if (budgetExhausted) {
        parts.push('今月の AI 生成上限に達したため、以降は手動での返信をお願いします。');
      }
      if (errors.length) parts.push(`（一部エラー: ${errors[0]}）`);
      setMessage(parts.join(' '));

      startTransition(() => router.refresh());
    } catch {
      setMessage('ネットワークエラーが発生しました。');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {progress ? <span className="text-xs text-jungle-500">{progress}</span> : null}
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
