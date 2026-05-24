import { describe, expect, it } from "vitest";
import { runShow, scoreSegment } from "./scoring";
import { createNewGame, draftPool } from "./seed";
import type { GameState, Rivalry, Segment, Wrestler } from "./types";

function createRoster(): Wrestler[] {
  return draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, 8).map((wrestler, index) => ({
    ...wrestler,
    popularity: 62 - index,
    momentum: 54,
    fatigue: 8,
    morale: 74,
    ringSkill: 64 - index,
    promoSkill: 58 - index,
    appearancesThisSeason: 0,
    lastBookedWeek: 0,
    consecutiveWeeksBooked: 0,
    injuryStatus: "healthy",
    injuryDescription: undefined,
    injuryWeeksRemaining: 0,
    injuryOccurredWeek: undefined,
  }));
}

function createGame(): GameState {
  const wrestlers = createRoster();
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    championships: [],
    rivalries: [],
    currentShow: [],
  };
}

function singlesSegment(game: GameState, stipulationId?: string, rivalryId?: string): Segment {
  const [first, second] = game.wrestlers;

  return {
    id: stipulationId ? `match-${stipulationId}` : "match-standard",
    type: "Match",
    participantIds: [first.id, second.id],
    winnerId: first.id,
    rivalryId,
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
    stipulationId,
  };
}

describe("stipulation scoring", () => {
  it("keeps raw segment scoring unchanged and applies stipulation score/fatigue only during runShow", () => {
    const game = createGame();
    const standardSegment = singlesSegment(game);
    const stipulationSegment = singlesSegment(game, "tlc_match");

    expect(scoreSegment(stipulationSegment, game.wrestlers, [], [])).toBe(scoreSegment(standardSegment, game.wrestlers, [], []));

    const standardResult = runShow({ ...game, currentShow: [standardSegment] }).result.segmentResults[0];
    const stipulationResult = runShow({ ...game, currentShow: [stipulationSegment] }).result.segmentResults[0];
    const firstId = game.wrestlers[0].id;

    expect(stipulationResult.score - standardResult.score).toBe(4);
    expect(stipulationResult.fatigueChanges[firstId] - standardResult.fatigueChanges[firstId]).toBe(4);
  });

  it("adds bounded stipulation heat to resolved rivalry movement", () => {
    const game = createGame();
    const rivalry: Rivalry = {
      id: "stip-rivalry",
      name: "Stip Rivalry",
      participantIds: game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      heat: 55,
      freshness: 80,
      weeksActive: 2,
      lastAdvancedWeek: 0,
      status: "steady",
      stakes: "personal",
      structure: "singles",
    };
    const standardGame = { ...game, rivalries: [{ ...rivalry }], currentShow: [singlesSegment(game, undefined, rivalry.id)] };
    const stipulationGame = { ...game, rivalries: [{ ...rivalry }], currentShow: [singlesSegment(game, "steel_cage", rivalry.id)] };
    const standardResolved = runShow(standardGame).game.rivalries[0];
    const stipulationResolved = runShow(stipulationGame).game.rivalries[0];

    expect(stipulationResolved.heat).toBeGreaterThan(standardResolved.heat);
    expect(stipulationResolved.heat - standardResolved.heat).toBeLessThanOrEqual(5);
  });
});
