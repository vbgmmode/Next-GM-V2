import { getRatingsBattleSnapshot } from "./cpuRivalLoop";
import { getFinancePressureLabel } from "./finance";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { formatMoney } from "./formatters";
import { getWeeklyDecisionPressureSnapshot } from "./gameContextReads";
import { getAvailableFreeAgents } from "./market";
import type { GameScreen } from "./migration";
import { getRosterPressureTags } from "./rosterContextReads";
import { draftPool } from "./seed";
import { getCurrentCalendarWeek, getShowGrade, isValidSegment } from "./scoring";
import type { GameState, Segment, ShowResult, Wrestler } from "./types";

export type DashboardMoraleLevel = "happy" | "neutral" | "angry";
export type DashboardRoleLevel = "ace" | "main" | "upper" | "mid" | "prospect" | "tag";

export type DashboardAlert = {
  id: string;
  tone: "red" | "amber" | "gold";
  icon: "injury" | "contract" | "scout" | "power";
  message: string;
};

export type DashboardViewModel = {
  alerts: DashboardAlert[];
  brandInitials: string;
  brandStatus: {
    budgetLabel: string;
    fansLabel: string;
    profitLabel: string;
    profitPositive: boolean;
    ratingLabel: string;
  };
  budgetLabel: string;
  champions: Array<{ holderId?: string; id: string; name: string; title: string }>;
  dateLabel: string;
  draftPool: Array<{ name: string; style: string }>;
  fansLabel: string;
  gmCrestLabel: string;
  goals: Array<{ complete: boolean; detail: string; id: string; label: string; progress: number }>;
  hasResults: boolean;
  hasWeekReview: boolean;
  metrics: {
    chartPoints: Array<{ label: string; value: number }>;
    fanSatisfactionLabel: string;
    matchQualityLabel: string;
    showQualityLabel: string;
    viewershipDelta?: string;
    viewershipLabel: string;
  };
  nextShowMeta: string;
  nextShowName: string;
  primaryAction: { label: string; screen: GameScreen };
  promo: {
    headline: string;
    leftId: string;
    leftName: string;
    rightId: string;
    rightName: string;
    showName: string;
    stipulation: string;
  };
  rankingLabel: string;
  rivalries: Array<{ id: string; intensity: number; leftId: string; leftName: string; rightId: string; rightName: string }>;
  roster: Array<{
    contract: string;
    cost: string;
    id: string;
    morale: DashboardMoraleLevel;
    name: string;
    overall: number;
    pop: number;
    rank: number;
    role: DashboardRoleLevel;
    selected?: boolean;
    stamina: number;
    style: string;
  }>;
  rosterSizeLabel: string;
  seasonWeekLabel: string;
  secondaryActions: Array<{ label: string; screen: GameScreen }>;
  showCard: Array<{ id: string; index: number; match: string; stipulation: string; valid: boolean }>;
};

function compactRead(value: string, limit = 76) {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
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

function getLatestFinanceReport(game: GameState) {
  return game.financeReports[game.financeReports.length - 1];
}

function mapMorale(morale: number): DashboardMoraleLevel {
  if (morale >= 65) return "happy";
  if (morale >= 45) return "neutral";
  return "angry";
}

function mapRole(roleTier?: string): DashboardRoleLevel {
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

function segmentLabel(game: GameState, segment: Segment) {
  const names = segment.participantIds
    .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "TBD")
    .filter((name) => name !== "TBD");

  if (!names.length) {
    return `${segment.type} / Unassigned`;
  }

  return names.join(" vs ");
}

function wrestlerName(game: GameState, id: string) {
  return game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "TBD";
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
      headline: "Main Event",
      leftId: "",
      leftName: "TBD",
      rightId: "",
      rightName: "TBD",
      showName: currentShow.showName,
      stipulation: "Card open",
    };
  }

  const ids = mainSegment.participantIds;

  return {
    headline: mainSegment.championshipId ? "Title Scene" : "Main Event",
    leftId: ids[0] ?? "",
    leftName: wrestlerName(game, ids[0] ?? ""),
    rightId: ids[1] ?? ids[0] ?? "",
    rightName: wrestlerName(game, ids[1] ?? ids[0] ?? ""),
    showName: currentShow.showName,
    stipulation: mainSegment.type,
  };
}

