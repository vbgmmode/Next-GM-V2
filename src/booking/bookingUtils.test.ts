import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "../game/seed";
import { runShow } from "../game/scoring";
import type { Championship, Segment, Wrestler } from "../game/types";
import { canSegmentAttachChampionship } from "./bookingUtils";

function sameDivisionWrestlers(division: "Mens" | "Womens", count = 3) {
  const wrestlers = draftPool.filter((wrestler) => wrestler.division === division).slice(0, count);
  expect(wrestlers).toHaveLength(count);
  return wrestlers;
}

function createSinglesTitle(division: "Mens" | "Womens", championId: string): Championship {
  return {
    id: `${division.toLowerCase()}-title`,
    name: division === "Mens" ? "World Championship" : "Women's Championship",
    division,
    eligibleMatchScope: "singles",
    prestige: 90,
    championIds: [championId],
    contenderIds: [],
    reignStartWeek: 1,
    defenses: 0,
  };
}

function createTripleThreatTitleSegment(wrestlers: Wrestler[], championshipId: string): Segment {
  return {
    id: "triple-title",
    type: "Match",
    participantIds: wrestlers.map((wrestler) => wrestler.id),
    championshipId,
    segmentCatalogId: "M002",
    segmentDisplayName: "Triple Threat",
    durationMinutes: 13,
    participantMin: 3,
    participantMax: 3,
    winnerId: wrestlers[1].id,
  };
}

function createFatal4WayTitleSegment(wrestlers: Wrestler[], championshipId: string): Segment {
  return {
    id: "fatal-4-way-title",
    type: "Match",
    participantIds: wrestlers.map((wrestler) => wrestler.id),
    championshipId,
    segmentCatalogId: "M003",
    segmentDisplayName: "Fatal 4-Way",
    durationMinutes: 14,
    participantMin: 4,
    participantMax: 4,
    winnerId: wrestlers[1].id,
  };
}

describe("booking title eligibility", () => {
  it.each(["Mens", "Womens"] as const)("allows %s singles titles on triple threat matches", (division) => {
    const wrestlers = sameDivisionWrestlers(division);
    const title = createSinglesTitle(division, wrestlers[0].id);
    const segment = createTripleThreatTitleSegment(wrestlers, title.id);

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);
  });

  it.each(["Mens", "Womens"] as const)("allows %s singles titles on fatal 4-way matches", (division) => {
    const wrestlers = sameDivisionWrestlers(division, 4);
    const title = createSinglesTitle(division, wrestlers[0].id);
    const segment = createFatal4WayTitleSegment(wrestlers, title.id);

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);
  });

  it("resolves a triple threat singles title change at show-run time", () => {
    const wrestlers = sameDivisionWrestlers("Mens");
    const title = createSinglesTitle("Mens", wrestlers[0].id);
    const segment = createTripleThreatTitleSegment(wrestlers, title.id);
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [title],
      currentShow: [segment],
    };

    const { game: resolvedGame, result } = runShow(game);

    expect(resolvedGame.championships[0].championIds).toEqual([wrestlers[1].id]);
    expect(result.titleNotes[0]).toContain("World Championship");
    expect(result.titleHistoryEvents[0]).toMatchObject({
      championshipId: title.id,
      eventType: "title_change",
      championIds: [wrestlers[1].id],
      previousChampionIds: [wrestlers[0].id],
    });
  });

  it("resolves a fatal 4-way singles title change at show-run time", () => {
    const wrestlers = sameDivisionWrestlers("Womens", 4);
    const title = createSinglesTitle("Womens", wrestlers[0].id);
    const segment = createFatal4WayTitleSegment(wrestlers, title.id);
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [title],
      currentShow: [segment],
    };

    const { game: resolvedGame, result } = runShow(game);

    expect(resolvedGame.championships[0].championIds).toEqual([wrestlers[1].id]);
    expect(result.titleNotes[0]).toContain("Women's Championship");
    expect(result.titleHistoryEvents[0]).toMatchObject({
      championshipId: title.id,
      eventType: "title_change",
      championIds: [wrestlers[1].id],
      previousChampionIds: [wrestlers[0].id],
    });
  });
});
