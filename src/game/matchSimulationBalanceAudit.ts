import { calculateEffectiveMatchPower, ensureMatchRatings, matchRatingKeys, type MatchRatingKey } from "./matchRatings";
import {
  getMatchSimulationLabRoster,
  matchSimulationLabStipulationIds,
  runMatchSimulationLab,
  type MatchSimulationLabResult,
  type MatchSimulationLabStructure,
} from "./matchSimulationLab";
import { createNewGame, draftPool } from "./seed";
import { runShow } from "./scoring";
import type { GameState, MatchRatings, MatchRatingsProgressionMode, Segment, Wrestler } from "./types";

export type MatchSimulationBalanceAuditCategory = "singles" | "stipulation" | "tag" | "multi" | "progression";

export type MatchSimulationBalanceAuditInput = {
  game?: GameState;
  scenarioSet?: "all" | MatchSimulationBalanceAuditCategory[];
  iterationsPerScenario?: number;
  baseSeed?: string;
  progression?: MatchRatingsProgressionMode;
  includeProgressionSeason?: boolean;
  progressionWeeks?: number;
  rosterFilter?: (wrestler: Wrestler) => boolean;
};

export type MatchSimulationBalanceAuditWarning = {
  code:
    | "favoriteUnderperforms"
    | "favoriteWinsTooOften"
    | "moderateUnderdogUpsetsTooLow"
    | "probabilityDeltaHigh"
    | "stipulationSensitivityLow"
    | "fallTakerTooConcentrated"
    | "protectedParticipantMissing"
    | "unexpectedFallback"
    | "progressionInflation"
    | "progressionDeflation"
    | "ratingClampPressure"
    | "topRatingsApproachCap"
    | "fallTakerRegressionHeavy"
    | "protectedLoserPenaltyTooCloseToFallTaker";
  severity: "info" | "warning";
  scenarioId?: string;
  message: string;
};

export type MatchSimulationBalanceAuditScenario = {
  id: string;
  category: Exclude<MatchSimulationBalanceAuditCategory, "progression">;
  label: string;
  description: string;
  matchStructure: MatchSimulationLabStructure;
  participantIds: string[];
  stipulationId?: string;
  comparisonGroupId?: string;
};

export type MatchSimulationBalanceScenarioMetrics = {
  fallbackRate: number;
  favoriteId?: string;
  favoriteLabel?: string;
  favoriteExpectedWinRate?: number;
  favoriteActualWinRate?: number;
  favoritePowerAdvantage?: number;
  underdogWinRate?: number;
  upsetRate: number;
  maxExpectedVsActualDelta: number;
  winnerConcentration: number;
  averageEffectivePower: number;
  fallTakerConcentration?: number;
  protectedParticipantCoverage?: number;
};

export type MatchSimulationBalanceScenarioResult = {
  scenario: MatchSimulationBalanceAuditScenario;
  lab: MatchSimulationLabResult;
  metrics: MatchSimulationBalanceScenarioMetrics;
  warnings: MatchSimulationBalanceAuditWarning[];
};

export type MatchSimulationProgressionCheckpoint = {
  week: number;
  averageRating: number;
  averageDelta: number;
  maxIncrease: number;
  maxDecrease: number;
  ratingsAtZero: number;
  ratingsAtHundred: number;
  ratingsAtOrAboveNinetyNine: number;
  lowRatedImprovedCount: number;
};

export type MatchSimulationProgressionAuditResult = {
  enabled: boolean;
  weeks: number;
  startingAverageRating: number;
  endingAverageRating: number;
  averageDelta: number;
  maxIncrease: number;
  maxDecrease: number;
  ratingsAtZero: number;
  ratingsAtHundred: number;
  ratingsAtOrAboveNinetyNine: number;
  lowRatedImprovedCount: number;
  fallTakerAverageDelta?: number;
  protectedLoserAverageDelta?: number;
  sourceGameMutated: boolean;
  checkpoints: MatchSimulationProgressionCheckpoint[];
  warnings: MatchSimulationBalanceAuditWarning[];
};

export type MatchSimulationBalanceAuditResult = {
  input: {
    iterationsPerScenario: number;
    baseSeed: string;
    progression: MatchRatingsProgressionMode;
    includeProgressionSeason: boolean;
    progressionWeeks: number;
    scenarioSet: MatchSimulationBalanceAuditCategory[];
  };
  scenarioMatrix: MatchSimulationBalanceAuditScenario[];
  scenarioResults: MatchSimulationBalanceScenarioResult[];
  progression?: MatchSimulationProgressionAuditResult;
  warnings: MatchSimulationBalanceAuditWarning[];
  summary: {
    scenarioCount: number;
    warningCount: number;
    unexpectedFallbackScenarios: number;
    maxProbabilityDelta: number;
    averageFavoriteWinRate: number;
    progressionAverageDelta?: number;
  };
};

type AuditWrestlerSpec = {
  id: string;
  name: string;
  popularity: number;
  momentum: number;
  morale?: number;
  fatigue?: number;
  ringSkill: number;
  promoSkill: number;
  roleTier?: string;
  archetype?: string;
  wrestlingStyle?: string;
  matchRatings: MatchRatings;
};

const DEFAULT_ITERATIONS_PER_SCENARIO = 250;
const MAX_ITERATIONS_PER_SCENARIO = 5000;
const DEFAULT_BASE_SEED = "balance-v8";
const DEFAULT_PROGRESSION_WEEKS = 50;
const PROBABILITY_DELTA_WARNING_THRESHOLD = 0.08;
const LARGE_FAVORITE_EXPECTED_THRESHOLD = 0.72;
const MODERATE_FAVORITE_EXPECTED_THRESHOLD = 0.58;
const FAVORITE_OVERDETERMINISTIC_THRESHOLD = 0.97;
const MODERATE_UNDERDOG_MIN_UPSET_RATE = 0.15;
const STIPULATION_SENSITIVITY_THRESHOLD = 0.03;
const FALL_TAKER_CONCENTRATION_THRESHOLD = 0.78;
const PROTECTED_PARTICIPANT_MIN_COVERAGE = 0.85;
const PROGRESSION_INFLATION_THRESHOLD_BY_WEEK = 0.08;
const PROGRESSION_DEFLATION_THRESHOLD_BY_WEEK = -0.08;
const PROGRESSION_MAX_MOVE_THRESHOLD = 14;

