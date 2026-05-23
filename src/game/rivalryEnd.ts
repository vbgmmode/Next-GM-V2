import type { GameState, Rivalry, RivalryHistoryEvent } from "./types";

export const RIVALRY_END_REASONS = [
  "Program ran its course",
  "Story paid off on TV",
  "Creative direction shift",
  "Talent unavailable",
] as const;

export type RivalryEndReason = (typeof RIVALRY_END_REASONS)[number];

export function isRivalryPendingEndThisWeek(rivalry: Rivalry, currentWeek: number) {
  return rivalry.pendingEndWeek === currentWeek;
}

export function wasRivalryBookedOnWeek(game: GameState, rivalryId: string, week: number, seasonNumber = game.seasonNumber) {
  const rivalry = game.rivalries.find((entry) => entry.id === rivalryId);

  if (rivalry && rivalry.lastAdvancedWeek >= week) {
    return true;
  }

  if (game.currentWeek === week && game.currentShow.some((segment) => segment.rivalryId === rivalryId)) {
    return true;
  }

  return game.showHistory.some(
    (result) =>
      result.seasonNumber === seasonNumber &&
      result.week === week &&
      result.segmentResults.some((segment) => segment.rivalryId === rivalryId),
  );
}

export function scheduleRivalryEndInGame(game: GameState, rivalryId: string, reason: string): GameState {
  const rivalry = game.rivalries.find((entry) => entry.id === rivalryId);

  if (!rivalry || rivalry.pendingEndWeek === game.currentWeek) {
    return game;
  }

  const scheduleEvent: RivalryHistoryEvent = {
    id: `s${game.seasonNumber}-w${game.currentWeek}-${rivalryId}-end-scheduled`,
    rivalryId,
    rivalryName: rivalry.name,
    participantIds: [...rivalry.participantIds],
    weekNumber: game.currentWeek,
    seasonNumber: game.seasonNumber,
    eventType: "end_scheduled",
    note: `${rivalry.name} finale scheduled. Reason: ${reason}. Book the final beat this week — program clears next week.`,
    heat: rivalry.heat,
    freshness: rivalry.freshness,
    status: rivalry.status,
  };

  return {
    ...game,
    rivalries: game.rivalries.map((entry) =>
      entry.id === rivalryId
        ? {
            ...entry,
            pendingEndWeek: game.currentWeek,
            pendingEndReason: reason,
          }
        : entry,
    ),
    rivalryHistory: [...(game.rivalryHistory ?? []), scheduleEvent],
  };
}

export function resolvePendingRivalryEndsOnAdvance(game: GameState) {
  const completingWeek = game.currentWeek;
  const historyEvents: RivalryHistoryEvent[] = [];
  const rivalries = game.rivalries.flatMap((rivalry) => {
    if (rivalry.pendingEndWeek !== completingWeek) {
      return [rivalry];
    }

    if (!wasRivalryBookedOnWeek(game, rivalry.id, completingWeek)) {
      historyEvents.push({
        id: `s${game.seasonNumber}-w${completingWeek}-${rivalry.id}-end-cancelled`,
        rivalryId: rivalry.id,
        rivalryName: rivalry.name,
        participantIds: [...rivalry.participantIds],
        weekNumber: completingWeek,
        seasonNumber: game.seasonNumber,
        eventType: "end_cancelled",
        note: `${rivalry.name} finale was cancelled — no TV beat was booked during the scheduled finale week.`,
        heat: rivalry.heat,
        freshness: rivalry.freshness,
        status: rivalry.status,
      });

      return [
        {
          ...rivalry,
          pendingEndWeek: undefined,
          pendingEndReason: undefined,
        },
      ];
    }

    historyEvents.push({
      id: `s${game.seasonNumber}-w${completingWeek}-${rivalry.id}-ended`,
      rivalryId: rivalry.id,
      rivalryName: rivalry.name,
      participantIds: [...rivalry.participantIds],
      weekNumber: completingWeek,
      seasonNumber: game.seasonNumber,
      eventType: "ended",
      note: `${rivalry.name} ended after the booked finale week. GM reason: ${rivalry.pendingEndReason ?? "Program concluded."}`,
      heat: rivalry.heat,
      freshness: rivalry.freshness,
      status: rivalry.status,
    });

    return [];
  });

  return {
    rivalries,
    historyEvents,
  };
}
