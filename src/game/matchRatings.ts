import type { MatchRatings, Segment, SegmentType, ShowType, Wrestler } from "./types";
import { MATCH_CURRENT_STATE_TUNING, MATCH_OUTCOME_TUNING, MATCH_PROGRESSION_TUNING } from "./matchTuning";

export type MatchRatingKey = keyof MatchRatings;

export const matchRatingKeys: MatchRatingKey[] = [
  "technical",
  "submission",
  "power",
  "aerial",
  "brawling",
  "hardcore",
  "stamina",
  "resilience",
  "psychology",
  "selling",
  "timing",
  "explosiveness",
  "clutch",
];

export type MatchRatingCurrentModifiers = Partial<Record<MatchRatingKey, number>>;

export type MatchRatingProgressionInput = {
  segmentTypes?: SegmentType[];
  resultScore?: number;
  deltas?: Partial<Record<MatchRatingKey, number>>;
};

export type MatchOutcomeCardPosition = "opener" | "midcard" | "main_event";

export type EffectiveMatchPowerContext = Partial<Pick<Segment, "type" | "segmentCatalogId" | "stipulationId" | "championshipId" | "rivalryId">> & {
  showType?: ShowType;
  cardPosition?: MatchOutcomeCardPosition;
  isTitleMatch?: boolean;
  isRivalryMatch?: boolean;
};

export type MatchContextWeightProfile = {
  id: string;
  weights: Record<MatchRatingKey, number>;
};

export type EffectiveMatchPowerMemberBreakdown = {
  wrestlerId: string;
  wrestlerName: string;
  weightedBaseRating: number;
  currentModifierPower: number;
  availabilityModifier: number;
  contextModifierPower: number;
  rawPower: number;
  effectivePower: number;
  baseRatings: MatchRatings;
  currentModifiers: MatchRatingCurrentModifiers;
};

export type EffectiveMatchPowerBreakdown = {
  competitorId: string;
  wrestlerIds: string[];
  effectivePower: number;
  weightedBasePower: number;
  currentModifierPower: number;
  availabilityModifier: number;
  contextModifierPower: number;
  profileId: string;
  weights: Record<MatchRatingKey, number>;
  members: EffectiveMatchPowerMemberBreakdown[];
};

export type MatchupWinProbabilityBreakdown = {
  competitorAId: string;
  competitorBId: string;
  competitorAPower: number;
  competitorBPower: number;
  rawCompetitorAWinProbability: number;
  competitorAWinProbability: number;
  competitorBWinProbability: number;
};

export type MatchOutcomePreview = MatchupWinProbabilityBreakdown & {
  seed: string;
  roll: number;
  winnerId: string;
  loserId: string;
  competitorA: EffectiveMatchPowerBreakdown;
  competitorB: EffectiveMatchPowerBreakdown;
};

const clampRating = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
const EFFECTIVE_POWER_FLOOR = MATCH_OUTCOME_TUNING.effectivePowerFloor;

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function textIncludes(wrestler: Pick<Wrestler, "archetype" | "wrestlingStyle" | "presentationHook" | "role" | "roleTier" | "sourceBrand">, patterns: string[]) {
  const text = [wrestler.archetype, wrestler.wrestlingStyle, wrestler.presentationHook, wrestler.role, wrestler.roleTier, wrestler.sourceBrand]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return patterns.some((pattern) => text.includes(pattern));
}

