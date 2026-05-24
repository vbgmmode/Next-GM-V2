import { getResolvedSegmentStipulationLabel, getSegmentResultParticipantsLabel } from "../booking/bookingUtils";
import { formatMoney } from "../game/formatters";
import { getBestSegment, getShowGrade } from "../game/scoring";
import type { GameState, SegmentResult, ShowResult, Wrestler } from "../game/types";
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
  bestSegmentScore: number;
  bestSegmentDetail: string;
  runtimeLabel: string;
  runtimeDetail: string;
  segmentReads: SegmentBroadcastRead[];
};

function getOpenChallengeReveals(result: ShowResult) {
  return result.segmentResults.filter((segment) => segment.type === "Open Challenge" && segment.resolvedOpponentName);
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
    attendanceLabel: financeReport ? financeReport.attendance.toLocaleString() : "—",
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
