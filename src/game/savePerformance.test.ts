import { describe, expect, it } from "vitest";
import {
  analyzeSaveRecords,
  analyzeSplitSaveMetadata,
  buildSplitSaveMetadataFromRecords,
  buildSaveLatencyProjection,
  classifySaveLatency,
  formatBytes,
  getUtf8ByteLength,
} from "./savePerformance";

describe("save performance diagnostics", () => {
  it("measures save footprint and top-level growth contributors without mutating state", () => {
    const state = {
      saveVersion: 2,
      game: {
        showHistory: [{ id: "show-1", segmentResults: [{ id: "segment-1" }] }],
        socialPosts: [{ id: "post-1", body: "The crowd reacted." }],
        financeReports: [{ id: "finance-1", profitLoss: 1000 }],
      },
      screen: "dashboard",
    };
    const before = JSON.stringify(state);
    const footprint = analyzeSaveRecords([{ id: "save-1", name: "Test Save", state }]);

    expect(JSON.stringify(state)).toBe(before);
    expect(footprint.saveCount).toBe(1);
    expect(footprint.totalIndexBytes).toBeGreaterThan(footprint.totalStateBytes);
    expect(footprint.records[0].contributors[0]).toMatchObject({ path: "game" });
    expect(footprint.aggregateContributors[0].bytes).toBeGreaterThan(0);
  });

  it("classifies forecast risk from estimated latency", () => {
    expect(classifySaveLatency(49.9)).toBe("stable");
    expect(classifySaveLatency(50)).toBe("watch");
    expect(classifySaveLatency(100)).toBe("risk");
    expect(classifySaveLatency(250)).toBe("critical");
  });

  it("projects latency from bytes with an injectable model", () => {
    const projection = buildSaveLatencyProjection("large save", 1024 * 100, { baseMs: 5, msPerKb: 1 });

    expect(projection.estimatedMs).toBe(105);
    expect(projection.risk).toBe("risk");
  });

  it("models split index active writes separately from monolithic index writes", () => {
    const records = [
      { id: "save-1", name: "Small", state: { game: { showHistory: [{ id: "one" }] } } },
      { id: "save-2", name: "Large", state: { game: { showHistory: Array.from({ length: 20 }, (_, index) => ({ id: `show-${index}` })) } } },
    ];
    const monolithic = analyzeSaveRecords(records);
    const split = analyzeSplitSaveMetadata(buildSplitSaveMetadataFromRecords(records), "save-1");

    expect(split.indexBytes).toBeLessThan(monolithic.totalIndexBytes);
    expect(split.activeWriteBytes).toBeLessThan(monolithic.totalIndexBytes);
    expect(split.totalPayloadBytes).toBe(monolithic.totalStateBytes);
  });

  it("formats byte values for QA readouts", () => {
    expect(getUtf8ByteLength("abc")).toBe(3);
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });
});
