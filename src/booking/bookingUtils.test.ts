import { describe, expect, it } from "vitest";
import { createDefaultChampionships, createNewGame, draftPool } from "../game/seed";
import { runShow } from "../game/scoring";
import type { Championship, Segment, Wrestler } from "../game/types";
import { canSegmentAttachChampionship, getSinglesTitleContestParticipantCount, resolveSinglesTitleMatchCatalogOption } from "./bookingUtils";
import { getBuildableChampionships } from "./composerReads";

function sameDivisionWrestlers(division: "Mens" | "Womens", count = 3) {
  const wrestlers = draftPool.filter((wrestler) => wrestler.division === division).slice(0, count);
  expect(wrestlers).toHaveLength(count);
  return wrestlers;
}

function createSinglesTitle(division: "Mens" | "Womens", championId?: string): Championship {
  return {
    id: `${division.toLowerCase()}-title`,
    name: division === "Mens" ? "World Championship" : "Women's Championship",
    division,
    eligibleMatchScope: "singles",
    prestige: 90,
    championIds: championId ? [championId] : [],
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

function createTagTitle(championIds: string[] = []): Championship {
  return {
    id: "tag-title",
    name: "World Tag Team Championship",
    division: "Tag Team",
    eligibleMatchScope: "tag_team",
    prestige: 82,
    championIds,
    contenderIds: [],
    reignStartWeek: 1,
    defenses: 0,
  };
}

function createTagTitleSegment(wrestlers: Wrestler[], championshipId: string): Segment {
  return {
    id: "tag-title-match",
    type: "Match",
    participantIds: wrestlers.map((wrestler) => wrestler.id),
    championshipId,
    segmentCatalogId: "M020",
    segmentDisplayName: "Tag Team Match",
    durationMinutes: 12,
    participantMin: 4,
    participantMax: 4,
    winnerId: wrestlers[2].id,
  };
}

describe("booking title eligibility", () => {
  it.each(["Mens", "Womens"] as const)("allows %s singles titles on triple threat matches", (division) => {
    const wrestlers = sameDivisionWrestlers(division);
    const title = createSinglesTitle(division, wrestlers[0].id);
    const segment = createTripleThreatTitleSegment(wrestlers, title.id);

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);
  });

  it("allows women's united states championship on triple threat matches", () => {
    const wrestlers = sameDivisionWrestlers("Womens", 3);
    const usTitle = createDefaultChampionships(wrestlers, "SmackDown").find((championship) => championship.name === "Women's United States Championship");

    expect(usTitle).toBeDefined();

    const title = { ...usTitle!, championIds: [wrestlers[0].id] };
    const segment = createTripleThreatTitleSegment(wrestlers, title.id);

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);
  });

  it("allows attaching a defended singles title before the multi-way field is full", () => {
    const wrestlers = sameDivisionWrestlers("Womens", 3);
    const title = createSinglesTitle("Womens", wrestlers[0].id);
    const segment = {
      ...createTripleThreatTitleSegment(wrestlers, title.id),
      participantIds: wrestlers.slice(0, 2).map((wrestler) => wrestler.id),
      championshipId: undefined,
    };

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);
  });

  it("preserves triple threat format when building a singles title match", () => {
    const wrestlers = sameDivisionWrestlers("Womens", 3);
    const segment = {
      id: "triple-empty",
      type: "Match" as const,
      participantIds: [],
      segmentCatalogId: "M002",
      segmentDisplayName: "Triple Threat",
      durationMinutes: 13,
      participantMin: 3,
      participantMax: 3,
    };
    const title = createSinglesTitle("Womens", wrestlers[0].id);
    const option = resolveSinglesTitleMatchCatalogOption(segment, false);

    expect(option?.id).toBe("M002");
    expect(getSinglesTitleContestParticipantCount(segment)).toBe(3);
    expect(canSegmentAttachChampionship({ ...segment, participantIds: wrestlers.map((wrestler) => wrestler.id) }, title, wrestlers)).toBe(true);
  });

  it.each(["Mens", "Womens"] as const)("allows %s singles titles on fatal 4-way matches", (division) => {
    const wrestlers = sameDivisionWrestlers(division, 4);
    const title = createSinglesTitle(division, wrestlers[0].id);
    const segment = createFatal4WayTitleSegment(wrestlers, title.id);

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);
  });

  it("allows a visible vacant TBS title to attach to a women's match", () => {
    const wrestlers = sameDivisionWrestlers("Womens", 2);
    const tbsTitle = createDefaultChampionships(wrestlers, "AEW").find((championship) => championship.name === "TBS Championship");

    expect(tbsTitle).toBeDefined();

    const segment: Segment = {
      id: "tbs-title-match",
      type: "Match",
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      championshipId: tbsTitle!.id,
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
      winnerId: wrestlers[1].id,
    };

    expect(canSegmentAttachChampionship(segment, tbsTitle!, wrestlers)).toBe(true);
  });

  it("offers vacant titles in the build-title picker", () => {
    const wrestlers = sameDivisionWrestlers("Womens", 2);
    const tbsTitle = createDefaultChampionships(wrestlers, "AEW").find((championship) => championship.name === "TBS Championship");
    const segment: Segment = {
      id: "empty-match",
      type: "Match",
      participantIds: [],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
    };

    expect(tbsTitle).toBeDefined();
    expect(getBuildableChampionships(segment, [tbsTitle!])).toContain(tbsTitle);
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

  it.each([
    ["triple threat", "Mens", 3, createTripleThreatTitleSegment],
    ["fatal 4-way", "Womens", 4, createFatal4WayTitleSegment],
  ] as const)("resolves a vacant %s singles title match at show-run time", (_label, division, count, createSegment) => {
    const wrestlers = sameDivisionWrestlers(division, count);
    const title = createSinglesTitle(division);
    const segment = createSegment(wrestlers, title.id);
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [title],
      currentShow: [segment],
    };

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);

    const { game: resolvedGame, result } = runShow(game);

    expect(resolvedGame.championships[0].championIds).toEqual([wrestlers[1].id]);
    expect(result.titleHistoryEvents[0]).toMatchObject({
      championshipId: title.id,
      eventType: "title_change",
      championIds: [wrestlers[1].id],
      previousChampionIds: [],
    });
  });

  it("resolves a vacant TBS title match at show-run time", () => {
    const wrestlers = sameDivisionWrestlers("Womens", 2);
    const tbsTitle = createDefaultChampionships(wrestlers, "AEW").find((championship) => championship.name === "TBS Championship");

    expect(tbsTitle).toBeDefined();

    const segment: Segment = {
      id: "vacant-tbs-title-match",
      type: "Match",
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      championshipId: tbsTitle!.id,
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
      winnerId: wrestlers[1].id,
    };
    const game = {
      ...createNewGame({ brandName: "AEW", brandStyle: "AEW", draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [tbsTitle!],
      currentShow: [segment],
    };

    const { game: resolvedGame, result } = runShow(game);

    expect(resolvedGame.championships[0].championIds).toEqual([wrestlers[1].id]);
    expect(result.titleNotes[0]).toContain("TBS Championship");
    expect(result.titleHistoryEvents[0]).toMatchObject({
      championshipId: tbsTitle!.id,
      eventType: "title_change",
      championIds: [wrestlers[1].id],
      previousChampionIds: [],
    });
  });

  it("resolves a vacant tag title match at show-run time", () => {
    const wrestlers = sameDivisionWrestlers("Mens", 4);
    const title = createTagTitle();
    const segment = createTagTitleSegment(wrestlers, title.id);
    const game = {
      ...createNewGame({ draftedWrestlers: wrestlers }),
      wrestlers,
      championships: [title],
      currentShow: [segment],
    };

    expect(canSegmentAttachChampionship(segment, title, wrestlers)).toBe(true);

    const { game: resolvedGame, result } = runShow(game);

    expect(resolvedGame.championships[0].championIds).toEqual([wrestlers[2].id, wrestlers[3].id]);
    expect(result.titleHistoryEvents[0]).toMatchObject({
      championshipId: title.id,
      eventType: "title_change",
      championIds: [wrestlers[2].id, wrestlers[3].id],
      previousChampionIds: [],
    });
  });
});
