import type { ReplyStatus, ReviewLanguage } from '@/lib/database.types';

/**
 * サーバー/クライアント両方から参照する定数。
 * ここには 'server-only' な依存（tinyld、Anthropic SDK など）を持ち込まないこと。
 */

/** Google Business Profile API の返信本文の上限文字数。 */
export const REPLY_MAX_LENGTH = 4096;

/** 実務上の推奨上限。これを超えると読まれにくくなるため UI で警告する。 */
export const REPLY_RECOMMENDED_LENGTH = 600;

/** 返信案の3択。表示順もこの通り。 */
export const REPLY_STYLE_ORDER = ['warm', 'standard', 'concise'] as const;
export type ReplyStyleKey = (typeof REPLY_STYLE_ORDER)[number];

export const REPLY_STYLE_LABELS: Record<ReplyStyleKey, string> = {
  warm: '丁寧',
  standard: '標準',
  concise: '簡潔',
};

export const REPLY_STYLE_HINTS: Record<ReplyStyleKey, string> = {
  warm: '気持ちを込めた、いちばん厚い言い方',
  standard: '丁寧さと簡潔さのバランス型',
  concise: '短く要点だけ。忙しい日向け',
};

/**
 * クチコミの言語ラベル。言語名は原語表記のまま（画面の言語に関わらず読める）。
 * 'other' だけは画面の言語に合わせたいので i18n 側の reviewLang を使う。
 */
export const LANGUAGE_LABELS: Record<ReviewLanguage, string> = {
  ja: '日本語',
  en: 'English',
  id: 'Bahasa Indonesia',
  zh: '中文',
  ko: '한국어',
  other: 'その他',
};

export const STATUS_LABELS: Record<ReplyStatus, string> = {
  draft: 'AI生成（未確認）',
  edited: '編集済み（未公開）',
  published: '公開済み',
  failed: '失敗',
  skipped: '返信しない',
};

/**
 * 赤白の 2 色だけで状態を描き分ける。
 *
 * 色数が減ったぶん、**塗り**と**枠線**で形を変えて区別している。
 * いちばん間違えてはいけないのは「公開済みかどうか」なので、
 * 公開済みだけを塗りつぶしの赤にした。遠目でも他と混ざらない。
 * 失敗は同じ赤でも白抜き＋枠線にして、公開済みと取り違えないようにしている。
 */
export const STATUS_STYLES: Record<ReplyStatus, string> = {
  draft: 'bg-ink-100 text-ink-700',
  edited: 'bg-ink-200 text-ink-800',
  published: 'bg-brand-600 text-white',
  failed: 'border border-brand-600 bg-white text-brand-700',
  skipped: 'bg-ink-50 text-ink-500',
};
