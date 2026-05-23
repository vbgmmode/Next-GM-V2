import { describe, expect, it } from "vitest";
import { getDifficultyRules, scaleNegativePressure } from "./difficultyRules";

describe("difficultyRules", () => {
  it("keeps Medium as the baseline", () => {
    const rules = getDifficultyRules("Medium");

    expect(rules.cpuWeeklyScoreModifier).toBe(0);
    expect(rules.playerPressure.moralePenaltyMultiplier).toBe(1);
    expect(rules.playerPressure.injuryRiskModifier).toBe(0);
  });

  it("scales rival pressure conservatively across difficulty", () => {
    const easy = getDifficultyRules("Easy");
    const hard = getDifficultyRules("Hard");
    const legendary = getDifficultyRules("Legendary");

    expect(easy.cpuWeeklyScoreModifier).toBeLessThan(0);
    expect(hard.cpuWeeklyScoreModifier).toBeGreaterThan(0);
    expect(legendary.cpuWeeklyScoreModifier).toBeGreaterThan(hard.cpuWeeklyScoreModifier);
    expect(legendary.cpuMarket.claimThreshold).toBeLessThan(easy.cpuMarket.claimThreshold);
  });

  it("only scales negative pressure deltas", () => {
    expect(scaleNegativePressure(-4, 1.3)).toBe(-5);
    expect(scaleNegativePressure(3, 1.3)).toBe(3);
  });
});
