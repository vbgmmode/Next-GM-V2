import type { GameState, InjuryRecoveryNote, RivalryHistoryEvent, Wrestler } from "./types";
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
  const nextWeek = isSeasonFinaleComplete ? game.currentWeek : game.currentWeek + 1;
  const recoveryNotes: InjuryRecoveryNote[] = [];
  const recoveredWrestlers = game.wrestlers.map((wrestler) => recoverWrestlerInjury(wrestler, nextWeek, recoveryNotes));
  const rivalryHistoryEvents: RivalryHistoryEvent[] = [];

  return {
    ...game,
    currentWeek: nextWeek,
    calendar: completedCalendar,
    currentShow: [],
    injuryRecoveryNotes: [...(game.injuryRecoveryNotes ?? []), ...recoveryNotes],
    wrestlers: recoveredWrestlers.map((wrestler) => ({
      ...wrestler,
      fatigue: clamp(wrestler.fatigue - 6),
    })),
    rivalries: game.rivalries.map((rivalry) => {
      const wasAdvancedThisWeek = rivalry.lastAdvancedWeek >= game.currentWeek;
      const stalePenalty = rivalry.status === "stale" ? 4 : 0;
      const heat = wasAdvancedThisWeek ? rivalry.heat : clamp(rivalry.heat - 4 - stalePenalty);
      const freshness = wasAdvancedThisWeek ? rivalry.freshness : clamp(rivalry.freshness - 3 - stalePenalty);
      const status = getRivalryStatus(heat, freshness);

      if (!wasAdvancedThisWeek && (heat !== rivalry.heat || freshness !== rivalry.freshness)) {
        const eventType = status === "stale" ? "became_stale" : "cooled";
        rivalryHistoryEvents.push({
          id: `s${game.seasonNumber}-w${game.currentWeek}-${rivalry.id}-${eventType}-advance`,
          rivalryId: rivalry.id,
          rivalryName: rivalry.name,
          participantIds: [...rivalry.participantIds],
          weekNumber: game.currentWeek,
          seasonNumber: game.seasonNumber,
          eventType,
          note:
            eventType === "became_stale"
              ? `${rivalry.name} became stale after another week without a meaningful beat.`
              : `${rivalry.name} cooled while the show moved on without it.`,
          heat,
          freshness,
          status,
        });
      }

      return {
        ...rivalry,
        heat,
        freshness,
        weeksActive: rivalry.weeksActive + 1,
        status,
      };
    }),
    rivalryHistory: [...(game.rivalryHistory ?? []), ...rivalryHistoryEvents],
  };
}

function recoverWrestlerInjury(wrestler: Wrestler, nextWeek: number, recoveryNotes: InjuryRecoveryNote[]): Wrestler {
  if (wrestler.injuryStatus === "healthy" || wrestler.injuryWeeksRemaining <= 0) {
    return {
      ...wrestler,
      injuryStatus: "healthy",
      injuryDescription: undefined,
      injuryWeeksRemaining: 0,
      injuryOccurredWeek: undefined,
    };
  }

  const injuryWeeksRemaining = Math.max(0, wrestler.injuryWeeksRemaining - 1);

  if (injuryWeeksRemaining > 0) {
    return {
      ...wrestler,
      injuryWeeksRemaining,
    };
  }

  recoveryNotes.push({
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    weekNumber: nextWeek,
    note: `${wrestler.name} has been medically cleared and is available again.`,
  });

  return {
    ...wrestler,
    injuryStatus: "healthy",
    injuryDescription: undefined,
    injuryWeeksRemaining: 0,
    injuryOccurredWeek: undefined,
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
    injuryRecoveryNotes: game.injuryRecoveryNotes ?? [],
    wrestlers: game.wrestlers.map((wrestler) => ({
      ...wrestler,
      appearancesThisSeason: 0,
      lastBookedWeek: 0,
      consecutiveWeeksBooked: 0,
    })),
  };
}
