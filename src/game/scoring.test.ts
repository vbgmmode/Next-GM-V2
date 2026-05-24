import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "./seed";
import { runShow } from "./scoring";
import type { Rivalry, Segment, Wrestler } from "./types";

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
