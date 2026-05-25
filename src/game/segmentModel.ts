import type { Segment, SegmentResult, SegmentType, Wrestler } from "./types";

type StorySegmentType = Exclude<SegmentType, "Match" | "Open Challenge">;

type SegmentReadBase = Pick<
  Segment,
  "id" | "type" | "participantIds" | "segmentCatalogId" | "segmentDisplayName" | "durationMinutes" | "participantMin" | "participantMax"
>;

export type MatchBookingSegment = SegmentReadBase & {
  kind: "match";
  type: "Match";
  winnerId?: string;
  championshipId?: string;
  rivalryId?: string;
  stipulationId?: string;
};

export type OpenChallengeBookingSegment = SegmentReadBase & {
  kind: "openChallenge";
  type: "Open Challenge";
  winnerId?: string;
  championshipId?: string;
  stipulationId?: string;
};

export type StoryBookingSegment = SegmentReadBase & {
  kind: "story";
  type: StorySegmentType;
  championshipId?: string;
  rivalryId?: string;
};

export type BookingSegmentUnion = MatchBookingSegment | OpenChallengeBookingSegment | StoryBookingSegment;

type SegmentResultReadBase = Pick<
  SegmentResult,
  | "segmentId"
  | "type"
  | "participantNames"
  | "participantIds"
  | "score"
  | "plannedDurationMinutes"
  | "actualDurationMinutes"
  | "durationVarianceMinutes"
  | "overrunAffected"
  | "momentumChanges"
  | "fatigueChanges"
  | "segmentCatalogId"
  | "titleNote"
  | "rivalryNote"
  | "recapNote"
>;

export type MatchSegmentResult = SegmentResultReadBase & {
  kind: "match";
  type: "Match";
  championshipId?: string;
  rivalryId?: string;
  stipulationId?: string;
  winnerId?: string;
};

export type OpenChallengeSegmentResult = SegmentResultReadBase & {
  kind: "openChallenge";
  type: "Open Challenge";
  championshipId?: string;
  stipulationId?: string;
  winnerId?: string;
  resolvedOpponent?: {
    id: string;
    name: string;
  };
  resolvedOpponentId?: string;
  resolvedOpponentName?: string;
  isNoContest?: boolean;
};

export type StorySegmentResult = SegmentResultReadBase & {
  kind: "story";
  type: StorySegmentType;
  championshipId?: string;
  rivalryId?: string;
};

export type SegmentResultUnion = MatchSegmentResult | OpenChallengeSegmentResult | StorySegmentResult;

export type CreateSegmentResultInput = {
  sourceSegmentId: string;
  segment: Segment;
  wrestlers: Wrestler[];
  score: number;
  plannedDurationMinutes?: number;
  actualDurationMinutes?: number;
  overrunAffected?: boolean;
  momentumChanges: Record<string, number>;
  fatigueChanges: Record<string, number>;
  winnerId?: string;
  titleNote?: string;
  rivalryNote?: string;
  recapNote?: string;
  sparkedRivalryId?: string;
  resolvedOpponent?: Pick<Wrestler, "id" | "name">;
  isNoContest?: boolean;
};

function baseSegmentRead(segment: Segment): SegmentReadBase {
  return {
    id: segment.id,
    type: segment.type,
    participantIds: segment.participantIds,
    segmentCatalogId: segment.segmentCatalogId,
    segmentDisplayName: segment.segmentDisplayName,
    durationMinutes: segment.durationMinutes,
    participantMin: segment.participantMin,
    participantMax: segment.participantMax,
  };
}

