import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { getDifficultyRules, scaleNegativePressure } from "./difficultyRules";
import { affiliationCatalog } from "./affiliationCatalog";
import type {
  GameState,
  MarketContract,
  MarketState,
  MarketTransaction,
  OfficeMandateEvent,
  OfficeMandateState,
  OfficeMandateStatus,
  RivalBrandState,
  WeeklyMarketBoard,
  WeeklyMarketBoardEntry,
  Wrestler,
} from "./types";

const playerRosterLimit = 20;
const cpuRosterLimit = 18;
const defaultContractWeeks = 12;
const defaultCpuBudget = 1800000;
const marketExpiryWarningWeeks = 2;
const weeklyBoardMaxEntries = 6;
const bundleDiscountMultiplier = 0.8;

export type MarketBundleOffer = {
  affiliationId: string;
  affiliationName: string;
  kind: "tag_team" | "faction";
  wrestlerIds: string[];
  wrestlers: Wrestler[];
  contractWeeks: number;
  totalWeeklyAsk: number;
  fullDueNow: number;
  discountedDueNow: number;
  discountAmount: number;
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getMoneyValue(wrestler: Pick<Wrestler, "id" | "popularity" | "roleTier">) {
  const row = getRosterFinanceValueForWrestler(wrestler);
  const roleWeeklyFallbacks: Record<string, number> = {
    MainEvent: 26000,
    UpperCard: 17000,
    Midcard: 10000,
    Prospect: 5000,
    Enhancement: 2500,
  };
  const weeklySalary = row?.weeklyHireRateUsd ?? roleWeeklyFallbacks[wrestler.roleTier ?? ""] ?? Math.max(2500, Math.round(wrestler.popularity * 120));
  const releasePenaltyPct = row?.releasePenaltyPct ?? 10;

  return {
    weeklySalary,
    releasePenalty: Math.round(weeklySalary * defaultContractWeeks * (releasePenaltyPct / 100)),
    defaultWeeks: row?.midseasonDefaultContractWeeks ?? defaultContractWeeks,
    minWeeks: row?.midseasonMinContractWeeks ?? 4,
    maxWeeks: row?.midseasonMaxContractWeeks ?? 24,
    renewalRisk: row?.renewalRisk ?? 20,
  };
}

export function createMarketContract(
  wrestler: Pick<Wrestler, "id" | "popularity" | "roleTier">,
  ownerType: MarketContract["ownerType"],
  ownerBrandId: string | undefined,
  acquisitionSource: MarketContract["acquisitionSource"],
  weeks?: number,
  paymentModel: MarketContract["paymentModel"] = acquisitionSource === "draft" ? "weekly" : "prepaid",
  weeklySalaryOverride?: number,
  upfrontCostPaid?: number,
): MarketContract {
  const value = getMoneyValue(wrestler);
  const contractWeeksRemaining = Math.max(1, weeks ?? value.defaultWeeks);
  const weeklySalary = weeklySalaryOverride ?? value.weeklySalary;

  return {
    id: `${ownerType}-${ownerBrandId ?? "pool"}-${wrestler.id}-contract`,
    wrestlerId: wrestler.id,
    ownerType,
    ownerBrandId,
    contractWeeksRemaining,
    weeklySalary,
    releasePenalty: paymentModel === "prepaid" ? 0 : value.releasePenalty,
    acquisitionSource,
    contractStatus: contractWeeksRemaining <= marketExpiryWarningWeeks ? "expiring" : "active",
    renewalRisk: value.renewalRisk,
    paymentModel,
    upfrontCostPaid,
  };
}

export function createDefaultMarketState(wrestlers: Wrestler[]): MarketState {
  return {
    playerContracts: wrestlers.map((wrestler) => createMarketContract(wrestler, "player", "player", "draft", defaultContractWeeks)),
    transactions: [],
    cooldowns: [],
    officeMandate: createDefaultOfficeMandate(),
  };
}

export function createDefaultOfficeMandate(): OfficeMandateState {
  return {
    ownerTrust: 60,
    brandReputation: 60,
    mandateStatus: "stable",
    mandateHistory: [],
  };
}

export function getContractWeekMultiplier(weeks: number) {
  if (weeks <= 1) return 1.5;
  if (weeks <= 3) return 1.35;
  if (weeks <= 6) return 1.2;
  if (weeks <= 9) return 1.1;
  return 1;
}

function getMarketVolatilityMultiplier(wrestler: Pick<Wrestler, "id" | "popularity" | "momentum">, seasonNumber: number, weekNumber: number) {
  const roll = hashString(`market-ask-${seasonNumber}-${weekNumber}-${wrestler.id}`) % 100;
  const hotTargetPremium = wrestler.popularity >= 78 || wrestler.momentum >= 78 ? 0.12 : 0;

  if (roll < 14) return 0.82;
  if (roll < 46) return 1;
  if (roll < 78) return 1.16 + hotTargetPremium;
  return 1.32 + hotTargetPremium;
}

function getRenewalPressureMultiplier(wrestler: Wrestler) {
  const starPremium = wrestler.popularity >= 78 || wrestler.roleTier === "MainEvent" ? 0.14 : wrestler.popularity >= 68 ? 0.08 : 0;
  const momentumPremium = wrestler.momentum >= 75 ? 0.1 : wrestler.momentum >= 65 ? 0.05 : 0;
  const moraleAdjustment = wrestler.morale <= 45 ? 0.08 : wrestler.morale >= 78 ? -0.04 : 0;

  return Math.max(0.85, 1 + starPremium + momentumPremium + moraleAdjustment);
}

export function getExternalMarketOffer(wrestler: Wrestler, seasonNumber: number, weekNumber: number, weeks: number) {
  const baseWeekly = getMoneyValue(wrestler).weeklySalary;
  const weeklyAsk = Math.max(1000, Math.round(baseWeekly * getMarketVolatilityMultiplier(wrestler, seasonNumber, weekNumber) * getContractWeekMultiplier(weeks)));

  return {
    weeks,
    weeklyAsk,
    dueNow: weeklyAsk * weeks,
  };
}

export function getRenewalOffer(wrestler: Wrestler, weeks: number) {
  const baseWeekly = getMoneyValue(wrestler).weeklySalary;
  const weeklyAsk = Math.max(1000, Math.round(baseWeekly * getRenewalPressureMultiplier(wrestler) * getContractWeekMultiplier(weeks)));

  return {
    weeks,
    weeklyAsk,
    dueNow: weeklyAsk * weeks,
  };
}

export function getContractForWrestler(game: GameState, wrestlerId: string) {
  return game.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestlerId && contract.contractStatus !== "released");
}

export function getActivePlayerPayroll(game: GameState) {
  return game.marketState.playerContracts
    .filter((contract) => (contract.contractStatus === "active" || contract.contractStatus === "expiring") && contract.paymentModel !== "prepaid")
    .reduce((sum, contract) => sum + contract.weeklySalary, 0);
}

