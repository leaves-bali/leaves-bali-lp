import { notFound } from 'next/navigation';

import { LANGUAGE_LABELS } from '@/lib/constants';
import { t, type UiLang } from '@/lib/i18n';
import { loadMonthlyReports } from '@/lib/reports/loadReports';
import { getUserLocations } from '@/lib/reviews/queries';
import { getSession } from '@/lib/session';
import { loadLocationPlan } from '@/lib/settings/loadLocationPlan';
import { getUiLang } from '@/lib/uiLang';
import type { MonthlyReportRow, ReviewLanguage } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

/**
 * 月次の改善レポート。
 *
 * 数字（件数・平均・返信率・言語別）は実際のクチコミから数えた値。
 * 話題と「来月やること」は AI が書いたもの。
 * どちらがどちらかを画面で明示している。混ざると、AI の推測を事実として
 * 受け取られてしまう。
 */
export default async function ReportPage() {
  const session = await getSession();
  if (!session) return null;

  const uiLang = await getUiLang();
  const d = t(uiLang);

  const locations = await getUserLocations(session);
  const location = locations[0];
  if (!location) return null;

  // 契約していない店には画面ごと存在しないものとして扱う。
  const plan = await loadLocationPlan(location.location_id);
  if (!plan.reportEnabled) notFound();

  const reports = await loadMonthlyReports(location.location_id);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-brand-700">{d.reportTitle}</h2>
        <p className="mt-1 text-sm text-ink-500">{d.reportLead}</p>
      </div>

      {reports.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">{d.reportEmpty}</div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <ReportCard key={report.monthly_report_id} report={report} lang={uiLang} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportCard({ report, lang }: { report: MonthlyReportRow; lang: UiLang }) {
  const d = t(lang);
  const smallSample = report.review_count > 0 && report.review_count < 5;

  return (
    <article className="card p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-lg font-bold text-brand-700">{formatPeriod(report.period, lang)}</h3>
        <span className="text-xs text-ink-400">{d.reportPeriodLabel}</span>
      </header>

      {/* --- 数える部分 ------------------------------------------------ */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label={d.reportReviewCount}
          value={`${report.review_count}${d.reportCountSuffix}`}
          previous={`${d.reportVsPrev}: ${report.prev_review_count}${d.reportCountSuffix}`}
        />
        <Metric
          label={d.reportAverageRating}
          value={report.average_rating === null ? '—' : `★ ${report.average_rating.toFixed(2)}`}
          previous={
            report.prev_average_rating === null
              ? d.reportNoPrev
              : `${d.reportVsPrev}: ★ ${report.prev_average_rating.toFixed(2)}`
          }
        />
        <Metric
          label={d.reportReplyRate}
          value={formatRate(report.reply_rate)}
          previous={
            report.prev_reply_rate === null
              ? d.reportNoPrev
              : `${d.reportVsPrev}: ${formatRate(report.prev_reply_rate)}`
          }
        />
      </div>

      {Object.keys(report.by_language).length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-ink-700">{d.reportByLanguage}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {Object.entries(report.by_language)
              .sort((a, b) => b[1] - a[1])
              .map(([code, count]) => (
                <li key={code} className="badge bg-brand-50 text-ink-600">
                  {/* 「ja: 18」ではお店の人に伝わらない。原語表記の言語名で出す。 */}
                  {LANGUAGE_LABELS[code as ReviewLanguage] ?? code}: {count}
                  {d.reportCountSuffix}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {smallSample ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {d.reportSmallSample}
        </p>
      ) : null}

      {/* --- AI がまとめる部分 ------------------------------------------ */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <ThemeList
          title={d.reportPraised}
          themes={report.praised_themes}
          empty={d.reportNoThemes}
          suffix={d.reportCountSuffix}
        />
        <ThemeList
          title={d.reportComplained}
          themes={report.complained_themes}
          empty={d.reportNoThemes}
          suffix={d.reportCountSuffix}
        />
      </div>

      {report.next_actions.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-brand-700">{d.reportNextActions}</p>
          <ol className="mt-2 space-y-2">
            {report.next_actions.map((action, index) => (
              <li key={index} className="flex gap-2 text-sm leading-relaxed text-ink-700">
                <span className="shrink-0 font-semibold text-ink-400">{index + 1}.</span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <p className="mt-5 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-400">
        {d.reportSourceNote}
      </p>
    </article>
  );
}

function Metric({
  label,
  value,
  previous,
}: {
  label: string;
  value: string;
  previous: string;
}) {
  return (
    <div className="rounded-lg bg-brand-50 px-4 py-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-700">{value}</p>
      <p className="mt-1 text-xs text-ink-400">{previous}</p>
    </div>
  );
}

function ThemeList({
  title,
  themes,
  empty,
  suffix,
}: {
  title: string;
  themes: Array<{ topic: string; count: number }>;
  empty: string;
  suffix: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-brand-700">{title}</p>
      {themes.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-400">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {themes.map((theme) => (
            <li
              key={theme.topic}
              className="flex items-baseline justify-between gap-3 text-sm text-ink-700"
            >
              <span>{theme.topic}</span>
              <span className="shrink-0 text-xs text-ink-400">
                {theme.count}
                {suffix}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 「2026-08-01」を「2026年8月」のように読める形にする。 */
function formatPeriod(period: string, lang: UiLang): string {
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  if (lang === 'ja') return `${year}年${Number(month)}月`;
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString(
    lang === 'id' ? 'id-ID' : 'en-US',
    { year: 'numeric', month: 'long', timeZone: 'UTC' },
  );
}

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${Math.round(rate * 100)}%`;
}
