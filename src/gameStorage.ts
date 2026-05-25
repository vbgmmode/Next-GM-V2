import {
  COLD_GAME_ARRAY_KEYS,
  COLD_RIVAL_BRAND_ARRAY_KEYS,
  HOT_SAVE_HISTORY_LIMIT,
  getUtf8ByteLength,
  measureDuration,
  measureJsonParse,
  measureJsonStringify,
  recordSaveStorageOperation,
  type SaveStorageOperationKind,
} from "./game/savePerformance";

export const MAX_SAVE_SLOTS = 5;

const LEGACY_STORAGE_KEY = "next-gm-save";
const SAVE_INDEX_KEY = "next-gm-save-index";
const SAVE_PAYLOAD_KEY_PREFIX = "next-gm-save:";

export type StoredSaveRecord = {
  id: string;
  name: string;
  createdAt: string;
  lastPlayedAt: string;
  state: unknown;
  stateKey?: string;
  stateBytes?: number;
  coldCollections?: ColdCollections;
};

type ColdCollectionEntry = {
  key: string;
  bytes: number;
  itemId?: string;
};

type ColdCollections = Record<string, ColdCollectionEntry[]>;

type StoredSaveIndexRecord = Omit<StoredSaveRecord, "state"> & {
  stateKey: string;
  stateBytes: number;
  preview: StoredSavePreview;
};

export type StoredSavePreview = {
  brandName: string;
  gmName: string;
  money: number;
  screen: string;
  seasonNumber: number;
  week: number;
};

export type StoredSaveSummary = {
  id: string;
  name: string;
  createdAt: string;
  lastPlayedAt: string;
  stateKey?: string;
  stateBytes?: number;
  preview: StoredSavePreview;
};

type SaveIndex = {
  version: 2;
  saves: StoredSaveIndexRecord[];
};

type LegacySaveIndex = {
  version?: 1;
  saves: unknown[];
};

function createSaveId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSavePayloadKey(id: string) {
  return `${SAVE_PAYLOAD_KEY_PREFIX}${id}`;
}

