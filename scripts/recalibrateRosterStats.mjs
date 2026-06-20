#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const defaultFullSource = "data/rosters/all_rosters_attributes_2026-05-16.csv";
const defaultPartialSource = "data/rosters/top_200_roster_attributes_2026-05-16.csv";
const currentGeneratedJson = "data/rosters/top_200_draft_pool.generated.json";
const financeCatalogPath = "data/finance/roster_draft_and_contract_values_top_200_no_bonus_full_season_2026-05-16.csv";
const outputDir = "data/rosters/recalibrated";
const activeTargetCount = 200;
const sourceBrandBalanceOrder = ["Raw", "SmackDown", "NXT", "AEW"];

const visibleStats = ["popularity", "momentum", "ringSkill", "promoSkill", "morale", "fatigue"];
const numericSourceFields = [
  "source_overall",
  "game_overall",
  "popularity_overall",
  "star_power",
  "draw_power",
  "merch_appeal",
  "social_buzz",
  "workrate",
  "psychology",
  "stamina",
  "consistency",
  "safety",
  "big_match_ability",
  "charisma",
  "mic_skill",
  "character_work",
  "crowd_connection",
  "segment_versatility",
  "fatigue",
  "durability",
  "injury_risk",
  "recovery_rate",
  "morale",
  "confidence",
  "locker_room_influence",
  "frustration",
  "singles_fit",
  "tag_fit",
  "promo_fit",
  "rivalry_fit",
  "opener_fit",
  "main_event_fit",
  "special_stipulation_fit",
];

const roleBands = {
  MainEvent: {
    popularity: [78, 94],
    momentum: [58, 76],
    ringSkill: [76, 92],
    promoSkill: [74, 92],
    morale: [48, 66],
    fatigue: [14, 40],
  },
  UpperCard: {
    popularity: [68, 88],
    momentum: [54, 72],
    ringSkill: [68, 88],
    promoSkill: [66, 88],
    morale: [48, 65],
    fatigue: [12, 38],
  },
  Midcard: {
    popularity: [55, 80],
    momentum: [48, 68],
    ringSkill: [58, 82],
    promoSkill: [56, 82],
    morale: [46, 63],
    fatigue: [10, 36],
  },
  Prospect: {
    popularity: [45, 70],
    momentum: [46, 64],
    ringSkill: [48, 78],
    promoSkill: [46, 78],
    morale: [46, 62],
    fatigue: [8, 32],
  },
  Enhancement: {
    popularity: [35, 65],
    momentum: [44, 60],
    ringSkill: [38, 70],
    promoSkill: [38, 70],
    morale: [44, 60],
    fatigue: [10, 34],
  },
};

const globalCaps = {
  popularity: 95,
  momentum: 84,
  ringSkill: 94,
  promoSkill: 94,
  morale: 70,
  fatigue: 52,
};

const globalFloors = {
  popularity: 30,
  momentum: 40,
  ringSkill: 34,
  promoSkill: 34,
  morale: 38,
  fatigue: 4,
};

const topPoolDistributionTargets = {
  popularity: [
    [95, 95, 7],
    [90, 94, 20],
    [85, 89, 25],
    [80, 84, 30],
    [75, 79, 32],
    [70, 74, 30],
    [65, 69, 24],
    [60, 64, 17],
    [55, 59, 10],
    [50, 54, 5],
  ],
  ringSkill: [
    [90, 94, 25],
    [85, 89, 32],
    [80, 84, 34],
    [75, 79, 34],
    [70, 74, 30],
    [65, 69, 24],
    [60, 64, 14],
    [55, 59, 7],
  ],
  promoSkill: [
    [90, 94, 18],
    [85, 89, 27],
    [80, 84, 32],
    [75, 79, 34],
    [70, 74, 31],
    [65, 69, 24],
    [60, 64, 18],
    [55, 59, 11],
    [50, 54, 5],
  ],
  momentum: [
    [80, 82, 4],
    [75, 79, 18],
    [70, 74, 28],
    [65, 69, 34],
    [60, 64, 42],
    [55, 59, 36],
    [50, 54, 25],
    [45, 49, 13],
  ],
  morale: [
    [65, 70, 10],
    [60, 64, 40],
    [55, 59, 65],
    [50, 54, 65],
    [48, 49, 20],
  ],
  fatigue: [
    [39, 52, 2],
    [31, 38, 8],
    [24, 30, 20],
    [19, 23, 35],
    [14, 18, 45],
    [9, 13, 50],
    [4, 8, 40],
  ],
};