export function getMarketTransactionCostsForWeek(game: GameState, seasonNumber = game.seasonNumber, weekNumber = game.currentWeek) {
  void game;
  void seasonNumber;
  void weekNumber;
  return 0;
}

function getOwnedIds(game: GameState) {
  return new Set([
    ...game.wrestlers.map((wrestler) => wrestler.id),
    ...game.rivalBrands.flatMap((brand) => brand.rosterWrestlerIds),
  ]);
}

function isCoolingDown(game: GameState, wrestlerId: string) {
  return game.marketState.cooldowns.some((cooldown) => cooldown.wrestlerId === wrestlerId && cooldown.availableWeek > game.currentWeek);
}

function getWeeklyBoardSeed(game: Pick<GameState, "seasonNumber" | "currentWeek">) {
  return `s${game.seasonNumber}-w${game.currentWeek}`;
}

function getWeeklyBoardCount(game: Pick<GameState, "seasonNumber" | "currentWeek">) {
  return hashString(`weekly-board-count-${getWeeklyBoardSeed(game)}`) % (weeklyBoardMaxEntries + 1);
}

function getWeeklyBoardCandidates(game: GameState, draftPool: Wrestler[]) {
  const ownedIds = getOwnedIds(game);
  const rules = getDifficultyRules(game.difficulty);

  return draftPool
    .filter((wrestler) => !ownedIds.has(wrestler.id) && !isCoolingDown(game, wrestler.id))
    .map((wrestler) => {
      const marketRoll = hashString(`weekly-board-candidate-${getWeeklyBoardSeed(game)}-${wrestler.id}`);
      const roleWeight = wrestler.roleTier === "MainEvent" ? 180 : wrestler.roleTier === "UpperCard" ? 90 : wrestler.roleTier === "Enhancement" ? 35 : 0;
      const rankWeight = Math.min(120, Math.max(0, 120 - (wrestler.draftRank ?? 120)));

      return {
        wrestler,
        score: (marketRoll % 1000) + roleWeight + rankWeight + rules.cpuMarket.boardCandidateScoreModifier,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.wrestler);
}

function pickCpuClaimBrand(game: GameState, wrestler: Wrestler, claimedIds: Set<string>) {
  const rules = getDifficultyRules(game.difficulty);
  const eligibleBrands = game.rivalBrands
    .filter((brand) => brand.rosterWrestlerIds.length < cpuRosterLimit && !brand.rosterWrestlerIds.includes(wrestler.id))
    .map((brand) => {
      const offer = getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, defaultContractWeeks);
      const divisionNeed = brand.rosterWrestlerIds.filter((id) => id !== wrestler.id).length < 14 ? 12 : 0;
      const styleFit =
        brand.assignedGMStyle === "Talent Developer" && wrestler.roleTier === "Prospect"
          ? 16
          : brand.assignedGMStyle === "Ratings Chaser" && wrestler.popularity >= 70
            ? 14
            : 0;
      const roll = hashString(`weekly-board-cpu-claim-${getWeeklyBoardSeed(game)}-${brand.id}-${wrestler.id}`);

      return {
        brand,
        offer,
        score: (roll % 100) + divisionNeed + styleFit + Math.round((wrestler.popularity + wrestler.momentum) / 12) + rules.cpuMarket.claimScoreModifier,
      };
    })
    .filter((entry) => entry.offer.dueNow <= entry.brand.budget);

  if (claimedIds.has(wrestler.id) || !eligibleBrands.length) {
    return undefined;
  }

  const best = eligibleBrands.sort((a, b) => b.score - a.score)[0];
  return best.score >= rules.cpuMarket.claimThreshold ? best : undefined;
}

function addCpuBoardSigning(game: GameState, brand: RivalBrandState, wrestler: Wrestler) {
  const offer = getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, defaultContractWeeks);
  const contract = createMarketContract(wrestler, "rival", brand.id, "free_agent", defaultContractWeeks, "prepaid", offer.weeklyAsk, offer.dueNow);
  const transaction = createTransaction(game, "signing", [wrestler.id], [wrestler.name], offer.dueNow, `${brand.brandName} signed ${wrestler.name} from this week's market board.`, {
    toBrandId: brand.id,
    toBrandName: brand.brandName,
  });
  const claim = {
    id: `${transaction.id}-claim`,
    seasonNumber: game.seasonNumber,
    weekNumber: game.currentWeek,
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    brandName: brand.brandName,
    note: transaction.note,
  };

  return {
    transaction,
    nextBrand: {
      ...brand,
      budget: brand.budget - offer.dueNow,
      rosterWrestlerIds: [...brand.rosterWrestlerIds, wrestler.id],
      rosterState: [
        ...brand.rosterState,
        {
          wrestlerId: wrestler.id,
          contractId: contract.id,
          acquisitionSource: "free_agent" as const,
          acquiredSeasonNumber: game.seasonNumber,
          acquiredWeekNumber: game.currentWeek,
          momentum: wrestler.momentum,
          morale: wrestler.morale,
          fatigue: wrestler.fatigue,
          appearancesThisSeason: 0,
          lastBookedWeek: 0,
          consecutiveWeeksBooked: 0,
          injuryStatus: wrestler.injuryStatus,
          injuryWeeksRemaining: wrestler.injuryWeeksRemaining,
        },
      ],
      contracts: [...brand.contracts, contract],
      freeAgentClaims: [...brand.freeAgentClaims, claim],
      marketTransactions: [...brand.marketTransactions, transaction],
      activityHistory: [
        ...brand.activityHistory,
        {
          id: `${transaction.id}-activity`,
          seasonNumber: game.seasonNumber,
          weekNumber: game.currentWeek,
          label: "Free Agent Signing",
          note: transaction.note,
        },
      ],
    },
  };
}

export function createWeeklyMarketBoard(game: GameState, draftPool: Wrestler[]): { board: WeeklyMarketBoard; game: GameState } {
  const count = getWeeklyBoardCount(game);
  const candidates = getWeeklyBoardCandidates(game, draftPool).slice(0, count);
  const claimedIds = new Set<string>();
  let nextGame = game;
  const entries: WeeklyMarketBoardEntry[] = [];

  candidates.forEach((wrestler) => {
    const baseOffer = getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, 12);
    const cpuClaim = pickCpuClaimBrand(nextGame, wrestler, claimedIds);

    if (cpuClaim) {
      const { transaction, nextBrand } = addCpuBoardSigning(nextGame, cpuClaim.brand, wrestler);
      claimedIds.add(wrestler.id);
      nextGame = {
        ...nextGame,
        rivalBrands: nextGame.rivalBrands.map((brand) => (brand.id === cpuClaim.brand.id ? nextBrand : brand)),
      };
      entries.push({
        wrestlerId: wrestler.id,
        status: "rival_signed",
        weeklyAsk: baseOffer.weeklyAsk,
        rivalBrandId: cpuClaim.brand.id,
        rivalBrandName: cpuClaim.brand.brandName,
        transactionId: transaction.id,
      });
      return;
    }

    entries.push({
      wrestlerId: wrestler.id,
      status: "available",
      weeklyAsk: baseOffer.weeklyAsk,
    });
  });

  const board = {
    seasonNumber: game.seasonNumber,
    weekNumber: game.currentWeek,
    entries,
  };

  return {
    board,
    game: {
      ...nextGame,
      marketState: {
        ...nextGame.marketState,
        weeklyBoard: board,
      },
    },
  };
}

