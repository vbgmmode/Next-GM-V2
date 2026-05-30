import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "../game/seed";
import { isValidSegment } from "../game/scoring";
import { wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type { GameState, Rivalry, Segment, Wrestler } from "../game/types";
import { getSegmentDurationMinutes, getShowReadiness, maxBookingSegments } from "./bookingUtils";
import { buildSmartFillGaps, buildSmartRundown, buildSmartSingleSegment } from "./smartRundown";

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

function makePromoSegment(game: GameState, index = 0, wrestlerId = game.wrestlers[0].id): Segment {
  return {
    id: `existing-promo-${index + 1}`,
    type: "Promo",
    participantIds: [wrestlerId],
    segmentCatalogId: "P001",
    segmentDisplayName: "Standard Promo",
    durationMinutes: 5,
    participantMin: 1,
    participantMax: 3,
  };
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

  it("prioritizes an accepted title-shot promise in the generated rundown", () => {
    const game = makeGame();
    const title = game.championships.find((championship) => championship.eligibleMatchScope !== "tag_team" && championship.division !== "Tag Team");

    expect(title).toBeDefined();

    const champion = game.wrestlers.find((wrestler) => wrestlerFitsChampionshipDivision(wrestler, title!));
    const challenger = game.wrestlers.find((wrestler) => wrestler.id !== champion?.id && wrestlerFitsChampionshipDivision(wrestler, title!));

    expect(champion).toBeDefined();
    expect(challenger).toBeDefined();

    const result = buildSmartRundown({
      ...game,
      championships: game.championships.map((championship) =>
        championship.id === title!.id ? { ...championship, championIds: [champion!.id], contenderIds: [challenger!.id] } : championship,
      ),
      socialInbox: {
        requests: [
          {
            id: "accepted-title-shot",
            mailId: "mail-title-shot",
            wrestlerId: challenger!.id,
            wrestlerName: challenger!.name,
            actionType: "title_shot",
            askLabel: "Title Shot",
            createdSeasonNumber: game.seasonNumber,
            createdWeekNumber: game.currentWeek,
            deadlineSeasonNumber: game.seasonNumber,
            deadlineWeekNumber: game.currentWeek + 2,
            status: "accepted",
          },
        ],
      },
    });

    expect(result.error).toBeUndefined();
    expect(
      result.segments.some(
        (segment) =>
          segment.championshipId === title!.id &&
          segment.participantIds.includes(champion!.id) &&
          segment.participantIds.includes(challenger!.id),
      ),
    ).toBe(true);
  });

  it("does not book the same championship across multiple generated title matches", () => {
    const game = makeGame();
    const title = game.championships.find((championship) => championship.eligibleMatchScope !== "tag_team" && championship.division !== "Tag Team");

    expect(title).toBeDefined();

    const eligible = game.wrestlers.filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, title!));

    expect(eligible.length).toBeGreaterThanOrEqual(3);

    const [champion, firstChallenger, secondChallenger] = eligible;
    const result = buildSmartRundown({
      ...game,
      championships: game.championships.map((championship) =>
        championship.id === title!.id
          ? { ...championship, championIds: [champion.id], contenderIds: [firstChallenger.id, secondChallenger.id] }
          : championship,
      ),
      socialInbox: {
        requests: [firstChallenger, secondChallenger].map((wrestler, index) => ({
          id: `accepted-title-shot-${index + 1}`,
          mailId: `mail-title-shot-${index + 1}`,
          wrestlerId: wrestler.id,
          wrestlerName: wrestler.name,
          actionType: "title_shot",
          askLabel: "Title Shot",
          createdSeasonNumber: game.seasonNumber,
          createdWeekNumber: game.currentWeek + index,
          deadlineSeasonNumber: game.seasonNumber,
          deadlineWeekNumber: game.currentWeek + 2,
          status: "accepted",
        })),
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.segments.filter((segment) => segment.championshipId === title!.id)).toHaveLength(1);
  });

  it("fills gaps by returning appended segments without reordering existing card segments", () => {
    const game = makeGame();
    const existing = [makePromoSegment(game)];
    const result = buildSmartFillGaps(game, existing, 1);
    const combined = [...existing, ...result.segments];

    expect(result.segments.length).toBeGreaterThan(0);
    expect(combined[0]).toBe(existing[0]);
    expect(result.segments.some((segment) => segment.id === existing[0].id)).toBe(false);
  });

  it("attempts accepted inbox requests while filling gaps", () => {
    const game = makeGame();
    const requester = game.wrestlers[3];
    const result = buildSmartFillGaps(
      {
        ...game,
        socialInbox: {
          requests: [
            {
              id: "accepted-tv-time",
              mailId: "mail-tv-time",
              wrestlerId: requester.id,
              wrestlerName: requester.name,
              actionType: "tv_time",
              askLabel: "TV Time",
              createdSeasonNumber: game.seasonNumber,
              createdWeekNumber: game.currentWeek,
              deadlineSeasonNumber: game.seasonNumber,
              deadlineWeekNumber: game.currentWeek + 2,
              status: "accepted",
            },
          ],
        },
      },
      [makePromoSegment(game, 0, game.wrestlers[0].id)],
      2,
    );

    expect(result.segments.some((segment) => segment.participantIds.includes(requester.id))).toBe(true);
  });

  it("does not casually attach championships to generated filler matches", () => {
    const game = makeGame();
    const title = game.championships.find((championship) => championship.eligibleMatchScope !== "tag_team" && championship.division !== "Tag Team");

    expect(title).toBeDefined();

    const champion = game.wrestlers.find((wrestler) => wrestlerFitsChampionshipDivision(wrestler, title!));
    const contender = game.wrestlers.find((wrestler) => wrestler.id !== champion?.id && wrestlerFitsChampionshipDivision(wrestler, title!));

    expect(champion).toBeDefined();
    expect(contender).toBeDefined();

    const result = buildSmartSingleSegment(
      {
        ...game,
        championships: game.championships.map((championship) =>
          championship.id === title!.id ? { ...championship, championIds: [champion!.id], contenderIds: [contender!.id] } : championship,
        ),
      },
      [],
      3,
    );

    expect(result.error).toBeUndefined();
    expect(result.segments.some((segment) => segment.championshipId)).toBe(false);
  });

  it("does not assign winners or finishes to generated segments", () => {
    const game = makeGame();
    const fullCard = buildSmartRundown(game, 7);
    const filledCard = buildSmartFillGaps(game, [makePromoSegment(game)], 8);
    const generatedSegments = [...fullCard.segments, ...filledCard.segments];

    expect(generatedSegments.length).toBeGreaterThan(0);
    expect(generatedSegments.some((segment) => segment.winnerId)).toBe(false);
  });

  it("returns partial additions with a blocker when fill gaps cannot make the card runnable", () => {
    const game = makeGame();
    const lowRuntimeAlmostFullCard = Array.from({ length: maxBookingSegments - 1 }, (_, index) =>
      makePromoSegment(game, index, game.wrestlers[index % game.wrestlers.length].id),
    ).map((segment) => ({ ...segment, durationMinutes: 1 }));

    const result = buildSmartFillGaps(game, lowRuntimeAlmostFullCard, 9);

    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.error).toMatch(/card still is not ready|Production could not safely/);
  });

  it("refuses to add a single smart segment when the card is full", () => {
    const game = makeGame();
    const result = buildSmartSingleSegment(game, makeFullCard(game), 1);

    expect(result.error).toBe("The rundown is full. Remove a segment before autogenerating another.");
    expect(result.segments).toEqual([]);
  });

  it("refuses to fill gaps when the card is full", () => {
    const game = makeGame();
    const result = buildSmartFillGaps(game, makeFullCard(game), 1);

    expect(result.error).toBe("The rundown is full. Remove a segment before autogenerating another.");
    expect(result.segments).toEqual([]);
  });
});