function getStyleBiases(wrestler: Pick<Wrestler, "archetype" | "wrestlingStyle" | "presentationHook" | "role" | "roleTier" | "sourceBrand">): Partial<Record<MatchRatingKey, number>> {
  const biases: Partial<Record<MatchRatingKey, number>> = {};
  const add = (key: MatchRatingKey, amount: number) => {
    biases[key] = (biases[key] ?? 0) + amount;
  };

  if (textIncludes(wrestler, ["technician", "ringgeneral", "ring general", "mat", "workrate"])) {
    add("technical", 8);
    add("submission", 5);
    add("timing", 5);
    add("psychology", 4);
    add("power", -3);
  }

  if (textIncludes(wrestler, ["powerhouse", "monster", "giant", "hoss"])) {
    add("power", 9);
    add("resilience", 5);
    add("explosiveness", 4);
    add("aerial", -6);
    add("technical", -2);
  }

  if (textIncludes(wrestler, ["highflyer", "high flyer", "aerial", "lucha", "cruiser"])) {
    add("aerial", 10);
    add("explosiveness", 6);
    add("timing", 3);
    add("power", -5);
    add("resilience", -2);
  }

  if (textIncludes(wrestler, ["brawler", "fight", "striker", "strong style"])) {
    add("brawling", 8);
    add("hardcore", 4);
    add("resilience", 3);
    add("submission", -2);
  }

  if (textIncludes(wrestler, ["hardcore", "deathmatch", "extreme", "chaos"])) {
    add("hardcore", 10);
    add("brawling", 5);
    add("resilience", 4);
    add("technical", -3);
  }

  if (textIncludes(wrestler, ["showman", "sports entertainment", "main event", "mainevent", "legend"])) {
    add("psychology", 7);
    add("clutch", 6);
    add("selling", 4);
    add("timing", 3);
  }

  return biases;
}

function deriveBaseValue(
  wrestler: Pick<Wrestler, "ringSkill" | "promoSkill" | "popularity" | "roleTier" | "draftRank">,
  weights: {
    ring: number;
    promo: number;
    popularity: number;
  },
) {
  const ringSkill = numberOr(wrestler.ringSkill, 60);
  const promoSkill = numberOr(wrestler.promoSkill, 55);
  const popularity = numberOr(wrestler.popularity, 55);
  const roleTierBonus =
    wrestler.roleTier === "MainEvent"
      ? 4
      : wrestler.roleTier === "UpperCard"
        ? 2
        : wrestler.roleTier === "Prospect"
          ? -2
          : wrestler.roleTier === "Enhancement"
            ? -4
            : 0;
  const draftRankBonus = typeof wrestler.draftRank === "number" ? Math.max(-2, Math.min(3, Math.round((80 - wrestler.draftRank) / 40))) : 0;

  return ringSkill * weights.ring + promoSkill * weights.promo + popularity * weights.popularity + roleTierBonus + draftRankBonus;
}

export function normalizeMatchRatings(value: unknown): MatchRatings | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<Record<MatchRatingKey, unknown>>;
  const normalized = matchRatingKeys.reduce<Partial<MatchRatings>>((ratings, key) => {
    ratings[key] = typeof candidate[key] === "number" && Number.isFinite(candidate[key]) ? clampRating(candidate[key]) : undefined;
    return ratings;
  }, {});

  return matchRatingKeys.every((key) => typeof normalized[key] === "number") ? (normalized as MatchRatings) : undefined;
}

