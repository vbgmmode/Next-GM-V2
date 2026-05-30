import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "./seed";
import { runShow } from "./scoring";
import { applyPostShowMatchRatingsProgression } from "./matchProgression";
import type { MatchRatings, Segment, ShowResult, Wrestler } from "./types";

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

function progressionRoster(): Wrestler[] {
  const base = draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, 4);
  expect(base).toHaveLength(4);

  return base.map((wrestler, index) => ({
    ...wrestler,
    id: `progression-helper-${index}`,
    name: `Progression Helper ${index}`,
    popularity: index < 2 ? 82 : 40,
    momentum: index < 2 ? 78 : 35,
    morale: index < 2 ? 80 : 38,
    ringSkill: index < 2 ? 84 : 42,
    promoSkill: 55,
    fatigue: index === 3 ? 82 : 10,
    injuryStatus: "healthy" as const,
    injuryWeeksRemaining: 0,
    matchRatings: explicitRatings(
      index < 2
        ? { technical: 86, stamina: 84, resilience: 84, clutch: 86 }
        : { technical: 28, stamina: index === 3 ? 20 : 32, resilience: index === 3 ? 18 : 30, clutch: 24 },
    ),
  }));
}

function rosterWithRatings(ratings: MatchRatings, overrides: Partial<Wrestler> = {}) {
  return progressionRoster().map((wrestler) => ({
    ...wrestler,
    momentum: 70,
    fatigue: 10,
    injuryStatus: "healthy" as const,
    injuryWeeksRemaining: 0,
    matchRatings: { ...ratings },
    ...overrides,
  }));
}

function gameWithShow(segment: Segment, wrestlers = progressionRoster()) {
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    championships: [],
    rivalries: [],
    currentShow: [segment],
  };
}

function singlesSegment(wrestlers: Wrestler[], overrides: Partial<Segment> = {}): Segment {
  return {
    id: "progression-helper-singles",
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
    id: "progression-helper-tag",
    type: "Match",
    participantIds: wrestlers.map((wrestler) => wrestler.id),
    segmentCatalogId: "M020",
    segmentDisplayName: "2v2 Tag Match",
    durationMinutes: 14,
    participantMin: 4,
    participantMax: 4,
  };
}

function deepRatingsResult(segment: Segment, wrestlers: Wrestler[]) {
  return runShow(gameWithShow(segment, wrestlers), {
    matchOutcomeModel: "deepRatings",
    matchRatingsProgression: "disabled",
  });
}

function resultWithSegments(segmentResults: ShowResult["segmentResults"]): ShowResult {
  return {
    id: "progression-helper-result",
    seasonNumber: 1,
    week: 1,
    brandName: "Test Brand",
    showName: "Test Show",
    showType: "tv",
    totalScore: 80,
    segmentResults,
    biggestMomentumGain: { name: "None", amount: 0 },
    biggestFatigueIncrease: { name: "None", amount: 0 },
    titleNotes: [],
    rivalryNotes: [],
    titleHistoryEvents: [],
    rivalryHistoryEvents: [],
    lockerRoomFallout: {
      moraleDrops: [],
      moraleBoosts: [],
      overuseWarnings: [],
      underuseWarnings: [],
      injuryNotes: [],
    },
  };
}

function getRatingDeltaTotal(deltas: Partial<MatchRatings> | undefined) {
  return Object.values(deltas ?? {}).reduce((sum, delta) => sum + delta, 0);
}