export function ensureWeeklyMarketBoard(game: GameState, draftPool: Wrestler[]) {
  if (game.marketState.weeklyBoard?.seasonNumber === game.seasonNumber && game.marketState.weeklyBoard.weekNumber === game.currentWeek) {
    return game;
  }

  return createWeeklyMarketBoard(game, draftPool).game;
}

export function getAvailableFreeAgents(game: GameState, draftPool: Wrestler[]) {
  const ownedIds = getOwnedIds(game);
  return draftPool
    .filter((wrestler) => !ownedIds.has(wrestler.id) && !isCoolingDown(game, wrestler.id))
    .sort((a, b) => (a.draftRank ?? 999) - (b.draftRank ?? 999));
}

function getWrestlerName(id: string, pool: Wrestler[], fallback = "Unknown") {
  return pool.find((wrestler) => wrestler.id === id)?.name ?? fallback;
}

function createTransaction(
  game: GameState,
  type: MarketTransaction["type"],
  wrestlerIds: string[],
  wrestlerNames: string[],
  amount: number,
  note: string,
  extra: Partial<MarketTransaction> = {},
): MarketTransaction {
  return {
    id: `${type}-s${game.seasonNumber}-w${game.currentWeek}-${wrestlerIds.join("-")}-${game.marketState.transactions.length}`,
    seasonNumber: game.seasonNumber,
    weekNumber: game.currentWeek,
    type,
    wrestlerIds,
    wrestlerNames,
    amount,
    note,
    ...extra,
  };
}

function removePlayerWrestlerOwnership(game: GameState, wrestlerId: string): GameState {
  return {
    ...game,
    wrestlers: game.wrestlers.filter((item) => item.id !== wrestlerId),
    championships: game.championships.map((championship) => ({
      ...championship,
      championIds: championship.championIds.filter((id) => id !== wrestlerId),
      contenderIds: championship.contenderIds?.filter((id) => id !== wrestlerId),
    })),
    rivalries: game.rivalries.filter((rivalry) => !rivalry.participantIds.includes(wrestlerId)),
    currentShow: game.currentShow.map((segment) => ({ ...segment, participantIds: segment.participantIds.filter((id) => id !== wrestlerId) })),
  };
}

export function signPlayerFreeAgent(game: GameState, wrestlerId: string, draftPool: Wrestler[], requestedWeeks?: number): GameState {
  const boardReadyGame = ensureWeeklyMarketBoard(game, draftPool);
  const boardEntry = boardReadyGame.marketState.weeklyBoard?.entries.find((entry) => entry.wrestlerId === wrestlerId);
  const wrestler = boardEntry?.status === "available" ? getAvailableFreeAgents(boardReadyGame, draftPool).find((item) => item.id === wrestlerId) : undefined;

  if (!wrestler || boardReadyGame.wrestlers.length >= playerRosterLimit) {
    return game;
  }

  const contractWeeks = Math.max(1, Math.min(12, requestedWeeks ?? Math.min(12, Math.max(1, 13 - boardReadyGame.currentWeek))));
  const offer = getExternalMarketOffer(wrestler, boardReadyGame.seasonNumber, boardReadyGame.currentWeek, contractWeeks);

  if (boardReadyGame.money < offer.dueNow) {
    return game;
  }

  const contract = createMarketContract(wrestler, "player", "player", "free_agent", contractWeeks, "prepaid", offer.weeklyAsk, offer.dueNow);
  const transaction = createTransaction(
    boardReadyGame,
    "signing",
    [wrestler.id],
    [wrestler.name],
    offer.dueNow,
    `${boardReadyGame.brandName} signed ${wrestler.name} for ${contract.contractWeeksRemaining} weeks.`,
    {
      toBrandId: "player",
      toBrandName: boardReadyGame.brandName,
    },
  );

  return {
    ...boardReadyGame,
    money: boardReadyGame.money - offer.dueNow,
    wrestlers: [
      ...boardReadyGame.wrestlers,
      {
        ...wrestler,
        appearancesThisSeason: 0,
        lastBookedWeek: 0,
        consecutiveWeeksBooked: 0,
        injuryStatus: wrestler.injuryStatus ?? "healthy",
        injuryWeeksRemaining: wrestler.injuryWeeksRemaining ?? 0,
      },
    ],
    marketState: {
      ...boardReadyGame.marketState,
      weeklyBoard: boardReadyGame.marketState.weeklyBoard
        ? {
            ...boardReadyGame.marketState.weeklyBoard,
            entries: boardReadyGame.marketState.weeklyBoard.entries.map((entry) =>
              entry.wrestlerId === wrestler.id ? { ...entry, status: "player_signed", transactionId: transaction.id } : entry,
            ),
          }
        : boardReadyGame.marketState.weeklyBoard,
      playerContracts: [...boardReadyGame.marketState.playerContracts.filter((item) => item.wrestlerId !== wrestler.id), contract],
      transactions: [...boardReadyGame.marketState.transactions, transaction],
    },
  };
}

function getContractWeeksForMarket(game: GameState, requestedWeeks?: number) {
  return Math.max(1, Math.min(12, requestedWeeks ?? Math.min(12, Math.max(1, 13 - game.currentWeek))));
}

export function getMarketBundleOffers(game: GameState, draftPool: Wrestler[], requestedWeeks?: number): MarketBundleOffer[] {
  const boardReadyGame = ensureWeeklyMarketBoard(game, draftPool);
  const contractWeeks = getContractWeeksForMarket(boardReadyGame, requestedWeeks);
  const ownedIds = getOwnedIds(boardReadyGame);
  const availableBoardIds = new Set(
    boardReadyGame.marketState.weeklyBoard?.entries.filter((entry) => entry.status === "available" && !ownedIds.has(entry.wrestlerId)).map((entry) => entry.wrestlerId) ?? [],
  );

  if (availableBoardIds.size < 2) {
    return [];
  }

  return affiliationCatalog
    .filter((affiliation) => affiliation.kind === "tag_team" || affiliation.kind === "faction")
    .flatMap((affiliation) => {
      const memberIds = affiliation.memberWrestlerIds.filter((id) => availableBoardIds.has(id));

      if (memberIds.length < 2) {
        return [];
      }

      const wrestlers = memberIds
        .map((id) => draftPool.find((wrestler) => wrestler.id === id))
        .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

      if (wrestlers.length !== memberIds.length) {
        return [];
      }

      const memberOffers = wrestlers.map((wrestler) => getExternalMarketOffer(wrestler, boardReadyGame.seasonNumber, boardReadyGame.currentWeek, contractWeeks));
      const fullDueNow = memberOffers.reduce((sum, offer) => sum + offer.dueNow, 0);
      const discountedDueNow = memberOffers.reduce((sum, offer) => sum + Math.round(offer.dueNow * bundleDiscountMultiplier), 0);
      const kind: MarketBundleOffer["kind"] = affiliation.kind === "tag_team" ? "tag_team" : "faction";

      return [
        {
          affiliationId: affiliation.id,
          affiliationName: affiliation.name,
          kind,
          wrestlerIds: wrestlers.map((wrestler) => wrestler.id),
          wrestlers,
          contractWeeks,
          totalWeeklyAsk: memberOffers.reduce((sum, offer) => sum + offer.weeklyAsk, 0),
          fullDueNow,
          discountedDueNow,
          discountAmount: fullDueNow - discountedDueNow,
        },
      ];
    })
    .sort((a, b) => b.discountAmount - a.discountAmount || a.affiliationName.localeCompare(b.affiliationName));
}