const topPoolPopularityTargetsByBrand = {
  AEW: [
    [95, 95, 1],
    [90, 94, 4],
    [85, 89, 7],
    [80, 84, 10],
    [75, 79, 11],
    [70, 74, 9],
    [65, 69, 5],
    [60, 64, 3],
    [55, 59, 1],
  ],
  NXT: [
    [90, 94, 1],
    [85, 89, 5],
    [80, 84, 13],
    [75, 79, 13],
    [70, 74, 9],
    [65, 69, 6],
    [60, 64, 3],
    [55, 59, 1],
  ],
  Raw: [
    [95, 95, 3],
    [90, 94, 7],
    [85, 89, 8],
    [80, 84, 7],
    [75, 79, 7],
    [70, 74, 6],
    [65, 69, 5],
    [60, 64, 3],
    [55, 59, 3],
    [50, 54, 1],
  ],
  SmackDown: [
    [95, 95, 3],
    [90, 94, 8],
    [85, 89, 7],
    [80, 84, 7],
    [75, 79, 4],
    [70, 74, 3],
    [65, 69, 4],
    [60, 64, 5],
    [55, 59, 3],
    [50, 54, 4],
  ],
};

function parseArgs(argv) {
  const args = {
    input: undefined,
    allowPartial: false,
    writeActive: false,
    outDir: outputDir,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      args.input = argv[index + 1];
      index += 1;
    } else if (arg === "--allow-partial") {
      args.allowPartial = true;
    } else if (arg === "--write-active") {
      args.writeActive = true;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run roster:recalibrate
  npm run roster:recalibrate:partial

Options:
  --input <path>       CSV input. Defaults to ${defaultFullSource}
  --allow-partial     Allow non-336-row inputs for dry-run reports.
  --write-active      Also replace active roster artifacts. Requires full source.
  --out-dir <path>    Output directory. Defaults to ${outputDir}
`);
}

function resolvePath(filePath) {
  return path.resolve(repoRoot, filePath);
}

function readCsv(filePath) {
  const text = fs.readFileSync(resolvePath(filePath), "utf8");
  const rows = parseCsv(text);
  const [headers, ...records] = rows;
  return records
    .filter((record) => record.some((value) => value.trim() !== ""))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function writeCsv(filePath, rows) {
  const text = rows.map((row) => row.map(formatCsvCell).join(",")).join("\n") + "\n";
  fs.writeFileSync(resolvePath(filePath), text);
}

function formatCsvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toNumber(value, fallback = 50) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function weightedAverage(row, weights) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return entries.reduce((sum, [field, weight]) => sum + toNumber(row[field]) * weight, 0) / totalWeight;
}

function hasChampionship(row) {
  return Boolean((row.championships ?? "").trim());
}

function scorePopularity(row) {
  return weightedAverage(row, {
    popularity_overall: 0.24,
    star_power: 0.23,
    draw_power: 0.2,
    merch_appeal: 0.14,
    social_buzz: 0.11,
    game_overall: 0.08,
  });
}

function scoreRingSkill(row) {
  return weightedAverage(row, {
    workrate: 0.25,
    psychology: 0.18,
    stamina: 0.14,
    consistency: 0.14,
    safety: 0.1,
    big_match_ability: 0.19,
  });
}

function scorePromoSkill(row) {
  return weightedAverage(row, {
    charisma: 0.24,
    mic_skill: 0.24,
    character_work: 0.2,
    crowd_connection: 0.2,
    segment_versatility: 0.12,
  });
}

function scoreMomentum(row) {
  const championshipBoost = hasChampionship(row) ? 5 : 0;
  return weightedAverage(row, {
    confidence: 0.24,
    social_buzz: 0.18,
    star_power: 0.14,
    big_match_ability: 0.12,
    crowd_connection: 0.1,
    game_overall: 0.1,
    morale: 0.08,
    main_event_fit: 0.04,
  }) + championshipBoost;
}

function scoreMorale(row) {
  return weightedAverage(row, {
    morale: 0.38,
    confidence: 0.24,
    locker_room_influence: 0.16,
    recovery_rate: 0.1,
    frustration: -0.12,
  });
}

function scoreFatigue(row) {
  const inactivePenalty = (row.availability ?? "").toLowerCase().includes("inactive") ? 8 : 0;
  return weightedAverage(row, {
    fatigue: 0.42,
    injury_risk: 0.24,
    durability: -0.16,
    recovery_rate: -0.12,
    stamina: -0.06,
  }) + 28 + inactivePenalty;
}

const sourceScorers = {
  popularity: scorePopularity,
  momentum: scoreMomentum,
  ringSkill: scoreRingSkill,
  promoSkill: scorePromoSkill,
  morale: scoreMorale,
  fatigue: scoreFatigue,
};

function percentileMaps(rows, rawScoresById) {
  const maps = {};
  visibleStats.forEach((stat) => {
    const sorted = [...rows].sort((left, right) => rawScoresById.get(left.id)[stat] - rawScoresById.get(right.id)[stat] || getRank(right) - getRank(left));
    const divisor = Math.max(1, sorted.length - 1);
    maps[stat] = new Map(sorted.map((row, index) => [row.id, index / divisor]));
  });
  return maps;
}

function getRank(row) {
  return toNumber(row.top_200_rank || row.draft_rank, 999);
}

function getRoleTierSelectionBonus(roleTier) {
  if (roleTier === "MainEvent") return 3;
  if (roleTier === "UpperCard") return 1.5;
  if (roleTier === "Prospect") return -1;
  if (roleTier === "Enhancement") return -2;
  return 0;
}

function getAvailabilitySelectionBonus(availability) {
  const normalized = String(availability ?? "").toLowerCase();
  if (normalized.includes("inactive") || normalized.includes("unavailable")) return -4;
  return normalized.includes("active") ? 1 : 0;
}

function getSelectionScore(row) {
  if (row.top_200_selection_score !== undefined && row.top_200_selection_score !== "") {
    return toNumber(row.top_200_selection_score);
  }

  return (
    toNumber(row.game_overall) * 0.45 +
    toNumber(row.star_power) * 0.2 +
    toNumber(row.popularity_overall) * 0.15 +
    toNumber(row.draw_power) * 0.1 +
    toNumber(row.big_match_ability) * 0.05 +
    getRoleTierSelectionBonus(row.role_tier) +
    (hasChampionship(row) ? 1.5 : 0) +
    getAvailabilitySelectionBonus(row.availability)
  );
}

function isGameEligible(row) {
  return (row.game_eligible || "Yes").toLowerCase() === "yes";
}

function sortBySelectionScore(rows) {
  return [...rows].sort((left, right) => getSelectionScore(right) - getSelectionScore(left) || String(left.performer_name).localeCompare(String(right.performer_name)));
}

function getBalancedBrandQuotas(rows, targetCount) {
  const grouped = new Map();
  rows.forEach((row) => {
    const brand = row.source_brand || row.brand || "Unknown";
    grouped.set(brand, [...(grouped.get(brand) ?? []), row]);
  });

  const brands = sourceBrandBalanceOrder.filter((brand) => grouped.has(brand));
  const baseTarget = Math.floor(targetCount / Math.max(1, brands.length));
  const quotas = new Map(brands.map((brand) => [brand, Math.min(baseTarget, grouped.get(brand)?.length ?? 0)]));
  let remaining = targetCount - [...quotas.values()].reduce((sum, count) => sum + count, 0);

  while (remaining > 0) {
    const candidate = brands
      .filter((brand) => (quotas.get(brand) ?? 0) < (grouped.get(brand)?.length ?? 0))
      .sort((left, right) => (quotas.get(left) ?? 0) - (quotas.get(right) ?? 0) || sourceBrandBalanceOrder.indexOf(left) - sourceBrandBalanceOrder.indexOf(right))[0];

    if (!candidate) {
      break;
    }

    quotas.set(candidate, (quotas.get(candidate) ?? 0) + 1);
    remaining -= 1;
  }

  return quotas;
}

function getBand(row, stat) {
  return (roleBands[row.role_tier] ?? roleBands.Midcard)[stat];
}

function archetypeAdjustment(row, stat) {
  const archetype = row.archetype ?? "";
  if (stat === "ringSkill") {
    if (archetype === "Technician") return 4;
    if (archetype === "RingGeneral") return 3;
    if (archetype === "HighFlyer") return 2;
    if (archetype === "Brawler") return 1;
    if (archetype === "Showman") return -2;
    if (archetype === "Powerhouse") return -1;
  }
  if (stat === "promoSkill") {
    if (archetype === "Showman") return 4;
    if (archetype === "Brawler") return 1;
    if (archetype === "Technician") return -3;
    if (archetype === "HighFlyer") return -2;
    if (archetype === "Powerhouse") return -1;
  }
  if (stat === "momentum" && archetype === "HighFlyer") return 1;
  if (stat === "popularity" && (archetype === "Showman" || archetype === "Powerhouse")) return 1;
  return 0;
}

function calibrateStat(row, stat, percentile, rawScore) {
  const [min, max] = getBand(row, stat);
  const shape = stat === "popularity" ? 1.1 : stat === "momentum" ? 1.45 : stat === "morale" ? 1.2 : stat === "fatigue" ? 1.25 : 1.15;
  const base = min + (max - min) * Math.pow(clamp(percentile, 0, 1), shape);
  const breakout = rawScore > 92 ? (rawScore - 92) * 0.28 : rawScore < 35 ? (rawScore - 35) * 0.18 : 0;
  const championshipMomentum = stat === "momentum" && hasChampionship(row) ? 2 : 0;
  const value = Math.round(base + breakout + championshipMomentum + archetypeAdjustment(row, stat));
  return clamp(value, globalFloors[stat], globalCaps[stat]);
}

function buildTargetValues(stat, targets = topPoolDistributionTargets[stat]) {
  return targets.flatMap(([min, max, count]) => {
    if (count <= 1 || min === max) {
      return Array.from({ length: count }, () => max);
    }

    return Array.from({ length: count }, (_, index) => {
      const ratio = index / (count - 1);
      return Math.round(max - (max - min) * ratio);
    });
  });
}

function sortRowsForStatRemap(rows, stat) {
  return [...rows].sort(
    (left, right) =>
      Number(right[stat]) - Number(left[stat]) ||
      getSelectionScore(right) - getSelectionScore(left) ||
      String(left.performer_name).localeCompare(String(right.performer_name)),
  );
}

function remapPopularityByBrand(rows) {
  const valueById = new Map();

  sourceBrandBalanceOrder.forEach((brand) => {
    const brandRows = sortRowsForStatRemap(
      rows.filter((row) => (row.source_brand || row.brand) === brand),
      "popularity",
    );
    const targetValues = buildTargetValues("popularity", topPoolPopularityTargetsByBrand[brand] ?? topPoolDistributionTargets.popularity);

    brandRows.forEach((row, index) => {
      valueById.set(row.id, clamp(targetValues[index] ?? targetValues[targetValues.length - 1], globalFloors.popularity, globalCaps.popularity));
    });
  });

  return rows.map((row) => ({
    ...row,
    popularity: valueById.get(row.id) ?? row.popularity,
  }));
}

function remapTopPoolStats(rows) {
  let remappedRows = rows.map((row) => ({ ...row }));

  visibleStats.forEach((stat) => {
    if (stat === "popularity") {
      remappedRows = remapPopularityByBrand(remappedRows);
      return;
    }

    const targetValues = buildTargetValues(stat);
    const rankedRows = sortRowsForStatRemap(remappedRows, stat);
    const valueById = new Map(
      rankedRows.map((row, index) => [
        row.id,
        clamp(targetValues[index] ?? targetValues[targetValues.length - 1], globalFloors[stat], globalCaps[stat]),
      ]),
    );

    remappedRows = remappedRows.map((row) => ({
      ...row,
      [stat]: valueById.get(row.id) ?? row[stat],
    }));
  });

  return remappedRows;
}

function recalibrateRows(rows) {
  const normalizedRows = rows.map(normalizeSourceRow);
  const rawScoresById = new Map(
    normalizedRows.map((row) => [
      row.id,
      Object.fromEntries(visibleStats.map((stat) => [stat, sourceScorers[stat](row)])),
    ]),
  );
  const percentiles = percentileMaps(normalizedRows, rawScoresById);

  return normalizedRows.map((row) => {
    const rawScores = rawScoresById.get(row.id);
    const calibrated = Object.fromEntries(
      visibleStats.map((stat) => [stat, calibrateStat(row, stat, percentiles[stat].get(row.id) ?? 0.5, rawScores[stat])]),
    );
    return {
      ...row,
      ...calibrated,
      recalibration_model: "initial_stats_recalibration_v1",
    };
  });
}

function normalizeSourceRow(row) {
  const normalized = { ...row };
  normalized.id = row.id || row.wrestler_id;
  normalized.performer_name = row.performer_name || row.name || "";
  normalized.brand = row.brand || row.source_brand || "";
  normalized.source_brand = row.source_brand || row.brand || "";
  normalized.division = row.division || row.gender_division || "";
  normalized.role_tier = row.role_tier || "Midcard";
  normalized.availability = row.availability || row.sourceAvailability || "Active";
  numericSourceFields.forEach((field) => {
    if (normalized[field] === undefined || normalized[field] === "") {
      normalized[field] = "50";
    }
  });
  return normalized;
}

function selectTop200(rows) {
  const eligibleRows = rows.filter(isGameEligible);
  const quotas = getBalancedBrandQuotas(eligibleRows, activeTargetCount);
  const balancedRows = [...quotas.entries()].flatMap(([brand, quota]) =>
    sortBySelectionScore(eligibleRows.filter((row) => (row.source_brand || row.brand) === brand)).slice(0, quota),
  );

  const rankedRows = sortBySelectionScore(balancedRows)
    .slice(0, activeTargetCount)
    .map((row, index) => ({
      ...row,
      top_200_rank: String(index + 1),
      top_200_selection_score: Number(getSelectionScore(row).toFixed(2)),
      draftRank: index + 1,
    }));

  return remapTopPoolStats(rankedRows);
}

function selectActivePool(topRows) {
  return topRows
    .filter(isGameEligible)
    .slice(0, activeTargetCount)
    .map((row, index) => ({ ...row, draftRank: index + 1 }));
}

function toGameId(sourceId) {
  return String(sourceId).replaceAll("_", "-");
}

function toWrestler(row) {
  return {
    id: toGameId(row.id),
    name: row.performer_name,
    statCalibrationVersion: "initial_stats_recalibration_v1",
    draftRank: Number(row.draftRank ?? row.top_200_rank),
    sourceBrand: row.source_brand || row.brand,
    sourceAvailability: row.availability,
    roleTier: row.role_tier,
    alignment: row.alignment || "Unknown",
    archetype: row.archetype || "Showman",
    division: row.division || row.gender_division,
    popularity: Number(row.popularity),
    momentum: Number(row.momentum),
    fatigue: Number(row.fatigue),
    morale: Number(row.morale),
    ringSkill: Number(row.ringSkill),
    promoSkill: Number(row.promoSkill),
    appearancesThisSeason: 0,
    lastBookedWeek: 0,
    consecutiveWeeksBooked: 0,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
  };
}

function writeOutputs(rows, previousRows, args, sourcePath) {
  fs.mkdirSync(resolvePath(args.outDir), { recursive: true });
  const topRows = selectTop200(rows);
  const activeRows = selectActivePool(topRows);
  const allPath = path.join(args.outDir, "all_rosters_recalibrated_2026-05-16.csv");
  const topPath = path.join(args.outDir, "top_200_roster_attributes_recalibrated_2026-05-16.csv");
  const activeCsvPath = path.join(args.outDir, "active_draft_pool_recalibrated_2026-05-16.csv");
  const activeJsonPath = path.join(args.outDir, "top_200_draft_pool.recalibrated.generated.json");
  const reportPath = path.join(args.outDir, "initial_stats_recalibration_report.md");

  writeCsv(allPath, toCsvRows(rows));
  writeCsv(topPath, toCsvRows(topRows));
  writeCsv(activeCsvPath, [["draft_rank", "id", "name", "brand", "division", "role_tier"], ...activeRows.map((row) => [row.draftRank, toGameId(row.id), row.performer_name, row.source_brand || row.brand, row.division, row.role_tier])]);
  fs.writeFileSync(resolvePath(activeJsonPath), JSON.stringify(activeRows.map(toWrestler), null, 2) + "\n");
  fs.writeFileSync(resolvePath(reportPath), buildReport({ rows, topRows, activeRows, previousRows, sourcePath, args }));

  if (args.writeActive) {
    fs.copyFileSync(resolvePath(topPath), resolvePath(defaultPartialSource));
    fs.copyFileSync(resolvePath(activeCsvPath), resolvePath("data/rosters/active_draft_pool_2026-05-16.csv"));
    fs.copyFileSync(resolvePath(activeJsonPath), resolvePath(currentGeneratedJson));
  }

  return { allPath, topPath, activeCsvPath, activeJsonPath, reportPath };
}

function toCsvRows(rows) {
  const originalHeaders = Object.keys(rows[0] ?? {});
  const preferred = [...originalHeaders.filter((header) => !visibleStats.includes(header)), ...visibleStats, "recalibration_model"];
  const headers = [...new Set(preferred)];
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

function loadPreviousRows() {
  try {
    const existing = JSON.parse(fs.readFileSync(resolvePath(currentGeneratedJson), "utf8"));
    return Array.isArray(existing) ? existing : [];
  } catch {
    return [];
  }
}

function buildReport({ rows, topRows, activeRows, previousRows, sourcePath, args }) {
  const currentJsonCount = previousRows.length;
  const report = [];
  report.push("# Initial Stats Recalibration Report");
  report.push("");
  report.push(`Source: \`${sourcePath}\``);
  report.push(`Mode: ${args.allowPartial ? "partial dry run" : "full source"}`);
  report.push(`Rows recalibrated: ${rows.length}`);
  report.push(`Derived Top 200 rows: ${topRows.length}`);
  report.push(`Derived active rows: ${activeRows.length}`);
  report.push(`Current active generated JSON rows before replacement: ${currentJsonCount}`);
  report.push("");
  report.push("## Validation");
  report.push("");
  report.push(`- Full source row target met: ${rows.length === 336 ? "yes" : `no (${rows.length}/336)`}`);
  report.push(`- Current active JSON count target met before replacement: ${currentJsonCount === activeTargetCount ? "yes" : `no (${currentJsonCount}/${activeTargetCount})`}`);
  report.push(`- Active pool target met: ${activeRows.length === activeTargetCount ? "yes" : `no (${activeRows.length}/${activeTargetCount})`}`);
  report.push(`- Unique active IDs: ${new Set(activeRows.map((row) => toGameId(row.id))).size}/${activeRows.length}`);
  report.push("");
  report.push("## All Source Distribution");
  report.push("");
  report.push(distributionTable(rows));
  report.push("");
  report.push("## Top 200 Distribution");
  report.push("");
  report.push(distributionTable(topRows));
  report.push("");
  report.push("## Active Pool Distribution");
  report.push("");
  report.push(distributionTable(activeRows));
  report.push("");
  report.push("## Top-End Counts");
  report.push("");
  report.push(thresholdTable(rows, "All source"));
  report.push("");
  report.push(thresholdTable(topRows, "Top 200"));
  report.push("");
  report.push(thresholdTable(activeRows, "Active"));
  report.push("");
  report.push("## Biggest Active Movers From Current JSON");
  report.push("");
  report.push(moverTable(activeRows, previousRows));
  report.push("");
  report.push("## Source Brand Counts");
  report.push("");
  report.push(countTable(activeRows, (row) => row.source_brand || row.brand, "Source brand"));
  report.push("");
  report.push("## Division Counts");
  report.push("");
  report.push(countTable(activeRows, (row) => row.division || row.gender_division, "Division"));
  report.push("");
  report.push("## Pending Finance Mappings");
  report.push("");
  report.push(financeGapTable(activeRows));
  report.push("");
  return report.join("\n");
}

