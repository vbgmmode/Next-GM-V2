import { describe, expect, it } from "vitest";
import { createSegmentResult, normalizeSegmentForRead, normalizeSegmentResultForRead } from "./segmentModel";
import type { Segment, SegmentResult, Wrestler } from "./types";

const wrestlers: Wrestler[] = [
  {
    id: "w1",
    name: "Ace",
    division: "Mens",
    popularity: 80,
    ringSkill: 82,
    promoSkill: 70,
    momentum: 50,
    morale: 50,
    fatigue: 0,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
  },
  {
    id: "w2",
    name: "Blaze",
    division: "Mens",
    popularity: 75,
    ringSkill: 78,
    promoSkill: 72,
    momentum: 50,
    morale: 50,
    fatigue: 0,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
  },
];

describe("booking segment discriminated read model", () => {
  it("narrows match-only fields behind the match discriminant", () => {
    const segment: Segment = {
      id: "match-1",
      type: "Match",
      participantIds: ["w1", "w2"],
      winnerId: "w1",
      championshipId: "title-1",
      rivalryId: "rivalry-1",
      stipulationId: "steel_cage",
      segmentCatalogId: "M001",
    };

    const read = normalizeSegmentForRead(segment);

    expect(read.kind).toBe("match");
    if (read.kind !== "match") {
      throw new Error("Expected match segment");
    }
    expect(read.winnerId).toBe("w1");
    expect(read.stipulationId).toBe("steel_cage");
  });

  it("strips impossible legacy winner and stipulation fields from story segment reads", () => {
    const legacyPromo = {
      id: "promo-1",
      type: "Promo",
      participantIds: ["w1"],
      winnerId: "w1",
      stipulationId: "steel_cage",
      segmentCatalogId: "P001",
    } satisfies Segment;

    const read = normalizeSegmentForRead(legacyPromo);

    expect(read.kind).toBe("story");
    expect("winnerId" in read).toBe(false);
    expect("stipulationId" in read).toBe(false);
  });
});

describe("segment result discriminated read model", () => {
  it("preserves legacy open challenge reveal fields and exposes a typed reveal object", () => {
    const result: SegmentResult = {
      segmentId: "open-1",
      type: "Open Challenge",
      participantNames: ["Ace", "Mystery Opponent"],
      participantIds: ["w1", "w2"],
      score: 81,
      momentumChanges: {},
      fatigueChanges: {},
      segmentCatalogId: "O001",
      winnerId: "w1",
      resolvedOpponentId: "w2",
      resolvedOpponentName: "Mystery Opponent",
      isNoContest: false,
    };

    const read = normalizeSegmentResultForRead(result);

    expect(read.kind).toBe("openChallenge");
    if (read.kind !== "openChallenge") {
      throw new Error("Expected open challenge result");
    }
    expect(read.resolvedOpponent).toEqual({ id: "w2", name: "Mystery Opponent" });
    expect(read.resolvedOpponentName).toBe("Mystery Opponent");
  });

  it("creates match results through the discriminated factory without changing persisted fields", () => {
    const segment: Segment = {
      id: "match-1",
      type: "Match",
      participantIds: ["w1", "w2"],
      championshipId: "title-1",
      rivalryId: "rivalry-1",
      stipulationId: "tables",
      segmentCatalogId: "M001",
    };

    const result = createSegmentResult({
      sourceSegmentId: segment.id,
      segment,
      wrestlers,
      score: 77,
      plannedDurationMinutes: 12,
      actualDurationMinutes: 14,
      momentumChanges: { w1: 2, w2: 2 },
      fatigueChanges: { w1: 8, w2: 8 },
      winnerId: "w1",
      titleNote: "Ace retained the title.",
      rivalryNote: "The rivalry heated up.",
      recapNote: "Ace beat Blaze.",
    });

    expect(result).toMatchObject({
      kind: "match",
      segmentId: "match-1",
      type: "Match",
      participantNames: ["Ace", "Blaze"],
      participantIds: ["w1", "w2"],
      championshipId: "title-1",
      rivalryId: "rivalry-1",
      stipulationId: "tables",
      winnerId: "w1",
      durationVarianceMinutes: 2,
    });
  });
});
