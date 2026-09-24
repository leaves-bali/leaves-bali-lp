/**
 * AI がまとめた話題の後始末。
 *
 * 【なぜ AI の出力をそのまま保存しないのか】
 * レポートは店長が読んで行動を決める資料になる。
 * 「朝食の評判が良い（7件）」と書いてあれば、店長は朝食に投資するかもしれない。
 * その 7 が実際は 1 件だったら、判断ごと間違える。
 *
 * 守らせたいのは次の3つ:
 *  1. 件数が実際のクチコミ数を超えない
 *  2. 1〜2件しか出ていない話題を「傾向」として扱わない
 *  3. 同じ話題が言い換えで二重に並ばない
 *
 * プロンプトでも指示しているが、指示は破られる。ここで最終的に落とす。
 */

export interface ReportTheme {
  topic: string;
  count: number;
}

/** 傾向として扱うのに必要な最低件数。 */
const MIN_COUNT_FOR_TREND = 2;

/**
 * この件数を下回る月は、1件の話題も載せる。
 * クチコミが3件しかない月に「傾向なし」とだけ書いても、店長には何も残らない。
 * 少ない母数であることは画面側に明記する。
 */
const SMALL_SAMPLE_THRESHOLD = 5;

/** 1レポートに載せる話題の上限。多すぎると優先順位が消える。 */
const MAX_THEMES = 5;

export function normalizeThemes(
  raw: readonly { topic?: unknown; count?: unknown }[] | null | undefined,
  reviewCount: number,
): ReportTheme[] {
  if (!Array.isArray(raw)) return [];

  const minCount = reviewCount < SMALL_SAMPLE_THRESHOLD ? 1 : MIN_COUNT_FOR_TREND;
  const seen = new Map<string, ReportTheme>();

  for (const item of raw) {
    const topic = String(item?.topic ?? '').trim();
    if (!topic) continue;

    const parsed = Number(item?.count);
    if (!Number.isFinite(parsed)) continue;

    // 実件数を超える申告は、超えた分を切る（多めに言う方向にだけ効く誤りなので）
    const count = Math.min(Math.floor(parsed), reviewCount);
    if (count < minCount) continue;

    // 言い換えの重複は、表記ゆれを吸収した鍵で潰す
    const key = topic.toLowerCase().replace(/\s+/g, '');
    const existing = seen.get(key);
    if (!existing || existing.count < count) {
      seen.set(key, { topic, count });
    }
  }

  return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, MAX_THEMES);
}

/** 来月やること。3つに満たなければ満たないまま出す（埋めるために一般論を足さない）。 */
export function normalizeActions(raw: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const actions: string[] = [];
  for (const item of raw) {
    const text = String(item ?? '').trim();
    if (!text) continue;
    const key = text.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(text);
    if (actions.length >= 3) break;
  }
  return actions;
}
