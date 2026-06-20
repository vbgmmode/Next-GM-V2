import { getRosterAffiliations } from "../game/affiliationCatalog";
import { getSegmentCatalogOption, getSegmentParticipantRange } from "../game/matchFormatCatalog";
import { getInjuryStatusLabel } from "../game/rosterContextReads";
import { isWrestlerProtectedRest } from "../game/socialInboxActions";
import type { Championship, GameState, Rivalry, Segment, Wrestler } from "../game/types";
import {
  canSegmentAttachChampionship,
  canSegmentAttachRivalry,
  getBookingWrestlerRiskReads,
  isVacantSinglesChampionship,
  wouldCreateIntergenderMatch,
} from "./bookingUtils";

export type StageLayoutKind = "vs-singles" | "vs-tag" | "lineup" | "open-challenge";

export type StageSlot = {
  index: number;
  wrestlerId?: string;
  locked?: boolean;
  lockLabel?: string;
  teamLabel?: string;
};

export type StageLayout = {
  kind: StageLayoutKind;
  slots: StageSlot[];
};

export function getStageLayout(segment: Segment): StageLayout {
  const range = getSegmentParticipantRange(segment);
  const participantIds = segment.participantIds;

  if (segment.type === "Open Challenge") {
    return {
      kind: "open-challenge",
      slots: [
        { index: 0, wrestlerId: participantIds[0] },
        { index: -1, locked: true, lockLabel: "???" },
      ],
    };
  }

  if (segment.type === "Match" && segment.segmentCatalogId === "M020") {
    return {
      kind: "vs-tag",
      slots: [
        { index: 0, wrestlerId: participantIds[0], teamLabel: "Team A" },
        { index: 1, wrestlerId: participantIds[1], teamLabel: "Team A" },
        { index: 2, wrestlerId: participantIds[2], teamLabel: "Team B" },
        { index: 3, wrestlerId: participantIds[3], teamLabel: "Team B" },
      ],
    };
  }

  if (segment.type === "Match" && range.min === 2 && range.max === 2) {
    return {
      kind: "vs-singles",
      slots: [
        { index: 0, wrestlerId: participantIds[0] },
        { index: 1, wrestlerId: participantIds[1] },
      ],
    };
  }

  const visibleCount = Math.max(range.min, Math.min(range.max, Math.max(participantIds.length + 1, range.min)));
  return {
    kind: "lineup",
    slots: Array.from({ length: visibleCount }, (_, index) => ({
      index,
      wrestlerId: participantIds[index],
    })),
  };
}

export function getActiveRivalryParticipantIds(rivalries: Rivalry[]) {
  return new Set(rivalries.flatMap((rivalry) => rivalry.participantIds));
}

export function getWrestlerActiveRivalry(wrestlerId: string, rivalries: Rivalry[]) {
  return rivalries.find((rivalry) => rivalry.participantIds.includes(wrestlerId));
}

export function getTalentPickerPressureLine(wrestler: Wrestler, bookedCount: number) {
  const reads = getBookingWrestlerRiskReads(wrestler, bookedCount);
  if (!reads.length) {
    return `Mom ${wrestler.momentum} · Fat ${wrestler.fatigue}`;
  }
  return reads.slice(0, 2).join(" · ");
}

export function getEstablishedTagPartnerIds(
  wrestlerId: string,
  wrestlers: Wrestler[],
  excludedIds: ReadonlySet<string> = new Set(),
) {
  const excluded = new Set(excludedIds);
  excluded.add(wrestlerId);

  return getRosterAffiliations(wrestlers)
    .filter((affiliation) => affiliation.kind === "tag_team" && affiliation.memberWrestlerIds.includes(wrestlerId))
    .flatMap((affiliation) => affiliation.memberWrestlerIds.filter((id) => !excluded.has(id)));
}

export function getTalentPickerTagPartnerHighlightIds(segment: Segment, slotIndex: number, wrestlers: Wrestler[]) {
  const excluded = new Set(segment.participantIds.filter((_, index) => index !== slotIndex && Boolean(segment.participantIds[index])));
  const highlights = new Set<string>();

  if (segment.segmentCatalogId === "M020") {
    const partnerAnchorBySlot = [0, 0, 2, 2];
    const anchorIndex = partnerAnchorBySlot[slotIndex];

    if (anchorIndex !== undefined) {
      const anchorId = segment.participantIds[anchorIndex];

      if (anchorId && anchorIndex !== slotIndex) {
        getEstablishedTagPartnerIds(anchorId, wrestlers, excluded).forEach((partnerId) => highlights.add(partnerId));
      }
    }

    if (highlights.size) {
      return highlights;
    }
  }

  segment.participantIds.forEach((participantId, index) => {
    if (!participantId || index === slotIndex) {
      return;
    }

    getEstablishedTagPartnerIds(participantId, wrestlers, excluded).forEach((partnerId) => highlights.add(partnerId));
  });

  return highlights;
}

