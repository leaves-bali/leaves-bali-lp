import { LanguageTabs } from '@/components/LanguageTabs';
import { ReviewCard } from '@/components/ReviewCard';
import type { ReviewLanguage } from '@/lib/database.types';
import { t } from '@/lib/i18n';
import { getQueueCounts, getReviewQueue } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';
import { getUiLang } from '@/lib/uiLang';

export const dynamic = 'force-dynamic';

/** 未返信レビュー一覧（言語別タブ付き）。 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const uiLang = await getUiLang();
  const d = t(uiLang);

  // searchParams の lang は「クチコミの言語で絞り込む」ためのもの。
  // 画面の表示言語（uiLang）とは別物なので混同しないこと。
  const { lang: filterParam } = await searchParams;
  const filter = normalizeLanguage(filterParam);

  const [rows, counts] = await Promise.all([
    getReviewQueue(session, { view: 'inbox', language: filter }),
    getQueueCounts(session),
  ]);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-jungle-800">{d.inboxTitle}</h2>
        <p className="mt-1 text-sm text-jungle-500">{d.inboxLead}</p>
      </div>

      <div className="mb-6">
        <LanguageTabs
          basePath="/dashboard"
          active={filter}
          counts={counts.byLanguage}
          uiLang={uiLang}
        />
        <p className="mt-2 text-xs text-amber-700">{d.indonesianPriorityNote}</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-jungle-500">{d.emptyInbox}</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ReviewCard key={row.review_id} row={row} lang={uiLang} />
          ))}
        </div>
      )}
    </section>
  );
}

function normalizeLanguage(value: string | undefined): ReviewLanguage | 'all' {
  const allowed: Array<ReviewLanguage | 'all'> = ['all', 'ja', 'en', 'id', 'zh', 'ko', 'other'];
  return allowed.includes(value as ReviewLanguage) ? (value as ReviewLanguage) : 'all';
}
