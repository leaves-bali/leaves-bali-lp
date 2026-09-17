import { ReviewCard } from '@/components/ReviewCard';
import { t } from '@/lib/i18n';
import { getReviewQueue } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';
import { getUiLang } from '@/lib/uiLang';

export const dynamic = 'force-dynamic';

/** 返信履歴・アーカイブ。公開済みと「返信しない」判断のものを時系列で表示。 */
export default async function ArchivePage() {
  const session = await getSession();
  if (!session) return null;

  const uiLang = await getUiLang();
  const d = t(uiLang);
  const rows = await getReviewQueue(session, { view: 'archive' });

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-jungle-800">{d.archiveTitle}</h2>
        <p className="mt-1 text-sm text-jungle-500">{d.archiveLead}</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-jungle-500">{d.emptyArchive}</div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ReviewCard key={row.review_id} row={row} lang={uiLang} readOnly />
          ))}
        </div>
      )}
    </section>
  );
}
