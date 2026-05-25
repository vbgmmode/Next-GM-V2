import type {
  CalendarWeek,
  Championship,
  ChampionshipHistoryEvent,
  GameState,
  InjuryFalloutItem,
  LockerRoomFallout,
  MatchRatings,
  MatchRatingsProgressionAudit,
  MatchRatingsProgressionMode,
  MatchOutcomeInternalAudit,
  MatchOutcomeModel,
  Rivalry,
  RivalryHistoryEvent,
  RivalryStatus,
  Segment,
  SegmentResult,
  SegmentType,
  ShowResult,
  Wrestler,
} from "./types";
import { generateFinanceReport } from "./finance";
import { getDifficultyRules, type DifficultyRules } from "./difficultyRules";
import { generateSocialPosts } from "./social";
import { generateCpuWeeklyResults } from "./cpuRivalLoop";
import { createDefaultWrestlerRecord, draftPool } from "./seed";
import { applyRivalryCatalogDefaults, getDefaultStorylineIdForStakes, getRivalryStoryline } from "./rivalryCatalog";
import { getSegmentValidationRange } from "./matchFormatCatalog";
import { getChampionshipDivisionGroup, wrestlerFitsChampionshipDivision } from "./titleCatalog";
import { applyTitleEventStatFallout, applyTitleSceneStatFallout } from "./titleStatFallout";
import { getStipulationById } from "./stipulationCatalog";
import { getProtectedRestWrestlerIds, resolveSocialInboxRequestsAfterShow } from "./socialInboxActions";
import { SENTIMENT_NEUTRAL } from "./constants";
import { getSharedInjuryRiskScore } from "./injury";
import { createSegmentResult } from "./segmentModel";
import { commitResolvedShow } from "./showResolutionCommit";
import {
  applyMatchRatingProgression,
  calculateEffectiveMatchPower,
  calculateMatchupWinProbability,
  ensureMatchRatings,
  type EffectiveMatchPowerBreakdown,
  type EffectiveMatchPowerContext,
  type MatchRatingKey,
  matchRatingKeys,
  resolveMatchOutcomePreview,
} from "./matchRatings";

export type RunShowOptions = {
  matchOutcomeModel?: MatchOutcomeModel;
  matchRatingsProgression?: MatchRatingsProgressionMode;
};

type ResolvedRunShowOptions = Required<RunShowOptions>;

const LEGACY_RUN_SHOW_OPTIONS: ResolvedRunShowOptions = {
  matchOutcomeModel: "legacy",
  matchRatingsProgression: "disabled",
};

const PLAYABLE_RUN_SHOW_OPTIONS: ResolvedRunShowOptions = {
  matchOutcomeModel: "deepRatings",
  matchRatingsProgression: "enabled",
};

export function createLegacyRunShowOptions(): ResolvedRunShowOptions {
  return { ...LEGACY_RUN_SHOW_OPTIONS };
}

export function createPlayableRunShowOptions(): ResolvedRunShowOptions {
  return { ...PLAYABLE_RUN_SHOW_OPTIONS };
}

