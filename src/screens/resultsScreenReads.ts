import { getResolvedSegmentStipulationLabel, getSegmentResultParticipantsLabel } from "../booking/bookingUtils";
import { getRatingsBattleSnapshot } from "../game/cpuRivalLoop";
import { formatAttendance, formatMoney } from "../game/formatters";
import { getBestSegment, getShowGrade } from "../game/scoring";
import type { GameState, SegmentResult, ShowResult, SocialCategory, SocialPost, SocialTone, Wrestler } from "../game/types";
import { getFinanceReportForResult, getShowTypeLabel } from "./financeScreenReads";

export type SegmentParticipantRead = {
  id: string;
  name: string;
  role: "winner" | "loser" | "participant" | "team-winner" | "team-loser";
};

export type SegmentBroadcastRead = {
  segmentId: string;
  index: number;
  type: SegmentResult["type"];
  score: number;
  scoreTone: "strong" | "steady" | "weak";
  badge: string;
  headline: string;
  matchupLabel?: string;
  isCompetitive: boolean;
  isNoContest: boolean;
  isTitleMatch: boolean;
  participants: SegmentParticipantRead[];
  stipulation?: string;
  titleNote?: string;
  rivalryNote?: string;
  recapNote?: string;
  falloutLine?: string;
  reelSummary: string;
};

function getWrestlerName(id: string, segment: SegmentResult, wrestlers: Wrestler[]) {
  return wrestlers.find((wrestler) => wrestler.id === id)?.name ?? segment.participantNames[segment.participantIds.indexOf(id)] ?? "Unknown";
}

function getScoreTone(score: number): SegmentBroadcastRead["scoreTone"] {
  if (score >= 85) {
    return "strong";
  }

  if (score < 60) {
    return "weak";
  }

  return "steady";
}

function buildTagMatchRead(segment: SegmentResult, wrestlers: Wrestler[]): Pick<SegmentBroadcastRead, "headline" | "matchupLabel" | "participants" | "isCompetitive" | "isNoContest" | "badge"> {
  const teamAIds = segment.participantIds.slice(0, 2);
  const teamBIds = segment.participantIds.slice(2, 4);
  const teamANames = teamAIds.map((id) => getWrestlerName(id, segment, wrestlers)).join(" / ");
  const teamBNames = teamBIds.map((id) => getWrestlerName(id, segment, wrestlers)).join(" / ");
  const matchupLabel = `${teamANames} vs ${teamBNames}`;

  if (segment.isNoContest || !segment.winnerId) {
    return {
      badge: segment.isNoContest ? "No Contest" : "Tag Match",
      headline: segment.isNoContest ? "No Contest" : matchupLabel,
      matchupLabel,
      isCompetitive: true,
      isNoContest: Boolean(segment.isNoContest),
      participants: segment.participantIds.map((id) => ({
        id,
        name: getWrestlerName(id, segment, wrestlers),
        role: "participant",
      })),
    };
  }

  const teamAWon = teamAIds.includes(segment.winnerId);
  const winningIds = teamAWon ? teamAIds : teamBIds;
  const losingIds = teamAWon ? teamBIds : teamAIds;
  const winningNames = winningIds.map((id) => getWrestlerName(id, segment, wrestlers)).join(" / ");
  const losingNames = losingIds.map((id) => getWrestlerName(id, segment, wrestlers)).join(" / ");

  return {
    badge: "Tag Win",
    headline: `${winningNames} def. ${losingNames}`,
    matchupLabel,
    isCompetitive: true,
    isNoContest: false,
    participants: segment.participantIds.map((id) => ({
      id,
      name: getWrestlerName(id, segment, wrestlers),
      role: winningIds.includes(id) ? "team-winner" : "team-loser",
    })),
  };
}

