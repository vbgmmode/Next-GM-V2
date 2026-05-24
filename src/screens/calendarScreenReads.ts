import { PLE_COUNT, PLE_CYCLE_WEEKS, SEASON_WEEK_COUNT } from "../game/constants";
import { getBestSegment, getShowGrade, isValidSegment } from "../game/scoring";
import { formatMoney } from "../game/formatters";
import type { CalendarWeek, GameState, ShowResult, ShowType } from "../game/types";
import { getSegmentOutcomeHeadline } from "./resultsScreenReads";

export type CalendarWeekStatus = "completed" | "current" | "upcoming";

export type CalendarWeekMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type CalendarWeekSegmentRow = {
  id: string;
  isTitleMatch?: boolean;
  label: string;
  score: number;
  participants: string;
  outcome?: string;
};

export type CalendarWeekCpuRow = {
  brandName: string;
  score: number;
  grade: string;
  isPlayer?: boolean;
};

export type CalendarWeekSpotlight = {
  weekNumber: number;
  showName: string;
  status: CalendarWeekStatus;
  statusLabel: string;
  tags: string[];
  headline: string;
  detail: string;
  score?: number;
  grade?: string;
  metrics: CalendarWeekMetric[];
  segmentRows: CalendarWeekSegmentRow[];
  notes: string[];
  cpuRace: CalendarWeekCpuRow[];
};

export type CalendarCycleBlock = {
  id: string;
  cycleNumber: number;
  pleShowName: string;
  weeks: CalendarWeek[];
};

export function getCalendarCycleColumnLabels() {
  return Array.from({ length: PLE_CYCLE_WEEKS }, (_, weekInCycle) => {
    if (weekInCycle === PLE_CYCLE_WEEKS - 1) {
      return "PLE";
    }

    if (weekInCycle === PLE_CYCLE_WEEKS - 2) {
      return "Go-Home";
    }

    return "TV";
  });
}

export function getSeasonCalendarBlocks(calendar: CalendarWeek[]): CalendarCycleBlock[] {
  const blocks: CalendarCycleBlock[] = [];

  for (let index = 0; index < calendar.length; index += PLE_CYCLE_WEEKS) {
    const weeks = calendar.slice(index, index + PLE_CYCLE_WEEKS);
    const pleWeek = weeks.find((week) => week.showType === "ple");

    blocks.push({
      id: `cycle-${blocks.length + 1}`,
      cycleNumber: blocks.length + 1,
      pleShowName: pleWeek?.showName ?? `Cycle ${blocks.length + 1}`,
      weeks,
    });
  }

  return blocks;
}

export function getCalendarTileColumnLabel(week: CalendarWeek) {
  if (week.showType === "ple") {
    return "PLE";
  }

  if (week.isGoHome) {
    return "Go-Home";
  }

  return "TV";
}

export function getCalendarTileShowName(showName: string) {
  return showName.replace(" Go-Home", "").trim();
}

export function getShowTypeLabel(showType: ShowType) {
  return showType === "ple" ? "PLE" : "TV";
}

export function getNextPle(calendar: CalendarWeek[], currentWeek: number) {
  return calendar.find((week) => week.showType === "ple" && week.weekNumber >= currentWeek && !week.completed);
}

export function getWeeksUntilPle(nextPle: CalendarWeek | undefined, currentWeek: number) {
  if (!nextPle) {
    return 0;
  }

  return Math.max(0, nextPle.weekNumber - currentWeek);
}

export function formatWeeksUntilPle(nextPle: CalendarWeek | undefined, currentWeek: number) {
  if (!nextPle) {
    return "Season Complete";
  }

  const weeksUntilPle = getWeeksUntilPle(nextPle, currentWeek);

  if (weeksUntilPle === 0) {
    return "PLE Tonight";
  }

  return `PLE in ${weeksUntilPle} Wk${weeksUntilPle === 1 ? "" : "s"}`;
}

export function getCalendarWeekStatus(week: CalendarWeek, currentWeek: number): CalendarWeekStatus {
  if (week.completed) {
    return "completed";
  }

  if (week.weekNumber === currentWeek) {
    return "current";
  }

  return "upcoming";
}

export function getCalendarWeekStatusLabel(status: CalendarWeekStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "current":
      return "On The Clock";
    default:
      return "On Deck";
  }
}

export function getWeekResult(game: GameState, week: CalendarWeek) {
  return game.showHistory.find(
    (result) =>
      result.id === week.resultId ||
      (result.seasonNumber === game.seasonNumber && result.week === week.weekNumber && result.showName === week.showName),
  );
}