function explicitRatings(overrides: Partial<MatchRatings> = {}): MatchRatings {
  return {
    technical: 60,
    submission: 60,
    power: 60,
    aerial: 60,
    brawling: 60,
    hardcore: 60,
    stamina: 60,
    resilience: 60,
    psychology: 60,
    selling: 60,
    timing: 60,
    explosiveness: 60,
    clutch: 60,
    ...overrides,
  };
}

function round(value: number, precision = 4) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function clampCount(value: number | undefined, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.round(value)));
}

function cloneGame(game: GameState): GameState {
  return typeof structuredClone === "function" ? structuredClone(game) : JSON.parse(JSON.stringify(game));
}

function createAuditWrestler(source: Wrestler, spec: AuditWrestlerSpec): Wrestler {
  return {
    ...source,
    id: spec.id,
    name: spec.name,
    popularity: spec.popularity,
    momentum: spec.momentum,
    morale: spec.morale ?? 70,
    fatigue: spec.fatigue ?? 12,
    ringSkill: spec.ringSkill,
    promoSkill: spec.promoSkill,
    roleTier: spec.roleTier ?? "MidCard",
    archetype: spec.archetype,
    wrestlingStyle: spec.wrestlingStyle,
    division: "Mens",
    injuryStatus: "healthy",
    injuryDescription: undefined,
    injuryWeeksRemaining: 0,
    matchRatings: spec.matchRatings,
  };
}

function buildAuditRoster(rosterFilter?: (wrestler: Wrestler) => boolean) {
  const basePool = draftPool.filter((wrestler) => wrestler.division === "Mens");
  const sourcePool = rosterFilter ? basePool.filter(rosterFilter) : basePool;
  const fallbackPool = sourcePool.length >= 14 ? sourcePool : basePool;
  const specs: AuditWrestlerSpec[] = [
    {
      id: "audit-balanced-a",
      name: "Audit Balanced A",
      popularity: 70,
      momentum: 68,
      ringSkill: 70,
      promoSkill: 62,
      matchRatings: explicitRatings({ technical: 70, stamina: 70, resilience: 70, timing: 69, clutch: 68 }),
    },
    {
      id: "audit-balanced-b",
      name: "Audit Balanced B",
      popularity: 69,
      momentum: 67,
      ringSkill: 69,
      promoSkill: 61,
      matchRatings: explicitRatings({ technical: 68, stamina: 69, resilience: 68, timing: 68, clutch: 67 }),
    },
    {
      id: "audit-favorite",
      name: "Audit Favorite",
      popularity: 86,
      momentum: 84,
      ringSkill: 84,
      promoSkill: 76,
      roleTier: "MainEvent",
      matchRatings: explicitRatings({ technical: 83, power: 84, stamina: 84, resilience: 85, psychology: 82, timing: 84, clutch: 86 }),
    },
    {
      id: "audit-underdog",
      name: "Audit Underdog",
      popularity: 58,
      momentum: 54,
      ringSkill: 58,
      promoSkill: 54,
      roleTier: "MidCard",
      matchRatings: explicitRatings({ technical: 58, power: 55, stamina: 58, resilience: 57, timing: 56, clutch: 54 }),
    },
    {
      id: "audit-jobber",
      name: "Audit Prospect",
      popularity: 36,
      momentum: 32,
      morale: 58,
      ringSkill: 42,
      promoSkill: 38,
      roleTier: "Enhancement",
      matchRatings: explicitRatings({ technical: 38, submission: 36, power: 40, aerial: 36, brawling: 39, stamina: 37, resilience: 35, timing: 36, clutch: 34 }),
    },
    {
      id: "audit-popularity-heavy",
      name: "Audit Popularity Star",
      popularity: 92,
      momentum: 78,
      ringSkill: 58,
      promoSkill: 86,
      roleTier: "MainEvent",
      archetype: "showman",
      matchRatings: explicitRatings({ technical: 56, power: 58, stamina: 60, resilience: 65, psychology: 84, selling: 76, timing: 66, clutch: 86 }),
    },
    {
      id: "audit-skill-heavy",
      name: "Audit Skill Ace",
      popularity: 58,
      momentum: 64,
      ringSkill: 88,
      promoSkill: 54,
      roleTier: "UpperCard",
      archetype: "technician",
      matchRatings: explicitRatings({ technical: 88, submission: 84, stamina: 82, resilience: 78, psychology: 76, timing: 86, clutch: 68 }),
    },
    {
      id: "audit-stamina-high",
      name: "Audit Iron Lungs",
      popularity: 66,
      momentum: 66,
      ringSkill: 68,
      promoSkill: 58,
      matchRatings: explicitRatings({ stamina: 92, resilience: 88, timing: 72, technical: 70, clutch: 67 }),
    },
    {
      id: "audit-stamina-low",
      name: "Audit Short Fuse",
      popularity: 66,
      momentum: 66,
      ringSkill: 68,
      promoSkill: 58,
      fatigue: 18,
      matchRatings: explicitRatings({ stamina: 34, resilience: 42, explosiveness: 75, power: 72, timing: 64, clutch: 66 }),
    },
    {
      id: "audit-momentum-high",
      name: "Audit Hot Hand",
      popularity: 66,
      momentum: 92,
      ringSkill: 66,
      promoSkill: 58,
      matchRatings: explicitRatings({ technical: 66, stamina: 66, resilience: 66, timing: 66, clutch: 66 }),
    },
    {
      id: "audit-momentum-low",
      name: "Audit Cold Hand",
      popularity: 66,
      momentum: 28,
      morale: 54,
      ringSkill: 66,
      promoSkill: 58,
      matchRatings: explicitRatings({ technical: 66, stamina: 66, resilience: 66, timing: 66, clutch: 66 }),
    },
    {
      id: "audit-tired-favorite",
      name: "Audit Tired Favorite",
      popularity: 82,
      momentum: 80,
      fatigue: 88,
      ringSkill: 82,
      promoSkill: 70,
      roleTier: "MainEvent",
      matchRatings: explicitRatings({ technical: 82, power: 82, stamina: 82, resilience: 82, psychology: 80, timing: 82, clutch: 84 }),
    },
    {
      id: "audit-fresh-underdog",
      name: "Audit Fresh Underdog",
      popularity: 63,
      momentum: 62,
      fatigue: 4,
      ringSkill: 64,
      promoSkill: 56,
      matchRatings: explicitRatings({ technical: 64, stamina: 66, resilience: 65, timing: 64, clutch: 63 }),
    },
    {
      id: "audit-submission-specialist",
      name: "Audit Submission Specialist",
      popularity: 72,
      momentum: 70,
      ringSkill: 78,
      promoSkill: 62,
      archetype: "technician",
      matchRatings: explicitRatings({ technical: 88, submission: 94, stamina: 78, resilience: 76, psychology: 80, timing: 82, clutch: 74, aerial: 45, hardcore: 48 }),
    },
    {
      id: "audit-chaos-flyer",
      name: "Audit Chaos Flyer",
      popularity: 72,
      momentum: 70,
      ringSkill: 78,
      promoSkill: 62,
      archetype: "highflyer hardcore",
      matchRatings: explicitRatings({ aerial: 92, hardcore: 88, brawling: 82, explosiveness: 90, stamina: 80, resilience: 78, timing: 82, clutch: 74, submission: 42 }),
    },
  ];

  return specs.map((spec, index) => createAuditWrestler(fallbackPool[index % fallbackPool.length], spec));
}