function buildCompetitiveRead(segment: SegmentResult, wrestlers: Wrestler[]): Pick<SegmentBroadcastRead, "headline" | "matchupLabel" | "participants" | "isCompetitive" | "isNoContest" | "badge"> {
  if (segment.segmentCatalogId === "M020" && segment.participantIds.length === 4) {
    return buildTagMatchRead(segment, wrestlers);
  }

  const names = segment.participantIds.map((id) => getWrestlerName(id, segment, wrestlers));
  const matchupLabel = names.join(" vs ");

  if (segment.isNoContest) {
    return {
      badge: "No Contest",
      headline: segment.type === "Open Challenge" ? "Open Challenge · No Answer" : "No Contest",
      matchupLabel,
      isCompetitive: true,
      isNoContest: true,
      participants: segment.participantIds.map((id, index) => ({
        id,
        name: names[index] ?? "Unknown",
        role: "participant",
      })),
    };
  }

  if (!segment.winnerId) {
    return {
      badge: segment.type === "Open Challenge" ? "Open Challenge" : "Match",
      headline: matchupLabel,
      matchupLabel,
      isCompetitive: true,
      isNoContest: false,
      participants: segment.participantIds.map((id, index) => ({
        id,
        name: names[index] ?? "Unknown",
        role: "participant",
      })),
    };
  }

  const winnerName = getWrestlerName(segment.winnerId, segment, wrestlers);
  const loserIds = segment.participantIds.filter((id) => id !== segment.winnerId);
  const loserNames = loserIds.map((id) => getWrestlerName(id, segment, wrestlers)).join(" / ");

  return {
    badge: segment.type === "Open Challenge" ? "Answered" : "Win",
    headline: `${winnerName} def. ${loserNames}`,
    matchupLabel,
    isCompetitive: true,
    isNoContest: false,
    participants: segment.participantIds.map((id) => ({
      id,
      name: getWrestlerName(id, segment, wrestlers),
      role: id === segment.winnerId ? "winner" : "loser",
    })),
  };
}

export function getSegmentOutcomeHeadline(segment: SegmentResult, wrestlers: Wrestler[]) {
  if (segment.type !== "Match" && segment.type !== "Open Challenge") {
    return undefined;
  }

  const read = buildCompetitiveRead(segment, wrestlers);

  if (read.isNoContest || segment.winnerId) {
    return read.headline;
  }

  return undefined;
}

export function buildSegmentBroadcastReads(result: ShowResult, wrestlers: Wrestler[]): SegmentBroadcastRead[] {
  return result.segmentResults.map((segment, index) => {
    const isCompetitiveSegment = segment.type === "Match" || segment.type === "Open Challenge";
    const competitiveRead = isCompetitiveSegment ? buildCompetitiveRead(segment, wrestlers) : null;
    const participantNames = segment.participantIds.map((id) => getWrestlerName(id, segment, wrestlers));
    const stipulation = getResolvedSegmentStipulationLabel(segment);
    const momentumTotal = Object.values(segment.momentumChanges).reduce((sum, value) => sum + value, 0);
    const fatigueTotal = Object.values(segment.fatigueChanges).reduce((sum, value) => sum + value, 0);

    return {
      segmentId: segment.segmentId,
      index: index + 1,
      type: segment.type,
      score: segment.score,
      scoreTone: getScoreTone(segment.score),
      badge: competitiveRead?.badge ?? (segment.championshipId || segment.titleNote ? "Title" : "Spot"),
      headline: competitiveRead?.headline ?? participantNames.join(" · "),
      matchupLabel: competitiveRead?.matchupLabel,
      isCompetitive: Boolean(competitiveRead),
      isNoContest: competitiveRead?.isNoContest ?? false,
      isTitleMatch: Boolean(segment.championshipId || segment.titleNote),
      participants:
        competitiveRead?.participants ??
        segment.participantIds.map((id, participantIndex) => ({
          id,
          name: participantNames[participantIndex] ?? "Unknown",
          role: "participant" as const,
        })),
      stipulation,
      titleNote: segment.titleNote,
      rivalryNote: segment.rivalryNote,
      recapNote: segment.recapNote,
      falloutLine: `Momentum +${momentumTotal} · Fatigue +${fatigueTotal}${segment.overrunAffected ? " · Closing block compressed" : ""}`,
      reelSummary: competitiveRead?.isNoContest
        ? "No Contest"
        : competitiveRead && !competitiveRead.isNoContest
          ? competitiveRead.headline
          : participantNames.slice(0, 2).join(" · ") || segment.type,
    };
  });
}

export type ResultsRecapTone = "strong" | "title" | "story" | "danger" | "reveal" | "steady" | "quiet";

export type ResultsRecapBeat = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: ResultsRecapTone;
};