export function buildDashboardViewModel(game: GameState, result?: ShowResult): DashboardViewModel {
  const currentShow = getCurrentCalendarWeek(game);
  const latestFinanceReport = getLatestFinanceReport(game);
  const financePressure = getFinancePressureLabel(game.money, latestFinanceReport?.profitLoss ?? 0);
  const weeklyPressure = getWeeklyDecisionPressureSnapshot(game, result);
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const lastShow = game.showHistory[game.showHistory.length - 1];
  const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));
  const hasWeekReview = Boolean(result && result.week === game.currentWeek);
  const rosterTags = game.wrestlers.flatMap((wrestler) => getRosterPressureTags(wrestler, game.currentWeek));
  const unavailableCount = rosterTags.filter((tag) => tag === "Unavailable").length;
  const injuryCount = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "healthy").length;
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

  const roster = sortedRoster.map((wrestler, index) => {
    const finance = getRosterFinanceValueForWrestler(wrestler);

    return {
      contract: finance ? `${finance.midseasonDefaultContractWeeks ?? 12}W` : "-",
      cost: finance ? formatShortMoney(finance.weeklyHireRateUsd) : "-",
      id: wrestler.id,
      morale: mapMorale(wrestler.morale),
      name: wrestler.name,
      overall: Math.round((wrestler.ringSkill + wrestler.promoSkill) / 2),
      pop: wrestler.popularity,
      rank: index + 1,
      role: mapRole(wrestler.roleTier),
      selected: index === 0,
      stamina: Math.max(0, 100 - wrestler.fatigue),
      style: wrestler.wrestlingStyle ?? wrestler.archetype ?? "-",
    };
  });

  const champions = game.championships.slice(0, 5).map((title) => {
    const holderId = title.championIds[0];
    const holder = holderId ? game.wrestlers.find((wrestler) => wrestler.id === holderId) : undefined;

    return {
      holderId,
      id: title.id,
      name: holder?.name ?? "Vacant",
      title: title.name,
    };
  });

  const goals = weeklyPressure.items.slice(0, 4).map((item) => ({
    complete: item.tone === "strong" && item.id === "last-show",
    detail: compactRead(item.detail, 42),
    id: item.id,
    label: compactRead(`${item.label}: ${item.value}`, 52),
    progress: item.tone === "strong" ? 1 : item.tone === "watch" ? 0.55 : 0.75,
  }));

  const rivalries = game.rivalries.slice(0, 3).map((rivalry) => {
    const [leftId, rightId] = rivalry.participantIds;
    const left = game.wrestlers.find((wrestler) => wrestler.id === leftId);
    const right = game.wrestlers.find((wrestler) => wrestler.id === rightId);

    return {
      id: rivalry.id,
      intensity: rivalry.heat,
      leftId: leftId ?? "",
      leftName: left?.name.split(" ").pop() ?? "-",
      rightId: rightId ?? "",
      rightName: right?.name.split(" ").pop() ?? "-",
    };
  });

  const historySlice = game.showHistory.slice(-5);
  const chartPoints = historySlice.map((show) => ({
    label: `W${show.week}`,
    value: show.totalScore,
  }));
  const avgSegmentScore =
    lastShow && lastShow.segmentResults.length
      ? Math.round(lastShow.segmentResults.reduce((sum, segment) => sum + segment.score, 0) / lastShow.segmentResults.length)
      : undefined;

  const alerts: DashboardAlert[] = [];
  const medicalCount = Math.max(unavailableCount, injuryCount);

  if (medicalCount) {
    alerts.push({
      icon: "injury",
      id: "injury",
      message: `${medicalCount} superstar${medicalCount === 1 ? "" : "s"} need medical attention`,
      tone: "red",
    });
  }

  if (financePressure === "Tight" || financePressure === "Critical") {
    alerts.push({
      icon: "contract",
      id: "finance",
      message: `Finance desk: ${financePressure}`,
      tone: "amber",
    });
  }

  if (freeAgents.length) {
    alerts.push({
      icon: "scout",
      id: "scout",
      message: "Scouting report available on the market desk",
      tone: "gold",
    });
  }

  if (validSegments.length >= 2) {
    alerts.push({
      icon: "power",
      id: "card",
      message: "Show card is runnable when you are ready",
      tone: "gold",
    });
  }

  while (alerts.length < 4 && weeklyPressure.items[alerts.length]) {
    const item = weeklyPressure.items[alerts.length];

    alerts.push({
      icon: "scout",
      id: item.id,
      message: compactRead(`${item.label}: ${item.value}`, 48),
      tone: item.tone === "watch" ? "amber" : "gold",
    });
  }

  const primaryAction: DashboardViewModel["primaryAction"] = hasWeekReview
    ? { label: "Review Fallout", screen: "weekReview" }
    : validSegments.length >= 2
      ? { label: "Review Card", screen: "booking" }
      : { label: "Book Show", screen: "booking" };

  return {
    alerts: alerts.slice(0, 4),
    brandInitials,
    brandStatus: {
      budgetLabel: formatMoney(game.money),
      fansLabel: ratingsBattle ? `#${ratingsBattle.playerRank}` : "-",
      profitLabel: latestFinanceReport ? formatMoney(latestFinanceReport.profitLoss) : financePressure,
      profitPositive: (latestFinanceReport?.profitLoss ?? 0) >= 0,
      ratingLabel: lastShow ? `${lastShow.totalScore} (${getShowGrade(lastShow.totalScore)})` : "No show yet",
    },
    budgetLabel: formatMoney(game.money),
    champions,
    dateLabel: currentShow.showName,
    draftPool: freeAgents.map((wrestler: Wrestler) => ({
      name: wrestler.name,
      style: wrestler.wrestlingStyle ?? wrestler.archetype ?? "-",
    })),
    fansLabel: ratingsBattle ? `#${ratingsBattle.playerRank} / ${game.brandName}` : game.brandName,
    gmCrestLabel: game.gmName.slice(0, 1).toUpperCase() || "G",
    goals,
    hasResults: game.showHistory.length > 0,
    hasWeekReview,
    metrics: {
      chartPoints,
      fanSatisfactionLabel: lastShow ? `${Math.min(99, Math.round(lastShow.totalScore * 0.95))}%` : "-",
      matchQualityLabel: avgSegmentScore ? `${(avgSegmentScore / 20).toFixed(1)} / 5` : "-",
      showQualityLabel: lastShow ? getShowGrade(lastShow.totalScore) : "-",
      viewershipDelta:
        lastShow && game.showHistory.length > 1
          ? lastShow.totalScore >= game.showHistory[game.showHistory.length - 2].totalScore
            ? "UP"
            : "DOWN"
          : undefined,
      viewershipLabel: lastShow ? lastShow.totalScore.toLocaleString() : "-",
    },
    nextShowMeta: currentShow.isGoHome ? "Go-home week" : currentShow.showType.toUpperCase(),
    nextShowName: currentShow.showName,
    primaryAction,
    promo: buildPromo(game),
    rankingLabel: ratingsBattle ? `#${ratingsBattle.playerRank} of ${ratingsBattle.entries.length}` : "Brand HQ",
    rivalries,
    roster,
    rosterSizeLabel: `Roster Size ${game.wrestlers.length} / 20`,
    seasonWeekLabel: `Season ${game.seasonNumber} / Week ${game.currentWeek}`,
    secondaryActions: [
      { label: "Edit Card", screen: "booking" },
      { label: "Calendar", screen: "calendar" },
    ],
    showCard: game.currentShow.map((segment, index) => ({
      id: segment.id,
      index: index + 1,
      match: segmentLabel(game, segment),
      stipulation: segment.championshipId ? "Title scene" : segment.type,
      valid: isValidSegment(segment, game.wrestlers),
    })),
  };
}
