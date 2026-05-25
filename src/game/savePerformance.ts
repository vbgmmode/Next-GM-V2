export type SaveLatencyRisk = "stable" | "watch" | "risk" | "critical";

export type SaveLatencyProjection = {
  label: string;
  bytes: number;
  estimatedMs: number;
  risk: SaveLatencyRisk;
};

export type SaveStorageOperationKind = "read-index" | "read-legacy" | "read-payload" | "write-index" | "write-payload" | "delete-payload" | "normalize-index";

export type SaveStorageOperationSample = {
  kind: SaveStorageOperationKind;
  key: string;
  timestamp: string;
  bytes: number;
  saveCount?: number;
  largestSaveBytes?: number;
  totalMs: number;
  getItemMs?: number;
  parseMs?: number;
  normalizeMs?: number;
  stringifyMs?: number;
  setItemMs?: number;
};

export type SaveRecordLike = {
  id: string;
  name: string;
  state: unknown;
};

export type SaveMetadataLike = {
  id: string;
  name: string;
  stateKey: string;
  stateBytes: number;
};

export type SaveStateContributor = {
  path: string;
  bytes: number;
  percentOfState: number;
};

export type SaveRecordFootprint = {
  id: string;
  name: string;
  stateBytes: number;
  recordBytes: number;
  contributors: SaveStateContributor[];
};

export type SaveFootprint = {
  saveCount: number;
  totalIndexBytes: number;
  totalStateBytes: number;
  largestSaveBytes: number;
  largestSaveName?: string;
  records: SaveRecordFootprint[];
  aggregateContributors: SaveStateContributor[];
};

export type SplitSaveFootprint = {
  saveCount: number;
  indexBytes: number;
  totalPayloadBytes: number;
  largestPayloadBytes: number;
  largestSaveName?: string;
  activeWriteBytes: number;
};

export type SaveLatencyModel = {
  baseMs: number;
  msPerKb: number;
};

export const HOT_SAVE_HISTORY_LIMIT = 8;
export const COLD_GAME_ARRAY_KEYS = ["championshipHistory", "rivalryHistory", "socialPosts", "financeReports", "eventLedger", "showHistory"] as const;
export const COLD_RIVAL_BRAND_ARRAY_KEYS = ["financeReports", "freeAgentClaims", "marketTransactions", "activityHistory", "weeklyResults"] as const;

export const DEFAULT_SAVE_LATENCY_MODEL: SaveLatencyModel = {
  baseMs: 6,
  msPerKb: 0.08,
};

const recentSamplesLimit = 25;
const recentSamples: SaveStorageOperationSample[] = [];

function getNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

export function measureDuration<T>(operation: () => T): { value: T; durationMs: number } {
  const startedAt = getNowMs();
  const value = operation();
  return { value, durationMs: Math.max(0, getNowMs() - startedAt) };
}

export function getUtf8ByteLength(value: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }

  return value.length;
}

export function measureJsonStringify(value: unknown) {
  const measured = measureDuration(() => JSON.stringify(value));
  return {
    value: measured.value,
    durationMs: measured.durationMs,
    bytes: getUtf8ByteLength(measured.value),
  };
}

export function measureJsonParse<T>(value: string) {
  return measureDuration(() => JSON.parse(value) as T);
}

export function recordSaveStorageOperation(sample: SaveStorageOperationSample) {
  recentSamples.unshift(sample);

  if (recentSamples.length > recentSamplesLimit) {
    recentSamples.length = recentSamplesLimit;
  }
}

export function getRecentSaveStorageOperations() {
  return [...recentSamples];
}

export function clearRecentSaveStorageOperations() {
  recentSamples.length = 0;
}

export function classifySaveLatency(estimatedMs: number): SaveLatencyRisk {
  if (estimatedMs >= 250) {
    return "critical";
  }

  if (estimatedMs >= 100) {
    return "risk";
  }

  if (estimatedMs >= 50) {
    return "watch";
  }

  return "stable";
}

export function estimateSaveLatencyMs(bytes: number, model = DEFAULT_SAVE_LATENCY_MODEL) {
  return model.baseMs + (Math.max(0, bytes) / 1024) * model.msPerKb;
}

export function buildSaveLatencyProjection(label: string, bytes: number, model = DEFAULT_SAVE_LATENCY_MODEL): SaveLatencyProjection {
  const estimatedMs = estimateSaveLatencyMs(bytes, model);
  return {
    label,
    bytes,
    estimatedMs,
    risk: classifySaveLatency(estimatedMs),
  };
}

export function buildSaveLatencyProjections(entries: Array<{ label: string; bytes: number }>, model = DEFAULT_SAVE_LATENCY_MODEL) {
  return entries.map((entry) => buildSaveLatencyProjection(entry.label, entry.bytes, model));
}

