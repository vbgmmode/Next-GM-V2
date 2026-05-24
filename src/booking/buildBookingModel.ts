import { bookedFinishCostUsd, getSegmentProductionCostForShow, getSegmentStipulationProductionCostForShow } from "../game/finance";
import { getPrestigeMainEventAnchorSnapshot } from "../game/championshipPrestigeReads";
import { formatMoney } from "../game/formatters";
import { getCurrentCalendarWeek, isValidSegment } from "../game/scoring";
import { getProtectedRestWrestlerIds } from "../game/socialInboxActions";
import type { GameState, Segment, ShowType } from "../game/types";
import {
  getBookingProducerNote,
  getBookingRuntimeHeat,
  getBookingWrestlerRiskReads,
  getSegmentDurationMinutes,
  getSegmentParticipantsLabel,
  getSegmentRailParticipantLines,
  getSegmentValidationWarning,
  getShowReadiness,
  isMajorEventStar,
  showRuntimeMinMinutes,
  tvRuntimeWarningMinutes,
} from "./bookingUtils";

export type BookingSegmentRow = {
  id: string;
  index: number;
  type: string;
  displayName: string;
  participantIds: string[];
  participantLabel: string;
  participantLine2: string;
  participantLine3: string;
  durationMinutes: number;
  durationLabel: string;
  valid: boolean;
  statusLabel: string;
  segmentProductionCost: number;
  stipulationProductionCost: number;
  bookedFinishCost: number;
  plannedCost: number;
  plannedCostLabel: string;
  costDetailLabel: string;
  isMainEvent: boolean;
  hasTitle: boolean;
  hasRivalry: boolean;
  titleName?: string;
  rivalryName?: string;
};

export type BookingComposerView = {
  segmentId: string;
  type: string;
  displayName: string;
  durationLabel: string;
  participantIds: string[];
  leftId: string;
  rightId: string;
  leftName: string;
  rightName: string;
  leftRole?: string;
  rightRole?: string;
  titleName?: string;
  rivalryName?: string;
  flags: string[];
  producerNote: string;
  isMatch: boolean;
};

export type BookingWarning = {
  id: string;
  tone: "red" | "amber" | "gold";
  message: string;
};

export type BookingRivalryCoverage = {
  id: string;
  name: string;
  intensity: number;
  onCard: boolean;
  leftId: string;
  rightId: string;
};

export type BookingRosterSnapshot = {
  id: string;
  name: string;
  booked: boolean;
  pop: number;
  fatigue: number;
};

export type BookingViewModel = {
  showName: string;
  segmentCount: number;
  segments: BookingSegmentRow[];
  runtime: {
    plannedMinutes: number;
    validMinutes: number;
    targetMinMinutes: number;
    targetMaxMinutes: number;
    percent: number;
    heatTone: "yellow" | "green" | "red";
    heatLabel: string;
    heatDetail: string;
    heatFillPercent: number;
    heatScaleMaxMinutes: number;
  };
  production: {
    segmentCost: number;
    stipulationCost: number;
    bookedFinishCost: number;
    totalCost: number;
    totalCostLabel: string;
  };
  readiness: {
    status: string;
    tone: string;
    note: string;
    canRun: boolean;
  };
  metrics: Array<{ label: string; value: string; detail?: string }>;
  balance: {
    matchCount: number;
    promoCount: number;
    matchPercent: number;
    promoPercent: number;
    balanceLabel: string;
  };
  warnings: BookingWarning[];
  rivalryCoverage: BookingRivalryCoverage[];
  rosterSnapshot: BookingRosterSnapshot[];
  riskRows: Array<{ wrestlerId: string; name: string; read: string }>;
  composer: BookingComposerView | null;
};

function wrestlerName(game: GameState, id: string) {
  return game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "TBD";
}

function isMatchSegment(segment: Segment) {
  return segment.type === "Match";
}

