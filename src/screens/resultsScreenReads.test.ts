import { describe, expect, it } from "vitest";
import { createNewGame } from "../game/seed";
import { runShow } from "../game/scoring";
import type { GameState, Segment } from "../game/types";
import { buildResultsViewModel, buildTopSocialReaction } from "./resultsScreenReads";

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

  it("summarizes the top three player-brand trending topics in the social reaction card", () => {
    const run = runShow(createResultsGame());
    const reaction = buildTopSocialReaction(run.game, run.result);

    expect(reaction).toBeDefined();
    expect(reaction?.label).toBe("Trending On Your Brand");
    expect(reaction?.value).toBe(run.game.brandName);
    expect(reaction?.topicLines?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(reaction?.topicLines?.[0]).toMatch(/^1\./);
  });
});