function distributionTable(rows) {
  const lines = ["| Stat | Min | Median | Max | Average |", "| --- | ---: | ---: | ---: | ---: |"];
  visibleStats.forEach((stat) => {
    const values = rows.map((row) => Number(row[stat])).filter(Number.isFinite).sort((a, b) => a - b);
    lines.push(`| ${stat} | ${values[0] ?? 0} | ${median(values)} | ${values[values.length - 1] ?? 0} | ${average(values)} |`);
  });
  return lines.join("\n");
}

function thresholdTable(rows, label) {
  const lines = [`### ${label}`, "", "| Stat | >=85 | >=90 | >92 | >=95 |", "| --- | ---: | ---: | ---: | ---: |"];
  visibleStats.forEach((stat) => {
    const values = rows.map((row) => Number(row[stat])).filter(Number.isFinite);
    lines.push(`| ${stat} | ${values.filter((value) => value >= 85).length} | ${values.filter((value) => value >= 90).length} | ${values.filter((value) => value > 92).length} | ${values.filter((value) => value >= 95).length} |`);
  });
  return lines.join("\n");
}

function moverTable(activeRows, previousRows) {
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  const movers = activeRows.flatMap((row) => {
    const previous = previousById.get(toGameId(row.id));
    if (!previous) return [];
    return visibleStats.map((stat) => ({
      name: row.performer_name,
      stat,
      before: previous[stat],
      after: row[stat],
      delta: Number(row[stat]) - Number(previous[stat]),
    }));
  }).sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta)).slice(0, 25);

  if (!movers.length) {
    return "No current generated JSON rows matched the recalibrated active IDs.";
  }

  const lines = ["| Wrestler | Stat | Before | After | Delta |", "| --- | --- | ---: | ---: | ---: |"];
  movers.forEach((mover) => {
    lines.push(`| ${mover.name} | ${mover.stat} | ${mover.before} | ${mover.after} | ${mover.delta > 0 ? "+" : ""}${mover.delta} |`);
  });
  return lines.join("\n");
}

