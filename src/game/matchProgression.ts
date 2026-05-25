import type {
  MatchOutcomeInternalAudit,
  MatchOutcomeModel,
  MatchRatings,
  MatchRatingsProgressionAudit,
  MatchRatingsProgressionMode,
  SegmentResult,
  ShowResult,
  Wrestler,
} from "./types";
import {
  applyMatchRatingProgression,
  ensureMatchRatings,
  type MatchRatingKey,
  matchRatingKeys,
} from "./matchRatings";
import { isStandardMultiPersonDeepRatingsSegment } from "./matchOutcomeResolver";

export type PostShowMatchRatingsProgressionInput = {
  mode: MatchRatingsProgressionMode;
  wrestlers: Wrestler[];
  result: ShowResult;
  matchOutcomeModel: MatchOutcomeModel;
};

type SegmentProgressionContext = {
  segmentIndex: number;
  segmentCount: number;
  matchOutcomeModel: MatchOutcomeModel;
};

type MatchRatingProgressionRole = "winner" | "loser" | "fallWinner" | "fallTaker" | "protectedLoser";

export function applyPostShowMatchRatingsProgression(
  input: PostShowMatchRatingsProgressionInput,
): { wrestlers: Wrestler[]; segmentResults: SegmentResult[] } {
  if (input.mode !== "enabled") {
    return {
      wrestlers: input.wrestlers,
      segmentResults: input.result.segmentResults,
    };
  }

  const wrestlersById = new Map(input.wrestlers.map((wrestler) => [wrestler.id, wrestler]));
  const segmentResults = input.result.segmentResults.map((segment, index) =>
    applySegmentMatchRatingsProgression(segment, wrestlersById, {
      segmentIndex: index,
      segmentCount: input.result.segmentResults.length,
      matchOutcomeModel: input.matchOutcomeModel,
    }),
  );

  return {
    wrestlers: input.wrestlers.map((wrestler) => wrestlersById.get(wrestler.id) ?? wrestler),
    segmentResults,
  };
}

function applySegmentMatchRatingsProgression(
  segment: SegmentResult,
  wrestlersById: Map<string, Wrestler>,
  context: SegmentProgressionContext,
): SegmentResult {
  const skipped = (reason: string): SegmentResult => ({
    ...segment,
    internalMatchRatingsProgressionAudit: {
      enabled: true,
      eligible: false,
      reason,
      wrestlerIdsAffected: [],
      deltas: {},
      context: getProgressionAuditContext(segment, context),
    },
  });

  if (segment.isNoContest) {
    return skipped("noContest");
  }

  if (segment.type !== "Match") {
    return skipped("unsupportedSegmentType");
  }

  if (segment.segmentCatalogId === "M020") {
    return applyTagMatchRatingsProgression(segment, wrestlersById, context) ?? skipped(getNonSinglesProgressionSkipReason(segment));
  }

  if (isStandardMultiPersonDeepRatingsSegment(segment)) {
    return applyMultiPersonMatchRatingsProgression(segment, wrestlersById, context) ?? skipped(getNonSinglesProgressionSkipReason(segment));
  }

  if (segment.participantIds.length !== 2) {
    return skipped("tagOrMultiPersonUnsupported");
  }

  if (!segment.winnerId || !segment.participantIds.includes(segment.winnerId)) {
    return skipped("missingResolvedWinner");
  }

  const loserId = segment.participantIds.find((id) => id !== segment.winnerId);

  if (!loserId) {
    return skipped("missingResolvedLoser");
  }

  const winner = wrestlersById.get(segment.winnerId);
  const loser = wrestlersById.get(loserId);

  if (!winner || !loser) {
    return skipped("missingCompetitorData");
  }

  const winnerProgression = progressWrestlerMatchRatings(winner, segment, "winner");
  const loserProgression = progressWrestlerMatchRatings(loser, segment, "loser");
  const clampEvents = [...(winnerProgression.clampEvents ?? []), ...(loserProgression.clampEvents ?? [])];
  wrestlersById.set(winner.id, winnerProgression.wrestler);
  wrestlersById.set(loser.id, loserProgression.wrestler);

  return {
    ...segment,
    internalMatchRatingsProgressionAudit: {
      enabled: true,
      eligible: true,
      wrestlerIdsAffected: [winner.id, loser.id],
      deltas: {
        [winner.id]: winnerProgression.actualDeltas,
        [loser.id]: loserProgression.actualDeltas,
      },
      context: getProgressionAuditContext(segment, context, loserId, [winner, loser]),
      ...(clampEvents.length ? { clampEvents } : {}),
    },
  };
}

