import { createShowResolvedEvent } from "./eventLedger";
import type {
  Championship,
  ChampionshipHistoryEvent,
  FinanceReport,
  GameState,
  Rivalry,
  RivalryHistoryEvent,
  ShowResult,
  SocialInboxState,
  Wrestler,
} from "./types";

export type ResolvedShowCommitInput = {
  game: GameState;
  result: ShowResult;
  wrestlers: Wrestler[];
  socialInbox: SocialInboxState;
  championships: Championship[];
  rivalries: Rivalry[];
  championshipHistoryEvents: ChampionshipHistoryEvent[];
  rivalryHistoryEvents: RivalryHistoryEvent[];
  financeReport: FinanceReport;
};

export type ResolvedShowCommit = {
  gameBeforeCpuSocial: GameState;
  event: GameState["eventLedger"][number];
  result: ShowResult;
  financeReport: FinanceReport;
  championshipHistoryEvents: ChampionshipHistoryEvent[];
  rivalryHistoryEvents: RivalryHistoryEvent[];
};

export function commitResolvedShow(input: ResolvedShowCommitInput): ResolvedShowCommit {
  const {
    game,
    result,
    wrestlers,
    socialInbox,
    championships,
    rivalries,
    championshipHistoryEvents,
    rivalryHistoryEvents,
  } = input;
  const event = createShowResolvedEvent(game, result);
  const linkedFinanceReport = {
    ...input.financeReport,
    resultId: result.id,
    eventId: event.id,
  };
  const linkedChampionshipHistoryEvents = championshipHistoryEvents.map((historyEvent) => ({
    ...historyEvent,
    resultId: result.id,
    eventId: event.id,
  }));
  const linkedRivalryHistoryEvents = rivalryHistoryEvents.map((historyEvent) => ({
    ...historyEvent,
    resultId: result.id,
    eventId: event.id,
  }));
  const linkedResult = {
    ...result,
    titleHistoryEvents: linkedChampionshipHistoryEvents,
    rivalryHistoryEvents: linkedRivalryHistoryEvents,
  };

  return {
    gameBeforeCpuSocial: {
      ...game,
      money: linkedFinanceReport.endingMoney,
      wrestlers,
      socialInbox,
      championships,
      rivalries,
      championshipHistory: [...(game.championshipHistory ?? []), ...linkedChampionshipHistoryEvents],
      rivalryHistory: [...(game.rivalryHistory ?? []), ...linkedRivalryHistoryEvents],
      eventLedger: [...(game.eventLedger ?? []), event],
      financeReports: [...game.financeReports, linkedFinanceReport],
      showHistory: [...game.showHistory, linkedResult],
    },
    event,
    result: linkedResult,
    financeReport: linkedFinanceReport,
    championshipHistoryEvents: linkedChampionshipHistoryEvents,
    rivalryHistoryEvents: linkedRivalryHistoryEvents,
  };
}
