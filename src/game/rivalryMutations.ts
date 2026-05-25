import { createUniqueDomainId } from "./domainIds";
import { applyRivalryCatalogDefaults, getDefaultStorylineIdForStakes, getRivalryStoryline } from "./rivalryCatalog";
import { getRivalryStatus, getWrestlerDivisionGroup } from "./scoring";
import type { GameState, Rivalry, RivalryHistoryEvent, RivalryStakes, RivalryStructure, Wrestler } from "./types";

export type RivalryCreateCommand = {
  participantIds: string[];
  structure: RivalryStructure;
  stakes: RivalryStakes;
  storylineId?: string;
};

export function getRivalryStructureParticipantRange(structure: RivalryStructure) {
  if (structure === "tag_team") {
    return { min: 4, max: 4 };
  }

  if (structure === "multi_person") {
    return { min: 3, max: 3 };
  }

  return { min: 2, max: 2 };
}

function getRivalryStructure(rivalry: Rivalry): RivalryStructure {
  return rivalry.structure ?? "singles";
}

function getRivalryStructureKey(structure: RivalryStructure, participantIds: string[]) {
  if (structure === "tag_team" && participantIds.length === 4) {
    const firstSide = participantIds.slice(0, 2).sort().join("+");
    const secondSide = participantIds.slice(2, 4).sort().join("+");
    return [firstSide, secondSide].sort().join("|");
  }

  return [...participantIds].sort().join("|");
}

export function hasDuplicateRivalry(rivalries: Rivalry[], structure: RivalryStructure, participantIds: string[]) {
  const key = getRivalryStructureKey(structure, participantIds);
  return rivalries.some((rivalry) => getRivalryStructureKey(getRivalryStructure(rivalry), rivalry.participantIds) === key);
}

function canRivalryParticipantsShareMatch(wrestlers: Wrestler[]) {
  const groups = new Set(
    wrestlers
      .map((wrestler) => getWrestlerDivisionGroup(wrestler))
      .filter((group): group is "mens" | "womens" => Boolean(group)),
  );

  return groups.size <= 1;
}

function formatRivalryStakes(stakes: RivalryStakes) {
  return stakes.charAt(0).toUpperCase() + stakes.slice(1);
}

function getInitialRivalryHeat(wrestlers: Wrestler[]) {
  if (!wrestlers.length) {
    return 50;
  }

  return Math.round(wrestlers.reduce((total, wrestler) => total + wrestler.popularity + wrestler.momentum, 0) / (wrestlers.length * 2));
}

function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}

function buildRivalryName(structure: RivalryStructure, participantIds: string[], participants: Wrestler[], wrestlers: Wrestler[]) {
  if (structure === "tag_team" && participantIds.length === 4) {
    return `${getWrestlerNames(participantIds.slice(0, 2), wrestlers)} vs ${getWrestlerNames(participantIds.slice(2, 4), wrestlers)}`;
  }

  if (structure === "multi_person") {
    return `${getWrestlerNames(participantIds, wrestlers)} collision`;
  }

  return `${participants[0].name} vs ${participants[1].name}`;
}

export function createRivalryInGame(game: GameState, command: RivalryCreateCommand): GameState {
  const selectedIds = command.participantIds.filter(Boolean);
  const range = getRivalryStructureParticipantRange(command.structure);

  if (
    selectedIds.length < range.min ||
    selectedIds.length > range.max ||
    new Set(selectedIds).size !== selectedIds.length ||
    hasDuplicateRivalry(game.rivalries, command.structure, selectedIds)
  ) {
    return game;
  }

  const participants = selectedIds
    .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  if (participants.length !== selectedIds.length || !canRivalryParticipantsShareMatch(participants)) {
    return game;
  }

  const heat = getInitialRivalryHeat(participants);
  const rivalryId = createUniqueDomainId(
    "rivalry",
    [game.seasonNumber, game.currentWeek, command.structure, command.stakes, ...selectedIds],
    game.rivalries.map((rivalry) => rivalry.id),
  );
  const selectedStorylineId = command.storylineId ?? getDefaultStorylineIdForStakes(command.stakes);
  const storyline = getRivalryStoryline({ stakes: command.stakes, storylineId: selectedStorylineId });
  const rivalryName = buildRivalryName(command.structure, selectedIds, participants, game.wrestlers);
  const rivalry = applyRivalryCatalogDefaults({
    id: rivalryId,
    name: rivalryName,
    participantIds: selectedIds,
    structure: command.structure,
    storylineId: storyline.id,
    relationshipTag: storyline.relationshipTag,
    heat,
    freshness: 80,
    weeksActive: 1,
    lastAdvancedWeek: 0,
    status: getRivalryStatus(heat, 80),
    stakes: command.stakes,
  } satisfies Rivalry);
  const startEvent: RivalryHistoryEvent = {
    id: `s${game.seasonNumber}-w${game.currentWeek}-${rivalryId}-started`,
    rivalryId,
    rivalryName: rivalry.name,
    participantIds: [...rivalry.participantIds],
    weekNumber: game.currentWeek,
    seasonNumber: game.seasonNumber,
    eventType: "started",
    note: `${rivalry.name} started with ${formatRivalryStakes(command.stakes).toLowerCase()} stakes.`,
    heat: rivalry.heat,
    freshness: rivalry.freshness,
    status: rivalry.status,
  };

  return {
    ...game,
    rivalries: [...game.rivalries, rivalry],
    rivalryHistory: [...(game.rivalryHistory ?? []), startEvent],
  };
}
