import { describe, expect, it } from "vitest";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { simulateOpeningDraft } from "./openingDraft";
import { createRivalBrandUniverse, createRivalGMAssignments } from "./seed";
import { top200DraftPool } from "./top200DraftPool";

describe("top200DraftPool adapter", () => {
  it("keeps the active generated pool stable, unique, capped, and finance-mapped", () => {
    const ids = new Set(top200DraftPool.map((wrestler) => wrestler.id));
    const aewCount = top200DraftPool.filter((wrestler) => wrestler.sourceBrand === "AEW").length;

    expect(top200DraftPool).toHaveLength(120);
    expect(ids.size).toBe(top200DraftPool.length);
    expect(aewCount).toBeLessThanOrEqual(35);
    expect(
      top200DraftPool.every(
        (wrestler) =>
          wrestler.id &&
          wrestler.name &&
          wrestler.sourceBrand &&
          wrestler.division &&
          wrestler.popularity <= 94 &&
          wrestler.momentum <= 88 &&
          wrestler.ringSkill <= 92 &&
          wrestler.promoSkill <= 92 &&
          wrestler.morale <= 72,
      ),
    ).toBe(true);
    expect(top200DraftPool.every((wrestler) => Boolean(getRosterFinanceValueForWrestler(wrestler)))).toBe(true);
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
