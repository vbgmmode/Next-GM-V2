import { DRAFT_CONTRACT_WEEKS, STANDARD_BUDGET_AMOUNT, UNLIMITED_BUDGET_AMOUNT } from "./constants";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { createMarketContract } from "./market";
import { createDefaultWrestlerRecord, draftPool } from "./seed";
import type { GameState, RivalBrandState, SeasonArchiveSummary, Wrestler } from "./types";
import { startNextSeason } from "./advanceWeek";

function getDraftCost(wrestler: Pick<Wrestler, "id">) {
  return getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0;
}

function prepareDraftedWrestler(wrestler: Wrestler): Wrestler {
  return {
    ...wrestler,
    appearancesThisSeason: 0,
    lastBookedWeek: 0,
    consecutiveWeeksBooked: 0,
    injuryStatus: "healthy",
    injuryDescription: undefined,
    injuryWeeksRemaining: 0,
    injuryOccurredWeek: undefined,
    record: wrestler.record ?? createDefaultWrestlerRecord(),
  };
}

export function getMidCareerDraftBudget(game: GameState) {
  return game.startingBudgetTier === "Unlimited" ? UNLIMITED_BUDGET_AMOUNT : STANDARD_BUDGET_AMOUNT;
}

export function getMidCareerDraftPool(game: GameState) {
  const ownedIds = new Set([...game.wrestlers.map((wrestler) => wrestler.id), ...game.rivalBrands.flatMap((brand) => brand.rosterWrestlerIds)]);
  return draftPool.filter((wrestler) => !ownedIds.has(wrestler.id)).sort((a, b) => (a.draftRank ?? 999) - (b.draftRank ?? 999));
}

function getCpuDraftOrder(game: GameState) {
  return [...game.rivalBrands].sort((a, b) => (a.seasonAverageScore || 0) - (b.seasonAverageScore || 0) || b.seasonRank - a.seasonRank || a.brandName.localeCompare(b.brandName));
}

function scoreCpuOffseasonPick(brand: RivalBrandState, wrestler: Wrestler) {
  const styleBonus =
    brand.assignedGMStyle === "Ratings Chaser" && wrestler.popularity >= 75
      ? 18
      : brand.assignedGMStyle === "Talent Developer" && wrestler.roleTier === "Prospect"
        ? 18
        : brand.assignedGMStyle === "Big Money Promoter" && wrestler.roleTier === "MainEvent"
          ? 16
          : 0;

  return (wrestler.draftRank ? 240 - wrestler.draftRank : 80) + wrestler.popularity * 0.45 + Math.max(wrestler.ringSkill, wrestler.promoSkill) * 0.25 + styleBonus;
}

function runCpuOffseasonDraft(game: GameState, available: Map<string, Wrestler>, startingBudget: number) {
  const budgets = new Map(game.rivalBrands.map((brand) => [brand.id, game.startingBudgetTier === "Unlimited" ? UNLIMITED_BUDGET_AMOUNT : startingBudget]));
  let brands = game.rivalBrands.map((brand) => ({
    ...brand,
    budget: budgets.get(brand.id) ?? startingBudget,
  }));
  let picked = true;

  while (picked && available.size) {
    picked = false;

    for (const orderBrand of getCpuDraftOrder({ ...game, rivalBrands: brands })) {
      const brand = brands.find((item) => item.id === orderBrand.id);

      if (!brand) {
        continue;
      }

      const budget = budgets.get(brand.id) ?? 0;
      const candidate = [...available.values()]
        .filter((wrestler) => game.startingBudgetTier === "Unlimited" || getDraftCost(wrestler) <= budget)
        .sort((a, b) => scoreCpuOffseasonPick(brand, b) - scoreCpuOffseasonPick(brand, a) || (a.draftRank ?? 999) - (b.draftRank ?? 999))[0];

      if (!candidate) {
        continue;
      }

      const cost = getDraftCost(candidate);
      const nextBudget = game.startingBudgetTier === "Unlimited" ? budget : Math.max(0, budget - cost);
      const contract = createMarketContract(candidate, "rival", brand.id, "draft", DRAFT_CONTRACT_WEEKS, "prepaid", undefined, cost);
      const member = {
        wrestlerId: candidate.id,
        contractId: contract.id,
        acquisitionSource: "draft" as const,
        acquiredSeasonNumber: game.seasonNumber + 1,
        acquiredWeekNumber: 1,
        momentum: candidate.momentum,
        morale: candidate.morale,
        fatigue: candidate.fatigue,
        appearancesThisSeason: 0,
        lastBookedWeek: 0,
        consecutiveWeeksBooked: 0,
        injuryStatus: "healthy" as const,
        injuryWeeksRemaining: 0,
      };

      available.delete(candidate.id);
      budgets.set(brand.id, nextBudget);
      brands = brands.map((item) =>
        item.id === brand.id
          ? {
              ...item,
              budget: nextBudget,
              rosterWrestlerIds: [...item.rosterWrestlerIds, candidate.id],
              rosterState: [...item.rosterState, member],
              contracts: [...item.contracts, contract],
            }
          : item,
      );
      picked = true;
    }
  }

  return brands;
}

export function completeMidCareerDraft(game: GameState, selectedWrestlerIds: string[], completedSeasonArchive?: SeasonArchiveSummary) {
  const startingBudget = getMidCareerDraftBudget(game);
  const available = new Map(getMidCareerDraftPool(game).map((wrestler) => [wrestler.id, wrestler]));
  const selectedWrestlers: Wrestler[] = [];
  let remainingBudget = startingBudget;

  selectedWrestlerIds.forEach((id) => {
    const wrestler = available.get(id);
    const cost = wrestler ? getDraftCost(wrestler) : 0;

    if (!wrestler || (game.startingBudgetTier !== "Unlimited" && cost > remainingBudget)) {
      return;
    }

    available.delete(id);
    selectedWrestlers.push(wrestler);
    remainingBudget = game.startingBudgetTier === "Unlimited" ? remainingBudget : Math.max(0, remainingBudget - cost);
  });

  const playerContracts = selectedWrestlers.map((wrestler) => createMarketContract(wrestler, "player", "player", "draft", DRAFT_CONTRACT_WEEKS, "prepaid", undefined, getDraftCost(wrestler)));
  const draftedGame: GameState = {
    ...game,
    money: remainingBudget,
    wrestlers: [...game.wrestlers, ...selectedWrestlers.map(prepareDraftedWrestler)],
    rivalBrands: runCpuOffseasonDraft(game, available, startingBudget),
    marketState: {
      ...game.marketState,
      weeklyBoard: undefined,
      playerContracts: [...game.marketState.playerContracts, ...playerContracts],
    },
  };

  return startNextSeason(draftedGame, completedSeasonArchive);
}