function countTable(rows, getKey, label) {
  const counts = new Map();
  rows.forEach((row) => counts.set(getKey(row) || "Unknown", (counts.get(getKey(row) || "Unknown") ?? 0) + 1));
  const lines = [`| ${label} | Count |`, "| --- | ---: |"];
  [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).forEach(([key, count]) => {
    lines.push(`| ${key} | ${count} |`);
  });
  return lines.join("\n");
}

function financeGapTable(activeRows) {
  if (!fs.existsSync(resolvePath(financeCatalogPath))) {
    return `Finance catalog not found: \`${financeCatalogPath}\``;
  }

  const financeRows = readCsv(financeCatalogPath);
  const financeIds = new Set(financeRows.map((row) => toGameId(row.wrestler_id ?? "")));
  const missing = activeRows.filter((row) => !financeIds.has(toGameId(row.id)));

  if (!missing.length) {
    return "All active draft rows have finance mappings.";
  }

  const lines = [
    `${missing.length} active draft performers need finance mappings before money-based drafting is fully balanced.`,
    "",
    "| Draft Rank | Wrestler | Source Brand | Role Tier |",
    "| ---: | --- | --- | --- |",
  ];
  missing.forEach((row) => {
    lines.push(`| ${row.draftRank ?? row.top_200_rank} | ${row.performer_name} | ${row.source_brand || row.brand} | ${row.role_tier} |`);
  });
  return lines.join("\n");
}

