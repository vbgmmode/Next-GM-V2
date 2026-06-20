import { describe, expect, it } from "vitest";
import { segmentCatalogOptions } from "./matchFormatCatalog";
import { generateFinanceReport, getBookedFinishProductionCostForShow, getSegmentProductionCostForShow, getSegmentStipulationProductionCostForShow } from "./finance";
import { getSegmentBookingCost, rosterDraftAndContractValues } from "./financeCatalog";
import { createNewGame } from "./seed";
import type { GameState, Segment, SegmentResult, SegmentType, ShowResult, ShowType } from "./types";

const mediumStartingBudget = 2000000;
const baseTvProductionCost = 65000;

function getCheapestRosterRows(roleTier: string, count: number) {
  return rosterDraftAndContractValues
    .filter((row) => row.roleTier === roleTier && row.availability === "Active")
    .sort((left, right) => left.draftValueUsd - right.draftValueUsd || left.top200Rank - right.top200Rank)
    .slice(0, count);
}

function getRosterSpend(mix: Array<[string, number]>) {
  return mix.flatMap(([roleTier, count]) => getCheapestRosterRows(roleTier, count)).reduce((sum, row) => sum + row.draftValueUsd, 0);
}

function getSegmentTypeForCostTest(segmentId: string): SegmentType {
  if (segmentId.startsWith("M")) {
    return "Match";
  }

  if (segmentId.startsWith("P")) {
    return "Promo";
  }

  if (segmentId.startsWith("A")) {
    return "Backstage Angle";
  }

  return "Contract Signing";
}

function getTvCardCost(segmentIds: string[], bookedFinishCount = 0, hasStipulation = false) {
  return (
    baseTvProductionCost +
    segmentIds.reduce(
      (sum, segmentId) => sum + (getSegmentProductionCostForShow({ segmentCatalogId: segmentId, type: getSegmentTypeForCostTest(segmentId) }, "tv") ?? 0),
      0,
    ) +
    bookedFinishCount * getBookedFinishProductionCostForShow({ type: "Match", winnerId: "winner", stipulationId: hasStipulation ? "table_match" : undefined })
  );
}

function createSegmentResult(segment: Segment, game: GameState, score = 72): SegmentResult {
  const participants = segment.participantIds.map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)).filter((wrestler) => Boolean(wrestler));

  return {
    segmentId: segment.id,
    type: segment.type,
    participantIds: segment.participantIds,
    participantNames: participants.map((wrestler) => wrestler!.name),
    score,
    plannedDurationMinutes: segment.durationMinutes,
    actualDurationMinutes: segment.durationMinutes,
    momentumChanges: Object.fromEntries(segment.participantIds.map((id) => [id, 0])),
    fatigueChanges: Object.fromEntries(segment.participantIds.map((id) => [id, 0])),
    segmentCatalogId: segment.segmentCatalogId,
    stipulationId: segment.stipulationId,
    winnerId: segment.type === "Match" ? segment.participantIds[0] : undefined,
  };
}

function createFinanceGame(showType: ShowType = "tv", manualWinner = true): { game: GameState; result: ShowResult; segments: Segment[] } {
  const baseGame = createNewGame();
  const [first, second, third] = baseGame.wrestlers;
  const segments: Segment[] = [
    {
      id: "finance-match",
      type: "Match",
      participantIds: [first.id, second.id],
      winnerId: manualWinner ? first.id : undefined,
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
    },
    {
      id: "finance-promo",
      type: "Promo",
      participantIds: [third.id],
      segmentCatalogId: "P001",
      segmentDisplayName: "Solo Promo",
      durationMinutes: 8,
      participantMin: 1,
      participantMax: 1,
    },
  ];
  const game = {
    ...baseGame,
    currentShow: segments,
  };
  const result: ShowResult = {
    id: `finance-${showType}-${manualWinner ? "manual" : "auto"}`,
    seasonNumber: game.seasonNumber,
    week: game.currentWeek,
    brandName: game.brandName,
    showName: showType === "ple" ? "Test PLE" : "Test TV",
    showType,
    plannedRuntimeMinutes: 20,
    actualRuntimeMinutes: 20,
    totalScore: 74,
    segmentResults: segments.map((segment, index) => createSegmentResult(segment, game, 73 + index)),
    biggestMomentumGain: { name: first.name, amount: 0 },
    biggestFatigueIncrease: { name: second.name, amount: 0 },
    titleNotes: [],
    rivalryNotes: [],
    titleHistoryEvents: [],
    rivalryHistoryEvents: [],
  };

  return { game, result, segments };
}

