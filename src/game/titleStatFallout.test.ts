import { describe, expect, it } from "vitest";
import { advanceGameWeek } from "./advanceWeek";
import { buildPostShowCauseLedger } from "./gameContextReads";
import { runShow } from "./scoring";
import { createNewGame, draftPool } from "./seed";
import {
  applyChampionPassiveCarry,
  applyTitleEventStatFallout,
  applyTitleSceneStatFallout,
  computeTitleDefenseDelta,
  computeTitleWinSpikeDelta,
  getChampionPassiveCarryDelta,
  TITLE_STAT_FALLOUT,
} from "./titleStatFallout";
import type { Championship, ChampionshipHistoryEvent, GameState, Segment, SegmentResult, Wrestler } from "./types";

function sameDivisionWrestlers(division: "Mens" | "Womens", count = 3) {
  const wrestlers = draftPool.filter((wrestler) => wrestler.division === division).slice(0, count);
  expect(wrestlers).toHaveLength(count);
  return wrestlers.map((wrestler, index) => ({
    ...wrestler,
    popularity: 50 + index,
    momentum: 50,
    fatigue: 0,
    morale: 70,
    injuryStatus: "healthy" as const,
    injuryWeeksRemaining: 0,
  }));
}

function createSinglesTitle(division: "Mens" | "Womens", championId?: string): Championship {
  return {
    id: `${division.toLowerCase()}-title`,
    name: division === "Mens" ? "World Championship" : "Women's Championship",
    division,
    eligibleMatchScope: "singles",
    prestige: 90,
    championIds: championId ? [championId] : [],
    contenderIds: [],
    reignStartWeek: 1,
    defenses: 0,
  };
}

function createTagTitle(championIds: string[] = []): Championship {
  return {
    id: "tag-title",
    name: "World Tag Team Championship",
    division: "Tag Team",
    eligibleMatchScope: "tag_team",
    prestige: 82,
    championIds,
    contenderIds: [],
    reignStartWeek: 1,
    defenses: 0,
  };
}

function createTitleMatchSegment(wrestlers: Wrestler[], championshipId: string, winnerId: string, id = "title-match"): Segment {
  return {
    id,
    type: "Match",
    participantIds: wrestlers.map((wrestler) => wrestler.id),
    championshipId,
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
    winnerId,
  };
}

function createTagTitleSegment(wrestlers: Wrestler[], championshipId: string): Segment {
  return {
    id: "tag-title-match",
    type: "Match",
    participantIds: wrestlers.map((wrestler) => wrestler.id),
    championshipId,
    segmentCatalogId: "M020",
    segmentDisplayName: "Tag Team Match",
    durationMinutes: 12,
    participantMin: 4,
    participantMax: 4,
    winnerId: wrestlers[2].id,
  };
}

function createGame(wrestlers: Wrestler[], championships: Championship[], segments: Segment[]): GameState {
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    championships,
    currentShow: segments,
  };
}

function historyEvent(
  overrides: Partial<ChampionshipHistoryEvent> & Pick<ChampionshipHistoryEvent, "eventType" | "championIds">,
): ChampionshipHistoryEvent {
  return {
    id: "event-1",
    championshipId: "mens-title",
    championshipName: "World Championship",
    previousChampionIds: [],
    weekNumber: 1,
    seasonNumber: 1,
    showName: "Raw",
    showType: "tv",
    segmentId: "title-match",
    note: "Test event",
    ...overrides,
  };
}

function segmentResult(overrides: Partial<SegmentResult> & Pick<SegmentResult, "segmentId" | "participantIds">): SegmentResult {
  return {
    type: "Match",
    participantNames: [],
    score: 80,
    momentumChanges: {},
    fatigueChanges: {},
    ...overrides,
  };
}