export function deriveMatchRatings(
  wrestler: Pick<
    Wrestler,
    | "ringSkill"
    | "promoSkill"
    | "popularity"
    | "momentum"
    | "morale"
    | "fatigue"
    | "role"
    | "roleTier"
    | "archetype"
    | "wrestlingStyle"
    | "presentationHook"
    | "sourceBrand"
    | "sourceAvailability"
    | "draftRank"
  >,
): MatchRatings {
  const biases = getStyleBiases(wrestler);
  const nudge = Math.round((numberOr(wrestler.momentum, 50) - 50) * 0.03 + (numberOr(wrestler.morale, 50) - 50) * 0.02);
  const unavailablePenalty = wrestler.sourceAvailability?.toLowerCase().includes("inactive") ? -2 : 0;
  const withBias = (key: MatchRatingKey, value: number) => clampRating(value + (biases[key] ?? 0) + nudge + unavailablePenalty);

  return {
    technical: withBias("technical", deriveBaseValue(wrestler, { ring: 0.78, promo: 0.12, popularity: 0.1 })),
    submission: withBias("submission", deriveBaseValue(wrestler, { ring: 0.72, promo: 0.08, popularity: 0.08 }) - 2),
    power: withBias("power", deriveBaseValue(wrestler, { ring: 0.52, promo: 0.08, popularity: 0.14 }) + 8),
    aerial: withBias("aerial", deriveBaseValue(wrestler, { ring: 0.62, promo: 0.06, popularity: 0.08 })),
    brawling: withBias("brawling", deriveBaseValue(wrestler, { ring: 0.58, promo: 0.1, popularity: 0.12 }) + 4),
    hardcore: withBias("hardcore", deriveBaseValue(wrestler, { ring: 0.5, promo: 0.1, popularity: 0.12 }) + 2),
    stamina: withBias("stamina", deriveBaseValue(wrestler, { ring: 0.68, promo: 0.08, popularity: 0.08 }) + 5),
    resilience: withBias("resilience", deriveBaseValue(wrestler, { ring: 0.56, promo: 0.08, popularity: 0.12 }) + 8),
    psychology: withBias("psychology", deriveBaseValue(wrestler, { ring: 0.46, promo: 0.32, popularity: 0.12 })),
    selling: withBias("selling", deriveBaseValue(wrestler, { ring: 0.54, promo: 0.22, popularity: 0.08 })),
    timing: withBias("timing", deriveBaseValue(wrestler, { ring: 0.7, promo: 0.14, popularity: 0.08 })),
    explosiveness: withBias("explosiveness", deriveBaseValue(wrestler, { ring: 0.5, promo: 0.08, popularity: 0.14 }) + 7),
    clutch: withBias("clutch", deriveBaseValue(wrestler, { ring: 0.42, promo: 0.22, popularity: 0.16 }) + 6),
  };
}

export function ensureMatchRatings(wrestler: Wrestler): MatchRatings {
  return normalizeMatchRatings(wrestler.matchRatings) ?? deriveMatchRatings(wrestler);
}

export function deriveMatchRatingCurrentModifiers({
  momentum,
  morale,
  fatigue,
  injuryStatus,
}: Pick<Wrestler, "momentum" | "morale" | "fatigue" | "injuryStatus">): MatchRatingCurrentModifiers {
  const form = Math.round(
    (numberOr(momentum, 50) - 50) * MATCH_CURRENT_STATE_TUNING.momentumModifier +
      (numberOr(morale, 50) - 50) * MATCH_CURRENT_STATE_TUNING.moraleModifier,
  );
  const fatigueDrag = Math.round(Math.max(0, numberOr(fatigue, 0) - MATCH_CURRENT_STATE_TUNING.fatigueStart) * MATCH_CURRENT_STATE_TUNING.fatiguePenalty);
  const injuryDrag = injuryStatus === "major" ? -12 : injuryStatus === "minor" ? -4 : 0;

  return {
    stamina: fatigueDrag + injuryDrag,
    resilience: fatigueDrag + injuryDrag,
    explosiveness: form + fatigueDrag + injuryDrag,
    clutch: form,
    timing: Math.round(form / 2),
  };
}

function createWeights(overrides: Partial<Record<MatchRatingKey, number>> = {}): Record<MatchRatingKey, number> {
  return matchRatingKeys.reduce<Record<MatchRatingKey, number>>((weights, key) => {
    const override = overrides[key];
    weights[key] = override === undefined ? 1 : 1 + (override - 1) * MATCH_OUTCOME_TUNING.stipulationWeightMultiplier;
    return weights;
  }, {} as Record<MatchRatingKey, number>);
}

const balancedMatchWeightProfile: MatchContextWeightProfile = {
  id: "balanced",
  weights: createWeights({
    technical: 1.15,
    power: 1.1,
    brawling: 1.05,
    stamina: 1.1,
    resilience: 1.1,
    psychology: 1.05,
    timing: 1.1,
    clutch: 1.05,
  }),
};

