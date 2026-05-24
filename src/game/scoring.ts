import type {
  CalendarWeek,
  Championship,
  ChampionshipHistoryEvent,
  GameState,
  InjuryFalloutItem,
  LockerRoomFallout,
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
import { draftPool } from "./seed";
import { getSegmentValidationRange } from "./matchFormatCatalog";
import { getChampionshipDivisionGroup, wrestlerFitsChampionshipDivision } from "./titleCatalog";
import { applyTitleEventStatFallout, applyTitleSceneStatFallout } from "./titleStatFallout";
import { getStipulationById } from "./stipulationCatalog";
import { getProtectedRestWrestlerIds, resolveSocialInboxRequestsAfterShow } from "./socialInboxActions";

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

export function runShow(game: GameState): { game: GameState; result: ShowResult } {
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
    const resolvedSegment = openChallengeResolution?.segment ?? segment;
    const isNoContest = Boolean(openChallengeResolution?.isNoContest);
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
    const titleNote = titleResolution?.note;
    const rivalryNote = rivalryResolution?.note;

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

    if (rivalryResolution?.events.length) {
      rivalryHistoryEvents.push(...rivalryResolution.events);
    }

    segmentResults.push({
      segmentId: segment.id,
      type: segment.type,
      participantNames: resolvedSegment.participantIds.map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown"),
      participantIds: resolvedSegment.participantIds,
      score,
      plannedDurationMinutes: execution.plannedDurationMinutes,
      actualDurationMinutes: execution.actualDurationMinutes,
      durationVarianceMinutes: execution.actualDurationMinutes - execution.plannedDurationMinutes,
      overrunAffected: overrunAffectedSegmentIds.has(segment.id),
      momentumChanges,
      fatigueChanges,
      championshipId: resolvedSegment.championshipId,
      rivalryId: resolvedSegment.rivalryId,
      segmentCatalogId: resolvedSegment.segmentCatalogId,
      stipulationId: resolvedSegment.stipulationId,
      winnerId,
      titleNote,
      rivalryNote,
      recapNote: getSegmentRecap(resolvedSegment, game.wrestlers, score, isPle, winnerId, openChallengeResolution?.isNoContest),
      resolvedOpponentId: openChallengeResolution?.opponent?.id,
      resolvedOpponentName: openChallengeResolution?.opponent?.name,
      isNoContest,
    });
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
  const titleSceneFallout = applyTitleSceneStatFallout(titleEventFallout.wrestlers, segmentResults, updatedChampionships);
  lockerRoomFallout.titleStatNotes = [...titleEventFallout.notes, ...titleSceneFallout.notes];
  const wrestlersWithTitleStats = titleSceneFallout.wrestlers;
  const gameWithSocialInboxResolution = resolveSocialInboxRequestsAfterShow(
    {
      ...game,
      wrestlers: wrestlersWithTitleStats,
    },
    result,
  );
  const financeReport = generateFinanceReport(result, game);
  const gameBeforeCpuSocial = {
    ...game,
    money: financeReport.endingMoney,
    wrestlers: gameWithSocialInboxResolution.wrestlers,
    socialInbox: gameWithSocialInboxResolution.socialInbox,
    championships: updatedChampionships,
    rivalries: updatedRivalries,
    championshipHistory: [...(game.championshipHistory ?? []), ...titleHistoryEvents],
    rivalryHistory: [...(game.rivalryHistory ?? []), ...rivalryHistoryEvents],
    financeReports: [...game.financeReports, financeReport],
    showHistory: [...game.showHistory, result],
  };
  const rivalBrands = generateCpuWeeklyResults(gameBeforeCpuSocial, result, draftPool);
  const gameWithCpuResults = {
    ...gameBeforeCpuSocial,
    rivalBrands,
  };

  return {
    result,
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
    fatigue: clamp(wrestler.fatigue + (fatigueTotals[wrestler.id] ?? 0)),
    morale: nextMorale,
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

      const riskScore = getInjuryRiskScore(wrestler, segmentTypes, result, game);
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

function getInjuryRiskScore(wrestler: Wrestler, segmentTypes: SegmentType[], result: ShowResult, game: GameState) {
  const physicalSegments = segmentTypes.filter((type) => type === "Match" || type === "Open Challenge").length;
  const preShowWrestler = game.wrestlers.find((talent) => talent.id === wrestler.id);
  const preShowFatigue = preShowWrestler?.fatigue ?? wrestler.fatigue;
  const highestFatigue = Math.max(preShowFatigue, wrestler.fatigue);
  const consecutiveWeeks = Math.max(preShowWrestler?.consecutiveWeeksBooked ?? 0, wrestler.consecutiveWeeksBooked ?? 0);
  const minorInjuryLoad = preShowWrestler?.injuryStatus === "minor" || wrestler.injuryStatus === "minor" ? 12 : 0;
  const physicalLoad = physicalSegments * 12;
  const stackedPhysicalLoad = physicalSegments >= 2 ? 14 : 0;
  const repeatLoad = consecutiveWeeks * 4;
  const fatigueLoad = highestFatigue * 0.7 + (highestFatigue >= INJURY_BALANCE.severeFatigue ? 8 : highestFatigue >= INJURY_BALANCE.highFatigue ? 4 : 0);
  const stageLoad = result.showType === "ple" ? INJURY_BALANCE.pleStageLoad : 0;

  return fatigueLoad + repeatLoad + physicalLoad + stackedPhysicalLoad + minorInjuryLoad + stageLoad + getDifficultyRules(game.difficulty).playerPressure.injuryRiskModifier;
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

  return [...candidates].sort((a, b) => hashString(`${seed}-${a.id}`) - hashString(`${seed}-${b.id}`) || a.name.localeCompare(b.name))[0];
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

    const titleIntrigue = segment.championshipId ? " The title scene picked up a little intrigue without putting the championship at stake." : "";
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
  if (!segment.championshipId || segment.type !== "Match") {
    return undefined;
  }

  const championship = championships.find((title) => title.id === segment.championshipId);

  if (!championship) {
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
