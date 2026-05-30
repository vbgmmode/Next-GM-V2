import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "./seed";
import { resolveSegmentWinnerSelection } from "./matchOutcomeResolver";
import { IMPROMPTU_MAIN_EVENT_EGO_PENALTY, MATCH_OUTCOME_TUNING } from "./matchTuning";
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

function tunedRoster() {
  const base = draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, 4);
  expect(base).toHaveLength(4);

  const strongRatings = explicitRatings({
    technical: 94,
    submission: 90,
    power: 92,
    aerial: 88,
    brawling: 91,
    hardcore: 84,
    stamina: 93,
    resilience: 91,
    psychology: 89,
    selling: 82,
    timing: 92,
    explosiveness: 90,
    clutch: 94,
  });
  const weakRatings = explicitRatings({
    technical: 18,
    submission: 18,
    power: 20,
    aerial: 18,
    brawling: 22,
    hardcore: 18,
    stamina: 24,
    resilience: 18,
    psychology: 18,
    selling: 24,
    timing: 20,
    explosiveness: 18,
    clutch: 16,
  });

  return [
    tuneWrestler(base[0], "resolver-strong-a", "Resolver Strong A", strongRatings, { popularity: 35, momentum: 82, morale: 84, ringSkill: 35, fatigue: 6 }),
    tuneWrestler(base[1], "resolver-strong-b", "Resolver Strong B", explicitRatings({ ...strongRatings, clutch: 86 }), {
      popularity: 36,
      momentum: 78,
      morale: 82,
      ringSkill: 36,
      fatigue: 8,
    }),
    tuneWrestler(base[2], "resolver-weak-a", "Resolver Weak A", weakRatings, { popularity: 98, momentum: 35, morale: 38, ringSkill: 98, fatigue: 70 }),
    tuneWrestler(base[3], "resolver-weak-b", "Resolver Weak B", explicitRatings({ ...weakRatings, resilience: 12, stamina: 15, clutch: 10 }), {
      popularity: 97,
      momentum: 34,
      morale: 36,
      ringSkill: 97,
      fatigue: 72,
    }),
  ];
}

function tuneWrestler(
  source: Wrestler,
  id: string,
  name: string,
  matchRatings: MatchRatings,
  overrides: Partial<Wrestler> = {},
): Wrestler {
  return {
    ...source,
    id,
    name,
    promoSkill: 55,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
    matchRatings,
    ...overrides,
  };
}

function gameWithRoster(wrestlers = tunedRoster()) {
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    championships: [],
    rivalries: [],
    currentShow: [],
  };
}

function baseContext(overrides: Partial<Parameters<typeof resolveSegmentWinnerSelection>[2]> = {}) {
  return {
    segmentIndex: 0,
    segmentCount: 1,
    showType: "tv" as const,
    matchOutcomeModel: "deepRatings" as const,
    isNoContest: false,
    ...overrides,
  };
}

function singlesSegment(wrestlers: Wrestler[], overrides: Partial<Segment> = {}): Segment {
  return {
    id: "resolver-singles",
    type: "Match",
    participantIds: [wrestlers[0].id, wrestlers[2].id],
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
    ...overrides,
  };
}

function tagSegment(wrestlers: Wrestler[]): Segment {
  return {
    id: "resolver-tag",
    type: "Match",
    participantIds: wrestlers.map((wrestler) => wrestler.id),
    segmentCatalogId: "M020",
    segmentDisplayName: "2v2 Tag Match",
    durationMinutes: 14,
    participantMin: 4,
    participantMax: 4,
  };
}

