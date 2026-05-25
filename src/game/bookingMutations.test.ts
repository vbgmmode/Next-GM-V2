import { describe, expect, it } from "vitest";
import {
  addBookingSegment,
  removeBookingSegment,
  replaceCurrentShow,
  toggleSegmentParticipant,
  updateBookingSegment,
} from "./bookingMutations";
import { createNewGame } from "./seed";
import type { GameState, Segment, SocialInboxRequest } from "./types";

function segment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: "segment-1",
    type: "Match",
    participantIds: [],
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
    ...overrides,
  };
}

function withCurrentShow(game: GameState, segments: Segment[]) {
  return { ...game, currentShow: segments };
}

function restRequest(game: GameState, wrestlerId: string): SocialInboxRequest {
  const wrestler = game.wrestlers.find((talent) => talent.id === wrestlerId);

  return {
    id: `rest-${wrestlerId}`,
    mailId: `mail-${wrestlerId}`,
    wrestlerId,
    wrestlerName: wrestler?.name ?? wrestlerId,
    actionType: "rest",
    askLabel: "Rest",
    createdSeasonNumber: game.seasonNumber,
    createdWeekNumber: game.currentWeek,
    deadlineSeasonNumber: game.seasonNumber,
    deadlineWeekNumber: game.currentWeek,
    status: "accepted",
  };
}

describe("booking mutations", () => {
  it("adds a segment with a stable requested ID and catalog defaults", () => {
    const game = createNewGame();
    const updated = addBookingSegment(game, "Match", "manual-segment-id");

    expect(updated.currentShow).toHaveLength(1);
    expect(updated.currentShow[0]).toMatchObject({
      id: "manual-segment-id",
      type: "Match",
      participantIds: [],
      segmentCatalogId: "M001",
    });
  });

  it("updates a segment and trims invalid participants and winner", () => {
    const game = createNewGame();
    const wrestlerIds = game.wrestlers.slice(0, 3).map((wrestler) => wrestler.id);
    const current = withCurrentShow(game, [segment({ participantIds: wrestlerIds.slice(0, 2), winnerId: wrestlerIds[1] })]);
    const updated = updateBookingSegment(current, "segment-1", {
      type: "Promo",
      participantIds: wrestlerIds,
      participantMin: 1,
      participantMax: 1,
    });

    expect(updated.currentShow[0].participantIds).toEqual([wrestlerIds[0]]);
    expect(updated.currentShow[0].winnerId).toBeUndefined();
  });

  it("toggles participants while blocking major injuries and protected rest", () => {
    const game = createNewGame();
    const availableId = game.wrestlers[0].id;
    const injuredId = game.wrestlers[1].id;
    const restedId = game.wrestlers[2].id;
    const current = withCurrentShow(
      {
        ...game,
        wrestlers: game.wrestlers.map((wrestler) => (wrestler.id === injuredId ? { ...wrestler, injuryStatus: "major" } : wrestler)),
        socialInbox: { requests: [restRequest(game, restedId)] },
      },
      [segment()],
    );

    const withAvailable = toggleSegmentParticipant(current, "segment-1", availableId);
    const withInjuredBlocked = toggleSegmentParticipant(withAvailable, "segment-1", injuredId);
    const withRestBlocked = toggleSegmentParticipant(withInjuredBlocked, "segment-1", restedId);

    expect(withAvailable.currentShow[0].participantIds).toEqual([availableId]);
    expect(withInjuredBlocked).toBe(withAvailable);
    expect(withRestBlocked).toBe(withInjuredBlocked);
  });

  it("removes only the target segment", () => {
    const game = withCurrentShow(createNewGame(), [segment({ id: "segment-1" }), segment({ id: "segment-2" })]);
    const updated = removeBookingSegment(game, "segment-1");

    expect(updated.currentShow.map((item) => item.id)).toEqual(["segment-2"]);
  });

  it("replaces the current show while preserving passed ordering", () => {
    const game = withCurrentShow(createNewGame(), [segment({ id: "old" })]);
    const segments = [segment({ id: "second" }), segment({ id: "first" })];
    const updated = replaceCurrentShow(game, segments);

    expect(updated.currentShow.map((item) => item.id)).toEqual(["second", "first"]);
  });
});
