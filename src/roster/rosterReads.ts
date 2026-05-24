import { formatWeekCount } from "../booking/bookingUtils";
import { getWrestlerIdentityContext } from "../game/wrestlerIdentityContext";
import { resolveWrestlerAlignment } from "../game/wrestlerAlignment";
import {
  getRosterPressureTags,
  getWeeksSinceLastBooked,
} from "../game/rosterContextReads";
import { SEASON_WEEK_COUNT } from "../game/constants";
import type { Championship, GameState, ShowResult, Wrestler } from "../game/types";
import type {
  GMRead,
  RosterFilter,
  RosterSort,
  RosterStatus,
  WrestlerIdentitySnapshot,
  WrestlerLockerRoomRead,
} from "./rosterTypes";

export function getInjuryDetail(wrestler: Wrestler) {
  if (wrestler.injuryStatus === "healthy") {
    return "Available";
  }

  const weeks = wrestler.injuryWeeksRemaining;
  return `${weeks} week${weeks === 1 ? "" : "s"} remaining${wrestler.injuryDescription ? ` · ${wrestler.injuryDescription}` : ""}`;
}

export function getWrestlerStatus(wrestler: Wrestler): RosterStatus {
  if (wrestler.injuryStatus === "major") {
    return "Tired";
  }

  if (wrestler.fatigue >= 60) {
    return "Tired";
  }

  if (wrestler.morale <= 45) {
    return "Frustrated";
  }

  if (wrestler.momentum >= 65) {
    return "Hot";
  }

  return "Steady";
}

export function getWrestlerOverall(wrestler: Wrestler) {
  return Math.max(
    40,
    Math.min(
      99,
      Math.round(
        wrestler.popularity * 0.24 +
          wrestler.momentum * 0.22 +
          wrestler.ringSkill * 0.18 +
          wrestler.promoSkill * 0.16 +
          wrestler.morale * 0.12 +
          (100 - wrestler.fatigue) * 0.08,
      ),
    ),
  );
}

export function getMoraleEmoji(morale: number) {
  if (morale >= 80) return "😄";
  if (morale >= 65) return "🙂";
  if (morale >= 46) return "😐";
  return "😟";
}

export function getMoraleTone(morale: number) {
  if (morale >= 80) return "hot";
  if (morale >= 65) return "steady";
  if (morale >= 46) return "watch";
  return "risk";
}

export function getRosterAlignmentLabel(wrestler: Wrestler) {
  return resolveWrestlerAlignment(wrestler.alignment, wrestler.id);
}

function getChampionshipAcronym(championshipName: string) {
  const words = championshipName.match(/[A-Za-z]+/g) ?? [];
  const acronym = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  return acronym || championshipName;
}

export function getWrestlerTitleLine(wrestlerId: string, championships: Championship[]) {
  const titles = championships.filter((championship) => championship.championIds.includes(wrestlerId));
  return titles.map((championship) => getChampionshipAcronym(championship.name)).join(" / ");
}

export function getWrestlerDivisionHighlightClass(wrestler: Wrestler) {
  const division = wrestler.division?.toLowerCase();

  if (division === "womens") {
    return "division-womens";
  }

  if (division === "mens") {
    return "division-mens";
  }

  return "division-neutral";
}

export function isWrestlerChampion(wrestlerId: string, championships: Championship[]) {
  return getWrestlerChampionships(wrestlerId, championships).length > 0;
}

export function getWrestlerMatchRecord(wrestlerId: string, showHistory: ShowResult[]) {
  return showHistory.reduce(
    (record, show) => {
      show.segmentResults.forEach((segment) => {
        if (segment.isNoContest || !segment.winnerId) {
          return;
        }

        const participantIds = new Set(segment.participantIds);
        if (segment.resolvedOpponentId) {
          participantIds.add(segment.resolvedOpponentId);
        }

        if (!participantIds.has(wrestlerId)) {
          return;
        }

        if (segment.segmentCatalogId === "M020" && segment.participantIds.length >= 4) {
          const teamAIds = segment.participantIds.slice(0, 2);
          const teamBIds = segment.participantIds.slice(2, 4);
          const winnerSideIds = teamAIds.includes(segment.winnerId) ? teamAIds : teamBIds;
          if (winnerSideIds.includes(wrestlerId)) {
            record.wins += 1;
          } else {
            record.losses += 1;
          }
          return;
        }

        if (segment.winnerId === wrestlerId) {
          record.wins += 1;
        } else {
          record.losses += 1;
        }
      });

      return record;
    },
    { wins: 0, losses: 0 },
  );
}