describe("match outcome resolver", () => {
  it("keeps legacy and manual winner fallbacks out of deep ratings selection", () => {
    const wrestlers = tunedRoster();
    const game = gameWithRoster(wrestlers);
    const segment = singlesSegment(wrestlers, { winnerId: wrestlers[2].id });

    const manual = resolveSegmentWinnerSelection(segment, game, baseContext());
    const legacy = resolveSegmentWinnerSelection(singlesSegment(wrestlers), game, baseContext({ matchOutcomeModel: "legacy" }));

    expect(manual.segment.winnerId).toBe(wrestlers[2].id);
    expect(manual.audit).toMatchObject({
      model: "legacy",
      eligible: false,
      fallbackReason: "manualWinner",
      selectedWinnerId: wrestlers[2].id,
    });
    expect(legacy.audit).toMatchObject({
      model: "legacy",
      eligible: false,
      fallbackReason: "modelLegacy",
      selectedWinnerId: wrestlers[2].id,
    });
  });

  it("resolves tag falls and protected participants deterministically", () => {
    const wrestlers = tunedRoster();
    const game = gameWithRoster(wrestlers);
    const segment = tagSegment(wrestlers);

    const first = resolveSegmentWinnerSelection(segment, game, baseContext());
    const second = resolveSegmentWinnerSelection(segment, game, baseContext());

    expect(second).toEqual(first);
    expect(first.audit).toMatchObject({
      model: "deepRatings",
      eligible: true,
      outcomeStructure: "tag",
    });
    expect(first.audit.fallWinnerId).toBe(first.segment.winnerId);
    expect(first.audit.winningTeamParticipantIds).toContain(first.audit.fallWinnerId);
    expect(first.audit.losingTeamParticipantIds).toContain(first.audit.fallTakerId);
    expect(first.audit.protectedParticipantIds).toEqual(
      first.audit.losingTeamParticipantIds?.filter((id) => id !== first.audit.fallTakerId),
    );
  });

  it("applies the bounded impromptu main-event ego penalty only to tag team effective power", () => {
    const wrestlers = tunedRoster().map((wrestler) => ({
      ...wrestler,
      roleTier: "MainEvent" as const,
    }));
    const game = gameWithRoster(wrestlers);
    const segment = tagSegment(wrestlers);

    const result = resolveSegmentWinnerSelection(segment, game, baseContext());
    const teamBreakdown = result.audit.teamPowerBreakdown?.[0];
    const memberPowers = Object.values(teamBreakdown?.memberEffectivePowers ?? {});
    const memberAverage = memberPowers.reduce((sum, power) => sum + power, 0) / memberPowers.length;

    expect(memberPowers).toHaveLength(2);
    expect(teamBreakdown?.effectivePower).toBeCloseTo(
      Math.max(MATCH_OUTCOME_TUNING.effectivePowerFloor, memberAverage + IMPROMPTU_MAIN_EVENT_EGO_PENALTY),
      3,
    );
  });

  it("keeps tag team effective power floored when synergy inputs are missing and penalties apply", () => {
    const floorRatings = explicitRatings(Object.fromEntries(Object.keys(explicitRatings()).map((key) => [key, 0])) as Partial<MatchRatings>);
    const wrestlers = tunedRoster().map((wrestler) => ({
      ...wrestler,
      roleTier: "MainEvent" as const,
      momentum: 0,
      morale: 0,
      fatigue: 100,
      matchRatings: floorRatings,
    }));
    const game = gameWithRoster(wrestlers);
    const segment = tagSegment(wrestlers);

    const result = resolveSegmentWinnerSelection(segment, game, baseContext());

    expect(result.audit.teamPowerBreakdown).toHaveLength(2);
    result.audit.teamPowerBreakdown?.forEach((teamBreakdown) => {
      expect(teamBreakdown.effectivePower).toBeGreaterThanOrEqual(MATCH_OUTCOME_TUNING.effectivePowerFloor);
    });
  });

  it("excludes Open Challenge from deep ratings and uses the legacy fallback audit", () => {
    const wrestlers = tunedRoster();
    const game = gameWithRoster(wrestlers);
    const segment: Segment = {
      id: "resolver-open-challenge",
      type: "Open Challenge",
      participantIds: [wrestlers[0].id, wrestlers[2].id],
      segmentCatalogId: "OC001",
      segmentDisplayName: "Open Challenge",
      durationMinutes: 10,
      participantMin: 1,
      participantMax: 2,
    };

    const result = resolveSegmentWinnerSelection(segment, game, baseContext());

    expect(result.segment).toBe(segment);
    expect(result.audit).toMatchObject({
      model: "legacy",
      eligible: false,
      fallbackReason: "unsupportedSegmentType",
      selectedWinnerId: wrestlers[2].id,
    });
  });
});
