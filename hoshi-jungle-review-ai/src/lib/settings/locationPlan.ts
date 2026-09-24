/**
 * 店舗ごとの契約内容（どのオプションを契約しているか）。
 *
 * 営業資料の料金は「導入費 ＋ 保守・運用費（必須）＋ オプション」の構成で、
 * オプションは店によって契約が分かれる。契約していない機能は、画面にも API にも
 * 出してはいけない。「見えるが使えない」は問い合わせを増やすだけで、
 * 売り物としても筋が悪い。
 *
 * 決済・請求はこのシステムに入れない。切り替えは提供側が直接 SQL で行う
 * （手順は docs/04-runbook.md）。
 */

export interface LocationPlan {
  /** 月次の改善レポート */
  reportEnabled: boolean;
  /** Google以外のサイトのクチコミ（貼り付け） */
  otherSitesEnabled: boolean;
}

export interface LocationPlanRow {
  report_enabled: boolean | null;
  other_sites_enabled: boolean | null;
}

/** 契約列だけを取り出す select 句。取得箇所ごとに書くとずれるため 1 箇所に置く。 */
export const LOCATION_PLAN_COLUMNS = 'report_enabled, other_sites_enabled';

/**
 * 行から契約内容を決める。
 *
 * 判断がつかない値（null・未取得）は必ず false に倒す。
 * 取りこぼして有効になるより、取りこぼして無効になるほうが安全。
 * 誤って有効になると、契約していない店に課金対象の機能を使わせてしまう。
 */
export function resolveLocationPlan(row: Partial<LocationPlanRow> | null | undefined): LocationPlan {
  return {
    reportEnabled: row?.report_enabled === true,
    otherSitesEnabled: row?.other_sites_enabled === true,
  };
}

/** 契約していない機能へのアクセスを表す。API はこれを 404 として返す。 */
export class PlanNotIncludedError extends Error {
  constructor(feature: keyof LocationPlan) {
    super(`この店舗では契約されていない機能です: ${feature}`);
    this.name = 'PlanNotIncludedError';
  }
}