function buildProducerNote(game: GameState, segment: Segment, titleName?: string, rivalryName?: string) {
  const participants = getSegmentParticipantsLabel(segment, game.wrestlers);
  const duration = getSegmentDurationMinutes(segment);

  if (titleName && rivalryName) {
    return `${participants} booked for a ${duration}-minute ${segment.type.toLowerCase()} with ${titleName} and ${rivalryName} attached.`;
  }
  if (titleName) {
    return `${participants} booked for a ${duration}-minute ${segment.type.toLowerCase()} with ${titleName} attached.`;
  }
  if (rivalryName) {
    return `${participants} booked for a ${duration}-minute ${segment.type.toLowerCase()} with ${rivalryName}.`;
  }
  return `${participants} booked for a ${duration}-minute ${segment.type.toLowerCase()} on tonight's rundown.`;
}

function getPlannedSegmentCost(segment: Segment, showType: ShowType) {
  const segmentProductionCost = getSegmentProductionCostForShow(segment, showType) ?? 0;
  const stipulationProductionCost = getSegmentStipulationProductionCostForShow(segment, showType);
  const bookedFinishCost = segment.type === "Match" && segment.winnerId ? bookedFinishCostUsd : 0;
  const plannedCost = segmentProductionCost + stipulationProductionCost + bookedFinishCost;
  const detailParts = [
    formatMoney(segmentProductionCost),
    stipulationProductionCost ? `stip ${formatMoney(stipulationProductionCost)}` : "",
    bookedFinishCost ? `finish ${formatMoney(bookedFinishCost)}` : "",
  ].filter(Boolean);

  return {
    bookedFinishCost,
    costDetailLabel: detailParts.join(" + "),
    plannedCost,
    plannedCostLabel: formatMoney(plannedCost),
    segmentProductionCost,
    stipulationProductionCost,
  };
}

function buildSegmentRow(game: GameState, segment: Segment, index: number, total: number, showType: ShowType): BookingSegmentRow {
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const valid = isValidSegment(segment, game.wrestlers, protectedRestIds);
  const championship = segment.championshipId ? game.championships.find((title) => title.id === segment.championshipId) : undefined;
  const rivalry = segment.rivalryId ? game.rivalries.find((item) => item.id === segment.rivalryId) : undefined;
  const durationMinutes = getSegmentDurationMinutes(segment);
  const validationWarning = getSegmentValidationWarning(segment, game.wrestlers, protectedRestIds);
  const participantLines = getSegmentRailParticipantLines(segment, game.wrestlers, valid, validationWarning);
  const cost = getPlannedSegmentCost(segment, showType);

  return {
    id: segment.id,
    index: index + 1,
    type: segment.type,
    displayName: segment.segmentDisplayName ?? segment.type,
    participantIds: segment.participantIds,
    participantLabel: valid ? getSegmentParticipantsLabel(segment, game.wrestlers) : validationWarning,
    participantLine2: participantLines.line2,
    participantLine3: participantLines.line3,
    durationMinutes,
    durationLabel: `${durationMinutes}:00`,
    valid,
    statusLabel: valid ? "Ready" : "Needs Talent",
    ...cost,
    isMainEvent: total > 1 && index === total - 1,
    hasTitle: Boolean(championship),
    hasRivalry: Boolean(rivalry),
    titleName: championship?.name,
    rivalryName: rivalry?.name,
  };
}

function buildComposerView(game: GameState, segment: Segment, index: number, total: number): BookingComposerView {
  const championship = segment.championshipId ? game.championships.find((title) => title.id === segment.championshipId) : undefined;
  const rivalry = segment.rivalryId ? game.rivalries.find((item) => item.id === segment.rivalryId) : undefined;
  const leftId = segment.participantIds[0] ?? "";
  const rightId = segment.participantIds[1] ?? segment.participantIds[0] ?? "";
  const championId = championship?.championIds[0];
  const isMainEvent = total > 1 && index === total - 1;
  const flags: string[] = [];

  if (championship) {
    flags.push("Title Scene");
  }
  if (rivalry) {
    flags.push("Rivalry Beat");
  }
  if (isMainEvent) {
    flags.push("Main Event");
  }

  return {
    segmentId: segment.id,
    type: segment.type,
    displayName: segment.segmentDisplayName ?? segment.type,
    durationLabel: `${getSegmentDurationMinutes(segment)} min`,
    participantIds: segment.participantIds,
    leftId,
    rightId,
    leftName: wrestlerName(game, leftId),
    rightName: wrestlerName(game, rightId),
    leftRole: championId && leftId === championId ? "Champion" : leftId ? "Participant" : undefined,
    rightRole: championId && rightId === championId ? "Champion" : rightId && rightId !== leftId ? "Challenger" : undefined,
    titleName: championship?.name,
    rivalryName: rivalry?.name,
    flags,
    producerNote: buildProducerNote(game, segment, championship?.name, rivalry?.name),
    isMatch: isMatchSegment(segment),
  };
}

