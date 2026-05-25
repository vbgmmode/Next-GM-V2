import { createUniqueDomainId } from "./domainIds";
import type { DurableGameEvent, GameState, ShowResult } from "./types";

export function createShowResolvedEvent(game: GameState, result: ShowResult): DurableGameEvent {
  const existingIds = (game.eventLedger ?? []).map((event) => event.id);

  return {
    id: createUniqueDomainId("event-show-resolved", [result.id], existingIds),
    type: "show_resolved",
    seasonNumber: result.seasonNumber,
    weekNumber: result.week,
    source: "run_show",
    summary: `${result.showName} resolved with a ${result.totalScore} show score.`,
    relatedIds: {
      showResultId: result.id,
      segmentIds: result.segmentResults.map((segment) => segment.segmentId),
      titleHistoryEventIds: result.titleHistoryEvents.map((event) => event.id),
      rivalryHistoryEventIds: result.rivalryHistoryEvents.map((event) => event.id),
    },
    payload: {
      showName: result.showName,
      showType: result.showType,
      totalScore: result.totalScore,
      segmentCount: result.segmentResults.length,
      titleEventCount: result.titleHistoryEvents.length,
      rivalryEventCount: result.rivalryHistoryEvents.length,
    },
  };
}

export function getResolvedShowEvents(game: Pick<GameState, "eventLedger">): DurableGameEvent[] {
  return (game.eventLedger ?? []).filter((event) => event.type === "show_resolved");
}