function getNonSinglesProgressionSkipReason(segment: SegmentResult) {
  if (segment.internalOutcomeAudit?.fallbackReason === "manualWinner") {
    return "manualNonSinglesFallDataUnavailable";
  }

  if (segment.internalOutcomeAudit?.fallbackReason) {
    return segment.internalOutcomeAudit.fallbackReason;
  }

  if (segment.internalOutcomeAudit?.eligible && !segment.internalOutcomeAudit.fallTakerId) {
    return "missingFallData";
  }

  return "tagOrMultiPersonUnsupported";
}

function applyTagMatchRatingsProgression(
  segment: SegmentResult,
  wrestlersById: Map<string, Wrestler>,
  context: SegmentProgressionContext,
): SegmentResult | undefined {
  const audit = segment.internalOutcomeAudit;

  if (!audit?.eligible || audit.outcomeStructure !== "tag") {
    return undefined;
  }

  const winningIds = audit.winningTeamParticipantIds ?? [];
  const losingIds = audit.losingTeamParticipantIds ?? [];
  const fallWinnerId = audit.fallWinnerId ?? segment.winnerId;
  const fallTakerId = audit.fallTakerId;

  if (winningIds.length !== 2 || losingIds.length !== 2 || !fallWinnerId || !fallTakerId || !winningIds.includes(fallWinnerId) || !losingIds.includes(fallTakerId)) {
    return undefined;
  }

  const protectedLoserIds = losingIds.filter((id) => id !== fallTakerId);
  const roleById = new Map<string, MatchRatingProgressionRole>();
  winningIds.forEach((id) => roleById.set(id, id === fallWinnerId ? "fallWinner" : "winner"));
  roleById.set(fallTakerId, "fallTaker");
  protectedLoserIds.forEach((id) => roleById.set(id, "protectedLoser"));

  return applyNonSinglesProgression(segment, wrestlersById, context, roleById, fallTakerId);
}

function applyMultiPersonMatchRatingsProgression(
  segment: SegmentResult,
  wrestlersById: Map<string, Wrestler>,
  context: SegmentProgressionContext,
): SegmentResult | undefined {
  const audit = segment.internalOutcomeAudit;
  const winnerId = audit?.winnerId ?? segment.winnerId;
  const fallTakerId = audit?.fallTakerId;

  if (!audit?.eligible || audit.outcomeStructure !== "multiPerson" || !winnerId || !fallTakerId || winnerId === fallTakerId) {
    return undefined;
  }

  if (!segment.participantIds.includes(winnerId) || !segment.participantIds.includes(fallTakerId)) {
    return undefined;
  }

  const roleById = new Map<string, MatchRatingProgressionRole>();
  roleById.set(winnerId, "winner");
  roleById.set(fallTakerId, "fallTaker");
  segment.participantIds
    .filter((id) => id !== winnerId && id !== fallTakerId)
    .forEach((id) => roleById.set(id, "protectedLoser"));

  return applyNonSinglesProgression(segment, wrestlersById, context, roleById, fallTakerId);
}

function applyNonSinglesProgression(
  segment: SegmentResult,
  wrestlersById: Map<string, Wrestler>,
  context: SegmentProgressionContext,
  roleById: Map<string, MatchRatingProgressionRole>,
  loserId?: string,
): SegmentResult | undefined {
  const entries = [...roleById.entries()]
    .map(([id, role]) => {
      const wrestler = wrestlersById.get(id);
      return wrestler ? { wrestler, role } : undefined;
    })
    .filter((entry): entry is { wrestler: Wrestler; role: MatchRatingProgressionRole } => Boolean(entry));

  if (entries.length !== roleById.size) {
    return undefined;
  }

  const progressions = entries.map(({ wrestler, role }) => ({
    role,
    progression: progressWrestlerMatchRatings(wrestler, segment, role),
  }));
  const clampEvents = progressions.flatMap(({ progression }) => progression.clampEvents ?? []);

  progressions.forEach(({ progression }) => {
    wrestlersById.set(progression.wrestler.id, progression.wrestler);
  });

  return {
    ...segment,
    internalMatchRatingsProgressionAudit: {
      enabled: true,
      eligible: true,
      wrestlerIdsAffected: entries.map(({ wrestler }) => wrestler.id),
      deltas: Object.fromEntries(progressions.map(({ progression }) => [progression.wrestler.id, progression.actualDeltas])),
      context: getProgressionAuditContext(segment, context, loserId, entries.map(({ wrestler }) => wrestler)),
      ...(clampEvents.length ? { clampEvents } : {}),
    },
  };
}

