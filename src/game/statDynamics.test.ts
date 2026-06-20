import { describe, expect, it } from "vitest";
import { advanceGameWeek } from "./advanceWeek";
import { getDifficultyRules } from "./difficultyRules";
import { getSharedInjuryRiskScore } from "./injury";
import { isValidSegment, runShow } from "./scoring";
import { createNewGame, draftPool } from "./seed";
import type { GameDifficulty, GameState, Rivalry, Segment, SegmentType, ShowType, Wrestler } from "./types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const modelConstants = {
  fatigueRecoveryPerAdvance: 3,
  underuseWeeks: 3,
  overuseConsecutiveWeeks: 3,
  highFatigueMoralePenalty: 50,
  severeFatigueMoralePenalty: 76,
  injuryMinorThreshold: 92,
  injuryMajorThreshold: 97,
  injuryVarianceWidth: 20,
  rivalryWeeklyHeatDecay: 4,
  rivalryWeeklyFreshnessDecay: 3,
  rivalryDefaultFreshnessCost: 3,
};

type BookingPolicy = (game: GameState, roster: Wrestler[]) => Segment[];

type InjuryBand = {
  baseRisk: number;
  minRisk: number;
  maxRisk: number;
  minorProbability: number;
  majorProbability: number;
};

type TrajectoryRow = {
  week: number;
  showType: ShowType;
  score: number;
  postShowMomentum: number;
  postShowFatigue: number;
  endWeekFatigue: number;
  postShowMorale: number;
  consecutiveWeeksBooked: number;
  injuryStatus: Wrestler["injuryStatus"];
  injuryBand: InjuryBand;
};

function createAnalysisRoster(count = 8) {
  return draftPool
    .filter((wrestler) => wrestler.division === "Mens")
    .slice(0, count)
    .map((wrestler, index): Wrestler => ({
      ...wrestler,
      popularity: 78 - index,
      momentum: 52,
      fatigue: 0,
      morale: 72,
      ringSkill: 82 - index,
      promoSkill: 76 - index,
      appearancesThisSeason: 0,
      lastBookedWeek: 0,
      consecutiveWeeksBooked: 0,
      injuryStatus: "healthy",
      injuryDescription: undefined,
      injuryWeeksRemaining: 0,
      injuryOccurredWeek: undefined,
    }));
}

function createAnalysisGame(difficulty: GameDifficulty = "Medium", roster = createAnalysisRoster()): GameState {
  return {
    ...createNewGame({ difficulty, draftedWrestlers: roster }),
    difficulty,
    wrestlers: roster,
    championships: [],
    rivalries: [],
    currentShow: [],
  };
}

function matchSegment(id: string, wrestlerIds: string[], durationMinutes = 12, rivalryId?: string): Segment {
  return {
    id,
    type: "Match",
    participantIds: wrestlerIds,
    winnerId: wrestlerIds[0],
    rivalryId,
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes,
    participantMin: 2,
    participantMax: 2,
  };
}

function promoSegment(id: string, wrestlerIds: string[], rivalryId?: string): Segment {
  return {
    id,
    type: "Promo",
    participantIds: wrestlerIds,
    rivalryId,
    segmentCatalogId: "P001",
    segmentDisplayName: "Promo",
    durationMinutes: 8,
    participantMin: 1,
    participantMax: 3,
  };
}

function openChallengeSegment(id: string, wrestlerId: string): Segment {
  return {
    id,
    type: "Open Challenge",
    participantIds: [wrestlerId],
    segmentDisplayName: "Open Challenge",
    durationMinutes: 12,
    participantMin: 1,
    participantMax: 1,
  };
}

function supportSegment(game: GameState, id: string, excludedWrestlerIds: string[] = []) {
  const available = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "major" && !excludedWrestlerIds.includes(wrestler.id));
  const participants = available.length >= 2 ? [available[0].id, available[1].id] : [game.wrestlers[0].id, game.wrestlers[1].id];

  return matchSegment(id, participants, 10);
}

function ensureRunnableCard(game: GameState, segments: Segment[], excludedSupportIds: string[] = []) {
  return segments.some((segment) => isValidSegment(segment, game.wrestlers)) ? segments : [supportSegment(game, `support-${game.currentWeek}`, excludedSupportIds)];
}

