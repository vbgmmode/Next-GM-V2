import { getBrandChairByStyle, getBrandPlateLabel } from "./brandChairs";
import { getRatingsBattleSnapshot } from "./cpuRivalLoop";
import { getFinancePressureLabel } from "./finance";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { formatMoney, formatNumber } from "./formatters";
import { getWeeklyDecisionPressureSnapshot } from "./gameContextReads";
import { getAvailableFreeAgents, getContractForWrestler } from "./market";
import type { GameScreen } from "./migration";
import { getRosterPressureTags } from "./rosterContextReads";
import { draftPool } from "./seed";
import { resolveWrestlerAlignment } from "./wrestlerAlignment";
import { getCurrentCalendarWeek, getShowGrade, isValidSegment } from "./scoring";
import { getProtectedRestWrestlerIds } from "./socialInboxActions";
import type { Championship, GameState, Rivalry, RivalryStructure, Segment, ShowResult, SocialCategory, SocialPost, SocialTone, Wrestler } from "./types";

export type DashboardMoraleLevel = "happy" | "neutral" | "angry";
export type DashboardAlignmentLevel = "face" | "heel" | "neutral" | "unknown";

export type DashboardAlert = {
  id: string;
  tone: "red" | "amber" | "gold";
  icon: "injury" | "contract" | "scout" | "power";
  message: string;
};

export type DashboardFalloutItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "gold" | "red" | "blue" | "green" | "neutral";
};

export type DashboardViewModel = {
  alerts: DashboardAlert[];
  brandPlateLabel: string;
  brandPortraitSrc: string;
  brandStatus: {
    budgetLabel: string;
    fansLabel: string;
    profitLabel: string;
    profitPositive: boolean;
    ratingLabel: string;
  };
  budgetLabel: string;
  champions: Array<{ holderIds: string[]; id: string; isTagTeam: boolean; name: string; prestige: number; title: string }>;
  dateLabel: string;
  draftPool: Array<{ name: string; style: string }>;
  fansLabel: string;
  falloutFromLastWeek?: {
    headline: string;
    detail: string;
    weekLabel: string;
    items: DashboardFalloutItem[];
  };
  gmCrestLabel: string;
  goals: Array<{ complete: boolean; detail: string; id: string; label: string; progress: number }>;
  hasResults: boolean;
  hasPendingPostShow: boolean;
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
  rivalries: Array<{
    id: string;
    intensity: number;
    label: string;
    leftPortraitIds: string[];
    rightPortraitIds: string[];
    structure: RivalryStructure;
  }>;
  roster: Array<{
    contract: string;
    cost: string;
    id: string;
    morale: DashboardMoraleLevel;
    name: string;
    overall: number;
    overallDelta?: number;
    pop: number;
    popDelta?: number;
    rank: number;
    alignment: DashboardAlignmentLevel;
    selected?: boolean;
    stamina: number;
    staminaDelta?: number;
  }>;
  seasonWeekLabel: string;
  secondaryActions: Array<{ label: string; screen: GameScreen }>;
  showCard: Array<{ id: string; index: number; match: string; stipulation: string; valid: boolean }>;
};

