import { formatWeekCount } from "../booking/bookingUtils";
import { getInjuryStatusLabel, getRosterPressureTags, getTopOverusedWrestler, getTopUnderusedWrestler } from "../game/rosterContextReads";
import type { GameState, Wrestler } from "../game/types";

export type BackstageNoteTone = "up" | "watch" | "down";

export type BackstageNote = {
  id: string;
  tone: BackstageNoteTone;
  wrestlerNames: string[];
  text: string;
};

export type LockerRoomInjuryEntry = {
  injuryLabel: string;
  isCritical: boolean;
  weeksLabel: string;
  wrestler: Wrestler;
};

export type LockerRoomInjuryReport = {
  criticalCount: number;
  entries: LockerRoomInjuryEntry[];
  total: number;
};

export function getMoraleTrendDelta(points: { value: number }[]) {
  if (points.length < 2) {
    return 0;
  }

  return points[points.length - 1].value - points[points.length - 2].value;
}

export function formatPulseWeekLabel(label: string) {
  if (label === "Open") {
    return "START";
  }

  const weekMatch = label.match(/^W(\d+)$/);
  if (weekMatch) {
    return `WK${weekMatch[1]}`;
  }

  return label.toUpperCase();
}

export function getLockerRoomInjuryReport(game: GameState): LockerRoomInjuryReport {
  const entries = game.wrestlers
    .filter((wrestler) => wrestler.injuryStatus !== "healthy")
    .sort((left, right) => {
      if (left.injuryStatus === "major" && right.injuryStatus !== "major") {
        return -1;
      }

      if (right.injuryStatus === "major" && left.injuryStatus !== "major") {
        return 1;
      }

      return right.injuryWeeksRemaining - left.injuryWeeksRemaining;
    })
    .map((wrestler) => ({
      wrestler,
      injuryLabel: (wrestler.injuryDescription ?? getInjuryStatusLabel(wrestler.injuryStatus)).toUpperCase(),
      weeksLabel: formatWeekCount(wrestler.injuryWeeksRemaining).toUpperCase(),
      isCritical: wrestler.injuryStatus === "major",
    }));

  return {
    total: entries.length,
    criticalCount: entries.filter((entry) => entry.isCritical).length,
    entries,
  };
}

export function getBackstageNotes(game: GameState): BackstageNote[] {
  const notes: BackstageNote[] = [];
  const hotLead = [...game.wrestlers].sort((left, right) => right.momentum - left.momentum || right.popularity - left.popularity)[0];

  if (hotLead && hotLead.momentum >= 60) {
    notes.push({
      id: "hot",
      tone: "up",
      wrestlerNames: [hotLead.name],
      text: "is trending up after strong recent momentum.",
    });
  }

  const underused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  if (underused) {
    notes.push({
      id: "underused",
      tone: "watch",
      wrestlerNames: [underused.name],
      text: "feels overlooked on recent booking.",
    });
  }

  const fatiguedCount = game.wrestlers.filter((wrestler) => wrestler.fatigue >= 65).length;
  if (fatiguedCount >= 2) {
    notes.push({
      id: "fatigue",
      tone: "down",
      wrestlerNames: [],
      text: `${fatiguedCount} superstars are carrying heavy fatigue.`,
    });
  }

  const moraleWatch = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Morale Risk"));
  if (moraleWatch.length) {
    notes.push({
      id: "morale",
      tone: "down",
      wrestlerNames: moraleWatch.slice(0, 2).map((wrestler) => wrestler.name),
      text:
        moraleWatch.length === 1
          ? "needs a steadier locker room role before the next show."
          : "need morale attention before the next show.",
    });
  }

  const topOverused = getTopOverusedWrestler(game.wrestlers);
  if (topOverused && notes.length < 5) {
    notes.push({
      id: "protection",
      tone: "watch",
      wrestlerNames: [topOverused.name],
      text: "is on a heavy usage run and needs protection.",
    });
  }

  return notes.slice(0, 5);
}
