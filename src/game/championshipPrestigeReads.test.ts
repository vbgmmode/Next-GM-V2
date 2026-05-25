import { describe, expect, it } from "vitest";
import {
  getAnchorChampionshipForCard,
  getPrestigeMainEventAnchorSnapshot,
  getPrestigeMainEventAnchorSnapshotFromResult,
  getSegmentPrestigeWeight,
  isSeasonFinalePleWeek,
} from "./championshipPrestigeReads";
import { SEASON_WEEK_COUNT } from "./constants";
import { createNewGame, draftPool } from "./seed";
import type { Championship, GameState, Segment, SegmentResult, Wrestler } from "./types";

function sameDivisionWrestlers(division: "Mens" | "Womens", count = 4) {
  return draftPool.filter((wrestler) => wrestler.division === division).slice(0, count);
}

function createSinglesTitle(id: string, name: string, prestige: number, championId: string, titleLevel: "Top" | "Middle" = "Top"): Championship {
  return {
    id,
    name,
    division: "Mens",
    eligibleMatchScope: "singles",
    titleLevel,
    prestigeTier: titleLevel === "Top" ? "World/Main Event" : "Secondary/Midcard",
    prestige,
    championIds: [championId],
    reignStartWeek: 1,
    defenses: 0,
  };
}

function createTitleMatch(
  id: string,
  wrestlers: Wrestler[],
  championshipId: string,
  winnerId: string,
  participantIds = [wrestlers[0].id, wrestlers[1].id],
): Segment {
  return {
    id,
    type: "Match",
    participantIds,
    championshipId,
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
    winnerId,
  };
}

function createFinaleGame(segments: Segment[], week = SEASON_WEEK_COUNT): GameState {
  const wrestlers = sameDivisionWrestlers("Mens", 4);
  const worldTitle = createSinglesTitle("world-title", "World Heavyweight Championship", 96, wrestlers[0].id, "Top");
  const midcardTitle = createSinglesTitle("ic-title", "Intercontinental Championship", 78, wrestlers[2].id, "Middle");

  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    currentWeek: week,
    wrestlers,
    championships: [worldTitle, midcardTitle],
    currentShow: segments,
    calendar: [
      { weekNumber: SEASON_WEEK_COUNT - 1, showName: "Las Vegas Go-Home", showType: "tv", isGoHome: true, completed: true },
      { weekNumber: SEASON_WEEK_COUNT, showName: "Las Vegas", showType: "ple", isGoHome: false, completed: false },
    ],
  };
}

