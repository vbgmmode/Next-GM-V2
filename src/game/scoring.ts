import type { CalendarWeek, Championship, GameState, Rivalry, RivalryStatus, Segment, ShowResult, Wrestler } from "./types";
import { generateFinanceReport } from "./finance";
import { generateSocialPosts } from "./social";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function isValidSegment(segment: Segment) {
  if (segment.type === "Match") {
    return segment.participantIds.length === 2;
  }

  return segment.participantIds.length >= 1 && segment.participantIds.length <= 3;
}

export function scoreSegment(segment: Segment, wrestlers: Wrestler[]) {
  const participants = segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  const total = participants.reduce((sum, wrestler) => {
    const skill = segment.type === "Match" ? wrestler.ringSkill : wrestler.promoSkill;
    return sum + wrestler.popularity * 0.3 + wrestler.momentum * 0.25 + skill * 0.35 + wrestler.morale * 0.15 - wrestler.fatigue * 0.18;
  }, 0);

  const chemistryBonus = segment.type === "Match" ? 3 : participants.length > 1 ? 2 : 0;
  return Math.round(clamp(total / participants.length + chemistryBonus));
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
  const validSegments = game.currentShow.filter(isValidSegment);
  const calendarWeek = getCurrentCalendarWeek(game);
  const isPle = calendarWeek.showType === "ple";
  const momentumTotals: Record<string, number> = {};
  const fatigueTotals: Record<string, number> = {};
  const titleNotes: string[] = [];
  const rivalryNotes: string[] = [];
  const updatedChampionships = game.championships.map((championship) => ({ ...championship, championIds: [...championship.championIds] }));
  const updatedRivalries = game.rivalries.map((rivalry) => ({ ...rivalry, participantIds: [...rivalry.participantIds] }));

  const segmentResults = validSegments.map((segment) => {
    const score = clamp(scoreSegment(segment, game.wrestlers) + (isPle ? 5 : 0));
    const momentumGain = (score >= 80 ? 6 : score >= 65 ? 4 : score >= 50 ? 2 : 1) + (isPle ? 1 : 0);
    const fatigueGain = (segment.type === "Match" ? 8 : 3) + (isPle ? 2 : 0);
    const momentumChanges: Record<string, number> = {};
    const fatigueChanges: Record<string, number> = {};
    const titleNote = resolveTitleMatch(segment, updatedChampionships, game.wrestlers, game.currentWeek, isPle);
    const rivalryNote = resolveRivalrySegment(segment, updatedRivalries, score, game.currentWeek, isPle);

    segment.participantIds.forEach((id) => {
      momentumChanges[id] = momentumGain;
      fatigueChanges[id] = fatigueGain;
      momentumTotals[id] = (momentumTotals[id] ?? 0) + momentumGain;
      fatigueTotals[id] = (fatigueTotals[id] ?? 0) + fatigueGain;
    });

    if (titleNote) {
      titleNotes.push(titleNote);
    }

    if (rivalryNote) {
      rivalryNotes.push(rivalryNote);
    }

    return {
      segmentId: segment.id,
      type: segment.type,
      participantNames: segment.participantIds.map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown"),
      participantIds: segment.participantIds,
      score,
      momentumChanges,
      fatigueChanges,
      championshipId: segment.championshipId,
      rivalryId: segment.rivalryId,
      titleNote,
      rivalryNote,
    };
  });

  const totalScore = Math.round(segmentResults.reduce((sum, result) => sum + result.score, 0) / segmentResults.length);
  const biggestMomentumGain = getBiggestChange(momentumTotals, game.wrestlers);
  const biggestFatigueIncrease = getBiggestChange(fatigueTotals, game.wrestlers);
  const id = `season-${game.seasonNumber}-week-${game.currentWeek}`;
  const result: ShowResult = {
    id,
    seasonNumber: game.seasonNumber,
    week: game.currentWeek,
    brandName: game.brandName,
    showName: calendarWeek.showName,
    showType: calendarWeek.showType,
    totalScore,
    segmentResults,
    biggestMomentumGain,
    biggestFatigueIncrease,
    titleNotes,
    rivalryNotes,
  };

  const updatedWrestlers = game.wrestlers.map((wrestler) => ({
    ...wrestler,
    momentum: clamp(wrestler.momentum + (momentumTotals[wrestler.id] ?? 0)),
    fatigue: clamp(wrestler.fatigue + (fatigueTotals[wrestler.id] ?? 0)),
    morale: clamp(wrestler.morale + (momentumTotals[wrestler.id] ? 1 : 0)),
  }));
  const financeReport = generateFinanceReport(result, game);

  return {
    result,
    game: {
      ...game,
      money: financeReport.endingMoney,
      wrestlers: updatedWrestlers,
      championships: updatedChampionships,
      rivalries: updatedRivalries,
      socialPosts: [...game.socialPosts, ...generateSocialPosts(result, game)],
      financeReports: [...game.financeReports, financeReport],
      showHistory: [...game.showHistory, result],
    },
  };
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

function resolveRivalrySegment(segment: Segment, rivalries: Rivalry[], score: number, currentWeek: number, isPle: boolean) {
  if (!segment.rivalryId) {
    return undefined;
  }

  const rivalry = rivalries.find((activeRivalry) => activeRivalry.id === segment.rivalryId);

  if (!rivalry || !segment.participantIds.some((id) => rivalry.participantIds.includes(id))) {
    return undefined;
  }

  const heatDelta = (score >= 75 ? 8 : score >= 60 ? 5 : -3) + (isPle ? 4 : 0);
  const freshnessDelta = rivalry.lastAdvancedWeek === currentWeek ? -12 : -6;
  rivalry.heat = clamp(rivalry.heat + heatDelta);
  rivalry.freshness = clamp(rivalry.freshness + freshnessDelta);
  rivalry.lastAdvancedWeek = currentWeek;
  rivalry.status = getRivalryStatus(rivalry.heat, rivalry.freshness);

  if (rivalry.status === "stale") {
    return `${rivalry.name} is getting stale after another beat${isPle ? " on a major stage" : " on TV"}.`;
  }

  if (score >= 75) {
    return `${rivalry.name} gained momentum and feels hotter after a strong${isPle ? " major-event" : ""} segment.`;
  }

  if (score >= 60) {
    return `${rivalry.name} heated up${isPle ? " under the major-event lights" : ""}, but the story lost a little freshness.`;
  }

  return `${rivalry.name} cooled after a flat segment.`;
}

function resolveTitleMatch(segment: Segment, championships: Championship[], wrestlers: Wrestler[], currentWeek: number, isPle: boolean) {
  if (!segment.championshipId || segment.type !== "Match" || segment.participantIds.length !== 2) {
    return undefined;
  }

  const championship = championships.find((title) => title.id === segment.championshipId);

  if (!championship || championship.division === "Tag Team" || championship.championIds.length !== 1) {
    return undefined;
  }

  const championId = championship.championIds[0];

  if (!segment.participantIds.includes(championId)) {
    return undefined;
  }

  const winner = getSegmentWinner(segment, wrestlers);
  const champion = wrestlers.find((wrestler) => wrestler.id === championId);

  if (!winner || !champion) {
    return undefined;
  }

  if (winner.id === championId) {
    championship.defenses += 1;
    return `${champion.name} retained the ${championship.name}${isPle ? " on a major stage" : ""}.`;
  }

  championship.championIds = [winner.id];
  championship.reignStartWeek = currentWeek;
  championship.defenses = 0;
  return `${winner.name} defeated ${champion.name} to win the ${championship.name}${isPle ? " at a major event" : ""}.`;
}

function getSegmentWinner(segment: Segment, wrestlers: Wrestler[]) {
  return segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
    .sort((a, b) => getWinnerScore(b) - getWinnerScore(a))[0];
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
