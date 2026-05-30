import type { Championship, ChampionshipHistoryEvent, GameState, Rivalry, RivalryHistoryEvent, SeasonArchiveSummary, ShowResult, ShowType, Wrestler } from "./types";

export function getShowTypeLabel(showType: ShowType) {
  return showType === "ple" ? "PLE" : "TV";
}

export function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}

export function getReignLength(championship: Championship, currentWeek: number) {
  return Math.max(1, currentWeek - championship.reignStartWeek + 1);
}

export function formatHistoryStamp(
  event: Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "seasonNumber" | "weekNumber"> &
    Partial<Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "showName" | "showType">>,
) {
  const showLabel = event.showName ? ` · ${event.showName}${event.showType ? ` (${getShowTypeLabel(event.showType)})` : ""}` : "";
  return `S${event.seasonNumber} W${event.weekNumber}${showLabel}`;
}

export function getChampionshipEventPairLine(event: ChampionshipHistoryEvent) {
  if (!event.winningPairIds?.length && !event.winningPairLabel) {
    return undefined;
  }

  const winner = event.winningPairLabel ?? event.winningPairIds?.join(" / ") ?? "Winning pair";
  const loser = event.losingPairLabel ?? event.losingPairIds?.join(" / ");
  return loser ? `${winner} over ${loser}` : winner;
}

export function getHottestRivalry(rivalries: Rivalry[]) {
  return [...rivalries].sort((a, b) => b.heat - a.heat)[0];
}

export function getBestShow(showHistory: ShowResult[], seasonNumber?: number) {
  const results = seasonNumber ? showHistory.filter((result) => result.seasonNumber === seasonNumber) : showHistory;
  return results.reduce<ShowResult | undefined>((best, result) => (!best || result.totalScore > best.totalScore ? result : best), undefined);
}

function getSeasonTitleHistory(game: GameState) {
  return (game.championshipHistory ?? []).filter((event) => event.seasonNumber === game.seasonNumber);
}

function getSeasonRivalryHistory(game: GameState) {
  return (game.rivalryHistory ?? []).filter((event) => event.seasonNumber === game.seasonNumber);
}

export function getBiggestTitleChange(game: GameState) {
  return getSeasonTitleHistory(game)
    .filter((event) => event.eventType === "title_change")
    .sort((a, b) => {
      const titleA = game.championships.find((championship) => championship.id === a.championshipId);
      const titleB = game.championships.find((championship) => championship.id === b.championshipId);
      return (titleB?.prestige ?? 0) - (titleA?.prestige ?? 0) || b.weekNumber - a.weekNumber;
    })[0];
}

export function getMostDefendedChampionship(game: GameState) {
  const defenseCounts = getSeasonTitleHistory(game)
    .filter((event) => event.eventType === "successful_defense")
    .reduce<Record<string, number>>((counts, event) => ({ ...counts, [event.championshipId]: (counts[event.championshipId] ?? 0) + 1 }), {});
  const [championshipId, count] = Object.entries(defenseCounts).sort((a, b) => b[1] - a[1])[0] ?? [];
  const championship = game.championships.find((title) => title.id === championshipId);

  return championship && count ? { championship, count } : undefined;
}

export function getHottestRivalryStory(game: GameState) {
  const history = getSeasonRivalryHistory(game);
  const hottestEvent = [...history].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))[0];
  const activeRivalry = hottestEvent ? game.rivalries.find((rivalry) => rivalry.id === hottestEvent.rivalryId) : undefined;

  if (hottestEvent) {
    return { name: hottestEvent.rivalryName, heat: hottestEvent.heat ?? activeRivalry?.heat ?? 0, note: hottestEvent.note };
  }

  const hottestRivalry = getHottestRivalry(game.rivalries);
  return hottestRivalry ? { name: hottestRivalry.name, heat: hottestRivalry.heat, note: "No recorded rivalry history event this season yet." } : undefined;
}

export function getMostEventfulRivalry(game: GameState) {
  const eventCounts = getSeasonRivalryHistory(game).reduce<Record<string, { name: string; count: number }>>((counts, event) => {
    const current = counts[event.rivalryId] ?? { name: event.rivalryName, count: 0 };
    return { ...counts, [event.rivalryId]: { ...current, count: current.count + 1 } };
  }, {});
  return Object.values(eventCounts).sort((a, b) => b.count - a.count)[0];
}

export function getNotablePlePayoff(game: GameState) {
  return getSeasonRivalryHistory(game)
    .filter((event) => event.eventType === "ple_payoff")
    .sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0) || b.weekNumber - a.weekNumber)[0];
}

export function buildSeasonArchiveSummary(game: GameState): SeasonArchiveSummary {
  const bestShow = getBestShow(game.showHistory, game.seasonNumber);
  const topMomentumStar = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0];
  const mostDefendedChampionship = getMostDefendedChampionship(game);
  const biggestTitleChange = getBiggestTitleChange(game);
  const hottestRivalryStory = getHottestRivalryStory(game);
  const notablePlePayoff = getNotablePlePayoff(game);

  const championsSnapshot = game.championships
    .filter((championship) => championship.championIds.length > 0)
    .map((championship) => ({
      championshipName: championship.name,
      champions: getWrestlerNames(championship.championIds, game.wrestlers) || "No champion listed",
    }));

  return {
    seasonNumber: game.seasonNumber,
    seasonStartingMoney: game.seasonStartingMoney,
    seasonDelta: game.money - game.seasonStartingMoney,
    finalMoney: game.money,
    bestShow: bestShow
      ? {
          name: bestShow.showName,
          week: bestShow.week,
          score: bestShow.totalScore,
          type: bestShow.showType,
        }
      : undefined,
    topMomentumStar: topMomentumStar
      ? {
          name: topMomentumStar.name,
          value: topMomentumStar.momentum,
        }
      : undefined,
    mostDefendedTitle: mostDefendedChampionship
      ? {
          championshipName: mostDefendedChampionship.championship.name,
          defenses: mostDefendedChampionship.count,
        }
      : undefined,
    biggestTitleChange: biggestTitleChange
      ? {
          championshipName: biggestTitleChange.championshipName,
          note: biggestTitleChange.note,
          showName: biggestTitleChange.showName,
          week: biggestTitleChange.weekNumber,
        }
      : undefined,
    hottestRivalry: hottestRivalryStory
      ? {
          name: hottestRivalryStory.name,
          heat: hottestRivalryStory.heat,
        }
      : undefined,
    plePayoffHighlight: notablePlePayoff
      ? {
          rivalryName: notablePlePayoff.rivalryName,
          showName: notablePlePayoff.showName ?? "Untitled show",
          type: notablePlePayoff.showType,
          week: notablePlePayoff.weekNumber,
        }
      : undefined,
    championsSnapshot,
  };
}