const submissionMatchWeightProfile: MatchContextWeightProfile = {
  id: "submission",
  weights: createWeights({
    technical: 1.45,
    submission: 1.75,
    resilience: 1.25,
    psychology: 1.25,
    timing: 1.15,
    power: 0.9,
    aerial: 0.85,
    hardcore: 0.8,
  }),
};

const hardcoreMatchWeightProfile: MatchContextWeightProfile = {
  id: "hardcore",
  weights: createWeights({
    hardcore: 1.65,
    brawling: 1.45,
    resilience: 1.3,
    power: 1.25,
    explosiveness: 1.15,
    technical: 0.85,
    submission: 0.85,
    psychology: 1.1,
  }),
};

const ladderMatchWeightProfile: MatchContextWeightProfile = {
  id: "ladder",
  weights: createWeights({
    aerial: 1.6,
    explosiveness: 1.45,
    timing: 1.35,
    resilience: 1.25,
    stamina: 1.2,
    power: 0.9,
    submission: 0.75,
  }),
};

const enduranceMatchWeightProfile: MatchContextWeightProfile = {
  id: "endurance",
  weights: createWeights({
    stamina: 1.55,
    resilience: 1.4,
    technical: 1.25,
    psychology: 1.25,
    timing: 1.2,
    explosiveness: 0.9,
    hardcore: 0.85,
  }),
};

function getMatchContextWeightProfile(context: EffectiveMatchPowerContext = {}): MatchContextWeightProfile {
  // Unsupported future stipulations intentionally fall back to balanced until the catalog models their mechanical shape.
  switch (context.stipulationId) {
    case "submission_match":
      return submissionMatchWeightProfile;
    case "no_dq":
    case "extreme_rules":
    case "street_fight":
    case "table_match":
    case "steel_cage":
    case "last_man_standing":
    case "tlc_match":
      return hardcoreMatchWeightProfile;
    case "ladder_match":
      return ladderMatchWeightProfile;
    case "iron_man":
      return enduranceMatchWeightProfile;
    default:
      return balancedMatchWeightProfile;
  }
}

function getWeightedRatingPower(ratings: MatchRatings, weights: Record<MatchRatingKey, number>) {
  const totalWeight = matchRatingKeys.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);

  if (totalWeight <= 0) {
    return EFFECTIVE_POWER_FLOOR;
  }

  return matchRatingKeys.reduce((sum, key) => sum + ratings[key] * Math.max(0, weights[key]), 0) / totalWeight;
}

function getWeightedModifierPower(modifiers: MatchRatingCurrentModifiers, weights: Record<MatchRatingKey, number>) {
  const totalWeight = matchRatingKeys.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);

  if (totalWeight <= 0) {
    return 0;
  }

  return matchRatingKeys.reduce((sum, key) => sum + (modifiers[key] ?? 0) * Math.max(0, weights[key]), 0) / totalWeight;
}

function getAvailabilityModifier(wrestler: Wrestler) {
  const maybeAvailability = wrestler as Wrestler & { injured?: boolean; unavailable?: boolean; status?: string };
  const sourceAvailability = wrestler.sourceAvailability?.toLowerCase() ?? "";
  const status = maybeAvailability.status?.toLowerCase();
  const explicitUnavailable = maybeAvailability.unavailable || status === "unavailable";
  const explicitInjured = maybeAvailability.injured || status === "injured";
  const sourceInactive = sourceAvailability.includes("inactive") || sourceAvailability.includes("unavailable");

  if (wrestler.injuryStatus === "major" || explicitUnavailable) {
    return -18;
  }

  if (wrestler.injuryStatus === "minor" || explicitInjured) {
    return -5;
  }

  return sourceInactive ? -8 : 0;
}