function getColdPayloadKey(saveId: string, collectionKey: string, index: number) {
  return `${SAVE_PAYLOAD_KEY_PREFIX}${saveId}:cold:${collectionKey}:${index}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function buildStoredSavePreview(state: unknown): StoredSavePreview {
  if (!isObjectRecord(state) || !isObjectRecord(state.game)) {
    return {
      brandName: "Unknown Brand",
      gmName: "Unknown GM",
      money: 0,
      screen: "dashboard",
      seasonNumber: 1,
      week: 1,
    };
  }

  return {
    brandName: asString(state.game.brandName, "Unknown Brand"),
    gmName: asString(state.game.gmName, "Unknown GM"),
    money: asNumber(state.game.money, 0),
    screen: asString(state.screen, "dashboard"),
    seasonNumber: asNumber(state.game.seasonNumber, 1),
    week: asNumber(state.game.currentWeek, 1),
  };
}

function getStorageReadKind(key: string): SaveStorageOperationKind {
  if (key === LEGACY_STORAGE_KEY) {
    return "read-legacy";
  }

  return key.startsWith(SAVE_PAYLOAD_KEY_PREFIX) ? "read-payload" : "read-index";
}

function readJson<T>(key: string): T | null {
  try {
    const getItem = measureDuration(() => localStorage.getItem(key));
    const value = getItem.value;

    if (!value) {
      recordSaveStorageOperation({
        kind: getStorageReadKind(key),
        key,
        timestamp: new Date().toISOString(),
        bytes: 0,
        totalMs: getItem.durationMs,
        getItemMs: getItem.durationMs,
      });
      return null;
    }

    const parsed = measureJsonParse<T>(value);
    recordSaveStorageOperation({
      kind: getStorageReadKind(key),
      key,
      timestamp: new Date().toISOString(),
      bytes: getUtf8ByteLength(value),
      totalMs: getItem.durationMs + parsed.durationMs,
      getItemMs: getItem.durationMs,
      parseMs: parsed.durationMs,
    });
    return parsed.value;
  } catch (error) {
    console.warn(`Could not load ${key}.`, error);
    return null;
  }
}

function writeJson(key: string, value: unknown, kind: SaveStorageOperationKind) {
  const stringified = measureJsonStringify(value);
  const setItem = measureDuration(() => localStorage.setItem(key, stringified.value));
  recordSaveStorageOperation({
    kind,
    key,
    timestamp: new Date().toISOString(),
    bytes: stringified.bytes,
    totalMs: stringified.durationMs + setItem.durationMs,
    stringifyMs: stringified.durationMs,
    setItemMs: setItem.durationMs,
  });
  return stringified.bytes;
}

function removeStorageKey(key: string, kind: SaveStorageOperationKind) {
  const removed = measureDuration(() => localStorage.removeItem(key));
  recordSaveStorageOperation({
    kind,
    key,
    timestamp: new Date().toISOString(),
    bytes: 0,
    totalMs: removed.durationMs,
    setItemMs: removed.durationMs,
  });
}

function writeSaveIndex(records: StoredSaveIndexRecord[]) {
  try {
    writeJson(SAVE_INDEX_KEY, { version: 2, saves: records.slice(0, MAX_SAVE_SLOTS) } satisfies SaveIndex, "write-index");
  } catch (error) {
    console.warn("Could not save career index.", error);
  }
}

function writeSavePayload(record: StoredSaveRecord): StoredSaveIndexRecord | null {
  try {
    const stateKey = record.stateKey ?? getSavePayloadKey(record.id);
    const packedState = packHotSaveState(record);
    const stateBytes = writeJson(stateKey, packedState.hotState, "write-payload");

    return {
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      lastPlayedAt: record.lastPlayedAt,
      stateKey,
      stateBytes,
      preview: buildStoredSavePreview(record.state),
      coldCollections: packedState.coldCollections,
    };
  } catch (error) {
    console.warn("Could not save career payload.", error);
    return null;
  }
}

function packHotSaveState(record: StoredSaveRecord) {
  if (!isObjectRecord(record.state) || !isObjectRecord(record.state.game)) {
    return { hotState: record.state, coldCollections: record.coldCollections };
  }

  const game = record.state.game;
  const hotGame: Record<string, unknown> = { ...game };
  const coldCollections: ColdCollections = {};

  COLD_GAME_ARRAY_KEYS.forEach((collectionKey) => {
    const value = game[collectionKey];

    if (!Array.isArray(value)) {
      removeColdCollection(record.coldCollections?.[collectionKey]);
      return;
    }

    const packedCollection = packColdCollection(record, collectionKey, value);

    if (packedCollection.entries.length) {
      coldCollections[collectionKey] = packedCollection.entries;
    }

    hotGame[collectionKey] = packedCollection.hotItems;
  });

  if (Array.isArray(game.rivalBrands)) {
    hotGame.rivalBrands = game.rivalBrands.map((brand) => {
      if (!isObjectRecord(brand)) {
        return brand;
      }

      const hotBrand: Record<string, unknown> = { ...brand };
      const brandId = typeof brand.id === "string" && brand.id.trim() ? brand.id : "unknown";

      COLD_RIVAL_BRAND_ARRAY_KEYS.forEach((arrayKey) => {
        const collectionKey = `rivalBrands.${brandId}.${arrayKey}`;
        const value = brand[arrayKey];

        if (!Array.isArray(value)) {
          removeColdCollection(record.coldCollections?.[collectionKey]);
          return;
        }

        const packedCollection = packColdCollection(record, collectionKey, value);

        if (packedCollection.entries.length) {
          coldCollections[collectionKey] = packedCollection.entries;
        }

        hotBrand[arrayKey] = packedCollection.hotItems;
      });

      return hotBrand;
    });
  }

  return {
    hotState: {
      ...record.state,
      game: hotGame,
    },
    coldCollections: Object.keys(coldCollections).length ? coldCollections : undefined,
  };
}

function packColdCollection(record: StoredSaveRecord, collectionKey: string, value: unknown[]) {
  if (value.length <= HOT_SAVE_HISTORY_LIMIT) {
    removeColdCollection(record.coldCollections?.[collectionKey]);
    return { hotItems: value, entries: [] };
  }

  const coldItems = value.slice(0, -HOT_SAVE_HISTORY_LIMIT);
  const hotItems = value.slice(-HOT_SAVE_HISTORY_LIMIT);
  const existingEntries = record.coldCollections?.[collectionKey] ?? [];
  const shouldRewriteCollection = existingEntries.length > coldItems.length;

  if (shouldRewriteCollection) {
    removeColdCollection(existingEntries);
  }

  const reusableEntries = shouldRewriteCollection ? [] : existingEntries;
  const entries = coldItems.map((item, index) => {
    const existingEntry = reusableEntries[index];
    const itemId = getItemIdentity(item);

    if (existingEntry && existingEntry.itemId === itemId) {
      return existingEntry;
    }

    const key = getColdPayloadKey(record.id, collectionKey, index);
    const bytes = writeJson(key, item, "write-payload");
    return { key, bytes, itemId };
  });

  return { hotItems, entries };
}

function removeColdCollection(entries: ColdCollectionEntry[] | undefined) {
  entries?.forEach((entry) => removeStorageKey(entry.key, "delete-payload"));
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeSaveMetadata(value: unknown): StoredSaveIndexRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredSaveIndexRecord>;

  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: candidate.id,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : "Untitled Career",
    createdAt: isValidDate(candidate.createdAt) ? candidate.createdAt : now,
    lastPlayedAt: isValidDate(candidate.lastPlayedAt) ? candidate.lastPlayedAt : isValidDate(candidate.createdAt) ? candidate.createdAt : now,
    stateKey: typeof candidate.stateKey === "string" && candidate.stateKey.trim() ? candidate.stateKey : getSavePayloadKey(candidate.id),
    stateBytes: typeof candidate.stateBytes === "number" && Number.isFinite(candidate.stateBytes) ? Math.max(0, candidate.stateBytes) : 0,
    preview: normalizeStoredSavePreview(candidate.preview),
    coldCollections: normalizeColdCollections(candidate.coldCollections),
  };
}

function normalizeStoredSavePreview(value: unknown): StoredSavePreview {
  if (!isObjectRecord(value)) {
    return {
      brandName: "Unknown Brand",
      gmName: "Unknown GM",
      money: 0,
      screen: "dashboard",
      seasonNumber: 1,
      week: 1,
    };
  }

  return {
    brandName: asString(value.brandName, "Unknown Brand"),
    gmName: asString(value.gmName, "Unknown GM"),
    money: asNumber(value.money, 0),
    screen: asString(value.screen, "dashboard"),
    seasonNumber: asNumber(value.seasonNumber, 1),
    week: asNumber(value.week, 1),
  };
}

function normalizeColdCollections(value: unknown): ColdCollections | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const collections: ColdCollections = {};

  Object.keys(value).forEach((collectionKey) => {
    const entries = value[collectionKey];

    if (!Array.isArray(entries)) {
      return;
    }

    const normalizedEntries = entries
      .map((entry): ColdCollectionEntry | null => {
        if (!isObjectRecord(entry) || typeof entry.key !== "string") {
          return null;
        }

        return {
          key: entry.key,
          bytes: typeof entry.bytes === "number" && Number.isFinite(entry.bytes) ? Math.max(0, entry.bytes) : 0,
          itemId: typeof entry.itemId === "string" ? entry.itemId : undefined,
        };
      })
      .filter((entry): entry is ColdCollectionEntry => Boolean(entry));

    if (normalizedEntries.length) {
      collections[collectionKey] = normalizedEntries;
    }
  });

  return Object.keys(collections).length ? collections : undefined;
}

function normalizeInlineSaveRecord(value: unknown): StoredSaveRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredSaveRecord>;

  if (!candidate.state || typeof candidate.state !== "object") {
    return null;
  }

  const now = new Date().toISOString();
  const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : createSaveId();

  return {
    id,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : "Untitled Career",
    createdAt: isValidDate(candidate.createdAt) ? candidate.createdAt : now,
    lastPlayedAt: isValidDate(candidate.lastPlayedAt) ? candidate.lastPlayedAt : isValidDate(candidate.createdAt) ? candidate.createdAt : now,
    state: candidate.state,
    stateKey: typeof candidate.stateKey === "string" && candidate.stateKey.trim() ? candidate.stateKey : getSavePayloadKey(id),
    stateBytes: typeof candidate.stateBytes === "number" && Number.isFinite(candidate.stateBytes) ? Math.max(0, candidate.stateBytes) : undefined,
    coldCollections: normalizeColdCollections(candidate.coldCollections),
  };
}

function sortByLastPlayed<T extends Pick<StoredSaveRecord, "lastPlayedAt">>(records: T[]) {
  return [...records].sort((a, b) => Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt));
}

function loadLegacySaveRecord(): StoredSaveRecord | null {
  const legacyState = readJson<unknown>(LEGACY_STORAGE_KEY);

  if (!legacyState || typeof legacyState !== "object") {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: createSaveId(),
    name: "Original Career",
    createdAt: now,
    lastPlayedAt: now,
    state: legacyState,
  };
}

function migrateInlineRecords(records: StoredSaveRecord[]) {
  const metadata = records.map(writeSavePayload).filter((record): record is StoredSaveIndexRecord => Boolean(record));
  const sortedMetadata = sortByLastPlayed(metadata);
  writeSaveIndex(sortedMetadata);
  return sortedMetadata;
}

function loadSaveMetadata() {
  const index = readJson<Partial<SaveIndex> | Partial<LegacySaveIndex>>(SAVE_INDEX_KEY);

  if (index && Array.isArray(index.saves)) {
    const indexSaves = index.saves;
    const normalized = measureDuration(() => {
      const inlineRecords = indexSaves
        .map(normalizeInlineSaveRecord)
        .filter((record): record is StoredSaveRecord => Boolean(record));

      if (inlineRecords.length) {
        return migrateInlineRecords(inlineRecords);
      }

      return sortByLastPlayed(indexSaves.map(normalizeSaveMetadata).filter((record): record is StoredSaveIndexRecord => Boolean(record)));
    });
    const records = normalized.value;
    recordSaveStorageOperation({
      kind: "normalize-index",
      key: SAVE_INDEX_KEY,
      timestamp: new Date().toISOString(),
      bytes: 0,
      saveCount: records.length,
      totalMs: normalized.durationMs,
      normalizeMs: normalized.durationMs,
    });

    if (records.length !== indexSaves.length || (index as Partial<SaveIndex>).version !== 2) {
      writeSaveIndex(records);
    }

    return records;
  }

  const legacyRecord = loadLegacySaveRecord();

  if (!legacyRecord) {
    return [];
  }

  const metadata = migrateInlineRecords([legacyRecord]);

  try {
    removeStorageKey(LEGACY_STORAGE_KEY, "delete-payload");
  } catch (error) {
    console.warn("Could not clear legacy save after migration.", error);
  }

  return metadata;
}

function loadSaveRecordFromMetadata(metadata: StoredSaveIndexRecord): StoredSaveRecord | null {
  const storedState = readJson<unknown>(metadata.stateKey);

  if (!storedState || typeof storedState !== "object") {
    return null;
  }

  return {
    ...metadata,
    state: rehydrateColdSaveState(storedState, metadata.coldCollections),
  };
}

function rehydrateColdSaveState(state: unknown, coldCollections: ColdCollections | undefined) {
  if (!coldCollections || !isObjectRecord(state) || !isObjectRecord(state.game)) {
    return state;
  }

  const game: Record<string, unknown> = { ...state.game };

  COLD_GAME_ARRAY_KEYS.forEach((collectionKey) => {
    const entries = coldCollections[collectionKey] ?? [];

    if (!entries.length) {
      return;
    }

    const coldItems = entries.map((entry) => readJson<unknown>(entry.key)).filter((item) => item !== null);
    const hotItems = Array.isArray(game[collectionKey]) ? game[collectionKey] : [];
    game[collectionKey] = mergeColdAndHotItems(coldItems, hotItems);
  });

  if (Array.isArray(game.rivalBrands)) {
    game.rivalBrands = game.rivalBrands.map((brand) => {
      if (!isObjectRecord(brand)) {
        return brand;
      }

      const hydratedBrand: Record<string, unknown> = { ...brand };
      const brandId = typeof brand.id === "string" && brand.id.trim() ? brand.id : "unknown";

      COLD_RIVAL_BRAND_ARRAY_KEYS.forEach((arrayKey) => {
        const entries = coldCollections[`rivalBrands.${brandId}.${arrayKey}`] ?? [];

        if (!entries.length) {
          return;
        }

        const coldItems = entries.map((entry) => readJson<unknown>(entry.key)).filter((item) => item !== null);
        const hotItems = Array.isArray(hydratedBrand[arrayKey]) ? hydratedBrand[arrayKey] : [];
        hydratedBrand[arrayKey] = mergeColdAndHotItems(coldItems, hotItems);
      });

      return hydratedBrand;
    });
  }

  return {
    ...state,
    game,
  };
}

function getItemIdentity(item: unknown) {
  if (!isObjectRecord(item)) {
    return undefined;
  }

  return typeof item.id === "string" ? item.id : undefined;
}

function mergeColdAndHotItems(coldItems: unknown[], hotItems: unknown[]) {
  const merged: unknown[] = [];
  const seenIds = new Set<string>();

  [...coldItems, ...hotItems].forEach((item) => {
    const id = getItemIdentity(item);

    if (id && seenIds.has(id)) {
      return;
    }

    if (id) {
      seenIds.add(id);
    }

    merged.push(item);
  });

  return merged;
}

function metadataFromRecord(record: StoredSaveRecord): StoredSaveIndexRecord {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    lastPlayedAt: record.lastPlayedAt,
    stateKey: record.stateKey ?? getSavePayloadKey(record.id),
    stateBytes: record.stateBytes ?? 0,
    preview: buildStoredSavePreview(record.state),
    coldCollections: record.coldCollections,
  };
}

function removeColdCollections(coldCollections: ColdCollections | undefined) {
  Object.values(coldCollections ?? {}).forEach(removeColdCollection);
}

export function loadSaveRecords() {
  const metadata = loadSaveMetadata();
  const records = metadata.map(loadSaveRecordFromMetadata).filter((record): record is StoredSaveRecord => Boolean(record));

  if (records.length !== metadata.length) {
    writeSaveIndex(records.map(metadataFromRecord));
  }

  return sortByLastPlayed(records);
}

function summaryFromMetadata(record: StoredSaveIndexRecord): StoredSaveSummary {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    lastPlayedAt: record.lastPlayedAt,
    stateKey: record.stateKey,
    stateBytes: record.stateBytes,
    preview: record.preview,
  };
}

export function loadSaveSummaries() {
  return loadSaveMetadata().map(summaryFromMetadata);
}

export function loadSaveRecord(id: string) {
  const metadata = loadSaveMetadata().find((record) => record.id === id);

  return metadata ? loadSaveRecordFromMetadata(metadata) : null;
}

export function createSaveRecord(state: unknown, name: string) {
  const metadata = loadSaveMetadata();

  if (metadata.length >= MAX_SAVE_SLOTS) {
    return null;
  }

  const now = new Date().toISOString();
  const record: StoredSaveRecord = {
    id: createSaveId(),
    name: name.trim() || "Untitled Career",
    createdAt: now,
    lastPlayedAt: now,
    state,
  };
  const createdMetadata = writeSavePayload(record);

  if (!createdMetadata) {
    return null;
  }

  writeSaveIndex(sortByLastPlayed([createdMetadata, ...metadata]));
  return { ...record, stateKey: createdMetadata.stateKey, stateBytes: createdMetadata.stateBytes };
}

export function updateSaveRecord(id: string, state: unknown) {
  const metadata = loadSaveMetadata();
  const existingMetadata = metadata.find((record) => record.id === id);

  if (!existingMetadata) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedRecord: StoredSaveRecord = {
    ...existingMetadata,
    state,
    lastPlayedAt: now,
  };
  const updatedMetadata = writeSavePayload(updatedRecord);

  if (!updatedMetadata) {
    return null;
  }

  writeSaveIndex(sortByLastPlayed(metadata.map((record) => (record.id === id ? updatedMetadata : record))));
  return { ...updatedRecord, stateKey: updatedMetadata.stateKey, stateBytes: updatedMetadata.stateBytes };
}

export function renameSaveRecord(id: string, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  const metadata = loadSaveMetadata();
  const existingMetadata = metadata.find((record) => record.id === id);

  if (!existingMetadata) {
    return null;
  }

  const updatedMetadata: StoredSaveIndexRecord = { ...existingMetadata, name: trimmedName };
  const updatedRecords = metadata.map((record) => (record.id === id ? updatedMetadata : record));

  writeSaveIndex(updatedRecords);
  return summaryFromMetadata(updatedMetadata);
}

export function deleteSaveRecord(id: string) {
  const metadata = loadSaveMetadata();
  const deletedRecord = metadata.find((record) => record.id === id);
  const updatedRecords = metadata.filter((record) => record.id !== id);

  if (!deletedRecord) {
    return false;
  }

  removeStorageKey(deletedRecord.stateKey, "delete-payload");
  removeColdCollections(deletedRecord.coldCollections);
  writeSaveIndex(updatedRecords);
  return true;
}