describe("titleStatFallout", () => {
  it("applies a larger win spike than a successful defense at the same segment score", () => {
    const winDelta = computeTitleWinSpikeDelta(80, "tv", 90);
    const defenseDelta = computeTitleDefenseDelta(80, "tv", 90);

    expect(winDelta.momentum).toBeGreaterThan(defenseDelta.momentum);
    expect(winDelta.popularity).toBeGreaterThan(defenseDelta.popularity);
  });

  it("applies singles title change fallout to winner and loser through runShow", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 2);
    const title = createSinglesTitle("Mens", wrestlers[0].id);
    const segment = createTitleMatchSegment(wrestlers, title.id, wrestlers[1].id);
    const game = createGame(wrestlers, [title], [segment]);
    const winnerBefore = wrestlers[1].popularity;
    const loserBefore = wrestlers[0].popularity;

    const { game: resolvedGame, result } = runShow(game);
    const winner = resolvedGame.wrestlers.find((wrestler) => wrestler.id === wrestlers[1].id)!;
    const loser = resolvedGame.wrestlers.find((wrestler) => wrestler.id === wrestlers[0].id)!;

    expect(winner.popularity).toBeGreaterThan(winnerBefore);
    expect(loser.popularity).toBeLessThan(loserBefore);
    expect(result.lockerRoomFallout?.titleStatNotes?.length).toBeGreaterThan(0);
    expect(result.lockerRoomFallout?.titleStatNotes?.some((note) => note.wrestlerId === wrestlers[1].id)).toBe(true);
  });

  it("applies vacant title win fallout to the new champion", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 2);
    const title = createSinglesTitle("Mens");
    const segment = createTitleMatchSegment(wrestlers, title.id, wrestlers[1].id, "vacant-title-match");
    const game = createGame(wrestlers, [title], [segment]);
    const beforePopularity = wrestlers[1].popularity;

    const { game: resolvedGame } = runShow(game);
    const winner = resolvedGame.wrestlers.find((wrestler) => wrestler.id === wrestlers[1].id)!;

    expect(winner.popularity).toBeGreaterThan(beforePopularity);
    expect(winner.momentum).toBeGreaterThan(50);
  });

  it("applies successful defense fallout smaller than a title win", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 2);
    const title = createSinglesTitle("Mens", wrestlers[0].id);
    const segment = createTitleMatchSegment(wrestlers, title.id, wrestlers[0].id, "defense-match");
    const game = createGame(wrestlers, [title], [segment]);
    const championBefore = { ...wrestlers[0] };

    const { game: resolvedDefenseGame } = runShow(game);
    const championAfterDefense = resolvedDefenseGame.wrestlers.find((wrestler) => wrestler.id === wrestlers[0].id)!;

    const winGame = createGame(
      sameDivisionWrestlers("Mens", 2),
      [createSinglesTitle("Mens", wrestlers[0].id)],
      [createTitleMatchSegment(wrestlers, title.id, wrestlers[1].id, "title-change-match")],
    );
    const { game: resolvedWinGame } = runShow(winGame);
    const championAfterWin = resolvedWinGame.wrestlers.find((wrestler) => wrestler.id === winGame.wrestlers[1].id)!;

    const defensePopGain = championAfterDefense.popularity - championBefore.popularity;
    const defenseMomentumGain = championAfterDefense.momentum - championBefore.momentum;
    const winPopGain = championAfterWin.popularity - winGame.wrestlers[1].popularity;
    const winMomentumGain = championAfterWin.momentum - winGame.wrestlers[1].momentum;

    expect(winPopGain).toBeGreaterThan(defensePopGain);
    expect(winMomentumGain).toBeGreaterThan(defenseMomentumGain);
  });

  it("updates both tag partners on a tag title change", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const title = createTagTitle();
    const segment = createTagTitleSegment(wrestlers, title.id);
    const game = createGame(wrestlers, [title], [segment]);
    const winners = [wrestlers[2], wrestlers[3]];
    const before = winners.map((wrestler) => wrestler.popularity);

    const { game: resolvedGame } = runShow(game);

    winners.forEach((wrestler, index) => {
      const updated = resolvedGame.wrestlers.find((entry) => entry.id === wrestler.id)!;
      expect(updated.popularity).toBeGreaterThan(before[index]);
    });
  });

  it("applies one non-match title scene nudge per wrestler per show", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 2);
    wrestlers[0] = { ...wrestlers[0], promoSkill: 95 };
    const title = createSinglesTitle("Mens", wrestlers[0].id);
    const promoOne: Segment = {
      id: "promo-one",
      type: "Promo",
      participantIds: [wrestlers[0].id],
      championshipId: title.id,
      durationMinutes: 5,
    };
    const promoTwo: Segment = {
      id: "promo-two",
      type: "Promo",
      participantIds: [wrestlers[0].id],
      championshipId: title.id,
      durationMinutes: 5,
    };
    const game = createGame(wrestlers, [title], [promoOne, promoTwo]);
    const before = wrestlers[0].popularity;

    const { game: resolvedGame, result } = runShow(game);
    const champion = resolvedGame.wrestlers.find((wrestler) => wrestler.id === wrestlers[0].id)!;
    const championNotes = result.lockerRoomFallout?.titleStatNotes?.filter((note) => note.wrestlerId === wrestlers[0].id) ?? [];
    const promoScore = result.segmentResults.find((segment) => segment.type === "Promo")?.score ?? 0;

    expect(promoScore).toBeGreaterThanOrEqual(70);
    expect(champion.popularity).toBeGreaterThan(before);
    expect(championNotes.length).toBe(1);
  });

  it("does not apply scene nudges to title matches", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 2);
    const title = createSinglesTitle("Mens", wrestlers[0].id);
    const segmentResults = [
      segmentResult({
        segmentId: "title-match",
        participantIds: wrestlers.map((wrestler) => wrestler.id),
        type: "Match",
        championshipId: title.id,
        score: 88,
      }),
    ];
    const { notes } = applyTitleSceneStatFallout(wrestlers, segmentResults, [title]);

    expect(notes).toHaveLength(0);
  });

  it("applies new champion week-one carry on advance week", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 2);
    wrestlers[1] = { ...wrestlers[1], lastBookedWeek: 1, consecutiveWeeksBooked: 1 };
    const title = createSinglesTitle("Mens", wrestlers[1].id);
    title.reignStartWeek = 1;
    title.championIds = [wrestlers[1].id];
    const game: GameState = {
      ...createGame(wrestlers, [title], []),
      currentWeek: 1,
      showHistory: [
        {
          id: "show-1",
          seasonNumber: 1,
          week: 1,
          brandName: "Raw",
          showName: "Raw",
          showType: "tv",
          totalScore: 80,
          segmentResults: [],
          biggestMomentumGain: { name: wrestlers[1].name, amount: 8 },
          biggestFatigueIncrease: { name: wrestlers[0].name, amount: 6 },
          titleNotes: [],
          rivalryNotes: [],
          titleHistoryEvents: [],
          rivalryHistoryEvents: [],
        },
      ],
    };
    const delta = getChampionPassiveCarryDelta(wrestlers[1], game);

    expect(delta).toEqual({
      momentum: TITLE_STAT_FALLOUT.newChampionCarryMomentum,
      popularity: TITLE_STAT_FALLOUT.newChampionCarryPopularity,
    });

    const advanced = advanceGameWeek(game);
    const champion = advanced.wrestlers.find((wrestler) => wrestler.id === wrestlers[1].id)!;

    expect(champion.momentum).toBe(wrestlers[1].momentum + TITLE_STAT_FALLOUT.newChampionCarryMomentum);
    expect(champion.popularity).toBe(wrestlers[1].popularity + TITLE_STAT_FALLOUT.newChampionCarryPopularity);
  });

  it("applies recent defense carry and stale reign erosion on advance week", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 1);
    const defendedTitle = createSinglesTitle("Mens", wrestlers[0].id);
    defendedTitle.reignStartWeek = 1;
    defendedTitle.defenses = 2;

    const defendedGame: GameState = {
      ...createGame(wrestlers, [defendedTitle], []),
      currentWeek: 4,
      championshipHistory: [
        historyEvent({
          eventType: "successful_defense",
          championIds: [wrestlers[0].id],
          weekNumber: 3,
        }),
      ],
    };

    expect(getChampionPassiveCarryDelta(wrestlers[0], defendedGame)).toEqual({
      momentum: TITLE_STAT_FALLOUT.recentDefenseCarryMomentum,
      popularity: TITLE_STAT_FALLOUT.recentDefenseCarryPopularity,
    });

    const staleTitle = createSinglesTitle("Mens", wrestlers[0].id);
    staleTitle.reignStartWeek = 1;
    staleTitle.defenses = 0;
    staleTitle.minimumDefenseFrequencyWeeks = 6;

    const staleGame: GameState = {
      ...createGame(wrestlers, [staleTitle], []),
      currentWeek: 6,
      championshipHistory: [],
    };

    expect(getChampionPassiveCarryDelta(wrestlers[0], staleGame)).toEqual({
      momentum: TITLE_STAT_FALLOUT.staleReignCarryMomentum,
      popularity: TITLE_STAT_FALLOUT.staleReignCarryPopularity,
    });
  });

  it("clamps popularity at 100 and 0", () => {
    const wrestlers: Wrestler[] = [
      {
        ...sameDivisionWrestlers("Mens", 1)[0],
        popularity: 99,
        momentum: 99,
      },
    ];
    const title = createSinglesTitle("Mens");
    const event = historyEvent({
      eventType: "title_change",
      championIds: [wrestlers[0].id],
      previousChampionIds: [],
    });
    const { wrestlers: updated } = applyTitleEventStatFallout(
      wrestlers,
      [event],
      [segmentResult({ segmentId: "title-match", participantIds: [wrestlers[0].id], score: 90 })],
      [title],
    );

    expect(updated[0].popularity).toBeLessThanOrEqual(100);
    expect(updated[0].momentum).toBeLessThanOrEqual(100);

    const loserWrestlers: Wrestler[] = [
      {
        ...sameDivisionWrestlers("Mens", 1)[0],
        popularity: 1,
        momentum: 1,
      },
    ];
    const lossEvent = historyEvent({
      eventType: "title_change",
      championIds: ["other-id"],
      previousChampionIds: [loserWrestlers[0].id],
    });
    const { wrestlers: losers } = applyTitleEventStatFallout(
      loserWrestlers,
      [lossEvent],
      [segmentResult({ segmentId: "title-match", participantIds: [loserWrestlers[0].id, "other-id"], score: 80 })],
      [title],
    );

    expect(losers[0].popularity).toBeGreaterThanOrEqual(0);
    expect(losers[0].momentum).toBeGreaterThanOrEqual(0);
  });

  it("surfaces title stat notes in the post-show cause ledger", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 2);
    const title = createSinglesTitle("Mens", wrestlers[0].id);
    const segment = createTitleMatchSegment(wrestlers, title.id, wrestlers[1].id);
    const game = createGame(wrestlers, [title], [segment]);

    const { game: resolvedGame, result } = runShow(game);
    const sections = buildPostShowCauseLedger(resolvedGame, result);

    expect(sections.some((section) => section.items.some((item) => item.label === "Championship Fallout"))).toBe(true);
  });

  it("skips champion carry when the wrestler has a major injury", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 1);
    const injuredChampion = {
      ...wrestlers[0],
      injuryStatus: "major" as const,
    };
    const title = createSinglesTitle("Mens", injuredChampion.id);
    title.reignStartWeek = 1;
    const game: GameState = {
      ...createGame([injuredChampion], [title], []),
      currentWeek: 1,
    };

    expect(applyChampionPassiveCarry(injuredChampion, game)).toEqual(injuredChampion);
  });
});
