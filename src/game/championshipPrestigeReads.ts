import { canSegmentContestChampionship } from "../booking/bookingUtils";
import { getCurrentCalendarWeek } from "./scoring";
import { SEASON_WEEK_COUNT } from "./constants";
import type { Championship, GameState, Segment, SegmentResult } from "./types";

export type PrestigeMainEventAnchorStatus = "anchored" | "wrong_closer" | "anchor_missing" | "not_applicable";

export type PrestigeMainEventAnchorSnapshot = {
  isSeasonFinalePle: boolean;
  status: PrestigeMainEventAnchorStatus;
  headline: string;
  detail: string;
  anchorChampionship?: Championship;
  anchorSegment?: Segment;
  closingSegment?: Segment;
};

export function isSeasonFinalePleWeek(weekNumber: number, showType: string) {
  return weekNumber === SEASON_WEEK_COUNT && showType === "ple";
}

export function getChampionshipPrestigeRank(championship: Championship) {
  return typeof championship.prestige === "number" ? championship.prestige : 75;
}

function compareChampionshipPrestige(left: Championship, right: Championship) {
  const leftTop = left.titleLevel === "Top" ? 1 : 0;
  const rightTop = right.titleLevel === "Top" ? 1 : 0;

  return (
    getChampionshipPrestigeRank(right) - getChampionshipPrestigeRank(left) ||
    rightTop - leftTop ||
    left.name.localeCompare(right.name)
  );
}

export function getHighestPrestigeChampionship(championships: Championship[]) {
  return [...championships].sort(compareChampionshipPrestige)[0];
}

export function getTitleMatchSegmentsOnCard(segments: Segment[], game: GameState) {
  return segments.filter((segment) => {
    if (!segment.championshipId) {
      return false;
    }

    const championship = game.championships.find((title) => title.id === segment.championshipId);

    return Boolean(championship && canSegmentContestChampionship(segment, championship, game.wrestlers));
  });
}

export function getAnchorChampionshipForCard(game: GameState, validSegments: Segment[]) {
  const titleMatches = getTitleMatchSegmentsOnCard(validSegments, game);

  if (!titleMatches.length) {
    return undefined;
  }

  const ranked = titleMatches
    .map((segment) => ({
      segment,
      championship: game.championships.find((title) => title.id === segment.championshipId)!,
    }))
    .sort((left, right) => compareChampionshipPrestige(left.championship, right.championship));

  return ranked[0]?.championship;
}

export function getSegmentPrestigeWeight(segment: Segment, game: GameState) {
  if (!segment.championshipId) {
    return 0;
  }

  const championship = game.championships.find((title) => title.id === segment.championshipId);

  if (!championship || !canSegmentContestChampionship(segment, championship, game.wrestlers)) {
    return 0;
  }

  return getChampionshipPrestigeRank(championship) * 2;
}

function findAnchorTitleMatchSegment(expectedAnchor: Championship, validSegments: Segment[]) {
  return validSegments.find((segment) => segment.championshipId === expectedAnchor.id);
}

export function getPrestigeMainEventAnchorSnapshot(game: GameState, validSegments: Segment[]): PrestigeMainEventAnchorSnapshot {
  const calendarWeek = getCurrentCalendarWeek(game);
  const isSeasonFinalePle = isSeasonFinalePleWeek(calendarWeek.weekNumber, calendarWeek.showType);
  const closingSegment = validSegments[validSegments.length - 1];
  const expectedAnchor = getHighestPrestigeChampionship(game.championships);

  if (!isSeasonFinalePle) {
    return {
      isSeasonFinalePle: false,
      status: "not_applicable",
      headline: "Prestige anchor not required",
      detail: `The season-finale prestige anchor rule applies to Week ${SEASON_WEEK_COUNT} PLE only.`,
      closingSegment,
    };
  }

  if (!expectedAnchor) {
    return {
      isSeasonFinalePle: true,
      status: "anchor_missing",
      headline: "Top belt missing from finale card",
      detail: "No championship is available to anchor the season finale.",
      closingSegment,
    };
  }

  const anchorSegment = findAnchorTitleMatchSegment(expectedAnchor, validSegments);
  const anchorChampionship = anchorSegment ? expectedAnchor : getAnchorChampionshipForCard(game, validSegments);

  if (!anchorSegment) {
    const lowerTitle = anchorChampionship;

    return {
      isSeasonFinalePle: true,
      status: "anchor_missing",
      headline: "Top belt missing from finale card",
      detail: lowerTitle
        ? `${expectedAnchor.name} (Prestige ${getChampionshipPrestigeRank(expectedAnchor)}) is not booked, while ${lowerTitle.name} (Prestige ${getChampionshipPrestigeRank(lowerTitle)}) is the highest title match on the card.`
        : `${expectedAnchor.name} (Prestige ${getChampionshipPrestigeRank(expectedAnchor)}) needs a valid title match on the season finale card.`,
      anchorChampionship: expectedAnchor,
      closingSegment,
    };
  }

  if (closingSegment?.id !== anchorSegment.id) {
    const closingTitle = closingSegment?.championshipId
      ? game.championships.find((title) => title.id === closingSegment.championshipId)
      : undefined;

    return {
      isSeasonFinalePle: true,
      status: "wrong_closer",
      headline: "Season finale should close with the top belt",
      detail: closingTitle
        ? `${expectedAnchor.name} (Prestige ${getChampionshipPrestigeRank(expectedAnchor)}) is on the card, but ${closingTitle.name} (Prestige ${getChampionshipPrestigeRank(closingTitle)}) closes the rundown.`
        : `${expectedAnchor.name} (Prestige ${getChampionshipPrestigeRank(expectedAnchor)}) should close the season finale, but another segment is in the closing slot.`,
      anchorChampionship: expectedAnchor,
      anchorSegment,
      closingSegment,
    };
  }

  return {
    isSeasonFinalePle: true,
    status: "anchored",
    headline: "Top belt closes the season finale",
    detail: `${expectedAnchor.name} (Prestige ${getChampionshipPrestigeRank(expectedAnchor)}) is in the closing slot where the desk expects the main event.`,
    anchorChampionship: expectedAnchor,
    anchorSegment,
    closingSegment,
  };
}

export function getPrestigeMainEventAnchorSnapshotFromResult(game: GameState, segmentResults: SegmentResult[]): PrestigeMainEventAnchorSnapshot {
  const segments: Segment[] = segmentResults.map((result) => ({
    id: result.segmentId,
    type: result.type,
    participantIds: result.participantIds,
    championshipId: result.championshipId,
    rivalryId: result.rivalryId,
    segmentCatalogId: result.segmentCatalogId,
    segmentDisplayName: result.type,
    winnerId: result.winnerId,
  }));

  return getPrestigeMainEventAnchorSnapshot(game, segments);
}