function getAverageRosterMorale(wrestlers: Wrestler[]) {
  return Math.round(wrestlers.reduce((sum, wrestler) => sum + wrestler.morale, 0) / Math.max(1, wrestlers.length));
}

function getShowMoraleDelta(result: ShowResult) {
  const fallout = result.lockerRoomFallout;
  const moraleMoves = [...(fallout?.moraleDrops ?? []), ...(fallout?.moraleBoosts ?? [])];
  return moraleMoves.reduce((sum, item) => sum + (item.moraleChange ?? 0), 0);
}

export type MoraleTrendPoint = {
  label: string;
  value: number;
  weekIndex: number;
};

export function getSeasonWeekCount(game: GameState) {
  const maxCalendarWeek = game.calendar.reduce((max, week) => Math.max(max, week.weekNumber), 0);
  return maxCalendarWeek || 12;
}

export const MORALE_CHART_VIEW_HEIGHT = 36;
export const MORALE_CHART_Y_MIN = 50;
export const MORALE_CHART_Y_MAX = 100;
export const MORALE_CHART_Y_TICKS = [100, 75, 50] as const;

const MORALE_CHART_PLOT_TOP = 4;
const MORALE_CHART_PLOT_BOTTOM = 32;

export function getMoralePlotY(value: number) {
  const clamped = Math.max(MORALE_CHART_Y_MIN, Math.min(MORALE_CHART_Y_MAX, value));
  const ratio = (MORALE_CHART_Y_MAX - clamped) / (MORALE_CHART_Y_MAX - MORALE_CHART_Y_MIN);
  return MORALE_CHART_PLOT_TOP + ratio * (MORALE_CHART_PLOT_BOTTOM - MORALE_CHART_PLOT_TOP);
}

export function getMoraleChartYLabelTopPercent(tick: number) {
  return (getMoralePlotY(tick) / MORALE_CHART_VIEW_HEIGHT) * 100;
}

function getMoralePlotX(weekIndex: number, seasonWeekCount: number) {
  return (weekIndex / seasonWeekCount) * 100;
}

export function getRosterMoraleTrend(game: GameState): MoraleTrendPoint[] {
  const rosterCount = Math.max(1, game.wrestlers.length);
  const currentAverage = getAverageRosterMorale(game.wrestlers);
  const seasonResults = game.showHistory
    .filter((result) => result.seasonNumber === game.seasonNumber)
    .sort((a, b) => a.week - b.week);
  const openingAverage = seasonResults.reduce((average, result) => average - getShowMoraleDelta(result) / rosterCount, currentAverage);
  const points: MoraleTrendPoint[] = [{ label: "Open", value: Math.round(openingAverage), weekIndex: 0 }];
  let runningAverage = openingAverage;

  seasonResults.forEach((result) => {
    runningAverage += getShowMoraleDelta(result) / rosterCount;
    points.push({ label: `W${result.week}`, value: Math.round(runningAverage), weekIndex: result.week });
  });

  if (!seasonResults.some((result) => result.week === game.currentWeek)) {
    points.push({ label: `W${game.currentWeek}`, value: currentAverage, weekIndex: game.currentWeek });
  }

  return points;
}

export function getMoraleTrendSvgPoints(points: MoraleTrendPoint[], seasonWeekCount: number) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `${getMoralePlotX(point.weekIndex, seasonWeekCount).toFixed(1)},${getMoralePlotY(point.value).toFixed(1)}`;
  }

  return points
    .map((point) => `${getMoralePlotX(point.weekIndex, seasonWeekCount).toFixed(1)},${getMoralePlotY(point.value).toFixed(1)}`)
    .join(" ");
}

