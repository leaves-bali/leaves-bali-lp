import Link from 'next/link';

import { LANGUAGE_LABELS } from '@/lib/constants';
import type { ReviewLanguage } from '@/lib/database.types';
import { t, type UiLang } from '@/lib/i18n';

const TAB_ORDER: ReviewLanguage[] = ['ja', 'en', 'id', 'zh', 'ko', 'other'];

/**
 * クチコミの言語で絞り込むタブ。
 *
 * 言語名は原語表記（日本語 / English / 中文 …）のままにしている。
 * 画面の言語が何であれ、その言語の話者が自分のタブを見つけられるようにするため。
 * インドネシア語は「優先チェック対象」なので、他と色分けして視線を集める。
 */
export function LanguageTabs({
  basePath,
  active,
  counts,
  uiLang,
}: {
  basePath: string;
  active: ReviewLanguage | 'all';
  counts: Record<ReviewLanguage, number>;
  uiLang: UiLang;
}) {
  const d = t(uiLang);
  const tabs: Array<{ key: ReviewLanguage | 'all'; label: string }> = [
    { key: 'all', label: d.allLanguages },
    ...TAB_ORDER.map((key) => ({
      key,
      label: key === 'other' ? d.reviewLang.other : LANGUAGE_LABELS[key],
    })),
  ];

  return (
    <nav className="flex flex-wrap gap-2" aria-label={d.languageFilter}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const count =
          tab.key === 'all'
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : counts[tab.key];
        const isPriority = tab.key === 'id';

        return (
          <Link
            key={tab.key}
            href={tab.key === 'all' ? basePath : `${basePath}?lang=${tab.key}`}
            className={[
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
              isActive
                ? isPriority
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-brand-600 bg-brand-600 text-white'
                : isPriority
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-ink-200 bg-white text-ink-700 hover:bg-brand-50',
            ].join(' ')}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
