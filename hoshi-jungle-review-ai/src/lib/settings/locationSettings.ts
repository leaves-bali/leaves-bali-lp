import type { ReviewLanguage } from '@/lib/database.types';

/**
 * 店舗ごとの設定。
 *
 * 【なぜ環境変数から移したか】
 * 店名・署名・連絡先・自動公開の条件は、もともと環境変数に入っていた。
 * それはシステム全体で 1 組しか持てないという意味で、店舗が増えるたびに
 * 別のシステムを立ち上げる必要があった。複数店舗に販売する以上、
 * これらは「店の属性」として DB に持たなければならない。
 *
 * 【環境変数を消さない理由】
 * 列はすべて NULL 可で、NULL は「この店では未設定」を意味する。
 * そのとき環境変数の値を使う。こうしておくと、マイグレーションを当てただけでは
 * 既存店（Hoshi Jungle）の挙動が一切変わらない。設定画面で値を入れた店だけが
 * 切り替わる。移行のリスクを消すための設計であり、環境変数は
 * 「まだ設定していない店の既定値」として残す。
 */

/** 自動公開を許してよい言語。インドネシア語は仕様上ここに含めない。 */
export const AUTO_PUBLISHABLE_LANGUAGES: ReviewLanguage[] = ['ja', 'en', 'zh', 'ko'];

export interface LocationSettings {
  locationId: string;
  /** 返信文で名乗る店名 */
  name: string;
  /** 返信文で使う所在地の表記 */
  areaLabel: string;
  /** 返信の末尾に置く署名 */
  replySignature: string;
  /** 低評価のクチコミで案内してよい連絡先。空なら具体的なアドレスを書かせない。 */
  contactEmail: string;
  /** AI が触れてよいお店の魅力。ここに無いことは書かせない。 */
  highlights: string[];
  autoPublishEnabled: boolean;
  autoPublishMinRating: number;
  autoPublishLanguages: ReviewLanguage[];
}

/** DB から読んだ設定列（NULL は「未設定」） */
export interface LocationSettingsRow {
  location_id: string;
  name: string;
  area_label: string | null;
  reply_signature: string | null;
  contact_email: string | null;
  highlights: string[] | null;
  auto_publish_enabled: boolean | null;
  auto_publish_min_rating: number | null;
  auto_publish_languages: string[] | null;
}

/** 未設定の店に使う既定値（環境変数由来） */
export interface LocationSettingsDefaults {
  name: string;
  areaLabel: string;
  replySignature: string;
  contactEmail: string;
  autoPublishEnabled: boolean;
  autoPublishMinRating: number;
  autoPublishLanguages: string[];
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * 自動公開してよい言語だけを残す。
 *
 * インドネシア語と未対応の言語コードを必ず落とす。DB 側にも制約を置いているが、
 * 環境変数から来た値はそこを通らないため、ここでも同じ条件で濾す。
 */
export function sanitizeAutoPublishLanguages(values: readonly string[]): ReviewLanguage[] {
  const seen = new Set<string>();
  const out: ReviewLanguage[] = [];
  for (const raw of values) {
    const lang = String(raw).trim().toLowerCase();
    if (seen.has(lang)) continue;
    seen.add(lang);
    if ((AUTO_PUBLISHABLE_LANGUAGES as readonly string[]).includes(lang)) {
      out.push(lang as ReviewLanguage);
    }
  }
  return out;
}

/**
 * DB の行と既定値から、実際に使う設定を決める。
 *
 * DB へのアクセスを含まない純粋な関数にしてある。移行後も既存店の挙動が
 * 変わらないことを、DB を立てずにテストで確かめられるようにするため。
 */
export function resolveLocationSettings(
  row: LocationSettingsRow,
  defaults: LocationSettingsDefaults,
): LocationSettings {
  const minRating = row.auto_publish_min_rating ?? defaults.autoPublishMinRating;

  return {
    locationId: row.location_id,
    name: cleanText(row.name) ?? defaults.name,
    areaLabel: cleanText(row.area_label) ?? defaults.areaLabel,
    replySignature: cleanText(row.reply_signature) ?? defaults.replySignature,
    contactEmail: cleanText(row.contact_email) ?? defaults.contactEmail,
    highlights: (row.highlights ?? [])
      .map((h) => String(h).trim())
      .filter((h) => h !== ''),
    autoPublishEnabled: row.auto_publish_enabled ?? defaults.autoPublishEnabled,
    // 範囲外の値が入っていても自動公開が緩くならない側（5）に倒す
    autoPublishMinRating: minRating >= 1 && minRating <= 5 ? minRating : 5,
    autoPublishLanguages: sanitizeAutoPublishLanguages(
      row.auto_publish_languages ?? defaults.autoPublishLanguages,
    ),
  };
}

/** 設定列だけを取り出す select 句。取得箇所ごとに書くとずれるため 1 箇所に置く。 */
export const LOCATION_SETTINGS_COLUMNS =
  'location_id, name, area_label, reply_signature, contact_email, highlights, ' +
  'auto_publish_enabled, auto_publish_min_rating, auto_publish_languages';