describe("championshipPrestigeReads", () => {
  it("detects season finale PLE week only on the configured final week", () => {
    expect(isSeasonFinalePleWeek(SEASON_WEEK_COUNT, "ple")).toBe(true);
    expect(isSeasonFinalePleWeek(8, "ple")).toBe(false);
    expect(isSeasonFinalePleWeek(SEASON_WEEK_COUNT, "tv")).toBe(false);
  });

  it("marks the world title as anchored when it closes the season finale", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const segments = [
      createTitleMatch("midcard-match", wrestlers, "ic-title", wrestlers[3].id, [wrestlers[2].id, wrestlers[3].id]),
      createTitleMatch("world-match", wrestlers, "world-title", wrestlers[1].id),
    ];
    const snapshot = getPrestigeMainEventAnchorSnapshot(createFinaleGame(segments), segments);

    expect(snapshot.status).toBe("anchored");
    expect(snapshot.anchorChampionship?.id).toBe("world-title");
  });

  it("flags wrong closer when a lower-prestige title closes the season finale", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const segments = [
      createTitleMatch("world-match", wrestlers, "world-title", wrestlers[1].id),
      createTitleMatch("midcard-match", wrestlers, "ic-title", wrestlers[3].id, [wrestlers[2].id, wrestlers[3].id]),
    ];
    const snapshot = getPrestigeMainEventAnchorSnapshot(createFinaleGame(segments), segments);

    expect(snapshot.status).toBe("wrong_closer");
    expect(snapshot.detail).toContain("World Heavyweight Championship");
    expect(snapshot.detail).toContain("Intercontinental Championship");
  });

  it("flags anchor missing when the top belt is not booked on the season finale", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const segments = [createTitleMatch("midcard-match", wrestlers, "ic-title", wrestlers[3].id, [wrestlers[2].id, wrestlers[3].id])];
    const snapshot = getPrestigeMainEventAnchorSnapshot(createFinaleGame(segments), segments);

    expect(snapshot.status).toBe("anchor_missing");
    expect(snapshot.detail).toContain("World Heavyweight Championship");
  });

  it("does not apply prestige anchor rules on non-finale PLE weeks", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const segments = [createTitleMatch("midcard-match", wrestlers, "ic-title", wrestlers[3].id, [wrestlers[2].id, wrestlers[3].id])];
    const game = createFinaleGame(segments, 8);
    game.calendar = [{ weekNumber: 8, showName: "Philadelphia", showType: "ple", isGoHome: false, completed: false }];

    expect(getPrestigeMainEventAnchorSnapshot(game, segments).status).toBe("not_applicable");
  });

  it("weights sanctioned title matches by prestige", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const game = createFinaleGame([]);
    const worldSegment = createTitleMatch("world-match", wrestlers, "world-title", wrestlers[1].id);
    const midcardSegment = createTitleMatch("midcard-match", wrestlers, "ic-title", wrestlers[3].id, [wrestlers[2].id, wrestlers[3].id]);

    expect(getSegmentPrestigeWeight(worldSegment, game)).toBe(192);
    expect(getSegmentPrestigeWeight(midcardSegment, game)).toBe(156);
    expect(getSegmentPrestigeWeight({ ...worldSegment, championshipId: undefined }, game)).toBe(0);
  });

  it("picks the highest-prestige title match on the card as anchor championship", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const segments = [
      createTitleMatch("midcard-match", wrestlers, "ic-title", wrestlers[3].id, [wrestlers[2].id, wrestlers[3].id]),
      createTitleMatch("world-match", wrestlers, "world-title", wrestlers[1].id),
    ];
    const anchor = getAnchorChampionshipForCard(createFinaleGame(segments), segments);

    expect(anchor?.id).toBe("world-title");
  });

  it("reads resolved season-finale results in card order", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const game = createFinaleGame([]);
    const segmentResults: SegmentResult[] = [
      {
        segmentId: "world-match",
        type: "Match",
        participantNames: [wrestlers[0].name, wrestlers[1].name],
        participantIds: [wrestlers[0].id, wrestlers[1].id],
        score: 88,
        momentumChanges: {},
        fatigueChanges: {},
        championshipId: "world-title",
        winnerId: wrestlers[1].id,
      },
      {
        segmentId: "midcard-match",
        type: "Match",
        participantNames: [wrestlers[2].name, wrestlers[3].name],
        participantIds: [wrestlers[2].id, wrestlers[3].id],
        score: 82,
        momentumChanges: {},
        fatigueChanges: {},
        championshipId: "ic-title",
        winnerId: wrestlers[3].id,
      },
    ];

    expect(getPrestigeMainEventAnchorSnapshotFromResult(game, segmentResults).status).toBe("wrong_closer");
  });

  it("prefers top-level titles when prestige is tied", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const tiedTop = createSinglesTitle("world-a", "World A", 96, wrestlers[0].id, "Top");
    const tiedMiddle = createSinglesTitle("world-b", "World B", 96, wrestlers[2].id, "Middle");
    const game: GameState = {
      ...createFinaleGame([]),
      championships: [tiedMiddle, tiedTop],
    };

    expect(getAnchorChampionshipForCard(game, [
      createTitleMatch("a", wrestlers, tiedTop.id, wrestlers[1].id),
      createTitleMatch("b", wrestlers, tiedMiddle.id, wrestlers[3].id, [wrestlers[2].id, wrestlers[3].id]),
    ])?.id).toBe("world-a");
  });

  it("gives world title segments enough prestige weight to beat a hot rivalry on the season finale", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 8);
    const game = createFinaleGame([]);
    const worldSegment = createTitleMatch("world-match", wrestlers, "world-title", wrestlers[1].id);
    const rivalrySegment: Segment = {
      id: "rivalry-match",
      type: "Match",
      participantIds: [wrestlers[5].id, wrestlers[6].id],
      rivalryId: "rivalry-1",
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 14,
      participantMin: 2,
      participantMax: 2,
      winnerId: wrestlers[5].id,
    };
    const hotWrestlers = wrestlers.map((wrestler, index) =>
      index === 5 || index === 6 ? { ...wrestler, popularity: 95, momentum: 95 } : wrestler,
    );
    const scoreSegment = (segment: Segment) =>
      segment.participantIds.reduce((sum, id) => {
        const wrestler = hotWrestlers.find((talent) => talent.id === id);
        return sum + (wrestler ? wrestler.popularity + wrestler.momentum - wrestler.fatigue * 0.2 : 0);
      }, 0) +
      (segment.rivalryId ? 40 : 0) +
      (segment.type === "Match" ? 20 : 0) +
      getSegmentPrestigeWeight(segment, { ...game, wrestlers: hotWrestlers });

    expect(scoreSegment(worldSegment)).toBeGreaterThan(scoreSegment(rivalrySegment));
  });
});
