import { getFinancePressureLabel } from "./finance";
import {
  getInjuryStatusLabel,
  getRosterPressureTags,
  getTopOverusedWrestler,
  getTopUnderusedWrestler,
  getWeeksSinceLastBooked,
} from "./rosterContextReads";
import { getBestSegment, getCurrentCalendarWeek, getShowGrade, getWrestlerDivisionGroup, isValidSegment } from "./scoring";
import {
  formatChampionshipEventType,
  formatRivalryEventType,
  formatRivalryStatus,
  getChampionshipHistory,
  getChampionshipHistoryAgeWeeks,
  getRivalryHistory,
  getRivalryHistoryAgeWeeks,
  hasPlePayoff,
} from "./storyContextReads";
import { getChampionshipDivisionGroup, wrestlerFitsChampionshipDivision } from "./titleCatalog";
import type {
  CalendarWeek,
  Championship,
  ChampionshipHistoryEvent,
  FinanceReport,
  GameState,
  PressureLabel,
  Rivalry,
  RivalryHistoryEvent,
  Segment,
  SegmentResult,
  ShowResult,
  Wrestler,
} from "./types";

export type PleBuildPressureTone = "ready" | "steady" | "watch" | "build";

export type PleBuildPressureItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: PleBuildPressureTone;
};

export type PleBuildPressureSnapshot = {
  phaseLabel: string;
  headline: string;
  detail: string;
  items: PleBuildPressureItem[];
  spoilerNote: string;
};

export type CauseLedgerTone = "strong" | "steady" | "watch";

export type CauseLedgerItem = {
  id: string;
  label: string;
  detail: string;
  tone: CauseLedgerTone;
};

export type CauseLedgerSection = {
  id: string;
  label: string;
  items: CauseLedgerItem[];
};

export type BroadcastFalloutTone = "strong" | "steady" | "watch";

export type BroadcastFalloutItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: BroadcastFalloutTone;
};

export type BroadcastFalloutSnapshot = {
  headline: string;
  detail: string;
  items: BroadcastFalloutItem[];
};

export type WeeklyDecisionPressureTone = "strong" | "steady" | "watch";

export type WeeklyDecisionPressureItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: WeeklyDecisionPressureTone;
};

export type WeeklyDecisionPressureSnapshot = {
  headline: string;
  detail: string;
  items: WeeklyDecisionPressureItem[];
};

export type LivingWorldPressureVoice = "Ownership" | "Locker Room" | "Fans / IWC" | "Rival Brands" | "Creative Room";

export type LivingWorldPressureTone = "strong" | "steady" | "watch";

export type LivingWorldPressureItem = {
  id: string;
  voice: LivingWorldPressureVoice;
  label: string;
  value: string;
  detail: string;
  action: string;
  tone: LivingWorldPressureTone;
  priority: number;
};

export type LivingWorldPressureSnapshot = {
  headline: string;
  weekRead: string;
  whoIsWatching: string;
  riskRead: string;
  nextAction: string;
  items: LivingWorldPressureItem[];
};

export type WeekReviewHandoffTone = "strong" | "steady" | "watch";

export type WeekReviewHandoffItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: WeekReviewHandoffTone;
};

export type WeekReviewHandoffSnapshot = {
  headline: string;
  detail: string;
  items: WeekReviewHandoffItem[];
};

export type WeekReviewOfficeTone = "strong" | "steady" | "watch";

export type WeekReviewOfficeItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: WeekReviewOfficeTone;
};

export type WeekReviewOfficeSnapshot = {
  headline: string;
  detail: string;
  items: WeekReviewOfficeItem[];
};


type TitleScenePressureTone = "hot" | "steady" | "watch" | "build";

type TitleScenePressureDiagnostic = {
  id: string;
  label: string;
  detail: string;
  tone: TitleScenePressureTone;
};

type TitleScenePressureSnapshot = {
  primary: TitleScenePressureDiagnostic;
  diagnostics: TitleScenePressureDiagnostic[];
  divisionHealth: string;
  producerRead: string;
  defenseWindow: number;
  reignLength: number;
  weeksSinceLastTitleEvent: number;
  titleRivalries: Rivalry[];
};

type RivalryTimingTone = "hot" | "steady" | "watch" | "build";

type RivalryTimingDiagnostic = {
  id: string;
  label: string;
  detail: string;
  tone: RivalryTimingTone;
};

type RivalryTimingSnapshot = {
  primary: RivalryTimingDiagnostic;
  diagnostics: RivalryTimingDiagnostic[];
  timingRead: string;
  producerRead: string;
  weeksSinceAdvanced: number;
  weeksUntilPle: number;
  currentCardBeats: number;
  currentCardParticipants: number;
  recentlyPaidOff: boolean;
};


