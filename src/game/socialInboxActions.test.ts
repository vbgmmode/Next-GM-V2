import { describe, expect, it } from "vitest";
import { advanceGameWeek } from "./advanceWeek";
import { migrateSavedGameState } from "./migration";
import { isValidSegment, runShow } from "./scoring";
import { createNewGame } from "./seed";
import {
  acceptSocialInboxPromise,
  acceptSocialInboxRest,
  getProtectedRestWrestlerIds,
  isWrestlerProtectedRest,
} from "./socialInboxActions";
import type { Segment } from "./types";

function mailItem(game = createNewGame(), askLabel = "Rest") {
  const wrestler = game.wrestlers[0];

  return {
    id: `mail-${wrestler.id}-${askLabel.toLowerCase().replace(/\s+/g, "-")}`,
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    askLabel,
  };
}

describe("social inbox actions", () => {
  it("migrates legacy saves with empty social inbox state", () => {
    const game = createNewGame();
    const { socialInbox: _socialInbox, ...legacyGame } = game;

    const migrated = migrateSavedGameState({ game: legacyGame, screen: "social" });

    expect(migrated?.game.socialInbox).toEqual({ requests: [] });
  });

  it("grants protected rest by removing the wrestler and blocking this week", () => {
    const game = createNewGame();
    const wrestler = game.wrestlers[0];
    const currentShow: Segment[] = [
      { id: "rest-target", type: "Promo", participantIds: [wrestler.id] },
      { id: "support", type: "Promo", participantIds: [game.wrestlers[1].id] },
    ];

    const rested = acceptSocialInboxRest({ ...game, currentShow }, mailItem(game, "Rest"));
    const protectedRestIds = getProtectedRestWrestlerIds(rested);

    expect(rested.currentShow.every((segment) => !segment.participantIds.includes(wrestler.id))).toBe(true);
    expect(isWrestlerProtectedRest(rested, wrestler.id)).toBe(true);
    expect(isValidSegment({ id: "manual", type: "Promo", participantIds: [wrestler.id] }, rested.wrestlers, protectedRestIds)).toBe(false);
  });

  it("ignores protected-rest talent at show-run time and clears the block next week", () => {
    const game = createNewGame();
    const wrestler = game.wrestlers[0];
    const currentShow: Segment[] = [
      { id: "blocked", type: "Promo", participantIds: [wrestler.id] },
      { id: "valid-one", type: "Promo", participantIds: [game.wrestlers[1].id] },
      { id: "valid-two", type: "Promo", participantIds: [game.wrestlers[2].id] },
    ];
    const rested = acceptSocialInboxRest({ ...game, currentShow }, mailItem(game, "Rest"));
    const blockedSegment: Segment = { id: "blocked", type: "Promo", participantIds: [wrestler.id] };
    const manuallyReadded = {
      ...rested,
      currentShow: [blockedSegment, ...rested.currentShow],
    };

    const resolved = runShow(manuallyReadded);
    const advanced = advanceGameWeek(resolved.game);

    expect(resolved.result.segmentResults.some((segment) => segment.participantIds.includes(wrestler.id))).toBe(false);
    expect(isWrestlerProtectedRest(advanced, wrestler.id)).toBe(false);
  });

  it("tracks TV time requests as promises without auto-booking", () => {
    const game = createNewGame();
    const item = mailItem(game, "TV Time");
    const result = acceptSocialInboxPromise(game, item, "tv_time");

    expect(result.currentShow).toHaveLength(game.currentShow.length);
    expect(result.socialInbox.requests.at(-1)).toMatchObject({
      actionType: "tv_time",
      status: "accepted",
      segmentId: undefined,
    });
  });
});