export type ResultsViewModel = {
  isPleResult: boolean;
  seasonNumber: number;
  week: number;
  showTypeLabel: string;
  showName: string;
  totalScore: number;
  grade: string;
  verdict: string;
  recapTitle: string;
  pleResultRead: string;
  financeProfitLabel: string;
  financeProfitDetail: string;
  attendanceLabel: string;
  headlineBeat: ResultsRecapBeat;
  falloutBeats: ResultsRecapBeat[];
  topSocialReaction?: ResultsRecapBeat;
  rivalPressureBeat?: ResultsRecapBeat;
  nextWeekPressureBeat: ResultsRecapBeat;
  bestSegmentScore: number;
  bestSegmentDetail: string;
  runtimeLabel: string;
  runtimeDetail: string;
  segmentReads: SegmentBroadcastRead[];
};

function getOpenChallengeReveals(result: ShowResult) {
  return result.segmentResults.filter((segment) => segment.type === "Open Challenge" && segment.resolvedOpponentName);
}

function getSocialTonePriority(tone: SocialTone) {
  const priorities: Record<SocialTone, number> = {
    chaotic: 12,
    angry: 10,
    excited: 8,
    impressed: 7,
    skeptical: 5,
    analytical: 1,
  };

  return priorities[tone];
}

function getSocialCategoryPriority(category: SocialCategory) {
  const priorities: Record<SocialCategory, number> = {
    title_scene: 95,
    rivalry_heat: 90,
    ple_reaction: 86,
    viral_moment: 82,
    fatigue_concern: 78,
    push_complaint: 74,
    dirt_sheet: 70,
    fan_praise: 64,
    analyst_take: 58,
  };

  return priorities[category];
}

function getSocialPostPriority(post: SocialPost) {
  return getSocialCategoryPriority(post.category) + getSocialTonePriority(post.tone);
}

function getTopResolvedSocialPost(game: GameState, result: ShowResult) {
  return game.socialPosts
    .filter((post) => post.resultId === result.id)
    .sort((left, right) => getSocialPostPriority(right) - getSocialPostPriority(left) || left.id.localeCompare(right.id))[0];
}

function getSocialReactionLabel(post: SocialPost) {
  if (post.tone === "chaotic") {
    return "Internet Is Already Yelling";
  }

  if (post.category === "viral_moment") {
    return "Breakout Clip";
  }

  if (post.category === "fatigue_concern") {
    return "Workload Discourse";
  }

  if (post.category === "rivalry_heat") {
    return post.tone === "skeptical" || post.tone === "angry" ? "Fans Are Done Waiting" : "Story Heat Rising";
  }

  if (post.category === "title_scene") {
    return post.tone === "angry" ? "Title Scene Backlash" : "Title Scene Has Buzz";
  }

  if (post.tone === "angry") {
    return "Fans Are Heated";
  }

  return "IWC Pulse";
}

function getRecapToneFromSocial(post: SocialPost): ResultsRecapTone {
  if (post.tone === "angry" || post.tone === "chaotic") {
    return "danger";
  }

  if (post.category === "title_scene") {
    return "title";
  }

  if (post.category === "rivalry_heat") {
    return "story";
  }

  if (post.category === "viral_moment" || post.tone === "excited" || post.tone === "impressed") {
    return "strong";
  }

  return "steady";
}

export function buildTopSocialReaction(game: GameState, result: ShowResult): ResultsRecapBeat | undefined {
  const post = getTopResolvedSocialPost(game, result);

  if (!post) {
    return undefined;
  }

  return {
    id: "top-social-reaction",
    label: getSocialReactionLabel(post),
    value: post.author,
    detail: post.text,
    tone: getRecapToneFromSocial(post),
  };
}

