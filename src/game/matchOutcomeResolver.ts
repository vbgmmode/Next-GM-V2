import type {
  GameState,
  MatchOutcomeInternalAudit,
  MatchOutcomeModel,
  Segment,
  SegmentResult,
  ShowType,
  Wrestler,
} from "./types";
import {
  calculateEffectiveMatchPower,
  calculateMatchupWinProbability,
  ensureMatchRatings,
  type EffectiveMatchPowerBreakdown,
  type EffectiveMatchPowerContext,
  resolveMatchOutcomePreview,
} from "./matchRatings";
import { MATCH_FALL_TAKER_TUNING, MATCH_OUTCOME_TUNING } from "./matchTuning";

export type SegmentWinnerSelectionContext = {
  segmentIndex: number;
  segmentCount: number;
  showType: ShowType;
  matchOutcomeModel: MatchOutcomeModel;
  isNoContest: boolean;
};

export function resolveSegmentWinnerSelection(
  segment: Segment,
  game: GameState,
  context: SegmentWinnerSelectionContext,
): { segment: Segment; audit: MatchOutcomeInternalAudit } {
  if (context.isNoContest) {
    return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "noContest") };
  }

  if (segment.winnerId && segment.participantIds.includes(segment.winnerId)) {
    return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "manualWinner") };
  }

  if (context.matchOutcomeModel !== "deepRatings") {
    return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "modelLegacy") };
  }

  if (segment.type !== "Match") {
    return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "unsupportedSegmentType") };
  }

  if (segment.segmentCatalogId === "M020") {
    const tagOutcome = resolveTagDeepRatingsOutcome(segment, game, context);
    return tagOutcome ?? { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "tagOrMultiPersonUnsupported") };
  }

  if (isStandardMultiPersonDeepRatingsSegment(segment)) {
    const multiOutcome = resolveMultiPersonDeepRatingsOutcome(segment, game, context);
    return multiOutcome ?? { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "tagOrMultiPersonUnsupported") };
  }

  if (segment.participantIds.length !== 2) {
    return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "tagOrMultiPersonUnsupported") };
  }

  const competitors = segment.participantIds.map((id) => game.wrestlers.find((wrestler) => wrestler.id === id));

  if (!competitors.every((wrestler): wrestler is Wrestler => Boolean(wrestler))) {
    return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "missingCompetitorData") };
  }

  const [competitorA, competitorB] = competitors;
  const seed = [
    "deep-ratings",
    game.seasonNumber,
    game.currentWeek,
    segment.id,
    context.segmentIndex,
    competitorA.id,
    competitorB.id,
    segment.segmentCatalogId ?? "match",
    segment.stipulationId ?? "standard",
  ].join("-");

  try {
    const preview = resolveMatchOutcomePreview(competitorA, competitorB, {
      type: segment.type,
      segmentCatalogId: segment.segmentCatalogId,
      stipulationId: segment.stipulationId,
      championshipId: segment.championshipId,
      rivalryId: segment.rivalryId,
      showType: context.showType,
      cardPosition: getCardPosition(context.segmentIndex, context.segmentCount),
      isTitleMatch: Boolean(segment.championshipId),
      isRivalryMatch: Boolean(segment.rivalryId),
      seed,
    });

    if (!segment.participantIds.includes(preview.winnerId)) {
      return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "invalidDeepRatingsWinner") };
    }

    return {
      segment: {
        ...segment,
        winnerId: preview.winnerId,
      },
      audit: {
        model: "deepRatings",
        outcomeModel: "deepRatings",
        outcomeStructure: "singles",
        eligible: true,
        selectedWinnerId: preview.winnerId,
        competitorAId: competitorA.id,
        competitorBId: competitorB.id,
        competitorAEffectivePower: preview.competitorAPower,
        competitorBEffectivePower: preview.competitorBPower,
        competitorAWinProbability: preview.competitorAWinProbability,
        competitorBWinProbability: preview.competitorBWinProbability,
        deterministicRoll: preview.roll,
        seed: preview.seed,
      },
    };
  } catch {
    return { segment, audit: legacyWinnerAudit(segment, game.wrestlers, "deepRatingsError") };
  }
}

export function isStandardMultiPersonDeepRatingsSegment(segment: Pick<Segment | SegmentResult, "type" | "segmentCatalogId" | "participantIds">) {
  return (
    segment.type === "Match" &&
    ((segment.segmentCatalogId === "M002" && segment.participantIds.length === 3) ||
      (segment.segmentCatalogId === "M003" && segment.participantIds.length === 4)) &&
    new Set(segment.participantIds).size === segment.participantIds.length
  );
}