function formatMoney(amount: number) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString()}`;
}


function formatPressureLabel(label: PressureLabel) {
  return label;
}


function getLatestFinanceReport(game: GameState) {
  return game.financeReports[game.financeReports.length - 1];
}


function getFinanceReportForResult(game: GameState, result: ShowResult) {
  return game.financeReports.find((report) => report.id === `${result.id}-finance`);
}


function getLegacyFinanceRevenue(report: FinanceReport) {
  return report.ticketRevenue + report.merchRevenue + report.mediaRevenue;
}


function getLegacyFinanceExpenses(report: FinanceReport) {
  return report.talentCost + report.productionCost;
}


function getFinanceGrossRevenue(report: FinanceReport) {
  return report.grossRevenue ?? getLegacyFinanceRevenue(report);
}


function getFinanceTotalExpenses(report: FinanceReport) {
  return report.totalExpenses ?? getLegacyFinanceExpenses(report);
}


function getFinancePresenceRead(money: number, pressureLabel: PressureLabel, latestReport?: FinanceReport) {
  if (!latestReport) {
    return `${formatPressureLabel(pressureLabel)} pressure with ${formatMoney(money)} available. No show books have closed yet this season.`;
  }

  return `${formatPressureLabel(pressureLabel)} pressure with ${formatMoney(money)} available after ${latestReport.showName} closed at ${formatMoney(latestReport.profitLoss)}.`;
}


function formatWeekCount(weeks: number) {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}


function getNextPle(calendar: CalendarWeek[], currentWeek: number) {
  return calendar.find((week) => week.showType === "ple" && week.weekNumber >= currentWeek && !week.completed);
}


function getWeeksUntilPle(nextPle: CalendarWeek | undefined, currentWeek: number) {
  if (!nextPle) {
    return 0;
  }

  return Math.max(0, nextPle.weekNumber - currentWeek);
}


function findWrestlerByName(name: string, wrestlers: Wrestler[]) {
  return wrestlers.find((wrestler) => wrestler.name === name);
}


function getSegmentParticipants(segment: Segment, wrestlers: Wrestler[]) {
  return segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}


function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}


function isSinglesChampionship(championship: Championship) {
  return championship.eligibleMatchScope !== "tag_team" && championship.division !== "Tag Team" && championship.championIds.length === 1;
}


function isTagChampionship(championship: Championship) {
  return championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team";
}


function doSegmentParticipantsFitChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[]) {
  const titleDivision = getChampionshipDivisionGroup(championship);

  if (!titleDivision) {
    return true;
  }

  return segment.participantIds.every((id) => wrestlerFitsChampionshipDivision(wrestlers.find((wrestler) => wrestler.id === id), championship));
}


function getTagTitleSides(segment: Segment, championship: Championship) {
  if (segment.type !== "Match" || segment.segmentCatalogId !== "M020" || segment.participantIds.length !== 4 || championship.championIds.length !== 2) {
    return undefined;
  }

  const teamAIds = segment.participantIds.slice(0, 2);
  const teamBIds = segment.participantIds.slice(2, 4);
  const championIds = new Set(championship.championIds);
  const teamAHasChampions = teamAIds.every((id) => championIds.has(id));
  const teamBHasChampions = teamBIds.every((id) => championIds.has(id));

  if (teamAHasChampions === teamBHasChampions) {
    return undefined;
  }

  return {
    championSideIds: teamAHasChampions ? teamAIds : teamBIds,
    challengerSideIds: teamAHasChampions ? teamBIds : teamAIds,
  };
}


function canSegmentContestChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[] = []) {
  if (isTagChampionship(championship)) {
    return Boolean(isValidSegment(segment, wrestlers) && getTagTitleSides(segment, championship));
  }

  return (
    segment.type === "Match" &&
    isValidSegment(segment, wrestlers) &&
    segment.participantIds.length === 2 &&
    isSinglesChampionship(championship) &&
    segment.participantIds.includes(championship.championIds[0]) &&
    doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
  );
}


function getTitleSceneTalentScore(wrestler: Wrestler, championship: Championship, rivalries: Rivalry[] = []) {
  const championIds = new Set(championship.championIds);
  const titleRivalryBonus = rivalries.some(
    (rivalry) => rivalry.stakes === "title" && rivalry.participantIds.includes(wrestler.id) && rivalry.participantIds.some((id) => championIds.has(id)),
  )
    ? 18
    : 0;

  return wrestler.popularity + wrestler.momentum + titleRivalryBonus;
}


function getTitleDivisionScene(championship: Championship, wrestlers: Wrestler[], rivalries: Rivalry[] = [], currentWeek = 1, championships: Championship[] = []) {
  const championIds = new Set(championship.championIds);
  const otherChampionIds = new Set(
    championships.filter((title) => title.id !== championship.id).flatMap((title) => title.championIds),
  );
  const champions = championship.championIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
  const manualContenders = (championship.contenderIds ?? [])
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler && !championIds.has(wrestler.id) && wrestlerFitsChampionshipDivision(wrestler, championship)));
  const manualContenderIds = new Set(manualContenders.map((wrestler) => wrestler.id));
  const eligibleRoster = wrestlers
    .filter((wrestler) => !championIds.has(wrestler.id))
    .filter((wrestler) => !otherChampionIds.has(wrestler.id))
    .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship))
    .sort((a, b) => getTitleSceneTalentScore(b, championship, rivalries) - getTitleSceneTalentScore(a, championship, rivalries));
  const derivedTopContenders = eligibleRoster.filter((wrestler) => !manualContenderIds.has(wrestler.id)).slice(0, Math.max(0, 3 - manualContenders.length));
  const topContenders = championship.contenderIds ? manualContenders : [...manualContenders, ...derivedTopContenders].slice(0, 3);
  const topContenderIds = new Set(topContenders.map((wrestler) => wrestler.id));
  const risingContenders = eligibleRoster
    .filter((wrestler) => !topContenderIds.has(wrestler.id))
    .filter((wrestler) => wrestler.momentum >= 80 || getWeeksSinceLastBooked(wrestler, currentWeek) >= 2)
    .sort((a, b) => b.momentum - a.momentum || b.popularity - a.popularity)
    .slice(0, 3);
  const outsideDivision = wrestlers.filter((wrestler) => !championIds.has(wrestler.id) && !wrestlerFitsChampionshipDivision(wrestler, championship));

  return {
    champions,
    topContenders,
    risingContenders,
    eligibleRoster,
    outsideDivision,
  };
}


function getReignLength(championship: Championship, currentWeek: number) {
  return Math.max(1, currentWeek - championship.reignStartWeek + 1);
}

function getTitleRivalries(championship: Championship, wrestlers: Wrestler[], rivalries: Rivalry[]) {
  const championIds = new Set(championship.championIds);

  return rivalries.filter((rivalry) => {
    if (rivalry.status === "stale" || rivalry.stakes !== "title") {
      return false;
    }

    const hasChampion = rivalry.participantIds.some((id) => championIds.has(id));
    const hasEligibleChallenger = rivalry.participantIds.some((id) => {
      const wrestler = wrestlers.find((talent) => talent.id === id);
      return Boolean(wrestler && !championIds.has(id) && wrestlerFitsChampionshipDivision(wrestler, championship));
    });

    return hasChampion && hasEligibleChallenger;
  });
}


function getTagDivisionHealthDiagnostics(championship: Championship, game: GameState): TitleScenePressureDiagnostic[] {
  if (!isTagChampionship(championship)) {
    return [];
  }

  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
  const diagnostics: TitleScenePressureDiagnostic[] = [];
  const challengers = scene.eligibleRoster;
  const champions = scene.champions;
  const championPairActive =
    champions.length === 2 &&
    champions.every(
      (wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) <= 2 && !getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
    );
  const restedChallengers = challengers.filter((wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2);
  const challengerInjuryRisk = challengers.some(
    (wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );

  const hasFreshMatchup = restedChallengers.length >= 2;
  const hasHotPair = (() => {
    for (let index = 0; index < challengers.length; index += 1) {
      const first = challengers[index];
      for (let next = index + 1; next < challengers.length; next += 1) {
        const second = challengers[next];
        if (
          (first.momentum >= 75 && second.momentum >= 75) ||
          (first.popularity >= 78 && second.popularity >= 78)
        ) {
          return true;
        }
      }
    }

    return false;
  })();

  const championInjuryRisk = champions.some(
    (wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );
  const recentHistory = getChampionshipHistory(game, championship.id, 1);
  const latestTitleEvent = recentHistory[0];
  const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
  const reignLength = getReignLength(championship, game.currentWeek);
  const weeksSinceLastTitleEvent = latestTitleEvent
    ? getChampionshipHistoryAgeWeeks(game, latestTitleEvent)
    : Math.max(0, reignLength - 1);

  diagnostics.push({
    id: "tag-champion-pair-active",
    label: scene.champions.length >= 2 ? "Champion Pair Active" : "Champion Pair Needed",
    detail:
      scene.champions.length >= 2
        ? championPairActive
          ? `The champions, ${getWrestlerNames(championship.championIds, game.wrestlers)}, are active enough to make a credible defense.`
          : "One or both champions are currently quiet, so momentum checks are advisory only."
        : "No champion pair is assigned yet, so the tag title needs a GM assignment before it can be defended.",
    tone: scene.champions.length >= 2 ? (championPairActive ? "steady" : "watch") : "build",
  });

  if (challengers.length < 2) {
    diagnostics.push({
      id: "tag-needs-challengers",
      label: "Needs Challengers",
      detail: "Two eligible non-champion wrestlers are required to safely build another tag title defense lane.",
      tone: "build",
    });
  } else if (challengers.length < 4) {
    diagnostics.push({
      id: "tag-underrepresented",
      label: "Tag Title Underrepresented",
      detail: "The challenger pool is thin for repeated title-defenses while keeping rotation variety.",
      tone: "watch",
    });
  }

  if (hasFreshMatchup) {
    diagnostics.push({
      id: "tag-fresh-matchup",
      label: "Fresh Matchup Available",
      detail: "There are rested challengers available for a fresh 2v2 defense booking.",
      tone: "hot",
    });
  }

  if (hasHotPair) {
    diagnostics.push({
      id: "tag-hot-pair",
      label: "Hot Pair Available",
      detail: "At least one eligible pair is showing strong momentum/popularity for immediate tag title challenge framing.",
      tone: "hot",
    });
  }

  if (championInjuryRisk || challengerInjuryRisk) {
    diagnostics.push({
      id: "tag-injury-risk",
      label: "Injury Risk Around Champions",
      detail: "Injury flags around champions/challengers should be checked before deciding the defense lane.",
      tone: "watch",
    });
  }

  if (latestTitleEvent?.eventType === "successful_defense" && weeksSinceLastTitleEvent <= 1) {
    diagnostics.push({
      id: "tag-recent-defense",
      label: "Recently Defended",
      detail: "The title was actively defended in the latest resolvable title event.",
      tone: "steady",
    });
  }

  if (reignLength >= defenseWindow && championship.defenses === 0) {
    diagnostics.push({
      id: "tag-stale-reign",
      label: "Stale Reign",
      detail: `${Math.max(weeksSinceLastTitleEvent, defenseWindow)} weeks since last title event. A fresh defense is advisable.`,
      tone: "build",
    });
  }

  return diagnostics;
}


function getTitleScenePressureSnapshot(championship: Championship, game: GameState): TitleScenePressureSnapshot {
  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
  const recentHistory = getChampionshipHistory(game, championship.id, 1);
  const latestTitleEvent = recentHistory[0];
  const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
  const reignLength = getReignLength(championship, game.currentWeek);
  const weeksSinceLastTitleEvent = latestTitleEvent ? getChampionshipHistoryAgeWeeks(game, latestTitleEvent) : Math.max(0, reignLength - 1);
  const calendarWeek = getCurrentCalendarWeek(game);
  const contenders = scene.eligibleRoster;
  const hotContenders = contenders.filter((wrestler) => wrestler.momentum >= 75);
  const premiumContenders = contenders.filter((wrestler) => wrestler.popularity >= 75);
  const titleRivalries = getTitleRivalries(championship, game.wrestlers, game.rivalries);
  const championNeedsTv = scene.champions.some((wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2);
  const diagnostics: TitleScenePressureDiagnostic[] = [];

  if (championship.eligibleMatchScope === "tag_team") {
    diagnostics.push(...getTagDivisionHealthDiagnostics(championship, game).slice(0, 4));
    diagnostics.push({
      id: "tag-scope",
      label: scene.champions.length < 2 ? "Champion Pair Needed" : contenders.length >= 2 ? "Tag Title Ready" : "Needs Challengers",
      detail:
        scene.champions.length < 2
          ? "Assign a champion pair before this title can become a valid M020 defense."
          : contenders.length >= 2
          ? "The title can be defended in a valid M020 tag match with the champions together on one side."
          : "The current roster does not have two eligible challengers outside the champion pair.",
      tone: scene.champions.length < 2 ? "build" : contenders.length >= 2 ? "steady" : "build",
    });
  } else if (!scene.champions.length) {
    diagnostics.push({
      id: "no-champion",
      label: "Champion Assignment Gap",
      detail: "No current champion resolves from the saved roster data, so this scene can only show fallback context.",
      tone: "build",
    });
  } else {
    if (contenders.length < 2) {
      diagnostics.push({
        id: "needs-challenger",
        label: "Needs A Challenger",
        detail: "The title office has fewer than two eligible same-division challengers around the champion.",
        tone: "build",
      });
    }

    if (championNeedsTv) {
      const quietChampion = scene.champions.find((wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2);
      diagnostics.push({
        id: "champion-tv",
        label: "Champion Needs TV",
        detail: quietChampion
          ? `${quietChampion.name} has been off the current-season TV board for ${formatWeekCount(getWeeksSinceLastBooked(quietChampion, game.currentWeek))}.`
          : "The champion has been away from recent TV time.",
        tone: "watch",
      });
    }

    if (weeksSinceLastTitleEvent >= defenseWindow && reignLength >= defenseWindow) {
      diagnostics.push({
        id: "defense-drought",
        label: "Defense Drought",
        detail: `No resolved defense or title change is recorded in ${formatWeekCount(weeksSinceLastTitleEvent)}; this is advisory only.`,
        tone: "watch",
      });
    }

    if (titleRivalries.length || hotContenders.length >= 2) {
      diagnostics.push({
        id: "hot-scene",
        label: "Hot Scene",
        detail: titleRivalries.length
          ? `${titleRivalries[0].name} gives the title picture active story heat.`
          : `${hotContenders.slice(0, 2).map((wrestler) => wrestler.name).join(" / ")} are carrying strong momentum near this belt.`,
        tone: "hot",
      });
    }

    if ((calendarWeek.showType === "ple" || calendarWeek.isGoHome) && (titleRivalries.length || hotContenders.length || premiumContenders.length) && contenders.length >= 2) {
      diagnostics.push({
        id: "ple-ready",
        label: "PLE-Ready Stakes",
        detail: `${calendarWeek.showName} has enough visible champion/challenger context for a major-event title beat if you want it.`,
        tone: "hot",
      });
    }

    if (contenders.length >= 7) {
      diagnostics.push({
        id: "contender-crowding",
        label: "Contender Crowding",
        detail: `${contenders.length} eligible wrestlers fit this lane, so the title scene can support eliminators or spotlight matches.`,
        tone: "steady",
      });
    }

    if (!titleRivalries.length && !hotContenders.length && weeksSinceLastTitleEvent >= Math.max(3, defenseWindow - 2)) {
      diagnostics.push({
        id: "cooling-division",
        label: "Cooling Division",
        detail: "No hot contender or active title rivalry is currently propping up the scene.",
        tone: "build",
      });
    }
  }

  if (!diagnostics.length) {
    diagnostics.push({
      id: "stable-scene",
      label: "Stable Division",
      detail: "Champion, challenger depth, and recent title context are all readable without a forced title beat.",
      tone: "steady",
    });
  }

  const primary =
    diagnostics.find((item) => item.tone === "build") ??
    diagnostics.find((item) => item.tone === "watch") ??
    diagnostics.find((item) => item.tone === "hot") ??
    diagnostics[0];
  const divisionHealth = `${contenders.length} eligible · ${hotContenders.length} hot · ${titleRivalries.length} title rivalr${titleRivalries.length === 1 ? "y" : "ies"}`;
  const producerRead =
    primary.tone === "hot"
      ? "Title office reads hot. Feature it, protect it, or let the chase breathe."
      : primary.tone === "build"
        ? "Title office wants attention, but the choice stays with booking."
        : primary.tone === "watch"
          ? "Title office is flagging pressure without requiring a defense."
          : "Title office is steady and ready to support TV when you need it.";

  return {
    primary,
    diagnostics: diagnostics.slice(0, 4),
    divisionHealth,
    producerRead,
    defenseWindow,
    reignLength,
    weeksSinceLastTitleEvent,
    titleRivalries,
  };
}


function getTitleScenePressureRank(tone: TitleScenePressureTone) {
  if (tone === "build") {
    return 4;
  }

  if (tone === "watch") {
    return 3;
  }

  if (tone === "hot") {
    return 2;
  }

  return 1;
}


function getChampionshipPressureSnapshots(game: GameState) {
  return game.championships
    .map((championship) => ({
      championship,
      snapshot: getTitleScenePressureSnapshot(championship, game),
    }))
    .sort(
      (a, b) =>
        getTitleScenePressureRank(b.snapshot.primary.tone) - getTitleScenePressureRank(a.snapshot.primary.tone) ||
        b.championship.prestige - a.championship.prestige,
    );
}


function getRivalryTimingSnapshot(rivalry: Rivalry, game: GameState): RivalryTimingSnapshot {
  const calendarWeek = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const history = getRivalryHistory(game, rivalry.id, 20);
  const latestPlePayoff = history.find((event) => event.eventType === "ple_payoff");
  const latestHistory = history[0];
  const latestHistoryAge = latestHistory ? getRivalryHistoryAgeWeeks(game, latestHistory) : Math.max(0, game.currentWeek - 1);
  const latestPayoffAge = latestPlePayoff ? getRivalryHistoryAgeWeeks(game, latestPlePayoff) : Infinity;
  const recentlyPaidOff = latestPayoffAge <= 2;
  const weeksSinceAdvanced = rivalry.lastAdvancedWeek ? Math.max(0, game.currentWeek - rivalry.lastAdvancedWeek) : Math.max(0, game.currentWeek - 1);
  const currentCardSegments = game.currentShow.filter((segment) => segment.rivalryId === rivalry.id);
  const currentCardParticipants = new Set(
    game.currentShow
      .flatMap((segment) => segment.participantIds)
      .filter((id) => rivalry.participantIds.includes(id)),
  );
  const diagnostics: RivalryTimingDiagnostic[] = [];

  if (recentlyPaidOff) {
    diagnostics.push({
      id: "recently-paid-off",
      label: "Recently Paid Off",
      detail: `${rivalry.name} hit a PLE checkpoint ${formatWeekCount(latestPayoffAge)} ago.`,
      tone: "steady",
    });
  }

  if (!recentlyPaidOff && rivalry.heat >= 78 && rivalry.weeksActive >= 5 && weeksSinceAdvanced >= 2) {
    diagnostics.push({
      id: "payoff-overdue",
      label: "Payoff Overdue",
      detail: `High heat, ${formatWeekCount(rivalry.weeksActive)} active, and ${formatWeekCount(weeksSinceAdvanced)} since the last recorded beat.`,
      tone: "watch",
    });
  }

  if (!recentlyPaidOff && (calendarWeek.showType === "ple" || weeksUntilPle <= 1) && rivalry.heat >= 65 && rivalry.weeksActive >= 3 && rivalry.freshness >= 40) {
    diagnostics.push({
      id: "ple-ready",
      label: "PLE-Ready",
      detail: `${nextPle?.showName ?? calendarWeek.showName} is close, and this feud has enough heat and time on the board for a major payoff if you choose it.`,
      tone: "hot",
    });
  }

  if (rivalry.status === "stale" || rivalry.status === "cooling" || rivalry.freshness <= 35 || rivalry.heat < 45) {
    diagnostics.push({
      id: "cooling-off",
      label: "Cooling Off",
      detail: `Heat ${rivalry.heat}, freshness ${rivalry.freshness}, and ${formatRivalryStatus(rivalry.status)} status say the room is losing the thread.`,
      tone: "build",
    });
  }

  if (!recentlyPaidOff && currentCardSegments.length === 0 && (weeksSinceAdvanced >= 2 || rivalry.lastAdvancedWeek === 0)) {
    diagnostics.push({
      id: "needs-tv",
      label: "Needs TV",
      detail: rivalry.lastAdvancedWeek
        ? `${formatWeekCount(weeksSinceAdvanced)} since the last recorded beat, and no current rundown segment is attached.`
        : "No recorded TV beat yet, and no current rundown segment is attached.",
      tone: "watch",
    });
  }

  if (rivalry.heat >= 75 && rivalry.freshness >= 50 && !recentlyPaidOff) {
    diagnostics.push({
      id: "hot-program",
      label: "Hot Program",
      detail: `Heat ${rivalry.heat} with ${rivalry.freshness} freshness gives creative a strong live wire.`,
      tone: "hot",
    });
  }

  if (rivalry.weeksActive <= 1 && latestHistory?.eventType === "started") {
    diagnostics.push({
      id: "just-sparked",
      label: "Just Sparked",
      detail: "The premise is fresh. A clean TV beat can make the audience understand why it matters.",
      tone: "build",
    });
  } else if (rivalry.heat >= 55 && rivalry.weeksActive <= 4 && rivalry.freshness >= 45) {
    diagnostics.push({
      id: "building-heat",
      label: "Building Heat",
      detail: `${formatWeekCount(rivalry.weeksActive)} active with enough freshness to keep layering TV beats.`,
      tone: "steady",
    });
  }

  if (currentCardSegments.length) {
    diagnostics.push({
      id: "on-card",
      label: "On Tonight's Board",
      detail: `${currentCardSegments.length} current segment${currentCardSegments.length === 1 ? "" : "s"} attached, with ${currentCardParticipants.size} participant${currentCardParticipants.size === 1 ? "" : "s"} visible.`,
      tone: "steady",
    });
  }

  if (!diagnostics.length) {
    diagnostics.push({
      id: "steady-program",
      label: "Steady Program",
      detail: "The feud has readable state and no urgent timing pressure from the current board.",
      tone: "steady",
    });
  }

  const primary =
    diagnostics.find((item) => item.id === "payoff-overdue") ??
    diagnostics.find((item) => item.id === "ple-ready") ??
    diagnostics.find((item) => item.id === "cooling-off") ??
    diagnostics.find((item) => item.id === "needs-tv") ??
    diagnostics.find((item) => item.id === "hot-program") ??
    diagnostics[0];
  const timingRead = `${formatWeekCount(rivalry.weeksActive)} active · ${rivalry.lastAdvancedWeek ? `${formatWeekCount(weeksSinceAdvanced)} since beat` : "no TV beat yet"} · ${weeksUntilPle === 0 ? "PLE week" : `${formatWeekCount(weeksUntilPle)} to PLE`}`;
  const producerRead =
    primary.id === "payoff-overdue"
      ? "Creative room reads this as high-pressure. Payoff is available, not forced."
      : primary.id === "ple-ready"
        ? "Major-event window is open. The final call stays with the GM."
        : primary.id === "cooling-off"
          ? "This needs a distinct beat or a deliberate exit plan soon."
          : primary.id === "needs-tv"
            ? "The feud needs visibility before the audience loses the thread."
            : primary.id === "hot-program"
              ? "Strong program. Feature it, protect it, or let anticipation breathe."
              : "The feud can keep building at TV pace.";

  return {
    primary,
    diagnostics: diagnostics.slice(0, 4),
    timingRead,
    producerRead,
    weeksSinceAdvanced,
    weeksUntilPle,
    currentCardBeats: currentCardSegments.length,
    currentCardParticipants: currentCardParticipants.size,
    recentlyPaidOff,
  };
}


function getRivalryTimingRank(tone: RivalryTimingTone) {
  if (tone === "watch") {
    return 4;
  }

  if (tone === "build") {
    return 3;
  }

  if (tone === "hot") {
    return 2;
  }

  return 1;
}


function getRivalryTimingSnapshots(game: GameState) {
  return game.rivalries
    .map((rivalry) => ({
      rivalry,
      snapshot: getRivalryTimingSnapshot(rivalry, game),
    }))
    .sort(
      (a, b) =>
        getRivalryTimingRank(b.snapshot.primary.tone) - getRivalryTimingRank(a.snapshot.primary.tone) ||
        b.rivalry.heat - a.rivalry.heat ||
        a.rivalry.name.localeCompare(b.rivalry.name),
    );
}


function getBookedWrestlerIds(segments: Segment[]) {
  return new Set(segments.flatMap((segment) => segment.participantIds));
}


function getCurrentCardTitleMatchCount(game: GameState, validShowSegments: Segment[]) {
  return validShowSegments.filter((segment) => {
    const championship = segment.championshipId ? game.championships.find((title) => title.id === segment.championshipId) : undefined;
    return Boolean(championship && canSegmentContestChampionship(segment, championship, game.wrestlers));
  }).length;
}


function formatNamesList(names: string[], fallback: string, limit = 3) {
  if (!names.length) {
    return fallback;
  }

  return `${names.slice(0, limit).join(" / ")}${names.length > limit ? " / more" : ""}`;
}


function getSafeBestSegment(result: ShowResult) {
  return result.segmentResults?.length ? getBestSegment(result) : undefined;
}


function getSegmentResultLabel(segment: SegmentResult) {
  return segment.participantNames.length ? segment.participantNames.join(" / ") : segment.type;
}


function getScoreFalloutRead(result: ShowResult) {
  const strongSegments = result.segmentResults.filter((segment) => segment.score >= 85);
  const coldSegments = result.segmentResults.filter((segment) => segment.score < 60);

  if (result.totalScore >= 85) {
    return `${strongSegments.length} segment${strongSegments.length === 1 ? "" : "s"} landed at 85+, so the broadcast reads like a premium night.`;
  }

  if (result.totalScore >= 70) {
    return coldSegments.length
      ? `The final grade held up, but ${coldSegments.length} segment${coldSegments.length === 1 ? "" : "s"} finished below 60.`
      : "The card delivered a controlled result without a major cold segment dragging the show down.";
  }

  if (result.totalScore >= 55) {
    return strongSegments.length
      ? `${strongSegments.length} strong segment${strongSegments.length === 1 ? "" : "s"} gave the night upside, but the total score stayed mixed.`
      : "The show landed in uneven territory because the card did not produce enough high-end segments.";
  }

  return coldSegments.length
    ? `${coldSegments.length} segment${coldSegments.length === 1 ? "" : "s"} finished below 60, which left the broadcast cold.`
    : "The broadcast finished cold without enough standout scoring to lift the night.";
}



export function getWeeklyDecisionPressureSnapshot(game: GameState, result?: ShowResult): WeeklyDecisionPressureSnapshot {
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const topMomentumTalent = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0];
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const injuryConcernCount = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk")).length;
  const focusRivalryTiming = getRivalryTimingSnapshots(game)[0];
  const focusTitlePressure = getChampionshipPressureSnapshots(game)[0];
  const financeReport = result ? getFinanceReportForResult(game, result) : getLatestFinanceReport(game);
  const financePressure = getFinancePressureLabel(game.money, financeReport?.profitLoss ?? 0);
  const calendarDetail = nextPle
    ? weeksUntilPle === 0
      ? `${currentShow.showName} is a PLE week. Current pressure is major-event readiness, not a forecast.`
      : `${formatWeekCount(weeksUntilPle)} until ${nextPle.showName}. Current card work can build toward that checkpoint.`
    : "No remaining PLE is on the current season calendar.";
  const lastShowDetail = result
    ? `${result.showName} closed at ${result.totalScore} (${getShowGrade(result.totalScore)}). ${result.biggestMomentumGain.name} had the biggest momentum gain.`
    : game.showHistory.length
      ? `${game.showHistory[game.showHistory.length - 1].showName} is the latest closed show in the save.`
      : "No show has run yet. Week 1 pressure starts with building a coherent first card.";
  const rosterValue = topOverused ? "Overuse" : topUnderused ? "Underuse" : injuryConcernCount ? "Availability" : "Controlled";
  const rosterDetail = topOverused
    ? `${topOverused.name} is the clearest workload flag at ${topOverused.fatigue} fatigue.`
    : topUnderused
      ? `${topUnderused.name} has been off TV for ${formatWeekCount(getWeeksSinceLastBooked(topUnderused, game.currentWeek))}.`
      : injuryConcernCount
        ? `${injuryConcernCount} wrestler${injuryConcernCount === 1 ? "" : "s"} carry injury or medical-risk context.`
        : "No major roster pressure is leading the week.";

  const items: WeeklyDecisionPressureItem[] = [
    {
      id: "last-show",
      label: result ? "Last Show Fallout" : "Current Lead",
      value: result ? `${result.totalScore} ${getShowGrade(result.totalScore)}` : topMomentumTalent?.name ?? "No Lead",
      detail: lastShowDetail,
      tone: result ? (result.totalScore >= 80 ? "strong" : result.totalScore < 62 ? "watch" : "steady") : "steady",
    },
    {
      id: "roster",
      label: "Roster Desk",
      value: rosterValue,
      detail: rosterDetail,
      tone: topOverused || injuryConcernCount ? "watch" : "steady",
    },
    {
      id: "rivalry",
      label: "Story Room",
      value: focusRivalryTiming ? focusRivalryTiming.snapshot.primary.label : "No Active Story",
      detail: focusRivalryTiming ? `${focusRivalryTiming.rivalry.name}: ${focusRivalryTiming.snapshot.producerRead}` : "No rivalry is currently active.",
      tone: focusRivalryTiming?.snapshot.primary.tone === "watch" || focusRivalryTiming?.snapshot.primary.tone === "build" ? "watch" : "steady",
    },
    {
      id: "title",
      label: "Title Office",
      value: focusTitlePressure ? focusTitlePressure.snapshot.primary.label : "No Title Read",
      detail: focusTitlePressure ? `${focusTitlePressure.championship.name}: ${focusTitlePressure.snapshot.producerRead}` : "No championship scene is available.",
      tone: focusTitlePressure?.snapshot.primary.tone === "watch" || focusTitlePressure?.snapshot.primary.tone === "build" ? "watch" : focusTitlePressure?.snapshot.primary.tone === "hot" ? "strong" : "steady",
    },
    {
      id: "calendar-finance",
      label: "Office Clock",
      value: financePressure,
      detail: `${calendarDetail} ${getFinancePresenceRead(game.money, financePressure, financeReport)}`,
      tone: financePressure === "Critical" || financePressure === "Tight" ? "watch" : "steady",
    },
  ];
  const headline =
    items.some((item) => item.tone === "watch")
      ? "This Week Has Active Pressure"
      : result
        ? "Fallout Is Ready For Booking"
        : "Week Starts Clean";

  return {
    headline,
    detail: "Read-only staff context from current roster, rivalry, title, calendar, and finance state. It does not forecast booking outcomes.",
    items,
  };
}

function getRivalPressureRead(game: GameState, result?: ShowResult): LivingWorldPressureItem {
  const rivalBrands = game.rivalBrands?.length ? game.rivalBrands : [];
  const focusRival = rivalBrands[0];
  const focusStyle = focusRival?.assignedGMStyle ?? game.rivalGMAssignments[0]?.gmStyle;
  const focusName = focusRival?.assignedGMName ?? game.rivalGMAssignments[0]?.gmName ?? "Rival GMs";
  const focusBrand = focusRival?.brandName ?? game.rivalGMAssignments[0]?.brand ?? "the other brands";
  const score = result?.totalScore;
  const detail =
    focusStyle === "Ratings Chaser"
      ? score !== undefined
        ? `${focusName} is watching whether ${game.brandName}'s last ${score >= 75 ? "strong" : "uneven"} number turns into another loud week.`
        : `${focusName} is watching the first TV number from ${focusBrand}, but no rival result is being simulated.`
      : focusStyle === "Talent Developer"
        ? `${focusName} will notice whether your room creates new momentum or lets underused names drift.`
        : focusStyle === "Big Money Promoter"
          ? `${focusName} is watching the business posture around ${game.brandName}, not running a rival ledger.`
          : focusStyle === "Chaos Booker"
            ? `${focusName} is waiting for your show to feel dangerous without the game inventing offscreen chaos.`
            : `${focusName} and ${rivalBrands.length ? `${rivalBrands.length - 1} other rival chair${rivalBrands.length === 2 ? "" : "s"}` : "the other brands"} are positioned as competitive pressure, not CPU-booked shows.`;

  return {
    id: "rival-brands",
    voice: "Rival Brands",
    label: focusBrand,
    value: focusStyle ?? "Watching",
    detail,
    action: "Book a card with a clear brand identity before worrying about simulated standings.",
    tone: score !== undefined && score < 62 ? "watch" : "steady",
    priority: score !== undefined && score < 62 ? 74 : 44,
  };
}