export function buildRivalPressureBeat(game: GameState, result: ShowResult): ResultsRecapBeat | undefined {
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const playerEntry = ratingsBattle?.entries.find((entry) => entry.isPlayer);
  const resolvedRivals = ratingsBattle?.entries.filter((entry) => !entry.isPlayer && entry.latestScore !== undefined) ?? [];
  const topRival = resolvedRivals.sort((left, right) => (right.latestScore ?? 0) - (left.latestScore ?? 0) || left.brandName.localeCompare(right.brandName))[0];

  if (!ratingsBattle || !playerEntry || !topRival || playerEntry.latestScore === undefined || topRival.latestScore === undefined) {
    return undefined;
  }

  const gap = topRival.latestScore - playerEntry.latestScore;

  if (gap > 0) {
    return {
      id: "rival-pressure",
      label: "Rival Desk Won The Night",
      value: `${topRival.brandName} +${gap}`,
      detail: `${topRival.brandName} beat ${game.brandName} by ${gap}. The ratings argument is no longer theoretical.`,
      tone: "danger",
    };
  }

  if (gap < 0) {
    return {
      id: "rival-pressure",
      label: "You Won The Night",
      value: `${game.brandName} +${Math.abs(gap)}`,
      detail: `${game.brandName} cleared ${topRival.brandName} by ${Math.abs(gap)}. The rival desks have to answer next week.`,
      tone: "strong",
    };
  }

  return {
    id: "rival-pressure",
    label: "Ratings Dead Heat",
    value: `${playerEntry.latestScore}`,
    detail: `${game.brandName} and ${topRival.brandName} finished level. Next week's card owns the argument.`,
    tone: "story",
  };
}

export function buildNextWeekPressureBeat(game: GameState, result: ShowResult): ResultsRecapBeat {
  const nextWeek = game.calendar.find((week) => week.weekNumber === result.week + 1);
  const nextShowName = nextWeek?.showName ?? "Season Review";
  const injuryNote = result.lockerRoomFallout?.injuryNotes?.[0];
  const moraleDrop = result.lockerRoomFallout?.moraleDrops?.[0];
  const titleChange = (result.titleHistoryEvents ?? []).find((event) => event.eventType === "title_change");
  const rivalryNote = result.rivalryNotes[0];
  const topSocialPost = getTopResolvedSocialPost(game, result);

  if (injuryNote) {
    return {
      id: "next-week-pressure",
      label: "Next Week Pressure",
      value: "Medical Desk",
      detail: `${injuryNote.wrestlerName} changes the board before ${nextShowName}. Book around the damage, not the plan you had yesterday.`,
      tone: "danger",
    };
  }

  if (moraleDrop) {
    return {
      id: "next-week-pressure",
      label: "Next Week Pressure",
      value: "Locker Room Tense",
      detail: `${moraleDrop.note} Manage the room before ${nextShowName} turns one bad receipt into a pattern.`,
      tone: "story",
    };
  }

  if (titleChange) {
    return {
      id: "next-week-pressure",
      label: "Next Week Pressure",
      value: "Champion Protected",
      detail: `${titleChange.championshipName} needs a first follow-up beat before the title scene cools.`,
      tone: "title",
    };
  }

  if (rivalryNote) {
    return {
      id: "next-week-pressure",
      label: "Next Week Pressure",
      value: "Story Room Lit",
      detail: `${rivalryNote} Book the next beat before the crowd cools on the argument.`,
      tone: "story",
    };
  }

  if (topSocialPost) {
    return {
      id: "next-week-pressure",
      label: "Next Week Pressure",
      value: "Feed Has A Take",
      detail: `${topSocialPost.author} already gave next week an argument. Decide whether to feed it or cut it off.`,
      tone: getRecapToneFromSocial(topSocialPost),
    };
  }

  return {
    id: "next-week-pressure",
    label: "Next Week Pressure",
    value: "Carry The Best Beat",
    detail: `${result.biggestMomentumGain.name} gained the clearest momentum. Give ${nextShowName} a reason to remember it.`,
    tone: result.biggestMomentumGain.amount > 0 ? "strong" : "steady",
  };
}

export function getFalloutBeatDisplayLabel(beat: ResultsRecapBeat) {
  if (beat.id === "locker-room") {
    if (beat.tone === "danger" || beat.tone === "story") return "Locker Room Tense";
    if (beat.tone === "strong") return "Room Bought In";
  }

  if (beat.id === "title-scene") {
    if (beat.tone === "title") return "Title Scene Changed";
    if (beat.tone === "steady") return "Champion Protected";
  }

  if (beat.id === "rivalry-heat") {
    return beat.tone === "story" ? "Story Heat Rising" : "Fans Are Done Waiting";
  }

  if (beat.id === "open-challenge" && beat.tone === "reveal") {
    return "Curtain Hit";
  }

  if (beat.id === "headline-segment" && beat.tone === "danger") {
    return "Crowd Rejected The Close";
  }

  return beat.label;
}

