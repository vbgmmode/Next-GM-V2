import { describe, expect, it } from "vitest";
import { affiliationCatalog } from "./affiliationCatalog";
import { advanceCpuRivalWeek } from "./cpuRivalLoop";
import {
  advancePlayerContracts,
  ensureWeeklyMarketBoard,
  evaluateOfficeMandate,
  getActivePlayerPayroll,
  getExternalMarketOffer,
  getMarketBundleOffers,
  getMarketNegotiationPersonality,
  getMarketOfferEvaluation,
  getPlayerTradeEvaluation,
  proposePlayerTrade,
  releasePlayerWrestler,
  renewPlayerContract,
  signPlayerFreeAgent,
  signPlayerFreeAgentBundle,
  submitPlayerMarketOffer,
} from "./market";
import { migrateSavedGameState } from "./migration";
import { createNewGame, draftPool } from "./seed";
import type { GameState, MarketContract, Segment, Wrestler } from "./types";

function withPlayerReferencePressure(game: GameState, wrestlerId: string): GameState {
  const otherWrestlerId = game.wrestlers.find((wrestler) => wrestler.id !== wrestlerId)?.id ?? game.wrestlers[0].id;
  const currentShow: Segment[] = [
    {
      id: "test-segment",
      type: "Match",
      participantIds: [wrestlerId, otherWrestlerId],
      participantMin: 2,
      participantMax: 2,
      durationMinutes: 12,
    },
  ];

  return {
    ...game,
    championships: game.championships.map((championship, index) =>
      index === 0
        ? {
            ...championship,
            championIds: [wrestlerId],
            contenderIds: [wrestlerId, otherWrestlerId],
          }
        : championship,
    ),
    rivalries: [
      ...game.rivalries,
      {
        id: "test-rivalry",
        name: "Test Rivalry",
        participantIds: [wrestlerId, otherWrestlerId],
        heat: 70,
        freshness: 70,
        weeksActive: 1,
        lastAdvancedWeek: 0,
        status: "rising",
        stakes: "personal",
      },
    ],
    currentShow,
  };
}

function expectNoPlayerReferences(game: GameState, wrestlerId: string) {
  expect(game.wrestlers.some((wrestler) => wrestler.id === wrestlerId)).toBe(false);
  expect(game.championships.some((championship) => championship.championIds.includes(wrestlerId))).toBe(false);
  expect(game.championships.some((championship) => championship.contenderIds?.includes(wrestlerId))).toBe(false);
  expect(game.rivalries.some((rivalry) => rivalry.participantIds.includes(wrestlerId))).toBe(false);
  expect(game.currentShow.some((segment) => segment.participantIds.includes(wrestlerId))).toBe(false);
}

function createBundleReadyGame(contractWeeks = 4) {
  const affiliation = affiliationCatalog.find(
    (item) => item.kind === "tag_team" && item.memberWrestlerIds.length === 2 && item.memberWrestlerIds.every((id) => draftPool.some((wrestler) => wrestler.id === id)),
  );

  expect(affiliation).toBeDefined();

  const baseGame = createNewGame();
  const memberIds = affiliation!.memberWrestlerIds;
  const bundleWrestlers = memberIds.map((id) => draftPool.find((wrestler) => wrestler.id === id)!);
  const game: GameState = {
    ...baseGame,
    money: 5000000,
    wrestlers: baseGame.wrestlers.filter((wrestler) => !memberIds.includes(wrestler.id)),
    rivalBrands: baseGame.rivalBrands.map((brand) => ({
      ...brand,
      rosterWrestlerIds: brand.rosterWrestlerIds.filter((id) => !memberIds.includes(id)),
      rosterState: brand.rosterState.filter((member) => !memberIds.includes(member.wrestlerId)),
      contracts: brand.contracts.filter((contract) => !memberIds.includes(contract.wrestlerId)),
    })),
    marketState: {
      ...baseGame.marketState,
      weeklyBoard: {
        seasonNumber: baseGame.seasonNumber,
        weekNumber: baseGame.currentWeek,
        entries: bundleWrestlers.map((wrestler) => ({
          wrestlerId: wrestler.id,
          status: "available" as const,
          weeklyAsk: getExternalMarketOffer(wrestler, baseGame.seasonNumber, baseGame.currentWeek, contractWeeks).weeklyAsk,
        })),
      },
    },
  };

  return { affiliation: affiliation!, game, memberIds, wrestlers: bundleWrestlers };
}

