import type { LiveDeskFixture } from "./shared";
import { createFixtureBase, createSegment, withGamePatch } from "./shared";

export const weekPressureFixture: LiveDeskFixture = (() => {
  const base = createFixtureBase({
    gmName: "Alex Monroe",
    brandName: "Raw",
    brandStyle: "Raw",
  });

  const patched = withGamePatch(base, {
    currentWeek: 2,
    money: 1840000,
    currentShow: [
      createSegment("week-pressure-promo", "Promo", [base.wrestlers[0]?.id ?? ""]),
      createSegment("week-pressure-empty", "Match", []),
    ],
    wrestlers: base.wrestlers.map((wrestler, index) =>
      index === 2
        ? { ...wrestler, fatigue: 78, consecutiveWeeksBooked: 3, lastBookedWeek: 1, appearancesThisSeason: 2 }
        : index === 5
          ? { ...wrestler, morale: 42, momentum: 48 }
          : wrestler,
    ),
    rivalries: base.rivalries.map((rivalry, index) =>
      index === 0 ? { ...rivalry, heat: 82, freshness: 74, status: "rising" as const, weeksActive: 2 } : rivalry,
    ),
  });

  return {
    id: "week-pressure",
    label: "Week Pressure",
    description: "Normal TV week with an incomplete card and active title/rivalry pressure.",
    defaultScene: "brand-hq",
    game: patched,
  };
})();
