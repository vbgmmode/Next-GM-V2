import type { GameState, InjuryRecoveryNote, RivalryHistoryEvent, SeasonArchiveSummary, Wrestler } from "./types";
import { getRivalryStatus } from "./scoring";
import { createSeasonCalendar, draftPool } from "./seed";
import { advanceCpuRivalWeek } from "./cpuRivalLoop";
import { advanceCpuMarket, advancePlayerContracts, evaluateOfficeMandate } from "./market";

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

  const nextGame = {
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
              ? `${rivalry.name} went stale after another week without a meaningful beat.`
              : `${rivalry.name} cooled while the broadcast spotlight moved elsewhere.`,
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

  const withCpu = {
    ...nextGame,
    rivalBrands: advanceCpuRivalWeek(nextGame),
  };
  const withMarket = advanceCpuMarket(advancePlayerContracts(withCpu), draftPool);

  return evaluateOfficeMandate(withMarket);
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
    note: `${wrestler.name} cleared medical and is back on the booking board.`,
  });

  return {
    ...wrestler,
    injuryStatus: "healthy",
    injuryDescription: undefined,
    injuryWeeksRemaining: 0,
    injuryOccurredWeek: undefined,
  };
}

export function startNextSeason(game: GameState, completedSeasonArchive?: SeasonArchiveSummary): GameState {
  const seasonArchives = completedSeasonArchive ? [...(game.seasonArchives ?? []), completedSeasonArchive] : game.seasonArchives ?? [];

  return {
    ...game,
    seasonArchives,
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
    rivalBrands: game.rivalBrands.map((brand) => ({
      ...brand,
      seasonAverageScore: 0,
      seasonRank: 0,
      seasonTrend: "unranked",
      rosterState: brand.rosterState.map((member) => ({
        ...member,
        appearancesThisSeason: 0,
        lastBookedWeek: 0,
        consecutiveWeeksBooked: 0,
      })),
      contracts: brand.contracts.map((contract) => ({
        ...contract,
        contractWeeksRemaining: Math.max(contract.contractWeeksRemaining, 4),
        contractStatus: contract.contractWeeksRemaining <= 3 ? "expiring" : contract.contractStatus,
      })),
      seasonObjectives: brand.seasonObjectives.map((objective) => ({
        ...objective,
        current: 0,
        status: objective.label.includes("85+") ? "at_risk" : "on_track",
        note: objective.label.includes("85+") ? "No premium rival show logged yet." : "New season ratings lane reset.",
      })),
      weeklyResults: brand.weeklyResults,
    })),
    marketState: {
      ...game.marketState,
      playerContracts: game.marketState.playerContracts.map((contract) => ({
        ...contract,
        contractWeeksRemaining: Math.max(contract.contractWeeksRemaining, 4),
        contractStatus: contract.contractWeeksRemaining <= 3 ? "expiring" : contract.contractStatus,
      })),
      officeMandate: {
        ownerTrust: game.marketState.officeMandate.ownerTrust,
        brandReputation: game.marketState.officeMandate.brandReputation,
        mandateStatus: "stable",
        mandateHistory: game.marketState.officeMandate.mandateHistory,
      },
    },
  };
}
