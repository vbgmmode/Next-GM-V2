import { calculateEffectiveMatchPower, calculateMatchupWinProbability } from "./matchRatings";
import { createPlayableRunShowOptions, isValidSegment, runShow } from "./scoring";
import { getStipulationById } from "./stipulationCatalog";
import type {
  GameState,
  MatchOutcomeModel,
  MatchRatingsProgressionMode,
  Segment,
  SegmentResult,
  Wrestler,
} from "./types";

export type MatchSimulationLabStructure = "singles" | "tag_2v2" | "three_way" | "four_way";

export type MatchSimulationLabInput = {
  game: GameState;
  participantIds: string[];
  matchStructure: MatchSimulationLabStructure;
  stipulationId?: string;
  iterations?: number;
  baseSeed?: string;
  model?: MatchOutcomeModel;
  progression?: MatchRatingsProgressionMode;
};

export type MatchSimulationLabDistributionRow = {
  id: string;
  label: string;
  participantIds: string[];
  count: number;
  actualProbability: number;
  expectedProbability?: number;
  deltaFromExpected?: number;
  averageEffectivePower?: number;
};

export type MatchSimulationLabFallbackSummary = {
  total: number;
  reasons: Record<string, number>;
};

export type MatchSimulationLabWarning = {
  code:
    | "favoriteWinsTooOften"
    | "underdogWinsTooOften"
    | "stipulationHasLowOutcomeImpact"
    | "fallTakerTooConcentrated"
    | "tooManyFallbacks"
    | "missingMatchRatingsHydrated";
  severity: "info" | "warning";
  message: string;
};

export type MatchSimulationLabUpsetExample = {
  iteration: number;
  winnerId: string;
  winnerLabel: string;
  expectedWinnerId?: string;
  expectedWinnerLabel?: string;
  winnerExpectedProbability?: number;
  expectedWinnerProbability?: number;
  upsetMargin: number;
  deterministicRoll?: number;
  seed?: string;
};

export type MatchSimulationLabResult = {
  input: {
    participantIds: string[];
    matchStructure: MatchSimulationLabStructure;
    stipulationId?: string;
    iterations: number;
    baseSeed: string;
    model: MatchOutcomeModel;
    progression: MatchRatingsProgressionMode;
  };
  iterations: number;
  successfulIterations: number;
  participantBreakdown: Array<{
    id: string;
    label: string;
    averageEffectivePower: number;
    expectedProbability?: number;
    teamId?: string;
  }>;
  teamBreakdown: Array<{
    id: string;
    label: string;
    participantIds: string[];
    averageEffectivePower: number;
    expectedProbability: number;
  }>;
  winnerDistribution: MatchSimulationLabDistributionRow[];
  fallTakerDistribution: MatchSimulationLabDistributionRow[];
  protectedParticipantDistribution: MatchSimulationLabDistributionRow[];
  upsetRate: number;
  largestUpsetExamples: MatchSimulationLabUpsetExample[];
  fallbackCounts: MatchSimulationLabFallbackSummary;
  warnings: MatchSimulationLabWarning[];
};

type ExpectedCompetitor = {
  id: string;
  label: string;
  participantIds: string[];
  expectedProbability: number;
  averageEffectivePower: number;
};

type SimulationIterationSummary = {
  iteration: number;
  result?: SegmentResult;
  winnerCompetitorId?: string;
  fallbackReason?: string;
};

const DEFAULT_ITERATIONS = 1000;
const MAX_ITERATIONS = 5000;
const DEFAULT_BASE_SEED = "match-simulation-lab";
const FAVORITE_DELTA_WARNING_THRESHOLD = 0.12;
const UNDERDOG_DELTA_WARNING_THRESHOLD = 0.12;
const STIPULATION_IMPACT_WARNING_THRESHOLD = 0.015;
const FALL_TAKER_CONCENTRATION_THRESHOLD = 0.78;
const FALLBACK_WARNING_RATE = 0.05;

const matchStructureConfig: Record<
  MatchSimulationLabStructure,
  {
    catalogId: string;
    label: string;
    participantCount: number;
    durationMinutes: number;
  }
> = {
  singles: {
    catalogId: "M001",
    label: "Singles Match",
    participantCount: 2,
    durationMinutes: 12,
  },
  tag_2v2: {
    catalogId: "M020",
    label: "2v2 Tag Match",
    participantCount: 4,
    durationMinutes: 12,
  },
  three_way: {
    catalogId: "M002",
    label: "Triple Threat",
    participantCount: 3,
    durationMinutes: 13,
  },
  four_way: {
    catalogId: "M003",
    label: "Fatal 4-Way",
    participantCount: 4,
    durationMinutes: 14,
  },
};

