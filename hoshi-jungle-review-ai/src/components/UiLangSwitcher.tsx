'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { UI_LANGUAGES, UI_LANG_LABELS, type UiLang } from '@/lib/i18n';

/**
 * 画面の表示言語を切り替える。
 *
 * 日本人・インドネシア人・アメリカ人のスタッフが同じ端末を共有することもあるため、
 * 常に画面上部に置き、ログインしていなくても切り替えられるようにしている。
 */
export function UiLangSwitcher({ current }: { current: UiLang }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(lang: UiLang) {
    if (lang === current) return;
    // 1年保持。共用端末で毎回選び直さずに済む
    document.cookie = `hj_ui_lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex overflow-hidden rounded-full border border-jungle-200 bg-white"
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
            'px-2.5 py-1 text-xs font-medium transition',
            lang === current
              ? 'bg-jungle-600 text-white'
              : 'text-jungle-600 hover:bg-jungle-50',
          ].join(' ')}
        >
          {UI_LANG_LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