export function getLivingWorldPressureSnapshot(game: GameState, result?: ShowResult): LivingWorldPressureSnapshot {
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const latestReport = result ? getFinanceReportForResult(game, result) : getLatestFinanceReport(game);
  const financePressure = getFinancePressureLabel(game.money, latestReport?.profitLoss ?? 0);
  const socialPost = result
    ? game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week).slice(-1)[0]
    : game.socialPosts[game.socialPosts.length - 1];
  const overused = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Overused"));
  const underused = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Underused"));
  const moraleRisk = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Morale Risk"));
  const injured = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "healthy");
  const topMomentumTalent = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0];
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const focusRivalry = getRivalryTimingSnapshots(game)[0];
  const focusTitle = getChampionshipPressureSnapshots(game)[0];
  const cardReady = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers)).length >= 2;
  const pleClock =
    currentShow.showType === "ple"
      ? `${currentShow.showName} is tonight's major-event checkpoint.`
      : nextPle
        ? currentShow.isGoHome
          ? `${currentShow.showName} is the final TV stop before ${nextPle.showName}.`
          : `${formatWeekCount(weeksUntilPle)} until ${nextPle.showName}.`
        : "No remaining PLE is on the season calendar.";

  const ownershipPriority = financePressure === "Critical" ? 96 : financePressure === "Tight" ? 84 : currentShow.showType === "ple" || currentShow.isGoHome ? 72 : 48;
  const ownershipValue = financePressure === "Stable" && (currentShow.showType === "ple" || currentShow.isGoHome) ? "Calendar Pressure" : financePressure;
  const ownershipDetail =
    latestReport && result
      ? `${result.showName} already closed at ${formatMoney(latestReport.profitLoss)}. ${pleClock} Ownership is reading the fallout, not forecasting the next gate.`
      : latestReport
        ? `${getFinancePresenceRead(game.money, financePressure, latestReport)} ${pleClock}`
        : `${formatPressureLabel(financePressure)} pressure with ${formatMoney(game.money)} available. ${pleClock}`;

  const lockerValue = injured.length ? `${injured.length} hurt` : overused.length ? `${overused.length} overused` : moraleRisk.length ? `${moraleRisk.length} morale` : underused.length ? `${underused.length} waiting` : topMomentumTalent?.name ?? "Room Level";
  const lockerDetail = injured.length
    ? `${injured.slice(0, 2).map((wrestler) => `${wrestler.name} (${getInjuryStatusLabel(wrestler.injuryStatus)})`).join(" / ")} carry medical status into this week.`
    : topOverused
      ? `${topOverused.name} is the clearest workload pressure at ${topOverused.fatigue} fatigue and ${topOverused.consecutiveWeeksBooked ?? 0} straight week${(topOverused.consecutiveWeeksBooked ?? 0) === 1 ? "" : "s"} booked.`
      : moraleRisk.length
        ? `${moraleRisk.slice(0, 2).map((wrestler) => `${wrestler.name} morale ${wrestler.morale}`).join(" / ")} need evidence they still matter.`
        : topUnderused
          ? `${topUnderused.name} has been off TV for ${formatWeekCount(getWeeksSinceLastBooked(topUnderused, game.currentWeek))}.`
          : topMomentumTalent
            ? `${topMomentumTalent.name} is the hottest internal signal at ${topMomentumTalent.momentum} momentum.`
            : "The room is not surfacing a clear pressure point yet.";

  const creativeTone =
    focusRivalry?.snapshot.primary.tone === "watch" ||
    focusRivalry?.snapshot.primary.tone === "build" ||
    focusTitle?.snapshot.primary.tone === "watch" ||
    focusTitle?.snapshot.primary.tone === "build"
      ? "watch"
      : focusTitle?.snapshot.primary.tone === "hot" || focusRivalry?.snapshot.primary.tone === "hot"
        ? "strong"
        : "steady";
  const creativeValue = focusRivalry ? focusRivalry.snapshot.primary.label : focusTitle ? focusTitle.snapshot.primary.label : "Find The Hook";
  const creativeDetail = focusRivalry
    ? `${focusRivalry.rivalry.name}: ${focusRivalry.snapshot.producerRead}`
    : focusTitle
      ? `${focusTitle.championship.name}: ${focusTitle.snapshot.producerRead}`
      : "No title or rivalry desk item is leading the week yet.";

  const items: LivingWorldPressureItem[] = [
    {
      id: "ownership",
      voice: "Ownership",
      label: currentShow.showType === "ple" ? "Major Event Office" : "Brand Office",
      value: ownershipValue,
      detail: ownershipDetail,
      action: cardReady ? "Review whether the current card fits the office clock." : "Build enough show before the office can judge the week.",
      tone: financePressure === "Critical" || financePressure === "Tight" || currentShow.showType === "ple" || currentShow.isGoHome ? "watch" : "steady",
      priority: ownershipPriority,
    },
    {
      id: "locker-room",
      voice: "Locker Room",
      label: "Talent Temperature",
      value: lockerValue,
      detail: lockerDetail,
      action: "Use the Roster screen for the full board; this is the one human pressure leading the week.",
      tone: injured.length || overused.length || moraleRisk.length ? "watch" : topMomentumTalent && topMomentumTalent.momentum >= 70 ? "strong" : "steady",
      priority: injured.length ? 92 : overused.length ? 86 : moraleRisk.length ? 80 : underused.length ? 68 : 42,
    },
    {
      id: "creative-room",
      voice: "Creative Room",
      label: focusRivalry ? "Story Room" : "Title Office",
      value: creativeValue,
      detail: creativeDetail,
      action: "Attach existing story/title context only if it serves the card; no outcome is promised.",
      tone: creativeTone,
      priority: creativeTone === "watch" ? 88 : creativeTone === "strong" ? 70 : 46,
    },
    getRivalPressureRead(game, result),
  ];

  if (socialPost && result) {
    items.push({
      id: "fans-iwc",
      voice: "Fans / IWC",
      label: socialPost.author,
      value: socialPost.category.replace(/_/g, " "),
      detail: socialPost.text,
      action: "Treat this as post-show noise from what already happened, not a prediction of tonight.",
      tone: socialPost.tone === "angry" || socialPost.tone === "skeptical" ? "watch" : socialPost.tone === "excited" || socialPost.tone === "impressed" ? "strong" : "steady",
      priority: socialPost.tone === "angry" || socialPost.tone === "skeptical" ? 82 : 62,
    });
  } else {
    items.push({
      id: "fans-iwc",
      voice: "Fans / IWC",
      label: "Audience Waiting",
      value: "No Tape Yet",
      detail: "The internet has no current-week result to react to. Run a show before fan buzz becomes consequence.",
      action: "Create something worth reacting to; do not expect pre-show sentiment.",
      tone: "steady",
      priority: game.showHistory.length ? 38 : 58,
    });
  }

  const prioritizedItems = items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  const watchCount = prioritizedItems.filter((item) => item.tone === "watch").length;
  const headline =
    currentShow.showType === "ple"
      ? "The Whole Room Is Watching Tonight"
      : currentShow.isGoHome
        ? "Final TV Before The Pressure Hits"
        : watchCount
          ? "This Week Has A Real Dilemma"
          : result
            ? "Fallout Needs A Follow-Up"
            : "Opening Week Needs A Statement";
  const whoIsWatching = prioritizedItems.map((item) => item.voice).join(" / ");
  const riskRead = watchCount
    ? `${watchCount} pressure lane${watchCount === 1 ? "" : "s"} need attention before the week moves.`
    : "No red alert is leading the room, but the card still needs a point of view.";

  return {
    headline,
    weekRead: result ? `${result.showName} is closed. ${currentShow.showName} now needs a next move.` : `${currentShow.showName} is the active booking problem. ${pleClock}`,
    whoIsWatching,
    riskRead,
    nextAction: cardReady ? "Review the card, then run the show when the card has a point of view." : "Book at least 2 valid segments, then decide which pressure lane gets the spotlight.",
    items: prioritizedItems,
  };
}


