import top200RosterCandidatesRaw from "../../data/rosters/top_200_draft_pool.generated.json";
import type { Wrestler } from "./types";
import { ensureMatchRatings } from "./matchRatings";

const sourceBrandDraftCaps: Record<string, number> = {
  AEW: 35,
};

const top200RosterCandidates: Wrestler[] = top200RosterCandidatesRaw as Wrestler[];


function applySourceBrandDraftCaps(wrestlers: Wrestler[]) {
  const sourceBrandCounts: Record<string, number> = {};

  return wrestlers.filter((wrestler) => {
    const sourceBrand = wrestler.sourceBrand;

    if (!sourceBrand || !sourceBrandDraftCaps[sourceBrand]) {
      return true;
    }

    const nextCount = (sourceBrandCounts[sourceBrand] ?? 0) + 1;
    sourceBrandCounts[sourceBrand] = nextCount;

    return nextCount <= sourceBrandDraftCaps[sourceBrand];
  });
}

function clampStat(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

type RatedStat = "popularity" | "momentum" | "ringSkill" | "promoSkill" | "morale" | "fatigue";

type StatBand = Record<RatedStat, [number, number]>;

const statBandsByRoleTier: Record<string, StatBand> = {
  MainEvent: {
    popularity: [74, 92],
    momentum: [64, 86],
    ringSkill: [70, 89],
    promoSkill: [70, 89],
    morale: [50, 70],
    fatigue: [16, 46],
  },
  UpperCard: {
    popularity: [68, 84],
    momentum: [58, 82],
    ringSkill: [64, 87],
    promoSkill: [62, 87],
    morale: [48, 68],
    fatigue: [14, 42],
  },
  Midcard: {
    popularity: [58, 78],
    momentum: [50, 76],
    ringSkill: [58, 84],
    promoSkill: [56, 84],
    morale: [46, 64],
    fatigue: [12, 39],
  },
  Prospect: {
    popularity: [50, 68],
    momentum: [46, 70],
    ringSkill: [52, 80],
    promoSkill: [50, 78],
    morale: [45, 63],
    fatigue: [10, 34],
  },
  Enhancement: {
    popularity: [45, 62],
    momentum: [42, 64],
    ringSkill: [48, 74],
    promoSkill: [46, 72],
    morale: [42, 60],
    fatigue: [12, 36],
  },
};

const defaultStatBand = statBandsByRoleTier.Midcard;

function getRoleTierBand(wrestler: Wrestler) {
  return statBandsByRoleTier[wrestler.roleTier ?? ""] ?? defaultStatBand;
}

function buildPercentileRanks(wrestlers: Wrestler[], stat: RatedStat) {
  const sorted = [...wrestlers].sort((a, b) => a[stat] - b[stat] || (b.draftRank ?? 999) - (a.draftRank ?? 999));
  const divisor = Math.max(1, sorted.length - 1);

  return new Map(sorted.map((wrestler, index) => [wrestler.id, index / divisor]));
}

function getDraftPercentile(wrestler: Wrestler, poolSize: number) {
  if (!wrestler.draftRank) {
    return 0.5;
  }

  return clampStat(1 - (wrestler.draftRank - 1) / Math.max(1, poolSize - 1));
}

function scoreFromBand([min, max]: [number, number], percentile: number, shape = 1.15) {
  const shapedPercentile = Math.pow(clampStat(percentile, 0, 1), shape);
  return Math.round(min + (max - min) * shapedPercentile);
}

function getArchetypeAdjustment(wrestler: Wrestler, stat: RatedStat) {
  const archetype = wrestler.archetype ?? "";

  if (stat === "ringSkill") {
    if (archetype === "Technician") return 5;
    if (archetype === "RingGeneral") return 3;
    if (archetype === "HighFlyer") return 3;
    if (archetype === "Brawler") return 1;
    if (archetype === "Showman") return -3;
    if (archetype === "Powerhouse") return -1;
  }

  if (stat === "promoSkill") {
    if (archetype === "Showman") return 5;
    if (archetype === "Brawler") return 1;
    if (archetype === "Powerhouse") return -2;
    if (archetype === "HighFlyer") return -3;
    if (archetype === "Technician") return -4;
  }

  if (stat === "popularity" && (archetype === "Showman" || archetype === "Powerhouse")) {
    return 1;
  }

  if (stat === "momentum" && archetype === "HighFlyer") {
    return 1;
  }

  return 0;
}

function calibrateRatedStat(wrestler: Wrestler, stat: RatedStat, percentileRanks: Record<RatedStat, Map<string, number>>, poolSize: number) {
  const band = getRoleTierBand(wrestler)[stat];
  const statPercentile = percentileRanks[stat].get(wrestler.id) ?? 0.5;
  const draftPercentile = getDraftPercentile(wrestler, poolSize);
  const percentile =
    stat === "popularity"
      ? statPercentile * 0.35 + draftPercentile * 0.65
      : stat === "momentum"
        ? statPercentile * 0.75 + draftPercentile * 0.25
        : stat === "morale"
          ? statPercentile * 0.85 + draftPercentile * 0.15
          : statPercentile * 0.65 + draftPercentile * 0.35;
  const shape = stat === "popularity" ? 1.75 : stat === "momentum" ? 1.25 : stat === "morale" ? 1.05 : 1.25;
  const adjusted = scoreFromBand(band, percentile, shape) + getArchetypeAdjustment(wrestler, stat);

  return clampStat(adjusted);
}

function applyMaddenLikeStatDistribution(wrestlers: Wrestler[]): Wrestler[] {
  const percentileRanks: Record<RatedStat, Map<string, number>> = {
    popularity: buildPercentileRanks(wrestlers, "popularity"),
    momentum: buildPercentileRanks(wrestlers, "momentum"),
    ringSkill: buildPercentileRanks(wrestlers, "ringSkill"),
    promoSkill: buildPercentileRanks(wrestlers, "promoSkill"),
    morale: buildPercentileRanks(wrestlers, "morale"),
    fatigue: buildPercentileRanks(wrestlers, "fatigue"),
  };

  return wrestlers.map((wrestler) => {
    const fatigue = calibrateRatedStat(wrestler, "fatigue", percentileRanks, wrestlers.length);

    return {
      ...wrestler,
      popularity: Math.min(94, calibrateRatedStat(wrestler, "popularity", percentileRanks, wrestlers.length)),
      momentum: Math.min(88, calibrateRatedStat(wrestler, "momentum", percentileRanks, wrestlers.length)),
      ringSkill: Math.min(92, calibrateRatedStat(wrestler, "ringSkill", percentileRanks, wrestlers.length)),
      promoSkill: Math.min(92, calibrateRatedStat(wrestler, "promoSkill", percentileRanks, wrestlers.length)),
      morale: Math.min(72, calibrateRatedStat(wrestler, "morale", percentileRanks, wrestlers.length)),
      fatigue,
    };
  });
}

export const top200DraftPool: Wrestler[] = applyMaddenLikeStatDistribution(applySourceBrandDraftCaps(top200RosterCandidates)).map((wrestler) => ({
  ...wrestler,
  matchRatings: ensureMatchRatings(wrestler),
}));
