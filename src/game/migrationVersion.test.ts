import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_VERSION, migrateSavedGameState } from "./migration";
import { createNewGame } from "./seed";

describe("save version migration", () => {
  it("adds the current save version to legacy saved game states", () => {
    const game = createNewGame();
    const migrated = migrateSavedGameState({ game, screen: "dashboard" });

    expect(migrated?.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated?.game.wrestlers).toHaveLength(game.wrestlers.length);
  });

  it("preserves current-version saved game states", () => {
    const game = createNewGame();
    const migrated = migrateSavedGameState({ saveVersion: CURRENT_SAVE_VERSION, game, screen: "booking" });

    expect(migrated?.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated?.screen).toBe("booking");
  });

  it("does not rewrite saves from a newer app version", () => {
    const game = createNewGame();

    expect(migrateSavedGameState({ saveVersion: CURRENT_SAVE_VERSION + 1, game, screen: "dashboard" })).toBeNull();
  });
});
