import type {
  CalendarWeek,
  Championship,
  GameState,
  LockerRoomFallout,
  Rivalry,
  RivalryStatus,
  Segment,
  SegmentResult,
  ShowResult,
  Wrestler,
} from "./types";
import { generateFinanceReport } from "./finance";
import { generateSocialPosts } from "./social";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function isValidSegment(segment: Segment) {
  switch (segment.type) {
    case "Match":
    case "Contract Signing":
      return segment.participantIds.length === 2;
    case "Promo":
      return segment.participantIds.length >= 1 && segment.participantIds.length <= 3;
    case "Backstage Angle":
      return segment.participantIds.length >= 2 && segment.participantIds.length <= 4;
    case "Open Challenge":
      return segment.participantIds.length === 1;
    default:
      return false;
  }
}

export function scoreSegment(segment: Segment, wrestlers: Wrestler[], championships: Championship[] = [], rivalries: Rivalry[] = []) {
  const participants = segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  if (!participants.length) {
    return 0;
  }

  const total = participants.reduce((sum, wrestler) => {
    if (segment.type === "Match" || segment.type === "Open Challenge") {
      return sum + wrestler.ringSkill * 0.4 + wrestler.popularity * 0.28 + wrestler.momentum * 0.22 + wrestler.morale * 0.12 - wrestler.fatigue * 0.18;
    }

    if (segment.type === "Promo") {
      return sum + wrestler.promoSkill * 0.38 + wrestler.popularity * 0.3 + wrestler.momentum * 0.22 + wrestler.morale * 0.12 - wrestler.fatigue * 0.16;
    }

    if (segment.type === "Backstage Angle") {
      return sum + wrestler.promoSkill * 0.34 + wrestler.momentum * 0.3 + wrestler.popularity * 0.2 + wrestler.morale * 0.12 - wrestler.fatigue * 0.12;
    }

    return sum + wrestler.promoSkill * 0.36 + wrestler.popularity * 0.3 + wrestler.momentum * 0.18 + wrestler.morale * 0.12 - wrestler.fatigue * 0.13;
  }, 0);

  const chemistryBonus = segment.type === "Match" || segment.type === "Open Challenge" ? 3 : participants.length > 1 ? 2 : 0;
  const opportunityBonus = segment.type === "Open Challenge" ? 2 : 0;
  return Math.round(clamp(total / participants.length + chemistryBonus + opportunityBonus + getSegmentContextBonus(segment, championships, rivalries)));
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
  const lockerRoomFallout: LockerRoomFallout = {
    moraleDrops: [],
    moraleBoosts: [],
    overuseWarnings: [],
    underuseWarnings: [],
  };
  const updatedChampionships = game.championships.map((championship) => ({ ...championship, championIds: [...championship.championIds] }));
  const updatedRivalries = game.rivalries.map((rivalry) => ({ ...rivalry, participantIds: [...rivalry.participantIds] }));
  const resolvedBookedIds = new Set(game.currentShow.flatMap((segment) => segment.participantIds));
  const segmentResults: SegmentResult[] = [];

  validSegments.forEach((segment, index) => {
    const openChallengeResolution =
      segment.type === "Open Challenge" ? resolveOpenChallenge(segment, game, index, resolvedBookedIds) : undefined;
    const resolvedSegment = openChallengeResolution?.segment ?? segment;
    const isNoContest = Boolean(openChallengeResolution?.isNoContest);
    const score = isNoContest ? 0 : clamp(scoreSegment(resolvedSegment, game.wrestlers, updatedChampionships, updatedRivalries) + (isPle ? 5 : 0));
    const momentumGain = isNoContest ? 0 : (score >= 80 ? 6 : score >= 65 ? 4 : score >= 50 ? 2 : 1) + (isPle ? 1 : 0);
    const fatigueGain = (isNoContest ? 1 : getSegmentFatigueGain(resolvedSegment)) + (isPle && !isNoContest ? 2 : 0);
    const momentumChanges: Record<string, number> = {};
    const fatigueChanges: Record<string, number> = {};
    const titleNote = resolveTitleMatch(resolvedSegment, updatedChampionships, game.wrestlers, game.currentWeek, isPle);
    const rivalryNote = isNoContest ? undefined : resolveRivalrySegment(resolvedSegment, updatedRivalries, score, game.currentWeek, isPle);

    resolvedSegment.participantIds.forEach((id) => {
      momentumChanges[id] = momentumGain;
      fatigueChanges[id] = fatigueGain;
      momentumTotals[id] = (momentumTotals[id] ?? 0) + momentumGain;
      fatigueTotals[id] = (fatigueTotals[id] ?? 0) + fatigueGain;
      resolvedBookedIds.add(id);
    });

    if (titleNote) {
      titleNotes.push(titleNote);
    }

    if (rivalryNote) {
      rivalryNotes.push(rivalryNote);
    }

    segmentResults.push({
      segmentId: segment.id,
      type: segment.type,
      participantNames: resolvedSegment.participantIds.map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown"),
      participantIds: resolvedSegment.participantIds,
      score,
      momentumChanges,
      fatigueChanges,
      championshipId: resolvedSegment.championshipId,
      rivalryId: resolvedSegment.rivalryId,
      titleNote,
      rivalryNote,
      recapNote: getSegmentRecap(resolvedSegment, game.wrestlers, score, isPle, openChallengeResolution?.isNoContest),
      resolvedOpponentId: openChallengeResolution?.opponent?.id,
      resolvedOpponentName: openChallengeResolution?.opponent?.name,
      isNoContest,
    });
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
    lockerRoomFallout,
  };

  const updatedWrestlers = game.wrestlers.map((wrestler) =>
    updateWrestlerPressure(wrestler, game.currentWeek, momentumTotals, fatigueTotals, lockerRoomFallout),
  );
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

function updateWrestlerPressure(
  wrestler: Wrestler,
  currentWeek: number,
  momentumTotals: Record<string, number>,
  fatigueTotals: Record<string, number>,
  fallout: LockerRoomFallout,
) {
  const isBooked = Object.prototype.hasOwnProperty.call(momentumTotals, wrestler.id) || Object.prototype.hasOwnProperty.call(fatigueTotals, wrestler.id);
  const previousLastBookedWeek = wrestler.lastBookedWeek ?? 0;
  const previousAppearances = wrestler.appearancesThisSeason ?? 0;
  const previousConsecutiveWeeks = wrestler.consecutiveWeeksBooked ?? 0;
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, currentWeek);
  const wasUnderused = weeksSinceLastBooked >= 3;
  const wasOverused = previousConsecutiveWeeks >= 3;
  const wasHighlyFatigued = wrestler.fatigue >= 60;
  let moraleChange = isBooked ? 1 : 0;
  let underusedBoostNote = "";

  if (isBooked && wasUnderused) {
    moraleChange += 2;
    underusedBoostNote = `${wrestler.name} got back on TV after ${weeksSinceLastBooked} weeks away and responded well.`;
  }

  if (isBooked && (wasHighlyFatigued || wasOverused)) {
    moraleChange -= 2;
    fallout.overuseWarnings.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: -2,
      note: `${wrestler.name} was booked through ${wasHighlyFatigued ? "heavy fatigue" : "a long TV streak"}.`,
    });
  }

  if (!isBooked && wasUnderused) {
    moraleChange -= 2;
    fallout.underuseWarnings.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: -2,
      note: `${wrestler.name} has gone ${weeksSinceLastBooked} weeks without TV time.`,
    });
  }

  const nextMorale = clamp(wrestler.morale + moraleChange);

  if (nextMorale < wrestler.morale) {
    fallout.moraleDrops.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: nextMorale - wrestler.morale,
      note: `${wrestler.name} lost morale from ${isBooked ? "being pushed through pressure" : "sitting out again"}.`,
    });
  }

  if (nextMorale > wrestler.morale && moraleChange > 1) {
    fallout.moraleBoosts.push({
      wrestlerId: wrestler.id,
      wrestlerName: wrestler.name,
      moraleChange: nextMorale - wrestler.morale,
      note: underusedBoostNote || `${wrestler.name} gained morale from meaningful TV time.`,
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
  const rivalryBonus = rivalry ? (rivalry.stakes === "title" ? 5 : 3) : 0;
  const titleBonus = championship ? (segment.type === "Match" ? 3 : 4) : 0;

  if (segment.type === "Backstage Angle" || segment.type === "Contract Signing") {
    return rivalryBonus + titleBonus;
  }

  if (segment.type === "Open Challenge") {
    return titleBonus;
  }

  return segment.type === "Match" ? rivalryBonus + titleBonus : rivalryBonus;
}

function getSegmentFatigueGain(segment: Segment) {
  if (segment.type === "Match" || segment.type === "Open Challenge") {
    return 8;
  }

  if (segment.type === "Backstage Angle") {
    return 4;
  }

  return 3;
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
  const eligible = game.wrestlers.filter((wrestler) => wrestler.id !== issuerId && isWrestlerAvailable(wrestler));

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
  return !maybeAvailability.injured && !maybeAvailability.unavailable && maybeAvailability.status !== "injured" && maybeAvailability.status !== "unavailable";
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function getSegmentRecap(segment: Segment, wrestlers: Wrestler[], score: number, isPle: boolean, isNoContest?: boolean) {
  const names = segment.participantIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown");
  const stage = isPle ? " on the major-event stage" : "";

  if (segment.type === "Open Challenge") {
    const [issuer, opponent] = names;

    if (isNoContest || !opponent) {
      return `${issuer} issued the challenge, but nobody eligible answered. The segment was ruled a no contest.`;
    }

    const titleIntrigue = segment.championshipId ? " The title scene picked up a little intrigue without putting the championship at stake." : "";
    const flavor =
      score >= 75
        ? "The surprise opponent gave the crowd something to talk about."
        : score >= 55
          ? "The challenge created momentum, even if it left some room to grow."
          : "The answer exposed fatigue more than it sparked momentum.";
    return `${issuer} issued the challenge, and ${opponent} answered the call. ${flavor}${titleIntrigue}`;
  }

  if (segment.type === "Match") {
    return score >= 70
      ? `${names.join(" and ")} delivered a crisp match${stage}.`
      : `${names.join(" and ")} got through the match, but the room wanted a cleaner gear.`;
  }

  if (segment.type === "Promo") {
    return score >= 70
      ? `${names.join(" / ")} owned the microphone and gave the broadcast a clear voice.`
      : `${names.join(" / ")} kept the story alive, but the promo needed sharper fire.`;
  }

  if (segment.type === "Backstage Angle") {
    return score >= 70
      ? `${names.join(" / ")} turned the backstage cameras into useful story pressure.`
      : `${names.join(" / ")} added texture backstage, though the beat did not fully land.`;
  }

  return score >= 70
    ? `${names.join(" and ")} made the contract table feel dangerous without changing the title picture.`
    : `${names.join(" and ")} put ink on the table, but the tension needed more bite.`;
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
