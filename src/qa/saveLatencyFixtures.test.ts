import { describe, expect, it } from "vitest";
import { analyzeSaveRecords } from "../game/savePerformance";
import { buildFullSaveSlotLatencyFixture, buildSaveLatencyTimeline } from "./saveLatencyFixtures";

describe("save latency growth fixtures", () => {
  it("builds deterministic snapshots that grow as more shows resolve", () => {
    const timeline = buildSaveLatencyTimeline([1, 3]);
    const first = analyzeSaveRecords([{ id: "week-1", name: "Week 1", state: timeline[0].savedGame }]);
    const later = analyzeSaveRecords([{ id: "week-3", name: "Week 3", state: timeline[1].savedGame }]);

    expect(timeline.map((snapshot) => snapshot.resolvedShows)).toEqual([1, 3]);
    expect(timeline[0].savedGame.game.showHistory).toHaveLength(1);
    expect(timeline[1].savedGame.game.showHistory).toHaveLength(3);
    expect(later.totalIndexBytes).toBeGreaterThan(first.totalIndexBytes);
  });

  it("builds a five-slot save deck fixture for full-index projections", () => {
    const records = buildFullSaveSlotLatencyFixture();
    const footprint = analyzeSaveRecords(records);

    expect(records).toHaveLength(5);
    expect(footprint.saveCount).toBe(5);
    expect(footprint.largestSaveBytes).toBeGreaterThan(footprint.records[0].stateBytes);
  });
});
