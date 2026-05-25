import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "./seed";
import { runShow } from "./scoring";
import type { Championship, MatchRatings, Rivalry, Segment, Wrestler } from "./types";

function sameDivisionWrestlers(count: number) {
  const wrestlers = draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, count).map(boostWrestler);
  expect(wrestlers).toHaveLength(count);
  return wrestlers;
}

function boostWrestler(wrestler: Wrestler): Wrestler {
  return {
    ...wrestler,
    popularity: 96,
    momentum: 95,
    morale: 96,
    ringSkill: 97,
    promoSkill: 80,
    fatigue: 0,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
  };
}

function singlesMatch(wrestlers: Wrestler[]): Segment {
  return {
    id: "crowd-spark-match",
    type: "Match",
    participantIds: wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 14,
    participantMin: 2,
    participantMax: 2,
  };
}

function activeRivalry(first: Wrestler, second: Wrestler): Rivalry {
  return {
    id: "existing-rivalry",
    name: `${first.name} vs ${second.name}`,
    participantIds: [first.id, second.id],
    structure: "singles",
    heat: 70,
    freshness: 75,
    weeksActive: 2,
    lastAdvancedWeek: 0,
    status: "rising",
    stakes: "personal",
  };
}

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

function deepRatingsFixture() {
  const [first, second, third, fourth] = sameDivisionWrestlers(4);
  const ratingsStrong = {
    ...first,
    id: "ratings-strong",
    name: "Ratings Strong",
    popularity: 35,
    momentum: 35,
    ringSkill: 35,
    morale: 45,
    fatigue: 5,
    matchRatings: explicitRatings({
      technical: 100,
      submission: 100,
      power: 100,
      aerial: 100,
      brawling: 100,
      hardcore: 100,
      stamina: 100,
      resilience: 100,
      psychology: 100,
      selling: 100,
      timing: 100,
      explosiveness: 100,
      clutch: 100,
    }),
  };
  const legacyStrong = {
    ...second,
    id: "legacy-strong",
    name: "Legacy Strong",
    popularity: 98,
    momentum: 96,
    ringSkill: 98,
    morale: 96,
    fatigue: 0,
    matchRatings: explicitRatings({
      technical: 0,
      submission: 0,
      power: 0,
      aerial: 0,
      brawling: 0,
      hardcore: 0,
      stamina: 0,
      resilience: 0,
      psychology: 0,
      selling: 0,
      timing: 0,
      explosiveness: 0,
      clutch: 0,
    }),
  };

  return {
    ratingsStrong,
    legacyStrong,
    supportA: { ...third, id: "support-a", name: "Support A" },
    supportB: { ...fourth, id: "support-b", name: "Support B" },
  };
}

function deepRatingsMatch(wrestlers: Wrestler[], overrides: Partial<Segment> = {}): Segment {
  return {
    id: "deep-ratings-singles",
    type: "Match",
    participantIds: wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
    ...overrides,
  };
}

describe("runShow rivalry sparks", () => {
  it("starts a singles rivalry when a non-rivalry match gets a strong crowd score", () => {
    const wrestlers = sameDivisionWrestlers(2);
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [singlesMatch(wrestlers)],
    };

    const { game: resolvedGame, result } = runShow(game);

    expect(result.segmentResults[0].score).toBeGreaterThanOrEqual(85);
    expect(resolvedGame.rivalries).toHaveLength(1);
    expect(resolvedGame.rivalries[0]).toMatchObject({
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      structure: "singles",
      stakes: "respect",
      lastAdvancedWeek: game.currentWeek,
    });
    expect(result.segmentResults[0].rivalryId).toBe(resolvedGame.rivalries[0].id);
    expect(result.rivalryNotes[0]).toContain("sparked");
    expect(result.rivalryHistoryEvents[0]).toMatchObject({
      rivalryId: resolvedGame.rivalries[0].id,
      eventType: "started",
      participantIds: wrestlers.map((wrestler) => wrestler.id),
    });
  });

  it("does not start a rivalry when either wrestler is already in an active feud", () => {
    const wrestlers = sameDivisionWrestlers(3);
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [activeRivalry(wrestlers[0], wrestlers[2])],
      currentShow: [singlesMatch(wrestlers)],
    };

    const { game: resolvedGame, result } = runShow(game);

    expect(result.segmentResults[0].score).toBeGreaterThanOrEqual(85);
    expect(resolvedGame.rivalries).toHaveLength(1);
    expect(resolvedGame.rivalries[0].id).toBe("existing-rivalry");
    expect(result.rivalryNotes).toHaveLength(0);
    expect(result.rivalryHistoryEvents).toHaveLength(0);
  });
});