export function getWeekReviewHandoffSnapshot(game: GameState, result: ShowResult, financeReport?: FinanceReport): WeekReviewHandoffSnapshot {
  const nextWeek = game.calendar.find((week) => week.weekNumber === result.week + 1);
  const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= result.week + 1 && !week.completed);
  const weeksUntilNextPle = nextPle ? Math.max(0, nextPle.weekNumber - result.week) : 0;
  const momentumWrestler = findWrestlerByName(result.biggestMomentumGain.name, game.wrestlers);
  const fatigueWrestler = findWrestlerByName(result.biggestFatigueIncrease.name, game.wrestlers);
  const hotWrestlers = game.wrestlers.filter((wrestler) => wrestler.momentum >= 70).sort((a, b) => b.momentum - a.momentum);
  const coldWrestlers = game.wrestlers.filter((wrestler) => wrestler.momentum < 45).sort((a, b) => a.momentum - b.momentum);
  const overused = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Overused"));
  const underused = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Underused"));
  const injured = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "healthy");
  const moralePressure = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Morale Risk"));
  const rivalryPressure = getRivalryTimingSnapshots(game).filter(({ snapshot }) => snapshot.primary.tone === "watch" || snapshot.primary.tone === "build").slice(0, 2);
  const titlePressure = getChampionshipPressureSnapshots(game).filter(({ snapshot }) => snapshot.primary.tone === "watch" || snapshot.primary.tone === "build").slice(0, 2);
  const titleEvents = result.titleHistoryEvents ?? [];
  const rivalryEvents = result.rivalryHistoryEvents ?? [];
  const financePressure = getFinancePressureLabel(game.money, financeReport?.profitLoss ?? 0);
  const roadRead = nextWeek
    ? nextWeek.showType === "ple"
      ? `${nextWeek.showName} is next on the calendar as a PLE.`
      : nextWeek.isGoHome
        ? `${nextWeek.showName} is the go-home broadcast.`
        : `${nextWeek.showName} is the next TV stop.`
    : "The season calendar is ready for review.";
  const pleRead = nextPle
    ? weeksUntilNextPle === 0
      ? "The next calendar step is a PLE."
      : `${nextPle.showName} is ${formatWeekCount(weeksUntilNextPle)} away.`
    : "No remaining PLE is on the current season calendar.";

  const items: WeekReviewHandoffItem[] = [
    {
      id: "talent-temperature",
      label: "Talent Temperature",
      value: momentumWrestler?.name ?? result.biggestMomentumGain.name,
      detail: `${result.biggestMomentumGain.name} left with +${result.biggestMomentumGain.amount} momentum${momentumWrestler ? ` and now sits at ${momentumWrestler.momentum}.` : "."} ${coldWrestlers.length ? `Cold watch: ${coldWrestlers.slice(0, 2).map((wrestler) => `${wrestler.name} ${wrestler.momentum}`).join(" / ")}.` : `${hotWrestlers.length} wrestler${hotWrestlers.length === 1 ? "" : "s"} now sit at 70+ momentum.`}`,
      tone: result.biggestMomentumGain.amount >= 8 || hotWrestlers.length ? "strong" : coldWrestlers.length ? "watch" : "steady",
    },
    {
      id: "roster-pressure",
      label: "Roster Pressure",
      value: injured.length ? `${injured.length} injured` : overused.length ? `${overused.length} overused` : "Level",
      detail: injured.length
        ? `${injured.slice(0, 2).map((wrestler) => `${wrestler.name} (${getInjuryStatusLabel(wrestler.injuryStatus)})`).join(" / ")} carry medical status into the handoff.`
        : overused.length || moralePressure.length || underused.length
          ? `${overused.length} overuse, ${moralePressure.length} morale, and ${underused.length} underuse note${overused.length + moralePressure.length + underused.length === 1 ? "" : "s"} are visible from current roster state.`
          : fatigueWrestler
            ? `${fatigueWrestler.name} took +${result.biggestFatigueIncrease.amount} fatigue and now sits at ${fatigueWrestler.fatigue}.`
            : "No major roster pressure is leading the handoff.",
      tone: injured.length || overused.length || moralePressure.length ? "watch" : "steady",
    },
    {
      id: "story-room",
      label: "Story Room",
      value: rivalryEvents.length ? `${rivalryEvents.length} moved` : rivalryPressure.length ? `${rivalryPressure.length} flagged` : "Stable",
      detail: rivalryEvents.length
        ? rivalryEvents.slice(0, 2).map((event) => `${formatRivalryEventType(event.eventType)}: ${event.rivalryName}`).join(" / ")
        : rivalryPressure.length
          ? rivalryPressure.map(({ rivalry, snapshot }) => `${rivalry.name}: ${snapshot.primary.label}`).join(" / ")
          : "No rivalry movement or urgent story-room flag is leading the next handoff.",
      tone: rivalryEvents.length ? "strong" : rivalryPressure.length ? "watch" : "steady",
    },
    {
      id: "title-office",
      label: "Title Office",
      value: titleEvents.length ? `${titleEvents.length} logged` : titlePressure.length ? `${titlePressure.length} flagged` : "Stable",
      detail: titleEvents.length
        ? titleEvents.slice(0, 2).map((event) => `${formatChampionshipEventType(event.eventType)}: ${event.championshipName}`).join(" / ")
        : titlePressure.length
          ? titlePressure.map(({ championship, snapshot }) => `${championship.name}: ${snapshot.primary.label}`).join(" / ")
          : "No title event or title-office pressure is leading the next handoff.",
      tone: titleEvents.some((event) => event.eventType === "title_change") ? "strong" : titlePressure.length ? "watch" : "steady",
    },
    {
      id: "office-clock",
      label: "Office Clock",
      value: financePressure,
      detail: `${roadRead} ${pleRead} ${financeReport ? `${formatMoney(financeReport.profitLoss)} closed in the office books.` : "No finance report is attached to this result."}`,
      tone: financePressure === "Critical" || financePressure === "Tight" || nextWeek?.showType === "ple" || nextWeek?.isGoHome ? "watch" : "steady",
    },
  ];
  const headline =
    items.some((item) => item.tone === "watch")
      ? "Next Week Has Carry-Forward Pressure"
      : items.some((item) => item.tone === "strong")
        ? "Next Week Has Clear Follow-Up"
        : "Next Week Opens Clean";

  return {
    headline,
    detail: "Staff handoff from resolved fallout and current state only. These are context notes for the next booking desk, not projections.",
    items,
  };
}