function baseSegmentResultRead(result: SegmentResult): SegmentResultReadBase {
  return {
    segmentId: result.segmentId,
    type: result.type,
    participantNames: result.participantNames,
    participantIds: result.participantIds,
    score: result.score,
    plannedDurationMinutes: result.plannedDurationMinutes,
    actualDurationMinutes: result.actualDurationMinutes,
    durationVarianceMinutes: result.durationVarianceMinutes,
    overrunAffected: result.overrunAffected,
    momentumChanges: result.momentumChanges,
    fatigueChanges: result.fatigueChanges,
    segmentCatalogId: result.segmentCatalogId,
    titleNote: result.titleNote,
    rivalryNote: result.rivalryNote,
    recapNote: result.recapNote,
  };
}

export function normalizeSegmentForRead(segment: Segment): BookingSegmentUnion {
  const base = baseSegmentRead(segment);

  if (segment.type === "Match") {
    return {
      ...base,
      kind: "match",
      type: "Match",
      winnerId: segment.winnerId,
      championshipId: segment.championshipId,
      rivalryId: segment.rivalryId,
      stipulationId: segment.stipulationId,
    };
  }

  if (segment.type === "Open Challenge") {
    return {
      ...base,
      kind: "openChallenge",
      type: "Open Challenge",
      winnerId: segment.winnerId,
      championshipId: segment.championshipId,
      stipulationId: segment.stipulationId,
    };
  }

  return {
    ...base,
    kind: "story",
    type: segment.type,
    championshipId: segment.championshipId,
    rivalryId: segment.rivalryId,
  };
}

export function normalizeSegmentResultForRead(result: SegmentResult): SegmentResultUnion {
  const base = baseSegmentResultRead(result);

  if (result.type === "Match") {
    return {
      ...base,
      kind: "match",
      type: "Match",
      championshipId: result.championshipId,
      rivalryId: result.rivalryId,
      stipulationId: result.stipulationId,
      winnerId: result.winnerId,
    };
  }

  if (result.type === "Open Challenge") {
    const resolvedOpponent =
      result.resolvedOpponentId && result.resolvedOpponentName
        ? {
            id: result.resolvedOpponentId,
            name: result.resolvedOpponentName,
          }
        : undefined;

    return {
      ...base,
      kind: "openChallenge",
      type: "Open Challenge",
      championshipId: result.championshipId,
      stipulationId: result.stipulationId,
      winnerId: result.winnerId,
      resolvedOpponent,
      resolvedOpponentId: result.resolvedOpponentId,
      resolvedOpponentName: result.resolvedOpponentName,
      isNoContest: result.isNoContest,
    };
  }

  return {
    ...base,
    kind: "story",
    type: result.type,
    championshipId: result.championshipId,
    rivalryId: result.rivalryId,
  };
}

export function createSegmentResult(input: CreateSegmentResultInput): SegmentResultUnion {
  const actualDurationMinutes = input.actualDurationMinutes;
  const plannedDurationMinutes = input.plannedDurationMinutes;
  const result: SegmentResult = {
    segmentId: input.sourceSegmentId,
    type: input.segment.type,
    participantNames: input.segment.participantIds.map((id) => input.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown"),
    participantIds: input.segment.participantIds,
    score: input.score,
    plannedDurationMinutes,
    actualDurationMinutes,
    durationVarianceMinutes:
      typeof actualDurationMinutes === "number" && typeof plannedDurationMinutes === "number"
        ? actualDurationMinutes - plannedDurationMinutes
        : undefined,
    overrunAffected: input.overrunAffected,
    momentumChanges: input.momentumChanges,
    fatigueChanges: input.fatigueChanges,
    championshipId: input.segment.championshipId,
    rivalryId: input.segment.rivalryId ?? input.sparkedRivalryId,
    segmentCatalogId: input.segment.segmentCatalogId,
    stipulationId: input.segment.stipulationId,
    winnerId: input.winnerId,
    titleNote: input.titleNote,
    rivalryNote: input.rivalryNote,
    recapNote: input.recapNote,
    resolvedOpponentId: input.resolvedOpponent?.id,
    resolvedOpponentName: input.resolvedOpponent?.name,
    isNoContest: input.isNoContest,
  };

  return normalizeSegmentResultForRead(result);
}
