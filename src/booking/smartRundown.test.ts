import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "../game/seed";
import { isValidSegment } from "../game/scoring";
import type { GameState, Rivalry, Segment, Wrestler } from "../game/types";
import { getSegmentDurationMinutes, getShowReadiness, maxBookingSegments } from "./bookingUtils";
import { buildSmartRundown, buildSmartSingleSegment } from "./smartRundown";

function makeGame(wrestlers: Wrestler[] = draftPool.slice(0, 12)) {
  return createNewGame({
    brandName: "Raw",
    brandStyle: "Raw",
    gmName: "Test GM",
    draftedWrestlers: wrestlers,
  });
}

function normalizeSegments(segments: Segment[]) {
  return segments.map(({ id: _id, ...segment }) => segment);
}

function getSameDivisionWrestlers(count: number) {
  const mens = draftPool.filter((wrestler) => wrestler.division === "Mens");
  const womens = draftPool.filter((wrestler) => wrestler.division === "Womens");
  const source = mens.length >= count ? mens : womens;

  expect(source.length).toBeGreaterThanOrEqual(count);
  return source.slice(0, count);
}

function makeFullCard(game: GameState): Segment[] {
  const [first, second] = game.wrestlers;

  return Array.from({ length: maxBookingSegments }, (_, index) => ({
    id: `existing-${index + 1}`,
    type: "Match",
    participantIds: [first.id, second.id],
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
  }));
}

describe("smartRundown", () => {
  it("returns an error when a full rundown has too few available wrestlers", () => {
    const game = makeGame(draftPool.slice(0, 3));

    const result = buildSmartRundown(game);

    expect(result.error).toBe("Production needs at least 4 available wrestlers to draft a varied TV card.");
    expect(result.segments).toEqual([]);
  });

  it("generates only valid segments for a full rundown", () => {
    const game = makeGame();

    const result = buildSmartRundown(game, 1);

    expect(result.error).toBeUndefined();
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    expect(result.segments.every((segment) => isValidSegment(segment, game.wrestlers))).toBe(true);
  });

  it("generates a runnable full rundown when the roster is sufficient", () => {
    const game = makeGame();
    const result = buildSmartRundown(game, 2);
    const runtime = result.segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
    const invalidSegments = result.segments.filter((segment) => !isValidSegment(segment, game.wrestlers)).length;
    const readiness = getShowReadiness(result.segments.length, invalidSegments, runtime);

    expect(result.error).toBeUndefined();
    expect(readiness.canRun).toBe(true);
  });

  it("excludes major-injured wrestlers from generated segments", () => {
    const game = makeGame();
    const injuredIds = new Set(game.wrestlers.slice(0, 2).map((wrestler) => wrestler.id));
    const injuredGame: GameState = {
      ...game,
      wrestlers: game.wrestlers.map((wrestler) =>
        injuredIds.has(wrestler.id)
          ? {
              ...wrestler,
              injuryStatus: "major",
              injuryWeeksRemaining: 4,
              injuryDescription: "Test injury",
              injuryOccurredWeek: game.currentWeek,
            }
          : wrestler,
      ),
    };

    const result = buildSmartRundown(injuredGame, 3);

    expect(result.error).toBeUndefined();
    expect(result.segments.flatMap((segment) => segment.participantIds).some((id) => injuredIds.has(id))).toBe(false);
  });

  it("is deterministic for the same variant seed apart from generated segment ids", () => {
    const game = makeGame();

    const first = buildSmartRundown(game, 4);
    const second = buildSmartRundown(game, 4);

    expect(first.error).toBeUndefined();
    expect(normalizeSegments(first.segments)).toEqual(normalizeSegments(second.segments));
  });

  it("does not repeat the same wrestler pairing across segments in a full smart rundown", () => {
    const game = makeGame();
    const result = buildSmartRundown(game, 6);

    expect(result.error).toBeUndefined();

    const pairKeys = result.segments
      .filter((segment) => segment.participantIds.length === 2)
      .map((segment) => [...segment.participantIds].sort().join("|"));

    expect(new Set(pairKeys).size).toBe(pairKeys.length);
  });

  it("uses the tag match format for tag-team rivalries when participants fit", () => {
    const tagWrestlers = getSameDivisionWrestlers(12);
    const game = makeGame(tagWrestlers);
    const rivalry: Rivalry = {
      id: "test-tag-rivalry",
      name: "Test Tag Rivalry",
      participantIds: tagWrestlers.slice(0, 4).map((wrestler) => wrestler.id),
      heat: 90,
      freshness: 80,
      weeksActive: 2,
      lastAdvancedWeek: 0,
      status: "rising",
      stakes: "respect",
      structure: "tag_team",
    };

    const result = buildSmartRundown({ ...game, rivalries: [rivalry] }, 5);

    expect(result.error).toBeUndefined();
    expect(result.segments.some((segment) => segment.rivalryId === rivalry.id && segment.segmentCatalogId === "M020")).toBe(true);
  });

  it("refuses to add a single smart segment when the card is full", () => {
    const game = makeGame();
    const result = buildSmartSingleSegment(game, makeFullCard(game), 1);

    expect(result.error).toBe("The rundown is full. Remove a segment before autogenerating another.");
    expect(result.segments).toEqual([]);
  });
});