function createAuditGame(inputGame?: GameState, rosterFilter?: (wrestler: Wrestler) => boolean): GameState {
  if (inputGame) {
    return {
      ...cloneGame(inputGame),
      wrestlers: getMatchSimulationLabRoster(inputGame).filter((wrestler) => (rosterFilter ? rosterFilter(wrestler) : true)),
      currentShow: [],
    };
  }

  const wrestlers = getMatchSimulationLabRoster(undefined).filter((wrestler) => (rosterFilter ? rosterFilter(wrestler) : true));
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    currentShow: [],
    championships: [],
    rivalries: [],
  };
}

function getOverallRating(wrestler: Wrestler) {
  const ratings = ensureMatchRatings(wrestler);
  return matchRatingKeys.reduce((sum, key) => sum + ratings[key], 0) / matchRatingKeys.length;
}

function getEffectivePower(wrestler: Wrestler) {
  return calculateEffectiveMatchPower(wrestler, { segmentCatalogId: "M001", showType: "tv", cardPosition: "main_event" }).effectivePower;
}

function textIncludes(wrestler: Wrestler, patterns: string[]) {
  const text = [wrestler.name, wrestler.roleTier, wrestler.archetype, wrestler.wrestlingStyle, wrestler.presentationHook, wrestler.sourceBrand]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return patterns.some((pattern) => text.includes(pattern));
}

function getScenarioTalent(game: GameState) {
  const pool = game.wrestlers.filter((wrestler) => wrestler.division === "Mens" && wrestler.injuryStatus !== "major");
  const byEffective = [...pool].sort((left, right) => getEffectivePower(right) - getEffectivePower(left) || (left.draftRank ?? 999) - (right.draftRank ?? 999));
  const byWeakest = [...pool].sort((left, right) => getEffectivePower(left) - getEffectivePower(right) || (right.draftRank ?? 999) - (left.draftRank ?? 999));
  const byMid = [...pool].sort((left, right) => Math.abs(getOverallRating(left) - 63) - Math.abs(getOverallRating(right) - 63) || left.name.localeCompare(right.name));
  const byTiredFavorite = [...pool].sort((left, right) => right.fatigue + getEffectivePower(right) * 0.2 - (left.fatigue + getEffectivePower(left) * 0.2));
  const byFreshUnderdog = [...pool].sort((left, right) => left.fatigue + getEffectivePower(left) * 0.2 - (right.fatigue + getEffectivePower(right) * 0.2));
  const usedFallback = (index: number) => pool[index % Math.max(1, pool.length)]?.id ?? "";
  const pick = (candidates: Wrestler[], exclude: string[] = []) => candidates.find((wrestler) => !exclude.includes(wrestler.id))?.id ?? usedFallback(exclude.length);
  const byRating = (key: MatchRatingKey) => [...pool].sort((left, right) => ensureMatchRatings(right)[key] - ensureMatchRatings(left)[key] || left.name.localeCompare(right.name));
  const style = (key: MatchRatingKey, patterns: string[]) => {
    const shaped = pool.filter((wrestler) => textIncludes(wrestler, patterns) || ensureMatchRatings(wrestler)[key] >= getOverallRating(wrestler) + 5);
    return (shaped.length ? shaped : byRating(key)).sort(
      (left, right) =>
        (ensureMatchRatings(right)[key] - getOverallRating(right)) - (ensureMatchRatings(left)[key] - getOverallRating(left)) ||
        ensureMatchRatings(right)[key] - ensureMatchRatings(left)[key] ||
        left.name.localeCompare(right.name),
    );
  };
  const lowPopHighSkill = [...pool].sort(
    (left, right) =>
      (right.ringSkill - right.popularity) - (left.ringSkill - left.popularity) ||
      ensureMatchRatings(right).technical - ensureMatchRatings(left).technical,
  );
  const highPopLowerSkill = [...pool].sort(
    (left, right) =>
      (right.popularity - right.ringSkill) - (left.popularity - left.ringSkill) ||
      ensureMatchRatings(right).psychology - ensureMatchRatings(left).psychology,
  );

  const eliteA = pick(byEffective);
  const eliteB = pick(byEffective, [eliteA]);
  const midA = pick(byMid, [eliteA, eliteB]);
  const midB = pick(byMid, [eliteA, eliteB, midA]);
  const midC = pick(byMid, [eliteA, eliteB, midA, midB]);
  const midD = pick(byMid, [eliteA, eliteB, midA, midB, midC]);
  const lowerA = pick(byWeakest, [eliteA, eliteB, midA, midB, midC, midD]);
  const lowerB = pick(byWeakest, [eliteA, eliteB, midA, midB, midC, midD, lowerA]);
  const technical = pick(lowPopHighSkill, [eliteA, eliteB, midA, midB]);
  const entertainer = pick(highPopLowerSkill, [technical]);
  const submission = pick(style("submission", ["submission", "technician", "ring general", "mat"]), [technical, entertainer]);
  const powerhouse = pick(style("power", ["powerhouse", "monster", "giant", "hoss"]), [submission]);
  const flyer = pick(style("aerial", ["highflyer", "high flyer", "aerial", "lucha"]), [submission, powerhouse]);
  const brawler = pick(style("brawling", ["brawler", "fight", "striker"]), [flyer]);
  const hardcore = pick(style("hardcore", ["hardcore", "deathmatch", "extreme", "chaos"]), [brawler]);
  const stamina = pick(style("stamina", ["iron", "endurance", "machine"]), [hardcore]);
  const tiredFavorite = pick(byTiredFavorite, [lowerA, lowerB]);
  const freshUnderdog = pick(byFreshUnderdog, [tiredFavorite, eliteA, eliteB]);

  return {
    eliteA,
    eliteB,
    midA,
    midB,
    midC,
    midD,
    lowerA,
    lowerB,
    technical,
    entertainer,
    submission,
    powerhouse,
    flyer,
    brawler,
    hardcore,
    stamina,
    tiredFavorite,
    freshUnderdog,
  };
}