export function signPlayerFreeAgentBundle(game: GameState, affiliationId: string, draftPool: Wrestler[], requestedWeeks?: number): GameState {
  const boardReadyGame = ensureWeeklyMarketBoard(game, draftPool);
  const bundleOffer = getMarketBundleOffers(boardReadyGame, draftPool, requestedWeeks).find((offer) => offer.affiliationId === affiliationId);

  if (!bundleOffer || boardReadyGame.wrestlers.length + bundleOffer.wrestlers.length > playerRosterLimit || boardReadyGame.money < bundleOffer.discountedDueNow) {
    return game;
  }

  const memberContracts = bundleOffer.wrestlers.map((wrestler) => {
    const offer = getExternalMarketOffer(wrestler, boardReadyGame.seasonNumber, boardReadyGame.currentWeek, bundleOffer.contractWeeks);
    const discountedDueNow = Math.round(offer.dueNow * bundleDiscountMultiplier);
    return createMarketContract(wrestler, "player", "player", "free_agent", bundleOffer.contractWeeks, "prepaid", offer.weeklyAsk, discountedDueNow);
  });
  const transaction = createTransaction(
    boardReadyGame,
    "signing",
    bundleOffer.wrestlerIds,
    bundleOffer.wrestlers.map((wrestler) => wrestler.name),
    bundleOffer.discountedDueNow,
    `${boardReadyGame.brandName} signed ${bundleOffer.affiliationName} as a package for ${bundleOffer.contractWeeks} weeks with a 20% bundle discount.`,
    {
      toBrandId: "player",
      toBrandName: boardReadyGame.brandName,
    },
  );
  const signedIds = new Set(bundleOffer.wrestlerIds);

  return {
    ...boardReadyGame,
    money: boardReadyGame.money - bundleOffer.discountedDueNow,
    wrestlers: [
      ...boardReadyGame.wrestlers,
      ...bundleOffer.wrestlers.map((wrestler) => ({
        ...wrestler,
        appearancesThisSeason: 0,
        lastBookedWeek: 0,
        consecutiveWeeksBooked: 0,
        injuryStatus: wrestler.injuryStatus ?? "healthy",
        injuryWeeksRemaining: wrestler.injuryWeeksRemaining ?? 0,
      })),
    ],
    marketState: {
      ...boardReadyGame.marketState,
      weeklyBoard: boardReadyGame.marketState.weeklyBoard
        ? {
            ...boardReadyGame.marketState.weeklyBoard,
            entries: boardReadyGame.marketState.weeklyBoard.entries.map((entry) =>
              signedIds.has(entry.wrestlerId) ? { ...entry, status: "player_signed", transactionId: transaction.id } : entry,
            ),
          }
        : boardReadyGame.marketState.weeklyBoard,
      playerContracts: [
        ...boardReadyGame.marketState.playerContracts.filter((item) => !signedIds.has(item.wrestlerId)),
        ...memberContracts,
      ],
      transactions: [...boardReadyGame.marketState.transactions, transaction],
    },
  };
}

export function releasePlayerWrestler(game: GameState, wrestlerId: string): GameState {
  const wrestler = game.wrestlers.find((item) => item.id === wrestlerId);
  const contract = getContractForWrestler(game, wrestlerId);

  if (!wrestler || game.wrestlers.length <= 8) {
    return game;
  }

  const releasePenalty = contract?.paymentModel === "prepaid" ? 0 : contract?.releasePenalty ?? getMoneyValue(wrestler).releasePenalty;
  const titleWarning = game.championships.some((championship) => championship.championIds.includes(wrestlerId));
  const rivalryWarning = game.rivalries.some((rivalry) => rivalry.participantIds.includes(wrestlerId));
  const warningCopy = titleWarning || rivalryWarning ? " Office logged title/rivalry disruption risk." : "";
  const transaction = createTransaction(game, "release", [wrestler.id], [wrestler.name], releasePenalty, `${game.brandName} released ${wrestler.name}.${warningCopy}`);
  const cleanedGame = removePlayerWrestlerOwnership(game, wrestlerId);

  return {
    ...cleanedGame,
    money: game.money - releasePenalty,
    marketState: {
      ...game.marketState,
      playerContracts: game.marketState.playerContracts.map((item) => (item.wrestlerId === wrestlerId ? { ...item, contractStatus: "released", contractWeeksRemaining: 0 } : item)),
      cooldowns: [...game.marketState.cooldowns.filter((item) => item.wrestlerId !== wrestlerId), { wrestlerId, availableWeek: game.currentWeek + 1, releasedByBrandId: "player" }],
      transactions: [...game.marketState.transactions, transaction],
    },
  };
}

export function renewPlayerContract(game: GameState, wrestlerId: string, requestedWeeks: number): GameState {
  const wrestler = game.wrestlers.find((item) => item.id === wrestlerId);
  const contract = getContractForWrestler(game, wrestlerId);

  if (!wrestler || !contract || contract.contractStatus === "released" || contract.contractStatus === "expired") {
    return game;
  }

  const contractWeeks = Math.max(1, Math.min(12, requestedWeeks));
  const offer = getRenewalOffer(wrestler, contractWeeks);

  if (game.money < offer.dueNow) {
    return game;
  }

  const renewedContract: MarketContract = {
    ...contract,
    contractWeeksRemaining: contract.contractWeeksRemaining + contractWeeks,
    weeklySalary: offer.weeklyAsk,
    releasePenalty: 0,
    acquisitionSource: "renewal",
    contractStatus: contract.contractWeeksRemaining + contractWeeks <= marketExpiryWarningWeeks ? "expiring" : "active",
    paymentModel: "prepaid",
    upfrontCostPaid: (contract.upfrontCostPaid ?? 0) + offer.dueNow,
  };
  const transaction = createTransaction(
    game,
    "renewal",
    [wrestler.id],
    [wrestler.name],
    offer.dueNow,
    `${game.brandName} extended ${wrestler.name} for ${contractWeeks} more weeks.`,
    {
      toBrandId: "player",
      toBrandName: game.brandName,
    },
  );

  return {
    ...game,
    money: game.money - offer.dueNow,
    marketState: {
      ...game.marketState,
      playerContracts: game.marketState.playerContracts.map((item) => (item.wrestlerId === wrestlerId ? renewedContract : item)),
      transactions: [...game.marketState.transactions, transaction],
    },
  };
}