export function getWeekReviewOfficeSnapshot(game: GameState, result: ShowResult, financeReport?: FinanceReport): WeekReviewOfficeSnapshot {
  const bestSegment = getSafeBestSegment(result);
  const titleEvents = result.titleHistoryEvents ?? [];
  const titleChanges = titleEvents.filter((event) => event.eventType === "title_change");
  const rivalryEvents = result.rivalryHistoryEvents ?? [];
  const moraleMoveCount = (result.lockerRoomFallout?.moraleBoosts.length ?? 0) + (result.lockerRoomFallout?.moraleDrops.length ?? 0);
  const injuryCount = result.lockerRoomFallout?.injuryNotes.length ?? 0;
  const overuseCount = result.lockerRoomFallout?.overuseWarnings.length ?? 0;
  const underuseCount = result.lockerRoomFallout?.underuseWarnings.length ?? 0;
  const nextWeek = game.calendar.find((week) => week.weekNumber === result.week + 1);
  const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= result.week + 1 && !week.completed);
  const weeksUntilNextPle = nextPle ? Math.max(0, nextPle.weekNumber - result.week) : 0;
  const nextCalendarRead = nextWeek
    ? nextWeek.showType === "ple"
      ? `${nextWeek.showName} is next as the major-event follow-up.`
      : nextWeek.isGoHome
        ? `${nextWeek.showName} is the next go-home TV checkpoint.`
        : `${nextWeek.showName} is the next TV desk.`
    : "The next stop is season review.";
  const pleClock = nextPle
    ? weeksUntilNextPle === 0
      ? `${nextPle.showName} is the next calendar step.`
      : `${nextPle.showName} is ${formatWeekCount(weeksUntilNextPle)} away.`
    : "No remaining PLE is on the season calendar.";
  const titleRead = titleChanges.length
    ? `${titleChanges.length} title change${titleChanges.length === 1 ? "" : "s"} changed the office board.`
    : titleEvents.length
      ? `${titleEvents.length} title event${titleEvents.length === 1 ? "" : "s"} logged without a new champion.`
      : "No title event changed the office board.";
  const rivalryRead = rivalryEvents.length
    ? `${rivalryEvents.length} rivalry event${rivalryEvents.length === 1 ? "" : "s"} moved the story room.`
    : result.rivalryNotes.length
      ? `${result.rivalryNotes.length} rivalry note${result.rivalryNotes.length === 1 ? "" : "s"} logged from the broadcast.`
      : "No rivalry movement was logged.";
  const rosterRead =
    moraleMoveCount || injuryCount || overuseCount || underuseCount
      ? `${moraleMoveCount} morale, ${injuryCount} injury, ${overuseCount} overuse, and ${underuseCount} underuse note${moraleMoveCount + injuryCount + overuseCount + underuseCount === 1 ? "" : "s"} are on the desk.`
      : `${result.biggestFatigueIncrease.name} took the largest fatigue hit at +${result.biggestFatigueIncrease.amount}.`;

  return {
    headline: result.showType === "ple" ? "Major-Event After-Action" : "GM Office After-Action",
    detail: "Resolved fallout only. This is the office handoff between the broadcast payoff and the next Dashboard pressure read.",
    items: [
      {
        id: "show-receipt",
        label: "What Happened",
        value: `${result.totalScore} ${getShowGrade(result.totalScore)}`,
        detail: bestSegment
          ? `${result.showName} closed with ${getSegmentResultLabel(bestSegment)} as the strongest segment at ${bestSegment.score}.`
          : `${result.showName} closed and is ready for the office handoff.`,
        tone: result.totalScore >= 85 ? "strong" : result.totalScore < 62 ? "watch" : "steady",
      },
      {
        id: "fallout-shift",
        label: "What Changed",
        value: titleChanges.length ? `${titleChanges.length} title move${titleChanges.length === 1 ? "" : "s"}` : rivalryEvents.length ? `${rivalryEvents.length} story move${rivalryEvents.length === 1 ? "" : "s"}` : "Roster desk",
        detail: `${titleRead} ${rivalryRead} ${rosterRead}`,
        tone: titleChanges.length || rivalryEvents.length ? "strong" : moraleMoveCount || injuryCount || overuseCount ? "watch" : "steady",
      },
      {
        id: "next-desk",
        label: "What It Means",
        value: nextWeek ? nextWeek.showName : "Season Review",
        detail: `${nextCalendarRead} ${pleClock} ${financeReport ? `${formatMoney(financeReport.profitLoss)} closed in the books.` : "No finance close is attached."}`,
        tone: nextWeek?.showType === "ple" || nextWeek?.isGoHome || getFinancePressureLabel(game.money, financeReport?.profitLoss ?? 0) === "Critical" ? "watch" : "steady",
      },
    ],
  };
}