function getProgressionAuditContext(
  segment: SegmentResult,
  context: SegmentProgressionContext,
  loserId?: string,
  wrestlers?: Wrestler[],
): MatchRatingsProgressionAudit["context"] {
  const expectedWinnerId = getExpectedWinnerId(segment.internalOutcomeAudit);
  const highFatigueIds =
    wrestlers
      ?.filter((wrestler) => wrestler.fatigue >= 80)
      .map((wrestler) => wrestler.id) ??
    Object.entries(segment.fatigueChanges)
      .filter(([, change]) => change >= 6)
      .map(([id]) => id);
  const injuryLimitedIds = wrestlers
    ?.filter((wrestler) => wrestler.injuryStatus !== "healthy")
    .map((wrestler) => wrestler.id);

  return {
    winnerId: segment.winnerId,
    loserId,
    score: segment.score,
    stipulationId: segment.stipulationId,
    matchOutcomeModel: context.matchOutcomeModel,
    cardPosition: getCardPosition(context.segmentIndex, context.segmentCount),
    titleMatch: Boolean(segment.championshipId),
    rivalryMatch: Boolean(segment.rivalryId),
    expectedWinnerId,
    upsetWin: Boolean(expectedWinnerId && segment.winnerId && expectedWinnerId !== segment.winnerId),
    highFatigueIds: highFatigueIds.length ? highFatigueIds : undefined,
    injuryLimitedIds: injuryLimitedIds?.length ? injuryLimitedIds : undefined,
  };
}

function getExpectedWinnerId(audit?: MatchOutcomeInternalAudit) {
  if (!audit?.eligible || !audit.competitorAId || !audit.competitorBId) {
    return undefined;
  }

  const competitorAWinProbability = audit.competitorAWinProbability ?? 0.5;
  const competitorBWinProbability = audit.competitorBWinProbability ?? 0.5;
  return competitorAWinProbability >= competitorBWinProbability ? audit.competitorAId : audit.competitorBId;
}

function progressWrestlerMatchRatings(
  wrestler: Wrestler,
  segment: SegmentResult,
  role: MatchRatingProgressionRole,
): { wrestler: Wrestler; actualDeltas: Partial<MatchRatings>; clampEvents?: NonNullable<MatchRatingsProgressionAudit["clampEvents"]> } {
  const before = ensureMatchRatings(wrestler);
  const requestedDeltas = getMatchRatingProgressionDeltas(wrestler, segment, role);
  const after = applyMatchRatingProgression(wrestler, {
    segmentTypes: [segment.type],
    resultScore: segment.score,
    deltas: requestedDeltas,
  });

  return {
    wrestler: {
      ...wrestler,
      matchRatings: after,
    },
    actualDeltas: getActualMatchRatingDeltas(before, after),
    clampEvents: getMatchRatingClampEvents(wrestler.id, before, after, requestedDeltas),
  };
}

function getMatchRatingProgressionDeltas(
  wrestler: Wrestler,
  segment: SegmentResult,
  role: MatchRatingProgressionRole,
): Partial<Record<MatchRatingKey, number>> {
  const profile = getMatchRatingProgressionProfile(segment.stipulationId);
  const outcomeRole = role === "loser" || role === "fallTaker" || role === "protectedLoser" ? "loser" : "winner";
  const qualityMultiplier =
    segment.score >= 85
      ? outcomeRole === "winner"
        ? 1
        : 0.7
      : segment.score >= 70
        ? outcomeRole === "winner"
          ? 0.65
          : 0.35
        : segment.score < 55
          ? outcomeRole === "winner"
            ? -0.1
            : -0.45
          : outcomeRole === "winner"
            ? 0.2
            : -0.15;
  const deltas = scaleProgressionProfile(profile, qualityMultiplier);
  const add = (key: MatchRatingKey, amount: number) => {
    deltas[key] = (deltas[key] ?? 0) + amount;
  };

  if (outcomeRole === "winner") {
    add("clutch", segment.championshipId || segment.rivalryId ? 0.45 : 0.25);
    add("psychology", segment.rivalryId ? 0.25 : 0.1);
  }

  if (outcomeRole === "loser" && segment.score >= 80) {
    add("selling", 0.45);
    add("resilience", 0.35);
    add("timing", 0.25);
  }

  if (outcomeRole === "loser" && segment.score < 55) {
    add("timing", -0.35);
    add("psychology", -0.25);
  }

  if (segment.internalOutcomeAudit?.eligible) {
    const expectedWinnerId = getExpectedWinnerId(segment.internalOutcomeAudit);
    const isUpsetWinner = outcomeRole === "winner" && expectedWinnerId && segment.winnerId !== expectedWinnerId;
    const isExpectedWinner = outcomeRole === "winner" && expectedWinnerId && segment.winnerId === expectedWinnerId;

    if (isUpsetWinner) {
      add("clutch", 0.45);
      add("resilience", 0.25);
    } else if (isExpectedWinner) {
      add("clutch", 0.1);
    }
  }

  if (role === "fallWinner") {
    add("clutch", 0.35);
    add("timing", 0.2);
    add("psychology", 0.15);
  }

  if (role === "fallTaker") {
    add("clutch", -0.85);
    add("resilience", -0.65);
    add("timing", -0.55);
  }

  if (role === "protectedLoser") {
    matchRatingKeys.forEach((key) => {
      if (deltas[key] !== undefined) {
        deltas[key] *= 0.45;
      }
    });
    add("selling", segment.score >= 80 ? 0.2 : 0.05);
    add("resilience", segment.score >= 80 ? 0.15 : 0);
  }

  if (wrestler.fatigue >= 80) {
    add("stamina", -0.65);
    add("resilience", -0.45);
    add("explosiveness", -0.45);
  }

  if (wrestler.injuryStatus === "minor") {
    add("stamina", -0.45);
    add("explosiveness", -0.45);
    add("resilience", -0.25);
  } else if (wrestler.injuryStatus === "major") {
    add("stamina", -0.9);
    add("explosiveness", -0.85);
    add("resilience", -0.6);
  }

  return deltas;
}

