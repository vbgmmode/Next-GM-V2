import { beforeEach, describe, expect, it } from "vitest";
import { clearRecentSaveStorageOperations, getRecentSaveStorageOperations } from "./game/savePerformance";
import { createSaveRecord, deleteSaveRecord, loadSaveRecord, loadSaveRecords, loadSaveSummaries, renameSaveRecord, updateSaveRecord } from "./gameStorage";

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function storage() {
  return globalThis.localStorage as unknown as MemoryStorage;
}

function state(label: string, extra = "") {
  return {
    saveVersion: 2,
    screen: "dashboard",
    game: {
      brandName: label,
      showHistory: [{ id: `${label}-show`, note: extra }],
    },
  };
}

describe("gameStorage split index", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
    clearRecentSaveStorageOperations();
  });

  it("stores index metadata separately from save payloads", () => {
    const record = createSaveRecord(state("Raw", "x".repeat(5000)), "Raw Career");
    const index = storage().getItem("next-gm-save-index");

    expect(record).toBeTruthy();
    expect(index).toContain('"version":2');
    expect(index).toContain('"stateKey"');
    expect(index).not.toContain("Raw-show");
    expect(storage().getItem(`next-gm-save:${record?.id}`)).toContain("Raw-show");
  });

  it("updates one payload without reading every save payload first", () => {
    const first = createSaveRecord(state("Raw"), "Raw Career");
    createSaveRecord(state("SmackDown"), "SmackDown Career");
    clearRecentSaveStorageOperations();

    const updated = updateSaveRecord(first?.id ?? "", state("Raw Updated", "y".repeat(1000)));
    const operations = getRecentSaveStorageOperations().map((operation) => operation.kind);

    expect(updated?.state).toMatchObject({ game: { brandName: "Raw Updated" } });
    expect(operations).toContain("read-index");
    expect(operations).toContain("write-payload");
    expect(operations).toContain("write-index");
    expect(operations).not.toContain("read-payload");
  });

  it("loads summaries without reading hot or cold payloads", () => {
    createSaveRecord(state("Raw"), "Raw Career");
    clearRecentSaveStorageOperations();

    const summaries = loadSaveSummaries();
    const operations = getRecentSaveStorageOperations().map((operation) => operation.kind);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].preview.brandName).toBe("Raw");
    expect(operations).toContain("read-index");
    expect(operations).not.toContain("read-payload");
  });

  it("migrates legacy inline index records into split payload records", () => {
    const legacyState = state("Legacy");
    storage().setItem(
      "next-gm-save-index",
      JSON.stringify({
        version: 1,
        saves: [
          {
            id: "legacy-save",
            name: "Legacy Save",
            createdAt: "2026-05-25T00:00:00.000Z",
            lastPlayedAt: "2026-05-25T00:00:00.000Z",
            state: legacyState,
          },
        ],
      }),
    );

    const records = loadSaveRecords();
    const index = storage().getItem("next-gm-save-index");

    expect(records).toHaveLength(1);
    expect(records[0].state).toMatchObject(legacyState);
    expect(index).toContain('"version":2');
    expect(index).not.toContain('"state"');
    expect(storage().getItem("next-gm-save:legacy-save")).toContain("Legacy-show");
  });

  it("packs older history into cold item records and rehydrates full saves on load", () => {
    const longState = {
      saveVersion: 2,
      screen: "dashboard",
      game: {
        brandName: "Long Career",
        showHistory: Array.from({ length: 12 }, (_, index) => ({ id: `show-${index}` })),
        socialPosts: Array.from({ length: 12 }, (_, index) => ({ id: `post-${index}` })),
      },
    };
    const record = createSaveRecord(longState, "Long Career");
    const hotPayload = storage().getItem(`next-gm-save:${record?.id}`);
    const index = storage().getItem("next-gm-save-index");
    const records = loadSaveRecords();

    expect(hotPayload).toContain("show-11");
    expect(hotPayload).not.toContain("show-0");
    expect(index).toContain("coldCollections");
    expect(storage().getItem(`next-gm-save:${record?.id}:cold:showHistory:0`)).toContain("show-0");
    expect(records[0].state).toMatchObject(longState);
  });

  it("hydrates only the selected save payload", () => {
    const first = createSaveRecord(state("Raw"), "Raw Career");
    createSaveRecord(state("SmackDown"), "SmackDown Career");
    clearRecentSaveStorageOperations();

    const hydrated = loadSaveRecord(first?.id ?? "");
    const payloadReads = getRecentSaveStorageOperations().filter((operation) => operation.kind === "read-payload");

    expect(hydrated?.state).toMatchObject({ game: { brandName: "Raw" } });
    expect(payloadReads).toHaveLength(1);
    expect(payloadReads[0].key).toBe(`next-gm-save:${first?.id}`);
  });

  it("rewrites cold entries when item identity changes at the same index", () => {
    const longState = {
      saveVersion: 2,
      screen: "dashboard",
      game: {
        brandName: "Long Career",
        showHistory: Array.from({ length: 12 }, (_, index) => ({ id: `show-${index}` })),
      },
    };
    const record = createSaveRecord(longState, "Long Career");
    const coldKey = `next-gm-save:${record?.id}:cold:showHistory:0`;

    expect(storage().getItem(coldKey)).toContain("show-0");

    updateSaveRecord(record?.id ?? "", {
      ...longState,
      game: {
        ...longState.game,
        showHistory: Array.from({ length: 12 }, (_, index) => ({ id: index === 0 ? "show-rewritten" : `show-${index}` })),
      },
    });

    expect(storage().getItem(coldKey)).toContain("show-rewritten");
    expect(storage().getItem("next-gm-save-index")).toContain('"itemId":"show-rewritten"');
  });

  it("renames from metadata and deletes the matching payload", () => {
    const record = createSaveRecord(
      {
        saveVersion: 2,
        screen: "dashboard",
        game: {
          brandName: "NXT",
          showHistory: Array.from({ length: 12 }, (_, index) => ({ id: `nxt-show-${index}` })),
        },
      },
      "NXT Career",
    );

    const renamed = renameSaveRecord(record?.id ?? "", "NXT Save");
    expect(renamed?.name).toBe("NXT Save");
    expect(storage().getItem(`next-gm-save:${record?.id}`)).toContain("nxt-show-11");
    expect(storage().getItem(`next-gm-save:${record?.id}:cold:showHistory:0`)).toContain("nxt-show-0");

    expect(deleteSaveRecord(record?.id ?? "")).toBe(true);
    expect(storage().getItem(`next-gm-save:${record?.id}`)).toBeNull();
    expect(storage().getItem(`next-gm-save:${record?.id}:cold:showHistory:0`)).toBeNull();
    expect(loadSaveRecords()).toHaveLength(0);
  });
});
