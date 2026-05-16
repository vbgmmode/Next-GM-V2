import type { GameState } from "./types";
import { getRivalryStatus } from "./scoring";
import { createSeasonCalendar } from "./seed";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function advanceGameWeek(game: GameState): GameState {
  const latestResult = game.showHistory[game.showHistory.length - 1];
  const completedCalendar = game.calendar.map((week) =>
    week.weekNumber === game.currentWeek
      ? {
          ...week,
          completed: true,
          resultId: latestResult?.id,
        }
      : week,
  );
  const isSeasonFinaleComplete = game.currentWeek >= 12;

  return {
    ...game,
    currentWeek: isSeasonFinaleComplete ? game.currentWeek : game.currentWeek + 1,
    calendar: completedCalendar,
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

export function startNextSeason(game: GameState): GameState {
  return {
    ...game,
    seasonNumber: game.seasonNumber + 1,
    seasonStartingMoney: game.money,
    currentWeek: 1,
    calendar: createSeasonCalendar(),
    currentShow: [],
  };
}
