import rosterAttributesCsv from "../../data/rosters/top_200_roster_attributes_2026-05-16.csv?raw";
import type { AffiliationKind, Wrestler, WrestlerAffiliation } from "./types";

type CsvRecord = Record<string, string>;

function parseCsv(csv: string): CsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;

  return dataRows
    .filter((dataRow) => dataRow.some((cell) => cell.trim()))
    .map((dataRow) =>
      headers.reduce<CsvRecord>((record, header, index) => {
        record[header] = dataRow[index] ?? "";
        return record;
      }, {}),
    );
}

function createStableId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWrestlerId(id: string) {
  return id.trim().replace(/_/g, "-");
}

function getAffiliationKind(memberCount: number): AffiliationKind {
  if (memberCount === 2) {
    return "tag_team";
  }

  if (memberCount >= 3) {
    return "faction";
  }

  return "affiliation";
}

function formatAffiliationKind(kind: AffiliationKind) {
  if (kind === "tag_team") {
    return "Tag Team";
  }

  if (kind === "faction") {
    return "Faction";
  }

  return "Affiliation";
}

const affiliationRows = parseCsv(rosterAttributesCsv)
  .map((row) => ({
    affiliationName: row.faction_or_team?.trim() ?? "",
    wrestlerId: normalizeWrestlerId(row.id ?? ""),
  }))
  .filter((row) => row.affiliationName && row.wrestlerId);

export const affiliationCatalog: WrestlerAffiliation[] = Object.entries(
  affiliationRows.reduce<Record<string, string[]>>((groups, row) => {
    groups[row.affiliationName] = [...(groups[row.affiliationName] ?? []), row.wrestlerId];
    return groups;
  }, {}),
)
  .map(([name, memberWrestlerIds]) => {
    const kind = getAffiliationKind(memberWrestlerIds.length);

    return {
      id: `affiliation-${createStableId(name)}`,
      name,
      kind,
      memberWrestlerIds,
      status: `Source ${formatAffiliationKind(kind)}`,
      sourceLabel: "Top 200 roster faction/team field",
      notes:
        kind === "affiliation"
          ? "Only one current Top 200 member is tied to this source label, so it is shown as context rather than a complete team."
          : "Read-only roster context. No tag booking, title logic, or faction mechanics are active.",
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function getRosterAffiliations(wrestlers: Pick<Wrestler, "id">[]) {
  const rosterIds = new Set(wrestlers.map((wrestler) => wrestler.id));

  return affiliationCatalog
    .map((affiliation) => ({
      ...affiliation,
      memberWrestlerIds: affiliation.memberWrestlerIds.filter((id) => rosterIds.has(id)),
    }))
    .filter((affiliation) => affiliation.memberWrestlerIds.length);
}

export function getWrestlerAffiliations(wrestlerId: string, wrestlers: Pick<Wrestler, "id">[]) {
  return getRosterAffiliations(wrestlers).filter((affiliation) => affiliation.memberWrestlerIds.includes(wrestlerId));
}
