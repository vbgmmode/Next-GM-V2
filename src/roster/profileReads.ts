import { isSinglesChampionship } from "../booking/bookingUtils";
import { getCurrentCalendarWeek } from "../game/scoring";
import { getTitleDivisionScene } from "../game/gameContextReads";
import { deriveRivalryStage, getRivalryStoryline, getRivalryRelationship } from "../game/rivalryCatalog";
import {
  formatChampionshipEventType,
  formatRivalryEventType,
  formatRivalryStatus,
  getRivalryHistory,
  hasPlePayoff,
} from "../game/storyContextReads";
import { wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type {
  Championship,
  ChampionshipHistoryEvent,
  GameState,
  Rivalry,
  RivalryHistoryEvent,
  ShowType,
  SocialCategory,
  Wrestler,
} from "../game/types";
import type { WrestlerAppearance } from "./rosterTypes";
import { getWrestlerChampionships, getWrestlerRivalries } from "./rosterReads";

function getShowTypeLabel(showType: ShowType) {
  if (showType === "ple") {
    return "PLE";
  }

  return "TV";
}

export function formatSocialCategory(category: SocialCategory) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatHistoryStamp(event: Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "seasonNumber" | "weekNumber" | "showName" | "showType">) {
  const showLabel = event.showName ? ` · ${event.showName}${event.showType ? ` (${getShowTypeLabel(event.showType)})` : ""}` : "";
  return `S${event.seasonNumber} W${event.weekNumber}${showLabel}`;
}

export function getWrestlerTitleSceneRows(wrestler: Wrestler, game: GameState) {
  return game.championships
    .filter((championship) => championship.eligibleMatchScope !== "tag_team")
    .filter((championship) => wrestlerFitsChampionshipDivision(wrestler, championship) || championship.championIds.includes(wrestler.id))
    .map((championship) => {
      const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
      const isChampion = championship.championIds.includes(wrestler.id);
      const topIndex = scene.topContenders.findIndex((contender: { id: string }) => contender.id === wrestler.id);
      const risingIndex = scene.risingContenders.findIndex((contender: { id: string }) => contender.id === wrestler.id);
      const relevance = isChampion
        ? "Champion"
        : topIndex >= 0
          ? `Top Contender ${topIndex + 1}`
          : risingIndex >= 0
            ? "Rising Contender"
            : "Eligible Roster";

      return {
        championship,
        relevance,
        detail: `${championship.brand ?? "Brand"} · ${championship.division} · ${championship.titleLevel ?? "Title"}`,
      };
    });
}

export function getWrestlerTitleHistory(game: GameState, wrestlerId: string, limit = 5) {
  return [...(game.championshipHistory ?? [])]
    .filter((event) => event.championIds.includes(wrestlerId) || Boolean(event.previousChampionIds?.includes(wrestlerId)))
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

export function getWrestlerRivalryHistory(game: GameState, wrestlerId: string, limit = 5) {
  const majorEventTypes: RivalryHistoryEvent["eventType"][] = ["started", "heated_up", "became_stale", "ended", "ple_payoff"];

  return [...(game.rivalryHistory ?? [])]
    .filter((event) => event.participantIds.includes(wrestlerId) && majorEventTypes.includes(event.eventType))
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

export function getRecentWrestlerAppearances(game: GameState, wrestlerId: string, limit = 5): WrestlerAppearance[] {
  return [...game.showHistory]
    .reverse()
    .flatMap((result) =>
      result.segmentResults
        .filter((segment) => segment.participantIds.includes(wrestlerId))
        .map((segment) => ({
          id: `${result.id}-${segment.segmentId}`,
          week: result.week,
          showName: result.showName,
          type: segment.type,
          score: segment.score,
          note: segment.titleNote ?? segment.rivalryNote ?? segment.recapNote,
        })),
    )
    .slice(0, limit);
}

export function getRecentWrestlerSocialPosts(game: GameState, wrestlerId: string, limit = 5) {
  return game.socialPosts
    .filter((post) => post.relatedWrestlerIds.includes(wrestlerId))
    .slice(-limit)
    .reverse();
}

export function getRivalryStageContext(game: GameState, rivalry: Rivalry) {
  const calendarWeek = getCurrentCalendarWeek(game);

  return deriveRivalryStage(rivalry, {
    hasPlePayoff: hasPlePayoff(game, rivalry.id),
    isGoHome: calendarWeek.isGoHome,
    isPle: calendarWeek.showType === "ple",
  });
}

function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name)
    .filter(Boolean)
    .join(" / ");
}

export function getRivalryTitleRelevance(rivalry: Rivalry, championships: Championship[], wrestlers: Wrestler[]) {
  const storyline = getRivalryStoryline(rivalry);
  const participantIds = new Set(rivalry.participantIds);

  for (const championship of championships.filter(isSinglesChampionship)) {
    const championId = championship.championIds[0];
    const hasChampion = participantIds.has(championId);
    const eligibleChallengers = rivalry.participantIds
      .filter((id) => id !== championId)
      .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
      .filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
      .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship));

    if (hasChampion && eligibleChallengers.length) {
      return {
        label: storyline.titleFit === "Title" || rivalry.stakes === "title" ? "Title Rivalry" : "Title-Relevant",
        detail: `${championship.name}: ${getWrestlerNames([championId], wrestlers)} vs ${eligibleChallengers.map((wrestler) => wrestler.name).join(" / ")}`,
      };
    }
  }

  if (storyline.titleFit.includes("Title") || storyline.titleFit.includes("title")) {
    return {
      label: "Title-Friendly Story",
      detail: `${storyline.name} can connect to a title scene when champion and contender fit the same division.`,
    };
  }

  return undefined;
}

export { formatChampionshipEventType, formatRivalryEventType, formatRivalryStatus, getRivalryHistory };
