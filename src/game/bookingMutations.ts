import { canSegmentAttachChampionship, canSegmentAttachRivalry } from "../booking/bookingUtils";
import { getDefaultCatalogOption, getSegmentParticipantRange } from "./matchFormatCatalog";
import { createUniqueDomainId } from "./domainIds";
import { getStipulationsForSegment } from "./stipulationCatalog";
import { isWrestlerProtectedRest } from "./socialInboxActions";
import type { GameState, Segment, SegmentType } from "./types";

const DEFAULT_MAX_BOOKING_SEGMENTS = 24;

function sanitizeBookingSegment(game: GameState, segment: Segment) {
  let updatedSegment = { ...segment };
  const range = getSegmentParticipantRange(updatedSegment);

  if (updatedSegment.participantIds.length > range.max) {
    updatedSegment = { ...updatedSegment, participantIds: updatedSegment.participantIds.slice(0, range.max) };
  }

  if (updatedSegment.winnerId && (updatedSegment.type !== "Match" || !updatedSegment.participantIds.includes(updatedSegment.winnerId))) {
    updatedSegment = { ...updatedSegment, winnerId: undefined };
  }

  const championship = updatedSegment.championshipId ? game.championships.find((title) => title.id === updatedSegment.championshipId) : undefined;

  if (championship && !canSegmentAttachChampionship(updatedSegment, championship, game.wrestlers)) {
    updatedSegment = { ...updatedSegment, championshipId: undefined };
  }

  const rivalry = updatedSegment.rivalryId ? game.rivalries.find((activeRivalry) => activeRivalry.id === updatedSegment.rivalryId) : undefined;

  if (rivalry && !canSegmentAttachRivalry(updatedSegment, rivalry, game.wrestlers)) {
    updatedSegment = { ...updatedSegment, rivalryId: undefined };
  }

  if (updatedSegment.stipulationId && !getStipulationsForSegment(updatedSegment).some((option) => option.id === updatedSegment.stipulationId)) {
    updatedSegment = { ...updatedSegment, stipulationId: undefined };
  }

  return updatedSegment;
}

export function addBookingSegment(game: GameState, type: SegmentType, segmentId?: string, maxSegments = DEFAULT_MAX_BOOKING_SEGMENTS) {
  if (game.currentShow.length >= maxSegments) {
    return game;
  }

  const catalogOption = getDefaultCatalogOption(type);
  const id = segmentId ?? createUniqueDomainId("segment", [game.seasonNumber, game.currentWeek, game.currentShow.length + 1, type], game.currentShow.map((segment) => segment.id));

  return {
    ...game,
    currentShow: [
      ...game.currentShow,
      {
        id,
        type,
        participantIds: [],
        segmentCatalogId: catalogOption?.id,
        segmentDisplayName: catalogOption?.label,
        durationMinutes: catalogOption?.defaultDurationMinutes,
        participantMin: catalogOption?.minParticipants,
        participantMax: catalogOption?.maxParticipants,
      },
    ],
  };
}

export function updateBookingSegment(game: GameState, segmentId: string, updates: Partial<Segment>) {
  let changed = false;
  const currentShow = game.currentShow.map((segment) => {
    if (segment.id !== segmentId) {
      return segment;
    }

    changed = true;
    return sanitizeBookingSegment(game, { ...segment, ...updates });
  });

  return changed ? { ...game, currentShow } : game;
}

export function replaceCurrentShow(game: GameState, segments: Segment[]) {
  return { ...game, currentShow: segments };
}

export function setSegmentChampionship(game: GameState, segmentId: string, championshipId: string) {
  let changed = false;
  const currentShow = game.currentShow.map((segment) => {
    if (segment.id !== segmentId) {
      return segment;
    }

    changed = true;
    const championship = game.championships.find((title) => title.id === championshipId);

    if (!championshipId || !championship || !canSegmentAttachChampionship(segment, championship, game.wrestlers)) {
      return { ...segment, championshipId: undefined };
    }

    return { ...segment, championshipId };
  });

  return changed ? { ...game, currentShow } : game;
}

export function setSegmentStipulation(game: GameState, segmentId: string, stipulationId: string) {
  let changed = false;
  const currentShow = game.currentShow.map((segment) => {
    if (segment.id !== segmentId) {
      return segment;
    }

    changed = true;

    if (!stipulationId) {
      return { ...segment, stipulationId: undefined };
    }

    if (!getStipulationsForSegment(segment).some((option) => option.id === stipulationId)) {
      return { ...segment, stipulationId: undefined };
    }

    return { ...segment, stipulationId };
  });

  return changed ? { ...game, currentShow } : game;
}

export function setSegmentRivalry(game: GameState, segmentId: string, rivalryId: string) {
  let changed = false;
  const currentShow = game.currentShow.map((segment) => {
    if (segment.id !== segmentId) {
      return segment;
    }

    changed = true;
    const rivalry = game.rivalries.find((activeRivalry) => activeRivalry.id === rivalryId);

    if (!rivalryId || !rivalry || !canSegmentAttachRivalry(segment, rivalry, game.wrestlers)) {
      return { ...segment, rivalryId: undefined };
    }

    return { ...segment, rivalryId };
  });

  return changed ? { ...game, currentShow } : game;
}

export function removeBookingSegment(game: GameState, segmentId: string) {
  if (!game.currentShow.some((segment) => segment.id === segmentId)) {
    return game;
  }

  return { ...game, currentShow: game.currentShow.filter((segment) => segment.id !== segmentId) };
}

export function toggleSegmentParticipant(game: GameState, segmentId: string, wrestlerId: string) {
  let changed = false;
  const currentShow = game.currentShow.map((segment) => {
    if (segment.id !== segmentId) {
      return segment;
    }

    const isSelected = segment.participantIds.includes(wrestlerId);
    const wrestler = game.wrestlers.find((talent) => talent.id === wrestlerId);

    if (!isSelected && (wrestler?.injuryStatus === "major" || isWrestlerProtectedRest(game, wrestlerId))) {
      return segment;
    }

    const participantLimit = getSegmentParticipantRange(segment).max;
    const participantIds = isSelected
      ? segment.participantIds.filter((id) => id !== wrestlerId)
      : segment.participantIds.length < participantLimit
        ? [...segment.participantIds, wrestlerId]
        : segment.participantIds;

    if (participantIds === segment.participantIds) {
      return segment;
    }

    const updatedSegment = sanitizeBookingSegment(game, { ...segment, participantIds });
    changed = updatedSegment !== segment;
    return updatedSegment;
  });

  return changed ? { ...game, currentShow } : game;
}
