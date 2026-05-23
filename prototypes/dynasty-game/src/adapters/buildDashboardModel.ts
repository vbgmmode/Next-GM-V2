import { getRatingsBattleSnapshot } from "@game/cpuRivalLoop";
import { formatMoney } from "@game/formatters";
import { getFinancePressureLabel } from "@game/finance";
import { getRosterFinanceValueForWrestler } from "@game/financeCatalog";
import { getWeeklyDecisionPressureSnapshot } from "@game/gameContextReads";
import { getAvailableFreeAgents } from "@game/market";
import { getRosterPressureTags } from "@game/rosterContextReads";
import { draftPool } from "@game/seed";
import { getCurrentCalendarWeek, getShowGrade, isValidSegment } from "@game/scoring";
import type { GameScreen } from "@game/migration";
import type { GameState, ShowResult, Wrestler } from "@game/types";

export type MoraleLevel = "happy" | "neutral" | "angry";
export type RoleLevel = "ace" | "main" | "upper" | "mid" | "prospect" | "tag";

export type DashboardViewModel = {
  brandInitials: string;
  seasonWeekLabel: string;
  dateLabel: string;
  budgetLabel: string;
  fansLabel: string;
  rankingLabel: string;
  nextShowName: string;
  nextShowMeta: string;
  gmCrestLabel: string;
  brandStatus: {
    ratingLabel: string;
    fansLabel: string;
    budgetLabel: string;
    profitLabel: string;
    profitPositive: boolean;
  };
  champions: Array<{ id: string; title: string; name: string; holderId?: string }>;
  goals: Array<{ id: string; label: string; detail: string; progress: number; complete: boolean }>;
  roster: Array<{
    id: string;
    rank: number;
    name: string;
    role: RoleLevel;
    style: string;
    pop: number;
    stamina: number;
    morale: MoraleLevel;
    overall: number;
    contract: string;
    cost: string;
    selected?: boolean;
  }>;
  rosterSizeLabel: string;
  promo: {
    showName: string;
    headline: string;
    leftId: string;
    rightId: string;
    leftName: string;
    rightName: string;
    stipulation: string;
  };
  showCard: Array<{ id: string; index: number; match: string; stipulation: string; valid: boolean }>;
  primaryAction: { label: string; screen: GameScreen };
  secondaryActions: Array<{ label: string; screen: GameScreen }>;
  rivalries: Array<{ id: string; leftId: string; leftName: string; rightId: string; rightName: string; intensity: number }>;
  metrics: {
    viewershipLabel: string;
    viewershipDelta?: string;
    showQualityLabel: string;
    matchQualityLabel: string;
    fanSatisfactionLabel: string;
    chartPoints: Array<{ label: string; value: number }>;
  };
  alerts: Array<{ id: string; tone: "red" | "amber" | "gold"; icon: "injury" | "contract" | "scout" | "power"; message: string }>;
  draftPool: Array<{ name: string; style: string }>;
  hasWeekReview: boolean;
  hasResults: boolean;
};

