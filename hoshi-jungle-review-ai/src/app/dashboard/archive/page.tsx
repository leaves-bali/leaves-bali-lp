import { ReviewCard } from '@/components/ReviewCard';
import { getReviewQueue } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 返信履歴・アーカイブ。公開済みと「返信しない」判断のものを時系列で表示。 */
export default async function ArchivePage() {
  const session = await getSession();
  if (!session) return null;

  const rows = await getReviewQueue(session.userId, { view: 'archive' });

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-jungle-800">返信履歴</h2>
        <p className="mt-1 text-sm text-jungle-500">
          公開済みの返信と、「返信しない」と判断したクチコミの一覧です。
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-jungle-500">
          まだ履歴がありません。
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ReviewCard key={row.review_id} row={row} readOnly />
          ))}
        </div>
      )}
    </section>
  );
}
