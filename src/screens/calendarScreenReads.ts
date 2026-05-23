import { getShowGrade } from "../game/scoring";
import type { CalendarWeek, GameState, ShowResult, ShowType } from "../game/types";

export type CalendarWeekStatus = "completed" | "current" | "upcoming";

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
    detail: `Season ${game.seasonNumber} · ${calendarTag} · ${pleTag} · ${completedCount}/12 Logged`,
    lede: nextPle
      ? `${nextPle.showName} is ${weeksUntilPle === 0 ? "tonight" : `${weeksUntilPle} week${weeksUntilPle === 1 ? "" : "s"} away`}.`
      : "The season calendar is complete.",
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