export function hasCpuRaceForWeek(game: GameState, result: ShowResult) {
  return game.rivalBrands.some((brand) =>
    brand.weeklyResults.some((cpuResult) => cpuResult.seasonNumber === result.seasonNumber && cpuResult.weekNumber === result.week),
  );
}

export function buildCalendarRecapStrip(game: GameState, currentShow: CalendarWeek) {
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const calendarTag = currentShow.isGoHome ? "Go-Home Wk" : currentShow.showType === "ple" ? "PLE Wk" : "TV Wk";
  const pleTag = weeksUntilPle === 0 ? "PLE Now" : `PLE in ${weeksUntilPle}`;
  const completedCount = game.calendar.filter((week) => week.completed).length;

  return {
    headline: `Week ${game.currentWeek} · ${currentShow.showName}`,
    detail: `Season ${game.seasonNumber} · ${calendarTag} · ${pleTag} · ${completedCount}/${PLE_COUNT} Logged`,
    lede: nextPle
      ? `${nextPle.showName} is ${weeksUntilPle === 0 ? "tonight" : `${weeksUntilPle} week${weeksUntilPle === 1 ? "" : "s"} away`}.`
      : "The season calendar is complete.",
  };
}

export function getFinanceReportForWeekResult(game: GameState, result: ShowResult) {
  return game.financeReports.find((report) => report.id === `${result.id}-finance`);
}

export function getCpuRaceForWeek(game: GameState, seasonNumber: number, weekNumber: number, playerResult?: ShowResult) {
  const rows: CalendarWeekCpuRow[] = game.rivalBrands
    .map((brand) => {
      const cpuResult = brand.weeklyResults.find((result) => result.seasonNumber === seasonNumber && result.weekNumber === weekNumber);

      if (!cpuResult) {
        return undefined;
      }

      return {
        brandName: brand.brandName,
        score: cpuResult.score,
        grade: cpuResult.grade,
      };
    })
    .filter((row): row is CalendarWeekCpuRow => Boolean(row));

  if (playerResult) {
    rows.push({
      brandName: playerResult.brandName,
      score: playerResult.totalScore,
      grade: getShowGrade(playerResult.totalScore),
      isPlayer: true,
    });
  }

  return rows.sort((left, right) => right.score - left.score);
}

function isTitleSegment(segment: { championshipId?: string; titleNote?: string }) {
  return Boolean(segment.championshipId || segment.titleNote);
}

function getSegmentRowLabel(type: string, isTitleMatch: boolean) {
  if (isTitleMatch) {
    return "Title Match";
  }

  return getSegmentTypeLabel(type);
}

function getSegmentTypeLabel(type: string) {
  switch (type) {
    case "Match":
    case "match":
      return "Match";
    case "Promo":
    case "promo":
      return "Promo";
    case "Backstage Angle":
    case "backstage":
      return "Backstage";
    case "Contract Signing":
    case "contract_signing":
      return "Contract";
    case "Open Challenge":
    case "open_challenge":
      return "Open Challenge";
    default:
      return type;
  }
}

