import { LanguageTabs } from '@/components/LanguageTabs';
import { PasteReviewForm } from '@/components/PasteReviewForm';
import { ReviewCard } from '@/components/ReviewCard';
import type { ReviewLanguage } from '@/lib/database.types';
import { t } from '@/lib/i18n';
import { getQueueCounts, getReviewQueue } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';
import { loadLocationPlan } from '@/lib/settings/loadLocationPlan';
import { getUserLocations } from '@/lib/reviews/queries';
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

  const [rows, counts, locations] = await Promise.all([
    getReviewQueue(session, { view: 'inbox', language: filter }),
    getQueueCounts(session),
    getUserLocations(session),
  ]);

  // Google以外の貼り付けはオプション契約。契約していない店には出さない。
  const primaryLocation = locations[0];
  const plan = primaryLocation ? await loadLocationPlan(primaryLocation.location_id) : null;

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-jungle-800">{d.inboxTitle}</h2>
        <p className="mt-1 text-sm text-jungle-500">{d.inboxLead}</p>
      </div>

      {plan?.otherSitesEnabled && primaryLocation ? (
        <PasteReviewForm locationId={primaryLocation.location_id} lang={uiLang} />
      ) : null}

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