function getContextModifierPower(ratings: MatchRatings, context: EffectiveMatchPowerContext = {}) {
  const isTitleMatch = Boolean(context.isTitleMatch ?? context.championshipId);
  const isRivalryMatch = Boolean(context.isRivalryMatch ?? context.rivalryId);
  const clutchLift = (ratings.clutch - 50) * 0.025;
  const psychologyLift = (ratings.psychology - 50) * 0.015;
  const titleBonus = isTitleMatch ? 1.5 + clutchLift : 0;
  const rivalryBonus = isRivalryMatch ? 1 + psychologyLift : 0;
  const pleBonus = context.showType === "ple" ? 0.8 + clutchLift : 0;
  const mainEventBonus = context.cardPosition === "main_event" ? 0.8 + clutchLift : 0;
  const openerBonus = context.cardPosition === "opener" ? Math.max(0, (ratings.explosiveness - 50) * 0.015) : 0;

  return titleBonus + rivalryBonus + pleBonus + mainEventBonus + openerBonus + getStipulationFitPower(ratings, context);
}

function ratingAverage(ratings: MatchRatings) {
  return matchRatingKeys.reduce((sum, key) => sum + ratings[key], 0) / matchRatingKeys.length;
}

function getStipulationFitPower(ratings: MatchRatings, context: EffectiveMatchPowerContext = {}) {
  const average = ratingAverage(ratings);
  const aboveAverage = (key: MatchRatingKey) => ratings[key] - average;
  const multiplier = MATCH_OUTCOME_TUNING.stipulationFitPowerMultiplier;

  switch (context.stipulationId) {
    case "submission_match":
      return (aboveAverage("submission") * 0.52 + aboveAverage("technical") * 0.24 + aboveAverage("resilience") * 0.14 + aboveAverage("psychology") * 0.1) * multiplier;
    case "no_dq":
    case "extreme_rules":
    case "street_fight":
    case "table_match":
    case "steel_cage":
    case "last_man_standing":
    case "tlc_match":
      return (aboveAverage("hardcore") * 0.42 + aboveAverage("brawling") * 0.28 + aboveAverage("resilience") * 0.18 + aboveAverage("power") * 0.12) * multiplier;
    case "ladder_match":
      return (aboveAverage("aerial") * 0.4 + aboveAverage("explosiveness") * 0.28 + aboveAverage("timing") * 0.22 + aboveAverage("resilience") * 0.1) * multiplier;
    case "iron_man":
      return (aboveAverage("stamina") * 0.34 + aboveAverage("resilience") * 0.28 + aboveAverage("technical") * 0.22 + aboveAverage("psychology") * 0.16) * multiplier;
    default:
      return 0;
  }
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function seededUnitRoll(seed: string) {
  return (hashString(seed) % 1000000) / 1000000;
}

export function calculateEffectiveMatchPower(
  wrestlerOrTeam: Wrestler | Wrestler[],
  context: EffectiveMatchPowerContext = {},
): EffectiveMatchPowerBreakdown {
  const wrestlers = Array.isArray(wrestlerOrTeam) ? wrestlerOrTeam : [wrestlerOrTeam];
  const profile = getMatchContextWeightProfile(context);
  const members = wrestlers.map<EffectiveMatchPowerMemberBreakdown>((wrestler) => {
    const baseRatings = ensureMatchRatings(wrestler);
    const currentModifiers = deriveMatchRatingCurrentModifiers(wrestler);
    const weightedBaseRating = getWeightedRatingPower(baseRatings, profile.weights);
    const currentModifierPower = getWeightedModifierPower(currentModifiers, profile.weights);
    const availabilityModifier = getAvailabilityModifier(wrestler);
    const contextModifierPower = getContextModifierPower(baseRatings, context);
    const rawPower = weightedBaseRating + currentModifierPower + availabilityModifier + contextModifierPower;

    return {
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      weightedBaseRating,
      currentModifierPower,
      availabilityModifier,
      contextModifierPower,
      rawPower,
      effectivePower: Math.max(EFFECTIVE_POWER_FLOOR, rawPower),
      baseRatings,
      currentModifiers,
    };
  });
  const safeMembers = members.length
    ? members
    : [
        {
          wrestlerId: "unknown",
          wrestlerName: "Unknown",
          weightedBaseRating: EFFECTIVE_POWER_FLOOR,
          currentModifierPower: 0,
          availabilityModifier: 0,
          contextModifierPower: 0,
          rawPower: EFFECTIVE_POWER_FLOOR,
          effectivePower: EFFECTIVE_POWER_FLOOR,
          baseRatings: matchRatingKeys.reduce<MatchRatings>((ratings, key) => {
            ratings[key] = EFFECTIVE_POWER_FLOOR;
            return ratings;
          }, {} as MatchRatings),
          currentModifiers: {},
        },
      ];
  const average = (score: (member: EffectiveMatchPowerMemberBreakdown) => number) =>
    safeMembers.reduce((sum, member) => sum + score(member), 0) / safeMembers.length;

  return {
    competitorId: safeMembers.map((member) => member.wrestlerId).join("+"),
    wrestlerIds: safeMembers.map((member) => member.wrestlerId),
    effectivePower: Math.max(EFFECTIVE_POWER_FLOOR, average((member) => member.effectivePower)),
    weightedBasePower: average((member) => member.weightedBaseRating),
    currentModifierPower: average((member) => member.currentModifierPower),
    availabilityModifier: average((member) => member.availabilityModifier),
    contextModifierPower: average((member) => member.contextModifierPower),
    profileId: profile.id,
    weights: profile.weights,
    members: safeMembers,
  };
}

export function calculateMatchupWinProbability(
  competitorA: Pick<EffectiveMatchPowerBreakdown, "competitorId" | "effectivePower">,
  competitorB: Pick<EffectiveMatchPowerBreakdown, "competitorId" | "effectivePower">,
): MatchupWinProbabilityBreakdown {
  const competitorAPower = Math.max(EFFECTIVE_POWER_FLOOR, numberOr(competitorA.effectivePower, EFFECTIVE_POWER_FLOOR));
  const competitorBPower = Math.max(EFFECTIVE_POWER_FLOOR, numberOr(competitorB.effectivePower, EFFECTIVE_POWER_FLOOR));
  const denominator = competitorAPower + competitorBPower;
  const rawCompetitorAWinProbability = denominator > 0 ? competitorAPower / denominator : 0.5;
  const adjustedCompetitorAPower = competitorAPower ** MATCH_OUTCOME_TUNING.winProbabilityPowerExponent;
  const adjustedCompetitorBPower = competitorBPower ** MATCH_OUTCOME_TUNING.winProbabilityPowerExponent;
  const adjustedDenominator = adjustedCompetitorAPower + adjustedCompetitorBPower;
  const adjustedCompetitorAWinProbability = adjustedDenominator > 0 ? adjustedCompetitorAPower / adjustedDenominator : 0.5;
  const competitorAWinProbability = clamp(
    adjustedCompetitorAWinProbability,
    MATCH_OUTCOME_TUNING.minWinProbability,
    MATCH_OUTCOME_TUNING.maxWinProbability,
  );

  return {
    competitorAId: competitorA.competitorId,
    competitorBId: competitorB.competitorId,
    competitorAPower,
    competitorBPower,
    rawCompetitorAWinProbability,
    competitorAWinProbability,
    competitorBWinProbability: 1 - competitorAWinProbability,
  };
}

export function resolveMatchOutcomePreview(
  competitorA: Wrestler | Wrestler[],
  competitorB: Wrestler | Wrestler[],
  context: EffectiveMatchPowerContext & { seed?: string } = {},
): MatchOutcomePreview {
  const powerA = calculateEffectiveMatchPower(competitorA, context);
  const powerB = calculateEffectiveMatchPower(competitorB, context);
  const probability = calculateMatchupWinProbability(powerA, powerB);
  const seed = context.seed ?? `${powerA.competitorId}-vs-${powerB.competitorId}-${context.segmentCatalogId ?? context.type ?? "match"}-${context.stipulationId ?? "standard"}`;
  const roll = seededUnitRoll(seed);
  const winnerId = roll < probability.competitorAWinProbability ? powerA.competitorId : powerB.competitorId;
  const loserId = winnerId === powerA.competitorId ? powerB.competitorId : powerA.competitorId;

  return {
    ...probability,
    seed,
    roll,
    winnerId,
    loserId,
    competitorA: powerA,
    competitorB: powerB,
  };
}

export function applyMatchRatingProgression(wrestler: Wrestler, input: MatchRatingProgressionInput): MatchRatings {
  const current = ensureMatchRatings(wrestler);
  const biases = getStyleBiases(wrestler);
  const scoreAdjustment = input.resultScore === undefined ? 0 : input.resultScore >= 90 ? 0.6 : input.resultScore >= 75 ? 0.3 : input.resultScore < 55 ? -0.6 : -0.2;
  const segmentDeltas = (input.segmentTypes ?? []).reduce<Partial<Record<MatchRatingKey, number>>>((deltas, type) => {
    if (type === "Match" || type === "Open Challenge") {
      deltas.timing = (deltas.timing ?? 0) + 0.25;
      deltas.stamina = (deltas.stamina ?? 0) + 0.2;
      deltas.resilience = (deltas.resilience ?? 0) + 0.15;
    }

    if (type === "Promo" || type === "Contract Signing") {
      deltas.psychology = (deltas.psychology ?? 0) + 0.2;
      deltas.clutch = (deltas.clutch ?? 0) + 0.15;
    }

    return deltas;
  }, {});

  return matchRatingKeys.reduce<MatchRatings>((ratings, key) => {
    const requestedDelta = input.deltas?.[key] ?? 0;
    const segmentDelta = segmentDeltas[key] ?? 0;
    const styleBias = Math.max(-0.2, Math.min(0.2, (biases[key] ?? 0) / 40));
    const rawDelta = requestedDelta + segmentDelta + scoreAdjustment + (requestedDelta + segmentDelta + scoreAdjustment > 0 ? styleBias : 0);
    const lowRatingMultiplier =
      rawDelta > 0 && current[key] < MATCH_PROGRESSION_TUNING.lowRatingGrowthBiasBelow
        ? MATCH_PROGRESSION_TUNING.lowRatingGrowthMultiplier
        : 1;
    const topEndMultiplier =
      rawDelta > 0 && current[key] >= MATCH_PROGRESSION_TUNING.topEndGrowthDiminishingStrongStart
        ? MATCH_PROGRESSION_TUNING.topEndGrowthStrongMultiplier
        : rawDelta > 0 && current[key] >= MATCH_PROGRESSION_TUNING.topEndGrowthDiminishingStart
          ? MATCH_PROGRESSION_TUNING.topEndGrowthMultiplier
          : 1;
    const lowEndRegressionMultiplier =
      rawDelta < 0 && current[key] <= MATCH_PROGRESSION_TUNING.lowEndRegressionDiminishingStrongStart
        ? MATCH_PROGRESSION_TUNING.lowEndRegressionStrongMultiplier
        : rawDelta < 0 && current[key] <= MATCH_PROGRESSION_TUNING.lowEndRegressionDiminishingStart
          ? MATCH_PROGRESSION_TUNING.lowEndRegressionMultiplier
          : 1;
    const regressionMultiplier = rawDelta < 0 ? MATCH_PROGRESSION_TUNING.regressionMultiplier : 1;
    const gradualDelta = Math.max(-2, Math.min(2, rawDelta * lowRatingMultiplier * topEndMultiplier * lowEndRegressionMultiplier * regressionMultiplier));

    ratings[key] = clampRating(current[key] + gradualDelta);
    return ratings;
  }, {} as MatchRatings);
}
