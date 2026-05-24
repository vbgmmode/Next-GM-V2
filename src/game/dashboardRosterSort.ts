import type { DashboardViewModel } from "./dashboardViewModel";

export type DashboardRosterSortColumn =
  | "rank"
  | "name"
  | "side"
  | "pop"
  | "stamina"
  | "morale"
  | "overall"
  | "contract"
  | "cost";

export type DashboardRosterSortDirection = "asc" | "desc";

export type DashboardRosterRow = DashboardViewModel["roster"][number];

const MORALE_ORDER = { happy: 2, neutral: 1, angry: 0 } as const;
const ALIGNMENT_ORDER = { face: 0, neutral: 1, heel: 2, unknown: 3 } as const;

function parseContractWeeks(value: string) {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : -1;
}

function parseShortMoney(value: string) {
  if (value === "-") {
    return -1;
  }

  const normalized = value.replace(/[$,]/g, "");
  if (normalized.endsWith("M")) {
    return parseFloat(normalized.slice(0, -1)) * 1_000_000;
  }

  if (normalized.endsWith("K")) {
    return parseFloat(normalized.slice(0, -1)) * 1_000;
  }

  return Number(normalized) || 0;
}

function compareRows(a: DashboardRosterRow, b: DashboardRosterRow, column: DashboardRosterSortColumn) {
  switch (column) {
    case "rank":
      return a.rank - b.rank;
    case "name":
      return a.name.localeCompare(b.name);
    case "side":
      return ALIGNMENT_ORDER[a.alignment] - ALIGNMENT_ORDER[b.alignment];
    case "pop":
      return a.pop - b.pop;
    case "stamina":
      return a.stamina - b.stamina;
    case "morale":
      return MORALE_ORDER[a.morale] - MORALE_ORDER[b.morale];
    case "overall":
      return a.overall - b.overall;
    case "contract":
      return parseContractWeeks(a.contract) - parseContractWeeks(b.contract);
    case "cost":
      return parseShortMoney(a.cost) - parseShortMoney(b.cost);
  }
}

export function sortDashboardRosterRows(
  roster: DashboardRosterRow[],
  column: DashboardRosterSortColumn,
  direction: DashboardRosterSortDirection
) {
  const sorted = [...roster].sort((left, right) => {
    const result = compareRows(left, right, column);
    return result !== 0 ? result : left.rank - right.rank;
  });

  return direction === "desc" ? sorted.reverse() : sorted;
}

export function getDefaultDashboardRosterSortDirection(column: DashboardRosterSortColumn): DashboardRosterSortDirection {
  return column === "name" ? "asc" : "desc";
}