describe("match ratings progression helper", () => {
  it("leaves wrestlers and segment audits unchanged when progression is disabled", () => {
    const wrestlers = progressionRoster();
    const resolved = deepRatingsResult(singlesSegment(wrestlers), wrestlers);

    const progression = applyPostShowMatchRatingsProgression({
      mode: "disabled",
      wrestlers: resolved.game.wrestlers,
      result: resolved.result,
      matchOutcomeModel: "deepRatings",
    });

    expect(progression.wrestlers).toBe(resolved.game.wrestlers);
    expect(progression.segmentResults).toBe(resolved.result.segmentResults);
  });

  it("applies singles progression with the same audit shape runShow consumes", () => {
    const wrestlers = progressionRoster();
    const resolved = deepRatingsResult(singlesSegment(wrestlers), wrestlers);

    const progression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: resolved.result,
      matchOutcomeModel: "deepRatings",
    });
    const audit = progression.segmentResults[0].internalMatchRatingsProgressionAudit;

    expect(audit).toMatchObject({
      enabled: true,
      eligible: true,
      context: {
        matchOutcomeModel: "deepRatings",
        cardPosition: "opener",
      },
    });
    expect(audit?.wrestlerIdsAffected).toHaveLength(2);
    expect(Object.keys(audit?.deltas ?? {})).toEqual(audit?.wrestlerIdsAffected);
  });

  it("lets low-rated wrestlers learn from high-quality losses without leaving rating bounds", () => {
    const wrestlers = progressionRoster();
    const resolved = deepRatingsResult(singlesSegment(wrestlers), wrestlers);
    const highQualityResult = resultWithSegments([{ ...resolved.result.segmentResults[0], score: 90 }]);
    const loserId = resolved.result.segmentResults[0].participantIds.find((id) => id !== resolved.result.segmentResults[0].winnerId);

    const progression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: highQualityResult,
      matchOutcomeModel: "deepRatings",
    });
    const loserDeltas = progression.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas[loserId ?? ""];
    const progressedLoser = progression.wrestlers.find((wrestler) => wrestler.id === loserId);

    expect(loserDeltas?.selling ?? 0).toBeGreaterThanOrEqual(0);
    expect(loserDeltas?.resilience ?? 0).toBeGreaterThanOrEqual(0);
    expect(loserDeltas?.timing ?? 0).toBeGreaterThanOrEqual(0);
    Object.values(progressedLoser?.matchRatings ?? {}).forEach((rating) => {
      expect(rating).toBeGreaterThanOrEqual(0);
      expect(rating).toBeLessThanOrEqual(100);
    });
  });

  it("applies tag fall-taker and protected-loser progression from internal fall data", () => {
    const wrestlers = progressionRoster();
    const resolved = deepRatingsResult(tagSegment(wrestlers), wrestlers);

    const progression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: resolved.result,
      matchOutcomeModel: "deepRatings",
    });
    const segment = progression.segmentResults[0];
    const outcomeAudit = segment.internalOutcomeAudit;
    const progressionAudit = segment.internalMatchRatingsProgressionAudit;
    const fallTakerId = outcomeAudit?.fallTakerId;
    const protectedLoserId = outcomeAudit?.protectedParticipantIds?.[0];

    expect(progressionAudit).toMatchObject({
      enabled: true,
      eligible: true,
    });
    expect(new Set(progressionAudit?.wrestlerIdsAffected)).toEqual(
      new Set([...(outcomeAudit?.winningTeamParticipantIds ?? []), ...(outcomeAudit?.losingTeamParticipantIds ?? [])]),
    );
    expect(fallTakerId).toBeDefined();
    expect(protectedLoserId).toBeDefined();
    const sumDeltas = (deltas: Partial<MatchRatings> | undefined) => Object.values(deltas ?? {}).reduce((sum, delta) => sum + delta, 0);
    const fallTakerDelta = sumDeltas(progressionAudit?.deltas[fallTakerId ?? ""]);
    const protectedLoserDelta = sumDeltas(progressionAudit?.deltas[protectedLoserId ?? ""]);
    expect(fallTakerDelta).toBeLessThanOrEqual(0);
    expect(protectedLoserDelta).toBeGreaterThan(fallTakerDelta);
  });

  it("keeps manual non-singles progression skipped when fall data is unavailable", () => {
    const wrestlers = progressionRoster();
    const resolved = deepRatingsResult(tagSegment(wrestlers), wrestlers);
    const manualSegment = {
      ...resolved.result.segmentResults[0],
      winnerId: wrestlers[2].id,
      internalOutcomeAudit: {
        model: "legacy" as const,
        outcomeModel: "legacy" as const,
        eligible: false,
        fallbackReason: "manualWinner",
        selectedWinnerId: wrestlers[2].id,
      },
    };

    const progression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: resultWithSegments([manualSegment]),
      matchOutcomeModel: "deepRatings",
    });

    expect(progression.segmentResults[0].internalMatchRatingsProgressionAudit).toMatchObject({
      enabled: true,
      eligible: false,
      reason: "manualNonSinglesFallDataUnavailable",
      wrestlerIdsAffected: [],
      deltas: {},
    });
  });

  it("keeps progression behavior stable when the expectation gap is within thresholds", () => {
    const wrestlers = rosterWithRatings(explicitRatings({ stamina: 70, resilience: 70, timing: 70, psychology: 70 }));
    const resolved = deepRatingsResult(singlesSegment(wrestlers), wrestlers);
    const insideExpectationResult = resultWithSegments([{ ...resolved.result.segmentResults[0], score: 78 }]);

    const first = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: insideExpectationResult,
      matchOutcomeModel: "deepRatings",
    });
    const second = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: insideExpectationResult,
      matchOutcomeModel: "deepRatings",
    });

    expect(second.wrestlers).toEqual(first.wrestlers);
    expect(second.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas).toEqual(
      first.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas,
    );
  });

  it("accelerates positive breakout deltas before existing caps and clamps", () => {
    const wrestlers = rosterWithRatings(explicitRatings({ stamina: 78, resilience: 78, timing: 78, psychology: 78 }));
    const resolved = deepRatingsResult(singlesSegment(wrestlers, { stipulationId: "iron_man" }), wrestlers);
    const normalResult = resultWithSegments([{ ...resolved.result.segmentResults[0], score: 89 }]);
    const breakoutResult = resultWithSegments([{ ...resolved.result.segmentResults[0], score: 91 }]);

    const normalProgression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: normalResult,
      matchOutcomeModel: "deepRatings",
    });
    const breakoutProgression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: breakoutResult,
      matchOutcomeModel: "deepRatings",
    });
    const winnerId = resolved.result.segmentResults[0].winnerId ?? "";
    const normalWinnerDeltas = normalProgression.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas[winnerId];
    const breakoutWinnerDeltas = breakoutProgression.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas[winnerId];

    expect(getRatingDeltaTotal(breakoutWinnerDeltas)).toBeGreaterThan(getRatingDeltaTotal(normalWinnerDeltas));
  });

  it("does not accelerate negative breakout deltas", () => {
    const wrestlers = rosterWithRatings(explicitRatings({ clutch: 72, resilience: 72, timing: 72, stamina: 72 }));
    const resolved = deepRatingsResult(tagSegment(wrestlers), wrestlers);
    const highScoreResult = resultWithSegments([{ ...resolved.result.segmentResults[0], score: 88 }]);
    const breakoutResult = resultWithSegments([{ ...resolved.result.segmentResults[0], score: 91 }]);

    const highScoreProgression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: highScoreResult,
      matchOutcomeModel: "deepRatings",
    });
    const breakoutProgression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: breakoutResult,
      matchOutcomeModel: "deepRatings",
    });
    const fallTakerId = resolved.result.segmentResults[0].internalOutcomeAudit?.fallTakerId ?? "";
    const highScoreFallTaker = highScoreProgression.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas[fallTakerId];
    const breakoutFallTaker = breakoutProgression.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas[fallTakerId];

    expect(getRatingDeltaTotal(breakoutFallTaker)).toBeGreaterThanOrEqual(getRatingDeltaTotal(highScoreFallTaker) - 1);
  });

  it("applies disappointing-match momentum and ring-metric penalties to physical participants only", () => {
    const wrestlers = rosterWithRatings(explicitRatings(Object.fromEntries(Object.keys(explicitRatings()).map((key) => [key, 80])) as Partial<MatchRatings>));
    const resolved = deepRatingsResult(singlesSegment(wrestlers), wrestlers);
    const disappointingResult = resultWithSegments([{ ...resolved.result.segmentResults[0], score: 50 }]);
    const participantIds = new Set(resolved.result.segmentResults[0].participantIds);

    const progression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers: resolved.game.wrestlers,
      result: disappointingResult,
      matchOutcomeModel: "deepRatings",
    });

    progression.wrestlers.forEach((wrestler) => {
      const before = resolved.game.wrestlers.find((candidate) => candidate.id === wrestler.id)!;

      if (participantIds.has(wrestler.id)) {
        expect(wrestler.momentum).toBe(Math.max(0, before.momentum - 15));
        expect(wrestler.matchRatings?.timing ?? 100).toBeLessThan(before.matchRatings?.timing ?? 0);
        expect(wrestler.matchRatings?.psychology ?? 100).toBeLessThan(before.matchRatings?.psychology ?? 0);
      } else {
        expect(wrestler.momentum).toBe(before.momentum);
        expect(wrestler.matchRatings).toEqual(before.matchRatings);
      }
    });
  });

  it("skips malformed participant inputs without crashing progression", () => {
    const wrestlers = progressionRoster();
    const malformedSegment = {
      ...deepRatingsResult(singlesSegment(wrestlers), wrestlers).result.segmentResults[0],
      participantIds: [],
      winnerId: undefined,
      score: Number.NaN,
    };

    const progression = applyPostShowMatchRatingsProgression({
      mode: "enabled",
      wrestlers,
      result: resultWithSegments([malformedSegment]),
      matchOutcomeModel: "deepRatings",
    });

    expect(progression.segmentResults[0].internalMatchRatingsProgressionAudit).toMatchObject({
      enabled: true,
      eligible: false,
      wrestlerIdsAffected: [],
      deltas: {},
    });
  });
});