function median(values) {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = args.input ?? defaultFullSource;
  const sourceExists = fs.existsSync(resolvePath(sourcePath));

  if (!sourceExists) {
    if (!args.allowPartial) {
      throw new Error(`Missing full roster source: ${sourcePath}. Restore the 336-row source CSV or run with --allow-partial --input ${defaultPartialSource} for a dry-run report.`);
    }
    if (!args.input) {
      throw new Error(`--allow-partial requires --input so partial runs are explicit.`);
    }
  }

  const rows = readCsv(sourcePath);
  if (rows.length !== 336 && !args.allowPartial) {
    throw new Error(`Expected 336 source rows in ${sourcePath}; found ${rows.length}. Use --allow-partial only for dry-run reports.`);
  }
  if (args.writeActive && (args.allowPartial || rows.length !== 336)) {
    throw new Error("--write-active requires the full 336-row source input.");
  }

  const recalibrated = recalibrateRows(rows);
  const outputs = writeOutputs(recalibrated, loadPreviousRows(), args, sourcePath);
  console.log("Recalibration outputs written:");
  Object.values(outputs).forEach((filePath) => console.log(`- ${filePath}`));
  if (!args.writeActive) {
    console.log("Active roster artifacts were not replaced. Re-run with --write-active after reviewing the report and using the full source input.");
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
