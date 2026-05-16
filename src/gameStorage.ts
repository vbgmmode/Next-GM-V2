export const MAX_SAVE_SLOTS = 5;

const LEGACY_STORAGE_KEY = "next-gm-save";
const SAVE_INDEX_KEY = "next-gm-save-index";

export type StoredSaveRecord = {
  id: string;
  name: string;
  createdAt: string;
  lastPlayedAt: string;
  state: unknown;
};

type SaveIndex = {
  version: 1;
  saves: StoredSaveRecord[];
};

function createSaveId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`Could not load ${key}.`, error);
    return null;
  }
}

function writeSaveIndex(records: StoredSaveRecord[]) {
  try {
    const index: SaveIndex = { version: 1, saves: records.slice(0, MAX_SAVE_SLOTS) };
    localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.warn("Could not save career index.", error);
  }
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeSaveRecord(value: unknown): StoredSaveRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredSaveRecord>;

  if (!candidate.state || typeof candidate.state !== "object") {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : createSaveId(),
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : "Untitled Career",
    createdAt: isValidDate(candidate.createdAt) ? candidate.createdAt : now,
    lastPlayedAt: isValidDate(candidate.lastPlayedAt) ? candidate.lastPlayedAt : isValidDate(candidate.createdAt) ? candidate.createdAt : now,
    state: candidate.state,
  };
}

function sortByLastPlayed(records: StoredSaveRecord[]) {
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

export function loadSaveRecords() {
  const index = readJson<Partial<SaveIndex>>(SAVE_INDEX_KEY);

  if (index && Array.isArray(index.saves)) {
    const records = sortByLastPlayed(index.saves.map(normalizeSaveRecord).filter((record): record is StoredSaveRecord => Boolean(record)));
    writeSaveIndex(records);
    return records;
  }

  const legacyRecord = loadLegacySaveRecord();

  if (!legacyRecord) {
    return [];
  }

  writeSaveIndex([legacyRecord]);

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear legacy save after migration.", error);
  }

  return [legacyRecord];
}

export function createSaveRecord(state: unknown, name: string) {
  const records = loadSaveRecords();

  if (records.length >= MAX_SAVE_SLOTS) {
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
  const updatedRecords = sortByLastPlayed([record, ...records]);
  writeSaveIndex(updatedRecords);
  return record;
}

export function updateSaveRecord(id: string, state: unknown) {
  const records = loadSaveRecords();
  const now = new Date().toISOString();
  let updatedRecord: StoredSaveRecord | null = null;
  const updatedRecords = records.map((record) => {
    if (record.id !== id) {
      return record;
    }

    updatedRecord = { ...record, state, lastPlayedAt: now };
    return updatedRecord;
  });

  if (!updatedRecord) {
    return null;
  }

  writeSaveIndex(sortByLastPlayed(updatedRecords));
  return updatedRecord;
}

export function renameSaveRecord(id: string, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  const records = loadSaveRecords();
  let updatedRecord: StoredSaveRecord | null = null;
  const updatedRecords = records.map((record) => {
    if (record.id !== id) {
      return record;
    }

    updatedRecord = { ...record, name: trimmedName };
    return updatedRecord;
  });

  if (!updatedRecord) {
    return null;
  }

  writeSaveIndex(updatedRecords);
  return updatedRecord;
}

export function deleteSaveRecord(id: string) {
  const records = loadSaveRecords();
  const updatedRecords = records.filter((record) => record.id !== id);
  writeSaveIndex(updatedRecords);
  return updatedRecords.length !== records.length;
}
