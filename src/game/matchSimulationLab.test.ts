import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "./seed";
import { runShow } from "./scoring";
import { createMatchSimulationLabGame, getMatchSimulationLabRoster, runMatchSimulationLab } from "./matchSimulationLab";
import type { MatchRatings, Segment, Wrestler } from "./types";

function explicitRatings(overrides: Partial<MatchRatings> = {}): MatchRatings {
  return {
    technical: 60,
    submission: 60,
    power: 60,
    aerial: 60,
    brawling: 60,
    hardcore: 60,
    stamina: 60,
    resilience: 60,
    psychology: 60,
    selling: 60,
    timing: 60,
    explosiveness: 60,
    clutch: 60,
    ...overrides,
  };
}

function labRoster() {
  const base = draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, 4);
  expect(base).toHaveLength(4);

  return [
    tuneWrestler(base[0], "lab-a", "Lab A", explicitRatings({ technical: 72, stamina: 70, resilience: 72, clutch: 70 })),
    tuneWrestler(base[1], "lab-b", "Lab B", explicitRatings({ technical: 68, stamina: 68, resilience: 66, clutch: 67 })),
    tuneWrestler(base[2], "lab-c", "Lab C", explicitRatings({ technical: 54, stamina: 55, resilience: 52, clutch: 51 })),
    tuneWrestler(base[3], "lab-d", "Lab D", explicitRatings({ technical: 50, stamina: 48, resilience: 49, clutch: 48 })),
  ];
}

function tuneWrestler(source: Wrestler, id: string, name: string, matchRatings?: MatchRatings): Wrestler {
  return {
    ...source,
    id,
    name,
    popularity: 65,
    momentum: 60,
    morale: 65,
    ringSkill: 66,
    promoSkill: 55,
    fatigue: 10,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
    matchRatings,
  };
}

function gameWithRoster(wrestlers = labRoster()) {
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    championships: [],
    rivalries: [],
    currentShow: [],
  };
}

function singlesSegment(wrestlers: Wrestler[]): Segment {
  return {
    id: "player-facing-lab-leak-check",
    type: "Match",
    participantIds: wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
  };
}