function resolveTagDeepRatingsOutcome(
  segment: Segment,
  game: GameState,
  context: SegmentWinnerSelectionContext,
): { segment: Segment; audit: MatchOutcomeInternalAudit } | undefined {
  if (!isSafeStandardTagSegment(segment)) {
    return undefined;
  }

  const teams = getTagMatchTeams(segment);

  if (!teams) {
    return undefined;
  }

  const teamA = getWrestlersByIds(teams.teamAIds, game.wrestlers);
  const teamB = getWrestlersByIds(teams.teamBIds, game.wrestlers);

  if (!allWrestlersPresent(teamA) || !allWrestlersPresent(teamB)) {
    return undefined;
  }

  const powerContext = getOutcomePowerContext(segment, context);
  const teamAPower = calculateEffectiveMatchPower(teamA, powerContext);
  const teamBPower = calculateEffectiveMatchPower(teamB, powerContext);
  const probability = calculateMatchupWinProbability(teamAPower, teamBPower);
  const seed = [
    "deep-ratings-tag",
    game.seasonNumber,
    game.currentWeek,
    segment.id,
    context.segmentIndex,
    teams.teamAIds.join("+"),
    teams.teamBIds.join("+"),
    segment.segmentCatalogId ?? "match",
    segment.stipulationId ?? "standard",
  ].join("-");
  const roll = seededOutcomeRoll(seed);
  const teamAWins = roll < probability.competitorAWinProbability;
  const winningTeam = teamAWins ? teamA : teamB;
  const losingTeam = teamAWins ? teamB : teamA;
  const winningTeamParticipantIds = winningTeam.map((wrestler) => wrestler.id);
  const losingTeamParticipantIds = losingTeam.map((wrestler) => wrestler.id);
  const fallWinner = weightedDeterministicPick(winningTeam, (wrestler) => getFallWinnerWeight(wrestler, powerContext), `${seed}-fall-winner`)?.item;
  const fallTaker = weightedDeterministicPick(losingTeam, (wrestler) => getFallTakerWeight(wrestler, powerContext), `${seed}-fall-taker`)?.item;

  if (!fallWinner || !fallTaker) {
    return undefined;
  }

  const protectedParticipantIds = losingTeamParticipantIds.filter((id) => id !== fallTaker.id);

  return {
    segment: {
      ...segment,
      winnerId: fallWinner.id,
    },
    audit: {
      model: "deepRatings",
      outcomeModel: "deepRatings",
      outcomeStructure: "tag",
      eligible: true,
      selectedWinnerId: fallWinner.id,
      selectedWinningSide: teamAWins ? "teamA" : "teamB",
      winningTeamParticipantIds,
      losingTeamParticipantIds,
      fallWinnerId: fallWinner.id,
      fallTakerId: fallTaker.id,
      protectedParticipantIds,
      teamPowerBreakdown: [
        {
          side: "teamA",
          participantIds: teams.teamAIds,
          effectivePower: roundAuditNumber(teamAPower.effectivePower),
          memberEffectivePowers: getMemberPowerMap(teamAPower),
        },
        {
          side: "teamB",
          participantIds: teams.teamBIds,
          effectivePower: roundAuditNumber(teamBPower.effectivePower),
          memberEffectivePowers: getMemberPowerMap(teamBPower),
        },
      ],
      teamWinProbabilityBreakdown: [
        {
          side: "teamA",
          participantIds: teams.teamAIds,
          winProbability: roundAuditNumber(probability.competitorAWinProbability),
        },
        {
          side: "teamB",
          participantIds: teams.teamBIds,
          winProbability: roundAuditNumber(probability.competitorBWinProbability),
        },
      ],
      competitorAId: teamAPower.competitorId,
      competitorBId: teamBPower.competitorId,
      competitorAEffectivePower: teamAPower.effectivePower,
      competitorBEffectivePower: teamBPower.effectivePower,
      competitorAWinProbability: probability.competitorAWinProbability,
      competitorBWinProbability: probability.competitorBWinProbability,
      deterministicRoll: roll,
      seed,
    },
  };
}

