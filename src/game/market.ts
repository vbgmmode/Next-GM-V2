import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import type {
  GameState,
  MarketContract,
  MarketState,
  MarketTransaction,
  OfficeMandateEvent,
  OfficeMandateState,
  OfficeMandateStatus,
  RivalBrandState,
  Wrestler,
} from "./types";

const playerRosterLimit = 20;
const cpuRosterLimit = 18;
const defaultContractWeeks = 12;
const defaultCpuBudget = 1800000;

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
): MarketContract {
  const value = getMoneyValue(wrestler);
  const contractWeeksRemaining = Math.max(1, weeks ?? value.defaultWeeks);

  return {
    id: `${ownerType}-${ownerBrandId ?? "pool"}-${wrestler.id}-contract`,
    wrestlerId: wrestler.id,
    ownerType,
    ownerBrandId,
    contractWeeksRemaining,
    weeklySalary: value.weeklySalary,
    releasePenalty: value.releasePenalty,
    acquisitionSource,
    contractStatus: contractWeeksRemaining <= 3 ? "expiring" : "active",
    renewalRisk: value.renewalRisk,
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

export function getContractForWrestler(game: GameState, wrestlerId: string) {
  return game.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestlerId && contract.contractStatus !== "released");
}

export function getActivePlayerPayroll(game: GameState) {
  return game.marketState.playerContracts
    .filter((contract) => contract.contractStatus === "active" || contract.contractStatus === "expiring")
    .reduce((sum, contract) => sum + contract.weeklySalary, 0);
}

export function getMarketTransactionCostsForWeek(game: GameState, seasonNumber = game.seasonNumber, weekNumber = game.currentWeek) {
  return game.marketState.transactions
    .filter((transaction) => transaction.seasonNumber === seasonNumber && transaction.weekNumber === weekNumber && transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
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
  const wrestler = getAvailableFreeAgents(game, draftPool).find((item) => item.id === wrestlerId);

  if (!wrestler || game.wrestlers.length >= playerRosterLimit) {
    return game;
  }

  const value = getMoneyValue(wrestler);
  const contractWeeks = Math.max(value.minWeeks, Math.min(value.maxWeeks, requestedWeeks ?? value.defaultWeeks));
  const contract = createMarketContract(wrestler, "player", "player", "free_agent", contractWeeks);
  const signingCost = contract.weeklySalary * contract.contractWeeksRemaining;
  const transaction = createTransaction(game, "signing", [wrestler.id], [wrestler.name], signingCost, `${game.brandName} signed ${wrestler.name} for ${contract.contractWeeksRemaining} weeks.`);

  return {
    ...game,
    money: game.money - signingCost,
    wrestlers: [
      ...game.wrestlers,
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
      ...game.marketState,
      playerContracts: [...game.marketState.playerContracts.filter((item) => item.wrestlerId !== wrestler.id), contract],
      transactions: [...game.marketState.transactions, transaction],
    },
  };
}

export function releasePlayerWrestler(game: GameState, wrestlerId: string): GameState {
  const wrestler = game.wrestlers.find((item) => item.id === wrestlerId);
  const contract = getContractForWrestler(game, wrestlerId);

  if (!wrestler || game.wrestlers.length <= 8) {
    return game;
  }

  const releasePenalty = contract?.releasePenalty ?? getMoneyValue(wrestler).releasePenalty;
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
  const contractStatus = contractWeeksRemaining <= 0 ? "expired" : contractWeeksRemaining <= 3 ? "expiring" : "active";

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
        const shouldRenew = wrestler ? wrestler.popularity + wrestler.momentum + (hashString(`${brand.id}-${wrestler.id}-renew-${game.currentWeek}`) % 20) >= 145 : false;
        const transaction = createTransaction(
          game,
          shouldRenew ? "renewal" : "expiry",
          [contract.wrestlerId],
          [wrestler?.name ?? "CPU talent"],
          shouldRenew ? contract.weeklySalary * defaultContractWeeks : 0,
          shouldRenew ? `${brand.brandName} renewed ${wrestler?.name ?? "a roster piece"}.` : `${brand.brandName} let ${wrestler?.name ?? "a roster piece"} hit the market.`,
          { toBrandId: brand.id, toBrandName: brand.brandName },
        );

        nextBrand = shouldRenew
          ? {
              ...nextBrand,
              contracts: nextBrand.contracts.map((item) => (item.id === contract.id ? { ...item, contractWeeksRemaining: defaultContractWeeks, contractStatus: "active", acquisitionSource: "renewal" } : item)),
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

      if (releaseCandidate?.contract && hashString(`${brand.id}-release-${game.seasonNumber}-${game.currentWeek}`) % 100 > 76) {
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

      const available = draftPool.filter((wrestler) => !ownedIds.has(wrestler.id) && nextBrand.rosterWrestlerIds.length < cpuRosterLimit);
      const shouldSign = available.length && hashString(`${brand.id}-market-sign-${game.seasonNumber}-${game.currentWeek}`) % 100 > 68;
      if (shouldSign) {
        const signing = [...available].sort((a, b) => b.popularity + b.momentum - (a.popularity + a.momentum))[0];
        const contract = createMarketContract(signing, "rival", brand.id, "free_agent");
        const amount = contract.weeklySalary * contract.contractWeeksRemaining;
        const transaction = createTransaction(game, "signing", [signing.id], [signing.name], amount, `${brand.brandName} signed ${signing.name} from the open market.`, {
          toBrandId: brand.id,
          toBrandName: brand.brandName,
        });
        const claim = {
          id: `${transaction.id}-claim`,
          seasonNumber: game.seasonNumber,
          weekNumber: game.currentWeek,
          wrestlerId: signing.id,
          wrestlerName: signing.name,
          brandName: brand.brandName,
          note: transaction.note,
        };
        ownedIds.add(signing.id);
        nextBrand = {
          ...nextBrand,
          budget: nextBrand.budget - amount,
          rosterWrestlerIds: [...nextBrand.rosterWrestlerIds, signing.id],
          rosterState: [
            ...nextBrand.rosterState,
            {
              wrestlerId: signing.id,
              contractId: contract.id,
              acquisitionSource: "free_agent",
              acquiredSeasonNumber: game.seasonNumber,
              acquiredWeekNumber: game.currentWeek,
              momentum: signing.momentum,
              morale: signing.morale,
              fatigue: signing.fatigue,
              appearancesThisSeason: 0,
              lastBookedWeek: 0,
              consecutiveWeeksBooked: 0,
              injuryStatus: signing.injuryStatus,
              injuryWeeksRemaining: signing.injuryWeeksRemaining,
            },
          ],
          contracts: [...nextBrand.contracts, contract],
          freeAgentClaims: [...nextBrand.freeAgentClaims, claim],
          marketTransactions: [...nextBrand.marketTransactions, transaction],
          activityHistory: [
            ...nextBrand.activityHistory,
            {
              id: `${transaction.id}-activity`,
              seasonNumber: game.seasonNumber,
              weekNumber: game.currentWeek,
              label: "Free Agent Signing",
              note: transaction.note,
            },
          ],
        };
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
  if (brands.length < 2 || hashString(`cpu-trade-${game.seasonNumber}-${game.currentWeek}`) % 100 <= 58) {
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

  if (valueGap > (needFit ? 22 : 14)) {
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
  const ownerTrustDelta = rankPenalty + moneyPenalty + rosterPenalty + pleBonus;
  const brandReputationDelta = (latestResult ? Math.round((latestResult.totalScore - 75) / 6) : 0) + (playerRank === 1 ? 2 : playerRank >= 4 ? -3 : 0);
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
  const freeAgents = getAvailableFreeAgents(game, draftPool);
  const latestTransaction = [...game.marketState.transactions, ...getRivalMarketEvents(game)].sort((a, b) => b.weekNumber - a.weekNumber || b.id.localeCompare(a.id))[0];
  const payroll = getActivePlayerPayroll(game);
  const expiringContracts = game.marketState.playerContracts.filter((contract) => contract.contractStatus === "expiring").length;

  return {
    freeAgents,
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
