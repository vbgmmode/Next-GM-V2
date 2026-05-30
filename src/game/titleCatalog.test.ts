import { describe, expect, it } from "vitest";
import { getTitleDivisionRank, wrestlerFitsChampionshipDivision } from "./titleCatalog";
import type { Championship, Wrestler } from "./types";

function rankedWrestlers(division: "Mens" | "Womens", count: number): Wrestler[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${division.toLowerCase()}-${index + 1}`,
    name: `${division} ${index + 1}`,
    division,
    roleTier: index < 3 ? "MainEvent" : "Midcard",
    popularity: 100 - index,
    ringSkill: 75,
    promoSkill: 75,
    stamina: 75,
    morale: 70,
    momentum: 100 - index,
    fatigue: 0,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
  }));
}

function title(titleLevel: "Top" | "Middle", division: "Mens" | "Womens", championIds: string[] = []): Championship {
  return {
    id: `${division}-${titleLevel}-title`,
    name: `${division} ${titleLevel} Title`,
    division,
    titleLevel,
    prestigeTier: titleLevel === "Top" ? "World/Main Event" : "Secondary/Midcard",
    eligibleMatchScope: "singles",
    prestige: titleLevel === "Top" ? 96 : 78,
    championIds,
    reignStartWeek: 1,
    defenses: 0,
  };
}

describe("title catalog division lanes", () => {
  it("uses ranks 1-3 for top singles titles and ranks 4-6 for middle singles titles", () => {
    const roster = rankedWrestlers("Mens", 6);
    const topTitle = title("Top", "Mens");
    const middleTitle = title("Middle", "Mens");

    expect(roster.map((wrestler) => getTitleDivisionRank(wrestler, roster))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(roster.slice(0, 3).every((wrestler) => wrestlerFitsChampionshipDivision(wrestler, topTitle, roster))).toBe(true);
    expect(roster.slice(3, 6).every((wrestler) => wrestlerFitsChampionshipDivision(wrestler, topTitle, roster))).toBe(false);
    expect(roster.slice(0, 3).every((wrestler) => wrestlerFitsChampionshipDivision(wrestler, middleTitle, roster))).toBe(false);
    expect(roster.slice(3, 6).every((wrestler) => wrestlerFitsChampionshipDivision(wrestler, middleTitle, roster))).toBe(true);
  });

  it("calculates title ranks separately for each gender", () => {
    const mens = rankedWrestlers("Mens", 6);
    const womens = rankedWrestlers("Womens", 6);
    const roster = [...mens, ...womens];
    const womensTopTitle = title("Top", "Womens");
    const womensMiddleTitle = title("Middle", "Womens");

    expect(getTitleDivisionRank(womens[0], roster)).toBe(1);
    expect(wrestlerFitsChampionshipDivision(womens[2], womensTopTitle, roster)).toBe(true);
    expect(wrestlerFitsChampionshipDivision(womens[3], womensTopTitle, roster)).toBe(false);
    expect(wrestlerFitsChampionshipDivision(womens[3], womensMiddleTitle, roster)).toBe(true);
    expect(wrestlerFitsChampionshipDivision(mens[0], womensTopTitle, roster)).toBe(false);
  });

  it("keeps current champions eligible to defend their own title", () => {
    const roster = rankedWrestlers("Mens", 6);
    const topTitle = title("Top", "Mens", [roster[4].id]);

    expect(getTitleDivisionRank(roster[4], roster)).toBe(5);
    expect(wrestlerFitsChampionshipDivision(roster[4], topTitle, roster)).toBe(true);
  });
});