export function getTalentPickerHints(
  segment: Segment,
  wrestler: Wrestler,
  game: GameState,
  bookedCount: number,
  tagPartnerHighlightIds: ReadonlySet<string> = new Set(),
) {
  const hints: string[] = [];
  const checked = segment.participantIds.includes(wrestler.id);
  const range = getSegmentParticipantRange(segment);

  if (tagPartnerHighlightIds.has(wrestler.id)) {
    hints.push("Tag partner");
  }

  if (wrestler.injuryStatus === "major") {
    hints.push("Major injury unavailable");
  }

  if (isWrestlerProtectedRest(game, wrestler.id)) {
    hints.push("Approved rest");
  }

  if (!checked && wouldCreateIntergenderMatch(segment, wrestler, game.wrestlers)) {
    hints.push("Division blocked");
  }

  if (!checked && segment.participantIds.length >= range.max) {
    hints.push("Slot full");
  }

  if (segment.championshipId) {
    const championship = game.championships.find((title) => title.id === segment.championshipId);
    if (championship && canSegmentAttachChampionship({ ...segment, participantIds: [...segment.participantIds, wrestler.id].filter((id, i, arr) => arr.indexOf(id) === i) }, championship, game.wrestlers)) {
      hints.push("Title eligible");
    }
  }

  const activeRivalry = getWrestlerActiveRivalry(wrestler.id, game.rivalries);

  if (activeRivalry) {
    hints.push(segment.rivalryId === activeRivalry.id ? "Rivalry cast" : "In feud");
  }

  if (bookedCount > 0 && !checked) {
    hints.push(`Booked ${bookedCount}x tonight`);
  }

  if (wrestler.injuryStatus === "minor") {
    hints.push(getInjuryStatusLabel(wrestler.injuryStatus));
  }

  return hints;
}

export function sortTalentPickerRows(
  wrestlers: Wrestler[],
  segment: Segment,
  game: GameState,
  bookedCounts: Record<string, number>,
  slotIndex?: number,
) {
  const tagPartnerIds = slotIndex === undefined ? new Set<string>() : getTalentPickerTagPartnerHighlightIds(segment, slotIndex, game.wrestlers);

  return [...wrestlers].sort((left, right) => {
    const leftBlocked = left.injuryStatus === "major" || wouldCreateIntergenderMatch(segment, left, game.wrestlers);
    const rightBlocked = right.injuryStatus === "major" || wouldCreateIntergenderMatch(segment, right, game.wrestlers);
    if (leftBlocked !== rightBlocked) {
      return leftBlocked ? 1 : -1;
    }

    const leftTagPartner = tagPartnerIds.has(left.id);
    const rightTagPartner = tagPartnerIds.has(right.id);
    if (leftTagPartner !== rightTagPartner) {
      return leftTagPartner ? -1 : 1;
    }

    return right.popularity - left.popularity || left.name.localeCompare(right.name);
  });
}

export function getSegmentBookedCounts(segments: Segment[]) {
  return segments.reduce<Record<string, number>>((counts, item) => {
    item.participantIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, {});
}

export function replaceParticipantAtIndex(segment: Segment, slotIndex: number, wrestlerId: string) {
  const next = [...segment.participantIds];
  const duplicateIndex = next.indexOf(wrestlerId);
  if (duplicateIndex >= 0) {
    next.splice(duplicateIndex, 1);
    if (duplicateIndex < slotIndex) {
      slotIndex -= 1;
    }
  }

  if (slotIndex >= next.length) {
    next.push(wrestlerId);
    return next;
  }

  next[slotIndex] = wrestlerId;
  return next;
}

export function removeParticipantAtIndex(segment: Segment, slotIndex: number) {
  if (slotIndex < 0) {
    return segment.participantIds;
  }
  return segment.participantIds.filter((_, index) => index !== slotIndex);
}

export function getEligibleRivalries(segment: Segment, rivalries: Rivalry[], wrestlers: Wrestler[]) {
  return rivalries.filter((rivalry) => canSegmentAttachRivalry(segment, rivalry, wrestlers));
}

export function getEligibleChampionships(segment: Segment, championships: Championship[], wrestlers: Wrestler[]) {
  return championships.filter((championship) => canSegmentAttachChampionship(segment, championship, wrestlers));
}

export function getBuildableChampionships(segment: Segment, championships: Championship[]) {
  if (segment.type !== "Match") {
    return [];
  }

  return championships.filter((championship) => {
    if (championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team") {
      return true;
    }

    return championship.championIds.length > 0 || isVacantSinglesChampionship(championship);
  });
}

export function getSelectedCatalogLabel(segment: Segment) {
  const option = getSegmentCatalogOption(segment);
  return segment.segmentDisplayName ?? option.label;
}