function scenario(
  game: GameState,
  input: Omit<MatchSimulationBalanceAuditScenario, "participantIds"> & { participantIds: string[] },
): MatchSimulationBalanceAuditScenario {
  const knownIds = new Set(game.wrestlers.map((wrestler) => wrestler.id));
  const fallbackIds = game.wrestlers.filter((wrestler) => wrestler.division === "Mens" && wrestler.injuryStatus !== "major").map((wrestler) => wrestler.id);
  const seen = new Set<string>();
  const participantIds = input.participantIds.map((id) => {
    const fallbackId = fallbackIds.find((candidate) => !seen.has(candidate)) ?? id;
    const nextId = knownIds.has(id) && !seen.has(id) ? id : fallbackId;
    seen.add(nextId);
    return nextId;
  });

  return {
    ...input,
    participantIds,
  };
}

function buildScenarioMatrix(game: GameState, scenarioSet: MatchSimulationBalanceAuditCategory[]) {
  const include = (category: MatchSimulationBalanceAuditCategory) => scenarioSet.includes(category);
  const scenarios: MatchSimulationBalanceAuditScenario[] = [];
  const add = (entry: Omit<MatchSimulationBalanceAuditScenario, "participantIds"> & { participantIds: string[] }) => scenarios.push(scenario(game, entry));
  const talent = getScenarioTalent(game);

  if (include("singles")) {
    add({ id: "singles-elite-elite", category: "singles", label: "Elite vs elite", description: "Two top effective-power wrestlers.", matchStructure: "singles", participantIds: [talent.eliteA, talent.eliteB] });
    add({ id: "singles-elite-midcard", category: "singles", label: "Elite vs mid-card", description: "Top star against mid-card profile.", matchStructure: "singles", participantIds: [talent.eliteA, talent.midA] });
    add({ id: "singles-extreme-favorite-jobber", category: "singles", label: "Elite vs prospect/jobber", description: "Top star against low-card or prospect profile.", matchStructure: "singles", participantIds: [talent.eliteA, talent.lowerA] });
    add({ id: "singles-midcard-midcard", category: "singles", label: "Mid-card vs mid-card", description: "Two near-middle roster profiles.", matchStructure: "singles", participantIds: [talent.midA, talent.midB] });
    add({ id: "singles-popularity-skill", category: "singles", label: "Low-pop technical vs high-pop entertainer", description: "Ring-skill specialist against popularity-heavy profile.", matchStructure: "singles", participantIds: [talent.technical, talent.entertainer] });
    add({ id: "singles-submission-powerhouse", category: "singles", label: "Submission specialist vs powerhouse", description: "Submission specialist against power profile.", matchStructure: "singles", participantIds: [talent.submission, talent.powerhouse] });
    add({ id: "singles-flyer-brawler", category: "singles", label: "High flyer vs brawler", description: "Aerial profile against brawling profile.", matchStructure: "singles", participantIds: [talent.flyer, talent.brawler] });
    add({ id: "singles-tired-favorite", category: "singles", label: "High fatigue favorite vs fresh underdog", description: "Superior wrestler carrying red-line fatigue.", matchStructure: "singles", participantIds: [talent.tiredFavorite, talent.freshUnderdog] });
  }

  if (include("stipulation")) {
    const stipulations = matchSimulationLabStipulationIds.filter((id) => !id || id === "submission_match" || id === "no_dq" || id === "ladder_match" || id === "iron_man");
    stipulations.forEach((stipulationId) => {
      add({
        id: `stipulation-${stipulationId ?? "standard"}`,
        category: "stipulation",
        label: `${stipulationId ?? "standard"} sensitivity`,
        description: "Same specialist matchup across stipulation profiles.",
        matchStructure: "singles",
        participantIds: [talent.submission, talent.hardcore],
        stipulationId,
        comparisonGroupId: "specialist-stipulation-sweep",
      });
    });
  }

  if (include("tag")) {
    add({ id: "tag-balanced-teams", category: "tag", label: "Balanced 2v2 teams", description: "Two balanced mid-card teams.", matchStructure: "tag_2v2", participantIds: [talent.midA, talent.midB, talent.midC, talent.midD] });
    add({ id: "tag-strong-weak-vs-balanced", category: "tag", label: "One-star/one-weak vs balanced", description: "One top anchor paired with lower-card partner.", matchStructure: "tag_2v2", participantIds: [talent.eliteA, talent.lowerA, talent.midA, talent.midB] });
    add({ id: "tag-fatigue-fall-risk", category: "tag", label: "High-fatigue partner fall-taker risk", description: "A strong but tired partner should carry visible fall risk.", matchStructure: "tag_2v2", participantIds: [talent.tiredFavorite, talent.lowerB, talent.freshUnderdog, talent.stamina] });
    add({ id: "tag-protected-partner", category: "tag", label: "Protected partner behavior", description: "Team loss should identify one fall-taker and one protected loser.", matchStructure: "tag_2v2", participantIds: [talent.eliteA, talent.midA, talent.midB, talent.lowerA] });
    add({ id: "tag-favorite-underdog", category: "tag", label: "Favorite team vs underdog team", description: "Two strong wrestlers against two weaker profiles.", matchStructure: "tag_2v2", participantIds: [talent.eliteA, talent.eliteB, talent.lowerA, talent.lowerB] });
  }

  if (include("multi")) {
    add({ id: "multi-triple-favorite", category: "multi", label: "Triple threat favorite check", description: "One favorite and two underdogs.", matchStructure: "three_way", participantIds: [talent.eliteA, talent.lowerA, talent.lowerB] });
    add({ id: "multi-four-way-close", category: "multi", label: "Fatal 4-way close mid-carders", description: "Four wrestlers with near-balanced mid-card powers.", matchStructure: "four_way", participantIds: [talent.midA, talent.midB, talent.midC, talent.midD] });
    add({ id: "multi-four-way-extreme", category: "multi", label: "Fatal 4-way dominant favorite", description: "One dominant favorite against three weaker profiles.", matchStructure: "four_way", participantIds: [talent.eliteA, talent.midA, talent.lowerA, talent.lowerB] });
    add({ id: "multi-fall-protection-distribution", category: "multi", label: "Fall-taker/protection distribution", description: "Four-way designed to inspect fall concentration and protected losers.", matchStructure: "four_way", participantIds: [talent.technical, talent.hardcore, talent.midA, talent.lowerA] });
  }

  return scenarios;
}

