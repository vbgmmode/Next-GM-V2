import type { GameState } from "./types";
import { getRivalryStatus } from "./scoring";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function advanceGameWeek(game: GameState): GameState {
  return {
    ...game,
    currentWeek: game.currentWeek + 1,
    currentShow: [],
    wrestlers: game.wrestlers.map((wrestler) => ({
      ...wrestler,
      fatigue: clamp(wrestler.fatigue - 6),
    })),
    rivalries: game.rivalries.map((rivalry) => {
      const wasAdvancedThisWeek = rivalry.lastAdvancedWeek >= game.currentWeek;
      const stalePenalty = rivalry.status === "stale" ? 4 : 0;
      const heat = wasAdvancedThisWeek ? rivalry.heat : clamp(rivalry.heat - 4 - stalePenalty);
      const freshness = wasAdvancedThisWeek ? rivalry.freshness : clamp(rivalry.freshness - 3 - stalePenalty);

      return {
        ...rivalry,
        heat,
        freshness,
        weeksActive: rivalry.weeksActive + 1,
        status: getRivalryStatus(heat, freshness),
      };
    }),
  };
}
