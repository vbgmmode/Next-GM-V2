import { describe, expect, it } from "vitest";
import { commitResolvedShow } from "./showResolutionCommit";
import { createNewGame } from "./seed";
import type { ChampionshipHistoryEvent, FinanceReport, RivalryHistoryEvent, ShowResult } from "./types";

function result(): ShowResult {
  return {
    id: "show-1",
    seasonNumber: 1,
    week: 2,
    brandName: "Raw",
    showName: "Raw Week 2",
    showType: "tv",
    totalScore: 84,
    segmentResults: [
      {
        segmentId: "segment-1",
        type: "Match",
        participantNames: ["Ace", "Breaker"],
        participantIds: ["ace", "breaker"],
        score: 84,
        momentumChanges: {},
        fatigueChanges: {},
      },
    ],
    biggestMomentumGain: { name: "Ace", amount: 6 },
    biggestFatigueIncrease: { name: "Breaker", amount: 8 },
    titleNotes: [],
    rivalryNotes: [],
    titleHistoryEvents: [],
    rivalryHistoryEvents: [],
  };
}

function financeReport(showResult: ShowResult): FinanceReport {
  return {
    id: `${showResult.id}-finance`,
    resultId: showResult.id,
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

describe("show resolution commit", () => {
  it("appends resolved show records and attaches direct cause refs", () => {
    const game = createNewGame();
    const showResult = result();
    const commit = commitResolvedShow({
      game,
      result: showResult,
      wrestlers: game.wrestlers,
      socialInbox: game.socialInbox,
      championships: game.championships,
      rivalries: game.rivalries,
      championshipHistoryEvents: [titleEvent(showResult)],
      rivalryHistoryEvents: [rivalryEvent(showResult)],
      financeReport: financeReport(showResult),
    });

    expect(commit.event.relatedIds.showResultId).toBe(showResult.id);
    expect(commit.financeReport).toMatchObject({
      resultId: showResult.id,
      eventId: commit.event.id,
    });
    expect(commit.championshipHistoryEvents[0]).toMatchObject({
      resultId: showResult.id,
      eventId: commit.event.id,
    });
    expect(commit.rivalryHistoryEvents[0]).toMatchObject({
      resultId: showResult.id,
      eventId: commit.event.id,
    });
    expect(commit.result.titleHistoryEvents[0].eventId).toBe(commit.event.id);
    expect(commit.result.rivalryHistoryEvents[0].eventId).toBe(commit.event.id);
    expect(commit.gameBeforeCpuSocial.eventLedger).toHaveLength(game.eventLedger.length + 1);
    expect(commit.gameBeforeCpuSocial.financeReports.at(-1)?.eventId).toBe(commit.event.id);
    expect(commit.gameBeforeCpuSocial.showHistory.at(-1)?.id).toBe(showResult.id);
  });
});
