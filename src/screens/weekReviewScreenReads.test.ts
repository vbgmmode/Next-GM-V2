import { describe, expect, it } from "vitest";
import { createNewGame } from "../game/seed";
import { runShow } from "../game/scoring";
import type { GameState, Segment } from "../game/types";
import { buildWeekReviewViewModel } from "./weekReviewScreenReads";

function createWeekReviewGame(week: number): GameState {
  const game = createNewGame();
  const [first, second] = game.wrestlers.filter((wrestler) => wrestler.division === "Mens");
  const currentShow: Segment[] = [
    {
      id: `week-review-${week}-match`,
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
    currentWeek: week,
  };
}

describe("buildWeekReviewViewModel", () => {
  it("uses the actual calendar length for the advance label", () => {
    const penultimateWeek = createWeekReviewGame(49);
    const finalWeek = createWeekReviewGame(50);
    const penultimateResult = runShow(penultimateWeek);
    const finalResult = runShow(finalWeek);

    expect(penultimateWeek.calendar).toHaveLength(50);
    expect(buildWeekReviewViewModel(penultimateResult.game, penultimateResult.result).advanceLabel).toBe("Advance Week");
    expect(buildWeekReviewViewModel(finalResult.game, finalResult.result).advanceLabel).toBe("Season Review");
  });
});