function measureUnknownBytes(value: unknown) {
  return getUtf8ByteLength(JSON.stringify(value));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toHotSaveState(state: unknown, historyLimit = HOT_SAVE_HISTORY_LIMIT) {
  if (!isObjectRecord(state) || !isObjectRecord(state.game)) {
    return state;
  }

  const game = state.game;
  const hotGame: Record<string, unknown> = { ...game };

  COLD_GAME_ARRAY_KEYS.forEach((key) => {
    const value = game[key];

    if (Array.isArray(value) && value.length > historyLimit) {
      hotGame[key] = value.slice(-historyLimit);
    }
  });

  if (Array.isArray(game.rivalBrands)) {
    hotGame.rivalBrands = game.rivalBrands.map((brand) => {
      if (!isObjectRecord(brand)) {
        return brand;
      }

      const hotBrand: Record<string, unknown> = { ...brand };

      COLD_RIVAL_BRAND_ARRAY_KEYS.forEach((key) => {
        const value = brand[key];

        if (Array.isArray(value) && value.length > historyLimit) {
          hotBrand[key] = value.slice(-historyLimit);
        }
      });

      return hotBrand;
    });
  }

  return {
    ...state,
    game: hotGame,
  };
}

function topLevelStateContributors(state: unknown): SaveStateContributor[] {
  if (!state || typeof state !== "object") {
    return [];
  }

  const totalBytes = Math.max(1, measureUnknownBytes(state));

  return Object.entries(state as Record<string, unknown>)
    .map(([path, value]) => {
      const bytes = measureUnknownBytes(value);
      return {
        path,
        bytes,
        percentOfState: bytes / totalBytes,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

export function analyzeSaveRecord(record: SaveRecordLike): SaveRecordFootprint {
  const stateBytes = measureUnknownBytes(record.state);
  const recordBytes = measureUnknownBytes(record);

  return {
    id: record.id,
    name: record.name,
    stateBytes,
    recordBytes,
    contributors: topLevelStateContributors(record.state),
  };
}

export function analyzeSaveRecords(records: SaveRecordLike[]): SaveFootprint {
  const recordFootprints = records.map(analyzeSaveRecord);
  const totalIndexBytes = measureUnknownBytes({ version: 1, saves: records });
  const totalStateBytes = recordFootprints.reduce((sum, record) => sum + record.stateBytes, 0);
  const largestRecord = [...recordFootprints].sort((a, b) => b.stateBytes - a.stateBytes)[0];
  const aggregateContributorMap = new Map<string, number>();

  recordFootprints.forEach((record) => {
    record.contributors.forEach((contributor) => {
      aggregateContributorMap.set(contributor.path, (aggregateContributorMap.get(contributor.path) ?? 0) + contributor.bytes);
    });
  });

  const aggregateContributors = [...aggregateContributorMap.entries()]
    .map(([path, bytes]) => ({
      path,
      bytes,
      percentOfState: totalStateBytes ? bytes / totalStateBytes : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    saveCount: records.length,
    totalIndexBytes,
    totalStateBytes,
    largestSaveBytes: largestRecord?.stateBytes ?? 0,
    largestSaveName: largestRecord?.name,
    records: recordFootprints,
    aggregateContributors,
  };
}

export function analyzeSplitSaveMetadata(records: SaveMetadataLike[], activeSaveId?: string): SplitSaveFootprint {
  const indexBytes = measureUnknownBytes({ version: 2, saves: records });
  const largestRecord = [...records].sort((a, b) => b.stateBytes - a.stateBytes)[0];
  const activeRecord = activeSaveId ? records.find((record) => record.id === activeSaveId) : largestRecord;

  return {
    saveCount: records.length,
    indexBytes,
    totalPayloadBytes: records.reduce((sum, record) => sum + record.stateBytes, 0),
    largestPayloadBytes: largestRecord?.stateBytes ?? 0,
    largestSaveName: largestRecord?.name,
    activeWriteBytes: indexBytes + (activeRecord?.stateBytes ?? 0),
  };
}

export function buildSplitSaveMetadataFromRecords(records: SaveRecordLike[]): SaveMetadataLike[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    stateKey: `next-gm-save:${record.id}`,
    stateBytes: analyzeSaveRecord(record).stateBytes,
  }));
}

export function buildHotSaveMetadataFromRecords(records: SaveRecordLike[], historyLimit = HOT_SAVE_HISTORY_LIMIT): SaveMetadataLike[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    stateKey: `next-gm-save:${record.id}`,
    stateBytes: measureUnknownBytes(toHotSaveState(record.state, historyLimit)),
  }));
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}