function getTradeValue(wrestler: Wrestler, contract?: MarketContract) {
  return wrestler.popularity * 0.45 + wrestler.momentum * 0.28 + Math.max(wrestler.ringSkill, wrestler.promoSkill) * 0.22 - (contract?.weeklySalary ?? 0) / 3500;
}

export function proposePlayerTrade(game: GameState, outgoingWrestlerId: string, targetWrestlerId: string, draftPool: Wrestler[]): GameState {
  const outgoing = game.wrestlers.find((wrestler) => wrestler.id === outgoingWrestlerId);
  const rivalBrand = game.rivalBrands.find((brand) => brand.rosterWrestlerIds.includes(targetWrestlerId));
  const target = draftPool.find((wrestler) => wrestler.id === targetWrestlerId);

  if (!outgoing || !rivalBrand || !target || game.wrestlers.length <= 8) {
    return game;
  }

  const outgoingContract = getContractForWrestler(game, outgoing.id);
  const targetContract = rivalBrand.contracts.find((contract) => contract.wrestlerId === target.id);
  const valueDelta = getTradeValue(outgoing, outgoingContract) - getTradeValue(target, targetContract);
  const needBonus = rivalBrand.rosterWrestlerIds.filter((id) => draftPool.find((wrestler) => wrestler.id === id)?.division === outgoing.division).length < 4 ? 8 : 0;
  const styleBonus = rivalBrand.assignedGMStyle === "Talent Developer" && outgoing.roleTier === "Prospect" ? 8 : rivalBrand.assignedGMStyle === "Ratings Chaser" && outgoing.popularity >= target.popularity ? 6 : 0;
  const deterministicPush = (hashString(`${game.seasonNumber}-${game.currentWeek}-${rivalBrand.id}-${outgoing.id}-${target.id}`) % 13) - 6;
  const accepted = valueDelta + needBonus + styleBonus + deterministicPush >= -6;
  const transactionFee = accepted ? Math.max(0, Math.round(Math.abs(valueDelta) * 1400)) : 0;
  const transaction = createTransaction(
    game,
    "trade",
    [outgoing.id, target.id],
    [outgoing.name, target.name],
    transactionFee,
    accepted
      ? `${game.brandName} traded ${outgoing.name} to ${rivalBrand.brandName} for ${target.name}.`
      : `${rivalBrand.brandName} rejected ${outgoing.name} for ${target.name}; value and roster fit did not clear the desk.`,
    {
      accepted,
      fromBrandId: accepted ? "player" : undefined,
      fromBrandName: accepted ? game.brandName : undefined,
      toBrandId: accepted ? rivalBrand.id : undefined,
      toBrandName: accepted ? rivalBrand.brandName : undefined,
    },
  );

  if (!accepted) {
    return {
      ...game,
      marketState: { ...game.marketState, transactions: [...game.marketState.transactions, transaction] },
    };
  }

  const nextPlayerContract = targetContract ? { ...targetContract, ownerType: "player" as const, ownerBrandId: "player", acquisitionSource: "trade" as const } : createMarketContract(target, "player", "player", "trade");
  const nextRivalContract = outgoingContract ? { ...outgoingContract, ownerType: "rival" as const, ownerBrandId: rivalBrand.id, acquisitionSource: "trade" as const } : createMarketContract(outgoing, "rival", rivalBrand.id, "trade");
  const cleanedGame = removePlayerWrestlerOwnership(game, outgoing.id);

  return {
    ...cleanedGame,
    money: game.money - transactionFee,
    wrestlers: [
      ...cleanedGame.wrestlers,
      {
        ...target,
        appearancesThisSeason: 0,
        lastBookedWeek: 0,
        consecutiveWeeksBooked: 0,
        injuryStatus: target.injuryStatus ?? "healthy",
        injuryWeeksRemaining: target.injuryWeeksRemaining ?? 0,
      },
    ],
    rivalBrands: game.rivalBrands.map((brand) =>
      brand.id === rivalBrand.id
        ? {
            ...brand,
            rosterWrestlerIds: [...brand.rosterWrestlerIds.filter((id) => id !== target.id), outgoing.id],
            rosterState: [
              ...brand.rosterState.filter((member) => member.wrestlerId !== target.id),
              {
                wrestlerId: outgoing.id,
                contractId: nextRivalContract.id,
                acquisitionSource: "trade",
                acquiredSeasonNumber: game.seasonNumber,
                acquiredWeekNumber: game.currentWeek,
                momentum: outgoing.momentum,
                morale: outgoing.morale,
                fatigue: outgoing.fatigue,
                appearancesThisSeason: 0,
                lastBookedWeek: 0,
                consecutiveWeeksBooked: 0,
                injuryStatus: outgoing.injuryStatus,
                injuryWeeksRemaining: outgoing.injuryWeeksRemaining,
              },
            ],
            contracts: [...brand.contracts.filter((contract) => contract.wrestlerId !== target.id), nextRivalContract],
            marketTransactions: [...brand.marketTransactions, transaction],
          }
        : brand,
    ),
    marketState: {
      ...game.marketState,
      playerContracts: [...game.marketState.playerContracts.filter((contract) => contract.wrestlerId !== outgoing.id && contract.wrestlerId !== target.id), nextPlayerContract],
      transactions: [...game.marketState.transactions, transaction],
    },
  };
}

function ageContract(contract: MarketContract): MarketContract {
  if (contract.contractStatus === "released" || contract.contractStatus === "expired") {
    return contract;
  }

  const contractWeeksRemaining = Math.max(0, contract.contractWeeksRemaining - 1);
  const contractStatus = contractWeeksRemaining <= 0 ? "expired" : contractWeeksRemaining <= marketExpiryWarningWeeks ? "expiring" : "active";

  return { ...contract, contractWeeksRemaining, contractStatus };
}

