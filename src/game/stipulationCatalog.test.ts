import { describe, expect, it } from "vitest";
import { getStipulationById, getStipulationCostForShow, getStipulationsForSegment, stipulationCatalog } from "./stipulationCatalog";

describe("stipulationCatalog", () => {
  it("exposes bounded mechanics and production costs for every stipulation", () => {
    stipulationCatalog.forEach((stipulation) => {
      expect(stipulation.scoreBonus, stipulation.id).toBeGreaterThanOrEqual(0);
      expect(stipulation.scoreBonus, stipulation.id).toBeLessThanOrEqual(4);
      expect(stipulation.fatigueBonus, stipulation.id).toBeGreaterThanOrEqual(0);
      expect(stipulation.fatigueBonus, stipulation.id).toBeLessThanOrEqual(4);
      expect(stipulation.rivalryHeatBonus, stipulation.id).toBeGreaterThanOrEqual(0);
      expect(stipulation.rivalryHeatBonus, stipulation.id).toBeLessThanOrEqual(3);
      expect(stipulation.weeklyTvCostUsd, `${stipulation.id} TV cost`).toBeGreaterThan(0);
      expect(stipulation.pleCostUsd, `${stipulation.id} PLE cost`).toBeGreaterThan(stipulation.weeklyTvCostUsd);
    });
  });

  it("keeps curated singles stipulations eligible and non-match segments empty", () => {
    const singlesStipulations = getStipulationsForSegment({ type: "Match", segmentCatalogId: "M001" }).map((stipulation) => stipulation.id);

    expect(singlesStipulations).toEqual(
      expect.arrayContaining(["no_dq", "street_fight", "table_match", "ladder_match", "tlc_match", "last_man_standing", "iron_man", "steel_cage", "submission_match"]),
    );
    expect(getStipulationsForSegment({ type: "Promo", segmentCatalogId: "P001" })).toEqual([]);
  });

  it("keeps Extreme Rules as a legacy-compatible stipulation option", () => {
    const legacy = getStipulationById("extreme_rules");

    expect(legacy?.label).toBe("Extreme Rules");
    expect(getStipulationCostForShow("extreme_rules", "tv")).toBeGreaterThan(0);
    expect(getStipulationCostForShow("missing", "tv")).toBe(0);
  });
});
