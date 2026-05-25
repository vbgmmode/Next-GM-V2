export function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeOptionalId(value: unknown) {
  return isNonEmptyId(value) ? value.trim() : undefined;
}

function normalizeIdPart(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown";
}

export function createStableDomainId(scope: string, parts: readonly unknown[]) {
  return [normalizeIdPart(scope), ...parts.map(normalizeIdPart)].join("-");
}

export function createUniqueDomainId(scope: string, parts: readonly unknown[], existingIds: Iterable<string> = []) {
  const baseId = createStableDomainId(scope, parts);
  const usedIds = new Set(existingIds);

  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;

  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  return nextId;
}