function getBookedSegmentTypes(resultGame: GameState, wrestlerId: string) {
  const latestResult = resultGame.showHistory.at(-1);

  return (
    latestResult?.segmentResults
      .filter((segment) => segment.participantIds.includes(wrestlerId))
      .map((segment) => segment.type) ?? []
  );
}

function getInjuryBand(
  preShowWrestler: Wrestler,
  postShowWrestler: Wrestler,
  segmentTypes: SegmentType[],
  showType: ShowType,
  difficulty: GameDifficulty,
): InjuryBand {
  const physicalSegments = segmentTypes.filter((type) => type === "Match" || type === "Open Challenge").length;
  const highestFatigue = Math.max(preShowWrestler.fatigue, postShowWrestler.fatigue);
  const consecutiveWeeks = Math.max(preShowWrestler.consecutiveWeeksBooked ?? 0, postShowWrestler.consecutiveWeeksBooked ?? 0);
  const minorInjuryLoad = preShowWrestler.injuryStatus === "minor" || postShowWrestler.injuryStatus === "minor" ? 12 : 0;
  const physicalLoad = physicalSegments * 12;
  const stackedPhysicalLoad = physicalSegments >= 2 ? 14 : 0;
  const repeatLoad = consecutiveWeeks * 4;
  const fatigueLoad = highestFatigue * 0.7 + (highestFatigue >= 85 ? 8 : highestFatigue >= 70 ? 4 : 0);
  const stageLoad = showType === "ple" ? 2 : 0;
  const baseRisk = fatigueLoad + repeatLoad + physicalLoad + stackedPhysicalLoad + minorInjuryLoad + stageLoad + getDifficultyRules(difficulty).playerPressure.injuryRiskModifier;
  const risks = Array.from({ length: modelConstants.injuryVarianceWidth }, (_, variance) => baseRisk + variance);
  const majorCount = risks.filter((risk) => risk >= modelConstants.injuryMajorThreshold).length;
  const minorCount = risks.filter((risk) => risk >= modelConstants.injuryMinorThreshold && risk < modelConstants.injuryMajorThreshold).length;

  return {
    baseRisk,
    minRisk: baseRisk,
    maxRisk: baseRisk + modelConstants.injuryVarianceWidth - 1,
    minorProbability: minorCount / modelConstants.injuryVarianceWidth,
    majorProbability: majorCount / modelConstants.injuryVarianceWidth,
  };
}

function runTrajectory(policy: BookingPolicy, difficulty: GameDifficulty = "Medium", weeks = 12) {
  let game = createAnalysisGame(difficulty);
  const trackedId = game.wrestlers[0].id;
  const rows: TrajectoryRow[] = [];

  for (let week = 1; week <= weeks; week += 1) {
    const preShowWrestler = game.wrestlers.find((wrestler) => wrestler.id === trackedId);

    expect(preShowWrestler).toBeDefined();

    const currentShow = ensureRunnableCard(game, policy(game, game.wrestlers), [trackedId]);
    const { game: postShowGame, result } = runShow({ ...game, currentShow });
    const postShowWrestler = postShowGame.wrestlers.find((wrestler) => wrestler.id === trackedId);

    expect(postShowWrestler).toBeDefined();

    const injuryBand = getInjuryBand(preShowWrestler!, postShowWrestler!, getBookedSegmentTypes(postShowGame, trackedId), result.showType, difficulty);
    const nextGame = week < weeks ? advanceGameWeek(postShowGame) : postShowGame;
    const endWeekWrestler = nextGame.wrestlers.find((wrestler) => wrestler.id === trackedId) ?? postShowWrestler!;
    rows.push({
      week: result.week,
      showType: result.showType,
      score: result.totalScore,
      postShowMomentum: postShowWrestler!.momentum,
      postShowFatigue: postShowWrestler!.fatigue,
      endWeekFatigue: endWeekWrestler.fatigue,
      postShowMorale: postShowWrestler!.morale,
      consecutiveWeeksBooked: postShowWrestler!.consecutiveWeeksBooked ?? 0,
      injuryStatus: postShowWrestler!.injuryStatus,
      injuryBand,
    });
    game = nextGame;
  }

  return rows;
}

