import { detectAll } from 'tinyld';

import type { LanguageSource, ReviewLanguage } from '@/lib/database.types';

/**
 * レビュー本文の言語判定（日本語 / 英語 / インドネシア語）。
 *
 * 仕様では langdetect が指定されていたが、langdetect は Python ライブラリで
 * Next.js / Vercel の Node ランタイムでは動かない。TypeScript ネイティブで
 * 同等の n-gram ベース判定を行う tinyld を採用した。
 *
 * ── 2 段構えにしている理由（実測ベース） ────────────────────────────
 * tinyld 単体で ja/en/id に絞って検証したところ、長文は全件正解する一方で
 * 「最高！」のような短い日本語は候補ゼロ（判定不能）を返した。
 * クチコミは短文の比率が高く、かつ日本語は文字種だけで決定的に判別できるため、
 * 先に文字種チェックを通してから統計判定にフォールバックする。
 *
 *   1. 文字種チェック  … かな/漢字を含めば ja 確定（confidence 1.0）
 *   2. tinyld          … ja/en/id に限定して統計判定
 *   3. 低信頼フラグ    … 上位候補のスコアが閾値未満なら needsConfirmation を立て、
 *                        後段の Claude の判定で上書きできるようにする
 */

export interface DetectionResult {
  language: ReviewLanguage;
  confidence: number;
  source: LanguageSource;
  /** true の場合、Claude 側の言語判定を優先してよい */
  needsConfirmation: boolean;
}

/** ひらがな / カタカナ / 半角カタカナ。CJK 統合漢字は中国語と共有するので単独では使わない。 */
const KANA_PATTERN = /[぀-ゟ゠-ヿｦ-ﾟ]/;
/** CJK 統合漢字 */
const HAN_PATTERN = /[一-鿿]/;

/** tinyld の accuracy がこれ未満なら「低信頼」とみなす（実測で短文は 0.2 前後に落ちる）。 */
const CONFIDENCE_THRESHOLD = 0.3;

const SUPPORTED: ReviewLanguage[] = ['ja', 'en', 'id'];

export function detectLanguage(text: string | null | undefined): DetectionResult {
  const trimmed = (text ?? '').trim();

  // 本文なし（星だけのクチコミ）。返信は書けるので other 扱いにして人間確認へ回す。
  if (trimmed.length === 0) {
    return { language: 'other', confidence: 0, source: 'tinyld', needsConfirmation: true };
  }

  // --- 1. 文字種チェック ---------------------------------------------------
  if (KANA_PATTERN.test(trimmed)) {
    return { language: 'ja', confidence: 1, source: 'script', needsConfirmation: false };
  }
  // かな無しの漢字のみ（例:「最高」）。中国語の可能性は残るが、
  // このホテルの客層では日本語の確率が圧倒的に高いので ja とし、確認フラグを立てる。
  if (HAN_PATTERN.test(trimmed) && !/[a-zA-Z]/.test(trimmed)) {
    return { language: 'ja', confidence: 0.6, source: 'script', needsConfirmation: true };
  }

  // --- 2. tinyld ------------------------------------------------------------
  const candidates = detectAll(trimmed, { only: SUPPORTED });
  const top = candidates[0];

  if (!top) {
    return { language: 'other', confidence: 0, source: 'tinyld', needsConfirmation: true };
  }

  const language = SUPPORTED.includes(top.lang as ReviewLanguage)
    ? (top.lang as ReviewLanguage)
    : 'other';

  return {
    language,
    confidence: top.accuracy,
    source: 'tinyld',
    needsConfirmation: top.accuracy < CONFIDENCE_THRESHOLD,
  };
}

/**
 * Claude が返した言語判定で上書きしてよいかを決める。
 * tinyld が高信頼なら tinyld を信じる（Claude の言語判定は返信生成の副産物なので）。
 */
export function reconcileLanguage(
  local: DetectionResult,
  claudeLanguage: ReviewLanguage | undefined,
): DetectionResult {
  if (!claudeLanguage || claudeLanguage === local.language) return local;
  if (!local.needsConfirmation) return local;
  return {
    language: claudeLanguage,
    confidence: 0.8,
    source: 'claude',
    needsConfirmation: false,
  };
}

