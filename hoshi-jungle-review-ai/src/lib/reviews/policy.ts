import type { ReviewLanguage } from '@/lib/database.types';
import type { LocationSettings } from '@/lib/settings/locationSettings';
import type { AttentionCode } from '@/lib/i18n';

/**
 * 品質管理ポリシー。
 *
 * 「どのクチコミを人間が必ず見るか」「どの返信なら自動公開してよいか」を 1 箇所に集約する。
 * この判断がコードのあちこちに散ると、仕様変更のたびに抜け漏れが出る。
 *
 * 【理由を文言ではなくコードで返す理由】
 * 画面を使うスタッフは日本人・インドネシア人・アメリカ人の 3 通りいる。
 * 日本語の文言を DB に保存してしまうと、英語話者の画面にも日本語が出てしまう。
 * ここでは言語に依存しないコードだけを返し、表示するときに翻訳する。
 */

export interface AttentionInput {
  rating: number;
  language: ReviewLanguage;
  languageIsUncertain: boolean;
  aiFlagged: boolean;
}

export interface AttentionResult {
  needsAttention: boolean;
  codes: AttentionCode[];
}

export function evaluateAttention(input: AttentionInput): AttentionResult {
  const codes: AttentionCode[] = [];

  if (input.rating <= 2) {
    codes.push('low_rating');
  }
  if (input.language === 'id') {
    // 仕様上の制約: インドネシア語は現地スタッフによるニュアンス確認を必須とする。
    codes.push('indonesian');
  }
  if (input.language === 'other') {
    codes.push('unsupported_language');
  }
  if (input.languageIsUncertain) {
    codes.push('low_confidence');
  }
  if (input.aiFlagged) {
    codes.push('ai_flagged');
  }

  return { needsAttention: codes.length > 0, codes };
}

/**
 * 自動公開してよいか。
 *
 * 判断材料は店舗ごとの設定から受け取る。以前は環境変数を直接読んでいたため、
 * システム全体で 1 つの方針しか持てなかった。店によって「4つ星以上の日本語だけ自動」
 * 「全件手動」と分かれるのが普通なので、店の属性として扱う。
 *
 * 既定は「常に false（全件ドラフト）」。設定で明示的に有効にし、
 * かつ以下をすべて満たしたときだけ自動公開する:
 *   - 要確認フラグが立っていない
 *   - 評点が閾値以上
 *   - 言語が許可リストに含まれる
 *
 * インドネシア語は設定に関わらず自動公開しない。現地の言い回しと敬意表現を
 * AI に任せきれないためで、これは店ごとに変えてよい判断ではない。
 * DB 制約・設定の正規化・ここ、の 3 段で同じ条件を弾いている。
 */
export function shouldAutoPublish(params: {
  rating: number;
  language: ReviewLanguage;
  needsAttention: boolean;
  settings: Pick<
    LocationSettings,
    'autoPublishEnabled' | 'autoPublishMinRating' | 'autoPublishLanguages'
  >;
}): boolean {
  const { settings } = params;
  if (!settings.autoPublishEnabled) return false;
  if (params.needsAttention) return false;
  if (params.rating < settings.autoPublishMinRating) return false;
  if (params.language === 'id') return false;
  return settings.autoPublishLanguages.includes(params.language);
}