function getWinnerRow(result: MatchSimulationLabResult, id?: string) {
  return result.winnerDistribution.find((row) => row.id === id || row.participantIds.includes(id ?? ""));
}

function getScenarioMetrics(result: MatchSimulationLabResult): MatchSimulationBalanceScenarioMetrics {
  const expectedRows = result.teamBreakdown.length ? result.teamBreakdown : result.participantBreakdown;
  const favorite = expectedRows.reduce<(typeof expectedRows)[number] | undefined>(
    (best, row) => (!best || (row.expectedProbability ?? 0) > (best.expectedProbability ?? 0) ? row : best),
    undefined,
  );
  const favoriteWinnerRow = getWinnerRow(result, favorite?.id);
  const favoriteActualWinRate = favoriteWinnerRow?.actualProbability ?? 0;
  const maxExpectedVsActualDelta = expectedRows.reduce((max, row) => {
    const actual = getWinnerRow(result, row.id)?.actualProbability ?? 0;
    const expected = row.expectedProbability ?? 0;
    return Math.max(max, Math.abs(actual - expected));
  }, 0);
  const winnerConcentration = result.winnerDistribution[0]?.actualProbability ?? 0;
  const averageEffectivePower =
    result.participantBreakdown.reduce((sum, row) => sum + row.averageEffectivePower, 0) / Math.max(1, result.participantBreakdown.length);
  const weakestPower = Math.min(...expectedRows.map((row) => row.averageEffectivePower));
  const fallTakerConcentration = result.fallTakerDistribution[0]?.actualProbability;
  const protectedParticipantCoverage = result.successfulIterations
    ? result.protectedParticipantDistribution.reduce((sum, row) => sum + row.count, 0) / result.successfulIterations
    : undefined;

  return {
    fallbackRate: round(result.iterations ? result.fallbackCounts.total / result.iterations : 0),
    favoriteId: favorite?.id,
    favoriteLabel: favorite?.label,
    favoriteExpectedWinRate: favorite?.expectedProbability,
    favoriteActualWinRate,
    favoritePowerAdvantage: favorite ? round(favorite.averageEffectivePower - weakestPower, 2) : undefined,
    underdogWinRate: favorite ? round(1 - favoriteActualWinRate) : undefined,
    upsetRate: result.upsetRate,
    maxExpectedVsActualDelta: round(maxExpectedVsActualDelta),
    winnerConcentration: round(winnerConcentration),
    averageEffectivePower: round(averageEffectivePower, 2),
    fallTakerConcentration: fallTakerConcentration === undefined ? undefined : round(fallTakerConcentration),
    protectedParticipantCoverage: protectedParticipantCoverage === undefined ? undefined : round(protectedParticipantCoverage),
  };
}

function getScenarioWarnings(
  scenario: MatchSimulationBalanceAuditScenario,
  result: MatchSimulationLabResult,
  metrics: MatchSimulationBalanceScenarioMetrics,
): MatchSimulationBalanceAuditWarning[] {
  const labWarningCode = (code: MatchSimulationLabResult["warnings"][number]["code"]): MatchSimulationBalanceAuditWarning["code"] => {
    switch (code) {
      case "fallTakerTooConcentrated":
        return "fallTakerTooConcentrated";
      case "favoriteWinsTooOften":
        return "favoriteWinsTooOften";
      case "stipulationHasLowOutcomeImpact":
        return "stipulationSensitivityLow";
      case "tooManyFallbacks":
        return "unexpectedFallback";
      default:
        return "probabilityDeltaHigh";
    }
  };
  const warnings: MatchSimulationBalanceAuditWarning[] = result.warnings.map((warning) => ({
    code: labWarningCode(warning.code),
    severity: warning.severity,
    scenarioId: scenario.id,
    message: warning.message,
  }));

  if (result.fallbackCounts.total > 0) {
    warnings.push({
      code: "unexpectedFallback",
      severity: "warning",
      scenarioId: scenario.id,
      message: `${scenario.label} used fallback resolution ${result.fallbackCounts.total} times.`,
    });
  }

  if (metrics.maxExpectedVsActualDelta > PROBABILITY_DELTA_WARNING_THRESHOLD) {
    warnings.push({
      code: "probabilityDeltaHigh",
      severity: "warning",
      scenarioId: scenario.id,
      message: `${scenario.label} has a ${round(metrics.maxExpectedVsActualDelta * 100, 1)} point expected-vs-actual winner distribution delta.`,
    });
  }

  if (
    metrics.favoriteExpectedWinRate !== undefined &&
    metrics.favoriteActualWinRate !== undefined &&
    metrics.favoriteExpectedWinRate >= LARGE_FAVORITE_EXPECTED_THRESHOLD &&
    metrics.favoriteActualWinRate < metrics.favoriteExpectedWinRate - 0.1
  ) {
    warnings.push({
      code: "favoriteUnderperforms",
      severity: "warning",
      scenarioId: scenario.id,
      message: `${metrics.favoriteLabel ?? "Favorite"} underperforms a large expected edge by more than 10 points.`,
    });
  }

  if (
    metrics.favoritePowerAdvantage !== undefined &&
    metrics.favoritePowerAdvantage >= 30 &&
    metrics.favoriteActualWinRate !== undefined &&
    metrics.favoriteActualWinRate < 0.75
  ) {
    warnings.push({
      code: "favoriteUnderperforms",
      severity: "warning",
      scenarioId: scenario.id,
      message: `${metrics.favoriteLabel ?? "Favorite"} has a ${round(metrics.favoritePowerAdvantage, 1)} effective-power edge but wins under 75%.`,
    });
  }

  if (
    metrics.favoriteExpectedWinRate !== undefined &&
    metrics.favoriteActualWinRate !== undefined &&
    metrics.favoriteExpectedWinRate >= LARGE_FAVORITE_EXPECTED_THRESHOLD &&
    metrics.favoriteActualWinRate > FAVORITE_OVERDETERMINISTIC_THRESHOLD
  ) {
    warnings.push({
      code: "favoriteWinsTooOften",
      severity: "warning",
      scenarioId: scenario.id,
      message: `${metrics.favoriteLabel ?? "Favorite"} wins above ${round(FAVORITE_OVERDETERMINISTIC_THRESHOLD * 100, 1)}%, which may be too deterministic.`,
    });
  }

  if (
    metrics.favoriteExpectedWinRate !== undefined &&
    metrics.underdogWinRate !== undefined &&
    metrics.favoriteExpectedWinRate >= MODERATE_FAVORITE_EXPECTED_THRESHOLD &&
    metrics.favoriteExpectedWinRate < LARGE_FAVORITE_EXPECTED_THRESHOLD &&
    metrics.underdogWinRate < MODERATE_UNDERDOG_MIN_UPSET_RATE
  ) {
    warnings.push({
      code: "moderateUnderdogUpsetsTooLow",
      severity: "info",
      scenarioId: scenario.id,
      message: `${scenario.label} gives moderate underdogs less than ${round(MODERATE_UNDERDOG_MIN_UPSET_RATE * 100, 1)}% upset share.`,
    });
  }

  if ((scenario.category === "tag" || scenario.category === "multi") && (metrics.fallTakerConcentration ?? 0) > FALL_TAKER_CONCENTRATION_THRESHOLD) {
    warnings.push({
      code: "fallTakerTooConcentrated",
      severity: "warning",
      scenarioId: scenario.id,
      message: `${scenario.label} concentrates too many falls on one participant.`,
    });
  }

  if (
    (scenario.category === "tag" || scenario.category === "multi") &&
    (metrics.protectedParticipantCoverage === undefined || metrics.protectedParticipantCoverage < PROTECTED_PARTICIPANT_MIN_COVERAGE)
  ) {
    warnings.push({
      code: "protectedParticipantMissing",
      severity: "warning",
      scenarioId: scenario.id,
      message: `${scenario.label} did not consistently report protected participant data.`,
    });
  }

  return warnings;
}

