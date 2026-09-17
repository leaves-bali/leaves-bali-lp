import { detectAll } from 'tinyld';

import type { LanguageSource, ReviewLanguage } from '@/lib/database.types';

/**
 * レビュー本文の言語判定（日本語 / 英語 / インドネシア語 / 中国語 / 韓国語）。
 *
 * 仕様では langdetect が指定されていたが、langdetect は Python ライブラリで
 * Next.js / Vercel の Node ランタイムでは動かない。TypeScript ネイティブで
 * 同等の n-gram ベース判定を行う tinyld を採用した。
 *
 * ── 2 段構えにしている理由（実測ベース） ────────────────────────────
 * tinyld 単体で検証したところ、長文は正解する一方で「最高！」のような
 * 短い日本語は候補ゼロ（判定不能）を返した。クチコミは短文の比率が高いため、
 * まず文字種で決定的に判別できるものを先に確定させ、残りを統計判定に回す。
 *
 *   1. 文字種チェック  … ハングル→ko、かな→ja（確実に判別できる）
 *   2. tinyld          … 対応言語に限定して統計判定
 *   3. 低信頼フラグ    … 確度が低ければ needsConfirmation を立て、
 *                        後段の Claude の判定で上書きできるようにする
 *
 * ── 漢字のみの扱い ──────────────────────────────────────────────
 * かなもハングルも無い漢字だけの文は、日本語と中国語の区別がつかない。
 * （例:「最高」はどちらの言語でもありうる）
 * この場合は tinyld に ja/zh の二択で判定させたうえで、必ず要確認フラグを立て、
 * Claude の判断で上書きできるようにしている。
 */

export interface DetectionResult {
  language: ReviewLanguage;
  confidence: number;
  source: LanguageSource;
  /** true の場合、Claude 側の言語判定を優先してよい */
  needsConfirmation: boolean;
}

/** ハングル音節 + 字母 */
const HANGUL_PATTERN = /[가-힯ᄀ-ᇿ㄰-㆏]/;
/** ひらがな / カタカナ / 半角カタカナ。中国語には現れないため日本語の決定打になる。 */
const KANA_PATTERN = /[぀-ゟ゠-ヿｦ-ﾟ]/;
/** CJK 統合漢字。日本語と中国語で共有するため単独では判別できない。 */
const HAN_PATTERN = /[一-鿿]/;

/** tinyld の accuracy がこれ未満なら「低信頼」とみなす（実測で短文は 0.2 前後に落ちる）。 */
const CONFIDENCE_THRESHOLD = 0.3;

/** 対応言語。増やすときは DB の review_language enum にも値を追加すること。 */
export const SUPPORTED_LANGUAGES: ReviewLanguage[] = ['ja', 'en', 'id', 'zh', 'ko'];

export function detectLanguage(text: string | null | undefined): DetectionResult {
  const trimmed = (text ?? '').trim();

  // 本文なし（星だけのクチコミ）。返信は書けるので other 扱いにして人間確認へ回す。
  if (trimmed.length === 0) {
    return { language: 'other', confidence: 0, source: 'tinyld', needsConfirmation: true };
  }

  // --- 1. 文字種で確定できるもの -------------------------------------------
  if (HANGUL_PATTERN.test(trimmed)) {
    return { language: 'ko', confidence: 1, source: 'script', needsConfirmation: false };
  }
  if (KANA_PATTERN.test(trimmed)) {
    return { language: 'ja', confidence: 1, source: 'script', needsConfirmation: false };
  }

  // --- 2. 漢字のみ: 日本語と中国語の二択 -----------------------------------
  if (HAN_PATTERN.test(trimmed) && !/[a-zA-Z]/.test(trimmed)) {
    const cjk = detectAll(trimmed, { only: ['ja', 'zh'] })[0];
    return {
      // 判定できなければ中国語に寄せる。日本語は通常かなを含むため、
      // かな無しの漢字のみは中国語である確率のほうが高い。
      language: (cjk?.lang as ReviewLanguage) ?? 'zh',
      confidence: cjk?.accuracy ?? 0.5,
      source: 'script',
      // 誤ると別言語で返信してしまうため、必ず Claude に再確認させる
      needsConfirmation: true,
    };
  }

  // --- 3. tinyld ------------------------------------------------------------
  const top = detectAll(trimmed, { only: SUPPORTED_LANGUAGES })[0];

  if (!top) {
    return { language: 'other', confidence: 0, source: 'tinyld', needsConfirmation: true };
  }

  const language = SUPPORTED_LANGUAGES.includes(top.lang as ReviewLanguage)
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
 * ローカル判定が高信頼なら、そちらを信じる（Claude の言語判定は返信生成の副産物のため）。
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