function summarizeTrajectory(rows: TrajectoryRow[]) {
  const firstHighFatigue = rows.find((row) => row.postShowFatigue >= modelConstants.highFatigueMoralePenalty)?.week;
  const firstInjury = rows.find((row) => row.injuryStatus !== "healthy")?.week;
  const terminal = rows[rows.length - 1];

  return {
    firstHighFatigue,
    firstInjury,
    terminalMomentum: terminal.postShowMomentum,
    terminalFatigue: terminal.endWeekFatigue,
    terminalMorale: terminal.postShowMorale,
    minimumMorale: Math.min(...rows.map((row) => row.postShowMorale)),
    peakRisk: Math.max(...rows.map((row) => row.injuryBand.maxRisk)),
    peakMajorProbability: Math.max(...rows.map((row) => row.injuryBand.majorProbability)),
    averageScore: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
  };
}

function createRivalry(roster: Wrestler[]): Rivalry {
  return {
    id: "analysis-rivalry",
    name: `${roster[0].name} vs ${roster[1].name}`,
    participantIds: [roster[0].id, roster[1].id],
    structure: "singles",
    heat: 66,
    freshness: 72,
    weeksActive: 1,
    lastAdvancedWeek: 0,
    status: "steady",
    stakes: "personal",
  };
}

function runRivalryTrajectory(policy: BookingPolicy, weeks = 12) {
  const roster = createAnalysisRoster();
  const rivalry = createRivalry(roster);
  let game: GameState = {
    ...createAnalysisGame("Medium", roster),
    rivalries: [rivalry],
  };

  return Array.from({ length: weeks }, (_, index) => {
    const currentShow = ensureRunnableCard(game, policy(game, game.wrestlers), rivalry.participantIds);
    const { game: postShowGame } = runShow({ ...game, currentShow });
    game = index < weeks - 1 ? advanceGameWeek(postShowGame) : postShowGame;
    const nextRivalry = game.rivalries.find((item) => item.id === rivalry.id);

    expect(nextRivalry).toBeDefined();

    return {
      week: index + 1,
      heat: nextRivalry!.heat,
      freshness: nextRivalry!.freshness,
      status: nextRivalry!.status,
    };
  });
}

const weeklyWorkhorse: BookingPolicy = (_game, roster) => [matchSegment("workhorse-match", [roster[0].id, roster[1].id], 12)];

const rotateEveryThirdWeek: BookingPolicy = (game, roster) =>
  game.currentWeek % 3 === 1 ? [matchSegment(`rotate-match-${game.currentWeek}`, [roster[0].id, roster[1].id], 12)] : [matchSegment(`support-match-${game.currentWeek}`, [roster[2].id, roster[3].id], 12)];

const doubleBookWorkhorse: BookingPolicy = (_game, roster) => [
  matchSegment("double-match", [roster[0].id, roster[1].id], 12),
  openChallengeSegment("double-open-challenge", roster[0].id),
];

const openChallengeSpam: BookingPolicy = (_game, roster) => [openChallengeSegment("weekly-open-challenge", roster[0].id)];

const rivalryWeeklyBeat: BookingPolicy = (_game, roster) => [matchSegment("rivalry-weekly", [roster[0].id, roster[1].id], 12, "analysis-rivalry")];

const rivalryDoubleBeat: BookingPolicy = (_game, roster) => [
  matchSegment("rivalry-match", [roster[0].id, roster[1].id], 12, "analysis-rivalry"),
  promoSegment("rivalry-promo", [roster[0].id, roster[1].id], "analysis-rivalry"),
];

const rivalryTwoWeekGaps: BookingPolicy = (game, roster) =>
  game.currentWeek % 3 === 1 ? [matchSegment(`rivalry-gap-${game.currentWeek}`, [roster[0].id, roster[1].id], 12, "analysis-rivalry")] : [];

