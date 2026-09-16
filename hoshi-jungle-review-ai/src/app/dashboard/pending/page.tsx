import { LanguageTabs } from '@/components/LanguageTabs';
import { ReviewCard } from '@/components/ReviewCard';
import type { ReviewLanguage } from '@/lib/database.types';
import { getQueueCounts, getReviewQueue } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';

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

  const { lang } = await searchParams;
  const language = normalizeLanguage(lang);

  const [rows, counts] = await Promise.all([
    getReviewQueue(session.userId, { view: 'attention', language }),
    getQueueCounts(session.userId),
  ]);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-jungle-800">要確認リスト</h2>
        <p className="mt-1 text-sm text-jungle-500">
          自動公開の対象外です。低評価・インドネシア語・AI が要確認と判定したクチコミが表示されます。
        </p>
      </div>

      <div className="mb-6">
        <LanguageTabs basePath="/dashboard/pending" active={language} counts={counts.byLanguage} />
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-jungle-500">
          確認が必要なクチコミはありません。
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ReviewCard key={row.review_id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

function normalizeLanguage(value: string | undefined): ReviewLanguage | 'all' {
  const allowed: Array<ReviewLanguage | 'all'> = ['all', 'ja', 'en', 'id', 'other'];
  return allowed.includes(value as ReviewLanguage) ? (value as ReviewLanguage) : 'all';
}