function compactDashboardRead(value: string, limit = 76) {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function getDashboardRivalryStructure(rivalry: Rivalry): RivalryStructure {
  return rivalry.structure ?? "singles";
}

function formatDashboardRivalryLastName(name: string) {
  return name.split(" ").pop() ?? name;
}

function formatDashboardRivalryTeamLabel(participantIds: string[], wrestlers: Wrestler[]) {
  const names = participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const lastNames = names.map((name) => formatDashboardRivalryLastName(name));
  const useLastNames = new Set(lastNames).size === lastNames.length;

  return names
    .map((name) => (useLastNames ? formatDashboardRivalryLastName(name) : name.split(" ")[0] ?? name))
    .join("/");
}

function buildDashboardRivalryFeedEntry(rivalry: Rivalry, wrestlers: Wrestler[]) {
  const structure = getDashboardRivalryStructure(rivalry);

  if (structure === "tag_team" && rivalry.participantIds.length === 4) {
    const leftPortraitIds = rivalry.participantIds.slice(0, 2);
    const rightPortraitIds = rivalry.participantIds.slice(2, 4);
    const leftLabel = formatDashboardRivalryTeamLabel(leftPortraitIds, wrestlers);
    const rightLabel = formatDashboardRivalryTeamLabel(rightPortraitIds, wrestlers);

    return {
      id: rivalry.id,
      intensity: rivalry.heat,
      label: `${leftLabel} vs ${rightLabel}`,
      leftPortraitIds,
      rightPortraitIds,
      structure,
    };
  }

  if (structure === "multi_person" && rivalry.participantIds.length >= 3) {
    return {
      id: rivalry.id,
      intensity: rivalry.heat,
      label: compactDashboardRead(rivalry.name, 42),
      leftPortraitIds: [rivalry.participantIds[0] ?? ""].filter(Boolean),
      rightPortraitIds: rivalry.participantIds.slice(1, 3).filter(Boolean),
      structure,
    };
  }

  const [leftId, rightId] = rivalry.participantIds;
  const left = wrestlers.find((wrestler) => wrestler.id === leftId);
  const right = wrestlers.find((wrestler) => wrestler.id === rightId);
  const leftName = left ? formatDashboardRivalryLastName(left.name) : "-";
  const rightName = right ? formatDashboardRivalryLastName(right.name) : "-";

  return {
    id: rivalry.id,
    intensity: rivalry.heat,
    label: `${leftName} vs ${rightName}`,
    leftPortraitIds: leftId ? [leftId] : [],
    rightPortraitIds: rightId ? [rightId] : [],
    structure,
  };
}

function formatDashboardChampionNames(championIds: string[], wrestlers: Wrestler[]) {
  if (!championIds.length) {
    return "Vacant";
  }

  return championIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown")
    .join(" / ");
}

function isDashboardTagChampionship(championship: Championship) {
  return championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team";
}

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

function mapAlignment(alignment: string | undefined, wrestlerId: string): DashboardAlignmentLevel {
  const resolved = resolveWrestlerAlignment(alignment, wrestlerId);

  if (resolved === "Face") {
    return "face";
  }

  if (resolved === "Heel") {
    return "heel";
  }

  return "neutral";
}

function mapMorale(morale: number): DashboardMoraleLevel {
  if (morale >= 65) return "happy";
  if (morale >= 45) return "neutral";
  return "angry";
}

function getWrestlerAverageSegmentScore(show: ShowResult | undefined, wrestlerId: string) {
  if (!show) {
    return undefined;
  }

  const scores = show.segmentResults
    .filter((segment) => segment.participantIds.includes(wrestlerId))
    .map((segment) => segment.score);

  if (!scores.length) {
    return undefined;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function getLastShowRosterDeltas(game: GameState, lastShow?: ShowResult, previousShow?: ShowResult) {
  const totals = new Map<string, { fatigue: number; momentum: number }>();

  if (lastShow) {
    for (const segment of lastShow.segmentResults) {
      for (const [wrestlerId, change] of Object.entries(segment.momentumChanges)) {
        const current = totals.get(wrestlerId) ?? { fatigue: 0, momentum: 0 };
        current.momentum += change;
        totals.set(wrestlerId, current);
      }

      for (const [wrestlerId, change] of Object.entries(segment.fatigueChanges)) {
        const current = totals.get(wrestlerId) ?? { fatigue: 0, momentum: 0 };
        current.fatigue += change;
        totals.set(wrestlerId, current);
      }
    }
  }

  return {
    getOverallDelta(wrestlerId: string) {
      const lastAverage = getWrestlerAverageSegmentScore(lastShow, wrestlerId);
      const previousAverage = getWrestlerAverageSegmentScore(previousShow, wrestlerId);

      if (lastAverage === undefined || previousAverage === undefined) {
        return undefined;
      }

      const delta = lastAverage - previousAverage;

      return delta === 0 ? undefined : delta;
    },
    getPopDelta(wrestlerId: string) {
      const delta = totals.get(wrestlerId)?.momentum;

      if (delta === undefined || delta === 0) {
        return undefined;
      }

      return delta;
    },
    getStaminaDelta(wrestlerId: string) {
      if (!lastShow) {
        return undefined;
      }

      const fatigueGain = totals.get(wrestlerId)?.fatigue ?? 0;
      const recovery = game.currentWeek > lastShow.week ? 3 : 0;
      const netChange = -fatigueGain + recovery;

      if (netChange === 0) {
        return undefined;
      }

      return netChange;
    },
  };
}

function getDashboardSocialTonePriority(tone: SocialTone) {
  const priorities: Record<SocialTone, number> = {
    chaotic: 12,
    angry: 10,
    excited: 8,
    impressed: 7,
    skeptical: 5,
    analytical: 1,
  };

  return priorities[tone];
}

function getDashboardSocialCategoryPriority(category: SocialCategory) {
  const priorities: Record<SocialCategory, number> = {
    title_scene: 95,
    rivalry_heat: 90,
    ple_reaction: 86,
    viral_moment: 82,
    fatigue_concern: 78,
    push_complaint: 74,
    dirt_sheet: 70,
    fan_praise: 64,
    analyst_take: 58,
  };

  return priorities[category];
}

function getDashboardTopSocialPost(game: GameState, result: ShowResult) {
  return game.socialPosts
    .filter((post) => post.resultId === result.id)
    .sort((left, right) => {
      const leftScore = getDashboardSocialCategoryPriority(left.category) + getDashboardSocialTonePriority(left.tone);
      const rightScore = getDashboardSocialCategoryPriority(right.category) + getDashboardSocialTonePriority(right.tone);

      return rightScore - leftScore || left.id.localeCompare(right.id);
    })[0];
}

function getDashboardSocialLabel(post: SocialPost) {
  if (post.tone === "chaotic") return "Internet Is Already Yelling";
  if (post.category === "viral_moment") return "Breakout Clip";
  if (post.category === "fatigue_concern") return "Workload Discourse";
  if (post.category === "rivalry_heat") return post.tone === "angry" || post.tone === "skeptical" ? "Fans Are Done Waiting" : "Story Heat Rising";
  if (post.category === "title_scene") return post.tone === "angry" ? "Title Scene Backlash" : "Title Scene Has Buzz";
  if (post.tone === "angry") return "Fans Are Heated";
  return "IWC Pulse";
}

function getDashboardSocialTone(post: SocialPost): DashboardFalloutItem["tone"] {
  if (post.tone === "angry" || post.tone === "chaotic") return "red";
  if (post.category === "title_scene" || post.category === "rivalry_heat") return "gold";
  if (post.category === "viral_moment" || post.tone === "excited" || post.tone === "impressed") return "green";
  return "blue";
}

function buildDashboardFalloutFromLastWeek(
  game: GameState,
  result: ShowResult | undefined,
  ratingsBattle: ReturnType<typeof getRatingsBattleSnapshot>,
): DashboardViewModel["falloutFromLastWeek"] {
  if (!result) {
    return undefined;
  }

  const items: DashboardFalloutItem[] = [];
  const injuryNote = result.lockerRoomFallout?.injuryNotes?.[0];
  const moraleDrop = result.lockerRoomFallout?.moraleDrops?.[0];
  const moraleBoost = result.lockerRoomFallout?.moraleBoosts?.[0];
  const titleNote = result.titleNotes[0] ?? result.titleHistoryEvents?.[0]?.note;
  const rivalryNote = result.rivalryNotes[0] ?? result.rivalryHistoryEvents?.[0]?.note;
  const socialPost = getDashboardTopSocialPost(game, result);
  const playerEntry = ratingsBattle?.entries.find((entry) => entry.isPlayer);
  const topRival = ratingsBattle?.entries
    .filter((entry) => !entry.isPlayer && entry.latestScore !== undefined)
    .sort((left, right) => (right.latestScore ?? 0) - (left.latestScore ?? 0) || left.brandName.localeCompare(right.brandName))[0];

  if (result.biggestMomentumGain.amount > 0) {
    items.push({
      id: "breakout",
      label: "Breakout Clip",
      value: result.biggestMomentumGain.name,
      detail: `Momentum +${result.biggestMomentumGain.amount}. The next card can either cash in the noise or let it fade.`,
      tone: "green",
    });
  }

  if (result.biggestFatigueIncrease.amount > 0) {
    items.push({
      id: "fatigue",
      label: "Fatigue Concern",
      value: result.biggestFatigueIncrease.name,
      detail: `Fatigue +${result.biggestFatigueIncrease.amount}. The medical desk is already part of next week's booking conversation.`,
      tone: result.biggestFatigueIncrease.amount >= 12 ? "red" : "gold",
    });
  }

  if (injuryNote || moraleDrop || moraleBoost) {
    items.push({
      id: "locker-room",
      label: injuryNote || moraleDrop ? "Locker Room Tense" : "Room Bought In",
      value: injuryNote?.wrestlerName ?? moraleDrop?.wrestlerName ?? moraleBoost?.wrestlerName ?? "Locker Room",
      detail: injuryNote?.note ?? moraleDrop?.note ?? moraleBoost?.note ?? "The room stayed level after the show.",
      tone: injuryNote || moraleDrop ? "red" : "green",
    });
  }

  if (titleNote || rivalryNote) {
    items.push({
      id: titleNote ? "title-story" : "rivalry-story",
      label: titleNote ? "Champion Protected" : "Story Heat Rising",
      value: titleNote ? "Title Scene" : "Story Room",
      detail: compactDashboardRead(titleNote ?? rivalryNote ?? "No story fallout logged.", 118),
      tone: "gold",
    });
  }

  if (socialPost) {
    items.push({
      id: "social",
      label: getDashboardSocialLabel(socialPost),
      value: socialPost.author,
      detail: compactDashboardRead(socialPost.text, 128),
      tone: getDashboardSocialTone(socialPost),
    });
  }

  if (playerEntry?.latestScore !== undefined && topRival?.latestScore !== undefined) {
    const gap = topRival.latestScore - playerEntry.latestScore;

    items.push({
      id: "rival-desk",
      label: gap > 0 ? "Rival Desk Won The Night" : gap < 0 ? "You Won The Night" : "Ratings Dead Heat",
      value: gap > 0 ? `${topRival.brandName} +${gap}` : gap < 0 ? `${game.brandName} +${Math.abs(gap)}` : `${playerEntry.latestScore}`,
      detail:
        gap > 0
          ? `${topRival.brandName} beat you by ${gap}. The ratings argument is no longer theoretical.`
          : gap < 0
            ? `${game.brandName} cleared ${topRival.brandName} by ${Math.abs(gap)}. Keep the pressure on the rival desk.`
            : `${game.brandName} and ${topRival.brandName} finished level. Next week's card owns the argument.`,
      tone: gap > 0 ? "red" : gap < 0 ? "green" : "gold",
    });
  }

  if (!items.length) {
    items.push({
      id: "steady",
      label: "Quiet Receipt",
      value: getShowGrade(result.totalScore),
      detail: "No major fallout moved, which makes next week about creating a sharper argument.",
      tone: "neutral",
    });
  }

  const headline = injuryNote
    ? "Medical Desk Changed The Board"
    : moraleDrop
      ? "Locker Room Needs A Reply"
      : socialPost && (socialPost.tone === "chaotic" || socialPost.tone === "angry")
        ? getDashboardSocialLabel(socialPost)
        : topRival && playerEntry?.latestScore !== undefined && topRival.latestScore !== undefined && topRival.latestScore > playerEntry.latestScore
          ? "Rival Desk Won The Night"
          : result.biggestMomentumGain.amount > 0
            ? "Breakout Clip Has Heat"
            : "Last Week Has A Receipt";

  return {
    headline,
    detail: `Week ${result.week} closed at ${result.totalScore} (${getShowGrade(result.totalScore)}). These are the resolved consequences shaping ${getCurrentCalendarWeek(game).showName}.`,
    weekLabel: `S${result.seasonNumber} W${result.week} · ${result.showName}`,
    items: items.slice(0, 6),
  };
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
  const falloutFromLastWeek = buildDashboardFalloutFromLastWeek(game, result ?? lastShow, ratingsBattle);
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers, protectedRestIds));
  const hasPendingPostShow = Boolean(result && result.week === game.currentWeek);
  const rosterTags = game.wrestlers.flatMap((wrestler) => getRosterPressureTags(wrestler, game.currentWeek));
  const unavailableCount = rosterTags.filter((tag) => tag === "Unavailable").length;
  const injuryCount = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "healthy").length;
  const freeAgents = getAvailableFreeAgents(game, draftPool).slice(0, 5);
  const brandPlateLabel = getBrandPlateLabel(game.brandStyle);
  const brandPortraitSrc = getBrandChairByStyle(game.brandStyle).portraitSrc;

  const sortedRoster = [...game.wrestlers].sort(
    (a, b) => b.popularity + b.momentum - (a.popularity + a.momentum) || a.name.localeCompare(b.name),
  );
  const previousShow = game.showHistory.at(-2);
  const rosterDeltas = getLastShowRosterDeltas(game, lastShow, previousShow);

  const roster = sortedRoster.map((wrestler, index) => {
    const finance = getRosterFinanceValueForWrestler(wrestler);
    const contract = getContractForWrestler(game, wrestler.id);

    return {
      contract: contract ? `${contract.contractWeeksRemaining}W` : "-",
      cost: finance ? formatShortMoney(finance.weeklyHireRateUsd) : "-",
      id: wrestler.id,
      morale: mapMorale(wrestler.morale),
      name: wrestler.name,
      overall: Math.round((wrestler.ringSkill + wrestler.promoSkill) / 2),
      overallDelta: rosterDeltas.getOverallDelta(wrestler.id),
      pop: wrestler.popularity,
      popDelta: rosterDeltas.getPopDelta(wrestler.id),
      rank: index + 1,
      alignment: mapAlignment(wrestler.alignment, wrestler.id),
      selected: index === 0,
      stamina: Math.max(0, 100 - wrestler.fatigue),
      staminaDelta: rosterDeltas.getStaminaDelta(wrestler.id),
    };
  });

  const champions = game.championships.slice(0, 5).map((title) => {
    const holderIds = title.championIds.filter(Boolean);
    const isTagTeam = isDashboardTagChampionship(title);

    return {
      holderIds,
      id: title.id,
      isTagTeam,
      name: formatDashboardChampionNames(holderIds, game.wrestlers),
      prestige: title.prestige,
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

  const rivalries = [...game.rivalries]
    .sort((left, right) => right.heat - left.heat || left.name.localeCompare(right.name))
    .map((rivalry) => buildDashboardRivalryFeedEntry(rivalry, game.wrestlers));

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

  const primaryAction: DashboardViewModel["primaryAction"] = hasPendingPostShow
    ? { label: "Show Recap", screen: "results" }
    : validSegments.length >= 2
      ? { label: "Review Card", screen: "booking" }
      : { label: "Book Show", screen: "booking" };

  return {
    alerts: alerts.slice(0, 4),
    brandPlateLabel,
    brandPortraitSrc,
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
    falloutFromLastWeek,
    gmCrestLabel: game.gmName.slice(0, 1).toUpperCase() || "G",
    goals,
    hasResults: game.showHistory.length > 0,
    hasPendingPostShow,
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
      viewershipLabel: lastShow ? formatNumber(lastShow.totalScore) : "-",
    },
    nextShowMeta: currentShow.isGoHome ? "Go-home week" : currentShow.showType.toUpperCase(),
    nextShowName: currentShow.showName,
    primaryAction,
    promo: buildPromo(game),
    rankingLabel: ratingsBattle ? `#${ratingsBattle.playerRank} of ${ratingsBattle.entries.length}` : "Brand HQ",
    rivalries,
    roster,
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
      valid: isValidSegment(segment, game.wrestlers, protectedRestIds),
    })),
  };
}
