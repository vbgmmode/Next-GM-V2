import { describe, expect, it } from "vitest";
import { runMatchSimulationBalanceAudit } from "./matchSimulationBalanceAudit";
import { createNewGame, draftPool } from "./seed";

describe("match simulation balance audit", () => {
  it("is deterministic for the same seed", () => {
    const input = {
      iterationsPerScenario: 80,
      baseSeed: "deterministic-balance",
      includeProgressionSeason: true,
      progressionWeeks: 12,
    };

    const first = runMatchSimulationBalanceAudit(input);
    const second = runMatchSimulationBalanceAudit(input);

    expect(first).toEqual(second);
    expect(first.summary.scenarioCount).toBeGreaterThan(0);
  });

  it("includes singles, stipulation, tag, and multi-person scenario categories", () => {
    const result = runMatchSimulationBalanceAudit({
      iterationsPerScenario: 30,
      baseSeed: "scenario-categories",
      includeProgressionSeason: false,
    });
    const categories = new Set(result.scenarioMatrix.map((scenario) => scenario.category));

    expect(categories.has("singles")).toBe(true);
    expect(categories.has("stipulation")).toBe(true);
    expect(categories.has("tag")).toBe(true);
    expect(categories.has("multi")).toBe(true);
    expect(result.scenarioMatrix.some((scenario) => scenario.stipulationId === "submission_match")).toBe(true);
    expect(result.scenarioMatrix.some((scenario) => scenario.stipulationId === "ladder_match")).toBe(true);
    expect(result.scenarioMatrix.some((scenario) => scenario.stipulationId === "iron_man")).toBe(true);
  });

  it("builds audit scenarios from more than only top-ranked main-event wrestlers", () => {
    const result = runMatchSimulationBalanceAudit({
      iterationsPerScenario: 20,
      baseSeed: "scenario-roster-spread",
      includeProgressionSeason: false,
    });
    const participantIds = new Set(result.scenarioMatrix.flatMap((scenario) => scenario.participantIds));
    const participants = draftPool.filter((wrestler) => participantIds.has(wrestler.id));
    const roleTiers = new Set(participants.map((wrestler) => wrestler.roleTier));
    const scenarioLabels = result.scenarioMatrix.map((scenario) => scenario.label).join(" ");

    expect(participants.some((wrestler) => (wrestler.draftRank ?? 0) > 80)).toBe(true);
    expect(roleTiers.has("MainEvent")).toBe(true);
    expect([...roleTiers].some((tier) => tier === "Midcard" || tier === "UpperCard")).toBe(true);
    expect([...roleTiers].some((tier) => tier === "Prospect" || tier === "Enhancement")).toBe(true);
    expect(scenarioLabels).toContain("Submission");
    expect(scenarioLabels).toContain("flyer");
    expect(scenarioLabels).toContain("brawler");
  });

  it("keeps supported balance scenarios off fallback paths", () => {
    const result = runMatchSimulationBalanceAudit({
      iterationsPerScenario: 60,
      baseSeed: "fallback-check",
      includeProgressionSeason: false,
    });

    expect(result.summary.unexpectedFallbackScenarios).toBe(0);
    result.scenarioResults.forEach((scenarioResult) => {
      expect(scenarioResult.lab.fallbackCounts.total).toBe(0);
    });
  });

  it("keeps expected and actual probabilities within a broad 1,000-run tolerance", () => {
    const result = runMatchSimulationBalanceAudit({
      scenarioSet: ["singles", "tag", "multi"],
      iterationsPerScenario: 1000,
      baseSeed: "probability-tolerance",
      includeProgressionSeason: false,
    });

    result.scenarioResults.forEach((scenarioResult) => {
      expect(scenarioResult.metrics.maxExpectedVsActualDelta).toBeLessThan(0.12);
    });
  }, 20000);

  it("generates useful warnings for an intentionally extreme scenario set", () => {
    const result = runMatchSimulationBalanceAudit({
      scenarioSet: ["singles"],
      iterationsPerScenario: 120,
      baseSeed: "warning-extremes",
      includeProgressionSeason: false,
    });

    expect(result.scenarioResults.some((scenarioResult) => scenarioResult.scenario.id === "singles-extreme-favorite-jobber")).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("runs progression on cloned state and reports rating movement", () => {
    const sourceGame = createNewGame({ draftedWrestlers: draftPool.slice(0, 12) });
    const before = JSON.stringify(sourceGame.wrestlers.map((wrestler) => ({ id: wrestler.id, matchRatings: wrestler.matchRatings })));
    const result = runMatchSimulationBalanceAudit({
      game: sourceGame,
      scenarioSet: ["progression"],
      iterationsPerScenario: 20,
      baseSeed: "progression-clone",
      includeProgressionSeason: true,
      progressionWeeks: 10,
    });
    const after = JSON.stringify(sourceGame.wrestlers.map((wrestler) => ({ id: wrestler.id, matchRatings: wrestler.matchRatings })));

    expect(after).toBe(before);
    expect(result.progression?.sourceGameMutated).toBe(false);
    expect(result.progression?.startingAverageRating).toBeGreaterThan(0);
    expect(result.progression?.endingAverageRating).toBeGreaterThan(0);
    expect(result.progression?.averageDelta).toEqual(expect.any(Number));
    expect(result.progression?.medianDelta).toEqual(expect.any(Number));
    expect(result.progression?.maxIncrease).toEqual(expect.any(Number));
    expect(result.progression?.maxDecrease).toEqual(expect.any(Number));
    expect(result.progression?.startingRatingsAtHundred).toEqual(expect.any(Number));
    expect(result.progression?.newRatingsAtHundred).toEqual(expect.any(Number));
    expect(result.progression?.wrestlersWithAnyRatingAboveNinetyFive).toEqual(expect.any(Number));
    expect(result.progression?.wrestlersWithFivePlusRatingsAboveNinetyFive).toEqual(expect.any(Number));
    expect(result.progression?.topGrowers.length).toBeGreaterThan(0);
    expect(result.progression?.topDecliners.length).toBeGreaterThan(0);
    expect(result.progression?.tierGrowth.length).toBeGreaterThan(0);
    expect(result.progression?.checkpoints.length).toBeGreaterThan(0);
  });

  it("keeps the 50-week progression audit near neutral without new top-end cap pressure", () => {
    const result = runMatchSimulationBalanceAudit({
      scenarioSet: ["progression"],
      iterationsPerScenario: 20,
      baseSeed: "progression-v10-health",
      includeProgressionSeason: true,
      progressionWeeks: 50,
    });

    expect(result.progression?.averageDelta ?? 99).toBeGreaterThan(-1);
    expect(result.progression?.averageDelta ?? 99).toBeLessThan(1);
    expect(result.progression?.ratingsAtZero).toBe(0);
    expect(result.progression?.newRatingsAtHundred).toBe(0);
    expect(result.progression?.lowRatedImprovedCount ?? 0).toBeGreaterThan(0);
    expect(result.progression?.tierGrowth.some((tier) => tier.tier === "Enhancement" && tier.maxIncrease > 0)).toBe(true);
  }, 20000);

  it("includes fall-taker and protected participant metrics for tag and multi-person scenarios", () => {
    const result = runMatchSimulationBalanceAudit({
      scenarioSet: ["tag", "multi"],
      iterationsPerScenario: 80,
      baseSeed: "fall-protection",
      includeProgressionSeason: false,
    });

    result.scenarioResults.forEach((scenarioResult) => {
      expect(scenarioResult.lab.fallTakerDistribution.length).toBeGreaterThan(0);
      expect(scenarioResult.lab.protectedParticipantDistribution.length).toBeGreaterThan(0);
      expect(scenarioResult.metrics.fallTakerConcentration).toEqual(expect.any(Number));
      expect(scenarioResult.metrics.protectedParticipantCoverage).toEqual(expect.any(Number));
    });
  });

  it("keeps the report data shape stable for future tuning passes", () => {
    const result = runMatchSimulationBalanceAudit({
      iterationsPerScenario: 25,
      baseSeed: "shape-stability",
      includeProgressionSeason: true,
      progressionWeeks: 10,
    });

    expect(result).toMatchObject({
      input: {
        iterationsPerScenario: 25,
        baseSeed: "shape-stability",
        progression: "disabled",
        includeProgressionSeason: true,
        progressionWeeks: 10,
      },
      summary: {
        scenarioCount: expect.any(Number),
        warningCount: expect.any(Number),
        unexpectedFallbackScenarios: expect.any(Number),
        maxProbabilityDelta: expect.any(Number),
        averageFavoriteWinRate: expect.any(Number),
      },
    });
    expect(result.scenarioResults[0]).toMatchObject({
      scenario: {
        id: expect.any(String),
        category: expect.any(String),
        matchStructure: expect.any(String),
        participantIds: expect.any(Array),
      },
      metrics: {
        fallbackRate: expect.any(Number),
        favoritePowerAdvantage: expect.any(Number),
        upsetRate: expect.any(Number),
        maxExpectedVsActualDelta: expect.any(Number),
        winnerConcentration: expect.any(Number),
        averageEffectivePower: expect.any(Number),
      },
      warnings: expect.any(Array),
    });
  });
});