export function getPleBuildPressureSnapshot(game: GameState, validShowSegments: Segment[] = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers))): PleBuildPressureSnapshot {
  const calendarWeek = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const phaseLabel = calendarWeek.showType === "ple" ? "PLE Week" : calendarWeek.isGoHome ? "Go-Home TV" : "Weekly TV";
  const activeRivalries = game.rivalries.filter((rivalry) => rivalry.status !== "stale");
  const rivalryPressure = getRivalryTimingSnapshots(game).filter(({ snapshot }) =>
    ["payoff-overdue", "ple-ready", "needs-tv", "cooling-off"].includes(snapshot.primary.id),
  );
  const titlePressure = getChampionshipPressureSnapshots(game).filter(({ snapshot }) =>
    ["defense-drought", "champion-tv", "ple-ready", "cooling-division", "needs-challenger", "tag-needs-challengers"].includes(snapshot.primary.id),
  );
  const bookedIds = getBookedWrestlerIds(validShowSegments);
  const championIds = [...new Set(game.championships.flatMap((championship) => championship.championIds))];
  const offCardChampionNames = championIds
    .filter((id) => !bookedIds.has(id))
    .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const pressureRivalryIds = new Set(rivalryPressure.map(({ rivalry }) => rivalry.id));
  const representedPressureRivalries = validShowSegments.filter((segment) => segment.rivalryId && pressureRivalryIds.has(segment.rivalryId)).length;
  const offCardRivalryNames = rivalryPressure
    .filter(({ rivalry }) => !rivalry.participantIds.some((id) => bookedIds.has(id)))
    .map(({ rivalry }) => rivalry.name);
  const titleMatchCount = getCurrentCardTitleMatchCount(game, validShowSegments);
  const titleContextCount = validShowSegments.filter((segment) => Boolean(segment.championshipId)).length;
  const rivalryBeatCount = validShowSegments.filter((segment) => Boolean(segment.rivalryId)).length;
  const relevantTalentIds = new Set([
    ...championIds,
    ...rivalryPressure.flatMap(({ rivalry }) => rivalry.participantIds),
    ...validShowSegments.flatMap((segment) => segment.participantIds),
  ]);
  const availabilityConcerns = game.wrestlers.filter((wrestler) => {
    if (!relevantTalentIds.has(wrestler.id)) {
      return false;
    }

    const tags = getRosterPressureTags(wrestler, game.currentWeek);
    return wrestler.injuryStatus !== "healthy" || tags.includes("Injury Risk") || tags.includes("Overused");
  });
  const roadDetail = nextPle
    ? weeksUntilPle === 0
      ? `${calendarWeek.showName} is the major-event checkpoint. The desk is reading card coverage and unresolved pressure only.`
      : calendarWeek.isGoHome
        ? `${calendarWeek.showName} is the final TV stop before ${nextPle.showName}.`
        : `${formatWeekCount(weeksUntilPle)} until ${nextPle.showName}.`
    : "No remaining PLE is on the season calendar.";
  const activePressureCount = rivalryPressure.length + titlePressure.length + availabilityConcerns.length;
  const headline =
    calendarWeek.showType === "ple"
      ? "Major-Event Pressure Is Live"
      : calendarWeek.isGoHome
        ? "Final Build Week"
        : activePressureCount
          ? "Road-To-PLE Pressure Building"
          : "Road-To-PLE Board Stable";
  const detail =
    calendarWeek.showType === "ple" || calendarWeek.isGoHome
      ? "Current stories, title scenes, and availability are close enough to the PLE window to deserve a GM desk read."
      : "Road-to-PLE context stays in the background until timing, title pressure, rivalry pressure, or roster availability makes it worth surfacing.";

  const items: PleBuildPressureItem[] = [
    {
      id: "phase",
      label: "Show Phase",
      value: phaseLabel,
      detail: roadDetail,
      tone: calendarWeek.showType === "ple" ? "ready" : calendarWeek.isGoHome ? "watch" : "steady",
    },
    {
      id: "rivalry-pressure",
      label: "Story Pressure",
      value: rivalryPressure.length ? `${rivalryPressure.length} flagged` : `${activeRivalries.length} active`,
      detail: rivalryPressure.length
        ? formatNamesList(rivalryPressure.map(({ rivalry }) => rivalry.name), "No rivalry pressure")
        : activeRivalries.length
          ? "Active stories are present without an urgent timing flag."
          : "No active rivalries are currently on the board.",
      tone: rivalryPressure.length ? (calendarWeek.showType === "ple" || calendarWeek.isGoHome ? "watch" : "steady") : activeRivalries.length ? "steady" : "build",
    },
    {
      id: "title-pressure",
      label: "Title Office",
      value: titlePressure.length ? `${titlePressure.length} flagged` : "Steady",
      detail: titlePressure.length
        ? formatNamesList(titlePressure.map(({ championship }) => championship.name), "No title pressure")
        : "No title scene is demanding extra attention from existing history.",
      tone: titlePressure.length ? "watch" : "steady",
    },
    {
      id: "current-card",
      label: "Current Card",
      value: `${titleMatchCount} title / ${rivalryBeatCount} story`,
      detail: validShowSegments.length
        ? `${titleContextCount} title-context segment${titleContextCount === 1 ? "" : "s"} and ${representedPressureRivalries} flagged rivalry beat${representedPressureRivalries === 1 ? "" : "s"} are represented by the valid card.`
        : "No valid card coverage yet. This reads the current rundown only after you book it.",
      tone: validShowSegments.length && (titleMatchCount || rivalryBeatCount) ? "ready" : calendarWeek.showType === "ple" || calendarWeek.isGoHome ? "build" : "steady",
    },
    {
      id: "off-card",
      label: "Off-Card Watch",
      value: `${offCardChampionNames.length + offCardRivalryNames.length} notes`,
      detail:
        offCardChampionNames.length || offCardRivalryNames.length
          ? `${offCardChampionNames.length ? `Champions: ${formatNamesList(offCardChampionNames, "None", 2)}. ` : ""}${offCardRivalryNames.length ? `Stories: ${formatNamesList(offCardRivalryNames, "None", 2)}.` : ""}`
          : "Current valid card has no champion or flagged-rivalry absence note.",
      tone: offCardChampionNames.length || offCardRivalryNames.length ? "watch" : "steady",
    },
    {
      id: "availability",
      label: "Availability",
      value: availabilityConcerns.length ? `${availabilityConcerns.length} concern${availabilityConcerns.length === 1 ? "" : "s"}` : "Clear",
      detail: availabilityConcerns.length
        ? formatNamesList(availabilityConcerns.map((wrestler) => wrestler.name), "No availability flags")
        : "No injury, injury-risk, or overuse note is attached to champions, flagged stories, or the current valid card.",
      tone: availabilityConcerns.length ? "watch" : "steady",
    },
  ];

  return {
    phaseLabel,
    headline,
    detail,
    items,
    spoilerNote:
      "Read-only PLE build context. It reads existing state and current-card coverage only; it does not forecast grades, fan reaction, finances, social reaction, injuries, morale, fatigue fallout, title outcomes, or rivalry movement.",
  };
}