function resolveRunShowOptions(options: RunShowOptions): ResolvedRunShowOptions {
  return {
    ...LEGACY_RUN_SHOW_OPTIONS,
    ...options,
  };
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const SEGMENT_SCORE_PROFILES: Record<
  SegmentType,
  {
    ringSkill: number;
    promoSkill: number;
    popularity: number;
    momentum: number;
    morale: number;
    fatigue: number;
  }
> = {
  Match: { ringSkill: 0.44, promoSkill: 0, popularity: 0.25, momentum: 0.19, morale: 0.1, fatigue: 0.15 },
  Promo: { ringSkill: 0, promoSkill: 0.43, popularity: 0.27, momentum: 0.2, morale: 0.1, fatigue: 0.13 },
  "Backstage Angle": { ringSkill: 0, promoSkill: 0.3, popularity: 0.18, momentum: 0.27, morale: 0.11, fatigue: 0.1 },
  "Contract Signing": { ringSkill: 0, promoSkill: 0.31, popularity: 0.25, momentum: 0.16, morale: 0.11, fatigue: 0.1 },
  "Open Challenge": { ringSkill: 0.38, promoSkill: 0, popularity: 0.24, momentum: 0.2, morale: 0.1, fatigue: 0.17 },
};

const SEGMENT_CHEMISTRY_BONUS: Record<SegmentType, number> = {
  Match: 3,
  Promo: 2,
  "Backstage Angle": 1,
  "Contract Signing": 1,
  "Open Challenge": 1,
};

const CONTEXT_BONUS = {
  rivalry: 3,
  titleRivalry: 4,
  matchTitle: 3,
  storyTitle: 2,
  contractTitle: 3,
};

const SHOW_BALANCE = {
  pleScoreBonus: 4,
  pleMomentumBonus: 2,
  pleFatigueBonus: 1,
};

const SEGMENT_FATIGUE_GAIN: Record<SegmentType, number> = {
  Match: 8,
  Promo: 2,
  "Backstage Angle": 3,
  "Contract Signing": 2,
  "Open Challenge": 7,
};

const FALLOUT_BALANCE = {
  underuseWeeks: 3,
  overuseConsecutiveWeeks: 3,
  highFatigue: 50,
  severeFatigue: 76,
  bookedMoraleGain: 2,
  underusedReturnMoraleGain: 4,
  pressureBookingMoralePenalty: 4,
  severePressureMoralePenalty: 6,
  underuseMoralePenalty: 3,
};

const RIVALRY_BALANCE = {
  crowdSparkScore: 85,
  superEliteHeatGain: 12,
  eliteHeatGain: 9,
  strongHeatGain: 6,
  steadyHeatGain: 3,
  flatHeatLoss: -6,
  pleHeatBonus: 5,
  plePayoffHeatBonus: 3,
  titleStakesBonus: 2,
  backstageStoryBonus: 1,
  contractStoryBonus: 2,
  freshnessCost: -3,
  eliteFreshnessCost: -3,
  plePayoffFreshnessCost: -2,
  coldFreshnessPenalty: -4,
  repeatedEliteFreshnessCost: -5,
  repeatedPlePayoffFreshnessCost: -4,
  repeatedBeatFreshnessCost: -11,
  repeatedWeakBeatFreshnessCost: -14,
};

const INJURY_BALANCE = {
  minorThreshold: 92,
  majorThreshold: 97,
  highFatigue: 70,
  severeFatigue: 85,
  minorMoralePenalty: 1,
  pleStageLoad: 2,
};

const BROADCAST_RUNTIME_MINUTES = 120;

const CATALOG_EXECUTION_PROFILES: Record<
  string,
  {
    varianceMinutes: number;
    minimumMinutes: number;
    fatigueBase: number;
    fatiguePerMinute: number;
  }
> = {
  M001: { varianceMinutes: 5, minimumMinutes: 6, fatigueBase: 2, fatiguePerMinute: 0.14 },
  M020: { varianceMinutes: 6, minimumMinutes: 6, fatigueBase: 3, fatiguePerMinute: 0.18 },
  M002: { varianceMinutes: 6, minimumMinutes: 7, fatigueBase: 3, fatiguePerMinute: 0.16 },
  M003: { varianceMinutes: 7, minimumMinutes: 8, fatigueBase: 3, fatiguePerMinute: 0.17 },
  M019: { varianceMinutes: 8, minimumMinutes: 8, fatigueBase: 4, fatiguePerMinute: 0.22 },
  P001: { varianceMinutes: 2, minimumMinutes: 3, fatigueBase: 1, fatiguePerMinute: 0.06 },
  P002: { varianceMinutes: 2, minimumMinutes: 3, fatigueBase: 1, fatiguePerMinute: 0.05 },
  P003: { varianceMinutes: 3, minimumMinutes: 3, fatigueBase: 1, fatiguePerMinute: 0.07 },
  A001: { varianceMinutes: 2, minimumMinutes: 3, fatigueBase: 1, fatiguePerMinute: 0.07 },
  A004: { varianceMinutes: 5, minimumMinutes: 3, fatigueBase: 3, fatiguePerMinute: 0.15 },
  A046: { varianceMinutes: 3, minimumMinutes: 3, fatigueBase: 2, fatiguePerMinute: 0.1 },
  P007: { varianceMinutes: 5, minimumMinutes: 4, fatigueBase: 3, fatiguePerMinute: 0.17 },
  P008: { varianceMinutes: 3, minimumMinutes: 5, fatigueBase: 1, fatiguePerMinute: 0.08 },
};

const SEGMENT_EXECUTION_FALLBACKS: Record<
  SegmentType,
  {
    varianceMinutes: number;
    minimumMinutes: number;
    fatigueBase: number;
    fatiguePerMinute: number;
  }
> = {
  Match: { varianceMinutes: 5, minimumMinutes: 6, fatigueBase: 2, fatiguePerMinute: 0.14 },
  Promo: { varianceMinutes: 2, minimumMinutes: 3, fatigueBase: 1, fatiguePerMinute: 0.06 },
  "Backstage Angle": { varianceMinutes: 3, minimumMinutes: 3, fatigueBase: 2, fatiguePerMinute: 0.1 },
  "Contract Signing": { varianceMinutes: 3, minimumMinutes: 5, fatigueBase: 1, fatiguePerMinute: 0.08 },
  "Open Challenge": { varianceMinutes: 5, minimumMinutes: 4, fatigueBase: 3, fatiguePerMinute: 0.17 },
};

type BroadcastOverrunLevel = NonNullable<ShowResult["broadcastOverrunLevel"]>;

export function isValidSegment(segment: Segment, wrestlers: Wrestler[] = [], unavailableWrestlerIds: ReadonlySet<string> | string[] = []) {
  const unavailableIds = Array.isArray(unavailableWrestlerIds) ? new Set(unavailableWrestlerIds) : unavailableWrestlerIds;
  const hasUnavailableWrestler = segment.participantIds.some(
    (id) => unavailableIds.has(id) || wrestlers.find((wrestler) => wrestler.id === id)?.injuryStatus === "major",
  );
  if (hasUnavailableWrestler) {
    return false;
  }

  const uniqueParticipantCount = new Set(segment.participantIds).size;
  if (segment.participantIds.length !== uniqueParticipantCount) {
    return false;
  }

  if (segment.type === "Match" && hasIntergenderMatchParticipants(segment, wrestlers)) {
    return false;
  }

  const range = getSegmentValidationRange(segment);
  return segment.participantIds.length >= range.min && segment.participantIds.length <= range.max;
}

export function getWrestlerDivisionGroup(wrestler?: Wrestler) {
  const division = wrestler?.division?.toLowerCase() ?? "";

  if (division.includes("women") || division.includes("female")) {
    return "womens";
  }

  if (division.includes("men") || division.includes("male")) {
    return "mens";
  }

  return undefined;
}

export function hasIntergenderMatchParticipants(segment: Segment, wrestlers: Wrestler[]) {
  if (segment.type !== "Match") {
    return false;
  }

  const groups = [
    ...new Set(
      segment.participantIds
        .map((id) => getWrestlerDivisionGroup(wrestlers.find((wrestler) => wrestler.id === id)))
        .filter((group): group is "mens" | "womens" => Boolean(group)),
    ),
  ];

  return groups.length > 1;
}

export function scoreSegment(segment: Segment, wrestlers: Wrestler[], championships: Championship[] = [], rivalries: Rivalry[] = []) {
  const participants = segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  if (!participants.length) {
    return 0;
  }

  const profile = SEGMENT_SCORE_PROFILES[segment.type];
  // Segment formulas intentionally privilege the skill that defines the segment's fantasy,
  // while popularity, momentum, morale, and fatigue keep booking context relevant.
  const total = participants.reduce(
    (sum, wrestler) =>
      sum +
      wrestler.ringSkill * profile.ringSkill +
      wrestler.promoSkill * profile.promoSkill +
      wrestler.popularity * profile.popularity +
      wrestler.momentum * profile.momentum +
      wrestler.morale * profile.morale -
      wrestler.fatigue * profile.fatigue,
    0,
  );

  const chemistryBonus = participants.length > 1 ? SEGMENT_CHEMISTRY_BONUS[segment.type] : 0;
  return Math.round(
    clamp(total / participants.length + chemistryBonus + getOpenChallengeMomentModifier(segment, participants) + getSegmentContextBonus(segment, championships, rivalries)),
  );
}

export function getCurrentCalendarWeek(game: GameState): CalendarWeek {
  return (
    game.calendar.find((week) => week.weekNumber === game.currentWeek) ?? {
      weekNumber: game.currentWeek,
      showName: `Week ${game.currentWeek} Broadcast`,
      showType: "tv",
      isGoHome: false,
      completed: false,
    }
  );
}

export function runShow(game: GameState, options: RunShowOptions = {}): { game: GameState; result: ShowResult } {
  const { matchOutcomeModel, matchRatingsProgression } = resolveRunShowOptions(options);
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers, protectedRestIds));
  const calendarWeek = getCurrentCalendarWeek(game);
  const isPle = calendarWeek.showType === "ple";
  const segmentExecutions = validSegments.map((segment, index) => resolveSegmentRuntime(segment, game, index));
  const plannedRuntimeMinutes = segmentExecutions.reduce((total, execution) => total + execution.plannedDurationMinutes, 0);
  const actualRuntimeMinutes = segmentExecutions.reduce((total, execution) => total + execution.actualDurationMinutes, 0);
  const broadcastOverrunMinutes = Math.max(0, actualRuntimeMinutes - BROADCAST_RUNTIME_MINUTES);
  const broadcastOverrunLevel = getBroadcastOverrunLevel(broadcastOverrunMinutes);
  const overrunAffectedSegmentIds = getBroadcastOverrunAffectedSegmentIds(validSegments, broadcastOverrunLevel);
  const momentumTotals: Record<string, number> = {};
  const fatigueTotals: Record<string, number> = {};
  const participantUseCounts: Record<string, number> = {};
  const titleNotes: string[] = [];
  const rivalryNotes: string[] = [];
  const titleHistoryEvents: ChampionshipHistoryEvent[] = [];
  const rivalryHistoryEvents: RivalryHistoryEvent[] = [];
  const lockerRoomFallout: LockerRoomFallout = {
    moraleDrops: [],
    moraleBoosts: [],
    overuseWarnings: [],
    underuseWarnings: [],
    injuryNotes: [],
  };
  const updatedChampionships = game.championships.map((championship) => ({ ...championship, championIds: [...championship.championIds] }));
  const updatedRivalries = game.rivalries.map((rivalry) => ({ ...rivalry, participantIds: [...rivalry.participantIds] }));
  const resolvedBookedIds = new Set(game.currentShow.flatMap((segment) => segment.participantIds));
  const segmentResults: SegmentResult[] = [];

  validSegments.forEach((segment, index) => {
    const execution = segmentExecutions[index];
    const openChallengeResolution =
      segment.type === "Open Challenge" ? resolveOpenChallenge(segment, game, index, resolvedBookedIds) : undefined;
    const segmentAfterOpenChallenge = openChallengeResolution?.segment ?? segment;
    const isNoContest = Boolean(openChallengeResolution?.isNoContest);
    const outcomeResolution = resolveSegmentWinnerSelection(segmentAfterOpenChallenge, game, {
      segmentIndex: index,
      segmentCount: validSegments.length,
      showType: calendarWeek.showType,
      matchOutcomeModel,
      isNoContest,
    });
    const resolvedSegment = outcomeResolution.segment;
    const overrunSegmentPenalty =
      broadcastOverrunLevel && overrunAffectedSegmentIds.has(segment.id)
        ? getBroadcastOverrunSegmentPenalty(broadcastOverrunLevel, resolvedSegment, game.wrestlers)
        : 0;
    const stipulation = getStipulationById(resolvedSegment.stipulationId);
    const score = isNoContest
      ? 0
      : clamp(
          scoreSegment(resolvedSegment, game.wrestlers, updatedChampionships, updatedRivalries) +
            (stipulation?.scoreBonus ?? 0) +
            (isPle ? SHOW_BALANCE.pleScoreBonus : 0) -
            overrunSegmentPenalty,
        );
    const momentumGain = isNoContest ? 0 : getSegmentMomentumGain(score, isPle);
    const momentumChanges: Record<string, number> = {};
    const fatigueChanges: Record<string, number> = {};
    const titleResolution = resolveTitleMatch(resolvedSegment, updatedChampionships, game.wrestlers, {
      seasonNumber: game.seasonNumber,
      weekNumber: game.currentWeek,
      showName: calendarWeek.showName,
      showType: calendarWeek.showType,
    });
    const rivalryResolution = isNoContest
      ? undefined
      : resolveRivalrySegment(resolvedSegment, updatedRivalries, score, {
          seasonNumber: game.seasonNumber,
          weekNumber: game.currentWeek,
          showName: calendarWeek.showName,
          showType: calendarWeek.showType,
        });
    const sparkedRivalryResolution =
      isNoContest || rivalryResolution
        ? undefined
        : resolveCrowdSparkedRivalry(resolvedSegment, updatedRivalries, score, game.wrestlers, {
            seasonNumber: game.seasonNumber,
            weekNumber: game.currentWeek,
            showName: calendarWeek.showName,
            showType: calendarWeek.showType,
          });
    const titleNote = titleResolution?.note;
    const rivalryNote = rivalryResolution?.note ?? sparkedRivalryResolution?.note;

    resolvedSegment.participantIds.forEach((id) => {
      const fatigueGain =
        (isNoContest ? 1 : getSegmentFatigueGain(resolvedSegment, execution.actualDurationMinutes, id, game.wrestlers, participantUseCounts[id] ?? 0)) +
        (isNoContest ? 0 : (stipulation?.fatigueBonus ?? 0)) +
        (isPle && !isNoContest ? SHOW_BALANCE.pleFatigueBonus : 0);
      momentumChanges[id] = momentumGain;
      fatigueChanges[id] = fatigueGain;
      momentumTotals[id] = (momentumTotals[id] ?? 0) + momentumGain;
      fatigueTotals[id] = (fatigueTotals[id] ?? 0) + fatigueGain;
      participantUseCounts[id] = (participantUseCounts[id] ?? 0) + 1;
      resolvedBookedIds.add(id);
    });

    if (titleNote) {
      titleNotes.push(titleNote);
    }

    if (titleResolution?.event) {
      titleHistoryEvents.push(titleResolution.event);
    }

    const winnerId = getSegmentWinner(resolvedSegment, game.wrestlers)?.id;

    if (rivalryNote) {
      rivalryNotes.push(rivalryNote);
    }

    const rivalryEvents = rivalryResolution?.events ?? sparkedRivalryResolution?.events;

    if (rivalryEvents?.length) {
      rivalryHistoryEvents.push(...rivalryEvents);
    }

    segmentResults.push(
      createSegmentResult({
        sourceSegmentId: segment.id,
        segment: resolvedSegment,
        wrestlers: game.wrestlers,
        score,
        plannedDurationMinutes: execution.plannedDurationMinutes,
        actualDurationMinutes: execution.actualDurationMinutes,
        overrunAffected: overrunAffectedSegmentIds.has(segment.id),
        momentumChanges,
        fatigueChanges,
        winnerId,
        internalOutcomeAudit: outcomeResolution.audit,
        titleNote,
        rivalryNote,
        recapNote: getSegmentRecap(resolvedSegment, game.wrestlers, score, isPle, winnerId, openChallengeResolution?.isNoContest),
        sparkedRivalryId: sparkedRivalryResolution?.rivalryId,
        resolvedOpponent: openChallengeResolution?.opponent,
        isNoContest,
      }),
    );
  });

  const broadcastOverrunNotes = getBroadcastOverrunNotes(broadcastOverrunMinutes, broadcastOverrunLevel, segmentResults);
  const overrunShowPenalty = getBroadcastOverrunShowPenalty(broadcastOverrunLevel);
  const totalScore = segmentResults.length ? clamp(Math.round(segmentResults.reduce((sum, result) => sum + result.score, 0) / segmentResults.length) - overrunShowPenalty) : 0;
  const biggestMomentumGain = getBiggestChange(momentumTotals, game.wrestlers);
  const biggestFatigueIncrease = getBiggestChange(fatigueTotals, game.wrestlers);
  const id = `season-${game.seasonNumber}-week-${game.currentWeek}`;
  const overrunAffectedIds = [...overrunAffectedSegmentIds];
  const result: ShowResult = {
    id,
    seasonNumber: game.seasonNumber,
    week: game.currentWeek,
    brandName: game.brandName,
    showName: calendarWeek.showName,
    showType: calendarWeek.showType,
    plannedRuntimeMinutes,
    actualRuntimeMinutes,
    broadcastOverrunMinutes,
    broadcastOverrunLevel,
    broadcastOverrunNotes,
    overrunAffectedSegmentId: overrunAffectedIds[overrunAffectedIds.length - 1],
    totalScore,
    segmentResults,
    biggestMomentumGain,
    biggestFatigueIncrease,
    titleNotes,
    rivalryNotes,
    titleHistoryEvents,
    rivalryHistoryEvents,
    lockerRoomFallout,
  };

  const updatedWrestlers = game.wrestlers.map((wrestler) =>
    updateWrestlerPressure(
      wrestler,
      game.currentWeek,
      momentumTotals,
      fatigueTotals,
      lockerRoomFallout,
      getDifficultyRules(game.difficulty),
      protectedRestIds,
    ),
  );
  const injuryNotes = evaluateInjuries(result, updatedWrestlers, game);
  lockerRoomFallout.injuryNotes = injuryNotes;
  const injuredWrestlers = applyInjuryFallout(updatedWrestlers, injuryNotes, game.currentWeek);
  const titleEventFallout = applyTitleEventStatFallout(
    injuredWrestlers,
    titleHistoryEvents,
    segmentResults,
    updatedChampionships,
  );
  const recordUpdatedWrestlers = applyMatchRecordFallout(titleEventFallout.wrestlers, segmentResults);
  const titleSceneFallout = applyTitleSceneStatFallout(recordUpdatedWrestlers, segmentResults, updatedChampionships);
  lockerRoomFallout.titleStatNotes = [...titleEventFallout.notes, ...titleSceneFallout.notes];
  const wrestlersWithTitleStats = titleSceneFallout.wrestlers;
  const matchRatingsProgressionFallout = applyPostShowMatchRatingsProgression({
    mode: matchRatingsProgression,
    wrestlers: wrestlersWithTitleStats,
    result,
    matchOutcomeModel,
  });
  const resultWithMatchRatingsProgression = {
    ...result,
    segmentResults: matchRatingsProgressionFallout.segmentResults,
  };
  const gameWithSocialInboxResolution = resolveSocialInboxRequestsAfterShow(
    {
      ...game,
      wrestlers: matchRatingsProgressionFallout.wrestlers,
    },
    resultWithMatchRatingsProgression,
  );
  const financeReport = generateFinanceReport(resultWithMatchRatingsProgression, game);
  const commit = commitResolvedShow({
    game,
    result: resultWithMatchRatingsProgression,
    wrestlers: gameWithSocialInboxResolution.wrestlers,
    socialInbox: gameWithSocialInboxResolution.socialInbox,
    championships: updatedChampionships,
    rivalries: updatedRivalries,
    championshipHistoryEvents: titleHistoryEvents,
    rivalryHistoryEvents,
    financeReport,
  });
  const gameBeforeCpuSocial = commit.gameBeforeCpuSocial;
  const rivalBrands = generateCpuWeeklyResults(gameBeforeCpuSocial, result, draftPool);
  const gameWithCpuResults = {
    ...gameBeforeCpuSocial,
    rivalBrands,
  };

  return {
    result: commit.result,
    game: {
      ...gameWithCpuResults,
      socialPosts: [...game.socialPosts, ...generateSocialPosts(result, gameWithCpuResults)],
    },
  };
}

