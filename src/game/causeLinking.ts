import type { ChampionshipHistoryEvent, DurableGameEvent, FinanceReport, GameState, RivalryHistoryEvent, ShowResult, SocialPost } from "./types";

export type ResolvedShowCauseLinks = {
  result: ShowResult;
  event?: DurableGameEvent;
  financeReport?: FinanceReport;
  socialPosts: SocialPost[];
  titleHistoryEvents: ChampionshipHistoryEvent[];
  rivalryHistoryEvents: RivalryHistoryEvent[];
};

function findResolvedShowEvent(game: GameState, result: ShowResult) {
  return (game.eventLedger ?? []).find((event) => event.type === "show_resolved" && event.relatedIds.showResultId === result.id);
}

function getFinanceReportForResolvedShow(game: GameState, result: ShowResult) {
  return game.financeReports.find((report) => report.id === `${result.id}-finance`);
}

function getSocialPostsForResolvedShow(game: GameState, result: ShowResult, event?: DurableGameEvent) {
  const linkedPosts = game.socialPosts.filter((post) => post.resultId === result.id || (event?.id !== undefined && post.eventId === event.id));

  if (linkedPosts.length) {
    return linkedPosts;
  }

  return game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week);
}

function getTitleHistoryEventsForResolvedShow(game: GameState, result: ShowResult, event?: DurableGameEvent) {
  const resultEvents = result.titleHistoryEvents ?? [];

  if (resultEvents.length) {
    return resultEvents;
  }

  const linkedIds = new Set(event?.relatedIds.titleHistoryEventIds ?? []);
  if (linkedIds.size) {
    return (game.championshipHistory ?? []).filter((historyEvent) => linkedIds.has(historyEvent.id));
  }

  return [];
}

function getRivalryHistoryEventsForResolvedShow(game: GameState, result: ShowResult, event?: DurableGameEvent) {
  const resultEvents = result.rivalryHistoryEvents ?? [];

  if (resultEvents.length) {
    return resultEvents;
  }

  const linkedIds = new Set(event?.relatedIds.rivalryHistoryEventIds ?? []);
  if (linkedIds.size) {
    return (game.rivalryHistory ?? []).filter((historyEvent) => linkedIds.has(historyEvent.id));
  }

  return [];
}

export function getResolvedShowCauseLinks(game: GameState, result: ShowResult): ResolvedShowCauseLinks {
  const event = findResolvedShowEvent(game, result);

  return {
    result,
    event,
    financeReport: getFinanceReportForResolvedShow(game, result),
    socialPosts: getSocialPostsForResolvedShow(game, result, event),
    titleHistoryEvents: getTitleHistoryEventsForResolvedShow(game, result, event),
    rivalryHistoryEvents: getRivalryHistoryEventsForResolvedShow(game, result, event),
  };
}