function addStipulationSensitivityWarnings(results: MatchSimulationBalanceScenarioResult[]) {
  const byGroup = new Map<string, MatchSimulationBalanceScenarioResult[]>();

  results.forEach((result) => {
    if (!result.scenario.comparisonGroupId) {
      return;
    }

    byGroup.set(result.scenario.comparisonGroupId, [...(byGroup.get(result.scenario.comparisonGroupId) ?? []), result]);
  });

  byGroup.forEach((groupResults) => {
    const firstParticipantId = groupResults[0]?.scenario.participantIds[0];

    if (!firstParticipantId) {
      return;
    }

    const firstParticipantRates = groupResults.map((result) => getWinnerRow(result.lab, firstParticipantId)?.actualProbability ?? 0);
    const sensitivitySpread = Math.max(...firstParticipantRates) - Math.min(...firstParticipantRates);

    if (sensitivitySpread < STIPULATION_SENSITIVITY_THRESHOLD) {
      const warning: MatchSimulationBalanceAuditWarning = {
        code: "stipulationSensitivityLow",
        severity: "warning",
        scenarioId: groupResults[0]?.scenario.comparisonGroupId,
        message: `The stipulation sweep moved the focus participant win rate by only ${round(sensitivitySpread * 100, 1)} points.`,
      };
      groupResults.forEach((result) => result.warnings.push(warning));
    }
  });
}

function ratingAverage(ratings: MatchRatings) {
  return matchRatingKeys.reduce((sum, key) => sum + ratings[key], 0) / matchRatingKeys.length;
}

function getRosterRatingMap(wrestlers: Wrestler[]) {
  return new Map(wrestlers.map((wrestler) => [wrestler.id, ratingAverage(wrestler.matchRatings ?? explicitRatings())]));
}

function getRosterAverageRating(wrestlers: Wrestler[]) {
  return round(wrestlers.reduce((sum, wrestler) => sum + ratingAverage(wrestler.matchRatings ?? explicitRatings()), 0) / Math.max(1, wrestlers.length), 3);
}

function countRatings(wrestlers: Wrestler[], predicate: (value: number) => boolean) {
  return wrestlers.reduce((count, wrestler) => count + matchRatingKeys.filter((key) => predicate((wrestler.matchRatings ?? explicitRatings())[key])).length, 0);
}

function sumRatingDeltas(delta: Partial<MatchRatings> | undefined) {
  if (!delta) {
    return 0;
  }

  return matchRatingKeys.reduce((sum, key) => sum + (delta[key] ?? 0), 0);
}

type ProgressionRosterIds = {
  favorite: string;
  underdog: string;
  jobber: string;
  skillHeavy: string;
  balancedA: string;
  balancedB: string;
  staminaHigh: string;
  momentumHigh: string;
  tiredFavorite: string;
  freshUnderdog: string;
  momentumLow: string;
  submissionSpecialist: string;
  chaosFlyer: string;
};

function resolveProgressionRosterIds(game: GameState): ProgressionRosterIds {
  const byId = new Map(game.wrestlers.map((wrestler) => [wrestler.id, wrestler.id]));
  const fallbackIds = game.wrestlers.map((wrestler) => wrestler.id);
  const idAt = (preferred: string, index: number) => byId.get(preferred) ?? fallbackIds[index % Math.max(1, fallbackIds.length)] ?? preferred;

  return {
    favorite: idAt("audit-favorite", 0),
    underdog: idAt("audit-underdog", 1),
    jobber: idAt("audit-jobber", 2),
    skillHeavy: idAt("audit-skill-heavy", 3),
    balancedA: idAt("audit-balanced-a", 4),
    balancedB: idAt("audit-balanced-b", 5),
    staminaHigh: idAt("audit-stamina-high", 6),
    momentumHigh: idAt("audit-momentum-high", 7),
    tiredFavorite: idAt("audit-tired-favorite", 8),
    freshUnderdog: idAt("audit-fresh-underdog", 9),
    momentumLow: idAt("audit-momentum-low", 10),
    submissionSpecialist: idAt("audit-submission-specialist", 11),
    chaosFlyer: idAt("audit-chaos-flyer", 12),
  };
}