function compactRead(value: string, limit = 76) {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function mapMorale(morale: number): MoraleLevel {
  if (morale >= 65) return "happy";
  if (morale >= 45) return "neutral";
  return "angry";
}

function mapRole(roleTier?: string): RoleLevel {
  switch (roleTier) {
    case "MainEvent":
      return "ace";
    case "UpperCard":
      return "upper";
    case "Midcard":
      return "mid";
    case "Prospect":
    case "Enhancement":
      return "prospect";
    default:
      return "main";
  }
}

function wrestlerName(game: GameState, id: string) {
  return game.wrestlers.find((w) => w.id === id)?.name ?? "TBD";
}

function segmentLabel(game: GameState, segment: GameState["currentShow"][number]) {
  const names = segment.participantIds.map((id) => wrestlerName(game, id)).filter((name) => name !== "TBD");
  if (!names.length) {
    return `${segment.type} · Unassigned`;
  }
  if (names.length === 1) {
    return names[0];
  }
  return names.join(" vs ");
}

function getLatestFinanceReport(game: GameState) {
  return game.financeReports[game.financeReports.length - 1];
}

function formatShortMoney(amount: number) {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return formatMoney(amount);
}

function buildPromo(game: GameState) {
  const currentShow = getCurrentCalendarWeek(game);
  const segments = [...game.currentShow];
  const mainSegment =
    [...segments].reverse().find((segment) => segment.type === "Match" && segment.participantIds.length >= 2) ??
    segments.find((segment) => segment.participantIds.length >= 2) ??
    segments[0];

  if (!mainSegment) {
    return {
      showName: currentShow.showName,
      headline: "Main Event",
      leftId: "",
      rightId: "",
      leftName: "TBD",
      rightName: "TBD",
      stipulation: "Card open",
    };
  }

  const ids = mainSegment.participantIds;
  return {
    showName: currentShow.showName,
    headline: mainSegment.championshipId ? "Title Scene" : "Main Event",
    leftId: ids[0] ?? "",
    rightId: ids[1] ?? ids[0] ?? "",
    leftName: wrestlerName(game, ids[0] ?? ""),
    rightName: wrestlerName(game, ids[1] ?? ids[0] ?? ""),
    stipulation: mainSegment.type,
  };
}

export function buildDashboardModel(game: GameState, result?: ShowResult): DashboardViewModel {
  const currentShow = getCurrentCalendarWeek(game);
  const lastShow = game.showHistory[game.showHistory.length - 1];
  const latestFinanceReport = getLatestFinanceReport(game);
  const financePressure = getFinancePressureLabel(game.money, latestFinanceReport?.profitLoss ?? 0);
  const weeklyPressure = getWeeklyDecisionPressureSnapshot(game, result);
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));
  const hasWeekReview = Boolean(result && result.week === game.currentWeek);
  const rosterTags = game.wrestlers.flatMap((w) => getRosterPressureTags(w, game.currentWeek));
  const unavailableCount = rosterTags.filter((tag) => tag === "Unavailable").length;
  const injuryCount = game.wrestlers.filter((w) => w.injuryStatus !== "healthy").length;
  const freeAgents = getAvailableFreeAgents(game, draftPool).slice(0, 5);

  const brandInitials =
    game.brandName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "HQ";

  const sortedRoster = [...game.wrestlers].sort(
    (a, b) => b.popularity + b.momentum - (a.popularity + a.momentum) || a.name.localeCompare(b.name),
  );

  const rosterRows = sortedRoster.map((wrestler, index) => {
    const finance = getRosterFinanceValueForWrestler(wrestler);
    return {
      id: wrestler.id,
      rank: index + 1,
      name: wrestler.name,
      role: mapRole(wrestler.roleTier),
      style: wrestler.wrestlingStyle ?? wrestler.archetype ?? "—",
      pop: wrestler.popularity,
      stamina: Math.max(0, 100 - wrestler.fatigue),
      morale: mapMorale(wrestler.morale),
      overall: Math.round((wrestler.ringSkill + wrestler.promoSkill) / 2),
      contract: finance ? `${finance.midseasonDefaultContractWeeks ?? 12}W` : "—",
      cost: finance ? formatShortMoney(finance.weeklyHireRateUsd) : "—",
      selected: index === 0,
    };
  });

  const champions = game.championships.slice(0, 5).map((title) => {
    const holderId = title.championIds[0];
    const holder = holderId ? game.wrestlers.find((w) => w.id === holderId) : undefined;
    return {
      id: title.id,
      title: title.name,
      name: holder?.name ?? "Vacant",
      holderId: holderId,
    };
  });

  const goals = weeklyPressure.items.slice(0, 4).map((item) => ({
    id: item.id,
    label: compactRead(`${item.label}: ${item.value}`, 52),
    detail: compactRead(item.detail, 42),
    progress: item.tone === "strong" ? 1 : item.tone === "watch" ? 0.55 : 0.75,
    complete: item.tone === "strong" && item.id === "last-show",
  }));

  const rivalryRows = game.rivalries.slice(0, 3).map((rivalry) => {
    const [leftId, rightId] = rivalry.participantIds;
    const left = game.wrestlers.find((w) => w.id === leftId);
    const right = game.wrestlers.find((w) => w.id === rightId);
    return {
      id: rivalry.id,
      leftId: leftId ?? "",
      leftName: left?.name.split(" ").pop() ?? "—",
      rightId: rightId ?? "",
      rightName: right?.name.split(" ").pop() ?? "—",
      intensity: rivalry.heat,
    };
  });

  const historySlice = game.showHistory.slice(-5);
  const chartPoints = historySlice.map((show) => ({
    label: `W${show.week}`,
    value: show.totalScore,
  }));

  const avgSegmentScore =
    lastShow && lastShow.segmentResults.length
      ? Math.round(
          lastShow.segmentResults.reduce((sum, segment) => sum + segment.score, 0) / lastShow.segmentResults.length,
        )
      : undefined;

  const alerts: DashboardViewModel["alerts"] = [];
  if (unavailableCount || injuryCount) {
    alerts.push({
      id: "injury",
      tone: "red",
      icon: "injury",
      message: `${Math.max(unavailableCount, injuryCount)} superstar${Math.max(unavailableCount, injuryCount) === 1 ? "" : "s"} need medical attention`,
    });
  }
  if (financePressure === "Tight" || financePressure === "Critical") {
    alerts.push({
      id: "finance",
      tone: "amber",
      icon: "contract",
      message: `Finance desk: ${financePressure}`,
    });
  }
  if (freeAgents.length) {
    alerts.push({
      id: "scout",
      tone: "gold",
      icon: "scout",
      message: "Scouting report available on the market desk",
    });
  }
  if (validSegments.length >= 2) {
    alerts.push({
      id: "card",
      tone: "gold",
      icon: "power",
      message: "Show card is runnable when you are ready",
    });
  }
  while (alerts.length < 4 && weeklyPressure.items[alerts.length]) {
    const item = weeklyPressure.items[alerts.length];
    alerts.push({
      id: item.id,
      tone: item.tone === "watch" ? "amber" : item.tone === "strong" ? "gold" : "gold",
      icon: "scout",
      message: compactRead(`${item.label}: ${item.value}`, 48),
    });
  }

  const primaryAction: DashboardViewModel["primaryAction"] = hasWeekReview
    ? { label: "Review Fallout", screen: "weekReview" }
    : validSegments.length >= 2
      ? { label: "Review Card", screen: "booking" }
      : { label: "Book Show", screen: "booking" };

  return {
    brandInitials,
    seasonWeekLabel: `Season ${game.seasonNumber} | Week ${game.currentWeek}`,
    dateLabel: currentShow.showName,
    budgetLabel: formatMoney(game.money),
    fansLabel: ratingsBattle ? `#${ratingsBattle.playerRank} · ${game.brandName}` : game.brandName,
    rankingLabel: ratingsBattle ? `#${ratingsBattle.playerRank} of ${ratingsBattle.entries.length}` : "Brand HQ",
    nextShowName: currentShow.showName,
    nextShowMeta: currentShow.isGoHome ? "Go-home week" : currentShow.showType.toUpperCase(),
    gmCrestLabel: game.gmName.slice(0, 1).toUpperCase(),
    brandStatus: {
      ratingLabel: lastShow ? `${lastShow.totalScore} (${getShowGrade(lastShow.totalScore)})` : "No show yet",
      fansLabel: ratingsBattle ? `#${ratingsBattle.playerRank}` : "—",
      budgetLabel: formatMoney(game.money),
      profitLabel: latestFinanceReport ? formatMoney(latestFinanceReport.profitLoss) : financePressure,
      profitPositive: (latestFinanceReport?.profitLoss ?? 0) >= 0,
    },
    champions,
    goals,
    roster: rosterRows,
    rosterSizeLabel: `Roster Size ${game.wrestlers.length} / 20`,
    promo: buildPromo(game),
    showCard: game.currentShow.map((segment, index) => ({
      id: segment.id,
      index: index + 1,
      match: segmentLabel(game, segment),
      stipulation: segment.championshipId ? "Title scene" : segment.type,
      valid: isValidSegment(segment, game.wrestlers),
    })),
    primaryAction,
    secondaryActions: [
      { label: "Edit Card", screen: "booking" },
      { label: "View Logistics", screen: "booking" },
    ],
    rivalries: rivalryRows,
    metrics: {
      viewershipLabel: lastShow ? lastShow.totalScore.toLocaleString() : "—",
      viewershipDelta: lastShow && game.showHistory.length > 1
        ? lastShow.totalScore >= game.showHistory[game.showHistory.length - 2].totalScore
          ? "▲"
          : "▼"
        : undefined,
      showQualityLabel: lastShow ? `${getShowGrade(lastShow.totalScore)}` : "—",
      matchQualityLabel: avgSegmentScore ? `${(avgSegmentScore / 20).toFixed(1)} / 5` : "—",
      fanSatisfactionLabel: lastShow ? `${Math.min(99, Math.round(lastShow.totalScore * 0.95))}%` : "—",
      chartPoints,
    },
    alerts: alerts.slice(0, 4),
    draftPool: freeAgents.map((wrestler: Wrestler) => ({
      name: wrestler.name,
      style: wrestler.wrestlingStyle ?? wrestler.archetype ?? "—",
    })),
    hasWeekReview,
    hasResults: game.showHistory.length > 0,
  };
}
