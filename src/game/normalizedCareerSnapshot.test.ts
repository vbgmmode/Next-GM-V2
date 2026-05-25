import { describe, expect, it } from "vitest";
import { toNormalizedCareerSnapshot } from "./normalizedCareerSnapshot";
import { createNewGame } from "./seed";
import { runShow } from "./scoring";
import type { ChampionshipHistoryEvent, FinanceReport, GameState, RivalryHistoryEvent, Segment, ShowResult } from "./types";

function bookedGame() {
  const game = createNewGame();
  const participantIds = game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id);
  const currentShow: Segment[] = [
    {
      id: "segment-1",
      type: "Match",
      participantIds,
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
    },
    {
      id: "segment-2",
      type: "Promo",
      participantIds: [participantIds[0]],
      segmentCatalogId: "P001",
      segmentDisplayName: "In-Ring Promo",
      durationMinutes: 6,
      participantMin: 1,
      participantMax: 1,
    },
  ];

  return { ...game, currentShow };
}

function legacyResult(): ShowResult {
  const titleEvent: ChampionshipHistoryEvent = {
    id: "title-event-1",
    championshipId: "world-title",
    championshipName: "World Title",
    eventType: "title_change",
    championIds: ["ace"],
    previousChampionIds: ["breaker"],
    weekNumber: 2,
    seasonNumber: 1,
    showName: "Raw Week 2",
    showType: "tv",
    segmentId: "segment-1",
    note: "Ace won the title.",
  };
  const rivalryEvent: RivalryHistoryEvent = {
    id: "rivalry-event-1",
    rivalryId: "rivalry-1",
    rivalryName: "Ace vs Breaker",
    participantIds: ["ace", "breaker"],
    weekNumber: 2,
    seasonNumber: 1,
    showName: "Raw Week 2",
    showType: "tv",
    eventType: "heated_up",
    note: "The rivalry heated up.",
  };

  return {
    id: "show-1",
    seasonNumber: 1,
    week: 2,
    brandName: "Raw",
    showName: "Raw Week 2",
    showType: "tv",
    totalScore: 80,
    segmentResults: [
      {
        segmentId: "segment-1",
        type: "Match",
        participantNames: ["Ace", "Breaker"],
        participantIds: ["ace", "breaker"],
        score: 80,
        momentumChanges: {},
        fatigueChanges: {},
      },
    ],
    biggestMomentumGain: { name: "Ace", amount: 5 },
    biggestFatigueIncrease: { name: "Breaker", amount: 5 },
    titleNotes: [],
    rivalryNotes: [],
    titleHistoryEvents: [titleEvent],
    rivalryHistoryEvents: [rivalryEvent],
  };
}

function legacyFinanceReport(showResult: ShowResult): FinanceReport {
  return {
    id: `${showResult.id}-finance`,
    seasonNumber: showResult.seasonNumber,
    weekNumber: showResult.week,
    showName: showResult.showName,
    showType: showResult.showType,
    showScore: showResult.totalScore,
    attendance: 5000,
    ticketRevenue: 10000,
    merchRevenue: 4000,
    mediaRevenue: 3000,
    productionCost: 7000,
    profitLoss: 10000,
    endingMoney: 2010000,
    notes: [],
  };
}

describe("normalized career snapshot", () => {
  it("handles an empty new game without changing save shape", () => {
    const game = createNewGame();
    const snapshot = toNormalizedCareerSnapshot(game);

    expect(snapshot.brands[0]).toMatchObject({ id: game.playerBrand.id, ownerType: "player" });
    expect(snapshot.wrestlers).toHaveLength(game.wrestlers.length);
    expect(snapshot.showResults).toEqual([]);
    expect(snapshot.segmentResults).toEqual([]);
  });

  it("projects resolved shows, segment results, social posts, and direct refs", () => {
    const resolved = runShow(bookedGame());
    const snapshot = toNormalizedCareerSnapshot(resolved.game);
    const result = resolved.result;
    const event = resolved.game.eventLedger.at(-1);

    expect(snapshot.showResults).toContainEqual(expect.objectContaining({ id: result.id, eventId: event?.id }));
    expect(snapshot.segmentResults.map((segment) => segment.resultId)).toEqual(result.segmentResults.map(() => result.id));
    expect(snapshot.financeReports.at(-1)).toMatchObject({
      resultId: result.id,
      eventId: event?.id,
      linkSource: "direct",
    });
    expect(snapshot.socialPosts.every((post) => post.resultId === result.id && post.eventId === event?.id)).toBe(true);
  });

  it("derives legacy finance and history links without inventing persisted refs", () => {
    const game = createNewGame();
    const showResult = legacyResult();
    const legacyGame: GameState = {
      ...game,
      showHistory: [showResult],
      financeReports: [legacyFinanceReport(showResult)],
      championshipHistory: showResult.titleHistoryEvents,
      rivalryHistory: showResult.rivalryHistoryEvents,
    };
    const snapshot = toNormalizedCareerSnapshot(legacyGame);

    expect(snapshot.financeReports[0]).toMatchObject({ resultId: showResult.id, linkSource: "derived" });
    expect(snapshot.titleHistoryEvents[0]).toMatchObject({ resultId: showResult.id, linkSource: "derived" });
    expect(snapshot.segmentResults[0]).toMatchObject({ resultId: showResult.id, segmentId: "segment-1" });
  });
});