function getSegmentPlannedDuration(segment: Segment) {
  return Math.max(1, Math.round(segment.durationMinutes ?? SEGMENT_EXECUTION_FALLBACKS[segment.type].minimumMinutes));
}

function getSegmentExecutionProfile(segment: Segment) {
  return (segment.segmentCatalogId ? CATALOG_EXECUTION_PROFILES[segment.segmentCatalogId] : undefined) ?? SEGMENT_EXECUTION_FALLBACKS[segment.type];
}

function resolveSegmentRuntime(segment: Segment, game: GameState, index: number) {
  const plannedDurationMinutes = getSegmentPlannedDuration(segment);
  const profile = getSegmentExecutionProfile(segment);
  const seed = `${game.seasonNumber}-${game.currentWeek}-${segment.id}-${segment.segmentCatalogId ?? segment.type}-${index}`;
  const drift = getDeterministicDurationDrift(seed, profile.varianceMinutes);
  const maximumMinutes = plannedDurationMinutes + Math.ceil(profile.varianceMinutes * 1.5);
  const actualDurationMinutes = Math.round(clamp(plannedDurationMinutes + drift, profile.minimumMinutes, maximumMinutes));

  return {
    plannedDurationMinutes,
    actualDurationMinutes,
  };
}

function getDeterministicDurationDrift(seed: string, varianceMinutes: number) {
  const spread = varianceMinutes * 2 + 1;
  return (hashString(`${seed}-duration-drift`) % spread) - varianceMinutes;
}

function getBroadcastOverrunLevel(overrunMinutes: number): BroadcastOverrunLevel | undefined {
  if (overrunMinutes <= 0) {
    return undefined;
  }

  if (overrunMinutes <= 10) {
    return "minor";
  }

  if (overrunMinutes <= 25) {
    return "moderate";
  }

  return "major";
}

function getBroadcastOverrunAffectedSegmentIds(segments: Segment[], level?: BroadcastOverrunLevel) {
  const affectedIds = new Set<string>();

  if (!level || !segments.length) {
    return affectedIds;
  }

  const affectedCount = level === "major" && segments.length > 1 ? 2 : 1;
  segments.slice(-affectedCount).forEach((segment) => affectedIds.add(segment.id));
  return affectedIds;
}

function getBroadcastOverrunSegmentPenalty(level: BroadcastOverrunLevel, segment: Segment, wrestlers: Wrestler[]) {
  const topStarPressure = segment.participantIds.some((id) => {
    const wrestler = wrestlers.find((talent) => talent.id === id);
    return wrestler ? wrestler.popularity >= 90 || wrestler.momentum >= 90 : false;
  });
  const contextPressure = segment.championshipId || segment.rivalryId || topStarPressure ? 2 : 0;

  if (level === "major") {
    return 14 + contextPressure;
  }

  if (level === "moderate") {
    return 8 + contextPressure;
  }

  return 4 + contextPressure;
}

function getBroadcastOverrunShowPenalty(level?: BroadcastOverrunLevel) {
  if (level === "major") {
    return 8;
  }

  if (level === "moderate") {
    return 4;
  }

  return level === "minor" ? 1 : 0;
}

function getBroadcastOverrunNotes(overrunMinutes: number, level: BroadcastOverrunLevel | undefined, segmentResults: SegmentResult[]) {
  if (!level || overrunMinutes <= 0) {
    return [];
  }

  const affectedSegments = segmentResults.filter((segment) => segment.overrunAffected);
  const affectedSegment = affectedSegments[affectedSegments.length - 1];
  const affectedNames = affectedSegment?.participantNames.join(" / ") ?? "the closing block";
  const affectedBlock =
    affectedSegments.length > 1
      ? `The closing block around ${affectedNames}`
      : affectedSegment?.type === "Match"
        ? `${affectedNames}'s final match`
        : `${affectedNames}'s closing segment`;
  const lead =
    level === "major"
      ? `Major broadcast overrun: the show ran ${overrunMinutes} minutes long.`
      : level === "moderate"
        ? `Broadcast overrun: the show ran ${overrunMinutes} minutes long.`
        : `Minor overrun: the show ran ${overrunMinutes} minutes past the TV window.`;
  const compression =
    affectedSegment?.type === "Match"
      ? `${affectedBlock} lost breathing room and the finish felt rushed.`
      : `${affectedBlock} was clipped for time and lost dramatic space.`;
  const business =
    level === "major"
      ? "Fans noticed the pacing collapse, and the packed rundown softened the night's business upside."
      : level === "moderate"
        ? "The packed rundown hurt the broadcast rhythm and took the edge off the closing stretch."
        : "The final block had to move faster than production wanted.";

  return [lead, compression, business];
}