function getMatchRatingProgressionProfile(stipulationId?: string): Partial<Record<MatchRatingKey, number>> {
  switch (stipulationId) {
    case "submission_match":
      return {
        submission: 1.2,
        technical: 0.95,
        resilience: 0.55,
        psychology: 0.45,
        timing: 0.25,
      };
    case "no_dq":
    case "extreme_rules":
    case "street_fight":
    case "table_match":
    case "steel_cage":
    case "last_man_standing":
    case "tlc_match":
      return {
        hardcore: 1.15,
        brawling: 0.95,
        resilience: 0.55,
        power: 0.45,
        explosiveness: 0.25,
      };
    case "ladder_match":
      return {
        aerial: 1.1,
        explosiveness: 0.95,
        timing: 0.85,
        resilience: 0.45,
        stamina: 0.35,
      };
    case "iron_man":
      return {
        stamina: 1.1,
        resilience: 0.95,
        technical: 0.55,
        psychology: 0.45,
        timing: 0.3,
      };
    default:
      return {
        technical: 0.55,
        power: 0.4,
        brawling: 0.4,
        stamina: 0.5,
        resilience: 0.45,
        psychology: 0.35,
        timing: 0.55,
        selling: 0.25,
      };
  }
}

function scaleProgressionProfile(profile: Partial<Record<MatchRatingKey, number>>, multiplier: number) {
  return matchRatingKeys.reduce<Partial<Record<MatchRatingKey, number>>>((deltas, key) => {
    const value = profile[key];

    if (value !== undefined) {
      deltas[key] = value * multiplier;
    }

    return deltas;
  }, {});
}

function getActualMatchRatingDeltas(before: MatchRatings, after: MatchRatings): Partial<MatchRatings> {
  return matchRatingKeys.reduce<Partial<MatchRatings>>((deltas, key) => {
    const delta = after[key] - before[key];

    if (delta !== 0) {
      deltas[key] = delta;
    }

    return deltas;
  }, {});
}

function getMatchRatingClampEvents(
  wrestlerId: string,
  before: MatchRatings,
  after: MatchRatings,
  requestedDeltas: Partial<Record<MatchRatingKey, number>>,
): MatchRatingsProgressionAudit["clampEvents"] {
  const events: NonNullable<MatchRatingsProgressionAudit["clampEvents"]> = [];

  matchRatingKeys.forEach((key) => {
    const requestedDelta = requestedDeltas[key] ?? 0;

    if (before[key] >= 100 && after[key] === 100 && requestedDelta > 0) {
      events.push({ wrestlerId, rating: key, boundary: 100 });
    }

    if (before[key] <= 0 && after[key] === 0 && requestedDelta < 0) {
      events.push({ wrestlerId, rating: key, boundary: 0 });
    }
  });

  return events.length ? events : undefined;
}

function getCardPosition(index: number, total: number) {
  if (index === 0) {
    return "opener";
  }

  return index === total - 1 ? "main_event" : "midcard";
}