export const matchSimulationLabStructures = Object.keys(matchStructureConfig) as MatchSimulationLabStructure[];

export const matchSimulationLabStipulationIds = [
  undefined,
  "submission_match",
  "no_dq",
  "extreme_rules",
  "street_fight",
  "ladder_match",
  "iron_man",
] as const;

function clampIterationCount(iterations?: number) {
  if (typeof iterations !== "number" || !Number.isFinite(iterations)) {
    return DEFAULT_ITERATIONS;
  }

  return Math.max(1, Math.min(MAX_ITERATIONS, Math.round(iterations)));
}

function round(value: number, precision = 4) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function cloneGame(game: GameState): GameState {
  return typeof structuredClone === "function" ? structuredClone(game) : JSON.parse(JSON.stringify(game));
}

function getParticipantCount(matchStructure: MatchSimulationLabStructure) {
  return matchStructureConfig[matchStructure].participantCount;
}

function getParticipantName(game: GameState, wrestlerId: string) {
  return game.wrestlers.find((wrestler) => wrestler.id === wrestlerId)?.name ?? wrestlerId;
}

function getParticipants(game: GameState, participantIds: string[]) {
  return participantIds
    .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function buildLabSegment(input: MatchSimulationLabInput, iteration: number): Segment {
  const config = matchStructureConfig[input.matchStructure];
  const baseSeed = input.baseSeed?.trim() || DEFAULT_BASE_SEED;

  return {
    id: `match-sim-lab-${baseSeed}-${input.matchStructure}-${iteration}`,
    type: "Match",
    participantIds: input.participantIds.slice(0, config.participantCount),
    segmentCatalogId: config.catalogId,
    segmentDisplayName: config.label,
    durationMinutes: config.durationMinutes,
    participantMin: config.participantCount,
    participantMax: config.participantCount,
    stipulationId: input.stipulationId || undefined,
  };
}

function buildPowerContext(input: MatchSimulationLabInput) {
  return {
    type: "Match" as const,
    segmentCatalogId: matchStructureConfig[input.matchStructure].catalogId,
    stipulationId: input.stipulationId || undefined,
    showType: "tv" as const,
    cardPosition: "main_event" as const,
    isTitleMatch: false,
    isRivalryMatch: false,
  };
}

function getExpectedCompetitors(input: MatchSimulationLabInput): ExpectedCompetitor[] {
  const participantIds = input.participantIds.slice(0, getParticipantCount(input.matchStructure));
  const participants = getParticipants(input.game, participantIds);
  const context = buildPowerContext(input);

  if (participants.length !== participantIds.length) {
    return [];
  }

  if (input.matchStructure === "tag_2v2") {
    const teamA = participants.slice(0, 2);
    const teamB = participants.slice(2, 4);
    const teamAPower = calculateEffectiveMatchPower(teamA, context);
    const teamBPower = calculateEffectiveMatchPower(teamB, context);
    const probability = calculateMatchupWinProbability(teamAPower, teamBPower);

    return [
      {
        id: teamAPower.competitorId,
        label: teamA.map((wrestler) => wrestler.name).join(" / "),
        participantIds: teamA.map((wrestler) => wrestler.id),
        expectedProbability: probability.competitorAWinProbability,
        averageEffectivePower: teamAPower.effectivePower,
      },
      {
        id: teamBPower.competitorId,
        label: teamB.map((wrestler) => wrestler.name).join(" / "),
        participantIds: teamB.map((wrestler) => wrestler.id),
        expectedProbability: probability.competitorBWinProbability,
        averageEffectivePower: teamBPower.effectivePower,
      },
    ];
  }

  if (input.matchStructure === "singles") {
    const firstPower = calculateEffectiveMatchPower(participants[0], context);
    const secondPower = calculateEffectiveMatchPower(participants[1], context);
    const probability = calculateMatchupWinProbability(firstPower, secondPower);

    return [
      {
        id: participants[0].id,
        label: participants[0].name,
        participantIds: [participants[0].id],
        expectedProbability: probability.competitorAWinProbability,
        averageEffectivePower: firstPower.effectivePower,
      },
      {
        id: participants[1].id,
        label: participants[1].name,
        participantIds: [participants[1].id],
        expectedProbability: probability.competitorBWinProbability,
        averageEffectivePower: secondPower.effectivePower,
      },
    ];
  }

  const powers = participants.map((wrestler) => ({
    wrestler,
    power: calculateEffectiveMatchPower(wrestler, context),
  }));
  const totalPower = powers.reduce((sum, entry) => sum + Math.max(0.01, entry.power.effectivePower), 0);

  return powers.map(({ wrestler, power }) => ({
    id: wrestler.id,
    label: wrestler.name,
    participantIds: [wrestler.id],
    expectedProbability: Math.max(0.01, power.effectivePower) / totalPower,
    averageEffectivePower: power.effectivePower,
  }));
}

function getWinnerCompetitorId(matchStructure: MatchSimulationLabStructure, result: SegmentResult) {
  if (matchStructure === "tag_2v2") {
    const teamIds = result.internalOutcomeAudit?.winningTeamParticipantIds;
    return teamIds?.length ? teamIds.join("+") : undefined;
  }

  return result.winnerId;
}

function increment(map: Map<string, number>, id?: string) {
  if (!id) {
    return;
  }

  map.set(id, (map.get(id) ?? 0) + 1);
}

function incrementReason(summary: MatchSimulationLabFallbackSummary, reason: string) {
  summary.total += 1;
  summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1;
}

function createDistributionRows(
  counts: Map<string, number>,
  successfulIterations: number,
  expectedCompetitors: ExpectedCompetitor[],
  labelForId: (id: string) => { label: string; participantIds: string[] },
): MatchSimulationLabDistributionRow[] {
  return [...counts.entries()]
    .map(([id, count]) => {
      const expected = expectedCompetitors.find((entry) => entry.id === id || entry.participantIds.includes(id));
      const { label, participantIds } = labelForId(id);
      const actualProbability = successfulIterations ? count / successfulIterations : 0;
      return {
        id,
        label,
        participantIds,
        count,
        actualProbability: round(actualProbability),
        expectedProbability: expected ? round(expected.expectedProbability) : undefined,
        deltaFromExpected: expected ? round(actualProbability - expected.expectedProbability) : undefined,
        averageEffectivePower: expected ? round(expected.averageEffectivePower, 2) : undefined,
      };
    })
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function getParticipantBreakdown(input: MatchSimulationLabInput, expectedCompetitors: ExpectedCompetitor[]) {
  const participantIds = input.participantIds.slice(0, getParticipantCount(input.matchStructure));
  const participantTeamMap = new Map<string, ExpectedCompetitor>();
  expectedCompetitors.forEach((competitor) => {
    competitor.participantIds.forEach((id) => participantTeamMap.set(id, competitor));
  });

  return participantIds.map((id) => {
    const wrestler = input.game.wrestlers.find((candidate) => candidate.id === id);
    const participantPower = wrestler ? calculateEffectiveMatchPower(wrestler, buildPowerContext(input)).effectivePower : 0;
    const expected = participantTeamMap.get(id);

    return {
      id,
      label: getParticipantName(input.game, id),
      averageEffectivePower: round(participantPower, 2),
      expectedProbability: input.matchStructure === "tag_2v2" ? undefined : expected ? round(expected.expectedProbability) : undefined,
      teamId: input.matchStructure === "tag_2v2" ? expected?.id : undefined,
    };
  });
}

function getUpsetExample(
  summary: SimulationIterationSummary,
  expectedCompetitors: ExpectedCompetitor[],
): MatchSimulationLabUpsetExample | undefined {
  if (!summary.result || !summary.winnerCompetitorId) {
    return undefined;
  }

  const expectedWinner = expectedCompetitors.reduce<ExpectedCompetitor | undefined>(
    (best, candidate) => (!best || candidate.expectedProbability > best.expectedProbability ? candidate : best),
    undefined,
  );
  const actualWinner = expectedCompetitors.find((candidate) => candidate.id === summary.winnerCompetitorId);

  if (!expectedWinner || !actualWinner || expectedWinner.id === actualWinner.id) {
    return undefined;
  }

  return {
    iteration: summary.iteration,
    winnerId: actualWinner.id,
    winnerLabel: actualWinner.label,
    expectedWinnerId: expectedWinner.id,
    expectedWinnerLabel: expectedWinner.label,
    winnerExpectedProbability: round(actualWinner.expectedProbability),
    expectedWinnerProbability: round(expectedWinner.expectedProbability),
    upsetMargin: round(expectedWinner.expectedProbability - actualWinner.expectedProbability),
    deterministicRoll: summary.result.internalOutcomeAudit?.deterministicRoll,
    seed: summary.result.internalOutcomeAudit?.seed,
  };
}

function buildWarnings(input: MatchSimulationLabInput, result: Omit<MatchSimulationLabResult, "warnings">): MatchSimulationLabWarning[] {
  const warnings: MatchSimulationLabWarning[] = [];
  const favorite = result.winnerDistribution.reduce<MatchSimulationLabDistributionRow | undefined>(
    (best, candidate) => (!best || (candidate.expectedProbability ?? 0) > (best.expectedProbability ?? 0) ? candidate : best),
    undefined,
  );

  if (favorite?.expectedProbability !== undefined && favorite.actualProbability - favorite.expectedProbability > FAVORITE_DELTA_WARNING_THRESHOLD) {
    warnings.push({
      code: "favoriteWinsTooOften",
      severity: "warning",
      message: `${favorite.label} is winning ${round((favorite.actualProbability - favorite.expectedProbability) * 100, 1)} percentage points above expected.`,
    });
  }

  const underdogOverperformer = result.winnerDistribution.find(
    (row) => row.id !== favorite?.id && row.expectedProbability !== undefined && row.actualProbability - row.expectedProbability > UNDERDOG_DELTA_WARNING_THRESHOLD,
  );

  if (underdogOverperformer?.expectedProbability !== undefined) {
    warnings.push({
      code: "underdogWinsTooOften",
      severity: "warning",
      message: `${underdogOverperformer.label} is winning ${round((underdogOverperformer.actualProbability - underdogOverperformer.expectedProbability) * 100, 1)} percentage points above expected.`,
    });
  }

  if (input.stipulationId) {
    const standardExpected = getExpectedCompetitors({ ...input, stipulationId: undefined });
    const maxShift = Math.max(
      0,
      ...result.teamBreakdown.map((competitor) => {
        const baseline = standardExpected.find((entry) => entry.id === competitor.id);
        return baseline ? Math.abs(competitor.expectedProbability - baseline.expectedProbability) : 0;
      }),
    );

    if (maxShift < STIPULATION_IMPACT_WARNING_THRESHOLD) {
      warnings.push({
        code: "stipulationHasLowOutcomeImpact",
        severity: "info",
        message: `${getStipulationById(input.stipulationId)?.label ?? input.stipulationId} changes expected outcome by less than ${round(STIPULATION_IMPACT_WARNING_THRESHOLD * 100, 1)} percentage points.`,
      });
    }
  }

  const topFallTaker = result.fallTakerDistribution[0];
  if (topFallTaker && result.fallTakerDistribution.length > 1 && topFallTaker.actualProbability > FALL_TAKER_CONCENTRATION_THRESHOLD) {
    warnings.push({
      code: "fallTakerTooConcentrated",
      severity: "warning",
      message: `${topFallTaker.label} is taking ${round(topFallTaker.actualProbability * 100, 1)}% of falls.`,
    });
  }

  if (result.fallbackCounts.total / result.iterations > FALLBACK_WARNING_RATE) {
    warnings.push({
      code: "tooManyFallbacks",
      severity: "warning",
      message: `${result.fallbackCounts.total} of ${result.iterations} iterations used fallback or failed resolution paths.`,
    });
  }

  const missingRatings = getParticipants(input.game, input.participantIds).filter((wrestler) => !wrestler.matchRatings);
  if (missingRatings.length) {
    warnings.push({
      code: "missingMatchRatingsHydrated",
      severity: "info",
      message: `${missingRatings.map((wrestler) => wrestler.name).join(", ")} used derived match ratings for lab hydration.`,
    });
  }

  return warnings;
}

function runSingleIteration(input: MatchSimulationLabInput, iteration: number): SimulationIterationSummary {
  const labGame = cloneGame(input.game);
  const segment = buildLabSegment(input, iteration);
  labGame.currentShow = [segment];
  labGame.currentWeek = input.game.currentWeek;

  const participantCount = segment.participantIds.filter((id) => labGame.wrestlers.some((wrestler) => wrestler.id === id)).length;

  if (participantCount !== segment.participantIds.length) {
    return {
      iteration,
      fallbackReason: "missingParticipant",
    };
  }

  if (!isValidSegment(segment, labGame.wrestlers)) {
    return {
      iteration,
      fallbackReason: "invalidOrFilteredSegment",
    };
  }

  let result: SegmentResult | undefined;

  try {
    const resolved = runShow(labGame, {
      ...createPlayableRunShowOptions(),
      matchOutcomeModel: input.model ?? "deepRatings",
      matchRatingsProgression: input.progression ?? "disabled",
    });
    result = resolved.result.segmentResults.find((segmentResult) => segmentResult.segmentId === segment.id);
  } catch (error) {
    const errorName = error instanceof Error && error.name ? error.name : "unknown";
    return {
      iteration,
      fallbackReason: `runShowError:${errorName}`,
    };
  }

  return {
    iteration,
    result,
    winnerCompetitorId: result ? getWinnerCompetitorId(input.matchStructure, result) : undefined,
    fallbackReason: result?.internalOutcomeAudit?.fallbackReason ?? (result ? undefined : "invalidOrFilteredSegment"),
  };
}

export function runMatchSimulationLab(input: MatchSimulationLabInput): MatchSimulationLabResult {
  const iterations = clampIterationCount(input.iterations);
  const resolvedInput = {
    participantIds: input.participantIds.slice(0, getParticipantCount(input.matchStructure)),
    matchStructure: input.matchStructure,
    stipulationId: input.stipulationId || undefined,
    iterations,
    baseSeed: input.baseSeed?.trim() || DEFAULT_BASE_SEED,
    model: input.model ?? "deepRatings",
    progression: input.progression ?? "disabled",
  };
  const expectedCompetitors = getExpectedCompetitors({ ...input, ...resolvedInput });
  const winnerCounts = new Map<string, number>();
  const fallTakerCounts = new Map<string, number>();
  const protectedParticipantCounts = new Map<string, number>();
  const fallbackCounts: MatchSimulationLabFallbackSummary = { total: 0, reasons: {} };
  const summaries: SimulationIterationSummary[] = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const summary = runSingleIteration({ ...input, ...resolvedInput }, iteration);
    summaries.push(summary);

    if (summary.fallbackReason) {
      incrementReason(fallbackCounts, summary.fallbackReason);
    }

    if (summary.result) {
      increment(winnerCounts, summary.winnerCompetitorId);
      increment(fallTakerCounts, summary.result.internalOutcomeAudit?.fallTakerId);
      summary.result.internalOutcomeAudit?.protectedParticipantIds?.forEach((id) => increment(protectedParticipantCounts, id));
    }
  }

  const successfulIterations = summaries.filter((summary) => summary.result).length;
  const labelForCompetitor = (id: string) => {
    const expected = expectedCompetitors.find((entry) => entry.id === id);
    return expected ? { label: expected.label, participantIds: expected.participantIds } : { label: getParticipantName(input.game, id), participantIds: [id] };
  };
  const labelForParticipant = (id: string) => ({ label: getParticipantName(input.game, id), participantIds: [id] });
  const winnerDistribution = createDistributionRows(winnerCounts, successfulIterations, expectedCompetitors, labelForCompetitor);
  const fallTakerDistribution = createDistributionRows(fallTakerCounts, successfulIterations, expectedCompetitors, labelForParticipant);
  const protectedParticipantDistribution = createDistributionRows(protectedParticipantCounts, successfulIterations, expectedCompetitors, labelForParticipant);
  const upsetExamples = summaries
    .map((summary) => getUpsetExample(summary, expectedCompetitors))
    .filter((example): example is MatchSimulationLabUpsetExample => Boolean(example))
    .sort((left, right) => right.upsetMargin - left.upsetMargin || left.iteration - right.iteration)
    .slice(0, 5);
  const resultWithoutWarnings = {
    input: resolvedInput,
    iterations,
    successfulIterations,
    participantBreakdown: getParticipantBreakdown({ ...input, ...resolvedInput }, expectedCompetitors),
    teamBreakdown: expectedCompetitors.map((competitor) => ({
      id: competitor.id,
      label: competitor.label,
      participantIds: competitor.participantIds,
      averageEffectivePower: round(competitor.averageEffectivePower, 2),
      expectedProbability: round(competitor.expectedProbability),
    })),
    winnerDistribution,
    fallTakerDistribution,
    protectedParticipantDistribution,
    upsetRate: round(successfulIterations ? summaries.filter((summary) => getUpsetExample(summary, expectedCompetitors)).length / successfulIterations : 0),
    largestUpsetExamples: upsetExamples,
    fallbackCounts,
  };

  return {
    ...resultWithoutWarnings,
    warnings: buildWarnings({ ...input, ...resolvedInput }, resultWithoutWarnings),
  };
}
