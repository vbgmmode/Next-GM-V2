import { advanceGameWeek, startNextSeason } from "../game/advanceWeek";
import { SEASON_WEEK_COUNT } from "../game/constants";
import { CURRENT_SAVE_VERSION, type SavedGameState } from "../game/migration";
import { runShow } from "../game/scoring";
import { createNewGame, createRivalGMAssignments, defaultCareer, draftPool } from "../game/seed";
import type { GameState, Segment, Wrestler } from "../game/types";
import type { SaveRecordLike } from "../game/savePerformance";

export type SaveLatencyFixtureSnapshot = {
  label: string;
  resolvedShows: number;
  savedGame: SavedGameState;
};

const defaultTargets = [1, 10, 25, 50, 100, 250];
const tvReadyDraftRosterTarget = 12;

function createLatencyBaseGame() {
  return createNewGame({
    ...defaultCareer,
    draftedWrestlers: draftPool.slice(0, tvReadyDraftRosterTarget),
    brandName: "Latency Lab",
    brandStyle: "Raw",
    rivalGMAssignments: createRivalGMAssignments("Raw"),
  });
}

function ensureLatencyRoster(game: GameState): GameState {
  if (game.wrestlers.length >= 5) {
    return game;
  }

  return {
    ...game,
    wrestlers: draftPool.slice(0, tvReadyDraftRosterTarget),
  };
}

function availableRoster(game: GameState) {
  const healthy = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "major");
  return healthy.length >= 4 ? healthy : game.wrestlers;
}

function pickWrestler(roster: Wrestler[], index: number) {
  return roster[index % roster.length];
}

function buildLatencyShow(game: GameState, resolvedShows: number): Segment[] {
  const roster = availableRoster(game);
  const offset = resolvedShows * 3;
  const openerA = pickWrestler(roster, offset);
  const openerB = pickWrestler(roster, offset + 1);
  const promo = pickWrestler(roster, offset + 2);
  const mainA = pickWrestler(roster, offset + 3);
  const mainB = pickWrestler(roster, offset + 4);
  const prefix = `latency-s${game.seasonNumber}-w${game.currentWeek}`;

  return [
    {
      id: `${prefix}-opener`,
      type: "Match",
      participantIds: [openerA.id, openerB.id],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 24,
      participantMin: 2,
      participantMax: 2,
      winnerId: openerA.id,
    },
    {
      id: `${prefix}-promo`,
      type: "Promo",
      participantIds: [promo.id],
      segmentCatalogId: "P001",
      segmentDisplayName: "In-Ring Promo",
      durationMinutes: 12,
      participantMin: 1,
      participantMax: 1,
    },
    {
      id: `${prefix}-main`,
      type: "Match",
      participantIds: [mainA.id, mainB.id],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 24,
      participantMin: 2,
      participantMax: 2,
      winnerId: mainA.id,
    },
  ];
}

function toSavedGameState(game: GameState): SavedGameState {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    game,
    screen: "weekReview",
  };
}

function advanceForNextFixtureShow(game: GameState) {
  const advanced = advanceGameWeek(game);
  const nextGame = advanced.currentWeek >= SEASON_WEEK_COUNT ? startNextSeason(advanced) : advanced;
  return ensureLatencyRoster(nextGame);
}

export function buildSaveLatencyTimeline(targets = defaultTargets): SaveLatencyFixtureSnapshot[] {
  const sortedTargets = [...new Set(targets)].filter((target) => target > 0).sort((a, b) => a - b);
  const maxTarget = sortedTargets.at(-1) ?? 0;
  const targetSet = new Set(sortedTargets);
  const snapshots: SaveLatencyFixtureSnapshot[] = [];
  let game = createLatencyBaseGame();

  for (let resolvedShows = 1; resolvedShows <= maxTarget; resolvedShows += 1) {
    const showGame = ensureLatencyRoster(game);
    const resolved = runShow({
      ...showGame,
      currentShow: buildLatencyShow(showGame, resolvedShows - 1),
    });
    game = resolved.game;

    if (targetSet.has(resolvedShows)) {
      snapshots.push({
        label: resolvedShows === 1 ? "Week 1" : resolvedShows === 50 ? "Season 1 finale" : `${resolvedShows} resolved shows`,
        resolvedShows,
        savedGame: toSavedGameState(game),
      });
    }

    if (resolvedShows < maxTarget) {
      game = advanceForNextFixtureShow(game);
    }
  }

  return snapshots;
}

export function buildFullSaveSlotLatencyFixture(): SaveRecordLike[] {
  return buildSaveLatencyTimeline([1, 10, 25, 50, 100]).map((snapshot, index) => ({
    id: `latency-fixture-${index + 1}`,
    name: snapshot.label,
    state: snapshot.savedGame,
  }));
}
