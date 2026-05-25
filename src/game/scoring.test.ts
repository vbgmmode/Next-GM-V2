import { describe, expect, it, vi } from "vitest";
import { createNewGame, draftPool } from "./seed";
import { createLegacyRunShowOptions, createPlayableRunShowOptions, runShow } from "./scoring";
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

function progressionFixture(overrides: Partial<Wrestler> = {}) {
  const [first, second, third, fourth] = sameDivisionWrestlers(4);
  const winner = {
    ...first,
    id: "progression-winner",
    name: "Progression Winner",
    popularity: 88,
    momentum: 82,
    ringSkill: 86,
    promoSkill: 76,
    morale: 82,
    fatigue: 8,
    matchRatings: explicitRatings(),
    ...overrides,
  };
  const loser = {
    ...second,
    id: "progression-loser",
    name: "Progression Loser",
    popularity: 84,
    momentum: 80,
    ringSkill: 84,
    promoSkill: 72,
    morale: 80,
    fatigue: 10,
    matchRatings: explicitRatings(),
  };

  return {
    winner,
    loser,
    supportA: { ...third, id: "progression-support-a", name: "Progression Support A", matchRatings: explicitRatings() },
    supportB: { ...fourth, id: "progression-support-b", name: "Progression Support B", matchRatings: explicitRatings() },
  };
}

function gameForSegments(wrestlers: Wrestler[], currentShow: Segment[]) {
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    championships: [],
    rivalries: [],
    currentShow,
  };
}

function matchRatingsFor(wrestlers: Wrestler[], wrestlerId: string): MatchRatings {
  const ratings = wrestlers.find((wrestler) => wrestler.id === wrestlerId)?.matchRatings;
  expect(ratings).toBeDefined();
  return ratings as MatchRatings;
}

function assertRatingsBounded(ratings: MatchRatings) {
  Object.values(ratings).forEach((value) => {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });
}

function manualProgressionMatch(winner: Wrestler, loser: Wrestler, overrides: Partial<Segment> = {}): Segment {
  return deepRatingsMatch([winner, loser], {
    winnerId: winner.id,
    ...overrides,
  });
}

describe("runShow simulation defaults", () => {
  it("keeps direct runShow compatibility on legacy winner selection with progression disabled", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers)]);

    const resolved = runShow(game);

    expect(resolved.result.segmentResults[0]).toMatchObject({
      winnerId: legacyStrong.id,
      internalOutcomeAudit: {
        model: "legacy",
        eligible: false,
        fallbackReason: "modelLegacy",
      },
    });
    expect(resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit).toBeUndefined();
    expect(matchRatingsFor(resolved.game.wrestlers, ratingsStrong.id)).toEqual(ratingsStrong.matchRatings);
    expect(matchRatingsFor(resolved.game.wrestlers, legacyStrong.id)).toEqual(legacyStrong.matchRatings);
  });

  it("exposes explicit legacy options with progression disabled", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers)]);

    const options = createLegacyRunShowOptions();
    const resolved = runShow(game, options);

    expect(options).toEqual({
      matchOutcomeModel: "legacy",
      matchRatingsProgression: "disabled",
    });
    expect(resolved.result.segmentResults[0].winnerId).toBe(legacyStrong.id);
    expect(resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit).toBeUndefined();
    expect(matchRatingsFor(resolved.game.wrestlers, ratingsStrong.id)).toEqual(ratingsStrong.matchRatings);
    expect(matchRatingsFor(resolved.game.wrestlers, legacyStrong.id)).toEqual(legacyStrong.matchRatings);
  });

  it("exposes playable defaults with deep-ratings winner selection and progression enabled", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers)]);

    const options = createPlayableRunShowOptions();
    const resolved = runShow(game, options);
    const result = resolved.result.segmentResults[0];

    expect(options).toEqual({
      matchOutcomeModel: "deepRatings",
      matchRatingsProgression: "enabled",
    });
    expect(result.winnerId).toBe(ratingsStrong.id);
    expect(result.internalOutcomeAudit).toMatchObject({
      model: "deepRatings",
      eligible: true,
      selectedWinnerId: ratingsStrong.id,
    });
    expect(result.internalMatchRatingsProgressionAudit).toMatchObject({
      enabled: true,
      eligible: true,
      wrestlerIdsAffected: [ratingsStrong.id, legacyStrong.id],
    });
    expect(result.internalMatchRatingsProgressionAudit?.clampEvents?.length).toBeGreaterThan(0);
  });

  it("returns fresh option objects so callers cannot mutate shared simulation defaults", () => {
    const playable = createPlayableRunShowOptions();
    playable.matchOutcomeModel = "legacy";
    playable.matchRatingsProgression = "disabled";

    expect(createPlayableRunShowOptions()).toEqual({
      matchOutcomeModel: "deepRatings",
      matchRatingsProgression: "enabled",
    });
  });
});

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

    const legacyResult = runShow(game, createLegacyRunShowOptions()).result.segmentResults[0];
    const result = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];

    expect(legacyResult.winnerId).toBe(legacyStrong.id);
    expect(result.winnerId).toBe(legacyStrong.id);
    expect(result.winnerId).toBe(legacyResult.winnerId);
    expect(result.score).toBe(legacyResult.score);
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

    const legacyResult = runShow(game, createLegacyRunShowOptions()).result.segmentResults[0];
    const result = runShow(game, { matchOutcomeModel: "deepRatings" }).result.segmentResults[0];

    expect(result.type).toBe("Open Challenge");
    expect(result.resolvedOpponentId).toBe(legacyResult.resolvedOpponentId);
    expect(result.winnerId).toBe(legacyResult.winnerId);
    expect(result.participantIds).toEqual(legacyResult.participantIds);
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

