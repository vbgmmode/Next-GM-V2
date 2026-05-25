import { describe, expect, it } from "vitest";
import { getSegmentProductionCostForShow, getSegmentStipulationProductionCostForShow } from "../game/finance";
import { createNewGame } from "../game/seed";
import type { GameState, Segment } from "../game/types";
import { buildBookingModel } from "./buildBookingModel";

function createCostedBookingGame(): GameState {
  const game = createNewGame();
  const [first, second, third] = game.wrestlers;
  const currentShow: Segment[] = [
    {
      id: "booking-cost-match",
      type: "Match",
      participantIds: [first.id, second.id],
      winnerId: first.id,
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
      stipulationId: "table_match",
    },
    {
      id: "booking-cost-promo",
      type: "Promo",
      participantIds: [third.id],
      segmentCatalogId: "P001",
      segmentDisplayName: "Standard Promo",
      durationMinutes: 8,
      participantMin: 1,
      participantMax: 1,
    },
  ];

  return {
    ...game,
    currentShow,
  };
}

describe("buildBookingModel production costs", () => {
  it("exposes exact planned costs for every booked segment", () => {
    const game = createCostedBookingGame();
    const model = buildBookingModel(game, "booking-cost-match");
    const expectedSegmentCost = game.currentShow.reduce((sum, segment) => sum + (getSegmentProductionCostForShow(segment, "tv") ?? 0), 0);
    const expectedStipulationCost = game.currentShow.reduce((sum, segment) => sum + getSegmentStipulationProductionCostForShow(segment, "tv"), 0);

    expect(model.segments).toHaveLength(2);
    model.segments.forEach((row) => {
      expect(row.plannedCost, row.displayName).toBeGreaterThan(0);
      expect(row.plannedCostLabel).toContain("$");
    });
    expect(model.segments.find((row) => row.id === "booking-cost-match")?.segmentProductionCost).toBe(0);
    expect(model.segments.find((row) => row.id === "booking-cost-promo")?.segmentProductionCost).toBeGreaterThan(0);
    expect(model.production.segmentCost).toBe(expectedSegmentCost);
    expect(model.production.stipulationCost).toBe(expectedStipulationCost);
    expect(model.production.bookedFinishCost).toBe(0);
    expect(model.production.totalCost).toBe(expectedSegmentCost + expectedStipulationCost);
  });
});