describe("runShow deep ratings winner selection", () => {
  it("keeps legacy winner selection by default and when explicitly configured", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [deepRatingsMatch(wrestlers)],
    };

    const defaultResult = runShow(game).result.segmentResults[0];
    const explicitLegacyResult = runShow(game, { matchOutcomeModel: "legacy" }).result.segmentResults[0];

    expect(defaultResult.winnerId).toBe(legacyStrong.id);
    expect(explicitLegacyResult.winnerId).toBe(legacyStrong.id);
    expect(defaultResult.internalOutcomeAudit).toMatchObject({
      model: "legacy",
      eligible: false,
      fallbackReason: "modelLegacy",
      selectedWinnerId: legacyStrong.id,
    });
  });

  it("uses deep ratings for eligible opt-in simulated singles matches", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [deepRatingsMatch(wrestlers)],
    };

    const first = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];
    const second = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];

    expect(first.winnerId).toBe(ratingsStrong.id);
    expect(second.winnerId).toBe(first.winnerId);
    expect(second.internalOutcomeAudit?.deterministicRoll).toBe(first.internalOutcomeAudit?.deterministicRoll);
    expect(first.internalOutcomeAudit).toMatchObject({
      model: "deepRatings",
      eligible: true,
      selectedWinnerId: ratingsStrong.id,
      competitorAId: ratingsStrong.id,
      competitorBId: legacyStrong.id,
    });
    expect(first.internalOutcomeAudit?.competitorAEffectivePower).toBeGreaterThan(first.internalOutcomeAudit?.competitorBEffectivePower ?? 0);
    expect(first.internalOutcomeAudit?.competitorAWinProbability).toBeGreaterThan(first.internalOutcomeAudit?.competitorBWinProbability ?? 0);
  });

  it("never overrides manual winners when deep ratings are enabled", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [deepRatingsMatch(wrestlers, { winnerId: legacyStrong.id })],
    };

    const result = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];

    expect(result.winnerId).toBe(legacyStrong.id);
    expect(result.internalOutcomeAudit).toMatchObject({
      model: "legacy",
      eligible: false,
      fallbackReason: "manualWinner",
      selectedWinnerId: legacyStrong.id,
    });
  });

  it("preserves Open Challenge hidden-opponent resolution by falling back to legacy winner selection", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [{
        id: "hidden-open-challenge",
        type: "Open Challenge",
        participantIds: [ratingsStrong.id],
        segmentCatalogId: "M018",
        segmentDisplayName: "Open Challenge",
        durationMinutes: 10,
        participantMin: 1,
        participantMax: 1,
      } satisfies Segment],
    };

    const result = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];

    expect(result.type).toBe("Open Challenge");
    expect(result.resolvedOpponentId).toBe(legacyStrong.id);
    expect(result.participantIds).toEqual([ratingsStrong.id, legacyStrong.id]);
    expect(result.internalOutcomeAudit).toMatchObject({
      model: "legacy",
      eligible: false,
      fallbackReason: "unsupportedSegmentType",
    });
  });

  it("falls back to legacy selection for tag matches", () => {
    const { ratingsStrong, legacyStrong, supportA, supportB } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong, supportA, supportB];
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [deepRatingsMatch(wrestlers, {
        id: "tag-fallback",
        participantIds: wrestlers.map((wrestler) => wrestler.id),
        segmentCatalogId: "M020",
        segmentDisplayName: "2v2 Tag Match",
        durationMinutes: 14,
        participantMin: 4,
        participantMax: 4,
      })],
    };

    const legacyResult = runShow(game, { matchOutcomeModel: "legacy" }).result.segmentResults[0];
    const result = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];

    expect(result.winnerId).toBe(legacyResult.winnerId);
    expect(result.internalOutcomeAudit).toMatchObject({
      model: "legacy",
      eligible: false,
      fallbackReason: "tagOrMultiPersonUnsupported",
      selectedWinnerId: legacyResult.winnerId,
    });
  });

  it("hydrates missing matchRatings for opt-in singles without crashing", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [
      { ...ratingsStrong, matchRatings: undefined },
      { ...legacyStrong, matchRatings: undefined },
    ];
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [deepRatingsMatch(wrestlers)],
    };

    const result = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];

    expect(wrestlers.map((wrestler) => wrestler.id)).toContain(result.winnerId);
    expect(result.internalOutcomeAudit?.model).toBe("deepRatings");
  });

  it("lets title transfer logic consume the selected deep-ratings winner", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const championship: Championship = {
      id: "world-title",
      name: "World Championship",
      division: "Mens",
      eligibleMatchScope: "singles",
      prestige: 90,
      championIds: [legacyStrong.id],
      reignStartWeek: 1,
      defenses: 0,
    };
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [championship],
      rivalries: [],
      currentShow: [deepRatingsMatch(wrestlers, { championshipId: championship.id })],
    };

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings" });

    expect(resolved.result.segmentResults[0].winnerId).toBe(ratingsStrong.id);
    expect(resolved.game.championships[0].championIds).toEqual([ratingsStrong.id]);
    expect(resolved.result.titleHistoryEvents[0]).toMatchObject({
      eventType: "title_change",
      championIds: [ratingsStrong.id],
      previousChampionIds: [legacyStrong.id],
    });
  });

  it("keeps match quality scoring and finance structure unchanged for the same card", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [],
      rivalries: [],
      currentShow: [deepRatingsMatch(wrestlers)],
    };

    const legacy = runShow(game, { matchOutcomeModel: "legacy" });
    const deepRatings = runShow(game, { matchOutcomeModel: "deepRatings" });
    const legacyFinance = legacy.game.financeReports.at(-1);
    const deepRatingsFinance = deepRatings.game.financeReports.at(-1);

    expect(deepRatings.result.segmentResults[0].winnerId).not.toBe(legacy.result.segmentResults[0].winnerId);
    expect(deepRatings.result.segmentResults[0].score).toBe(legacy.result.segmentResults[0].score);
    expect(deepRatings.result.totalScore).toBe(legacy.result.totalScore);
    expect(deepRatingsFinance).toMatchObject({
      modelVersion: legacyFinance?.modelVersion,
      grossRevenue: legacyFinance?.grossRevenue,
      totalExpenses: legacyFinance?.totalExpenses,
      profitLoss: legacyFinance?.profitLoss,
    });
    expect(deepRatings.game.socialPosts.map((post) => post.category)).toEqual(legacy.game.socialPosts.map((post) => post.category));
  });
});
