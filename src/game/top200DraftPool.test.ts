import { describe, expect, it } from "vitest";
import { createFinanceRosterMappingReport } from "./financeCatalog";
import { simulateOpeningDraft } from "./openingDraft";
import { createRivalBrandUniverse, createRivalGMAssignments } from "./seed";
import { top200DraftPool } from "./top200DraftPool";

describe("top200DraftPool adapter", () => {
  it("keeps the active generated pool stable, unique, and finance-mapped", () => {
    const ids = new Set(top200DraftPool.map((wrestler) => wrestler.id));
    const financeReport = createFinanceRosterMappingReport(top200DraftPool);

    expect(top200DraftPool).toHaveLength(200);
    expect(ids.size).toBe(top200DraftPool.length);
    expect(
      top200DraftPool.every(
        (wrestler) =>
          wrestler.id &&
          wrestler.name &&
          wrestler.sourceBrand &&
          wrestler.division &&
          wrestler.popularity <= 95 &&
          wrestler.momentum <= 88 &&
          wrestler.ringSkill <= 94 &&
          wrestler.promoSkill <= 94 &&
          wrestler.morale <= 72,
      ),
    ).toBe(true);
    expect(top200DraftPool.every((wrestler) => Boolean(wrestler.matchRatings))).toBe(true);
    expect(financeReport.draftPoolRowsWithoutFinanceValue).toHaveLength(0);
    expect(financeReport.unmappedFinanceRows).toHaveLength(0);
    expect(financeReport.duplicateNormalizedFinanceIds).toHaveLength(0);
  });

  it("keeps opening CPU draft claims deterministic from the adapter export", () => {
    const rivalBrands = createRivalBrandUniverse(createRivalGMAssignments("Raw"));
    const first = simulateOpeningDraft({
      draftMode: "snake",
      difficulty: "Medium",
      draftSeed: "adapter-smoke",
      draftPool: top200DraftPool,
      playerBrandName: "Raw",
      rivalBrands,
      playerDraftedWrestlers: top200DraftPool.slice(0, 3),
      playerDraftGroups: top200DraftPool.slice(0, 3).map((wrestler) => [wrestler.id]),
      playerPickTarget: 12,
    });
    const second = simulateOpeningDraft({
      draftMode: "snake",
      difficulty: "Medium",
      draftSeed: "adapter-smoke",
      draftPool: top200DraftPool,
      playerBrandName: "Raw",
      rivalBrands,
      playerDraftedWrestlers: top200DraftPool.slice(0, 3),
      playerDraftGroups: top200DraftPool.slice(0, 3).map((wrestler) => [wrestler.id]),
      playerPickTarget: 12,
    });

    expect(first.cpuClaimedWrestlerIds).toEqual(second.cpuClaimedWrestlerIds);
  });
});