function updateWrestlerPressure(
  wrestler: Wrestler,
  currentWeek: number,
  momentumTotals: Record<string, number>,
  fatigueTotals: Record<string, number>,
  fallout: LockerRoomFallout,
  rules: DifficultyRules,
  protectedRestIds: ReadonlySet<string>,
) {
  const isBooked = Object.prototype.hasOwnProperty.call(momentumTotals, wrestler.id) || Object.prototype.hasOwnProperty.call(fatigueTotals, wrestler.id);
  const isProtectedRest = protectedRestIds.has(wrestler.id);
  const previousLastBookedWeek = wrestler.lastBookedWeek ?? 0;
  const previousAppearances = wrestler.appearancesThisSeason ?? 0;
  const previousConsecutiveWeeks = wrestler.consecutiveWeeksBooked ?? 0;
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, currentWeek);
  const wasUnderused = weeksSinceLastBooked >= FALLOUT_BALANCE.underuseWeeks;
  const wasOverused = previousConsecutiveWeeks >= FALLOUT_BALANCE.overuseConsecutiveWeeks;
  const wasHighlyFatigued = wrestler.fatigue >= FALLOUT_BALANCE.highFatigue;
  const wasSeverelyFatigued = wrestler.fatigue >= FALLOUT_BALANCE.severeFatigue;
  // Normal TV time is a small morale positive; pressure penalties only bite after repeated usage or long absences.
  let moraleChange = isBooked ? FALLOUT_BALANCE.bookedMoraleGain : isProtectedRest ? 2 : 0;
  let underusedBoostNote = "";

  if (!isBooked && isProtectedRest) {
    underusedBoostNote = `${wrestler.name} got the protected rest week the office approved, so the room read the absence as care instead of neglect.`;
  }

  if (isBooked && wasUnderused) {
    moraleChange += FALLOUT_BALANCE.underusedReturnMoraleGain;
    underusedBoostNote = `${wrestler.name} returned after ${weeksSinceLastBooked} weeks off TV and made the room feel the absence had weight, not just rust.`;
  }

  if (isBooked && (wasHighlyFatigued || wasOverused)) {
    const pressurePenalty = Math.max(
      1,
      Math.round(
        ((wasSeverelyFatigued ? FALLOUT_BALANCE.severePressureMoralePenalty : FALLOUT_BALANCE.pressureBookingMoralePenalty) +
          (wrestler.injuryStatus === "minor" ? INJURY_BALANCE.minorMoralePenalty : 0)) *
          rules.playerPressure.moralePenaltyMultiplier,
      ),
    );
    moraleChange -= pressurePenalty;
    const pressureSource = wasSeverelyFatigued ? "red-line fatigue" : wasHighlyFatigued ? "heavy fatigue" : "a long TV streak";
    fallout.overuseWarnings.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: -pressurePenalty,
      note: `${wrestler.name} was pushed through ${pressureSource}${wrestler.injuryStatus === "minor" ? " while already hurt" : ""}. The room read it as the kind of ask that spends trust, not just stamina.`,
    });
  }

  if (!isBooked && wasUnderused && !isProtectedRest) {
    const underusePenalty = Math.max(1, Math.round(FALLOUT_BALANCE.underuseMoralePenalty * rules.playerPressure.moralePenaltyMultiplier));
    moraleChange -= underusePenalty;
    fallout.underuseWarnings.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: -underusePenalty,
      note: `${wrestler.name} has been off TV for ${weeksSinceLastBooked} weeks. The silence is starting to read like a creative verdict.`,
    });
  }

  const nextMorale = clamp(wrestler.morale + moraleChange);

  if (nextMorale < wrestler.morale) {
    fallout.moraleDrops.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: nextMorale - wrestler.morale,
      note: `${wrestler.name} lost morale from ${isBooked ? "being asked to carry visible pressure without enough protection" : "another week where creative had nothing for them"}.`,
    });
  }

  if (nextMorale > wrestler.morale && moraleChange > 1) {
    fallout.moraleBoosts.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: nextMorale - wrestler.morale,
      note: underusedBoostNote || `${wrestler.name} gained morale because the TV time felt like a real role, not filler minutes.`,
    });
  }

  return {
    ...wrestler,
    momentum: clamp(wrestler.momentum + (momentumTotals[wrestler.id] ?? 0)),
    audienceHeat: clamp((wrestler.audienceHeat ?? SENTIMENT_NEUTRAL) + (isBooked ? Math.max(0, Math.round((momentumTotals[wrestler.id] ?? 0) / 2)) : 0)),
    fatigue: clamp(wrestler.fatigue + (fatigueTotals[wrestler.id] ?? 0)),
    morale: nextMorale,
    trust: clamp((wrestler.trust ?? SENTIMENT_NEUTRAL) + (isProtectedRest && !isBooked ? 2 : 0) - (isBooked && (wasHighlyFatigued || wasOverused) ? 3 : 0) - (!isBooked && wasUnderused && !isProtectedRest ? 2 : 0)),
    appearancesThisSeason: isBooked ? previousAppearances + 1 : previousAppearances,
    lastBookedWeek: isBooked ? currentWeek : previousLastBookedWeek,
    consecutiveWeeksBooked: isBooked ? (previousLastBookedWeek === currentWeek - 1 ? previousConsecutiveWeeks + 1 : 1) : 0,
  };
}

function evaluateInjuries(result: ShowResult, wrestlers: Wrestler[], game: GameState): InjuryFalloutItem[] {
  const bookedSegmentTypes = result.segmentResults.reduce<Record<string, SegmentType[]>>((typesByWrestler, segment) => {
    segment.participantIds.forEach((id) => {
      typesByWrestler[id] = [...(typesByWrestler[id] ?? []), segment.type];
    });
    return typesByWrestler;
  }, {});

  return Object.entries(bookedSegmentTypes)
    .map(([wrestlerId, segmentTypes]) => {
      const wrestler = wrestlers.find((talent) => talent.id === wrestlerId);
      const preShowWrestler = game.wrestlers.find((talent) => talent.id === wrestlerId);

      if (!wrestler || preShowWrestler?.injuryStatus === "major") {
        return undefined;
      }

      const riskScore = getSharedInjuryRiskScore({
        wrestler,
        preShowWrestler,
        segmentTypes,
        segmentResults: result.segmentResults.filter((segment) => segment.participantIds.includes(wrestler.id)),
        showType: result.showType,
        difficulty: game.difficulty,
      });
      const seed = `${result.id}-${wrestler.id}-${segmentTypes.join("|")}`;
      const variance = hashString(seed) % 20;
      const deterministicRisk = riskScore + variance;
      const status = deterministicRisk >= INJURY_BALANCE.majorThreshold ? "major" : deterministicRisk >= INJURY_BALANCE.minorThreshold ? "minor" : "healthy";

      if (status === "healthy") {
        return undefined;
      }

      const weeksRemaining =
        status === "major" ? 3 + (hashString(`${seed}-major`) % 6) : 1 + (hashString(`${seed}-minor`) % 3);
      const description = getInjuryDescription(wrestler, status, segmentTypes, deterministicRisk);
      return {
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        status,
        description,
        weeksRemaining,
        note:
          status === "major"
            ? `${wrestler.name} suffered a major injury and is unavailable for ${weeksRemaining} weeks. Medical pulled them from the board.`
            : `${wrestler.name} picked up a minor injury and can work through it for ${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"} with protection.`,
      };
    })
    .filter((item): item is InjuryFalloutItem => Boolean(item));
}

function getInjuryDescription(wrestler: Wrestler, status: "minor" | "major", segmentTypes: SegmentType[], riskScore: number) {
  if (status === "major") {
    return segmentTypes.includes("Open Challenge")
      ? `${wrestler.name} was hurt when the Open Challenge turned ugly.`
      : `${wrestler.name} broke down under the night's physical load.`;
  }

  if (riskScore >= 90) {
    return `${wrestler.name} is working through a painful knock after stacked usage.`;
  }

  return `${wrestler.name} is nursing a minor knock from the show.`;
}

function applyInjuryFallout(wrestlers: Wrestler[], injuryNotes: InjuryFalloutItem[], currentWeek: number) {
  return wrestlers.map((wrestler) => {
    const injury = injuryNotes.find((item) => item.wrestlerId === wrestler.id);

    if (!injury) {
      return wrestler;
    }

    const injuryWeeksRemaining = injury.status === wrestler.injuryStatus ? Math.max(wrestler.injuryWeeksRemaining, injury.weeksRemaining) : injury.weeksRemaining;

    return {
      ...wrestler,
      injuryStatus: injury.status,
      injuryDescription: injury.description,
      injuryWeeksRemaining,
      injuryOccurredWeek: currentWeek,
    };
  });
}

function getWeeksSinceLastBooked(wrestler: Wrestler, currentWeek: number) {
  const lastBookedWeek = wrestler.lastBookedWeek ?? 0;

  if (!lastBookedWeek) {
    return Math.max(0, currentWeek - 1);
  }

  return Math.max(0, currentWeek - lastBookedWeek);
}

