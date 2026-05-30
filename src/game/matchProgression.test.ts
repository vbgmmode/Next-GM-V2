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
});
