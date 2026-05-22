import type { CalendarWeek } from "@game/types";

export function getNextPle(calendar: CalendarWeek[], currentWeek: number) {
  return calendar.find((week) => week.showType === "ple" && week.weekNumber >= currentWeek && !week.completed);
}

export function getWeeksUntilPle(nextPle: CalendarWeek | undefined, currentWeek: number) {
  if (!nextPle) return 0;
  return Math.max(0, nextPle.weekNumber - currentWeek);
}

export function getWeekPhase(currentShow: CalendarWeek): "normal" | "go-home" | "ple" {
  if (currentShow.showType === "ple") return "ple";
  if (currentShow.isGoHome) return "go-home";
  return "normal";
}
