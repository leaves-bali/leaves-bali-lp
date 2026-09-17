'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * パスコード入力フォーム。
 *
 * 現場ではフロントの共用端末から、紙に書いたコードを見ながら入力する想定。
 *   - 入力中もハイフンを自動で補う（HJ-XXXX-XXXX の形に整形）
 *   - 小文字で打っても通る（サーバー側で正規化）
 *   - 「表示」トグルで打ち間違いを確認できる
 */
export function StaffLoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(value: string) {
    // 英数字だけを拾って HJ-XXXX-XXXX に整形する
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const body = cleaned.startsWith('HJ') ? cleaned.slice(2) : cleaned;
    const parts = [body.slice(0, 4), body.slice(4, 8)].filter(Boolean);
    setPasscode(parts.length ? `HJ-${parts.join('-')}` : cleaned ? 'HJ-' : '');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? 'ログインに失敗しました。');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <label htmlFor="passcode" className="block text-xs font-medium text-jungle-600">
        パスコード
      </label>
      <input
        id="passcode"
        type={reveal ? 'text' : 'password'}
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        value={passcode}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="HJ-XXXX-XXXX"
        className="mt-2 w-full rounded-lg border border-jungle-200 bg-white px-3 py-2.5 text-center
                   font-mono text-lg tracking-widest text-jungle-800 outline-none
                   focus:border-jungle-500 focus:ring-1 focus:ring-jungle-500"
      />

      <button
        type="button"
        onClick={() => setReveal((v) => !v)}
        className="mt-2 text-xs text-jungle-400 hover:text-jungle-600"
      >
        {reveal ? 'パスコードを隠す' : 'パスコードを表示'}
      </button>

      {error ? (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || passcode.length < 6}
        className="btn-primary mt-4 w-full"
      >
        {submitting ? '確認しています…' : '入室する'}
      </button>
    </form>
  );
}