function buildBalance(segments: Segment[]) {
  const matchCount = segments.filter(isMatchSegment).length;
  const promoCount = segments.length - matchCount;
  const total = Math.max(segments.length, 1);
  const matchPercent = Math.round((matchCount / total) * 100);
  const promoPercent = 100 - matchPercent;

  let balanceLabel = "Balance Good";
  if (matchCount === 0 && promoCount > 0) {
    balanceLabel = "Promo Heavy";
  } else if (promoCount === 0 && matchCount > 0) {
    balanceLabel = "Match Heavy";
  } else if (matchPercent >= 75) {
    balanceLabel = "Fight Forward";
  } else if (promoPercent >= 60) {
    balanceLabel = "Story Forward";
  }

  return { matchCount, promoCount, matchPercent, promoPercent, balanceLabel };
}

function buildWarnings(game: GameState, invalidCount: number, unbookedCount: number, producerNote: string): BookingWarning[] {
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers, protectedRestIds));
  const validMinutes = validSegments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const readiness = getShowReadiness(validSegments.length, invalidCount, validMinutes);
  const warnings: BookingWarning[] = [{ id: "producer-note", tone: "gold", message: producerNote }];

  if (invalidCount > 0) {
    warnings.push({
      id: "invalid-segments",
      tone: "red",
      message: `${invalidCount} segment${invalidCount === 1 ? "" : "s"} need talent fixes`,
    });
  }

  if (readiness.tone === "underbuilt") {
    warnings.push({ id: "underbuilt", tone: "amber", message: readiness.note });
  }

  if (readiness.tone === "overloaded") {
    warnings.push({ id: "overloaded", tone: "red", message: readiness.note });
  }

  if (readiness.tone === "warning") {
    warnings.push({ id: "overtime", tone: "amber", message: readiness.note });
  }

  if (unbookedCount > 0 && game.currentShow.length > 0) {
    warnings.push({
      id: "unbooked-talent",
      tone: "gold",
      message: `${unbookedCount} roster member${unbookedCount === 1 ? "" : "s"} not on tonight's card`,
    });
  }

  const offCardRivalries = game.rivalries.filter((rivalry) => !game.currentShow.some((segment) => segment.rivalryId === rivalry.id));
  if (offCardRivalries.length > 0) {
    warnings.push({
      id: "rivalry-coverage",
      tone: "amber",
      message: `${offCardRivalries.length} active rivalr${offCardRivalries.length === 1 ? "y" : "ies"} off card`,
    });
  }

  return warnings.slice(0, 6);
}