describe("match simulation lab", () => {
  it("runs deterministic singles batches and keeps 1,000-run distributions stable for the same seed", () => {
    const game = gameWithRoster();
    const input = {
      game,
      participantIds: game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      matchStructure: "singles" as const,
      iterations: 1000,
      baseSeed: "deterministic-singles",
      model: "deepRatings" as const,
    };

    const first = runMatchSimulationLab(input);
    const second = runMatchSimulationLab(input);

    expect(first).toEqual(second);
    expect(first.successfulIterations).toBe(1000);
    expect(first.winnerDistribution).toHaveLength(2);
  });

  it("keeps the default 1,000-run dev-lab singles seed output stable", () => {
    const game = gameWithRoster();
    const result = runMatchSimulationLab({
      game,
      participantIds: game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      matchStructure: "singles",
      iterations: 1000,
      baseSeed: "dev-lab",
      model: "deepRatings",
    });

    expect(result.successfulIterations).toBe(1000);
    expect(result.fallbackCounts.total).toBe(0);
    expect(result.winnerDistribution.map((row) => ({ id: row.id, count: row.count, actualProbability: row.actualProbability }))).toEqual([
      { id: "lab-a", count: 501, actualProbability: 0.501 },
      { id: "lab-b", count: 499, actualProbability: 0.499 },
    ]);
  });

  it("keeps actual singles probability roughly aligned to effective-power expectation", () => {
    const game = gameWithRoster();
    const result = runMatchSimulationLab({
      game,
      participantIds: game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      matchStructure: "singles",
      iterations: 1000,
      baseSeed: "probability-singles",
      model: "deepRatings",
    });

    result.winnerDistribution.forEach((row) => {
      expect(Math.abs(row.deltaFromExpected ?? 0)).toBeLessThan(0.08);
    });
  });

  it("supports singles, 2v2 tag, 3-way, and 4-way structures", () => {
    const game = gameWithRoster();
    const ids = game.wrestlers.map((wrestler) => wrestler.id);

    expect(runMatchSimulationLab({ game, participantIds: ids.slice(0, 2), matchStructure: "singles", iterations: 25 }).winnerDistribution.length).toBeGreaterThan(0);
    expect(runMatchSimulationLab({ game, participantIds: ids, matchStructure: "tag_2v2", iterations: 25 }).winnerDistribution.length).toBeGreaterThan(0);
    expect(runMatchSimulationLab({ game, participantIds: ids.slice(0, 3), matchStructure: "three_way", iterations: 25 }).winnerDistribution.length).toBeGreaterThan(0);
    expect(runMatchSimulationLab({ game, participantIds: ids, matchStructure: "four_way", iterations: 25 }).winnerDistribution.length).toBeGreaterThan(0);
  });

  it("exposes a broad hydrated dev-lab roster beyond top stars", () => {
    const roster = getMatchSimulationLabRoster();
    const roleTiers = new Set(roster.map((wrestler) => wrestler.roleTier));

    expect(roster.length).toBeGreaterThan(80);
    expect(roleTiers.has("MainEvent")).toBe(true);
    expect(roleTiers.has("Midcard")).toBe(true);
    expect([...roleTiers].some((tier) => tier === "Prospect" || tier === "Enhancement")).toBe(true);
    expect(roster.every((wrestler) => wrestler.matchRatings)).toBe(true);
    expect(roster.some((wrestler) => (wrestler.draftRank ?? 0) > 100)).toBe(true);
    expect(roster.some((wrestler) => wrestler.ringSkill - wrestler.popularity >= 8)).toBe(true);
    expect(roster.some((wrestler) => wrestler.popularity - wrestler.ringSkill >= 8)).toBe(true);
  });

  it("lets the lab select non-top-star participants from the expanded roster", () => {
    const game = createMatchSimulationLabGame();
    const lowerCardIds = game.wrestlers
      .filter((wrestler) => wrestler.division === "Mens" && ((wrestler.draftRank ?? 0) > 100 || wrestler.roleTier === "Prospect" || wrestler.roleTier === "Enhancement"))
      .slice(0, 2)
      .map((wrestler) => wrestler.id);

    expect(lowerCardIds).toHaveLength(2);
    const result = runMatchSimulationLab({
      game,
      participantIds: lowerCardIds,
      matchStructure: "singles",
      iterations: 50,
      baseSeed: "expanded-roster-lower-card",
    });

    expect(result.successfulIterations).toBe(50);
    expect(result.fallbackCounts.total).toBe(0);
    expect(result.winnerDistribution.map((row) => row.id).sort()).toEqual([...lowerCardIds].sort());
  });

  it("reports fall-taker and protected participant distributions for tag and multi-person matches", () => {
    const game = gameWithRoster();
    const ids = game.wrestlers.map((wrestler) => wrestler.id);

    const tag = runMatchSimulationLab({ game, participantIds: ids, matchStructure: "tag_2v2", iterations: 100, baseSeed: "tag-falls" });
    const multi = runMatchSimulationLab({ game, participantIds: ids, matchStructure: "four_way", iterations: 100, baseSeed: "multi-falls" });

    expect(tag.fallTakerDistribution.length).toBeGreaterThan(0);
    expect(tag.protectedParticipantDistribution.length).toBeGreaterThan(0);
    expect(multi.fallTakerDistribution.length).toBeGreaterThan(0);
    expect(multi.protectedParticipantDistribution.length).toBeGreaterThan(0);
  });

  it("does not mutate source match ratings when progression is disabled", () => {
    const game = gameWithRoster();
    const before = JSON.stringify(game.wrestlers.map((wrestler) => ({ id: wrestler.id, matchRatings: wrestler.matchRatings })));

    runMatchSimulationLab({
      game,
      participantIds: game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      matchStructure: "singles",
      iterations: 100,
      baseSeed: "mutation-safety",
      progression: "disabled",
    });

    expect(JSON.stringify(game.wrestlers.map((wrestler) => ({ id: wrestler.id, matchRatings: wrestler.matchRatings })))).toBe(before);
  });

  it("counts fallback reasons and emits warnings for extreme fallback cases", () => {
    const game = gameWithRoster();
    const result = runMatchSimulationLab({
      game,
      participantIds: [game.wrestlers[0].id, "missing-wrestler"],
      matchStructure: "singles",
      iterations: 10,
      baseSeed: "fallbacks",
      model: "deepRatings",
    });

    expect(result.fallbackCounts.total).toBe(10);
    expect(Object.values(result.fallbackCounts.reasons)).toContain(10);
    expect(result.warnings.map((warning) => warning.code)).toContain("tooManyFallbacks");
  });

  it("reports missing matchRatings hydration warnings without mutating source wrestlers", () => {
    const roster = labRoster().map((wrestler, index) => (index === 0 ? { ...wrestler, matchRatings: undefined } : wrestler));
    const game = gameWithRoster(roster);

    const result = runMatchSimulationLab({
      game,
      participantIds: game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      matchStructure: "singles",
      iterations: 25,
      baseSeed: "hydration-warning",
    });

    expect(result.warnings.map((warning) => warning.code)).toContain("missingMatchRatingsHydrated");
    expect(game.wrestlers[0].matchRatings).toBeUndefined();
  });

  it("does not leak lab or internal audit fields into player-facing post-show surfaces", () => {
    const game = gameWithRoster();
    runMatchSimulationLab({
      game,
      participantIds: game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      matchStructure: "singles",
      iterations: 10,
      baseSeed: "leak-boundary",
    });

    const resolved = runShow({ ...game, currentShow: [singlesSegment(game.wrestlers)] }, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "disabled" });
    const playerFacingPayload = JSON.stringify({
      socialPosts: resolved.game.socialPosts,
      financeReports: resolved.game.financeReports,
    });

    expect(playerFacingPayload).not.toContain("matchSimulationLab");
    expect(playerFacingPayload).not.toContain("winnerDistribution");
    expect(playerFacingPayload).not.toContain("fallbackCounts");
    expect(playerFacingPayload).not.toContain("internalOutcomeAudit");
    expect(playerFacingPayload).not.toContain("internalMatchRatingsProgressionAudit");
  });
});