describe("show production finance", () => {
  it("prices the recommended Medium 20-person draft mix with healthy operating reserve", () => {
    const spend = getRosterSpend([
      ["MainEvent", 2],
      ["UpperCard", 4],
      ["Midcard", 8],
      ["Prospect", 4],
      ["Enhancement", 2],
    ]);

    expect(spend).toBeLessThanOrEqual(1450000);
    expect(mediumStartingBudget - spend).toBeGreaterThanOrEqual(550000);
  });

  it("keeps a star-heavy 20-person draft possible but meaningfully tighter", () => {
    const recommendedSpend = getRosterSpend([
      ["MainEvent", 2],
      ["UpperCard", 4],
      ["Midcard", 8],
      ["Prospect", 4],
      ["Enhancement", 2],
    ]);
    const starHeavySpend = getRosterSpend([
      ["MainEvent", 4],
      ["UpperCard", 5],
      ["Midcard", 7],
      ["Prospect", 3],
      ["Enhancement", 1],
    ]);

    expect(starHeavySpend).toBeLessThanOrEqual(mediumStartingBudget);
    expect(starHeavySpend - recommendedSpend).toBeGreaterThanOrEqual(250000);
    expect(mediumStartingBudget - starHeavySpend).toBeLessThan(450000);
  });

  it("derives default market rates at roughly 115 percent of draft value", () => {
    rosterDraftAndContractValues.forEach((row) => {
      expect(row.weeklyHireRateUsd * 12, row.wrestlerId).toBeGreaterThanOrEqual(Math.round(row.draftValueUsd * 1.15) - 1500);
      expect(row.weeklyHireRateUsd * 12, row.wrestlerId).toBeLessThanOrEqual(Math.round(row.draftValueUsd * 1.15) + 1500);
    });
  });

  it("keeps every booking segment catalog option mapped to a finance cost row", () => {
    segmentCatalogOptions.forEach((option) => {
      const row = getSegmentBookingCost(option.id);

      expect(row, option.id).toBeDefined();
      expect(row?.weeklyTvBookingCostUsd, `${option.id} TV cost`).toBeGreaterThan(0);
      expect(row?.plePpvBookingCostUsd, `${option.id} PLE cost`).toBeGreaterThan(0);
    });
  });

  it("keeps no-stipulation match base production and booked finishes free", () => {
    expect(getSegmentProductionCostForShow({ segmentCatalogId: "M001", type: "Match" }, "tv")).toBe(0);
    expect(getSegmentProductionCostForShow({ segmentCatalogId: "M007", type: "Match" }, "ple")).toBe(0);
    expect(getBookedFinishProductionCostForShow({ type: "Match", winnerId: "winner" })).toBe(0);
    expect(getSegmentProductionCostForShow({ segmentCatalogId: "P001", type: "Promo" }, "tv")).toBeGreaterThan(0);
  });

  it("keeps normal TV cards in the intended production range", () => {
    expect(getTvCardCost(["M001", "M007", "P001", "A001"], 1)).toBeGreaterThanOrEqual(75000);
    expect(getTvCardCost(["M001", "M007", "P001", "A001"], 1)).toBeLessThanOrEqual(120000);
    expect(getTvCardCost(["M003", "M007", "P002", "A002", "P008"], 1)).toBeGreaterThanOrEqual(75000);
    expect(getTvCardCost(["M003", "M007", "P002", "A002", "P008"], 1)).toBeLessThanOrEqual(120000);
  });

  it("caps premium spectacle costs while keeping booked finish free", () => {
    const rumble = getSegmentBookingCost("M065");
    const chamber = getSegmentBookingCost("M056");

    expect(rumble?.weeklyTvBookingCostUsd).toBeLessThanOrEqual(275000);
    expect(rumble?.plePpvBookingCostUsd).toBeLessThanOrEqual(425000);
    expect(chamber?.weeklyTvBookingCostUsd).toBeLessThanOrEqual(275000);
    expect(chamber?.plePpvBookingCostUsd).toBeLessThanOrEqual(425000);
    expect(getTvCardCost(["M001"], 1) - getTvCardCost(["M001"], 0)).toBe(0);
    expect(getTvCardCost(["M001"], 1, true) - getTvCardCost(["M001"], 0, true)).toBe(0);
  });

  it("generates v3 reports from production costs without weekly payroll or wrestler expenses", () => {
    const { game, result, segments } = createFinanceGame("tv", true);
    const expectedSegmentProduction = segments.reduce((sum, segment) => sum + (getSegmentProductionCostForShow(segment, "tv") ?? 0), 0);

    const report = generateFinanceReport(result, game);

    expect(report.resultId).toBe(result.id);
    expect(report.modelVersion).toBe("show-production-finance-v3");
    expect(report.talentCost).toBeUndefined();
    expect(report.baseShowProductionCost).toBe(65000);
    expect(report.segmentProductionCost).toBe(expectedSegmentProduction);
    expect(report.bookedFinishCost).toBe(0);
    expect(report.overrunCost).toBe(0);
    expect(report.productionCost).toBe(65000 + expectedSegmentProduction);
    expect(report.totalExpenses).toBe(report.productionCost);
    expect(report.expenseBreakdown?.map((item) => item.id)).toEqual(["baseShowProductionCost", "segmentProductionCost", "overrunCost"]);
  });

  it("uses TV versus PLE segment production costs from the finance catalog", () => {
    const { game: tvGame, result: tvResult, segments: tvSegments } = createFinanceGame("tv", false);
    const { game: pleGame, result: pleResult, segments: pleSegments } = createFinanceGame("ple", false);

    const tvReport = generateFinanceReport(tvResult, tvGame);
    const pleReport = generateFinanceReport(pleResult, pleGame);
    const expectedTvSegmentProduction = tvSegments.reduce((sum, segment) => sum + (getSegmentProductionCostForShow(segment, "tv") ?? 0), 0);
    const expectedPleSegmentProduction = pleSegments.reduce((sum, segment) => sum + (getSegmentProductionCostForShow(segment, "ple") ?? 0), 0);

    expect(tvReport.segmentProductionCost).toBe(expectedTvSegmentProduction);
    expect(pleReport.segmentProductionCost).toBe(expectedPleSegmentProduction);
    expect(pleReport.segmentProductionCost).toBeGreaterThan(tvReport.segmentProductionCost ?? 0);
  });

  it("charges stipulation production as a separate resolved expense line", () => {
    const { game, result, segments } = createFinanceGame("tv", false);
    const [match] = segments;
    const currentShow = [{ ...match, stipulationId: "steel_cage" }, segments[1]];
    const stipulationResult = {
      ...result,
      segmentResults: currentShow.map((segment, index) => createSegmentResult(segment, { ...game, currentShow }, 73 + index)),
    };
    const expectedStipulationCost = getSegmentStipulationProductionCostForShow({ stipulationId: "steel_cage" }, "tv");
    const report = generateFinanceReport(stipulationResult, { ...game, currentShow });

    expect(report.stipulationProductionCost).toBe(expectedStipulationCost);
    expect(report.productionCost).toBe(65000 + (report.segmentProductionCost ?? 0) + expectedStipulationCost);
    expect(report.expenseBreakdown?.map((item) => item.id)).toContain("stipulationProductionCost");
  });

  it("keeps booked finish free for manually selected match winners", () => {
    const manual = createFinanceGame("tv", true);
    const automatic = createFinanceGame("tv", false);

    expect(generateFinanceReport(manual.result, manual.game).bookedFinishCost).toBe(0);
    expect(generateFinanceReport(automatic.result, automatic.game).bookedFinishCost).toBe(0);
  });
});
