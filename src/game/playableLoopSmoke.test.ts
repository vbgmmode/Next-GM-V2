import { describe, expect, it } from "vitest";
import { advanceGameWeek } from "./advanceWeek";
import { PLE_COUNT, SEASON_WEEK_COUNT } from "./constants";
import { isValidSegment, runShow } from "./scoring";
import { createNewGame, draftPool } from "./seed";
import type { Segment, Wrestler } from "./types";

function draftableRoster() {
  const mens = draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, 3);
  const womens = draftPool.filter((wrestler) => wrestler.division === "Womens").slice(0, 3);
  const rest = draftPool
    .filter((wrestler) => !mens.some((member) => member.id === wrestler.id) && !womens.some((member) => member.id === wrestler.id))
    .slice(0, 6);

  return [...mens, ...womens, ...rest];
}

function requireWrestler(roster: Wrestler[], index: number) {
  const wrestler = roster[index];
  expect(wrestler).toBeDefined();
  return wrestler;
}

describe("playable loop smoke", () => {
  it("runs a new career through booking, results, and advance week with durable core state", () => {
    const roster = draftableRoster();
    const opener = requireWrestler(roster, 0);
    const opponent = requireWrestler(roster, 1);
    const promoFocus = requireWrestler(roster, 2);
    const currentShow: Segment[] = [
      {
        id: "smoke-match",
        type: "Match",
        participantIds: [opener.id, opponent.id],
        segmentCatalogId: "M001",
        segmentDisplayName: "Singles Match",
        durationMinutes: 30,
        participantMin: 2,
        participantMax: 2,
        winnerId: opener.id,
      },
      {
        id: "smoke-promo",
        type: "Promo",
        participantIds: [promoFocus.id],
        segmentCatalogId: "P001",
        segmentDisplayName: "In-Ring Promo",
        durationMinutes: 20,
        participantMin: 1,
        participantMax: 1,
      },
    ];
    const game = {
      ...createNewGame({ draftedWrestlers: roster }),
      currentShow,
    };

    expect(game.calendar).toHaveLength(SEASON_WEEK_COUNT);
    expect(game.calendar.filter((week) => week.showType === "ple")).toHaveLength(PLE_COUNT);
    expect(currentShow.every((segment) => isValidSegment(segment, game.wrestlers))).toBe(true);

    const resolved = runShow(game);

    expect(resolved.result.segmentResults).toHaveLength(2);
    expect(resolved.game.showHistory.at(-1)?.id).toBe(resolved.result.id);
    expect(resolved.game.financeReports.length).toBeGreaterThan(0);
    expect(resolved.game.socialPosts.length).toBeGreaterThan(0);
    expect(resolved.game.marketState.playerContracts.length).toBeGreaterThan(0);

    const advanced = advanceGameWeek(resolved.game);

    expect(advanced.currentWeek).toBe(2);
    expect(advanced.currentShow).toHaveLength(0);
    expect(advanced.calendar.find((week) => week.weekNumber === 1)?.completed).toBe(true);
    expect(advanced.wrestlers.find((wrestler) => wrestler.id === opener.id)?.lastBookedWeek).toBe(1);
    expect(advanced.marketState.weeklyBoard?.entries.length ?? 0).toBeLessThanOrEqual(6);
  });
});
