import type { ChampionshipHistoryEvent, GameState, Rivalry, RivalryHistoryEvent } from "./types";

export function getChampionshipHistory(game: GameState, championshipId: string, limit = 5) {
  return [...(game.championshipHistory ?? [])]
    .filter((event) => event.championshipId === championshipId)
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

export function getChampionshipHistoryAgeWeeks(game: GameState, event: ChampionshipHistoryEvent) {
  const seasonDelta = Math.max(0, game.seasonNumber - event.seasonNumber);
  return Math.max(0, seasonDelta * 12 + game.currentWeek - event.weekNumber);
}

export function formatChampionshipEventType(eventType: ChampionshipHistoryEvent["eventType"]) {
  return eventType === "title_change" ? "Title Change" : "Successful Defense";
}

export function formatRivalryEventType(eventType: RivalryHistoryEvent["eventType"]) {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRivalryStatus(status: Rivalry["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getRivalryHistory(game: GameState, rivalryId: string, limit = 5) {
  return [...(game.rivalryHistory ?? [])]
    .filter((event) => event.rivalryId === rivalryId)
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

export function hasPlePayoff(game: GameState, rivalryId: string) {
  return (game.rivalryHistory ?? []).some((event) => event.rivalryId === rivalryId && event.eventType === "ple_payoff");
}

export function getRivalryHistoryAgeWeeks(game: GameState, event: RivalryHistoryEvent) {
  const seasonDelta = Math.max(0, game.seasonNumber - event.seasonNumber);
  return Math.max(0, seasonDelta * 12 + game.currentWeek - event.weekNumber);
}
