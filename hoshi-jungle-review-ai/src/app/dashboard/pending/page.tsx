import { LanguageTabs } from '@/components/LanguageTabs';
import { ReviewCard } from '@/components/ReviewCard';
import type { ReviewLanguage } from '@/lib/database.types';
import { t } from '@/lib/i18n';
import { getQueueCounts, getReviewQueue } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';
import { getUiLang } from '@/lib/uiLang';

export const dynamic = 'force-dynamic';

/**
 * 承認待ち（要確認）リスト。
 * 低評価・インドネシア語・AI が要確認と判定したものがここに集まる。
 */
export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const uiLang = await getUiLang();
  const d = t(uiLang);

  const { lang: filterParam } = await searchParams;
  const filter = normalizeLanguage(filterParam);

  const [rows, counts] = await Promise.all([
    getReviewQueue(session, { view: 'attention', language: filter }),
    getQueueCounts(session),
  ]);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-brand-700">{d.attentionTitle}</h2>
        <p className="mt-1 text-sm text-ink-500">{d.attentionLead}</p>
      </div>

      <div className="mb-6">
        <LanguageTabs
          basePath="/dashboard/pending"
          active={filter}
          counts={counts.byLanguage}
          uiLang={uiLang}
        />
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">{d.emptyAttention}</div>
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