export function advancePlayerContracts(game: GameState): GameState {
  const expiredContracts = game.marketState.playerContracts.filter(
    (contract) => (contract.contractStatus === "active" || contract.contractStatus === "expiring") && ageContract(contract).contractStatus === "expired",
  );
  const expiredIds = new Set(expiredContracts.map((contract) => contract.wrestlerId));
  const expiryTransactions = expiredContracts.map((contract) => {
    const wrestlerName = getWrestlerName(contract.wrestlerId, game.wrestlers, "Released talent");
    return createTransaction(game, "expiry", [contract.wrestlerId], [wrestlerName], 0, `${wrestlerName}'s contract expired and the market reopened that slot.`);
  });
  const cleanedGame = [...expiredIds].reduce((nextGame, wrestlerId) => removePlayerWrestlerOwnership(nextGame, wrestlerId), game);

  return {
    ...cleanedGame,
    marketState: {
      ...game.marketState,
      playerContracts: game.marketState.playerContracts.map(ageContract),
      cooldowns: [
        ...game.marketState.cooldowns.filter((cooldown) => !expiredIds.has(cooldown.wrestlerId)),
        ...expiredContracts.map((contract) => ({ wrestlerId: contract.wrestlerId, availableWeek: game.currentWeek + 1, releasedByBrandId: "player" })),
      ],
      transactions: [...game.marketState.transactions, ...expiryTransactions],
    },
  };
}

export function retainContractedPlayerRoster(game: GameState): GameState {
  const activeContractIds = new Set(
    game.marketState.playerContracts
      .filter((contract) => contract.contractStatus === "active" || contract.contractStatus === "expiring")
      .map((contract) => contract.wrestlerId),
  );
  const leavingIds = game.wrestlers.map((wrestler) => wrestler.id).filter((wrestlerId) => !activeContractIds.has(wrestlerId));

  if (!leavingIds.length) {
    return game;
  }

  return leavingIds.reduce((nextGame, wrestlerId) => removePlayerWrestlerOwnership(nextGame, wrestlerId), game);
}

export function advanceCpuMarket(game: GameState, draftPool: Wrestler[]): GameState {
  const ownedIds = getOwnedIds(game);
  const cpuCooldowns: MarketState["cooldowns"] = [];

  const marketBrands = game.rivalBrands.map((brand) => {
      const agedContracts = brand.contracts.map(ageContract);
      let nextBrand: RivalBrandState = {
        ...brand,
        contracts: agedContracts,
      };
      const expiredContracts = brand.contracts.filter(
        (contract) => (contract.contractStatus === "active" || contract.contractStatus === "expiring") && ageContract(contract).contractStatus === "expired",
      );

      expiredContracts.forEach((contract) => {
        const wrestler = draftPool.find((item) => item.id === contract.wrestlerId);
        const renewalWeeks = wrestler?.roleTier === "MainEvent" || (wrestler?.popularity ?? 0) >= 78 ? 12 : wrestler?.roleTier === "UpperCard" ? 8 : 4;
        const renewalOffer = wrestler ? getRenewalOffer(wrestler, renewalWeeks) : undefined;
        const shouldRenew =
          wrestler && renewalOffer
            ? renewalOffer.dueNow <= nextBrand.budget && wrestler.popularity + wrestler.momentum + (hashString(`${brand.id}-${wrestler.id}-renew-${game.currentWeek}`) % 20) >= 145
            : false;
        const transaction = createTransaction(
          game,
          shouldRenew ? "renewal" : "expiry",
          [contract.wrestlerId],
          [wrestler?.name ?? "CPU talent"],
          shouldRenew && renewalOffer ? renewalOffer.dueNow : 0,
          shouldRenew ? `${brand.brandName} renewed ${wrestler?.name ?? "a roster piece"}.` : `${brand.brandName} let ${wrestler?.name ?? "a roster piece"} hit the market.`,
          { toBrandId: brand.id, toBrandName: brand.brandName },
        );

        nextBrand = shouldRenew
          ? {
              ...nextBrand,
              contracts: nextBrand.contracts.map((item) =>
                item.id === contract.id
                  ? {
                      ...item,
                      contractWeeksRemaining: renewalWeeks,
                      weeklySalary: renewalOffer?.weeklyAsk ?? item.weeklySalary,
                      releasePenalty: 0,
                      contractStatus: renewalWeeks <= marketExpiryWarningWeeks ? "expiring" : "active",
                      acquisitionSource: "renewal",
                      paymentModel: "prepaid",
                      upfrontCostPaid: (item.upfrontCostPaid ?? 0) + (renewalOffer?.dueNow ?? 0),
                    }
                  : item,
              ),
              budget: nextBrand.budget - transaction.amount,
              marketTransactions: [...nextBrand.marketTransactions, transaction],
            }
          : {
              ...nextBrand,
              rosterWrestlerIds: nextBrand.rosterWrestlerIds.filter((id) => id !== contract.wrestlerId),
              rosterState: nextBrand.rosterState.filter((member) => member.wrestlerId !== contract.wrestlerId),
              marketTransactions: [...nextBrand.marketTransactions, transaction],
            };

        if (!shouldRenew) {
          ownedIds.delete(contract.wrestlerId);
          cpuCooldowns.push({ wrestlerId: contract.wrestlerId, availableWeek: game.currentWeek + 1, releasedByBrandId: brand.id });
        }
      });

      const releaseCandidate = nextBrand.rosterState
        .map((member) => ({ member, contract: nextBrand.contracts.find((contract) => contract.wrestlerId === member.wrestlerId) }))
        .filter(({ contract }) => contract && nextBrand.rosterWrestlerIds.length > 12)
        .sort((a, b) => (b.contract?.weeklySalary ?? 0) + b.member.fatigue * 120 - ((a.contract?.weeklySalary ?? 0) + a.member.fatigue * 120))[0];

      if (
        releaseCandidate?.contract &&
        releaseCandidate.contract.releasePenalty <= nextBrand.budget &&
        hashString(`${brand.id}-release-${game.seasonNumber}-${game.currentWeek}`) % 100 > getDifficultyRules(game.difficulty).cpuMarket.releaseRollThreshold
      ) {
        const wrestlerName = getWrestlerName(releaseCandidate.member.wrestlerId, draftPool, "CPU talent");
        const transaction = createTransaction(game, "release", [releaseCandidate.member.wrestlerId], [wrestlerName], releaseCandidate.contract.releasePenalty, `${brand.brandName} released ${wrestlerName} to clear payroll pressure.`, {
          fromBrandId: brand.id,
          fromBrandName: brand.brandName,
        });
        nextBrand = {
          ...nextBrand,
          budget: nextBrand.budget - releaseCandidate.contract.releasePenalty,
          rosterWrestlerIds: nextBrand.rosterWrestlerIds.filter((id) => id !== releaseCandidate.member.wrestlerId),
          rosterState: nextBrand.rosterState.filter((member) => member.wrestlerId !== releaseCandidate.member.wrestlerId),
          contracts: nextBrand.contracts.map((contract) => (contract.id === releaseCandidate.contract?.id ? { ...contract, contractStatus: "released", contractWeeksRemaining: 0 } : contract)),
          marketTransactions: [...nextBrand.marketTransactions, transaction],
        };
        ownedIds.delete(releaseCandidate.member.wrestlerId);
        cpuCooldowns.push({ wrestlerId: releaseCandidate.member.wrestlerId, availableWeek: game.currentWeek + 1, releasedByBrandId: brand.id });
      }

      return nextBrand;
    });

  const tradedBrands = maybeRunCpuTrade(game, marketBrands, draftPool);

  return {
    ...game,
    rivalBrands: tradedBrands,
    marketState: {
      ...game.marketState,
      cooldowns: [
        ...game.marketState.cooldowns.filter((cooldown) => !cpuCooldowns.some((item) => item.wrestlerId === cooldown.wrestlerId)),
        ...cpuCooldowns,
      ],
    },
  };
}

