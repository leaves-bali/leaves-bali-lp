import { LanguageTabs } from '@/components/LanguageTabs';
import { ReviewCard } from '@/components/ReviewCard';
import type { ReviewLanguage } from '@/lib/database.types';
import { getQueueCounts, getReviewQueue } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 未返信レビュー一覧（言語別タブ付き）。 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { lang } = await searchParams;
  const language = normalizeLanguage(lang);

  const [rows, counts] = await Promise.all([
    getReviewQueue(session.userId, { view: 'inbox', language }),
    getQueueCounts(session.userId),
  ]);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-jungle-800">未返信のクチコミ</h2>
        <p className="mt-1 text-sm text-jungle-500">
          AI が作成した返信案です。内容を確認・編集してから公開してください。
        </p>
      </div>

      <div className="mb-6">
        <LanguageTabs basePath="/dashboard" active={language} counts={counts.byLanguage} />
        <p className="mt-2 text-xs text-amber-700">
          Bahasa Indonesia は現地スタッフによる表現確認が必須です（オレンジ表示）。
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-jungle-500">
          未返信のクチコミはありません。
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
