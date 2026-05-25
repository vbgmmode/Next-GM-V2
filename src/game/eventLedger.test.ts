import { describe, expect, it } from "vitest";
import { getResolvedShowEvents } from "./eventLedger";
import { migrateSavedGameState } from "./migration";
import { runShow } from "./scoring";
import { createNewGame, draftPool } from "./seed";
import type { Segment, Wrestler } from "./types";

function ledgerRoster(): Wrestler[] {
  const mens = draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, 3);
  const womens = draftPool.filter((wrestler) => wrestler.division === "Womens").slice(0, 3);

  return [...mens, ...womens];
}

function bookedShow(roster: Wrestler[]): Segment[] {
  const [first, second, promo] = roster;

  return [
    {
      id: "ledger-match",
      type: "Match",
      participantIds: [first.id, second.id],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 14,
      participantMin: 2,
      participantMax: 2,
      winnerId: first.id,
    },
    {
      id: "ledger-promo",
      type: "Promo",
      participantIds: [promo.id],
      segmentCatalogId: "P001",
      segmentDisplayName: "In-Ring Promo",
      durationMinutes: 8,
      participantMin: 1,
      participantMax: 1,
    },
  ];
}

describe("durable event ledger", () => {
  it("records resolved shows as persisted durable events", () => {
    const roster = ledgerRoster();
    const game = {
      ...createNewGame({ draftedWrestlers: roster }),
      currentShow: bookedShow(roster),
    };

    const resolved = runShow(game);
    const events = getResolvedShowEvents(resolved.game);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "show_resolved",
      seasonNumber: resolved.result.seasonNumber,
      weekNumber: resolved.result.week,
      source: "run_show",
      relatedIds: {
        showResultId: resolved.result.id,
        segmentIds: ["ledger-match", "ledger-promo"],
      },
      payload: {
        showName: resolved.result.showName,
        totalScore: resolved.result.totalScore,
        segmentCount: 2,
      },
    });
  });

  it("keeps ledger events durable through save migration and defaults legacy saves", () => {
    const roster = ledgerRoster();
    const game = {
      ...createNewGame({ draftedWrestlers: roster }),
      currentShow: bookedShow(roster),
    };
    const resolved = runShow(game);
    const migrated = migrateSavedGameState({ game: resolved.game, screen: "weekReview" });

    expect(getResolvedShowEvents(migrated!.game)[0]?.relatedIds.showResultId).toBe(resolved.result.id);

    const { eventLedger, ...legacyGame } = createNewGame();
    const legacyMigrated = migrateSavedGameState({ game: legacyGame, screen: "dashboard" });

    expect(legacyMigrated?.game.eventLedger).toEqual([]);
  });

  it("links generated social posts to the durable show result and event through migration", () => {
    const roster = ledgerRoster();
    const game = {
      ...createNewGame({ draftedWrestlers: roster }),
      currentShow: bookedShow(roster),
    };
    const resolved = runShow(game);
    const event = getResolvedShowEvents(resolved.game)[0];
    const migrated = migrateSavedGameState({ game: resolved.game, screen: "weekReview" });
    const linkedPosts = migrated!.game.socialPosts.filter((post) => post.resultId === resolved.result.id);

    expect(event).toBeDefined();
    expect(linkedPosts.length).toBeGreaterThan(0);
    expect(linkedPosts.every((post) => post.eventId === event.id)).toBe(true);
    expect(linkedPosts.some((post) => event.relatedIds.segmentIds.includes(post.segmentId ?? ""))).toBe(true);
  });
});
