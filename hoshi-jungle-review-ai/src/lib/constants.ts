import type { ReplyStatus, ReviewLanguage } from '@/lib/database.types';

/**
 * サーバー/クライアント両方から参照する定数。
 * ここには 'server-only' な依存（tinyld、Anthropic SDK など）を持ち込まないこと。
 */

/** Google Business Profile API の返信本文の上限文字数。 */
export const REPLY_MAX_LENGTH = 4096;

/** 実務上の推奨上限。これを超えると読まれにくくなるため UI で警告する。 */
export const REPLY_RECOMMENDED_LENGTH = 600;

export const LANGUAGE_LABELS: Record<ReviewLanguage, string> = {
  ja: '日本語',
  en: 'English',
  id: 'Bahasa Indonesia',
  other: 'その他',
};

export const STATUS_LABELS: Record<ReplyStatus, string> = {
  draft: 'AI生成（未確認）',
  edited: '編集済み（未公開）',
  published: '公開済み',
  failed: '失敗',
  skipped: '返信しない',
};

export const STATUS_STYLES: Record<ReplyStatus, string> = {
  draft: 'bg-jungle-100 text-jungle-700',
  edited: 'bg-blue-100 text-blue-800',
  published: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-jungle-50 text-jungle-400',
};
