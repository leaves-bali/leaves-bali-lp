import { env } from '@/lib/env';
import type { ReviewLanguage } from '@/lib/database.types';

/**
 * 品質管理ポリシー。
 *
 * 「どのクチコミを人間が必ず見るか」「どの返信なら自動公開してよいか」を 1 箇所に集約する。
 * この判断がコードのあちこちに散ると、仕様変更のたびに抜け漏れが出る。
 */

export interface AttentionInput {
  rating: number;
  language: ReviewLanguage;
  languageIsUncertain: boolean;
  aiFlagged: boolean;
  aiReason: string | null;
}

export interface AttentionResult {
  needsAttention: boolean;
  reasons: string[];
}

export function evaluateAttention(input: AttentionInput): AttentionResult {
  const reasons: string[] = [];

  if (input.rating <= 2) {
    reasons.push('低評価（1〜2つ星）のため、公開前に必ず内容を確認してください');
  }
  if (input.language === 'id') {
    // 仕様上の制約: インドネシア語は現地スタッフによるニュアンス確認を必須とする。
    reasons.push('インドネシア語のため、現地スタッフによる表現確認が必要です');
  }
  if (input.language === 'other') {
    reasons.push('対応言語（日本語/英語/インドネシア語）以外の可能性があります');
  }
  if (input.languageIsUncertain) {
    reasons.push('言語の自動判定が低信頼です');
  }
  if (input.aiFlagged && input.aiReason) {
    reasons.push(`AI が要確認と判定: ${input.aiReason}`);
  } else if (input.aiFlagged) {
    reasons.push('AI が要確認と判定しました');
  }

  return { needsAttention: reasons.length > 0, reasons };
}

/**
 * 自動公開してよいか。
 *
 * 既定は「常に false（全件ドラフト）」。AUTO_PUBLISH_ENABLED を明示的に true にし、
 * かつ以下をすべて満たしたときだけ自動公開する:
 *   - 要確認フラグが立っていない
 *   - 評点が閾値以上
 *   - 言語が許可リストに含まれる（インドネシア語は env 側で強制除外済み）
 */
export function shouldAutoPublish(params: {
  rating: number;
  language: ReviewLanguage;
  needsAttention: boolean;
}): boolean {
  if (!env.autoPublishEnabled) return false;
  if (params.needsAttention) return false;
  if (params.rating < env.autoPublishMinRating) return false;
  if (params.language === 'id') return false;
  return env.autoPublishLanguages.includes(params.language);
}