function buildBroadcastRecap(result: ShowResult) {
  const bestSegment = getBestSegment(result);
  const bestNames = bestSegment.participantNames.join(" / ") || bestSegment.type;
  const titleFallout = result.titleNotes?.length ? ` Title fallout: ${result.titleNotes.join(" ")}` : "";
  const rivalryFallout = result.rivalryNotes?.length ? ` Story movement: ${result.rivalryNotes[0]}` : "";
  const runtimeFallout = result.broadcastOverrunNotes?.length ? ` Production note: ${result.broadcastOverrunNotes[0]}` : "";
  const scoreTone = result.totalScore >= 85 ? "premium" : result.totalScore >= 70 ? "controlled" : result.totalScore >= 55 ? "uneven" : "cold";
  const showFrame =
    result.showType === "ple"
      ? `${result.showName} gave ${result.brandName} a ${scoreTone} major-event receipt`
      : `${result.brandName} posted a ${scoreTone} ${result.totalScore} (${getShowGrade(result.totalScore)})`;

  return `${showFrame} in Week ${result.week}. ${bestNames} delivered the strongest ${bestSegment.type.toLowerCase()} at ${bestSegment.score}. ${result.biggestMomentumGain.name} gained the most momentum, while ${result.biggestFatigueIncrease.name} took the biggest fatigue hit.${runtimeFallout}${titleFallout}${rivalryFallout}`;
}

export function buildHeadlineBeat(result: ShowResult): ResultsRecapBeat {
  const bestSegment = getBestSegment(result);
  const titleChanges = (result.titleHistoryEvents ?? []).filter((event) => event.eventType === "title_change");
  const injuryNotes = result.lockerRoomFallout?.injuryNotes ?? [];
  const openChallengeReveals = getOpenChallengeReveals(result);

  if (titleChanges[0]) {
    return {
      id: "headline-title",
      label: "Headline Fallout",
      value: titleChanges[0].championshipName,
      detail: titleChanges[0].note,
      tone: "title",
    };
  }

  if (injuryNotes[0]) {
    return {
      id: "headline-injury",
      label: "Headline Fallout",
      value: injuryNotes[0].wrestlerName,
      detail: injuryNotes[0].note,
      tone: "danger",
    };
  }

  if (openChallengeReveals[0]) {
    return {
      id: "headline-open-challenge",
      label: "Headline Fallout",
      value: openChallengeReveals[0].resolvedOpponentName ?? "Open Challenge",
      detail: `${openChallengeReveals[0].resolvedOpponentName} answered ${openChallengeReveals[0].participantNames[0] ?? "the challenge"}.`,
      tone: "reveal",
    };
  }

  if (result.rivalryNotes[0]) {
    return {
      id: "headline-rivalry",
      label: "Headline Fallout",
      value: "Story Movement",
      detail: result.rivalryNotes[0],
      tone: "story",
    };
  }

  return {
    id: "headline-segment",
    label: "Biggest Moment",
    value: bestSegment.participantNames.join(" / ") || bestSegment.type,
    detail: bestSegment.recapNote ?? `${bestSegment.type} led the card with a ${bestSegment.score}.`,
    tone: bestSegment.score >= 85 ? "strong" : bestSegment.score < 60 ? "danger" : "steady",
  };
}

