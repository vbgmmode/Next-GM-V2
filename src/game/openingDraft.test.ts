import { describe, expect, it } from "vitest";
import { createNewGame, createRivalBrandUniverse, createRivalGMAssignments, draftPool } from "./seed";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { getOpeningDraftRoundOrder, simulateOpeningDraft } from "./openingDraft";
import type { DraftMode } from "./types";

const rivalBrands = createRivalBrandUniverse(createRivalGMAssignments("Raw"));
const draftSeed = "Raw-Test GM";

function getState(playerPickCount: number, mode: DraftMode = "snake") {
  return simulateOpeningDraft({
    draftMode: mode,
    draftSeed,
    draftPool,
    playerBrandName: "Raw",
    rivalBrands,
    playerDraftedWrestlers: draftPool.slice(0, playerPickCount),
  });
}

describe("openingDraft", () => {
  it("puts the player on the first Season 1 clock", () => {
    const state = getState(0);

    expect(state.currentPick?.chair.kind).toBe("player");
    expect(state.currentPick?.overallPick).toBe(1);
    expect(state.upcomingPicks[0]?.chair.brandName).toBe("Raw");
  });

  it("reverses every other round for snake drafts", () => {
    const chairs = getState(0).chairs;
    const firstRound = getOpeningDraftRoundOrder("snake", chairs, 0, draftSeed).map((chair) => chair.id);
    const secondRound = getOpeningDraftRoundOrder("snake", chairs, 1, draftSeed).map((chair) => chair.id);

    expect(firstRound[0]).toBe("player");
    expect(secondRound).toEqual([...firstRound].reverse());
  });

  it("keeps the same order every round for linear drafts", () => {
    const chairs = getState(0, "linear").chairs;
    const firstRound = getOpeningDraftRoundOrder("linear", chairs, 0, draftSeed).map((chair) => chair.id);
    const secondRound = getOpeningDraftRoundOrder("linear", chairs, 1, draftSeed).map((chair) => chair.id);

    expect(firstRound[0]).toBe("player");
    expect(secondRound).toEqual(firstRound);
  });

  it("uses deterministic fresh round orders for randomized drafts", () => {
    const chairs = getState(0, "random").chairs;
    const firstRun = getOpeningDraftRoundOrder("random", chairs, 1, draftSeed).map((chair) => chair.id);
    const secondRun = getOpeningDraftRoundOrder("random", chairs, 1, draftSeed).map((chair) => chair.id);
    const nextRound = getOpeningDraftRoundOrder("random", chairs, 2, draftSeed).map((chair) => chair.id);

    expect(secondRun).toEqual(firstRun);
    expect(nextRound).not.toEqual(firstRun);
  });

  it("uses equal seeded lottery order for opening weighted lottery drafts", () => {
    const chairs = getState(0, "lottery").chairs;
    const firstRound = getOpeningDraftRoundOrder("lottery", chairs, 0, draftSeed).map((chair) => chair.id);
    const secondRound = getOpeningDraftRoundOrder("lottery", chairs, 1, draftSeed).map((chair) => chair.id);
    const repeatedSecondRound = getOpeningDraftRoundOrder("lottery", chairs, 1, draftSeed).map((chair) => chair.id);

    expect(firstRound[0]).toBe("player");
    expect(secondRound).toEqual(repeatedSecondRound);
    expect(new Set(chairs.map((chair) => chair.lotteryWeight))).toEqual(new Set([1]));
  });

  it("recomputes CPU claims when a player pick is undone", () => {
    const onePick = getState(1);
    const threePicks = getState(3);
    const undoneBackToOnePick = getState(1);

    expect(threePicks.cpuClaimedWrestlerIds.length).toBeGreaterThan(onePick.cpuClaimedWrestlerIds.length);
    expect(undoneBackToOnePick.cpuClaimedWrestlerIds).toEqual(onePick.cpuClaimedWrestlerIds);
  });

  it("supports a player bundle as one opening draft clock turn", () => {
    const bundleMembers = draftPool.slice(0, 2);
    const nextPick = draftPool[2];
    const state = simulateOpeningDraft({
      draftMode: "snake",
      draftSeed,
      draftPool,
      playerBrandName: "Raw",
      rivalBrands,
      playerDraftedWrestlers: [...bundleMembers, nextPick],
      playerDraftGroups: [bundleMembers.map((wrestler) => wrestler.id), [nextPick.id]],
    });
    const playerPicks = state.playerPicks;

    expect(playerPicks.slice(0, 2).map((event) => event.wrestler.id)).toEqual(bundleMembers.map((wrestler) => wrestler.id));
    expect(playerPicks[0].overallPick).toBe(1);
    expect(playerPicks[1].overallPick).toBe(1);
    expect(playerPicks[2].wrestler.id).toBe(nextPick.id);
    expect(playerPicks[2].overallPick).toBeGreaterThan(1);
  });

  it("creates no duplicate ownership across player and CPU opening rosters", () => {
    const game = createNewGame({
      brandName: "Raw",
      brandStyle: "Raw",
      gmName: "Test GM",
      rivalGMAssignments: createRivalGMAssignments("Raw"),
      draftMode: "snake",
      draftedWrestlers: draftPool.slice(0, 12),
    });
    const playerIds = game.wrestlers.map((wrestler) => wrestler.id);
    const cpuIds = game.rivalBrands.flatMap((brand) => brand.rosterWrestlerIds);
    const allOwnedIds = [...playerIds, ...cpuIds];

    expect(playerIds).toHaveLength(12);
    expect(new Set(allOwnedIds)).toHaveLength(allOwnedIds.length);
  });

  it("lets CPU rivals draft until no affordable candidate remains", () => {
    const game = createNewGame({
      brandName: "Raw",
      brandStyle: "Raw",
      gmName: "Test GM",
      rivalGMAssignments: createRivalGMAssignments("Raw"),
      draftMode: "snake",
      draftedWrestlers: draftPool.slice(0, 12),
    });
    const ownedIds = new Set([...game.wrestlers.map((wrestler) => wrestler.id), ...game.rivalBrands.flatMap((brand) => brand.rosterWrestlerIds)]);
    const unownedCosts = draftPool
      .filter((wrestler) => !ownedIds.has(wrestler.id))
      .map((wrestler) => getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0)
      .filter((cost) => cost > 0);
    const cheapestUnownedCost = Math.min(...unownedCosts);

    game.rivalBrands.forEach((brand) => {
      expect(brand.budget).toBeGreaterThanOrEqual(0);
      expect(brand.budget).toBeLessThan(cheapestUnownedCost);
    });
  });

  it("supports player draft classes beyond the TV-ready minimum without duplicate CPU ownership", () => {
    const game = createNewGame({
      brandName: "Raw",
      brandStyle: "Raw",
      gmName: "Test GM",
      rivalGMAssignments: createRivalGMAssignments("Raw"),
      draftMode: "snake",
      draftedWrestlers: draftPool.slice(0, 14),
    });
    const playerIds = game.wrestlers.map((wrestler) => wrestler.id);
    const cpuIds = game.rivalBrands.flatMap((brand) => brand.rosterWrestlerIds);
    const allOwnedIds = [...playerIds, ...cpuIds];

    expect(playerIds).toHaveLength(14);
    expect(new Set(allOwnedIds)).toHaveLength(allOwnedIds.length);
  });

  it("carries opening draft bundle discounts into starting money", () => {
    const draftedWrestlers = draftPool.slice(0, 2);
    const grossValue = draftedWrestlers.reduce((sum, wrestler) => sum + (getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0), 0);
    const discount = grossValue - Math.round(grossValue * 0.8);
    const game = createNewGame({
      brandName: "Raw",
      brandStyle: "Raw",
      gmName: "Test GM",
      rivalGMAssignments: createRivalGMAssignments("Raw"),
      draftMode: "snake",
      draftedWrestlers,
      draftPickGroups: [draftedWrestlers.map((wrestler) => wrestler.id)],
      draftBundleDiscountUsd: discount,
      startingBudgetTier: "$2M",
    });

    expect(game.money).toBe(2000000 - (grossValue - discount));
    expect(game.wrestlers.map((wrestler) => wrestler.id)).toEqual(draftedWrestlers.map((wrestler) => wrestler.id));
  });

  it("keeps harder CPU draft construction deterministic and different from easy construction", () => {
    const easy = simulateOpeningDraft({
      draftMode: "snake",
      difficulty: "Easy",
      draftSeed,
      draftPool,
      playerBrandName: "Raw",
      rivalBrands,
      playerDraftedWrestlers: draftPool.slice(0, 12),
      finalizeCpuDraft: true,
    });
    const legendary = simulateOpeningDraft({
      draftMode: "snake",
      difficulty: "Legendary",
      draftSeed,
      draftPool,
      playerBrandName: "Raw",
      rivalBrands,
      playerDraftedWrestlers: draftPool.slice(0, 12),
      finalizeCpuDraft: true,
    });

    expect(legendary.cpuClaimedWrestlerIds).not.toEqual(easy.cpuClaimedWrestlerIds);
    expect(
      simulateOpeningDraft({
        draftMode: "snake",
        difficulty: "Legendary",
        draftSeed,
        draftPool,
        playerBrandName: "Raw",
        rivalBrands,
        playerDraftedWrestlers: draftPool.slice(0, 12),
        finalizeCpuDraft: true,
      }).cpuClaimedWrestlerIds,
    ).toEqual(legendary.cpuClaimedWrestlerIds);
  });
});