describe("weekly stat dynamics", () => {
  it("formalizes the weekly state machine and threshold constants", () => {
    expect(modelConstants).toMatchObject({
      fatigueRecoveryPerAdvance: 3,
      underuseWeeks: 3,
      overuseConsecutiveWeeks: 3,
      highFatigueMoralePenalty: 50,
      severeFatigueMoralePenalty: 76,
      injuryMinorThreshold: 92,
      injuryMajorThreshold: 97,
      injuryVarianceWidth: 20,
    });

    expect(clamp(110)).toBe(100);
    expect(clamp(-10)).toBe(0);
  });

  it("shows rotation as the stable fatigue policy while chronic use crosses pressure cliffs", () => {
    const workhorse = summarizeTrajectory(runTrajectory(weeklyWorkhorse));
    const rotated = summarizeTrajectory(runTrajectory(rotateEveryThirdWeek));

    expect(workhorse.firstHighFatigue).toBeDefined();
    expect(workhorse.firstHighFatigue!).toBeLessThanOrEqual(10);
    expect(workhorse.firstInjury).toBeDefined();
    expect(workhorse.firstInjury!).toBeGreaterThanOrEqual(10);
    expect(workhorse.terminalMomentum).toBeLessThanOrEqual(93);
    expect(rotated.firstHighFatigue).toBeUndefined();
    expect(rotated.terminalMorale).toBeGreaterThanOrEqual(78);
    expect(workhorse.minimumMorale).toBeLessThan(rotated.terminalMorale);
    expect(workhorse.peakRisk).toBeGreaterThan(rotated.peakRisk);
  });

  it("quantifies physical load and difficulty as injury reachability shifts", () => {
    const mediumWorkhorse = summarizeTrajectory(runTrajectory(weeklyWorkhorse, "Medium"));
    const doubleBooked = summarizeTrajectory(runTrajectory(doubleBookWorkhorse, "Medium"));
    const openChallenges = summarizeTrajectory(runTrajectory(openChallengeSpam, "Medium"));
    const easyWorkhorse = summarizeTrajectory(runTrajectory(weeklyWorkhorse, "Easy"));
    const legendaryWorkhorse = summarizeTrajectory(runTrajectory(weeklyWorkhorse, "Legendary"));
    const difficultyRiskFixture = createAnalysisRoster(2)[0];

    expect(doubleBooked.peakRisk).toBeGreaterThanOrEqual(modelConstants.injuryMinorThreshold);
    expect(doubleBooked.firstInjury).toBeDefined();
    expect(doubleBooked.firstInjury!).toBeLessThanOrEqual(6);
    expect(openChallenges.peakRisk).toBeGreaterThanOrEqual(modelConstants.injuryMinorThreshold);
    expect(
      getSharedInjuryRiskScore({
        difficulty: "Legendary",
        wrestler: { ...difficultyRiskFixture, fatigue: 72, consecutiveWeeksBooked: 5 },
        preShowWrestler: { ...difficultyRiskFixture, fatigue: 60, consecutiveWeeksBooked: 4 },
        segmentTypes: ["Match"],
        segmentResults: [{ type: "Match", plannedDurationMinutes: 12, actualDurationMinutes: 12 }],
        showType: "tv",
      }),
    ).toBeGreaterThan(
      getSharedInjuryRiskScore({
        difficulty: "Easy",
        wrestler: { ...difficultyRiskFixture, fatigue: 72, consecutiveWeeksBooked: 5 },
        preShowWrestler: { ...difficultyRiskFixture, fatigue: 60, consecutiveWeeksBooked: 4 },
        segmentTypes: ["Match"],
        segmentResults: [{ type: "Match", plannedDurationMinutes: 12, actualDurationMinutes: 12 }],
        showType: "tv",
      }),
    );
    expect(legendaryWorkhorse.minimumMorale).toBeLessThan(easyWorkhorse.minimumMorale);
  });

  it("captures rivalry freshness decay under weekly, repeated, and skipped beats", () => {
    const weekly = runRivalryTrajectory(rivalryWeeklyBeat);
    const repeated = runRivalryTrajectory(rivalryDoubleBeat);
    const skipped = runRivalryTrajectory(rivalryTwoWeekGaps);

    expect(weekly.at(-1)?.freshness).toBeGreaterThanOrEqual(38);
    expect(weekly.at(-1)?.status).not.toBe("stale");
    expect(repeated.at(-1)?.freshness).toBeLessThan(weekly.at(-1)?.freshness ?? 100);
    expect(skipped.at(-1)?.heat).toBeLessThan(weekly.at(-1)?.heat ?? 0);
  });
});
