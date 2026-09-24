'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { t, UI_LANGUAGES, UI_LANG_LABELS, type UiLang } from '@/lib/i18n';

const COOKIE = 'hj_ui_lang';

/** 手動選択の保持時間。src/lib/uiLang.ts の UI_LANG_OVERRIDE_MAX_AGE_SECONDS と合わせること。 */
const MAX_AGE_SECONDS = 30 * 60;

/** 操作のたびに Cookie を書き直すが、毎クリック書くのは無駄なのでこの間隔に間引く。 */
const KEEPALIVE_THROTTLE_MS = 60_000;

function writeCookie(lang: UiLang) {
  document.cookie = `${COOKIE}=${lang}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

function clearCookie() {
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function readCookie(): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
  return hit ? hit.slice(COOKIE.length + 1) : null;
}

/**
 * 画面の表示言語を切り替える。
 *
 * 【共有端末での考え方】
 * フロントの共用 PC を日本人・インドネシア人・アメリカ人のスタッフが回し使いする。
 * 選んだ言語を永続保存すると、前に座っていた人の言語のまま次の人が座ることになり、
 * 「画面が読めない」状態で固まる。そこで手動の選択は **一時的なもの** として扱う。
 *
 *   - 選択は 30 分保持。操作が続いている間は自動で延長されるので作業中に戻ることはない
 *   - 離席して 30 分経つと失効し、ホテルの既定言語（= fallback）へ自動的に戻る
 *   - 恒久的に変えたい場合はオーナーが設定画面で既定言語を変更する
 *
 * fallback が current と違うときだけ「◯◯ に戻ります」と予告する。
 * 何に戻るか分からないまま勝手に切り替わるのが、共有端末で一番嫌われるため。
 */
export function UiLangSwitcher({
  current,
  fallback,
}: {
  current: UiLang;
  /** 一時的な選択が失効したときに戻る言語。省略時は予告を出さない。 */
  fallback?: UiLang;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [temporary, setTemporary] = useState(false);

  const lastWriteRef = useRef(0);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Cookie を書き直し、失効タイマーを張り直す。 */
  const refreshOverride = useCallback(
    (lang: UiLang) => {
      writeCookie(lang);
      lastWriteRef.current = Date.now();

      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = setTimeout(() => {
        // Cookie は既に失効しているが、開きっぱなしの画面は古い言語のまま残る。
        // 次に座る人のために、こちらから既定言語へ戻す。
        clearCookie();
        setTemporary(false);
        startTransition(() => router.refresh());
      }, MAX_AGE_SECONDS * 1000);
    },
    [router],
  );

  // 初回マウント時、既に手動選択が残っているかを見る（別タブで選んだ場合など）
  useEffect(() => {
    if (readCookie()) {
      setTemporary(true);
      refreshOverride(current);
    }
    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
    // current が変わるのは画面が再描画されたときで、そのときは下の効果で張り直される
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 操作があるかぎり延長する。作業中に言語が戻ってしまうのを防ぐ。
  useEffect(() => {
    if (!temporary) return;

    function onActivity() {
      if (Date.now() - lastWriteRef.current < KEEPALIVE_THROTTLE_MS) return;
      refreshOverride(current);
    }

    const events = ['pointerdown', 'keydown'] as const;
    for (const type of events) window.addEventListener(type, onActivity, { passive: true });
    return () => {
      for (const type of events) window.removeEventListener(type, onActivity);
    };
  }, [temporary, current, refreshOverride]);

  function choose(lang: UiLang) {
    if (lang === current) return;
    refreshOverride(lang);
    setTemporary(true);
    startTransition(() => router.refresh());
  }

  const showHint = temporary && fallback !== undefined && fallback !== current;

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <div
        className="inline-flex overflow-hidden rounded-full border border-ink-200 bg-white"
        role="group"
        aria-label="Display language"
      >
        {UI_LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => choose(lang)}
            disabled={isPending}
            aria-pressed={lang === current}
            className={[
              // 共用端末はタッチ操作も多い。指で押せる大きさを確保する。
              'px-3 py-1.5 text-xs font-medium transition',
              lang === current
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:bg-brand-50',
            ].join(' ')}
          >
            {UI_LANG_LABELS[lang]}
          </button>
        ))}
      </div>

      {showHint ? (
        <p className="text-[10px] leading-tight text-ink-400">
          {t(current).langRevertHint(UI_LANG_LABELS[fallback], MAX_AGE_SECONDS / 60)}
        </p>
      ) : null}
    </div>
  );
}