export function buildFalloutBeats(result: ShowResult): ResultsRecapBeat[] {
  const titleHistoryEvents = result.titleHistoryEvents ?? [];
  const titleChanges = titleHistoryEvents.filter((event) => event.eventType === "title_change");
  const rivalryHistoryEvents = result.rivalryHistoryEvents ?? [];
  const injuryNotes = result.lockerRoomFallout?.injuryNotes ?? [];
  const moraleDrops = result.lockerRoomFallout?.moraleDrops ?? [];
  const moraleBoosts = result.lockerRoomFallout?.moraleBoosts ?? [];
  const openChallengeReveals = getOpenChallengeReveals(result);

  return [
    {
      id: "title-scene",
      label: "Title Scene",
      value: titleChanges.length ? `${titleChanges.length} change${titleChanges.length === 1 ? "" : "s"}` : titleHistoryEvents.length ? `${titleHistoryEvents.length} logged` : "Quiet",
      detail: titleChanges[0]?.note ?? result.titleNotes[0] ?? "No title change or defense fallout was logged from this result.",
      tone: titleChanges.length ? "title" : titleHistoryEvents.length ? "steady" : "quiet",
    },
    {
      id: "rivalry-heat",
      label: "Rivalry Heat",
      value: rivalryHistoryEvents.length ? `${rivalryHistoryEvents.length} move${rivalryHistoryEvents.length === 1 ? "" : "s"}` : result.rivalryNotes.length ? `${result.rivalryNotes.length} note${result.rivalryNotes.length === 1 ? "" : "s"}` : "No move",
      detail: result.rivalryNotes[0] ?? rivalryHistoryEvents[0]?.note ?? "No rivalry movement was logged from this result.",
      tone: rivalryHistoryEvents.length || result.rivalryNotes.length ? "story" : "quiet",
    },
    {
      id: "locker-room",
      label: "Locker Room",
      value: injuryNotes.length ? `${injuryNotes.length} injury` : moraleBoosts.length || moraleDrops.length ? `${moraleBoosts.length + moraleDrops.length} morale` : "Level",
      detail: injuryNotes[0]?.note ?? moraleDrops[0]?.note ?? moraleBoosts[0]?.note ?? "No injury or morale fallout note was logged from this result.",
      tone: injuryNotes.length ? "danger" : moraleDrops.length ? "story" : moraleBoosts.length ? "strong" : "quiet",
    },
    {
      id: "open-challenge",
      label: "Open Challenge",
      value: openChallengeReveals.length ? `${openChallengeReveals.length} reveal${openChallengeReveals.length === 1 ? "" : "s"}` : "None",
      detail: openChallengeReveals[0]
        ? `${openChallengeReveals[0].resolvedOpponentName} answered ${openChallengeReveals[0].participantNames[0] ?? "the challenge"}.`
        : "No Open Challenge reveal was part of this result.",
      tone: openChallengeReveals.length ? "reveal" : "quiet",
    },
  ];
}

export function buildResultsViewModel(game: GameState, result: ShowResult): ResultsViewModel {
  const bestSegment = getBestSegment(result);
  const financeReport = getFinanceReportForResult(game, result);
  const isPleResult = result.showType === "ple";
  const falloutBeats = buildFalloutBeats(result);
  const activeFalloutBeats = falloutBeats.filter((beat) => beat.tone !== "quiet");

  return {
    isPleResult,
    seasonNumber: result.seasonNumber,
    week: result.week,
    showTypeLabel: getShowTypeLabel(result.showType),
    showName: result.showName,
    totalScore: result.totalScore,
    grade: getShowGrade(result.totalScore),
    verdict: buildBroadcastRecap(result),
    recapTitle:
      result.totalScore >= 85
        ? "Premium Broadcast Fallout"
        : result.totalScore >= 70
          ? "Solid Broadcast Fallout"
          : result.totalScore >= 55
            ? "Uneven Broadcast Fallout"
            : "Cold Broadcast Fallout",
    pleResultRead: isPleResult
      ? "Major-event night complete; the room now moves on the fallout instead of the build notes."
      : "Broadcast locked; review the fallout before calendar movement.",
    financeProfitLabel: financeReport ? formatMoney(financeReport.profitLoss) : "—",
    financeProfitDetail: financeReport ? `Balance ${formatMoney(financeReport.endingMoney)}` : "No close",
    attendanceLabel: financeReport ? formatAttendance(financeReport.attendance) : "—",
    headlineBeat: buildHeadlineBeat(result),
    falloutBeats: (activeFalloutBeats.length ? activeFalloutBeats : falloutBeats.slice(0, 2)).slice(0, 4),
    topSocialReaction: buildTopSocialReaction(game, result),
    rivalPressureBeat: buildRivalPressureBeat(game, result),
    nextWeekPressureBeat: buildNextWeekPressureBeat(game, result),
    bestSegmentScore: bestSegment.score,
    bestSegmentDetail: getSegmentResultParticipantsLabel(bestSegment, game.wrestlers),
    runtimeLabel: result.actualRuntimeMinutes !== undefined ? `${result.actualRuntimeMinutes} min` : "Legacy",
    runtimeDetail: result.plannedRuntimeMinutes !== undefined ? `Planned ${result.plannedRuntimeMinutes} min` : "No runtime record",
    segmentReads: buildSegmentBroadcastReads(result, game.wrestlers),
  };
}

export function formatRuntimeVariance(variance = 0) {
  if (variance === 0) {
    return "on time";
  }

  return variance > 0 ? `+${variance} min` : `${variance} min`;
}