export function buildBroadcastFalloutSnapshot(result: ShowResult): BroadcastFalloutSnapshot {
  const bestSegment = getSafeBestSegment(result);
  const titleHistoryEvents = result.titleHistoryEvents ?? [];
  const titleChanges = titleHistoryEvents.filter((event) => event.eventType === "title_change");
  const titleDefenses = titleHistoryEvents.filter((event) => event.eventType === "successful_defense");
  const rivalryHistoryEvents = result.rivalryHistoryEvents ?? [];
  const injuryNotes = result.lockerRoomFallout?.injuryNotes ?? [];
  const moraleDrops = result.lockerRoomFallout?.moraleDrops ?? [];
  const moraleBoosts = result.lockerRoomFallout?.moraleBoosts ?? [];
  const openChallengeReveals = result.segmentResults.filter((segment) => segment.type === "Open Challenge" && segment.resolvedOpponentName);
  const headline =
    result.totalScore >= 85
      ? "Premium Broadcast Fallout"
      : result.totalScore >= 70
        ? "Solid Broadcast Fallout"
        : result.totalScore >= 55
          ? "Mixed Broadcast Fallout"
          : "Cold Broadcast Fallout";
  const items: BroadcastFalloutItem[] = [
    {
      id: "show-read",
      label: "Show Read",
      value: `${result.totalScore} ${getShowGrade(result.totalScore)}`,
      detail: getScoreFalloutRead(result),
      tone: result.totalScore >= 85 ? "strong" : result.totalScore < 60 ? "watch" : "steady",
    },
  ];

  if (bestSegment) {
    items.push({
      id: "best-segment",
      label: "Top Segment",
      value: `${bestSegment.score}`,
      detail: `${bestSegment.participantNames.join(" / ") || "The resolved segment"} delivered the strongest ${bestSegment.type.toLowerCase()} on the resolved card.`,
      tone: bestSegment.score >= 85 ? "strong" : bestSegment.score < 60 ? "watch" : "steady",
    });
  }

  items.push({
    id: "standout-performer",
    label: "Standout",
    value: result.biggestMomentumGain.name,
    detail: `${result.biggestMomentumGain.name} left with the biggest momentum gain at +${result.biggestMomentumGain.amount}. ${result.biggestFatigueIncrease.name} absorbed the heaviest fatigue hit at +${result.biggestFatigueIncrease.amount}.`,
    tone: result.biggestMomentumGain.amount >= 8 ? "strong" : result.biggestFatigueIncrease.amount >= 12 ? "watch" : "steady",
  });

  items.push({
    id: "title-desk",
    label: "Title Desk",
    value: titleChanges.length ? `${titleChanges.length} change${titleChanges.length === 1 ? "" : "s"}` : `${titleDefenses.length} defense${titleDefenses.length === 1 ? "" : "s"}`,
    detail: titleHistoryEvents.length
      ? titleHistoryEvents
          .slice(0, 2)
          .map((event) => `${formatChampionshipEventType(event.eventType)}: ${event.championshipName}`)
          .join(" / ")
      : "No title change or successful defense was logged from this result.",
    tone: titleChanges.length ? "strong" : titleDefenses.length ? "steady" : "watch",
  });

  items.push({
    id: "story-desk",
    label: "Story Desk",
    value: rivalryHistoryEvents.length ? `${rivalryHistoryEvents.length} move${rivalryHistoryEvents.length === 1 ? "" : "s"}` : "No move",
    detail: rivalryHistoryEvents.length
      ? rivalryHistoryEvents
          .slice(0, 2)
          .map((event) => `${formatRivalryEventType(event.eventType)}: ${event.rivalryName}`)
          .join(" / ")
      : result.rivalryNotes[0] ?? "No rivalry movement was logged from this result.",
    tone: rivalryHistoryEvents.length ? "strong" : "steady",
  });

  items.push({
    id: "locker-room",
    label: "Locker Room",
    value: injuryNotes.length ? `${injuryNotes.length} injury` : `${moraleBoosts.length + moraleDrops.length} morale`,
    detail: injuryNotes.length
      ? injuryNotes
          .slice(0, 2)
          .map((note) => note.note)
          .join(" / ")
      : moraleBoosts.length || moraleDrops.length
        ? `${moraleBoosts.length} morale boost${moraleBoosts.length === 1 ? "" : "s"} and ${moraleDrops.length} morale drop${moraleDrops.length === 1 ? "" : "s"} resolved after the show.`
        : "No injury or morale fallout note was logged from this result.",
    tone: injuryNotes.length || moraleDrops.length ? "watch" : moraleBoosts.length ? "strong" : "steady",
  });

  if (openChallengeReveals.length) {
    items.push({
      id: "open-challenge",
      label: "Open Challenge",
      value: `${openChallengeReveals.length} reveal${openChallengeReveals.length === 1 ? "" : "s"}`,
      detail: openChallengeReveals
        .slice(0, 2)
        .map((segment) => `${segment.resolvedOpponentName} answered ${segment.participantNames[0] ?? "the challenge"}.`)
        .join(" "),
      tone: "strong",
    });
  }

  return {
    headline,
    detail: "Resolved-only context from the completed broadcast: score shape, standout usage, titles, stories, locker room fallout, and revealed surprises.",
    items,
  };
}


