import { getWrestlerNames, isTagChampionship } from "../booking/bookingUtils";
import { createUniqueDomainId } from "./domainIds";
import { getCurrentCalendarWeek } from "./scoring";
import { wrestlerFitsChampionshipDivision } from "./titleCatalog";
import type { ChampionshipHistoryEvent, GameState, Wrestler } from "./types";

export function revokeChampionshipInGame(game: GameState, championshipId: string) {
  const championship = game.championships.find((title) => title.id === championshipId);

  if (!championship || !championship.championIds.length) {
    return game;
  }

  const calendarWeek = getCurrentCalendarWeek(game);
  const previousChampionIds = [...championship.championIds];
  const note = `${getWrestlerNames(previousChampionIds, game.wrestlers)} had the ${championship.name} revoked by the GM office. The title is vacant until the player books a new champion.`;
  const event: ChampionshipHistoryEvent = {
    id: createUniqueDomainId("title-revoked", [game.seasonNumber, game.currentWeek, championship.id], game.championshipHistory.map((item) => item.id)),
    championshipId: championship.id,
    championshipName: championship.name,
    eventType: "revoked",
    championIds: [],
    previousChampionIds,
    weekNumber: game.currentWeek,
    seasonNumber: game.seasonNumber,
    showName: calendarWeek.showName,
    showType: calendarWeek.showType,
    note,
  };

  return {
    ...game,
    championships: game.championships.map((title) =>
      title.id === championshipId
        ? {
            ...title,
            championIds: [],
            defenses: 0,
            reignStartWeek: game.currentWeek,
          }
        : title,
    ),
    championshipHistory: [...(game.championshipHistory ?? []), event],
    currentShow: game.currentShow.map((segment) => (segment.championshipId === championshipId ? { ...segment, championshipId: undefined } : segment)),
  };
}

export function assignChampionshipInGame(game: GameState, championshipId: string, championIds: string[]) {
  const championship = game.championships.find((title) => title.id === championshipId);

  if (!championship || championship.championIds.length) {
    return game;
  }

  const requiredChampionCount = isTagChampionship(championship) ? 2 : 1;
  const nextChampionIds = championIds.slice(0, requiredChampionCount);

  if (nextChampionIds.length !== requiredChampionCount) {
    return game;
  }

  const nextChampions = nextChampionIds
    .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler && wrestlerFitsChampionshipDivision(wrestler, championship)));

  if (nextChampions.length !== requiredChampionCount) {
    return game;
  }

  const calendarWeek = getCurrentCalendarWeek(game);
  const championLabel = getWrestlerNames(nextChampionIds, game.wrestlers);
  const note = `${championLabel} ${nextChampionIds.length === 1 ? "was" : "were"} assigned the vacant ${championship.name} by the GM office.`;
  const event: ChampionshipHistoryEvent = {
    id: createUniqueDomainId("title-assigned", [game.seasonNumber, game.currentWeek, championship.id, ...nextChampionIds], game.championshipHistory.map((item) => item.id)),
    championshipId: championship.id,
    championshipName: championship.name,
    eventType: "assigned",
    championIds: nextChampionIds,
    previousChampionIds: [],
    weekNumber: game.currentWeek,
    seasonNumber: game.seasonNumber,
    showName: calendarWeek.showName,
    showType: calendarWeek.showType,
    note,
  };

  return {
    ...game,
    championships: game.championships.map((title) =>
      title.id === championshipId
        ? {
            ...title,
            championIds: nextChampionIds,
            contenderIds: (title.contenderIds ?? []).filter((id) => !nextChampionIds.includes(id)),
            defenses: 0,
            reignStartWeek: game.currentWeek,
          }
        : title,
    ),
    championshipHistory: [...(game.championshipHistory ?? []), event],
  };
}
