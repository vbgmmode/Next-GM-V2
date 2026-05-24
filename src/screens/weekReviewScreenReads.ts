import { getCpuResultsFeedSnapshot, getRatingsBattleSnapshot } from "../game/cpuRivalLoop";
import { formatAttendance, formatMoney } from "../game/formatters";
import {
  getWeekReviewHandoffSnapshot,
  getWeekReviewOfficeSnapshot,
  type WeekReviewHandoffSnapshot,
  type WeekReviewOfficeSnapshot,
} from "../game/gameContextReads";
import { getRosterPressureTags } from "../game/rosterContextReads";
import { getBestSegment, getShowGrade } from "../game/scoring";
import { formatRivalryEventType, formatRivalryStatus } from "../game/storyContextReads";
import type { FinanceReport, GameState, Rivalry, ShowResult } from "../game/types";
import { getSegmentResultParticipantsLabel, getResolvedSegmentStipulationLabel } from "../booking/bookingUtils";
import { getFinanceReportForResult, getShowTypeLabel } from "./financeScreenReads";
import { buildFalloutBeats, buildHeadlineBeat, type ResultsRecapBeat } from "./resultsScreenReads";

export type WeekReviewFalloutGroup = {
  id: string;
  label: string;
  lines: string[];
};

export type WeekReviewStoryEvent = {
  id: string;
  tag: string;
  note: string;
};

export type WeekReviewViewModel = {
  isPleResult: boolean;
  showName: string;
  showTypeLabel: string;
  seasonNumber: number;
  week: number;
  totalScore: number;
  grade: string;
  financeReport?: FinanceReport;
  financeSummary: string;
  titleSummary: string;
  bestSegmentScore: number;
  bestSegmentDetail: string;
  runtimeLabel: string;
  runtimeDetail: string;
  office: WeekReviewOfficeSnapshot;
  handoff: WeekReviewHandoffSnapshot;
  nextWeekName: string;
  nextWeekTypeLabel: string;
  nextPleName: string;
  nextPleDetail: string;
  advanceLabel: string;
  headline: ResultsRecapBeat;
  activeFalloutBeats: ResultsRecapBeat[];
  momentumName: string;
  momentumAmount: number;
  fatigueName: string;
  fatigueAmount: number;
  rosterFalloutGroups: WeekReviewFalloutGroup[];
  storyEvents: WeekReviewStoryEvent[];
  reviewedRivalries: Rivalry[];
  ratingsBattle: ReturnType<typeof getRatingsBattleSnapshot>;
  cpuResultsFeed: ReturnType<typeof getCpuResultsFeedSnapshot>;
  broadcastOverrunNotes: string[];
};

function buildRosterFalloutGroups(game: GameState, result: ShowResult): WeekReviewFalloutGroup[] {
  const fallout = result.lockerRoomFallout;
  const bookedIds = [...new Set(result.segmentResults.flatMap((segment) => segment.participantIds))];
  const injuryRiskWrestlers = game.wrestlers.filter(
    (wrestler) => bookedIds.includes(wrestler.id) && getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );
  const groups: WeekReviewFalloutGroup[] = [];

  if (fallout?.moraleDrops.length) {
    groups.push({
      id: "morale-drops",
      label: "Morale Drops",
      lines: fallout.moraleDrops.map((item) => `${item.note}${item.moraleChange ? ` (${item.moraleChange})` : ""}`),
    });
  }

  if (fallout?.moraleBoosts.length) {
    groups.push({
      id: "morale-boosts",
      label: "Morale Boosts",
      lines: fallout.moraleBoosts.map((item) => `${item.note}${item.moraleChange ? ` (+${item.moraleChange})` : ""}`),
    });
  }

  if (fallout?.overuseWarnings.length) {
    groups.push({
      id: "overuse",
      label: "Overuse",
      lines: fallout.overuseWarnings.map((item) => item.note),
    });
  }

  if (fallout?.underuseWarnings.length) {
    groups.push({
      id: "underuse",
      label: "Underuse",
      lines: fallout.underuseWarnings.map((item) => item.note),
    });
  }

  if (fallout?.injuryNotes?.length) {
    groups.push({
      id: "injuries",
      label: "Injuries",
      lines: fallout.injuryNotes.map((item) => `${item.note} ${item.description}`.trim()),
    });
  }

  if (fallout?.titleStatNotes?.length) {
    groups.push({
      id: "title-stats",
      label: "Championship Fallout",
      lines: fallout.titleStatNotes.map((item) => {
        const statParts = [
          item.momentumChange !== 0 ? `${item.momentumChange > 0 ? "+" : ""}${item.momentumChange} momentum` : "",
          item.popularityChange !== 0 ? `${item.popularityChange > 0 ? "+" : ""}${item.popularityChange} popularity` : "",
        ].filter(Boolean);

        return statParts.length ? `${item.wrestlerName}: ${statParts.join(", ")}. ${item.note}` : item.note;
      }),
    });
  }

  if (injuryRiskWrestlers.length) {
    groups.push({
      id: "injury-risk",
      label: "Injury Risk",
      lines: injuryRiskWrestlers.map((wrestler) => `${wrestler.name} finished at ${wrestler.fatigue} fatigue.`),
    });
  }

  if (!groups.length) {
    groups.push({
      id: "steady",
      label: "Locker Room",
      lines: ["No major roster pressure moved after this show. The room stays level for now."],
    });
  }

  return groups;
}

