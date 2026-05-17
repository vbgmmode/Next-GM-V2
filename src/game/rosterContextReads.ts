import type { InjuryStatus, Wrestler } from "./types";

export type RosterPressureTag = "Overused" | "Underused" | "Protected Star" | "Morale Risk" | "Injury Risk" | "Minor Injury" | "Unavailable";

export function getWeeksSinceLastBooked(wrestler: Wrestler, currentWeek: number) {
  if (!wrestler.lastBookedWeek) {
    return Math.max(0, currentWeek - 1);
  }

  return Math.max(0, currentWeek - wrestler.lastBookedWeek);
}

export function getRosterPressureTags(wrestler: Wrestler, currentWeek: number): RosterPressureTag[] {
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, currentWeek);
  const isOverused = wrestler.fatigue >= 60 || (wrestler.consecutiveWeeksBooked ?? 0) >= 3;
  const tags: RosterPressureTag[] = [];

  if (wrestler.injuryStatus === "major") {
    tags.push("Unavailable");
  }

  if (wrestler.injuryStatus === "minor") {
    tags.push("Minor Injury");
  }

  if (wrestler.fatigue >= 75 || wrestler.injuryStatus === "minor") {
    tags.push("Injury Risk");
  }

  if (wrestler.morale <= 45) {
    tags.push("Morale Risk");
  }

  if (isOverused) {
    tags.push("Overused");
  }

  if (weeksSinceLastBooked >= 3) {
    tags.push("Underused");
  }

  if (wrestler.popularity >= 68 && wrestler.momentum >= 60 && !isOverused && wrestler.fatigue < 75) {
    tags.push("Protected Star");
  }

  return tags;
}

export function getTopOverusedWrestler(wrestlers: Wrestler[]) {
  return wrestlers
    .filter((wrestler) => wrestler.fatigue >= 60 || (wrestler.consecutiveWeeksBooked ?? 0) >= 3)
    .sort((a, b) => b.fatigue + (b.consecutiveWeeksBooked ?? 0) * 8 - (a.fatigue + (a.consecutiveWeeksBooked ?? 0) * 8))[0];
}

export function getTopUnderusedWrestler(wrestlers: Wrestler[], currentWeek: number) {
  return wrestlers
    .filter((wrestler) => getWeeksSinceLastBooked(wrestler, currentWeek) >= 3)
    .sort(
      (a, b) =>
        getWeeksSinceLastBooked(b, currentWeek) * 10 +
        b.popularity +
        b.momentum -
        (getWeeksSinceLastBooked(a, currentWeek) * 10 + a.popularity + a.momentum),
    )[0];
}

export function getInjuryStatusLabel(status: InjuryStatus) {
  if (status === "minor") {
    return "Minor Injury";
  }

  if (status === "major") {
    return "Major Injury";
  }

  return "Healthy";
}
