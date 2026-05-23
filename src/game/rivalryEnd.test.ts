import { describe, expect, it } from "vitest";
import { resolvePendingRivalryEndsOnAdvance, scheduleRivalryEndInGame, wasRivalryBookedOnWeek } from "./rivalryEnd";
import type { GameState, Rivalry } from "./types";

function rivalry(overrides: Partial<Rivalry> = {}): Rivalry {
  return {
    id: "rivalry-1",
    name: "Alpha vs Beta",
    participantIds: ["a", "b"],
    heat: 80,
    freshness: 70,
    weeksActive: 4,
    lastAdvancedWeek: 0,
    status: "rising",
    stakes: "personal",
    ...overrides,
  };
}

function baseGame(rivalries: Rivalry[]): GameState {
  return {
    brandName: "Raw",
    brandStyle: "red",
    currentWeek: 3,
    seasonNumber: 1,
    calendar: Array.from({ length: 12 }, (_, index) => ({
      weekNumber: index + 1,
      showName: `Week ${index + 1}`,
      showType: "tv" as const,
      completed: index < 2,
    })),
    wrestlers: [],
    rivalries,
    rivalryHistory: [],
    championships: [],
    currentShow: [],
    showHistory: [],
    financeReports: [],
    marketState: {
      transactions: [],
      playerContracts: [],
      officeMandate: {
        mandateStatus: "steady",
        mandateWeek: 1,
        trustScore: 50,
        reputationScore: 50,
        budgetPressureScore: 50,
      },
    },
    rivalBrands: [],
    injuryRecoveryNotes: [],
    socialPosts: [],
    seasonArchives: [],
    money: 100000,
    gmName: "GM",
    gmStyle: "balanced",
    difficulty: "normal",
    startingBudgetTier: "standard",
  } as unknown as GameState;
}

describe("rivalryEnd", () => {
  it("schedules a finale with reason instead of removing immediately", () => {
    const game = baseGame([rivalry()]);
    const updated = scheduleRivalryEndInGame(game, "rivalry-1", "Program ran its course");

    expect(updated.rivalries).toHaveLength(1);
    expect(updated.rivalries[0].pendingEndWeek).toBe(3);
    expect(updated.rivalries[0].pendingEndReason).toBe("Program ran its course");
    expect(updated.rivalryHistory?.some((event) => event.eventType === "end_scheduled")).toBe(true);
  });

  it("removes a booked finale feud when the week advances", () => {
    const game = baseGame([
      rivalry({
        pendingEndWeek: 3,
        pendingEndReason: "Story paid off on TV",
        lastAdvancedWeek: 3,
      }),
    ]);

    const resolved = resolvePendingRivalryEndsOnAdvance(game);

    expect(resolved.rivalries).toHaveLength(0);
    expect(resolved.historyEvents.some((event) => event.eventType === "ended")).toBe(true);
  });

  it("cancels an unbooked finale feud when the week advances", () => {
    const game = baseGame([
      rivalry({
        pendingEndWeek: 3,
        pendingEndReason: "Creative direction shift",
        lastAdvancedWeek: 1,
      }),
    ]);

    const resolved = resolvePendingRivalryEndsOnAdvance(game);

    expect(resolved.rivalries).toHaveLength(1);
    expect(resolved.rivalries[0].pendingEndWeek).toBeUndefined();
    expect(resolved.historyEvents.some((event) => event.eventType === "end_cancelled")).toBe(true);
  });

  it("detects a booked feud from current card", () => {
    const game = {
      ...baseGame([rivalry()]),
      currentShow: [{ id: "seg-1", type: "Match", participantIds: ["a", "b"], rivalryId: "rivalry-1" }],
    } as GameState;

    expect(wasRivalryBookedOnWeek(game, "rivalry-1", 3)).toBe(true);
  });
});