function resolveMultiPersonDeepRatingsOutcome(
  segment: Segment,
  game: GameState,
  context: SegmentWinnerSelectionContext,
): { segment: Segment; audit: MatchOutcomeInternalAudit } | undefined {
  if (!isStandardMultiPersonDeepRatingsSegment(segment)) {
    return undefined;
  }

  const competitors = getWrestlersByIds(segment.participantIds, game.wrestlers);

  if (!allWrestlersPresent(competitors)) {
    return undefined;
  }

  const powerContext = getOutcomePowerContext(segment, context);
  const participantPowers = competitors.map((wrestler) => ({
    wrestler,
    power: calculateEffectiveMatchPower(wrestler, powerContext),
  }));
  const seed = [
    "deep-ratings-multi",
    game.seasonNumber,
    game.currentWeek,
    segment.id,
    context.segmentIndex,
    segment.participantIds.join("+"),
    segment.segmentCatalogId ?? "match",
    segment.stipulationId ?? "standard",
  ].join("-");
  const winnerPick = weightedDeterministicPick(participantPowers, ({ power }) => power.effectivePower ** MATCH_OUTCOME_TUNING.multiPersonPowerExponent, seed);
  const winner = winnerPick?.item.wrestler;

  if (!winner || winnerPick === undefined) {
    return undefined;
  }

  const nonWinners = competitors.filter((wrestler) => wrestler.id !== winner.id);
  const fallTaker = weightedDeterministicPick(nonWinners, (wrestler) => getFallTakerWeight(wrestler, powerContext), `${seed}-fall-taker`)?.item;

  if (!fallTaker) {
    return undefined;
  }

  const totalPower = participantPowers.reduce((sum, entry) => sum + Math.max(0.01, entry.power.effectivePower), 0);
  const protectedParticipantIds = nonWinners.filter((wrestler) => wrestler.id !== fallTaker.id).map((wrestler) => wrestler.id);

  return {
    segment: {
      ...segment,
      winnerId: winner.id,
    },
    audit: {
      model: "deepRatings",
      outcomeModel: "deepRatings",
      outcomeStructure: "multiPerson",
      eligible: true,
      selectedWinnerId: winner.id,
      winnerId: winner.id,
      fallTakerId: fallTaker.id,
      protectedParticipantIds,
      participantPowerBreakdown: participantPowers.map(({ wrestler, power }) => ({
        participantId: wrestler.id,
        effectivePower: roundAuditNumber(power.effectivePower),
      })),
      participantWinProbabilityBreakdown: participantPowers.map(({ wrestler, power }) => ({
        participantId: wrestler.id,
        winProbability: roundAuditNumber(Math.max(0.01, power.effectivePower) / totalPower),
      })),
      deterministicRoll: winnerPick.roll,
      seed,
    },
  };
}

function legacyWinnerAudit(segment: Segment, wrestlers: Wrestler[], fallbackReason: string): MatchOutcomeInternalAudit {
  return {
    model: "legacy",
    outcomeModel: "legacy",
    eligible: false,
    fallbackReason,
    selectedWinnerId: getSegmentWinner(segment, wrestlers)?.id,
  };
}

function getOutcomePowerContext(segment: Segment, context: SegmentWinnerSelectionContext): EffectiveMatchPowerContext {
  return {
    type: segment.type,
    segmentCatalogId: segment.segmentCatalogId,
    stipulationId: segment.stipulationId,
    championshipId: segment.championshipId,
    rivalryId: segment.rivalryId,
    showType: context.showType,
    cardPosition: getCardPosition(context.segmentIndex, context.segmentCount),
    isTitleMatch: Boolean(segment.championshipId),
    isRivalryMatch: Boolean(segment.rivalryId),
  };
}

function isSafeStandardTagSegment(segment: Pick<Segment | SegmentResult, "type" | "segmentCatalogId" | "participantIds">) {
  return segment.type === "Match" && segment.segmentCatalogId === "M020" && segment.participantIds.length === 4 && new Set(segment.participantIds).size === 4;
}

function getWrestlersByIds(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id));
}