function getSegmentContextBonus(segment: Segment, championships: Championship[], rivalries: Rivalry[]) {
  const rivalry = segment.rivalryId ? rivalries.find((activeRivalry) => activeRivalry.id === segment.rivalryId) : undefined;
  const championship = segment.championshipId ? championships.find((title) => title.id === segment.championshipId) : undefined;
  const rivalryBonus = rivalry ? (rivalry.stakes === "title" ? CONTEXT_BONUS.titleRivalry : CONTEXT_BONUS.rivalry) : 0;

  if (!championship) {
    return rivalryBonus;
  }

  if (segment.type === "Match") {
    return rivalryBonus + CONTEXT_BONUS.matchTitle;
  }

  if (segment.type === "Contract Signing") {
    return rivalryBonus + CONTEXT_BONUS.contractTitle;
  }

  if (segment.type === "Open Challenge") {
    return CONTEXT_BONUS.storyTitle;
  }

  return segment.type === "Backstage Angle" ? rivalryBonus + CONTEXT_BONUS.storyTitle : rivalryBonus;
}

function getSegmentFatigueGain(segment: Segment, actualDurationMinutes: number, wrestlerId: string, wrestlers: Wrestler[], priorCardUses: number) {
  const profile = getSegmentExecutionProfile(segment);
  const wrestler = wrestlers.find((talent) => talent.id === wrestlerId);
  const fallback = SEGMENT_FATIGUE_GAIN[segment.type];
  const durationLoad = actualDurationMinutes * profile.fatiguePerMinute;
  const repeatedUseLoad = priorCardUses * 2;
  const healthLoad = wrestler?.injuryStatus === "minor" ? 1 : 0;

  return Math.max(1, Math.round(Math.max(fallback, profile.fatigueBase + durationLoad + repeatedUseLoad + healthLoad)));
}

function getSegmentMomentumGain(score: number, isPle: boolean) {
  const baseGain = score >= 95 ? 8 : score >= 90 ? 7 : score >= 85 ? 6 : score >= 70 ? 4 : score >= 55 ? 2 : 1;
  return baseGain + (isPle ? SHOW_BALANCE.pleMomentumBonus : 0);
}

function getOpenChallengeMomentModifier(segment: Segment, participants: Wrestler[]) {
  if (segment.type !== "Open Challenge" || participants.length < 2) {
    return 0;
  }

  const [issuer, opponent] = participants;
  const readinessGap = getOpenChallengeReadiness(opponent) - getOpenChallengeReadiness(issuer);
  const fatigueDrag = opponent.fatigue >= FALLOUT_BALANCE.highFatigue ? -2 : 0;
  const momentumSpark = opponent.momentum >= 65 ? 2 : 0;
  const surpriseQuality = readinessGap >= 10 ? 2 : readinessGap <= -15 ? -3 : 0;

  return surpriseQuality + fatigueDrag + momentumSpark;
}

function getOpenChallengeReadiness(wrestler: Wrestler) {
  return wrestler.ringSkill * 0.35 + wrestler.popularity * 0.25 + wrestler.momentum * 0.25 + wrestler.morale * 0.1 - wrestler.fatigue * 0.2;
}

function resolveOpenChallenge(segment: Segment, game: GameState, segmentIndex: number, bookedIds: Set<string>) {
  const opponent = selectOpenChallengeOpponent(segment, game, segmentIndex, bookedIds);

  if (!opponent) {
    return {
      segment,
      isNoContest: true,
    };
  }

  return {
    segment: {
      ...segment,
      participantIds: [segment.participantIds[0], opponent.id],
    },
    opponent,
    isNoContest: false,
  };
}

function selectOpenChallengeOpponent(segment: Segment, game: GameState, segmentIndex: number, bookedIds: Set<string>) {
  const issuerId = segment.participantIds[0];
  const issuer = game.wrestlers.find((wrestler) => wrestler.id === issuerId);
  const issuerDivision = getWrestlerDivisionGroup(issuer);
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const eligible = game.wrestlers.filter((wrestler) => {
    const opponentDivision = getWrestlerDivisionGroup(wrestler);

    return (
      wrestler.id !== issuerId &&
      !protectedRestIds.has(wrestler.id) &&
      isWrestlerAvailable(wrestler) &&
      (!issuerDivision || !opponentDivision || opponentDivision === issuerDivision)
    );
  });

  if (!eligible.length) {
    return undefined;
  }

  const preferred = eligible.filter((wrestler) => !bookedIds.has(wrestler.id));
  const candidates = preferred.length ? preferred : eligible;
  const seed = `${game.seasonNumber}-${game.currentWeek}-${segment.id}-${segmentIndex}`;

  return [...candidates].sort((a, b) => {
    const leftScore = hashString(`${seed}-${a.id}`) - Math.floor(a.momentum / 10);
    const rightScore = hashString(`${seed}-${b.id}`) - Math.floor(b.momentum / 10);
    return leftScore - rightScore || a.name.localeCompare(b.name);
  })[0];
}