export function buildPostShowCauseLedger(game: GameState, result: ShowResult, financeReport?: FinanceReport): CauseLedgerSection[] {
  const segmentResults = result.segmentResults ?? [];
  const bestSegment = getSafeBestSegment(result);
  const validSegmentCount = segmentResults.length;
  const titleSegments = segmentResults.filter((segment) => segment.titleNote || segment.championshipId);
  const rivalrySegments = segmentResults.filter((segment) => segment.rivalryNote || segment.rivalryId);
  const affectedOverrunSegments = segmentResults.filter((segment) => segment.overrunAffected);
  const fallout = result.lockerRoomFallout;
  const socialPosts = game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week);
  const strongSegments = segmentResults.filter((segment) => segment.score >= 85);
  const coldSegments = segmentResults.filter((segment) => segment.score < 60);
  const sections: CauseLedgerSection[] = [];

  const performanceItems: CauseLedgerItem[] = [];
  if (bestSegment) {
    performanceItems.push({
      id: "best-segment",
      label: "Top Driver",
      detail: `${bestSegment.participantNames.join(" / ")} carried the night with a ${bestSegment.score} ${bestSegment.type.toLowerCase()}.`,
      tone: bestSegment.score >= 85 ? "strong" : bestSegment.score >= 70 ? "steady" : "watch",
    });
  }
  if (strongSegments.length || coldSegments.length) {
    performanceItems.push({
      id: "score-shape",
      label: "Score Shape",
      detail: `${strongSegments.length} segment${strongSegments.length === 1 ? "" : "s"} landed at 85+, while ${coldSegments.length} segment${coldSegments.length === 1 ? "" : "s"} finished below 60.`,
      tone: coldSegments.length ? "watch" : strongSegments.length ? "strong" : "steady",
    });
  }
  if (result.broadcastOverrunNotes?.length) {
    performanceItems.push({
      id: "runtime-pressure",
      label: "Runtime Pressure",
      detail: result.broadcastOverrunNotes[0],
      tone: result.broadcastOverrunLevel === "major" || result.broadcastOverrunLevel === "moderate" ? "watch" : "steady",
    });
  } else if (result.actualRuntimeMinutes !== undefined) {
    performanceItems.push({
      id: "runtime-clean",
      label: "Runtime Shape",
      detail: `${result.actualRuntimeMinutes} actual minutes against ${result.plannedRuntimeMinutes ?? "unknown"} planned kept the broadcast record clean.`,
      tone: "steady",
    });
  }
  if (performanceItems.length) {
    sections.push({ id: "performance", label: "Show Performance Drivers", items: performanceItems });
  }

  const structureItems: CauseLedgerItem[] = [];
  if (validSegmentCount) {
    structureItems.push({
      id: "card-volume",
      label: "Card Structure",
      detail: `${validSegmentCount} resolved segment${validSegmentCount === 1 ? "" : "s"} shaped the final average.`,
      tone: validSegmentCount >= 5 ? "strong" : validSegmentCount >= 2 ? "steady" : "watch",
    });
  }
  if (titleSegments.length || rivalrySegments.length) {
    structureItems.push({
      id: "stakes-mix",
      label: "Stakes Mix",
      detail: `${titleSegments.length} title-linked segment${titleSegments.length === 1 ? "" : "s"} and ${rivalrySegments.length} rivalry-linked segment${rivalrySegments.length === 1 ? "" : "s"} gave the recap its consequence lanes.`,
      tone: titleSegments.length + rivalrySegments.length >= 2 ? "strong" : "steady",
    });
  }
  if (affectedOverrunSegments.length) {
    structureItems.push({
      id: "compressed-block",
      label: "Compressed Block",
      detail: `${affectedOverrunSegments.length} late segment${affectedOverrunSegments.length === 1 ? " was" : "s were"} marked as affected by broadcast overrun.`,
      tone: "watch",
    });
  }
  if (structureItems.length) {
    sections.push({ id: "structure", label: "Card Structure Drivers", items: structureItems });
  }

  const stakesItems: CauseLedgerItem[] = [];
  if (result.titleNotes?.length) {
    stakesItems.push({
      id: "title-fallout",
      label: "Title Desk",
      detail: result.titleNotes[0],
      tone: "strong",
    });
  }
  if (result.rivalryNotes?.length) {
    stakesItems.push({
      id: "rivalry-fallout",
      label: "Rivalry Desk",
      detail: result.rivalryNotes[0],
      tone: "strong",
    });
  }
  if (!stakesItems.length && validSegmentCount) {
    stakesItems.push({
      id: "no-stakes-fallout",
      label: "Stakes Desk",
      detail: "No championship or rivalry note fired because the resolved card did not attach those consequence lanes.",
      tone: "watch",
    });
  }
  if (stakesItems.length) {
    sections.push({ id: "stakes", label: "Title And Rivalry Drivers", items: stakesItems });
  }

  const rosterItems: CauseLedgerItem[] = [];
  if (result.biggestMomentumGain?.name) {
    rosterItems.push({
      id: "momentum-driver",
      label: "Momentum",
      detail: `${result.biggestMomentumGain.name} gained the most momentum after their resolved TV usage.`,
      tone: "strong",
    });
  }
  if (result.biggestFatigueIncrease?.name) {
    rosterItems.push({
      id: "fatigue-driver",
      label: "Fatigue Load",
      detail: `${result.biggestFatigueIncrease.name} took the biggest fatigue hit from the finished card.`,
      tone: result.biggestFatigueIncrease.amount >= 12 ? "watch" : "steady",
    });
  }
  const falloutCount =
    (fallout?.moraleDrops.length ?? 0) +
    (fallout?.moraleBoosts.length ?? 0) +
    (fallout?.overuseWarnings.length ?? 0) +
    (fallout?.underuseWarnings.length ?? 0) +
    (fallout?.injuryNotes.length ?? 0);
  if (falloutCount) {
    rosterItems.push({
      id: "locker-room-fallout",
      label: "Locker Room",
      detail: `${falloutCount} roster fallout note${falloutCount === 1 ? "" : "s"} came out of actual usage, morale, fatigue, and injury checks.`,
      tone: fallout?.injuryNotes.length || fallout?.moraleDrops.length ? "watch" : "steady",
    });
  }
  if (rosterItems.length) {
    sections.push({ id: "roster", label: "Roster Pressure Drivers", items: rosterItems });
  }

  const businessItems: CauseLedgerItem[] = [];
  if (financeReport) {
    businessItems.push({
      id: "finance-close",
      label: "Brand Office",
      detail: `${financeReport.showName} closed at ${formatMoney(financeReport.profitLoss)} on ${formatMoney(getFinanceGrossRevenue(financeReport))} revenue and ${formatMoney(getFinanceTotalExpenses(financeReport))} costs.`,
      tone: financeReport.profitLoss >= 0 ? "strong" : "watch",
    });
    if (financeReport.notes.length) {
      businessItems.push({
        id: "finance-note",
        label: "Business Cause",
        detail: financeReport.notes[0],
        tone: financeReport.profitLoss >= 0 ? "steady" : "watch",
      });
    }
  }
  if (socialPosts.length) {
    businessItems.push({
      id: "audience-pulse",
      label: "Audience Pulse",
      detail: `${socialPosts.length} IWC/social post${socialPosts.length === 1 ? "" : "s"} reacted to resolved score, title, rivalry, fatigue, or major-event facts.`,
      tone: "steady",
    });
  }
  if (businessItems.length) {
    sections.push({ id: "business", label: "Business And Audience Drivers", items: businessItems });
  }

  return sections;
}