export function buildBookingModel(game: GameState, selectedSegmentId?: string | null): BookingViewModel {
  const calendarWeek = getCurrentCalendarWeek(game);
  const segments = game.currentShow;
  const segmentRows = segments.map((segment, index) => buildSegmentRow(game, segment, index, segments.length, calendarWeek.showType));
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const validSegments = segments.filter((segment) => isValidSegment(segment, game.wrestlers, protectedRestIds));
  const invalidCount = segments.length - validSegments.length;
  const plannedMinutes = segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const validMinutes = validSegments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const readiness = getShowReadiness(validSegments.length, invalidCount, validMinutes);
  const bookedIds = new Set(segments.flatMap((segment) => segment.participantIds));
  const bookedCounts = segments.reduce<Record<string, number>>((counts, segment) => {
    segment.participantIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, {});
  const unbookedCount = game.wrestlers.filter((wrestler) => !bookedIds.has(wrestler.id)).length;
  const selectedSegment = selectedSegmentId === null ? undefined : ((selectedSegmentId ? segments.find((segment) => segment.id === selectedSegmentId) : undefined) ?? segments[0]);
  const onCardRivalryIds = new Set(segments.map((segment) => segment.rivalryId).filter(Boolean));
  const selectedIndex = selectedSegment ? segments.indexOf(selectedSegment) : -1;
  const runtimeHeat = getBookingRuntimeHeat(validMinutes);
  const bookedWrestlers = game.wrestlers.filter((wrestler) => bookedIds.has(wrestler.id));
  const riskRows = bookedWrestlers
    .map((wrestler) => ({
      reads: getBookingWrestlerRiskReads(wrestler, bookedCounts[wrestler.id] ?? 0),
      wrestler,
    }))
    .filter((item) => item.reads.length);
  const missingMajorStars = game.wrestlers.filter((wrestler) => isMajorEventStar(wrestler) && !bookedIds.has(wrestler.id));
  const rivalrySegmentCount = segments.filter((segment) => Boolean(segment.rivalryId)).length;
  const titleContextCount = segments.filter((segment) => Boolean(segment.championshipId)).length;
  const producerNote = getBookingProducerNote({
    missingMajorStars,
    readiness,
    riskCount: riskRows.length,
    rivalrySegmentCount,
    segmentCount: segments.length,
    titleContextCount,
  });
  const prestigeAnchor = getPrestigeMainEventAnchorSnapshot(game, validSegments);
  const producerNoteWithPrestige =
    prestigeAnchor.isSeasonFinalePle && prestigeAnchor.status !== "anchored"
      ? `${producerNote} ${prestigeAnchor.detail}`
      : producerNote;
  const segmentProductionCost = segmentRows.reduce((total, row) => total + row.segmentProductionCost, 0);
  const stipulationProductionCost = segmentRows.reduce((total, row) => total + row.stipulationProductionCost, 0);
  const bookedFinishCost = segmentRows.reduce((total, row) => total + row.bookedFinishCost, 0);
  const totalProductionCost = segmentProductionCost + stipulationProductionCost + bookedFinishCost;

  return {
    showName: calendarWeek.showName,
    segmentCount: segments.length,
    segments: segmentRows,
    runtime: {
      plannedMinutes,
      validMinutes,
      targetMinMinutes: showRuntimeMinMinutes,
      targetMaxMinutes: tvRuntimeWarningMinutes,
      percent: Math.min(100, Math.round((validMinutes / showRuntimeMinMinutes) * 100)),
      heatTone: runtimeHeat.tone,
      heatLabel: runtimeHeat.label,
      heatDetail: runtimeHeat.detail,
      heatFillPercent: runtimeHeat.fillPercent,
      heatScaleMaxMinutes: runtimeHeat.scaleMaxMinutes,
    },
    production: {
      segmentCost: segmentProductionCost,
      stipulationCost: stipulationProductionCost,
      bookedFinishCost,
      totalCost: totalProductionCost,
      totalCostLabel: formatMoney(totalProductionCost),
    },
    readiness: {
      status: readiness.status,
      tone: readiness.tone,
      note: readiness.note,
      canRun: readiness.canRun,
    },
    metrics: [
      { label: "Valid Segments", value: `${validSegments.length}/${segments.length}` },
      { label: "Runtime", value: `${validMinutes} min`, detail: `of ${showRuntimeMinMinutes}` },
      { label: "Workload Flags", value: String(riskRows.length) },
      { label: "Off Card", value: String(unbookedCount) },
    ],
    balance: buildBalance(segments),
    warnings: buildWarnings(game, invalidCount, unbookedCount, producerNoteWithPrestige),
    rivalryCoverage: game.rivalries.map((rivalry) => {
      const [leftId, rightId] = rivalry.participantIds;
      return {
        id: rivalry.id,
        name: rivalry.name,
        intensity: rivalry.heat,
        onCard: onCardRivalryIds.has(rivalry.id),
        leftId: leftId ?? "",
        rightId: rightId ?? "",
      };
    }),
    rosterSnapshot: [...game.wrestlers]
      .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((wrestler) => ({
        id: wrestler.id,
        name: wrestler.name,
        booked: bookedIds.has(wrestler.id),
        pop: wrestler.popularity,
        fatigue: wrestler.fatigue,
      })),
    riskRows: riskRows
      .slice(0, 4)
      .map((item) => ({ wrestlerId: item.wrestler.id, name: item.wrestler.name, read: item.reads[0] })),
    composer: selectedSegment ? buildComposerView(game, selectedSegment, selectedIndex, segments.length) : null,
  };
}