function isWrestlerAvailable(wrestler: Wrestler) {
  const maybeAvailability = wrestler as Wrestler & { injured?: boolean; unavailable?: boolean; status?: string };
  return (
    wrestler.injuryStatus !== "major" &&
    !maybeAvailability.injured &&
    !maybeAvailability.unavailable &&
    maybeAvailability.status !== "injured" &&
    maybeAvailability.status !== "unavailable"
  );
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function getSegmentRecap(segment: Segment, wrestlers: Wrestler[], score: number, isPle: boolean, winnerId?: string, isNoContest?: boolean) {
  const names = segment.participantIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown");
  const joinedNames = names.join(" / ");
  const pairedNames = names.join(" and ");
  const teamNames = getTagTeamNamesForSegment(segment, wrestlers);
  const stage = isPle ? " under major-event pressure" : "";

  if (segment.type === "Open Challenge") {
    const [issuer, opponent] = names;

    if (isNoContest || !opponent) {
      return `${issuer} issued the challenge, but nobody eligible answered. The segment died on the runway as a no contest.`;
    }

    const titleIntrigue = segment.championshipId ? " The title was on the line once the answer stepped through the curtain." : "";
    const flavor =
      score >= 90
        ? "The answer felt like a breakout interruption."
        : score >= 75
          ? "The answer landed like a genuine jolt."
          : score >= 55
            ? "The challenge created useful noise, even if it left room to grow."
            : "The answer exposed fatigue more than it sparked buzz.";
    return `${issuer} issued the challenge, and ${opponent} answered the call. ${flavor}${titleIntrigue}`;
  }

  if (segment.type === "Match") {
    if (segment.segmentCatalogId === "M020") {
      const winnerLabel = getTagMatchWinnerLabel(segment, wrestlers, winnerId);
      return winnerLabel
        ? `${teamNames}. ${winnerLabel} in a 2v2 tag contest, with ${getSegmentMatchTone(score)}${stage}.`
        : `${teamNames} ran a 2v2 tag contest${stage}.`;
    }

    if (score >= 95) {
      return `${pairedNames} delivered the kind of bell-to-bell statement that changes the room${stage}.`;
    }

    if (score >= 85) {
      return `${pairedNames} delivered a premium bell-to-bell statement${stage}.`;
    }

    return score >= 70
      ? `${pairedNames} delivered a crisp match${stage}.`
      : score >= 55
        ? `${pairedNames} got through the match, but the room wanted a cleaner gear.`
        : `${pairedNames} never found the gear the spot needed, and the silence carried into the next segment.`;
  }

  if (segment.type === "Promo") {
    if (score >= 95) {
      return `${joinedNames} made the microphone feel like the whole show was bending around it.`;
    }

    if (score >= 85) {
      return `${joinedNames} made the microphone feel like the center of the broadcast.`;
    }

    return score >= 70
      ? `${joinedNames} owned the microphone and gave the broadcast a clear voice.`
      : score >= 55
        ? `${joinedNames} kept the story alive, but the promo needed sharper fire.`
        : `${joinedNames} lost the room before the point could land.`;
  }

  if (segment.type === "Backstage Angle") {
    if (score >= 95) {
      return `${joinedNames} turned the backstage feed into the clip everyone rewinds.`;
    }

    if (score >= 85) {
      return `${joinedNames} made the backstage feed feel like surveillance with stakes.`;
    }

    return score >= 70
      ? `${joinedNames} turned the backstage cameras into useful story pressure.`
      : score >= 55
        ? `${joinedNames} added texture backstage, though the beat did not fully land.`
        : `${joinedNames} left the backstage cameras running on a beat the room did not buy.`;
  }

  if (score >= 95) {
    return `${pairedNames} made the contract table feel seconds away from becoming a crime scene.`;
  }

  if (score >= 85) {
    return `${pairedNames} made the contract table feel like a fight waiting for paperwork to end.`;
  }

  return score >= 70
    ? `${pairedNames} made the contract table feel dangerous without changing the title picture.`
    : score >= 55
      ? `${pairedNames} put ink on the table, but the tension needed more bite.`
      : `${pairedNames} made the contract table feel procedural when it needed danger.`;
}

export function getRivalryStatus(heat: number, freshness: number): RivalryStatus {
  if (freshness <= 25) {
    return "stale";
  }

  if (heat < 45 || freshness < 45) {
    return "cooling";
  }

  if (heat >= 70 && freshness >= 45) {
    return "rising";
  }

  return "steady";
}

type ResolvedShowContext = {
  seasonNumber: number;
  weekNumber: number;
  showName: string;
  showType: "tv" | "ple";
};

function resolveCrowdSparkedRivalry(
  segment: Segment,
  rivalries: Rivalry[],
  score: number,
  wrestlers: Wrestler[],
  context: ResolvedShowContext,
) {
  if (segment.type !== "Match" || segment.rivalryId || segment.participantIds.length !== 2 || score < RIVALRY_BALANCE.crowdSparkScore) {
    return undefined;
  }

  const participants = segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  if (
    participants.length !== 2 ||
    !canRivalryParticipantsShareDivision(participants) ||
    participants.some((wrestler) => rivalries.some((rivalry) => rivalry.participantIds.includes(wrestler.id)))
  ) {
    return undefined;
  }

  const [first, second] = participants;
  const stakes = segment.championshipId ? "title" : "respect";
  const storylineId = getDefaultStorylineIdForStakes(stakes);
  const storyline = getRivalryStoryline({ stakes, storylineId });
  const averageStarSignal = (first.popularity + first.momentum + second.popularity + second.momentum) / 4;
  const heat = clamp(Math.round(score * 0.55 + averageStarSignal * 0.45));
  const freshness = context.showType === "ple" || segment.championshipId ? 86 : 82;
  const rivalryId = `rivalry-spark-s${context.seasonNumber}-w${context.weekNumber}-${segment.id}`;
  const rivalry = applyRivalryCatalogDefaults({
    id: rivalryId,
    name: `${first.name} vs ${second.name}`,
    participantIds: [first.id, second.id],
    structure: "singles",
    storylineId: storyline.id,
    relationshipTag: storyline.relationshipTag,
    heat,
    freshness,
    weeksActive: 1,
    lastAdvancedWeek: context.weekNumber,
    status: getRivalryStatus(heat, freshness),
    stakes,
  });
  const note = `${rivalry.name} sparked after the crowd bought their ${score}-rated match as a real issue.`;
  const event: RivalryHistoryEvent = {
    id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${rivalryId}-started`,
    rivalryId,
    rivalryName: rivalry.name,
    participantIds: [...rivalry.participantIds],
    weekNumber: context.weekNumber,
    seasonNumber: context.seasonNumber,
    showName: context.showName,
    showType: context.showType,
    eventType: "started",
    note,
    heat: rivalry.heat,
    freshness: rivalry.freshness,
    status: rivalry.status,
  };

  rivalries.push(rivalry);

  return { rivalryId, note, events: [event] };
}

function canRivalryParticipantsShareDivision(wrestlers: Wrestler[]) {
  const divisions = [
    ...new Set(wrestlers.map((wrestler) => getWrestlerDivisionGroup(wrestler)).filter((division): division is "mens" | "womens" => Boolean(division))),
  ];
  return divisions.length <= 1;
}

function resolveRivalrySegment(segment: Segment, rivalries: Rivalry[], score: number, context: ResolvedShowContext) {
  if (!segment.rivalryId) {
    return undefined;
  }

  const rivalry = rivalries.find((activeRivalry) => activeRivalry.id === segment.rivalryId);

  if (!rivalry || !segment.participantIds.some((id) => rivalry.participantIds.includes(id))) {
    return undefined;
  }

  const events: RivalryHistoryEvent[] = [];
  const isPle = context.showType === "ple";
  const isTitleStakes = rivalry.stakes === "title" || Boolean(segment.championshipId);
  const repeatedBeat = rivalry.lastAdvancedWeek === context.weekNumber;
  const wasAlreadyThin = rivalry.freshness <= 35;
  const isPlePayoffLevel = isPle && score >= 85;
  const stipulation = getStipulationById(segment.stipulationId);
  // Rivalry movement should be visible after each beat, but freshness prevents one story from maxing out instantly.
  const scoreHeatDelta =
    score >= 95
      ? RIVALRY_BALANCE.superEliteHeatGain
      : score >= 90
        ? RIVALRY_BALANCE.eliteHeatGain
        : score >= 75
          ? RIVALRY_BALANCE.strongHeatGain
          : score >= 60
            ? RIVALRY_BALANCE.steadyHeatGain
            : RIVALRY_BALANCE.flatHeatLoss;
  const heatDelta =
    scoreHeatDelta +
    getRivalrySegmentTypeBonus(segment) +
    (stipulation?.rivalryHeatBonus ?? 0) +
    (isPle ? RIVALRY_BALANCE.pleHeatBonus : 0) +
    (isPlePayoffLevel ? RIVALRY_BALANCE.plePayoffHeatBonus : 0) +
    (isTitleStakes ? RIVALRY_BALANCE.titleStakesBonus : 0);
  const freshnessDelta = repeatedBeat
    ? isPlePayoffLevel
      ? RIVALRY_BALANCE.repeatedPlePayoffFreshnessCost
      : score >= 95
        ? RIVALRY_BALANCE.repeatedEliteFreshnessCost
        : score < 60
          ? RIVALRY_BALANCE.repeatedWeakBeatFreshnessCost + (wasAlreadyThin ? RIVALRY_BALANCE.coldFreshnessPenalty : 0)
          : RIVALRY_BALANCE.repeatedBeatFreshnessCost
    : isPlePayoffLevel
      ? RIVALRY_BALANCE.plePayoffFreshnessCost
      : score >= 95
        ? RIVALRY_BALANCE.eliteFreshnessCost
        : score < 60 && wasAlreadyThin
          ? RIVALRY_BALANCE.freshnessCost + RIVALRY_BALANCE.coldFreshnessPenalty
          : RIVALRY_BALANCE.freshnessCost;
  rivalry.heat = clamp(rivalry.heat + heatDelta);
  rivalry.freshness = clamp(rivalry.freshness + freshnessDelta);
  rivalry.lastAdvancedWeek = context.weekNumber;
  rivalry.status = getRivalryStatus(rivalry.heat, rivalry.freshness);

  const buildEvent = (eventType: RivalryHistoryEvent["eventType"], note: string): RivalryHistoryEvent => ({
    id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${rivalry.id}-${eventType}`,
    rivalryId: rivalry.id,
    rivalryName: rivalry.name,
    participantIds: [...rivalry.participantIds],
    weekNumber: context.weekNumber,
    seasonNumber: context.seasonNumber,
    showName: context.showName,
    showType: context.showType,
    eventType,
    note,
    heat: rivalry.heat,
    freshness: rivalry.freshness,
    status: rivalry.status,
  });

  let note: string;
  let eventType: RivalryHistoryEvent["eventType"];

  if (rivalry.status === "stale") {
    eventType = "became_stale";
    note = repeatedBeat
      ? `${rivalry.name} lost the room because another same-night beat made the story feel overworked${isPle ? " even on a major stage" : ""}.`
      : `${rivalry.name} lost the room after a beat${isPle ? " on a major stage" : " on TV"} drained what was left of the thread.`;
  } else if (repeatedBeat && score < 85 && !isPlePayoffLevel) {
    eventType = score < 60 ? "cooled" : "advanced";
    note =
      score < 60
        ? `${rivalry.name} cooled hard after a repeated beat exposed how thin the thread had become.`
        : `${rivalry.name} moved, but the repeated same-night beat spent freshness faster than it created heat.`;
  } else if (score >= 95) {
    eventType = "heated_up";
    note = isPle
      ? `${rivalry.name} hit like a major-event receipt after an elite beat made the payoff feel earned.`
      : `${rivalry.name} became the story people argue the week around after an elite beat changed the room.`;
  } else if (score >= 90) {
    eventType = "heated_up";
    note = isPle
      ? `${rivalry.name} surged under major-event pressure and left with a real payoff signal.`
      : `${rivalry.name} shot upward after a premium beat gave the audience a louder side to pick.`;
  } else if (score >= 75) {
    eventType = "heated_up";
    note = `${rivalry.name} caught real heat after a strong${isPle ? " major-event" : ""} segment gave the room something concrete to chase.`;
  } else if (score >= 60) {
    eventType = "advanced";
    note = `${rivalry.name} moved forward${isPle ? " under the major-event lights" : ""}, but the next beat needs a sharper turn before freshness slips.`;
  } else {
    eventType = "cooled";
    note = wasAlreadyThin
      ? `${rivalry.name} cooled after a flat beat confirmed the story was already running on fumes.`
      : `${rivalry.name} cooled after a flat beat made the room feel the repetition.`;
  }

  events.push(buildEvent(eventType, note));

  if (isPle) {
    const payoffNote =
      score >= 90
        ? `${rivalry.name} cashed in a PLE checkpoint at ${context.showName}; the story left with a receipt the next TV has to answer.`
        : score >= 75
          ? `${rivalry.name} reached a PLE checkpoint at ${context.showName}; the story now has a receipt, not just build.`
          : `${rivalry.name} reached ${context.showName}, but the PLE checkpoint exposed more unfinished business than payoff.`;
    events.push(buildEvent("ple_payoff", payoffNote));
  }

  return { note, events };
}

function getRivalrySegmentTypeBonus(segment: Segment) {
  if (segment.type === "Backstage Angle") {
    return RIVALRY_BALANCE.backstageStoryBonus;
  }

  if (segment.type === "Contract Signing") {
    return RIVALRY_BALANCE.contractStoryBonus;
  }

  return 0;
}