function createSingleBoardOfferGame(wrestler: Wrestler, money = 5000000) {
  const baseGame = createNewGame();
  const game: GameState = {
    ...baseGame,
    money,
    wrestlers: baseGame.wrestlers.filter((item) => item.id !== wrestler.id),
    rivalBrands: baseGame.rivalBrands.map((brand) => ({
      ...brand,
      rosterWrestlerIds: brand.rosterWrestlerIds.filter((id) => id !== wrestler.id),
      rosterState: brand.rosterState.filter((member) => member.wrestlerId !== wrestler.id),
      contracts: brand.contracts.filter((contract) => contract.wrestlerId !== wrestler.id),
    })),
    marketState: {
      ...baseGame.marketState,
      weeklyBoard: {
        seasonNumber: baseGame.seasonNumber,
        weekNumber: baseGame.currentWeek,
        entries: [
          {
            wrestlerId: wrestler.id,
            status: "available" as const,
            weeklyAsk: getExternalMarketOffer(wrestler, baseGame.seasonNumber, baseGame.currentWeek, 12).weeklyAsk,
          },
        ],
      },
    },
  };

  return game;
}

function getDraftPoolWrestlerByPersonality(personality: ReturnType<typeof getMarketNegotiationPersonality>) {
  const wrestler = draftPool.find((candidate) => getMarketNegotiationPersonality(candidate) === personality);
  expect(wrestler).toBeDefined();
  return wrestler!;
}