function buildStoryEvents(game: GameState, result: ShowResult): WeekReviewStoryEvent[] {
  const events: WeekReviewStoryEvent[] = [];
  const rivalryHistoryEvents = result.rivalryHistoryEvents ?? [];

  rivalryHistoryEvents.forEach((event) => {
    events.push({
      id: event.id,
      tag: `${formatRivalryEventType(event.eventType)} · ${event.rivalryName}`,
      note: event.note,
    });
  });

  if (!rivalryHistoryEvents.length && result.rivalryNotes.length) {
    result.rivalryNotes.forEach((note, index) => {
      events.push({
        id: `rivalry-note-${index}`,
        tag: "Rivalry Note",
        note,
      });
    });
  }

  result.segmentResults.forEach((segment, index) => {
    const label = getResolvedSegmentStipulationLabel(segment);

    if (label) {
      events.push({
        id: `${segment.segmentId}-stipulation`,
        tag: `Segment ${index + 1} · ${segment.type}`,
        note: `${label} for ${getSegmentResultParticipantsLabel(segment, game.wrestlers)}`,
      });
    }
  });

  return events;
}

export function buildWeekReviewViewModel(game: GameState, result: ShowResult): WeekReviewViewModel {
  const bestSegment = getBestSegment(result);
  const financeReport = getFinanceReportForResult(game, result);
  const rivalryIds = [...new Set(result.segmentResults.map((segment) => segment.rivalryId).filter((id): id is string => Boolean(id)))];
  const reviewedRivalries = rivalryIds
    .map((id) => game.rivalries.find((rivalry) => rivalry.id === id))
    .filter((rivalry): rivalry is Rivalry => Boolean(rivalry));
  const titleChanges = (result.titleHistoryEvents ?? []).filter((event) => event.eventType === "title_change");
  const nextWeek = game.calendar.find((week) => week.weekNumber === result.week + 1);
  const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= result.week + 1 && !week.completed);
  const weeksUntilNextPle = nextPle ? Math.max(0, nextPle.weekNumber - result.week) : 0;

  return {
    isPleResult: result.showType === "ple",
    showName: result.showName,
    showTypeLabel: getShowTypeLabel(result.showType),
    seasonNumber: result.seasonNumber,
    week: result.week,
    totalScore: result.totalScore,
    grade: getShowGrade(result.totalScore),
    financeReport,
    financeSummary: financeReport
      ? `${formatAttendance(financeReport.attendance)} paid doors · ${formatMoney(financeReport.profitLoss)} net`
      : "No finance close attached to this show.",
    titleSummary: titleChanges.length
      ? `${titleChanges.length} title change${titleChanges.length === 1 ? "" : "s"} logged · ${result.rivalryHistoryEvents?.length ?? 0} rivalry event${(result.rivalryHistoryEvents?.length ?? 0) === 1 ? "" : "s"}`
      : "No title transitions on this show.",
    bestSegmentScore: bestSegment.score,
    bestSegmentDetail: getSegmentResultParticipantsLabel(bestSegment, game.wrestlers),
    runtimeLabel: result.actualRuntimeMinutes !== undefined ? `${result.actualRuntimeMinutes} min` : "Legacy",
    runtimeDetail: result.plannedRuntimeMinutes !== undefined ? `Planned ${result.plannedRuntimeMinutes} min` : "No runtime record",
    office: getWeekReviewOfficeSnapshot(game, result, financeReport),
    handoff: getWeekReviewHandoffSnapshot(game, result, financeReport),
    nextWeekName: nextWeek ? nextWeek.showName : "Season Review",
    nextWeekTypeLabel: nextWeek ? getShowTypeLabel(nextWeek.showType) : "Review the year",
    nextPleName: nextPle ? nextPle.showName : "None",
    nextPleDetail: nextPle ? `${weeksUntilNextPle} week${weeksUntilNextPle === 1 ? "" : "s"} away` : "No remaining PLE",
    advanceLabel: result.week >= 12 ? "Season Review" : "Advance Week",
    headline: buildHeadlineBeat(result),
    activeFalloutBeats: buildFalloutBeats(result).filter((beat) => beat.tone !== "quiet"),
    momentumName: result.biggestMomentumGain.name,
    momentumAmount: result.biggestMomentumGain.amount,
    fatigueName: result.biggestFatigueIncrease.name,
    fatigueAmount: result.biggestFatigueIncrease.amount,
    rosterFalloutGroups: buildRosterFalloutGroups(game, result),
    storyEvents: buildStoryEvents(game, result),
    reviewedRivalries,
    ratingsBattle: getRatingsBattleSnapshot(game, result),
    cpuResultsFeed: getCpuResultsFeedSnapshot(game, result),
    broadcastOverrunNotes: result.broadcastOverrunNotes ?? [],
  };
}

export { formatRivalryStatus };
