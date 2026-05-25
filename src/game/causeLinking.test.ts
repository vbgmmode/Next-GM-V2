import { describe, expect, it } from "vitest";
import { getResolvedShowCauseLinks } from "./causeLinking";
import { createShowResolvedEvent } from "./eventLedger";
import { createNewGame } from "./seed";
import type { ChampionshipHistoryEvent, FinanceReport, GameState, RivalryHistoryEvent, ShowResult, SocialPost } from "./types";

function result(overrides: Partial<ShowResult> = {}): ShowResult {
  return {
    id: "show-1",
    seasonNumber: 1,
    week: 3,
    brandName: "Raw",
    showName: "Raw Week 3",
    showType: "tv",
    totalScore: 82,
    segmentResults: [
      {
        segmentId: "segment-1",
        type: "Match",
        participantNames: ["Ace", "Breaker"],
        participantIds: ["ace", "breaker"],
        score: 86,
        momentumChanges: {},
        fatigueChanges: {},
      },
    ],
    biggestMomentumGain: { name: "Ace", amount: 8 },
    biggestFatigueIncrease: { name: "Breaker", amount: 9 },
    titleNotes: [],
    rivalryNotes: [],
    titleHistoryEvents: [],
    rivalryHistoryEvents: [],
    ...overrides,
  };
}

function financeReport(showResult: ShowResult): FinanceReport {
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
    notes: ["Strong score lifted the house."],
  };
}

function socialPost(id: string, showResult: ShowResult, overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id,
    seasonNumber: showResult.seasonNumber,
    weekNumber: showResult.week,
    showName: showResult.showName,
    resultId: showResult.id,
    category: "fan_praise",
    author: "@Fan",
    text: "Resolved reaction.",
    tone: "excited",
    relatedWrestlerIds: ["ace"],
    ...overrides,
  };
}

function titleEvent(showResult: ShowResult): ChampionshipHistoryEvent {
  return {
    id: "title-event-1",
    championshipId: "world-title",
    championshipName: "World Title",
    eventType: "title_change",
    championIds: ["ace"],
    previousChampionIds: ["breaker"],
    weekNumber: showResult.week,
    seasonNumber: showResult.seasonNumber,
    showName: showResult.showName,
    showType: showResult.showType,
    segmentId: "segment-1",
    note: "Ace won the World Title.",
  };
}

function rivalryEvent(showResult: ShowResult): RivalryHistoryEvent {
  return {
    id: "rivalry-event-1",
    rivalryId: "rivalry-1",
    rivalryName: "Ace vs Breaker",
    participantIds: ["ace", "breaker"],
    weekNumber: showResult.week,
    seasonNumber: showResult.seasonNumber,
    showName: showResult.showName,
    showType: showResult.showType,
    eventType: "heated_up",
    note: "The rivalry heated up.",
  };
}

function gameWithResolvedLinks(showResult: ShowResult): GameState {
  const game = createNewGame();
  const event = createShowResolvedEvent(game, showResult);

  return {
    ...game,
    financeReports: [financeReport(showResult)],
    socialPosts: [
      socialPost("linked-post", showResult, { eventId: event.id }),
      socialPost("same-week-unlinked", showResult, { resultId: undefined, eventId: undefined }),
    ],
    championshipHistory: showResult.titleHistoryEvents,
    rivalryHistory: showResult.rivalryHistoryEvents,
    eventLedger: [event],
  };
}

describe("resolved show cause linking", () => {
  it("collects finance, social, history, and durable event references for a resolved show", () => {
    const showResult = result({
      titleHistoryEvents: [titleEvent(result())],
      rivalryHistoryEvents: [rivalryEvent(result())],
    });
    const game = gameWithResolvedLinks(showResult);
    const links = getResolvedShowCauseLinks(game, showResult);

    expect(links.event?.relatedIds.showResultId).toBe(showResult.id);
    expect(links.financeReport?.id).toBe(`${showResult.id}-finance`);
    expect(links.socialPosts.map((post) => post.id)).toEqual(["linked-post"]);
    expect(links.titleHistoryEvents.map((event) => event.id)).toEqual(["title-event-1"]);
    expect(links.rivalryHistoryEvents.map((event) => event.id)).toEqual(["rivalry-event-1"]);
  });

  it("falls back to same-week social posts for legacy saves without result links", () => {
    const showResult = result();
    const game = {
      ...createNewGame(),
      socialPosts: [socialPost("legacy-post", showResult, { resultId: undefined, eventId: undefined })],
      eventLedger: [],
    };
    const links = getResolvedShowCauseLinks(game, showResult);

    expect(links.socialPosts.map((post) => post.id)).toEqual(["legacy-post"]);
  });
});