describe("market ownership invariants", () => {
  it("cleans player title, rivalry, and card references on release", () => {
    const baseGame = createNewGame();
    const wrestlerId = baseGame.wrestlers[0].id;
    const game = withPlayerReferencePressure(baseGame, wrestlerId);

    const updatedGame = releasePlayerWrestler(game, wrestlerId);

    expectNoPlayerReferences(updatedGame, wrestlerId);
    expect(updatedGame.marketState.transactions.at(-1)?.type).toBe("release");
    expect(updatedGame.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestlerId)?.contractStatus).toBe("released");
  });

  it("cleans outgoing player references on accepted trade", () => {
    const baseGame = createNewGame();
    const outgoingId = baseGame.wrestlers[0].id;
    const game = withPlayerReferencePressure(baseGame, outgoingId);
    const allTargets = game.rivalBrands.flatMap((brand) => brand.rosterWrestlerIds);
    const acceptedTrade = allTargets
      .map((targetId) => proposePlayerTrade(game, outgoingId, targetId, draftPool))
      .find((candidate) => candidate.marketState.transactions.at(-1)?.accepted);

    expect(acceptedTrade).toBeDefined();

    const updatedGame = acceptedTrade as GameState;
    const trade = updatedGame.marketState.transactions.at(-1);
    const incomingId = trade?.wrestlerIds.find((id) => id !== outgoingId);

    expectNoPlayerReferences(updatedGame, outgoingId);
    expect(incomingId && updatedGame.wrestlers.some((wrestler) => wrestler.id === incomingId)).toBe(true);
    expect(updatedGame.rivalBrands.some((brand) => brand.rosterState.some((member) => member.wrestlerId === outgoingId && member.acquisitionSource === "trade"))).toBe(true);
  });

  it("uses the same deterministic trade read as the player trade resolver", () => {
    const game = createNewGame();
    const outgoingId = game.wrestlers[0].id;
    const targetId = game.rivalBrands.flatMap((brand) => brand.rosterWrestlerIds)[0];

    const evaluation = getPlayerTradeEvaluation(game, outgoingId, targetId, draftPool);
    const updatedGame = proposePlayerTrade(game, outgoingId, targetId, draftPool);

    expect(evaluation).toBeDefined();
    expect(updatedGame.marketState.transactions.at(-1)?.accepted).toBe(evaluation?.accepted);
    expect(evaluation?.read).toMatch(/Rival Wants This|Strong Fit|Workable|Long Shot|No Traction/);
    expect(evaluation?.contextReads.length).toBeGreaterThan(1);
  });

  it("cleans expired player contracts without release fees", () => {
    const baseGame = createNewGame();
    const wrestlerId = baseGame.wrestlers[0].id;
    const game = withPlayerReferencePressure(
      {
        ...baseGame,
        marketState: {
          ...baseGame.marketState,
          playerContracts: baseGame.marketState.playerContracts.map((contract): MarketContract =>
            contract.wrestlerId === wrestlerId ? { ...contract, contractWeeksRemaining: 1, contractStatus: "active" } : contract,
          ),
        },
      },
      wrestlerId,
    );

    const updatedGame = advancePlayerContracts(game);

    expectNoPlayerReferences(updatedGame, wrestlerId);
    expect(updatedGame.marketState.transactions.at(-1)).toMatchObject({ type: "expiry", amount: 0 });
    expect(updatedGame.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestlerId)?.contractStatus).toBe("expired");
  });

  it("keeps CPU weekly recovery separate from market signing", () => {
    const game = createNewGame();
    const beforeRosterCounts = game.rivalBrands.map((brand) => brand.rosterWrestlerIds.length);
    const beforeMarketEvents = game.rivalBrands.map((brand) => brand.marketTransactions.length + brand.freeAgentClaims.length);

    const recoveredBrands = advanceCpuRivalWeek(game);

    expect(recoveredBrands.map((brand) => brand.rosterWrestlerIds.length)).toEqual(beforeRosterCounts);
    expect(recoveredBrands.map((brand) => brand.marketTransactions.length + brand.freeAgentClaims.length)).toEqual(beforeMarketEvents);
  });

  it("migrates older saves with market defaults", () => {
    const game = createNewGame();
    const legacyState = {
      game: {
        ...game,
        marketState: undefined,
      },
      screen: "market",
    };

    const migrated = migrateSavedGameState(legacyState);

    expect(migrated?.screen).toBe("market");
    expect(migrated?.game.marketState.playerContracts).toHaveLength(game.wrestlers.length);
    expect(migrated?.game.marketState.playerContracts.every((contract) => contract.acquisitionSource !== "draft" || contract.paymentModel === "prepaid")).toBe(true);
    expect(migrated?.game.marketState.officeMandate.mandateStatus).toBe("stable");
  });

  it("treats drafted roster contracts as prepaid instead of weekly payroll", () => {
    const game = createNewGame();

    expect(game.marketState.playerContracts.every((contract) => contract.acquisitionSource !== "draft" || contract.paymentModel === "prepaid")).toBe(true);
    expect(game.marketState.playerContracts.every((contract) => contract.acquisitionSource !== "draft" || contract.releasePenalty === 0)).toBe(true);
    expect(getActivePlayerPayroll(game)).toBe(0);
  });

  it("does not let office mandate evaluation directly change player cash", () => {
    const game: GameState = {
      ...createNewGame(),
      money: 90000,
      marketState: {
        ...createNewGame().marketState,
        officeMandate: {
          ownerTrust: 20,
          brandReputation: 20,
          mandateStatus: "critical",
          mandateHistory: [],
        },
      },
    };

    const updatedGame = evaluateOfficeMandate(game);

    expect(updatedGame.money).toBe(game.money);
    expect(updatedGame.marketState.officeMandate.mandateHistory.at(-1)?.moneyDelta).toBe(0);
  });

  it("creates a fixed weekly board with no more than six entries", () => {
    const game = createNewGame();
    const board = game.marketState.weeklyBoard;

    expect(board?.seasonNumber).toBe(game.seasonNumber);
    expect(board?.weekNumber).toBe(game.currentWeek);
    expect(board?.entries.length).toBeLessThanOrEqual(6);
    board?.entries
      .filter((entry) => entry.status === "rival_signed")
      .forEach((entry) => {
        expect(game.rivalBrands.some((brand) => brand.id === entry.rivalBrandId && brand.rosterWrestlerIds.includes(entry.wrestlerId))).toBe(true);
      });
  });

  it("only signs talent from the weekly board and marks the row signed by the player", () => {
    const baseGame = createNewGame();
    const game = Array.from({ length: 12 }, (_, index) => index + 1)
      .map((week) =>
        ensureWeeklyMarketBoard(
          {
            ...baseGame,
            currentWeek: week,
            marketState: { ...baseGame.marketState, weeklyBoard: undefined },
          },
          draftPool,
        ),
      )
      .find((candidate) => candidate.marketState.weeklyBoard?.entries.some((entry) => entry.status === "available")) as GameState | undefined;

    expect(game).toBeDefined();

    const availableEntry = game?.marketState.weeklyBoard?.entries.find((entry) => entry.status === "available");
    const wrestler = draftPool.find((item) => item.id === availableEntry?.wrestlerId);

    expect(availableEntry).toBeDefined();
    expect(wrestler).toBeDefined();

    const offer = getExternalMarketOffer(wrestler!, game!.seasonNumber, game!.currentWeek, 3);
    const updatedGame = signPlayerFreeAgent(game!, wrestler!.id, draftPool, 3);

    expect(updatedGame.money).toBe(game!.money - offer.dueNow);
    expect(updatedGame.wrestlers.some((item) => item.id === wrestler!.id)).toBe(true);
    expect(updatedGame.marketState.weeklyBoard?.entries.find((entry) => entry.wrestlerId === wrestler!.id)?.status).toBe("player_signed");
    expect(updatedGame.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestler!.id)).toMatchObject({
      contractWeeksRemaining: 3,
      paymentModel: "prepaid",
      releasePenalty: 0,
    });
  });

  it("accepts a strong submitted market offer and signs the wrestler", () => {
    const wrestler = getDraftPoolWrestlerByPersonality("money_first");
    const game = createSingleBoardOfferGame(wrestler);
    const baseline = getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, 52);
    const weeklySalary = Math.round(baseline.weeklyAsk * 1.8);
    const updatedGame = submitPlayerMarketOffer(game, wrestler.id, draftPool, 52, weeklySalary);

    expect(updatedGame.money).toBe(game.money - weeklySalary * 52);
    expect(updatedGame.wrestlers.some((item) => item.id === wrestler.id)).toBe(true);
    expect(updatedGame.marketState.weeklyBoard?.entries.find((entry) => entry.wrestlerId === wrestler.id)).toMatchObject({
      status: "player_signed",
      offer: {
        outcome: "accepted",
        weeklySalary,
        contractWeeks: 52,
      },
    });
    expect(updatedGame.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestler.id)).toMatchObject({
      weeklySalary,
      contractWeeksRemaining: 52,
      paymentModel: "prepaid",
    });
  });

  it("declines a weak submitted market offer without charging money or allowing a second offer", () => {
    const wrestler = getDraftPoolWrestlerByPersonality("security_seeker");
    const game = createSingleBoardOfferGame(wrestler);
    const updatedGame = submitPlayerMarketOffer(game, wrestler.id, draftPool, 1, 1000);
    const secondAttempt = submitPlayerMarketOffer(updatedGame, wrestler.id, draftPool, 52, 100000);

    expect(updatedGame.money).toBe(game.money);
    expect(updatedGame.wrestlers.some((item) => item.id === wrestler.id)).toBe(false);
    expect(updatedGame.marketState.weeklyBoard?.entries.find((entry) => entry.wrestlerId === wrestler.id)?.status).toBe("offer_declined");
    expect(updatedGame.marketState.transactions.at(-1)).toMatchObject({
      accepted: false,
      amount: 0,
      type: "signing",
    });
    expect(secondAttempt).toBe(updatedGame);
  });

  it("resolves the same submitted market offer deterministically", () => {
    const wrestler = getDraftPoolWrestlerByPersonality("spotlight_driven");
    const game = createSingleBoardOfferGame(wrestler);
    const offer = getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, 24);
    const first = submitPlayerMarketOffer(game, wrestler.id, draftPool, 24, offer.weeklyAsk);
    const second = submitPlayerMarketOffer(game, wrestler.id, draftPool, 24, offer.weeklyAsk);

    expect(first.money).toBe(second.money);
    expect(first.marketState.weeklyBoard?.entries.find((entry) => entry.wrestlerId === wrestler.id)).toEqual(
      second.marketState.weeklyBoard?.entries.find((entry) => entry.wrestlerId === wrestler.id),
    );
    expect(first.marketState.transactions.at(-1)?.note).toBe(second.marketState.transactions.at(-1)?.note);
  });

  it("weights negotiation personalities differently", () => {
    const game = createNewGame();
    const moneyFirst = getDraftPoolWrestlerByPersonality("money_first");
    const securitySeeker = getDraftPoolWrestlerByPersonality("security_seeker");
    const moneyBaseline = getExternalMarketOffer(moneyFirst, game.seasonNumber, game.currentWeek, 8);
    const securityBaseline = getExternalMarketOffer(securitySeeker, game.seasonNumber, game.currentWeek, 8);
    const moneyShortOffer = getMarketOfferEvaluation(game, moneyFirst, { contractWeeks: 8, weeklySalary: Math.round(moneyBaseline.weeklyAsk * 1.5) });
    const moneyLongOffer = getMarketOfferEvaluation(game, moneyFirst, { contractWeeks: 52, weeklySalary: moneyBaseline.weeklyAsk });
    const securityShortOffer = getMarketOfferEvaluation(game, securitySeeker, { contractWeeks: 8, weeklySalary: Math.round(securityBaseline.weeklyAsk * 1.5) });
    const securityLongOffer = getMarketOfferEvaluation(game, securitySeeker, { contractWeeks: 52, weeklySalary: securityBaseline.weeklyAsk });

    expect(moneyShortOffer.baseScore).toBeGreaterThan(moneyLongOffer.baseScore);
    expect(securityLongOffer.baseScore).toBeGreaterThan(securityShortOffer.baseScore);
  });

  it("blocks submitted market offers the player cannot afford", () => {
    const wrestler = getDraftPoolWrestlerByPersonality("momentum_chaser");
    const game = createSingleBoardOfferGame(wrestler, 1000);
    const updatedGame = submitPlayerMarketOffer(game, wrestler.id, draftPool, 52, 100000);

    expect(updatedGame).toBe(game);
  });

  it("hydrates match ratings when signing from an arbitrary draft pool", () => {
    const rawDraftPool = draftPool.map((wrestler) => {
      const { matchRatings, ...withoutRatings } = wrestler;
      void matchRatings;
      return withoutRatings as Wrestler;
    });
    const baseGame = createNewGame();
    const game = Array.from({ length: 12 }, (_, index) => index + 1)
      .map((week) =>
        ensureWeeklyMarketBoard(
          {
            ...baseGame,
            currentWeek: week,
            marketState: { ...baseGame.marketState, weeklyBoard: undefined },
          },
          rawDraftPool,
        ),
      )
      .find((candidate) => candidate.marketState.weeklyBoard?.entries.some((entry) => entry.status === "available")) as GameState | undefined;
    const availableEntry = game?.marketState.weeklyBoard?.entries.find((entry) => entry.status === "available");

    expect(game).toBeDefined();
    expect(availableEntry).toBeDefined();

    const updatedGame = signPlayerFreeAgent(game!, availableEntry!.wrestlerId, rawDraftPool, 3);

    expect(updatedGame.wrestlers.find((wrestler) => wrestler.id === availableEntry!.wrestlerId)?.matchRatings).toBeDefined();
  });

  it("builds tag and faction bundle offers from available board members with a 20% package discount", () => {
    const contractWeeks = 4;
    const { affiliation, game, wrestlers } = createBundleReadyGame(contractWeeks);
    const offer = getMarketBundleOffers(game, draftPool, contractWeeks).find((item) => item.affiliationId === affiliation.id);
    const fullDueNow = wrestlers.reduce((sum, wrestler) => sum + getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, contractWeeks).dueNow, 0);
    const discountedDueNow = wrestlers.reduce((sum, wrestler) => sum + Math.round(getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, contractWeeks).dueNow * 0.8), 0);

    expect(offer).toBeDefined();
    expect(offer?.wrestlerIds).toEqual(wrestlers.map((wrestler) => wrestler.id));
    expect(offer?.fullDueNow).toBe(fullDueNow);
    expect(offer?.discountedDueNow).toBe(discountedDueNow);
    expect(offer?.discountAmount).toBe(fullDueNow - discountedDueNow);
  });

  it("signs every member in a market bundle as one discounted package transaction", () => {
    const contractWeeks = 4;
    const { affiliation, game, memberIds, wrestlers } = createBundleReadyGame(contractWeeks);
    const expectedDueNow = wrestlers.reduce((sum, wrestler) => sum + Math.round(getExternalMarketOffer(wrestler, game.seasonNumber, game.currentWeek, contractWeeks).dueNow * 0.8), 0);

    const updatedGame = signPlayerFreeAgentBundle(game, affiliation.id, draftPool, contractWeeks);
    const transaction = updatedGame.marketState.transactions.at(-1);

    expect(updatedGame.money).toBe(game.money - expectedDueNow);
    memberIds.forEach((wrestlerId) => {
      expect(updatedGame.wrestlers.some((wrestler) => wrestler.id === wrestlerId)).toBe(true);
      expect(updatedGame.marketState.weeklyBoard?.entries.find((entry) => entry.wrestlerId === wrestlerId)?.status).toBe("player_signed");
      expect(updatedGame.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestlerId)).toMatchObject({
        contractWeeksRemaining: contractWeeks,
        paymentModel: "prepaid",
        releasePenalty: 0,
      });
    });
    expect(transaction).toMatchObject({
      type: "signing",
      wrestlerIds: memberIds,
      amount: expectedDueNow,
    });
    expect(transaction?.note).toContain("20% bundle discount");
  });

  it("extends active contracts with prepaid renewal cash", () => {
    const game = createNewGame();
    const wrestler = game.wrestlers[0];
    const updatedGame = renewPlayerContract(game, wrestler.id, 5);
    const beforeContract = game.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestler.id);
    const afterContract = updatedGame.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestler.id);

    expect(afterContract?.contractWeeksRemaining).toBe(52);
    expect(afterContract?.paymentModel).toBe("prepaid");
    expect(updatedGame.money).toBeLessThan(game.money);
    expect(updatedGame.marketState.transactions.at(-1)?.type).toBe("renewal");
  });
});
