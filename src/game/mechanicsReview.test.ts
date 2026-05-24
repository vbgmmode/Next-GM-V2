import { describe, expect, it } from "vitest";
import { DRAFT_CONTRACT_WEEKS, PLE_COUNT, SEASON_WEEK_COUNT, SENTIMENT_NEUTRAL, STANDARD_BUDGET_AMOUNT } from "./constants";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { completeMidCareerDraft, getMidCareerDraftPool } from "./midCareerDraft";
import { migrateSavedGameState } from "./migration";
import { createNewGame, draftPool } from "./seed";
import type { CalendarWeek, RivalBrandState, Wrestler } from "./types";

function createLegacyTwelveWeekCalendar(): CalendarWeek[] {
  return Array.from({ length: 12 }, (_, index) => {
    const weekNumber = index + 1;

    return {
      weekNumber,
      showName: weekNumber % 4 === 0 ? `Legacy PLE ${weekNumber}` : `Legacy TV ${weekNumber}`,
      showType: weekNumber % 4 === 0 ? "ple" : "tv",
      isGoHome: weekNumber % 4 === 3,
      completed: false,
    };
  });
}

function stripNewWrestlerFields(wrestler: Wrestler) {
  const { audienceHeat, trust, record, ...legacyWrestler } = wrestler;
  void audienceHeat;
  void trust;
  void record;
  return legacyWrestler;
}

describe("mechanics review foundations", () => {
  it("creates new careers with full-season weeks, PLE cadence, neutral sentiment, and prepaid draft contracts", () => {
    const game = createNewGame();

    expect(game.calendar).toHaveLength(SEASON_WEEK_COUNT);
    expect(game.calendar.filter((week) => week.showType === "ple")).toHaveLength(PLE_COUNT);
    expect(game.marketState.playerContracts.every((contract) => contract.contractWeeksRemaining === DRAFT_CONTRACT_WEEKS)).toBe(true);
    expect(game.wrestlers.every((wrestler) => wrestler.audienceHeat === SENTIMENT_NEUTRAL && wrestler.trust === SENTIMENT_NEUTRAL)).toBe(true);
    expect(game.wrestlers.every((wrestler) => wrestler.record?.season.wins === 0 && wrestler.record?.career.tagWins === 0)).toBe(true);
  });

  it("migrates legacy sentiment and records without forcing 12-week saves into a full-season calendar", () => {
    const legacyGame = createNewGame({ draftedWrestlers: draftPool.slice(0, 4) });
    const migrated = migrateSavedGameState({
      game: {
        ...legacyGame,
        calendar: createLegacyTwelveWeekCalendar(),
        startingBudgetTier: "$4M",
        wrestlers: legacyGame.wrestlers.map(stripNewWrestlerFields),
      },
      screen: "dashboard",
    });

    expect(migrated?.game.calendar).toHaveLength(12);
    expect(migrated?.game.startingBudgetTier).toBe("$2M");
    expect(migrated?.game.wrestlers[0].audienceHeat).toBe(SENTIMENT_NEUTRAL);
    expect(migrated?.game.wrestlers[0].trust).toBe(SENTIMENT_NEUTRAL);
    expect(migrated?.game.wrestlers[0].record?.season.losses).toBe(0);
  });

  it("runs the offseason draft from a fresh 2M war chest and carries leftover cash into week 1", () => {
    const game = createNewGame({ draftedWrestlers: draftPool.slice(0, 12) });
    const selected = getMidCareerDraftPool(game)[0];
    const selectedCost = getRosterFinanceValueForWrestler(selected)?.draftValueUsd ?? 0;
    const updated = completeMidCareerDraft({ ...game, money: 12345 }, [selected.id]);

    expect(updated.seasonNumber).toBe(game.seasonNumber + 1);
    expect(updated.currentWeek).toBe(1);
    expect(updated.calendar).toHaveLength(SEASON_WEEK_COUNT);
    expect(updated.money).toBe(STANDARD_BUDGET_AMOUNT - selectedCost);
    expect(updated.wrestlers.some((wrestler) => wrestler.id === selected.id)).toBe(true);
    expect(updated.marketState.playerContracts.find((contract) => contract.wrestlerId === selected.id)?.contractWeeksRemaining).toBe(DRAFT_CONTRACT_WEEKS);
  });

  it("gives the first offseason CPU pick to the lowest standings brand", () => {
    const game = createNewGame({ draftedWrestlers: draftPool.slice(0, 8) });
    const rivalBrands: RivalBrandState[] = game.rivalBrands.map((brand, index) => ({
      ...brand,
      rosterWrestlerIds: [],
      rosterState: [],
      contracts: [],
      seasonAverageScore: index === 1 ? 55 : 80 + index,
    }));
    const draftGame = { ...game, rivalBrands };
    const topAvailable = getMidCareerDraftPool(draftGame)[0];
    const updated = completeMidCareerDraft(draftGame, []);
    const lowestBrand = updated.rivalBrands.find((brand) => brand.id === rivalBrands[1].id);

    expect(lowestBrand?.rosterWrestlerIds[0]).toBe(topAvailable.id);
  });
});