function getCpuTradeValue(wrestler: Wrestler, contract?: MarketContract) {
  return wrestler.popularity * 0.48 + wrestler.momentum * 0.22 + Math.max(wrestler.ringSkill, wrestler.promoSkill) * 0.2 - (contract?.weeklySalary ?? 0) / 4200;
}

function countBrandDivision(brand: RivalBrandState, draftPool: Wrestler[], division?: Wrestler["division"]) {
  return brand.rosterWrestlerIds.filter((id) => draftPool.find((wrestler) => wrestler.id === id)?.division === division).length;
}

function getCpuTradeCandidate(brand: RivalBrandState, targetBrand: RivalBrandState, draftPool: Wrestler[]) {
  return brand.rosterWrestlerIds
    .flatMap((wrestlerId) => {
      const wrestler = draftPool.find((item) => item.id === wrestlerId);
      const contract = brand.contracts.find((item) => item.wrestlerId === wrestlerId);

      return wrestler ? [{ wrestler, contract, value: getCpuTradeValue(wrestler, contract) }] : [];
    })
    .sort((a, b) => {
      const targetNeedsA = countBrandDivision(targetBrand, draftPool, a.wrestler.division) < 4 ? -12 : 0;
      const targetNeedsB = countBrandDivision(targetBrand, draftPool, b.wrestler.division) < 4 ? -12 : 0;
      const burdenA = (a.contract?.weeklySalary ?? 0) / 2500;
      const burdenB = (b.contract?.weeklySalary ?? 0) / 2500;

      return a.value + burdenA + targetNeedsA - (b.value + burdenB + targetNeedsB);
    })[0];
}

function maybeRunCpuTrade(game: GameState, brands: RivalBrandState[], draftPool: Wrestler[]) {
  const rules = getDifficultyRules(game.difficulty);

  if (brands.length < 2 || hashString(`cpu-trade-${game.seasonNumber}-${game.currentWeek}`) % 100 <= rules.cpuMarket.tradeRollThreshold) {
    return brands;
  }

  const seed = hashString(`${game.seasonNumber}-${game.currentWeek}-cpu-market-trade`);
  const fromIndex = seed % brands.length;
  const toIndex = (fromIndex + 1 + (seed % (brands.length - 1))) % brands.length;
  const fromBrand = brands[fromIndex];
  const toBrand = brands[toIndex];

  if (!fromBrand || !toBrand || fromBrand.rosterWrestlerIds.length <= 12 || toBrand.rosterWrestlerIds.length <= 12) {
    return brands;
  }

  const fromCandidate = getCpuTradeCandidate(fromBrand, toBrand, draftPool);
  const toCandidate = getCpuTradeCandidate(toBrand, fromBrand, draftPool);

  if (!fromCandidate || !toCandidate || fromCandidate.wrestler.id === toCandidate.wrestler.id) {
    return brands;
  }

  const valueGap = Math.abs(fromCandidate.value - toCandidate.value);
  const needFit =
    countBrandDivision(toBrand, draftPool, fromCandidate.wrestler.division) < 4 ||
    countBrandDivision(fromBrand, draftPool, toCandidate.wrestler.division) < 4;

  if (valueGap > (needFit ? 22 : 14) + rules.cpuMarket.tradeValueToleranceBonus) {
    return brands;
  }

  const transactionAmount = Math.round((fromCandidate.contract?.weeklySalary ?? 5000) * 0.35 + (toCandidate.contract?.weeklySalary ?? 5000) * 0.35);
  const transaction = createTransaction(
    game,
    "trade",
    [fromCandidate.wrestler.id, toCandidate.wrestler.id],
    [fromCandidate.wrestler.name, toCandidate.wrestler.name],
    transactionAmount,
    `${fromBrand.brandName} and ${toBrand.brandName} completed a market-balance trade: ${fromCandidate.wrestler.name} for ${toCandidate.wrestler.name}.`,
    {
      accepted: true,
      fromBrandId: fromBrand.id,
      fromBrandName: fromBrand.brandName,
      toBrandId: toBrand.id,
      toBrandName: toBrand.brandName,
    },
  );

  const moveContract = (contract: MarketContract | undefined, ownerBrandId: string, wrestler: Wrestler) =>
    contract
      ? { ...contract, ownerBrandId, acquisitionSource: "trade" as const }
      : createMarketContract(wrestler, "rival", ownerBrandId, "trade");

  const nextFromContract = moveContract(toCandidate.contract, fromBrand.id, toCandidate.wrestler);
  const nextToContract = moveContract(fromCandidate.contract, toBrand.id, fromCandidate.wrestler);

  return brands.map((brand) => {
    if (brand.id === fromBrand.id) {
      return {
        ...brand,
        budget: brand.budget - Math.round(transactionAmount / 2),
        rosterWrestlerIds: [...brand.rosterWrestlerIds.filter((id) => id !== fromCandidate.wrestler.id), toCandidate.wrestler.id],
        rosterState: brand.rosterState.map((member) =>
          member.wrestlerId === fromCandidate.wrestler.id
            ? {
                ...member,
                wrestlerId: toCandidate.wrestler.id,
                contractId: nextFromContract.id,
                acquisitionSource: "trade" as const,
                momentum: toCandidate.wrestler.momentum,
                morale: toCandidate.wrestler.morale,
                fatigue: toCandidate.wrestler.fatigue,
                injuryStatus: toCandidate.wrestler.injuryStatus,
                injuryWeeksRemaining: toCandidate.wrestler.injuryWeeksRemaining,
              }
            : member,
        ),
        contracts: [...brand.contracts.filter((contract) => contract.wrestlerId !== fromCandidate.wrestler.id && contract.wrestlerId !== toCandidate.wrestler.id), nextFromContract],
        marketTransactions: [...brand.marketTransactions, transaction],
      };
    }

    if (brand.id === toBrand.id) {
      return {
        ...brand,
        budget: brand.budget - Math.round(transactionAmount / 2),
        rosterWrestlerIds: [...brand.rosterWrestlerIds.filter((id) => id !== toCandidate.wrestler.id), fromCandidate.wrestler.id],
        rosterState: brand.rosterState.map((member) =>
          member.wrestlerId === toCandidate.wrestler.id
            ? {
                ...member,
                wrestlerId: fromCandidate.wrestler.id,
                contractId: nextToContract.id,
                acquisitionSource: "trade" as const,
                momentum: fromCandidate.wrestler.momentum,
                morale: fromCandidate.wrestler.morale,
                fatigue: fromCandidate.wrestler.fatigue,
                injuryStatus: fromCandidate.wrestler.injuryStatus,
                injuryWeeksRemaining: fromCandidate.wrestler.injuryWeeksRemaining,
              }
            : member,
        ),
        contracts: [...brand.contracts.filter((contract) => contract.wrestlerId !== fromCandidate.wrestler.id && contract.wrestlerId !== toCandidate.wrestler.id), nextToContract],
        marketTransactions: [...brand.marketTransactions, transaction],
      };
    }

    return brand;
  });
}