describe("runShow deep ratings progression", () => {
  it("does not mutate matchRatings or add progression audit metadata by default", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers)]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings" });

    expect(matchRatingsFor(resolved.game.wrestlers, ratingsStrong.id)).toEqual(ratingsStrong.matchRatings);
    expect(matchRatingsFor(resolved.game.wrestlers, legacyStrong.id)).toEqual(legacyStrong.matchRatings);
    expect(resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit).toBeUndefined();
  });

  it("progresses eligible resolved singles gradually when enabled", () => {
    const { winner, loser } = progressionFixture();
    const wrestlers = [winner, loser];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(winner, loser)]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
    const winnerRatings = matchRatingsFor(resolved.game.wrestlers, winner.id);
    const audit = resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit;

    expect(audit).toMatchObject({
      enabled: true,
      eligible: true,
      wrestlerIdsAffected: [winner.id, loser.id],
    });
    expect(winnerRatings.timing).toBeGreaterThan(winner.matchRatings?.timing ?? 0);
    expect(winnerRatings.stamina - (winner.matchRatings?.stamina ?? 0)).toBeLessThanOrEqual(2);
    assertRatingsBounded(winnerRatings);
  });

  it("can regress ratings for a poor overfatigued performance", () => {
    const { winner, loser } = progressionFixture({
      popularity: 25,
      momentum: 20,
      ringSkill: 25,
      promoSkill: 20,
      morale: 25,
      fatigue: 95,
      matchRatings: explicitRatings({ stamina: 50, resilience: 50, explosiveness: 50, timing: 50 }),
    });
    const tiredLoser = {
      ...loser,
      popularity: 24,
      momentum: 20,
      ringSkill: 24,
      promoSkill: 20,
      morale: 25,
      fatigue: 96,
      matchRatings: explicitRatings({ stamina: 50, resilience: 50, explosiveness: 50, timing: 50 }),
    };
    const wrestlers = [winner, tiredLoser];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(winner, tiredLoser)]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
    const loserRatings = matchRatingsFor(resolved.game.wrestlers, tiredLoser.id);

    expect(resolved.result.segmentResults[0].score).toBeLessThan(55);
    expect(loserRatings.stamina).toBeLessThan(tiredLoser.matchRatings?.stamina ?? 0);
    expect(loserRatings.timing).toBeLessThan(tiredLoser.matchRatings?.timing ?? 0);
  });

  it("keeps progression deterministic and avoids Math.random", () => {
    const { winner, loser } = progressionFixture();
    const wrestlers = [winner, loser];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(winner, loser, { stipulationId: "submission_match" })]);
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used by match ratings progression");
    });

    try {
      const first = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
      const second = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });

      expect(matchRatingsFor(second.game.wrestlers, winner.id)).toEqual(matchRatingsFor(first.game.wrestlers, winner.id));
      expect(second.result.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas).toEqual(
        first.result.segmentResults[0].internalMatchRatingsProgressionAudit?.deltas,
      );
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("does not change winner selection when progression is enabled", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers)]);

    const withoutProgression = runShow(game, { matchOutcomeModel: "deepRatings" });
    const withProgression = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });

    expect(withProgression.result.segmentResults[0].winnerId).toBe(withoutProgression.result.segmentResults[0].winnerId);
    expect(withProgression.result.segmentResults[0].score).toBe(withoutProgression.result.segmentResults[0].score);
    expect(withProgression.result.totalScore).toBe(withoutProgression.result.totalScore);
  });

  it("keeps manual winner behavior intact while progressing the resolved participants", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers, { winnerId: legacyStrong.id })]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });

    expect(resolved.result.segmentResults[0].winnerId).toBe(legacyStrong.id);
    expect(resolved.result.segmentResults[0].internalOutcomeAudit).toMatchObject({
      model: "legacy",
      fallbackReason: "manualWinner",
      selectedWinnerId: legacyStrong.id,
    });
    expect(resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit).toMatchObject({
      enabled: true,
      eligible: true,
      wrestlerIdsAffected: [legacyStrong.id, ratingsStrong.id],
    });
  });

  it("skips Open Challenge progression after preserving hidden-opponent reveal", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [{
      id: "hidden-open-challenge",
      type: "Open Challenge",
      participantIds: [ratingsStrong.id],
      segmentCatalogId: "M018",
      segmentDisplayName: "Open Challenge",
      durationMinutes: 10,
      participantMin: 1,
      participantMax: 1,
    } satisfies Segment]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });

    expect(resolved.result.segmentResults[0].resolvedOpponentId).toBe(legacyStrong.id);
    expect(resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit).toMatchObject({
      enabled: true,
      eligible: false,
      reason: "unsupportedSegmentType",
      wrestlerIdsAffected: [],
    });
    expect(matchRatingsFor(resolved.game.wrestlers, ratingsStrong.id)).toEqual(ratingsStrong.matchRatings);
    expect(matchRatingsFor(resolved.game.wrestlers, legacyStrong.id)).toEqual(legacyStrong.matchRatings);
  });

  it("hydrates missing matchRatings safely when enabled", () => {
    const { winner, loser } = progressionFixture();
    const wrestlers = [
      { ...winner, matchRatings: undefined },
      { ...loser, matchRatings: undefined },
    ];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(wrestlers[0], wrestlers[1])]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });

    assertRatingsBounded(matchRatingsFor(resolved.game.wrestlers, winner.id));
    assertRatingsBounded(matchRatingsFor(resolved.game.wrestlers, loser.id));
  });

  it("skips tag and multi-person progression with an internal reason", () => {
    const { winner, loser, supportA, supportB } = progressionFixture();
    const wrestlers = [winner, loser, supportA, supportB];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers, {
      id: "tag-progression-skip",
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      segmentCatalogId: "M020",
      segmentDisplayName: "2v2 Tag Match",
      durationMinutes: 14,
      participantMin: 4,
      participantMax: 4,
    })]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });

    expect(resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit).toMatchObject({
      enabled: true,
      eligible: false,
      reason: "tagOrMultiPersonUnsupported",
      wrestlerIdsAffected: [],
    });
    expect(matchRatingsFor(resolved.game.wrestlers, winner.id)).toEqual(winner.matchRatings);
  });

  it("weights submission progression toward submission and technical ratings", () => {
    const { winner, loser } = progressionFixture();
    const wrestlers = [winner, loser];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(winner, loser, { stipulationId: "submission_match" })]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
    const ratings = matchRatingsFor(resolved.game.wrestlers, winner.id);

    expect(ratings.submission - (winner.matchRatings?.submission ?? 0)).toBeGreaterThan(ratings.hardcore - (winner.matchRatings?.hardcore ?? 0));
    expect(ratings.technical - (winner.matchRatings?.technical ?? 0)).toBeGreaterThanOrEqual(ratings.power - (winner.matchRatings?.power ?? 0));
  });

  it("weights hardcore and no-DQ progression toward hardcore and brawling ratings", () => {
    const { winner, loser } = progressionFixture();
    const wrestlers = [winner, loser];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(winner, loser, { stipulationId: "no_dq" })]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
    const ratings = matchRatingsFor(resolved.game.wrestlers, winner.id);

    expect(ratings.hardcore - (winner.matchRatings?.hardcore ?? 0)).toBeGreaterThan(ratings.submission - (winner.matchRatings?.submission ?? 0));
    expect(ratings.brawling - (winner.matchRatings?.brawling ?? 0)).toBeGreaterThanOrEqual(ratings.technical - (winner.matchRatings?.technical ?? 0));
  });

  it("weights ladder progression toward aerial, explosiveness, and timing ratings", () => {
    const { winner, loser } = progressionFixture();
    const wrestlers = [winner, loser];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(winner, loser, { stipulationId: "ladder_match" })]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
    const ratings = matchRatingsFor(resolved.game.wrestlers, winner.id);

    expect(ratings.aerial - (winner.matchRatings?.aerial ?? 0)).toBeGreaterThan(ratings.submission - (winner.matchRatings?.submission ?? 0));
    expect(ratings.explosiveness - (winner.matchRatings?.explosiveness ?? 0)).toBeGreaterThanOrEqual(ratings.power - (winner.matchRatings?.power ?? 0));
    expect(ratings.timing).toBeGreaterThan(winner.matchRatings?.timing ?? 0);
  });

  it("lets a high-quality loss create small growth", () => {
    const { winner, loser } = progressionFixture();
    const wrestlers = [winner, loser];
    const game = gameForSegments(wrestlers, [manualProgressionMatch(winner, loser, { stipulationId: "ladder_match" })]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
    const loserRatings = matchRatingsFor(resolved.game.wrestlers, loser.id);

    expect(resolved.result.segmentResults[0].score).toBeGreaterThanOrEqual(80);
    expect(loserRatings.selling).toBeGreaterThan(loser.matchRatings?.selling ?? 0);
    expect(loserRatings.resilience).toBeGreaterThan(loser.matchRatings?.resilience ?? 0);
  });

  it("keeps progressed ratings clamped between 0 and 100", () => {
    const { ratingsStrong, legacyStrong } = deepRatingsFixture();
    const wrestlers = [ratingsStrong, legacyStrong];
    const game = gameForSegments(wrestlers, [deepRatingsMatch(wrestlers)]);

    const resolved = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });

    assertRatingsBounded(matchRatingsFor(resolved.game.wrestlers, ratingsStrong.id));
    assertRatingsBounded(matchRatingsFor(resolved.game.wrestlers, legacyStrong.id));
    expect(resolved.result.segmentResults[0].internalMatchRatingsProgressionAudit?.clampEvents?.length).toBeGreaterThan(0);
  });

  it("keeps finance, social, title, rivalry, and score structures unchanged when progression is enabled", () => {
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
      rivalries: [activeRivalry(ratingsStrong, legacyStrong)],
      currentShow: [deepRatingsMatch(wrestlers, { championshipId: championship.id, rivalryId: "existing-rivalry" })],
    };

    const withoutProgression = runShow(game, { matchOutcomeModel: "deepRatings" });
    const withProgression = runShow(game, { matchOutcomeModel: "deepRatings", matchRatingsProgression: "enabled" });
    const baseFinance = withoutProgression.game.financeReports.at(-1);
    const progressedFinance = withProgression.game.financeReports.at(-1);

    expect(withProgression.result.segmentResults[0].score).toBe(withoutProgression.result.segmentResults[0].score);
    expect(withProgression.result.totalScore).toBe(withoutProgression.result.totalScore);
    expect(progressedFinance).toMatchObject({
      modelVersion: baseFinance?.modelVersion,
      grossRevenue: baseFinance?.grossRevenue,
      totalExpenses: baseFinance?.totalExpenses,
      profitLoss: baseFinance?.profitLoss,
    });
    expect(withProgression.game.socialPosts.map((post) => post.category)).toEqual(withoutProgression.game.socialPosts.map((post) => post.category));
    expect(JSON.stringify(withProgression.game.socialPosts)).not.toContain("internalOutcomeAudit");
    expect(JSON.stringify(withProgression.game.socialPosts)).not.toContain("internalMatchRatingsProgressionAudit");
    expect(withProgression.result.titleHistoryEvents).toEqual(withoutProgression.result.titleHistoryEvents);
    expect(withProgression.result.rivalryHistoryEvents).toEqual(withoutProgression.result.rivalryHistoryEvents);
  });
});
