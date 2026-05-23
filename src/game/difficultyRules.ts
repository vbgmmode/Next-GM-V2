import type { GameDifficulty } from "./types";

export type DifficultyRules = {
  id: GameDifficulty;
  label: string;
  setupSummary: string;
  cpuDraft: {
    talentWeight: number;
    rosterNeedWeight: number;
    styleWeight: number;
    valueWeight: number;
    noiseWeight: number;
  };
  cpuWeeklyScoreModifier: number;
  cpuMarket: {
    boardCandidateScoreModifier: number;
    claimScoreModifier: number;
    claimThreshold: number;
    releaseRollThreshold: number;
    tradeRollThreshold: number;
    tradeValueToleranceBonus: number;
  };
  playerPressure: {
    moralePenaltyMultiplier: number;
    injuryRiskModifier: number;
    officeNegativeDeltaMultiplier: number;
    marketOfficePenaltyMultiplier: number;
  };
};

const difficultyRules: Record<GameDifficulty, DifficultyRules> = {
  Easy: {
    id: "Easy",
    label: "Easy",
    setupSummary: "Forgiving office tolerance, softer roster fallout, and a looser rival field.",
    cpuDraft: {
      talentWeight: 0.94,
      rosterNeedWeight: 0.72,
      styleWeight: 0.84,
      valueWeight: 0.6,
      noiseWeight: 1.22,
    },
    cpuWeeklyScoreModifier: -2,
    cpuMarket: {
      boardCandidateScoreModifier: -30,
      claimScoreModifier: -10,
      claimThreshold: 86,
      releaseRollThreshold: 84,
      tradeRollThreshold: 68,
      tradeValueToleranceBonus: -4,
    },
    playerPressure: {
      moralePenaltyMultiplier: 0.75,
      injuryRiskModifier: -5,
      officeNegativeDeltaMultiplier: 0.75,
      marketOfficePenaltyMultiplier: 0.75,
    },
  },
  Medium: {
    id: "Medium",
    label: "Medium",
    setupSummary: "Balanced pressure with the current baseline rival field.",
    cpuDraft: {
      talentWeight: 1,
      rosterNeedWeight: 1,
      styleWeight: 1,
      valueWeight: 1,
      noiseWeight: 1,
    },
    cpuWeeklyScoreModifier: 0,
    cpuMarket: {
      boardCandidateScoreModifier: 0,
      claimScoreModifier: 0,
      claimThreshold: 78,
      releaseRollThreshold: 76,
      tradeRollThreshold: 58,
      tradeValueToleranceBonus: 0,
    },
    playerPressure: {
      moralePenaltyMultiplier: 1,
      injuryRiskModifier: 0,
      officeNegativeDeltaMultiplier: 1,
      marketOfficePenaltyMultiplier: 1,
    },
  },
  Hard: {
    id: "Hard",
    label: "Hard",
    setupSummary: "Sharper rival decisions, tighter office tolerance, and less forgiving roster pressure.",
    cpuDraft: {
      talentWeight: 1.04,
      rosterNeedWeight: 1.22,
      styleWeight: 1.08,
      valueWeight: 1.18,
      noiseWeight: 0.78,
    },
    cpuWeeklyScoreModifier: 2,
    cpuMarket: {
      boardCandidateScoreModifier: 25,
      claimScoreModifier: 7,
      claimThreshold: 73,
      releaseRollThreshold: 72,
      tradeRollThreshold: 52,
      tradeValueToleranceBonus: 3,
    },
    playerPressure: {
      moralePenaltyMultiplier: 1.15,
      injuryRiskModifier: 4,
      officeNegativeDeltaMultiplier: 1.15,
      marketOfficePenaltyMultiplier: 1.15,
    },
  },
  Legendary: {
    id: "Legendary",
    label: "Legendary",
    setupSummary: "Ruthless rival efficiency, harsh office tolerance, and high consequence pressure.",
    cpuDraft: {
      talentWeight: 1.08,
      rosterNeedWeight: 1.36,
      styleWeight: 1.12,
      valueWeight: 1.32,
      noiseWeight: 0.58,
    },
    cpuWeeklyScoreModifier: 4,
    cpuMarket: {
      boardCandidateScoreModifier: 45,
      claimScoreModifier: 12,
      claimThreshold: 68,
      releaseRollThreshold: 68,
      tradeRollThreshold: 46,
      tradeValueToleranceBonus: 5,
    },
    playerPressure: {
      moralePenaltyMultiplier: 1.3,
      injuryRiskModifier: 7,
      officeNegativeDeltaMultiplier: 1.3,
      marketOfficePenaltyMultiplier: 1.3,
    },
  },
};

export function getDifficultyRules(difficulty: GameDifficulty = "Medium") {
  return difficultyRules[difficulty] ?? difficultyRules.Medium;
}

export function scaleNegativePressure(delta: number, multiplier: number) {
  return delta < 0 ? Math.round(delta * multiplier) : delta;
}
