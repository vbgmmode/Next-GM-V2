import type { GameDifficulty } from "./types";

export const SEASON_WEEK_COUNT = 50;
export const PLE_CYCLE_WEEKS = 5;
export const PLE_COUNT = SEASON_WEEK_COUNT / PLE_CYCLE_WEEKS;
export const STANDARD_BUDGET_AMOUNT = 2000000;
export const UNLIMITED_BUDGET_AMOUNT = 999999999;
export const DRAFT_CONTRACT_WEEKS = 52;
export const MARKET_CONTRACT_MAX_WEEKS = 52;
export const SENTIMENT_NEUTRAL = 50;
export const WEEKLY_FATIGUE_RECOVERY = 3;

export const INJURY_COMPOUND_RISK_BY_DIFFICULTY: Record<GameDifficulty, number> = {
  Easy: 2,
  Medium: 4,
  Hard: 6,
  Legendary: 8,
};