function buildProgressionSegments(week: number, ids: ProgressionRosterIds): Segment[] {
  const suffix = `progression-${week}`;
  return [
    {
      id: `${suffix}-singles`,
      type: "Match",
      participantIds: week % 2 === 0 ? [ids.favorite, ids.underdog] : [ids.skillHeavy, ids.jobber],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
    },
    {
      id: `${suffix}-tag`,
      type: "Match",
      participantIds:
        week % 3 === 0
          ? [ids.tiredFavorite, ids.underdog, ids.freshUnderdog, ids.staminaHigh]
          : [ids.favorite, ids.jobber, ids.balancedA, ids.balancedB],
      segmentCatalogId: "M020",
      segmentDisplayName: "2v2 Tag Match",
      durationMinutes: 12,
      participantMin: 4,
      participantMax: 4,
    },
    {
      id: `${suffix}-multi`,
      type: "Match",
      participantIds:
        week % 4 === 0
          ? [ids.balancedA, ids.balancedB, ids.staminaHigh, ids.momentumHigh]
          : [ids.favorite, ids.underdog, ids.jobber, ids.momentumLow],
      segmentCatalogId: "M003",
      segmentDisplayName: "Fatal 4-Way",
      durationMinutes: 14,
      participantMin: 4,
      participantMax: 4,
    },
    {
      id: `${suffix}-stipulation`,
      type: "Match",
      participantIds: [ids.submissionSpecialist, ids.chaosFlyer],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 14,
      participantMin: 2,
      participantMax: 2,
      stipulationId: week % 5 === 0 ? "iron_man" : week % 2 === 0 ? "ladder_match" : "submission_match",
    },
  ];
}

function buildProgressionCheckpoint(week: number, startingRatings: Map<string, number>, wrestlers: Wrestler[]): MatchSimulationProgressionCheckpoint {
  const currentRatings = getRosterRatingMap(wrestlers);
  const deltas = wrestlers.map((wrestler) => (currentRatings.get(wrestler.id) ?? 0) - (startingRatings.get(wrestler.id) ?? 0));

  return {
    week,
    averageRating: getRosterAverageRating(wrestlers),
    averageDelta: round(deltas.reduce((sum, delta) => sum + delta, 0) / Math.max(1, deltas.length), 3),
    maxIncrease: round(Math.max(0, ...deltas), 3),
    maxDecrease: round(Math.min(0, ...deltas), 3),
    ratingsAtZero: countRatings(wrestlers, (value) => value <= 0),
    ratingsAtHundred: countRatings(wrestlers, (value) => value >= 100),
    ratingsAtOrAboveNinetyNine: countRatings(wrestlers, (value) => value >= 99),
    lowRatedImprovedCount: wrestlers.filter((wrestler) => {
      const starting = startingRatings.get(wrestler.id) ?? 0;
      const current = currentRatings.get(wrestler.id) ?? 0;
      return starting < 55 && current > starting;
    }).length,
  };
}

function runProgressionSeasonAudit(sourceGame: GameState, weeks: number, baseSeed: string): MatchSimulationProgressionAuditResult {
  const sourceSnapshot = JSON.stringify(sourceGame.wrestlers.map((wrestler) => ({ id: wrestler.id, matchRatings: wrestler.matchRatings })));
  let game = cloneGame(sourceGame);
  game.currentShow = [];
  const progressionIds = resolveProgressionRosterIds(game);
  const startingRatings = getRosterRatingMap(game.wrestlers);
  const startingAverageRating = getRosterAverageRating(game.wrestlers);
  const checkpoints: MatchSimulationProgressionCheckpoint[] = [];
  const fallTakerDeltas: number[] = [];
  const protectedLoserDeltas: number[] = [];
  const checkpointWeeks = new Set([Math.min(10, weeks), Math.min(25, weeks), weeks]);

  for (let week = 1; week <= weeks; week += 1) {
    game = {
      ...game,
      currentWeek: week,
      wrestlers: game.wrestlers.map((wrestler) => ({
        ...wrestler,
        injuryStatus: wrestler.injuryStatus === "major" ? "healthy" : wrestler.injuryStatus,
        injuryDescription: wrestler.injuryStatus === "major" ? undefined : wrestler.injuryDescription,
        injuryWeeksRemaining: wrestler.injuryStatus === "major" ? 0 : wrestler.injuryWeeksRemaining,
      })),
      currentShow: buildProgressionSegments(week, progressionIds).map((segment) => ({ ...segment, id: `${baseSeed}-${segment.id}` })),
    };

    const resolved = runShow(game, {
      matchOutcomeModel: "deepRatings",
      matchRatingsProgression: "enabled",
    });
    resolved.result.segmentResults.forEach((segment) => {
      const fallTakerId = segment.internalOutcomeAudit?.fallTakerId;
      const protectedParticipantIds = segment.internalOutcomeAudit?.protectedParticipantIds ?? [];

      if (fallTakerId) {
        fallTakerDeltas.push(sumRatingDeltas(segment.internalMatchRatingsProgressionAudit?.deltas[fallTakerId]));
      }

      protectedParticipantIds.forEach((id) => {
        protectedLoserDeltas.push(sumRatingDeltas(segment.internalMatchRatingsProgressionAudit?.deltas[id]));
      });
    });
    game = resolved.game;

    if (checkpointWeeks.has(week)) {
      checkpoints.push(buildProgressionCheckpoint(week, startingRatings, game.wrestlers));
    }
  }

  const endingRatings = getRosterRatingMap(game.wrestlers);
  const deltas = game.wrestlers.map((wrestler) => (endingRatings.get(wrestler.id) ?? 0) - (startingRatings.get(wrestler.id) ?? 0));
  const endingAverageRating = getRosterAverageRating(game.wrestlers);
  const averageDelta = round(endingAverageRating - startingAverageRating, 3);
  const fallTakerAverageDelta = fallTakerDeltas.length ? round(fallTakerDeltas.reduce((sum, delta) => sum + delta, 0) / fallTakerDeltas.length, 3) : undefined;
  const protectedLoserAverageDelta = protectedLoserDeltas.length
    ? round(protectedLoserDeltas.reduce((sum, delta) => sum + delta, 0) / protectedLoserDeltas.length, 3)
    : undefined;
  const result: MatchSimulationProgressionAuditResult = {
    enabled: true,
    weeks,
    startingAverageRating,
    endingAverageRating,
    averageDelta,
    maxIncrease: round(Math.max(0, ...deltas), 3),
    maxDecrease: round(Math.min(0, ...deltas), 3),
    ratingsAtZero: countRatings(game.wrestlers, (value) => value <= 0),
    ratingsAtHundred: countRatings(game.wrestlers, (value) => value >= 100),
    ratingsAtOrAboveNinetyNine: countRatings(game.wrestlers, (value) => value >= 99),
    lowRatedImprovedCount: game.wrestlers.filter((wrestler) => {
      const starting = startingRatings.get(wrestler.id) ?? 0;
      const current = endingRatings.get(wrestler.id) ?? 0;
      return starting < 55 && current > starting;
    }).length,
    fallTakerAverageDelta,
    protectedLoserAverageDelta,
    sourceGameMutated: JSON.stringify(sourceGame.wrestlers.map((wrestler) => ({ id: wrestler.id, matchRatings: wrestler.matchRatings }))) !== sourceSnapshot,
    checkpoints,
    warnings: [],
  };

  result.warnings = getProgressionWarnings(result);
  return result;
}