export function getMoraleTrendPlotCoordinate(point: MoraleTrendPoint, seasonWeekCount: number) {
  return {
    x: getMoralePlotX(point.weekIndex, seasonWeekCount),
    y: getMoralePlotY(point.value),
  };
}

export function getAverageRosterMoraleLabel(wrestlers: Wrestler[]) {
  return getAverageRosterMorale(wrestlers);
}

export function getWrestlerDivisionLabel(wrestler: Wrestler) {
  const division = wrestler.division?.toLowerCase();

  if (division === "mens") {
    return "Men";
  }

  if (division === "womens") {
    return "Women";
  }

  return wrestler.division ?? "Open";
}

export function getWrestlerChampionships(wrestlerId: string, championships: Championship[]) {
  return championships.filter((championship) => championship.championIds.includes(wrestlerId));
}

export function getWrestlerRivalries(wrestlerId: string, rivalries: import("../game/types").Rivalry[]) {
  return rivalries.filter((rivalry) => rivalry.participantIds.includes(wrestlerId));
}

export function getRosterFilterMatch(filter: RosterFilter, wrestler: Wrestler, game: GameState) {
  const status = getWrestlerStatus(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const division = wrestler.division?.toLowerCase();

  if (filter === "mens") {
    return division === "mens";
  }

  if (filter === "womens") {
    return division === "womens";
  }

  if (filter === "champions") {
    return getWrestlerChampionships(wrestler.id, game.championships).length > 0;
  }

  if (filter === "injured") {
    return wrestler.injuryStatus !== "healthy";
  }

  if (filter === "hot") {
    return status === "Hot";
  }

  if (filter === "tired") {
    return status === "Tired" || pressureTags.includes("Injury Risk") || pressureTags.includes("Overused");
  }

  if (filter === "morale") {
    return pressureTags.includes("Morale Risk") || status === "Frustrated";
  }

  if (filter === "underused") {
    return pressureTags.includes("Underused");
  }

  return true;
}

export function getRosterFilterLabel(filter: RosterFilter) {
  const labels: Record<RosterFilter, string> = {
    all: "All",
    mens: "Men",
    womens: "Women",
    champions: "Champions",
    injured: "Injured",
    hot: "Hot",
    tired: "Tired",
    morale: "Morale Risk",
    underused: "Underused",
  };

  return labels[filter];
}

export function getRosterSortLabel(sort: RosterSort) {
  const labels: Record<RosterSort, string> = {
    popularity: "Popularity",
    momentum: "Momentum",
    fatigue: "Fatigue",
    morale: "Morale",
  };

  return labels[sort];
}

export function getRosterContractWeeksLabel(game: GameState) {
  const seasonWeeksRemaining = Math.max(0, (game.calendar.length || SEASON_WEEK_COUNT) - game.currentWeek + 1);
  return `${seasonWeeksRemaining} WK${seasonWeeksRemaining === 1 ? "" : "S"} LEFT`;
}

function getPrimaryStrength(wrestler: Wrestler) {
  if (wrestler.ringSkill >= wrestler.promoSkill + 8) {
    return `Ring work is the strongest lever at ${wrestler.ringSkill}.`;
  }

  if (wrestler.promoSkill >= wrestler.ringSkill + 8) {
    return `Promo work is the strongest lever at ${wrestler.promoSkill}.`;
  }

  return `Balanced ring and promo value gives you booking flexibility.`;
}

export function getGMRead(wrestler: Wrestler, game: GameState): GMRead {
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const rivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const hasTitle = championships.length > 0;
  const hasRivalry = rivalries.length > 0;
  const usefulness = hasTitle
    ? `${wrestler.name} carries championship value as ${championships.map((championship) => championship.name).join(" / ")} holder.`
    : hasRivalry
      ? `${wrestler.name} has active story value in ${rivalries[0].name}.`
      : wrestler.momentum >= 65
        ? `${wrestler.name} is hot right now with ${wrestler.momentum} momentum.`
        : wrestler.popularity >= 68
          ? `${wrestler.name} has star power at ${wrestler.popularity} popularity.`
          : getPrimaryStrength(wrestler);

  const risk =
    wrestler.injuryStatus === "major"
      ? `${wrestler.name} is off the board with a major injury.`
      : wrestler.injuryStatus === "minor"
        ? `${wrestler.name} is working hurt, so every booking needs a lighter touch.`
        : pressureTags.includes("Injury Risk")
          ? `${wrestler.name} is carrying ${wrestler.fatigue} fatigue, high enough to light up medical concern.`
          : pressureTags.includes("Overused")
            ? `${wrestler.name} is carrying overuse pressure from fatigue or a long TV streak.`
            : pressureTags.includes("Morale Risk")
              ? `${wrestler.name} is at ${wrestler.morale} morale, which makes the next usage matter.`
              : weeksSinceLastBooked >= 3
                ? `${wrestler.name} has been off TV for ${weeksSinceLastBooked} weeks and is fading from the weekly board.`
                : "No major pressure label is active right now.";

  const need =
    wrestler.injuryStatus === "major"
      ? "Needs recovery time before they can be booked again."
      : wrestler.injuryStatus === "minor"
        ? "Can work, but needs protection instead of grind."
        : pressureTags.includes("Injury Risk") || wrestler.fatigue >= 70
          ? "Needs rest or a protected usage."
          : pressureTags.includes("Overused")
            ? "Needs lighter TV before the workload becomes the story."
            : pressureTags.includes("Underused")
              ? "Needs TV time before the absence becomes a locker room issue."
              : pressureTags.includes("Morale Risk")
                ? "Needs meaningful TV time or a stabilizing role."
                : wrestler.momentum < 45
                  ? "Needs a momentum spark if they are going to matter on the card."
                  : "Can be used for momentum, story texture, or a steady card role.";

  return { usefulness, risk, need };
}

export function getWrestlerLockerRoomRead(wrestler: Wrestler, game: GameState): WrestlerLockerRoomRead {
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const rivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const tvLoad = `${wrestler.appearancesThisSeason ?? 0} appearance${(wrestler.appearancesThisSeason ?? 0) === 1 ? "" : "s"} · ${wrestler.consecutiveWeeksBooked ?? 0} week TV streak`;

  if (wrestler.injuryStatus === "major") {
    return {
      headline: "Medical Hold",
      detail: `${wrestler.name} is unavailable until recovery clears.`,
      note: getInjuryDetail(wrestler),
      tone: "watch",
    };
  }

  if (wrestler.injuryStatus === "minor" || pressureTags.includes("Injury Risk")) {
    return {
      headline: "Protect The Body",
      detail: `${wrestler.name} is carrying ${wrestler.fatigue} fatigue${wrestler.injuryStatus === "minor" ? " with a minor injury" : ""}.`,
      note: "Use as a protected piece if they stay on TV.",
      tone: "watch",
    };
  }

  if (pressureTags.includes("Overused")) {
    return {
      headline: "Overexposed",
      detail: `${wrestler.name} has been a regular presence and the room can feel the load.`,
      note: tvLoad,
      tone: "watch",
    };
  }

  if (pressureTags.includes("Underused")) {
    return {
      headline: "Wants TV Time",
      detail: `${wrestler.name} has been off TV for ${formatWeekCount(weeksSinceLastBooked)}.`,
      note: "Absence pressure is visible, but this is not a demand system.",
      tone: "watch",
    };
  }

  if (pressureTags.includes("Morale Risk")) {
    return {
      headline: "Morale Watch",
      detail: `${wrestler.name} is sitting at ${wrestler.morale} morale.`,
      note: "A meaningful role can steady the room without guaranteeing fallout.",
      tone: "watch",
    };
  }

  if (championships.length) {
    return {
      headline: "Carries Gold",
      detail: `${wrestler.name} walks in with ${championships.map((championship) => championship.name).join(" / ")} status.`,
      note: "Title context is current-state prestige, not a required booking.",
      tone: "hot",
    };
  }

  if (rivalries.length) {
    return {
      headline: "Story Active",
      detail: `${wrestler.name} has room heat through ${rivalries[0].name}.`,
      note: `Heat ${rivalries[0].heat} · Freshness ${rivalries[0].freshness}`,
      tone: "hot",
    };
  }

  if (wrestler.momentum >= 75) {
    return {
      headline: "Feels Hot",
      detail: `${wrestler.name} has ${wrestler.momentum} momentum and reads like a live piece.`,
      note: tvLoad,
      tone: "hot",
    };
  }

  if (wrestler.momentum < 45) {
    return {
      headline: "Losing Steam",
      detail: `${wrestler.name} is cold at ${wrestler.momentum} momentum.`,
      note: weeksSinceLastBooked >= 2 ? `${formatWeekCount(weeksSinceLastBooked)} off TV adds to the fade.` : "Current status is visible, not a hidden penalty.",
      tone: "watch",
    };
  }

  if (wrestler.popularity >= 72) {
    return {
      headline: "Star Presence",
      detail: `${wrestler.name} still carries recognizable room status at ${wrestler.popularity} popularity.`,
      note: tvLoad,
      tone: "steady",
    };
  }

  return {
    headline: "Steady Hand",
    detail: `${wrestler.name} is available for utility, texture, or a controlled TV beat.`,
    note: tvLoad,
    tone: "steady",
  };
}

export function getWrestlerIdentitySnapshot(wrestler: Wrestler, game: GameState): WrestlerIdentitySnapshot {
  const identity = getWrestlerIdentityContext(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const rivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const labels = [
    championships.length ? "Champion" : null,
    rivalries.length ? "Story Piece" : null,
    wrestler.popularity >= 72 ? "Attraction" : null,
    wrestler.promoSkill >= wrestler.ringSkill + 8 ? "Talker" : null,
    wrestler.ringSkill >= wrestler.promoSkill + 8 ? "Workhorse" : null,
    wrestler.roleTier?.toLowerCase() === "prospect" ? "Prospect" : null,
    wrestler.momentum < 45 ? "Cold" : null,
    ...pressureTags,
  ].filter((label): label is string => Boolean(label));
  const uniqueLabels = [...new Set(labels)].slice(0, 6);
  const roleRead = `${identity.role} · ${identity.wrestlingStyle} · ${identity.promoStyle}`;
  const usageRead =
    wrestler.injuryStatus === "major"
      ? "Unavailable with a major injury."
      : pressureTags.includes("Overused")
        ? `Heavy TV load: ${wrestler.fatigue} fatigue and ${wrestler.consecutiveWeeksBooked ?? 0} straight week${(wrestler.consecutiveWeeksBooked ?? 0) === 1 ? "" : "s"} booked.`
        : pressureTags.includes("Underused")
          ? `Off the board for ${formatWeekCount(weeksSinceLastBooked)}. Current read is absence pressure, not a hidden penalty.`
          : wrestler.lastBookedWeek
            ? `Last booked Week ${wrestler.lastBookedWeek}; current TV streak is ${wrestler.consecutiveWeeksBooked ?? 0}.`
            : "No TV appearance recorded yet this season.";
  const bookingUseRead = championships.length
    ? `Current title-holder context for ${championships.map((championship) => championship.name).join(" / ")}.`
    : rivalries.length
      ? `Active story context through ${rivalries[0].name}.`
      : wrestler.popularity >= 72
        ? "Useful as a star-power presence when the card needs a recognizable anchor."
        : wrestler.promoSkill >= wrestler.ringSkill + 8
          ? "Useful when the card needs talking, character texture, or non-match structure."
          : wrestler.ringSkill >= wrestler.promoSkill + 8
            ? "Useful when the card needs in-ring credibility or a steady match lane."
            : wrestler.roleTier?.toLowerCase() === "prospect"
              ? "Useful as a developmental TV piece without implying hidden potential."
              : "Useful as a flexible utility piece when the rundown needs balance.";

  return {
    labels: uniqueLabels.length ? uniqueLabels : ["Utility Piece"],
    roleRead,
    usageRead,
    bookingUseRead,
  };
}
