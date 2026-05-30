import { describe, expect, it } from "vitest";
import { createNewGame } from "../game/seed";
import { runShow } from "../game/scoring";
import type { GameState, Segment } from "../game/types";
import { buildResultsViewModel } from "./resultsScreenReads";

function createResultsGame(): GameState {
  const game = createNewGame();
  const [first, second] = game.wrestlers.filter((wrestler) => wrestler.division === "Mens");
  const currentShow: Segment[] = [
    {
      id: "results-fallout-match",
      type: "Match",
      participantIds: [first.id, second.id],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
    },
  ];

  return {
    ...game,
    currentShow,
  };
}

describe("buildResultsViewModel", () => {
  it("keeps the top fallout package populated with two to four grounded beats", () => {
    const run = runShow(createResultsGame());
    const model = buildResultsViewModel(run.game, run.result);

    expect(model.falloutBeats.length).toBeGreaterThanOrEqual(2);
    expect(model.falloutBeats.length).toBeLessThanOrEqual(4);
    expect(model.headlineBeat.detail).not.toHaveLength(0);
    expect(model.nextWeekPressureBeat.detail).not.toHaveLength(0);
  });
});
