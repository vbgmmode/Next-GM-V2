import type { MatchRatings } from "./types";

export const MATCH_OUTCOME_TUNING = {
  effectivePowerFloor: 5,
  minWinProbability: 0.03,
  maxWinProbability: 0.97,
  // v9: v8 audit showed large power gaps were too flat. A mild exponent preserves upset chance while making clear favorites matter.
  winProbabilityPowerExponent: 1.35,
  multiPersonPowerExponent: 1.2,
  stipulationWeightMultiplier: 1.18,
} as const;

export const MATCH_CURRENT_STATE_TUNING = {
  momentumModifier: 0.08,
  moraleModifier: 0.05,
  fatigueStart: 45,
  fatiguePenalty: -0.08,
} as const;

export const MATCH_FALL_TAKER_TUNING = {
  resilienceGap: 1.15,
  staminaGap: 0.9,
  clutchGap: 0.65,
  moraleGap: 0.35,
  momentumGap: 0.25,
  fatigue: 0.68,
  weakPowerGap: 0.35,
  minorInjuryPenalty: 14,
  majorInjuryPenalty: 28,
  floor: 1,
} as const;

export const MATCH_PROGRESSION_TUNING = {
  protectedLoserFactor: 0.28,
  protectedLoserHighQualitySellingBonus: 0.28,
  protectedLoserDefaultSellingBonus: 0.08,
  protectedLoserHighQualityResilienceBonus: 0.24,
  fallTakerRegressionFactor: 0.65,
  highQualityLoserSellingBonus: 0.55,
  highQualityLoserResilienceBonus: 0.45,
  highQualityLoserTimingBonus: 0.3,
} as const;

export function scaleMatchRatingDeltas(
  deltas: Partial<Record<keyof MatchRatings, number>>,
  keys: Array<keyof MatchRatings>,
  factor: number,
) {
  keys.forEach((key) => {
    if (deltas[key] !== undefined) {
      deltas[key] *= factor;
    }
  });
}