export function evaluateOfficeMandate(game: GameState): GameState {
  const rules = getDifficultyRules(game.difficulty);
  const latestResult = game.showHistory.filter((result) => result.seasonNumber === game.seasonNumber).at(-1);
  const playerRank = (() => {
    const playerAverage = game.showHistory.filter((result) => result.seasonNumber === game.seasonNumber).reduce((sum, result, _, results) => sum + result.totalScore / Math.max(1, results.length), 0);
    const entries = [{ id: "player", score: playerAverage }, ...game.rivalBrands.map((brand) => ({ id: brand.id, score: brand.seasonAverageScore }))].sort((a, b) => b.score - a.score);
    return entries.findIndex((entry) => entry.id === "player") + 1;
  })();
  const rankPenalty = playerRank >= 4 ? -5 : playerRank >= 3 ? -2 : 3;
  const moneyPenalty = game.money < 0 ? -4 : game.money < 150000 ? -2 : 2;
  const rosterPenalty = game.wrestlers.length < 10 ? -3 : game.wrestlers.length > 18 ? -1 : 1;
  const pleBonus = latestResult?.showType === "ple" && latestResult.totalScore >= 85 ? 3 : 0;
  const marketTransactionsThisWeek = game.marketState.transactions.filter((transaction) => transaction.seasonNumber === game.seasonNumber && transaction.weekNumber === game.currentWeek);
  const marketSpend = marketTransactionsThisWeek
    .filter((transaction) => transaction.type === "signing" || transaction.type === "renewal" || transaction.type === "trade")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const releaseCount = marketTransactionsThisWeek.filter((transaction) => transaction.type === "release").length;
  const marketPenaltyBase = marketSpend > 300000 ? -3 : marketSpend > 150000 ? -2 : releaseCount >= 2 ? -2 : releaseCount ? -1 : 0;
  const marketPenalty = scaleNegativePressure(marketPenaltyBase, rules.playerPressure.marketOfficePenaltyMultiplier);
  const ownerTrustDelta = scaleNegativePressure(rankPenalty + moneyPenalty + rosterPenalty + marketPenalty, rules.playerPressure.officeNegativeDeltaMultiplier) + pleBonus;
  const brandReputationDelta = scaleNegativePressure((latestResult ? Math.round((latestResult.totalScore - 75) / 6) : 0) + (playerRank === 1 ? 2 : playerRank >= 4 ? -3 : 0), rules.playerPressure.officeNegativeDeltaMultiplier);
  const office = game.marketState.officeMandate;
  const ownerTrust = clamp(office.ownerTrust + ownerTrustDelta);
  const brandReputation = clamp(office.brandReputation + brandReputationDelta);
  const mandateStatus: OfficeMandateStatus = ownerTrust <= 25 || brandReputation <= 25 || game.money < -250000 ? "critical" : ownerTrust >= 75 && brandReputation >= 70 ? "surging" : ownerTrust <= 45 || game.money < 0 ? "watch" : "stable";
  const moneyDelta = mandateStatus === "critical" ? -25000 : mandateStatus === "surging" ? 15000 : 0;
  const event: OfficeMandateEvent = {
    id: `mandate-s${game.seasonNumber}-w${game.currentWeek}`,
    seasonNumber: game.seasonNumber,
    weekNumber: game.currentWeek,
    status: mandateStatus,
    ownerTrustDelta,
    brandReputationDelta,
    moneyDelta,
    note:
      mandateStatus === "critical"
        ? `Ownership is pressing after rank #${playerRank}, money at ${game.money.toLocaleString()}, and a thin operating margin.`
        : mandateStatus === "surging"
          ? `Ownership is backing the room after rank #${playerRank} and strong brand momentum.`
          : mandateStatus === "watch"
            ? `Ownership is watching the ratings and market ledger after rank #${playerRank}.`
            : `Ownership logged a stable week at rank #${playerRank}.`,
  };

  return {
    ...game,
    money: game.money + moneyDelta,
    marketState: {
      ...game.marketState,
      officeMandate: {
        ownerTrust,
        brandReputation,
        mandateStatus,
        mandateHistory: [...office.mandateHistory.filter((item) => item.id !== event.id), event],
      },
    },
  };
}

export function getRivalMarketEvents(game: GameState) {
  return game.rivalBrands
    .flatMap((brand) => brand.marketTransactions.map((transaction) => ({ ...transaction, toBrandName: transaction.toBrandName ?? brand.brandName })))
    .sort((a, b) => b.weekNumber - a.weekNumber || b.id.localeCompare(a.id));
}

export function getMarketSnapshot(game: GameState, draftPool: Wrestler[]) {
  const weeklyBoard: WeeklyMarketBoard =
    game.marketState.weeklyBoard?.seasonNumber === game.seasonNumber && game.marketState.weeklyBoard.weekNumber === game.currentWeek
      ? game.marketState.weeklyBoard
      : {
          seasonNumber: game.seasonNumber,
          weekNumber: game.currentWeek,
          entries: getWeeklyBoardCandidates(game, draftPool)
            .slice(0, getWeeklyBoardCount(game))
            .map((wrestler) => ({
              wrestlerId: wrestler.id,
              status: "available" as const,
              weeklyAsk: getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, 12).weeklyAsk,
            })),
        };
  const freeAgents = weeklyBoard.entries
    .map((entry) => draftPool.find((wrestler) => wrestler.id === entry.wrestlerId))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
  const latestTransaction = [...game.marketState.transactions, ...getRivalMarketEvents(game)].sort((a, b) => b.weekNumber - a.weekNumber || b.id.localeCompare(a.id))[0];
  const payroll = getActivePlayerPayroll(game);
  const expiringContracts = game.marketState.playerContracts.filter((contract) => contract.contractStatus === "expiring").length;

  return {
    freeAgents,
    weeklyBoard,
    payroll,
    expiringContracts,
    latestTransaction,
    rosterLimit: playerRosterLimit,
    rivalTradeTargets: game.rivalBrands.flatMap((brand) =>
      brand.rosterWrestlerIds.slice(0, 6).flatMap((wrestlerId) => {
        const wrestler = draftPool.find((item) => item.id === wrestlerId);

        return wrestler
          ? [
              {
                brand,
                wrestler,
                contract: brand.contracts.find((contract) => contract.wrestlerId === wrestlerId),
              },
            ]
          : [];
      }),
    ),
  };
}

export function getCpuBudgetDefault() {
  return defaultCpuBudget;
}