export function buildCalendarWeekSpotlight(game: GameState, week: CalendarWeek): CalendarWeekSpotlight {
  const status = getCalendarWeekStatus(week, game.currentWeek);
  const statusLabel = getCalendarWeekStatusLabel(status);
  const result = getWeekResult(game, week);
  const financeReport = result ? getFinanceReportForWeekResult(game, result) : undefined;
  const tags = [getShowTypeLabel(week.showType)];

  if (week.isGoHome) {
    tags.push("Go-Home");
  }

  if (week.weekNumber === SEASON_WEEK_COUNT) {
    tags.push("Season Finale");
  }

  if (result) {
    const bestSegment = result.segmentResults.length ? getBestSegment(result) : undefined;
    const metrics: CalendarWeekMetric[] = [
      {
        label: "Segments",
        value: `${result.segmentResults.length}`,
        detail: bestSegment ? `Best ${bestSegment.score}` : "No segment log",
      },
      {
        label: "Attendance",
        value: financeReport ? financeReport.attendance.toLocaleString() : "No report",
        detail: financeReport ? formatMoney(financeReport.ticketRevenue) + " tickets" : "Finance pending",
      },
      {
        label: "Business",
        value: financeReport ? formatMoney(financeReport.profitLoss) : "No report",
        detail: financeReport ? `Closed ${formatMoney(financeReport.endingMoney)}` : "Finance pending",
      },
      {
        label: "Fallout",
        value: result.biggestMomentumGain.name,
        detail: `+${result.biggestMomentumGain.amount} momentum · ${result.biggestFatigueIncrease.name} +${result.biggestFatigueIncrease.amount} fatigue`,
      },
    ];

    const segmentRows = [...result.segmentResults]
      .sort((left, right) => right.score - left.score)
      .slice(0, 4)
      .map((segment) => {
        const titleMatch = isTitleSegment(segment);

        return {
          id: segment.segmentId,
          isTitleMatch: titleMatch,
          label: getSegmentRowLabel(segment.type, titleMatch),
          score: segment.score,
          participants: segment.participantNames.join(" / ") || "No participants",
          outcome: getSegmentOutcomeHeadline(segment, game.wrestlers),
        };
      });

    const notes = [...result.titleNotes, ...result.rivalryNotes].slice(0, 4);

    return {
      weekNumber: week.weekNumber,
      showName: week.showName,
      status,
      statusLabel,
      tags,
      headline: `${result.totalScore} · Grade ${getShowGrade(result.totalScore)}`,
      detail: `${week.showName} resolved with ${result.segmentResults.length} segment${result.segmentResults.length === 1 ? "" : "s"}.`,
      score: result.totalScore,
      grade: getShowGrade(result.totalScore),
      metrics,
      segmentRows,
      notes,
      cpuRace: getCpuRaceForWeek(game, game.seasonNumber, week.weekNumber, result),
    };
  }

  if (status === "current") {
    const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));

    return {
      weekNumber: week.weekNumber,
      showName: week.showName,
      status,
      statusLabel,
      tags,
      headline: validSegments.length ? `${validSegments.length} Valid Segment${validSegments.length === 1 ? "" : "s"} On Card` : "Card Not Ready",
      detail:
        validSegments.length
          ? "Current-week stats stay empty until Run Show. This reads only what is already booked on the valid card."
          : "Book at least two valid segments before this week can run.",
      metrics: [
        {
          label: "Card Shape",
          value: `${validSegments.length}`,
          detail: validSegments.length ? "Valid segments booked" : "Needs booking",
        },
        {
          label: "Show Type",
          value: getShowTypeLabel(week.showType),
          detail: week.isGoHome ? "Final TV stop before PLE" : week.showType === "ple" ? "Major event week" : "Weekly TV",
        },
        {
          label: "Season Log",
          value: `${game.showHistory.filter((entry) => entry.seasonNumber === game.seasonNumber).length}`,
          detail: "Completed shows this season",
        },
        {
          label: "Status",
          value: "On The Clock",
          detail: "Run Show to lock score, grade, and business stats",
        },
      ],
      segmentRows: validSegments.slice(0, 4).map((segment, index) => {
        const titleMatch = isTitleSegment(segment);

        return {
          id: segment.id || `current-segment-${index}`,
          isTitleMatch: titleMatch,
          label: getSegmentRowLabel(segment.type, titleMatch),
          score: 0,
          participants:
            segment.participantIds
              .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name)
              .filter((name): name is string => Boolean(name))
              .join(" / ") || "TBD",
        };
      }),
      notes: [],
      cpuRace: [],
    };
  }

  return {
    weekNumber: week.weekNumber,
    showName: week.showName,
    status,
    statusLabel,
    tags,
    headline: "On Deck",
    detail: `${week.showName} is still ahead on the season grid. No show stats exist until the week resolves.`,
    metrics: [
      {
        label: "Show Type",
        value: getShowTypeLabel(week.showType),
        detail: week.showType === "ple" ? "Major event checkpoint" : "Weekly broadcast",
      },
      {
        label: "Position",
        value: `Week ${week.weekNumber}`,
        detail: `${Math.max(0, week.weekNumber - game.currentWeek)} week${week.weekNumber - game.currentWeek === 1 ? "" : "s"} out`,
      },
      {
        label: "Tags",
        value: tags.join(" · "),
        detail: week.isGoHome ? "Go-home build week" : "Standard calendar slot",
      },
      {
        label: "Stats",
        value: "Locked",
        detail: "Resolved score, grade, and business reads appear after the show runs",
      },
    ],
    segmentRows: [],
    notes: [],
    cpuRace: [],
  };
}

export function getWeekResultRead(result: ShowResult | undefined, week: CalendarWeek) {
  if (result) {
    return {
      primary: String(result.totalScore),
      secondary: `Grade ${getShowGrade(result.totalScore)}`,
    };
  }

  if (week.completed) {
    return {
      primary: "No Result",
      secondary: "Missing Log",
    };
  }

  return {
    primary: "On Deck",
    secondary: week.showType === "ple" ? "Major Event" : "Weekly TV",
  };
}
