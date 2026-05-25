import { describe, expect, it } from "vitest";
import { assignChampionshipInGame, revokeChampionshipInGame } from "./championshipMutations";
import { createNewGame } from "./seed";
import { wrestlerFitsChampionshipDivision } from "./titleCatalog";
import type { Championship, Segment } from "./types";

function vacantTitle(championship: Championship): Championship {
  return { ...championship, championIds: [], contenderIds: championship.championIds };
}

function titleSegment(championshipId: string): Segment {
  return {
    id: "segment-1",
    type: "Match",
    participantIds: [],
    championshipId,
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 12,
    participantMin: 2,
    participantMax: 2,
  };
}

describe("championship mutations", () => {
  it("assigns a vacant championship and records a manual office history event", () => {
    const game = createNewGame();
    const championship = game.championships.find((title) => title.eligibleMatchScope !== "tag_team") ?? game.championships[0];
    const championId = game.wrestlers.find((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship))?.id ?? game.wrestlers[0].id;
    const current = {
      ...game,
      championships: game.championships.map((title) => (title.id === championship.id ? vacantTitle(championship) : title)),
    };
    const updated = assignChampionshipInGame(current, championship.id, [championId]);
    const assignedTitle = updated.championships.find((title) => title.id === championship.id);

    expect(assignedTitle?.championIds).toEqual([championId]);
    expect(updated.championshipHistory.at(-1)).toMatchObject({
      championshipId: championship.id,
      eventType: "assigned",
      championIds: [championId],
    });
    expect(updated.championshipHistory.at(-1)?.resultId).toBeUndefined();
    expect(updated.championshipHistory.at(-1)?.eventId).toBeUndefined();
  });

  it("revokes a championship, clears attached booking segments, and records history without show refs", () => {
    const game = createNewGame();
    const championship = game.championships.find((title) => title.eligibleMatchScope !== "tag_team") ?? game.championships[0];
    const championId = game.wrestlers.find((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship))?.id ?? game.wrestlers[0].id;
    const championTitle = { ...championship, championIds: [championId] };
    const current = {
      ...game,
      championships: game.championships.map((title) => (title.id === championship.id ? championTitle : title)),
      currentShow: [titleSegment(championship.id)],
    };
    const updated = revokeChampionshipInGame(current, championship.id);
    const revokedTitle = updated.championships.find((title) => title.id === championship.id);

    expect(revokedTitle?.championIds).toEqual([]);
    expect(updated.currentShow[0].championshipId).toBeUndefined();
    expect(updated.championshipHistory.at(-1)).toMatchObject({
      championshipId: championship.id,
      eventType: "revoked",
      previousChampionIds: [championId],
    });
    expect(updated.championshipHistory.at(-1)?.resultId).toBeUndefined();
    expect(updated.championshipHistory.at(-1)?.eventId).toBeUndefined();
  });
});
