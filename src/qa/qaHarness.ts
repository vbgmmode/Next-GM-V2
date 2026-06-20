import { getCatalogOptionById } from "../game/matchFormatCatalog";
import { createNewGame, createRivalGMAssignments, defaultCareer, draftPool } from "../game/seed";
import { wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type { GameState, Segment, ShowResult, Wrestler } from "../game/types";
import { CURRENT_SAVE_VERSION, type SavedGameState } from "../game/migration";

export type QaHarnessMode = "runtime" | "legacy-runtime" | "title-defense-runtime" | "title-change-runtime";

const qaHarnessParam = "qa";
const tvReadyDraftRosterTarget = 12;

function buildSavedGameState(
  game: GameState,
  screen: SavedGameState["screen"],
  profileState?: Pick<SavedGameState, "profileReturnScreen" | "profileWrestlerId">,
): SavedGameState {
  return { saveVersion: CURRENT_SAVE_VERSION, game, screen, ...profileState };
}

export function getQaHarnessMode(): QaHarnessMode | null {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

  if (!env?.DEV) {
    return null;
  }

  const mode = new URLSearchParams(window.location.search).get(qaHarnessParam);
  return mode === "runtime" || mode === "legacy-runtime" || mode === "title-defense-runtime" || mode === "title-change-runtime" ? mode : null;
}

function getQaSegmentOption(id: string) {
  const option = getCatalogOptionById(id);

  if (!option) {
    throw new Error(`Missing QA segment catalog option: ${id}`);
  }

  return option;
}

function createQaSegment(id: string, catalogId: string, participantIds: string[], durationMinutes: number, championshipId?: string): Segment {
  const option = getQaSegmentOption(catalogId);

  return {
    id,
    type: option.family,
    participantIds,
    championshipId,
    segmentCatalogId: option.id,
    segmentDisplayName: option.label,
    durationMinutes,
    participantMin: option.minParticipants,
    participantMax: option.maxParticipants,
  };
}

function tuneQaTitleFixtureWrestler(wrestler: Wrestler, role: "champion-favorite" | "champion-underdog" | "challenger-favorite" | "challenger-underdog") {
  const favoriteStats = {
    popularity: 99,
    momentum: 99,
    ringSkill: 99,
    morale: 92,
    fatigue: 8,
  };
  const underdogStats = {
    popularity: 58,
    momentum: 45,
    ringSkill: 52,
    morale: 58,
    fatigue: 42,
  };
  const stats = role === "champion-favorite" || role === "challenger-favorite" ? favoriteStats : underdogStats;

  return {
    ...wrestler,
    ...stats,
    injuryStatus: "healthy" as const,
    injuryDescription: undefined,
    injuryWeeksRemaining: 0,
    injuryOccurredWeek: undefined,
  };
}

function buildQaTitlePayoffHarnessState(mode: "title-defense-runtime" | "title-change-runtime", baseGame: GameState): SavedGameState {
  const fixtureGame: GameState = {
    ...baseGame,
    brandName: mode === "title-defense-runtime" ? "QA Title Defense" : "QA Title Change",
    championships: baseGame.championships.map((championship) => ({ ...championship, championIds: [...championship.championIds] })),
    currentShow: [],
  };
  const title = fixtureGame.championships.find((championship) => {
    if (championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team") {
      return false;
    }

    return fixtureGame.wrestlers.filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship, fixtureGame.wrestlers)).length >= 2;
  });

  if (!title) {
    return buildSavedGameState(fixtureGame, "booking");
  }

  const eligibleWrestlers = fixtureGame.wrestlers.filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, title, fixtureGame.wrestlers));
  const champion = eligibleWrestlers[0];
  const challenger = eligibleWrestlers[1];
  const supportIds = fixtureGame.wrestlers
    .filter((wrestler) => wrestler.id !== champion.id && wrestler.id !== challenger.id)
    .slice(0, 3)
    .map((wrestler) => wrestler.id);

  fixtureGame.wrestlers = fixtureGame.wrestlers.map((wrestler) => {
    if (wrestler.id === champion.id) {
      return tuneQaTitleFixtureWrestler(wrestler, mode === "title-defense-runtime" ? "champion-favorite" : "champion-underdog");
    }

    if (wrestler.id === challenger.id) {
      return tuneQaTitleFixtureWrestler(wrestler, mode === "title-defense-runtime" ? "challenger-underdog" : "challenger-favorite");
    }

    return { ...wrestler, injuryStatus: "healthy" as const, injuryWeeksRemaining: 0 };
  });
  fixtureGame.championships = fixtureGame.championships.map((championship) =>
    championship.id === title.id
      ? {
          ...championship,
          championIds: [champion.id],
          contenderIds: [challenger.id],
          defenses: mode === "title-defense-runtime" ? 2 : 0,
          reignStartWeek: 1,
        }
      : championship,
  );
  fixtureGame.currentShow = [
    createQaSegment("qa-title-opener", "P001", [supportIds[0] ?? champion.id], 20),
    createQaSegment("qa-title-feature", "M001", [champion.id, challenger.id], 35, title.id),
    createQaSegment("qa-title-story", "A001", [supportIds[1] ?? challenger.id], 20),
    createQaSegment("qa-title-main", "P002", [supportIds[2] ?? champion.id], 20),
  ];

  return buildSavedGameState(fixtureGame, "booking");
}

export function buildQaRuntimeHarnessState(mode: QaHarnessMode): SavedGameState {
  const draftedWrestlers = draftPool.slice(0, tvReadyDraftRosterTarget);
  const game = createNewGame({
    ...defaultCareer,
    draftedWrestlers,
    brandName: "QA Runtime",
    brandStyle: "Raw",
    rivalGMAssignments: createRivalGMAssignments("Raw"),
  });

  if (mode === "title-defense-runtime" || mode === "title-change-runtime") {
    return buildQaTitlePayoffHarnessState(mode, game);
  }

  if (mode === "legacy-runtime") {
    const focusWrestler = game.wrestlers[0];
    const legacyResult: ShowResult = {
      id: "qa-legacy-runtime-result",
      seasonNumber: game.seasonNumber,
      week: game.currentWeek,
      brandName: game.brandName,
      showName: "Legacy Runtime TV",
      showType: "tv",
      totalScore: 82,
      segmentResults: [
        {
          segmentId: "qa-legacy-runtime-segment",
          type: "Promo",
          participantNames: [focusWrestler.name],
          participantIds: [focusWrestler.id],
          score: 82,
          momentumChanges: { [focusWrestler.id]: 4 },
          fatigueChanges: { [focusWrestler.id]: 2 },
          recapNote: `${focusWrestler.name} carried a legacy promo result without runtime fields.`,
        },
      ],
      biggestMomentumGain: { name: focusWrestler.name, amount: 4 },
      biggestFatigueIncrease: { name: focusWrestler.name, amount: 2 },
      titleNotes: [],
      rivalryNotes: [],
      titleHistoryEvents: [],
      rivalryHistoryEvents: [],
      lockerRoomFallout: {
        moraleDrops: [],
        moraleBoosts: [],
        overuseWarnings: [],
        underuseWarnings: [],
        injuryNotes: [],
      },
    };

    return buildSavedGameState({ ...game, showHistory: [legacyResult] }, "results");
  }

  return buildSavedGameState(game, "booking");
}
