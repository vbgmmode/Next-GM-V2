import { describe, expect, it } from "vitest";
import { advanceCpuRivalWeek } from "./cpuRivalLoop";
import { advancePlayerContracts, ensureWeeklyMarketBoard, getExternalMarketOffer, proposePlayerTrade, releasePlayerWrestler, renewPlayerContract, signPlayerFreeAgent } from "./market";
import { migrateSavedGameState } from "./migration";
import { createNewGame, draftPool } from "./seed";
import type { GameState, MarketContract, Segment } from "./types";

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
    expect(migrated?.game.marketState.officeMandate.mandateStatus).toBe("stable");
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

  it("extends active contracts with prepaid renewal cash", () => {
    const game = createNewGame();
    const wrestler = game.wrestlers[0];
    const updatedGame = renewPlayerContract(game, wrestler.id, 5);
    const beforeContract = game.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestler.id);
    const afterContract = updatedGame.marketState.playerContracts.find((contract) => contract.wrestlerId === wrestler.id);

    expect(afterContract?.contractWeeksRemaining).toBe((beforeContract?.contractWeeksRemaining ?? 0) + 5);
    expect(afterContract?.paymentModel).toBe("prepaid");
    expect(updatedGame.money).toBeLessThan(game.money);
    expect(updatedGame.marketState.transactions.at(-1)?.type).toBe("renewal");
  });
});