function resolveTitleMatch(segment: Segment, championships: Championship[], wrestlers: Wrestler[], context: ResolvedShowContext) {
  if (!segment.championshipId || (segment.type !== "Match" && segment.type !== "Open Challenge")) {
    return undefined;
  }

  const championship = championships.find((title) => title.id === segment.championshipId);

  if (!championship) {
    return undefined;
  }

  if (segment.type === "Open Challenge" && (championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team")) {
    return undefined;
  }

  if (championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team") {
    return resolveTagTitleMatch(segment, championship, wrestlers, context);
  }

  if (championship.championIds.length === 0) {
    if (!isSinglesTitleContestShape(segment)) {
      return undefined;
    }

    const titleDivision = getChampionshipDivisionGroup(championship);

    if (titleDivision && !segment.participantIds.every((id) => wrestlerFitsChampionshipDivision(wrestlers.find((wrestler) => wrestler.id === id), championship))) {
      return undefined;
    }

    const winner = getSegmentWinner(segment, wrestlers);

    if (!winner) {
      return undefined;
    }

    championship.championIds = [winner.id];
    championship.reignStartWeek = context.weekNumber;
    championship.defenses = 0;
    const note =
      context.showType === "ple"
        ? `${winner.name} won the vacant ${championship.name} at a major event. The division finally has a center again, and every challenger line starts here.`
        : `${winner.name} won the vacant ${championship.name}. The belt is no longer open, and the title scene snaps to a new champion immediately.`;

    return {
      note,
      event: {
        id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${championship.id}-title-change`,
        championshipId: championship.id,
        championshipName: championship.name,
        eventType: "title_change",
        championIds: [winner.id],
        previousChampionIds: [],
        weekNumber: context.weekNumber,
        seasonNumber: context.seasonNumber,
        showName: context.showName,
        showType: context.showType,
        segmentId: segment.id,
        note,
      } satisfies ChampionshipHistoryEvent,
    };
  }

  if (!isSinglesTitleContestShape(segment) || championship.championIds.length !== 1) {
    return undefined;
  }

  const championId = championship.championIds[0];

  if (!segment.participantIds.includes(championId)) {
    return undefined;
  }

  const titleDivision = getChampionshipDivisionGroup(championship);

  if (titleDivision && !segment.participantIds.every((id) => wrestlerFitsChampionshipDivision(wrestlers.find((wrestler) => wrestler.id === id), championship))) {
    return undefined;
  }

  const winner = getSegmentWinner(segment, wrestlers);
  const champion = wrestlers.find((wrestler) => wrestler.id === championId);

  if (!winner || !champion) {
    return undefined;
  }

  if (winner.id === championId) {
    championship.defenses += 1;
    const defenseFrame =
      championship.defenses >= 3
        ? `Retained again. ${champion.name} is turning the ${championship.name} into a guarded office, and every failed challenger makes the belt feel harder to reach.`
        : context.showType === "ple"
          ? `${champion.name} survived a major-event defense of the ${championship.name}; the belt left heavier because the challenger made the champion prove it.`
          : `${champion.name} retained the ${championship.name}, keeping the title scene centered on the champion instead of opening the lane.`;
    const note = defenseFrame;

    return {
      note,
      event: {
        id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${championship.id}-successful-defense`,
        championshipId: championship.id,
        championshipName: championship.name,
        eventType: "successful_defense",
        championIds: [championId],
        weekNumber: context.weekNumber,
        seasonNumber: context.seasonNumber,
        showName: context.showName,
        showType: context.showType,
        segmentId: segment.id,
        defenseNumber: championship.defenses,
        note,
      } satisfies ChampionshipHistoryEvent,
    };
  }

  const previousChampionIds = [...championship.championIds];
  championship.championIds = [winner.id];
  championship.reignStartWeek = context.weekNumber;
  championship.defenses = 0;
  const note =
    context.showType === "ple"
      ? `${winner.name} defeated ${champion.name} to win the ${championship.name} at a major event. The title picture snapped to a new center, and the next TV now has a new gravity.`
      : `${winner.name} defeated ${champion.name} to win the ${championship.name}. The belt moved on TV, and the room has to reorganize around a new champion immediately.`;

  return {
    note,
    event: {
      id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${championship.id}-title-change`,
      championshipId: championship.id,
      championshipName: championship.name,
      eventType: "title_change",
      championIds: [winner.id],
      previousChampionIds,
      weekNumber: context.weekNumber,
      seasonNumber: context.seasonNumber,
      showName: context.showName,
      showType: context.showType,
      segmentId: segment.id,
      note,
    } satisfies ChampionshipHistoryEvent,
  };
}

function isSinglesTitleContestShape(segment: Segment) {
  if (segment.segmentCatalogId === "M002") {
    return segment.participantIds.length === 3;
  }

  if (segment.segmentCatalogId === "M003") {
    return segment.participantIds.length === 4;
  }

  return segment.participantIds.length === 2;
}

function getTeamLabel(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}

function getTagTitleSides(segment: Segment, championship: Championship) {
  if (segment.segmentCatalogId !== "M020" || segment.participantIds.length !== 4 || championship.championIds.length !== 2) {
    return undefined;
  }

  const teamAIds = segment.participantIds.slice(0, 2);
  const teamBIds = segment.participantIds.slice(2, 4);
  const championIds = new Set(championship.championIds);
  const teamAHasChampions = teamAIds.every((id) => championIds.has(id));
  const teamBHasChampions = teamBIds.every((id) => championIds.has(id));

  if (teamAHasChampions === teamBHasChampions) {
    return undefined;
  }

  return {
    championSideIds: teamAHasChampions ? teamAIds : teamBIds,
    challengerSideIds: teamAHasChampions ? teamBIds : teamAIds,
  };
}

function resolveTagTitleMatch(segment: Segment, championship: Championship, wrestlers: Wrestler[], context: ResolvedShowContext) {
  const uniqueParticipantCount = new Set(segment.participantIds).size;

  if (segment.segmentCatalogId !== "M020" || segment.participantIds.length !== 4 || uniqueParticipantCount !== 4 || (championship.championIds.length !== 0 && championship.championIds.length !== 2)) {
    return undefined;
  }

  const winner = getSegmentWinner(segment, wrestlers);

  if (!winner) {
    return undefined;
  }

  if (championship.championIds.length === 0) {
    const teams = getTagMatchTeams(segment);

    if (!teams) {
      return undefined;
    }

    const winningPairIds = teams.teamAIds.includes(winner.id) ? teams.teamAIds : teams.teamBIds;
    const losingPairIds = teams.teamAIds.includes(winner.id) ? teams.teamBIds : teams.teamAIds;
    const winningPairLabel = getTeamLabel(winningPairIds, wrestlers);
    const losingPairLabel = getTeamLabel(losingPairIds, wrestlers);
    championship.championIds = [...winningPairIds];
    championship.reignStartWeek = context.weekNumber;
    championship.defenses = 0;
    const note =
      context.showType === "ple"
        ? `${winningPairLabel} won the vacant ${championship.name} against ${losingPairLabel} at a major event, giving the tag division a new center.`
        : `${winningPairLabel} won the vacant ${championship.name} against ${losingPairLabel}. The tag title picture now has a team to chase.`;

    return {
      note,
      event: {
        id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${championship.id}-title-change`,
        championshipId: championship.id,
        championshipName: championship.name,
        eventType: "title_change",
        championIds: [...winningPairIds],
        previousChampionIds: [],
        winningPairIds: [...winningPairIds],
        losingPairIds: [...losingPairIds],
        winningPairLabel,
        losingPairLabel,
        weekNumber: context.weekNumber,
        seasonNumber: context.seasonNumber,
        showName: context.showName,
        showType: context.showType,
        segmentId: segment.id,
        note,
      } satisfies ChampionshipHistoryEvent,
    };
  }

  const sides = getTagTitleSides(segment, championship);

  if (!sides) {
    return undefined;
  }

  const championRetains = sides.championSideIds.includes(winner.id);
  const championPairLabel = getTeamLabel(sides.championSideIds, wrestlers);
  const challengerPairLabel = getTeamLabel(sides.challengerSideIds, wrestlers);

  if (championRetains) {
    championship.defenses += 1;
    const note =
      championship.defenses >= 3
        ? `${championPairLabel} retained the ${championship.name} again, turning the tag division into a chase that keeps running into the same locked door.`
        : context.showType === "ple"
          ? `${championPairLabel} retained the ${championship.name} against ${challengerPairLabel} on a major stage, keeping the division locked around their chemistry.`
          : `${championPairLabel} retained the ${championship.name} against ${challengerPairLabel}, forcing the tag scene to keep chasing a proven team.`;

    return {
      note,
      event: {
        id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${championship.id}-successful-defense`,
        championshipId: championship.id,
        championshipName: championship.name,
        eventType: "successful_defense",
        championIds: [...sides.championSideIds],
        winningPairIds: [...sides.championSideIds],
        losingPairIds: [...sides.challengerSideIds],
        winningPairLabel: championPairLabel,
        losingPairLabel: challengerPairLabel,
        weekNumber: context.weekNumber,
        seasonNumber: context.seasonNumber,
        showName: context.showName,
        showType: context.showType,
        segmentId: segment.id,
        defenseNumber: championship.defenses,
        note,
      } satisfies ChampionshipHistoryEvent,
    };
  }

  const previousChampionIds = [...championship.championIds];
  championship.championIds = [...sides.challengerSideIds];
  championship.reignStartWeek = context.weekNumber;
  championship.defenses = 0;
  const note =
    context.showType === "ple"
      ? `${challengerPairLabel} defeated ${championPairLabel} to win the ${championship.name} at a major event. The tag title picture snapped to a new center, and the division has to pick sides.`
      : `${challengerPairLabel} defeated ${championPairLabel} to win the ${championship.name}. The tag title picture has to reorganize around a new team on top.`;

  return {
    note,
    event: {
      id: `s${context.seasonNumber}-w${context.weekNumber}-${segment.id}-${championship.id}-title-change`,
      championshipId: championship.id,
      championshipName: championship.name,
      eventType: "title_change",
      championIds: [...sides.challengerSideIds],
      previousChampionIds,
      winningPairIds: [...sides.challengerSideIds],
      losingPairIds: [...sides.championSideIds],
      winningPairLabel: challengerPairLabel,
      losingPairLabel: championPairLabel,
      weekNumber: context.weekNumber,
      seasonNumber: context.seasonNumber,
      showName: context.showName,
      showType: context.showType,
      segmentId: segment.id,
      note,
    } satisfies ChampionshipHistoryEvent,
  };
}

type PostShowMatchRatingsProgressionInput = {
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

function applyPostShowMatchRatingsProgression(
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

type MatchRatingProgressionRole = "winner" | "loser" | "fallWinner" | "fallTaker" | "protectedLoser";

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

type SegmentWinnerSelectionContext = {
  segmentIndex: number;
  segmentCount: number;
  showType: CalendarWeek["showType"];
  matchOutcomeModel: MatchOutcomeModel;
  isNoContest: boolean;
};

function getCardPosition(index: number, total: number) {
  if (index === 0) {
    return "opener";
  }

  return index === total - 1 ? "main_event" : "midcard";
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

function seededOutcomeRoll(seed: string) {
  return (hashString(seed) % 1000000) / 1000000;
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

function isStandardMultiPersonDeepRatingsSegment(segment: Pick<Segment | SegmentResult, "type" | "segmentCatalogId" | "participantIds">) {
  return (
    segment.type === "Match" &&
    ((segment.segmentCatalogId === "M002" && segment.participantIds.length === 3) ||
      (segment.segmentCatalogId === "M003" && segment.participantIds.length === 4)) &&
    new Set(segment.participantIds).size === segment.participantIds.length
  );
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
  const injuryPenalty = wrestler.injuryStatus === "major" ? 28 : wrestler.injuryStatus === "minor" ? 14 : 0;
  return (
    (100 - ratings.resilience) * 1.15 +
    (100 - ratings.stamina) * 0.9 +
    (100 - ratings.clutch) * 0.65 +
    (100 - wrestler.morale) * 0.35 +
    (100 - wrestler.momentum) * 0.25 +
    wrestler.fatigue * 0.55 +
    Math.max(0, 70 - effectivePower) * 0.35 +
    injuryPenalty +
    1
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
  const winnerPick = weightedDeterministicPick(participantPowers, ({ power }) => power.effectivePower, seed);
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

function resolveSegmentWinnerSelection(
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

function getTagTeamNamesForSegment(segment: Segment, wrestlers: Wrestler[]) {
  const teams = getTagMatchTeams(segment);

  if (!teams) {
    return segment.participantIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
  }

  const teamA = teams.teamAIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
  const teamB = teams.teamBIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");

  return `Team A ${teamA ? `(${teamA})` : "(TBD)"} vs Team B ${teamB ? `(${teamB})` : "(TBD)"}`;
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

function getTagMatchWinnerLabel(segment: Segment, wrestlers: Wrestler[], winnerId?: string) {
  if (!winnerId) {
    return undefined;
  }

  const winner = wrestlers.find((wrestler) => wrestler.id === winnerId);

  if (!winner) {
    return undefined;
  }

  const teams = getTagMatchTeams(segment);

  if (!teams) {
    return undefined;
  }

  const winningSide = teams.teamAIds.includes(winner.id) ? "Team A" : "Team B";
  return `${winningSide} (${winner.name}) won`;
}

function getSegmentMatchTone(score: number) {
  if (score >= 85) {
    return "Team control was clear";
  }

  return score >= 70 ? "the contest moved with clean timing" : "the side momentum was uneven";
}

function getWinnerScore(wrestler: Wrestler) {
  return wrestler.popularity * 0.3 + wrestler.momentum * 0.25 + wrestler.ringSkill * 0.35 + wrestler.morale * 0.15 - wrestler.fatigue * 0.18;
}

function getBiggestChange(changes: Record<string, number>, wrestlers: Wrestler[]) {
  const entries = Object.entries(changes);
  const [id, amount] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), ["", 0]);
  return {
    name: wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "None",
    amount,
  };
}

function incrementRecordLine(line: NonNullable<Wrestler["record"]>["season"], key: keyof NonNullable<Wrestler["record"]>["season"]) {
  return {
    ...line,
    [key]: (line[key] ?? 0) + 1,
  };
}

function incrementWrestlerRecord(wrestler: Wrestler, key: keyof NonNullable<Wrestler["record"]>["season"]) {
  const record = wrestler.record ?? createDefaultWrestlerRecord();

  return {
    ...wrestler,
    record: {
      season: incrementRecordLine(record.season, key),
      career: incrementRecordLine(record.career, key),
    },
  };
}

function getTagRecordSides(segment: SegmentResult) {
  if (segment.segmentCatalogId !== "M020" || segment.participantIds.length !== 4 || !segment.winnerId) {
    return undefined;
  }

  const teamAIds = segment.participantIds.slice(0, 2);
  const teamBIds = segment.participantIds.slice(2, 4);
  const winnerInTeamA = teamAIds.includes(segment.winnerId);

  return {
    winners: winnerInTeamA ? teamAIds : teamBIds,
    losers: winnerInTeamA ? teamBIds : teamAIds,
  };
}

function applyMatchRecordFallout(wrestlers: Wrestler[], segmentResults: SegmentResult[]) {
  const recordEvents = new Map<string, Array<keyof NonNullable<Wrestler["record"]>["season"]>>();

  const addEvent = (wrestlerId: string, key: keyof NonNullable<Wrestler["record"]>["season"]) => {
    recordEvents.set(wrestlerId, [...(recordEvents.get(wrestlerId) ?? []), key]);
  };

  segmentResults.forEach((segment) => {
    if (segment.type !== "Match" || segment.isNoContest) {
      return;
    }

    if (segment.segmentCatalogId === "M020") {
      const sides = getTagRecordSides(segment);

      if (!sides) {
        segment.participantIds.forEach((id) => addEvent(id, "tagDraws"));
        return;
      }

      sides.winners.forEach((id) => addEvent(id, "tagWins"));
      sides.losers.forEach((id) => addEvent(id, "tagLosses"));
      return;
    }

    if (!segment.winnerId) {
      segment.participantIds.forEach((id) => addEvent(id, "draws"));
      return;
    }

    segment.participantIds.forEach((id) => addEvent(id, id === segment.winnerId ? "wins" : "losses"));
  });

  if (!recordEvents.size) {
    return wrestlers;
  }

  return wrestlers.map((wrestler) => (recordEvents.get(wrestler.id) ?? []).reduce((updated, key) => incrementWrestlerRecord(updated, key), wrestler));
}

export function getShowGrade(score: number) {
  if (score >= 90) {
    return "A";
  }

  if (score >= 80) {
    return "B";
  }

  if (score >= 70) {
    return "C";
  }

  if (score >= 60) {
    return "D";
  }

  return "F";
}

export function getBestSegment(result: ShowResult) {
  return result.segmentResults.reduce((best, segment) => (segment.score > best.score ? segment : best), result.segmentResults[0]);
}

export function getResultChange(changeMap: Record<string, number>) {
  return Object.values(changeMap)[0] ?? 0;
}

export function getSegmentBalanceSmokeScores(wrestlers: Wrestler[], championships: Championship[] = [], rivalries: Rivalry[] = []) {
  const [first, second, third] = wrestlers;

  if (!first || !second) {
    return [];
  }

  const rivalry = rivalries.find((activeRivalry) => activeRivalry.participantIds.some((id) => id === first.id || id === second.id));
  const singlesTitle = championships.find(
    (championship) => championship.division !== "Tag Team" && championship.championIds.length === 1 && [first.id, second.id].includes(championship.championIds[0]),
  );
  const multiPromoIds = [first, second, third].filter((wrestler): wrestler is Wrestler => Boolean(wrestler)).map((wrestler) => wrestler.id);
  const sampleSegments: Segment[] = [
    { id: "balance-match", type: "Match", participantIds: [first.id, second.id], championshipId: singlesTitle?.id, rivalryId: rivalry?.id },
    { id: "balance-promo", type: "Promo", participantIds: [first.id] },
    { id: "balance-backstage", type: "Backstage Angle", participantIds: [first.id, second.id], rivalryId: rivalry?.id },
    { id: "balance-contract", type: "Contract Signing", participantIds: [first.id, second.id], championshipId: singlesTitle?.id, rivalryId: rivalry?.id },
    { id: "balance-open-challenge", type: "Open Challenge", participantIds: [first.id, third?.id ?? second.id] },
    { id: "balance-multi-promo", type: "Promo", participantIds: multiPromoIds },
  ];

  return sampleSegments.map((segment) => ({
    type: segment.type,
    participantIds: segment.participantIds,
    score: scoreSegment(segment, wrestlers, championships, rivalries),
  }));
}
