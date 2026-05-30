import type { MatchRatings } from "./types";

export const MATCH_OUTCOME_TUNING = {
  effectivePowerFloor: 5,
  minWinProbability: 0.03,
  maxWinProbability: 0.97,
  // v9: v8 audit showed large power gaps were too flat. A mild exponent preserves upset chance while making clear favorites matter.
  winProbabilityPowerExponent: 1.35,
  multiPersonPowerExponent: 1.35,
  stipulationWeightMultiplier: 1.45,
  // v10: weight shifts alone did not create visible specialist movement, so stipulation fit adds a small power bonus/penalty.
  stipulationFitPowerMultiplier: 0.45,
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
  protectedLoserDefaultSellingBonus: 0.9,
  protectedLoserHighQualityResilienceBonus: 0.24,
  protectedLoserDefaultResilienceBonus: 0.75,
  protectedLoserDefaultTimingBonus: 0.65,
  fallTakerRegressionFactor: 0.55,
  highQualityLoserSellingBonus: 0.55,
  highQualityLoserResilienceBonus: 0.45,
  highQualityLoserTimingBonus: 0.3,
  // v10: keep long-run progression gradual while making growth above 90 materially harder.
  topEndGrowthDiminishingStart: 90,
  topEndGrowthDiminishingStrongStart: 95,
  topEndGrowthMultiplier: 0.45,
  topEndGrowthStrongMultiplier: 0.16,
  lowEndRegressionDiminishingStart: 45,
  lowEndRegressionDiminishingStrongStart: 25,
  lowEndRegressionMultiplier: 0.5,
  lowEndRegressionStrongMultiplier: 0.25,
  regressionMultiplier: 0.6,
  lowRatingGrowthBiasBelow: 58,
  lowRatingGrowthMultiplier: 1.35,
  highQualityLossLearningBonus: 0.2,
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
