/**
 * モデル別の単価表と、月次予算の判定。
 *
 * 「無料枠に収める」を運用ルールではなく**システムの保証**にするための仕組み。
 * 生成のたびに実トークン数から概算コストを出して ai_usage に記録し、
 * 月初からの合計が予算に達したら生成を止める。
 *
 * 単価は Anthropic の公開価格（USD / 100万トークン）。
 * 価格改定があればここだけ直せばよい。
 */

export interface ModelPrice {
  /** 入力 USD / 1M tokens */
  input: number;
  /** 出力 USD / 1M tokens */
  output: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/** 未知のモデルは最も高い単価で見積もる（予算を超過させないための安全側の倒し方）。 */
const FALLBACK_PRICE: ModelPrice = { input: 5, output: 25 };

export function priceFor(model: string): ModelPrice {
  // API が返すモデル名には日付サフィックスが付くことがあるので前方一致も見る
  if (MODEL_PRICES[model]) return MODEL_PRICES[model];
  const matched = Object.keys(MODEL_PRICES).find((key) => model.startsWith(key));
  return matched ? MODEL_PRICES[matched] : FALLBACK_PRICE;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = priceFor(model);
  const cost =
    (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  // ai_usage.estimated_cost_usd は numeric(12,6)。小数第6位に丸めて桁あふれを防ぐ。
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * 1 件の返信生成にかかる概算コスト。
 * 予算判定で「次の 1 件を生成する余地があるか」を見るために使う。
 *
 * 1 回の呼び出しで**温度感を変えた 3 案**を生成するため、出力トークンは
 * 単一案のおよそ 3 倍になる。見積もりは安全側（多め）に倒している。
 * 予算を超えさせないことが目的なので、少なめに見積もるより早めに止まる方がよい。
 *
 * 実績は ai_usage テーブルに実トークン数で記録されるので、
 * 運用後はそちらの平均に合わせて調整できる。
 */
const TYPICAL_INPUT_TOKENS = 1_600;
const TYPICAL_OUTPUT_TOKENS = 1_500;

export function estimatedCostPerReply(model: string): number {
  return estimateCostUsd(model, TYPICAL_INPUT_TOKENS, TYPICAL_OUTPUT_TOKENS);
}

/** 予算からおおよそ何件生成できるかを逆算する（画面表示・ドキュメント用）。 */
export function repliesPerBudget(model: string, budgetUsd: number): number {
  const perReply = estimatedCostPerReply(model);
  return perReply > 0 ? Math.floor(budgetUsd / perReply) : 0;
}

export interface BudgetState {
  /** 当月の実績コスト(USD) */
  spentUsd: number;
  /** 月次予算(USD) */
  budgetUsd: number;
  /** 残り(USD) */
  remainingUsd: number;
  /** 残りでおおよそ何件生成できるか */
  remainingReplies: number;
  /** 予算を使い切ったか */
  exhausted: boolean;
}

export function evaluateBudget(
  spentUsd: number,
  budgetUsd: number,
  model: string,
): BudgetState {
  // 浮動小数点の誤差対策。丸めずに割ると 0.0168 / 0.0056 が 2.9999… になり、
  // 残り 3 件あるのに 2 件と表示されてしまう。
  // DB 側の精度 numeric(12,6) に合わせて小数第6位で丸める。
  const remainingUsd = Math.max(0, round6(budgetUsd - spentUsd));
  const perReply = estimatedCostPerReply(model);
  return {
    spentUsd,
    budgetUsd,
    remainingUsd,
    remainingReplies: perReply > 0 ? Math.floor(round6(remainingUsd / perReply)) : 0,
    // 次の1件を生成する余裕が無くなった時点で「使い切り」とみなす。
    // 予算を1セントでも超えさせないため、超過してからではなく手前で止める。
    exhausted: remainingUsd < perReply,
  };
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