function getProgressionWarnings(result: MatchSimulationProgressionAuditResult): MatchSimulationBalanceAuditWarning[] {
  const warnings: MatchSimulationBalanceAuditWarning[] = [];
  const averageDeltaPerWeek = result.weeks ? result.averageDelta / result.weeks : 0;

  if (averageDeltaPerWeek > PROGRESSION_INFLATION_THRESHOLD_BY_WEEK) {
    warnings.push({
      code: "progressionInflation",
      severity: "warning",
      message: `Average ratings increased ${round(result.averageDelta, 2)} points across ${result.weeks} weeks.`,
    });
  }

  if (averageDeltaPerWeek < PROGRESSION_DEFLATION_THRESHOLD_BY_WEEK) {
    warnings.push({
      code: "progressionDeflation",
      severity: "warning",
      message: `Average ratings decreased ${round(Math.abs(result.averageDelta), 2)} points across ${result.weeks} weeks.`,
    });
  }

  if (result.maxIncrease > PROGRESSION_MAX_MOVE_THRESHOLD || Math.abs(result.maxDecrease) > PROGRESSION_MAX_MOVE_THRESHOLD) {
    warnings.push({
      code: "ratingClampPressure",
      severity: "warning",
      message: `A wrestler moved from ${round(result.maxDecrease, 1)} to +${round(result.maxIncrease, 1)} average rating points.`,
    });
  }

  if (result.ratingsAtHundred > 0 || result.ratingsAtOrAboveNinetyNine > 0) {
    warnings.push({
      code: "topRatingsApproachCap",
      severity: "warning",
      message: `${result.ratingsAtOrAboveNinetyNine} ratings reached 99+ and ${result.ratingsAtHundred} reached 100.`,
    });
  }

  if (result.fallTakerAverageDelta !== undefined && result.fallTakerAverageDelta < -5) {
    warnings.push({
      code: "fallTakerRegressionHeavy",
      severity: "warning",
      message: `Fall-takers averaged ${round(result.fallTakerAverageDelta, 2)} total rating delta per fall.`,
    });
  }

  if (
    result.fallTakerAverageDelta !== undefined &&
    result.protectedLoserAverageDelta !== undefined &&
    result.protectedLoserAverageDelta - result.fallTakerAverageDelta < 1
  ) {
    warnings.push({
      code: "protectedLoserPenaltyTooCloseToFallTaker",
      severity: "warning",
      message: `Protected losers averaged only ${round(result.protectedLoserAverageDelta - result.fallTakerAverageDelta, 2)} points softer than fall-takers.`,
    });
  }

  return warnings;
}

function resolveScenarioSet(scenarioSet: MatchSimulationBalanceAuditInput["scenarioSet"]): MatchSimulationBalanceAuditCategory[] {
  if (!scenarioSet || scenarioSet === "all") {
    return ["singles", "stipulation", "tag", "multi", "progression"];
  }

  return [...new Set(scenarioSet)];
}

export function runMatchSimulationBalanceAudit(input: MatchSimulationBalanceAuditInput = {}): MatchSimulationBalanceAuditResult {
  const scenarioSet = resolveScenarioSet(input.scenarioSet);
  const includeProgressionSeason = input.includeProgressionSeason ?? scenarioSet.includes("progression");
  const progressionWeeks = clampCount(input.progressionWeeks, DEFAULT_PROGRESSION_WEEKS, DEFAULT_PROGRESSION_WEEKS);
  const iterationsPerScenario = clampCount(input.iterationsPerScenario, DEFAULT_ITERATIONS_PER_SCENARIO, MAX_ITERATIONS_PER_SCENARIO);
  const baseSeed = input.baseSeed?.trim() || DEFAULT_BASE_SEED;
  const progression = input.progression ?? "disabled";
  const game = createAuditGame(input.game, input.rosterFilter);
  const scenarioMatrix = buildScenarioMatrix(game, scenarioSet.filter((category) => category !== "progression"));
  const scenarioResults = scenarioMatrix.map<MatchSimulationBalanceScenarioResult>((auditScenario) => {
    const lab = runMatchSimulationLab({
      game,
      participantIds: auditScenario.participantIds,
      matchStructure: auditScenario.matchStructure,
      stipulationId: auditScenario.stipulationId,
      iterations: iterationsPerScenario,
      baseSeed: `${baseSeed}-${auditScenario.id}`,
      model: "deepRatings",
      progression,
    });
    const metrics = getScenarioMetrics(lab);
    return {
      scenario: auditScenario,
      lab,
      metrics,
      warnings: getScenarioWarnings(auditScenario, lab, metrics),
    };
  });
  addStipulationSensitivityWarnings(scenarioResults);

  const progressionResult = includeProgressionSeason ? runProgressionSeasonAudit(game, progressionWeeks, baseSeed) : undefined;
  const warnings = [...scenarioResults.flatMap((result) => result.warnings), ...(progressionResult?.warnings ?? [])];
  const favoriteRates = scenarioResults
    .map((result) => result.metrics.favoriteActualWinRate)
    .filter((value): value is number => typeof value === "number");

  return {
    input: {
      iterationsPerScenario,
      baseSeed,
      progression,
      includeProgressionSeason,
      progressionWeeks,
      scenarioSet,
    },
    scenarioMatrix,
    scenarioResults,
    progression: progressionResult,
    warnings,
    summary: {
      scenarioCount: scenarioResults.length,
      warningCount: warnings.length,
      unexpectedFallbackScenarios: scenarioResults.filter((result) => result.lab.fallbackCounts.total > 0).length,
      maxProbabilityDelta: round(Math.max(0, ...scenarioResults.map((result) => result.metrics.maxExpectedVsActualDelta))),
      averageFavoriteWinRate: round(favoriteRates.reduce((sum, rate) => sum + rate, 0) / Math.max(1, favoriteRates.length)),
      progressionAverageDelta: progressionResult?.averageDelta,
    },
  };
}
