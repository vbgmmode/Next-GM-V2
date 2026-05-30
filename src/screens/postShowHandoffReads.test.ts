import { describe, expect, it } from "vitest";
import { createNewGame } from "../game/seed";
import { runShow } from "../game/scoring";
import type { GameState, Segment } from "../game/types";
import { buildPostShowHandoffViewModel } from "./postShowHandoffReads";

function createPostShowHandoffGame(week: number): GameState {
  const game = createNewGame();
  const [first, second] = game.wrestlers.filter((wrestler) => wrestler.division === "Mens");
  const currentShow: Segment[] = [
    {
      id: `post-show-handoff-${week}-match`,
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

describe("buildPostShowHandoffViewModel", () => {
  it("uses the actual calendar length for the advance label", () => {
    const penultimateWeek = createPostShowHandoffGame(49);
    const finalWeek = createPostShowHandoffGame(50);
    const penultimateResult = runShow(penultimateWeek);
    const finalResult = runShow(finalWeek);

    expect(penultimateWeek.calendar).toHaveLength(50);
    expect(buildPostShowHandoffViewModel(penultimateResult.game, penultimateResult.result).advanceLabel).toBe("Advance Week");
    expect(buildPostShowHandoffViewModel(finalResult.game, finalResult.result).advanceLabel).toBe("Season Review");
  });
});