function allWrestlersPresent(wrestlers: Array<Wrestler | undefined>): wrestlers is Wrestler[] {
  return wrestlers.every((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function roundAuditNumber(value: number) {
  return Math.round(value * 10000) / 10000;
}

function getMemberPowerMap(power: EffectiveMatchPowerBreakdown) {
  return Object.fromEntries(power.members.map((member) => [member.wrestlerId, roundAuditNumber(member.effectivePower)]));
}

function weightedDeterministicPick<T>(items: T[], weightFor: (item: T) => number, seed: string): { item: T; roll: number } | undefined {
  if (!items.length) {
    return undefined;
  }

  const weights = items.map((item) => Math.max(0.01, weightFor(item)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const roll = seededOutcomeRoll(seed);
  let threshold = roll * totalWeight;

  for (let index = 0; index < items.length; index += 1) {
    threshold -= weights[index];

    if (threshold <= 0) {
      return { item: items[index], roll };
    }
  }

  return { item: items[items.length - 1], roll };
}

function getFallTakerWeight(wrestler: Wrestler, context: EffectiveMatchPowerContext) {
  const ratings = ensureMatchRatings(wrestler);
  const effectivePower = calculateEffectiveMatchPower(wrestler, context).effectivePower;
  const injuryPenalty =
    wrestler.injuryStatus === "major"
      ? MATCH_FALL_TAKER_TUNING.majorInjuryPenalty
      : wrestler.injuryStatus === "minor"
        ? MATCH_FALL_TAKER_TUNING.minorInjuryPenalty
        : 0;
  return (
    (100 - ratings.resilience) * MATCH_FALL_TAKER_TUNING.resilienceGap +
    (100 - ratings.stamina) * MATCH_FALL_TAKER_TUNING.staminaGap +
    (100 - ratings.clutch) * MATCH_FALL_TAKER_TUNING.clutchGap +
    (100 - wrestler.morale) * MATCH_FALL_TAKER_TUNING.moraleGap +
    (100 - wrestler.momentum) * MATCH_FALL_TAKER_TUNING.momentumGap +
    wrestler.fatigue * MATCH_FALL_TAKER_TUNING.fatigue +
    Math.max(0, 70 - effectivePower) * MATCH_FALL_TAKER_TUNING.weakPowerGap +
    injuryPenalty +
    MATCH_FALL_TAKER_TUNING.floor
  );
}

function getFallWinnerWeight(wrestler: Wrestler, context: EffectiveMatchPowerContext) {
  const ratings = ensureMatchRatings(wrestler);
  const effectivePower = calculateEffectiveMatchPower(wrestler, context).effectivePower;
  const injuryPenalty = wrestler.injuryStatus === "major" ? -24 : wrestler.injuryStatus === "minor" ? -10 : 0;
  return (
    ratings.clutch * 1.2 +
    ratings.timing * 0.45 +
    ratings.psychology * 0.35 +
    effectivePower * 0.45 +
    wrestler.momentum * 0.25 +
    wrestler.morale * 0.2 +
    (100 - wrestler.fatigue) * 0.2 +
    injuryPenalty +
    1
  );
}

function getSegmentWinner(segment: Segment, wrestlers: Wrestler[]) {
  if (segment.winnerId && segment.participantIds.includes(segment.winnerId)) {
    return wrestlers.find((wrestler) => wrestler.id === segment.winnerId);
  }

  if (segment.segmentCatalogId === "M020") {
    return getTagMatchWinner(segment, wrestlers);
  }

  return segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
    .sort((a, b) => getWinnerScore(b) - getWinnerScore(a))[0];
}

function getTagMatchTeams(segment: Segment) {
  if (segment.segmentCatalogId !== "M020" || segment.participantIds.length !== 4) {
    return undefined;
  }

  // M020 stores sides by booking order: [Team A 1, Team A 2, Team B 1, Team B 2].
  return {
    teamAIds: [segment.participantIds[0], segment.participantIds[1]],
    teamBIds: [segment.participantIds[2], segment.participantIds[3]],
  };
}

function getTagMatchWinner(segment: Segment, wrestlers: Wrestler[]) {
  const teams = getTagMatchTeams(segment);

  if (!teams) {
    return undefined;
  }

  const teamARoster = teams.teamAIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
  const teamBRoster = teams.teamBIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  if (!teamARoster.length || !teamBRoster.length) {
    return undefined;
  }

  const teamAScore = teamARoster.reduce((sum, wrestler) => sum + getWinnerScore(wrestler), 0);
  const teamBScore = teamBRoster.reduce((sum, wrestler) => sum + getWinnerScore(wrestler), 0);
  const winningTeam = teamAScore === teamBScore ? teamARoster : teamAScore > teamBScore ? teamARoster : teamBRoster;

  return winningTeam.sort((a, b) => getWinnerScore(b) - getWinnerScore(a))[0];
}

function getWinnerScore(wrestler: Wrestler) {
  return wrestler.popularity * 0.3 + wrestler.momentum * 0.25 + wrestler.ringSkill * 0.35 + wrestler.morale * 0.15 - wrestler.fatigue * 0.18;
}

function getCardPosition(index: number, total: number) {
  if (index === 0) {
    return "opener";
  }

  return index === total - 1 ? "main_event" : "midcard";
}

function seededOutcomeRoll(seed: string) {
  return (hashString(seed) % 1000000) / 1000000;
}

function hashString(value: string) {
  return value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}
