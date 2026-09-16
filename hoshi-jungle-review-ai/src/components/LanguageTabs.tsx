import Link from 'next/link';

import type { ReviewLanguage } from '@/lib/database.types';
import { LANGUAGE_LABELS } from '@/lib/constants';

const TABS: Array<{ key: ReviewLanguage | 'all'; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'ja', label: LANGUAGE_LABELS.ja },
  { key: 'en', label: LANGUAGE_LABELS.en },
  { key: 'id', label: LANGUAGE_LABELS.id },
  { key: 'other', label: LANGUAGE_LABELS.other },
];

/**
 * 言語別タブ。
 * インドネシア語は「優先チェック対象」なので、他と色分けして視線を集める。
 */
export function LanguageTabs({
  basePath,
  active,
  counts,
}: {
  basePath: string;
  active: ReviewLanguage | 'all';
  counts: Record<ReviewLanguage, number>;
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="言語フィルター">
      {TABS.map((tab) => {
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
                  : 'border-jungle-600 bg-jungle-600 text-white'
                : isPriority
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-jungle-200 bg-white text-jungle-700 hover:bg-jungle-50',
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
