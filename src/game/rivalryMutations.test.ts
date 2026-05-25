import { describe, expect, it } from "vitest";
import { createRivalryInGame, hasDuplicateRivalry } from "./rivalryMutations";
import { createNewGame, draftPool } from "./seed";
import type { Rivalry, Wrestler } from "./types";

function divisionGroup(wrestler: Wrestler) {
  const division = wrestler.division?.toLowerCase() ?? "";

  if (division.includes("women") || division.includes("female")) {
    return "womens";
  }

  if (division.includes("men") || division.includes("male")) {
    return "mens";
  }

  return "open";
}

function baseGame(wrestlers: Wrestler[]) {
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    rivalries: [],
    rivalryHistory: [],
  };
}

function sameDivisionWrestlers(count: number) {
  const groups = draftPool.reduce<Record<string, Wrestler[]>>((record, wrestler) => {
    const group = divisionGroup(wrestler);
    record[group] = [...(record[group] ?? []), wrestler];
    return record;
  }, {});

  return Object.values(groups).find((wrestlers) => wrestlers.length >= count)?.slice(0, count) ?? draftPool.slice(0, count);
}

describe("rivalryMutations", () => {
  it("creates a singles rivalry with a matching start history event", () => {
    const wrestlers = sameDivisionWrestlers(2);
    const game = baseGame(wrestlers);
    const updated = createRivalryInGame(game, {
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      structure: "singles",
      stakes: "personal",
    });

    expect(updated).not.toBe(game);
    expect(updated.rivalries).toHaveLength(1);
    expect(updated.rivalries[0]).toMatchObject({
      name: `${wrestlers[0].name} vs ${wrestlers[1].name}`,
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      structure: "singles",
      weeksActive: 1,
      freshness: 80,
      stakes: "personal",
    });
    expect(updated.rivalryHistory).toHaveLength(1);
    expect(updated.rivalryHistory[0]).toMatchObject({
      rivalryId: updated.rivalries[0].id,
      rivalryName: updated.rivalries[0].name,
      eventType: "started",
      participantIds: wrestlers.map((wrestler) => wrestler.id),
    });
  });

  it("does not create duplicate rivalry participant sets", () => {
    const wrestlers = sameDivisionWrestlers(2);
    const game = createRivalryInGame(baseGame(wrestlers), {
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      structure: "singles",
      stakes: "respect",
    });
    const updated = createRivalryInGame(game, {
      participantIds: wrestlers.map((wrestler) => wrestler.id).reverse(),
      structure: "singles",
      stakes: "revenge",
    });

    expect(updated).toBe(game);
  });

  it("treats swapped tag sides as duplicate tag rivalries", () => {
    const wrestlers = sameDivisionWrestlers(4);
    const rivalry: Rivalry = {
      id: "tag-rivalry",
      name: "Existing Tag Rivalry",
      participantIds: wrestlers.map((wrestler) => wrestler.id),
      structure: "tag_team",
      heat: 70,
      freshness: 80,
      weeksActive: 1,
      lastAdvancedWeek: 0,
      status: "rising",
      stakes: "personal",
    };

    expect(hasDuplicateRivalry([rivalry], "tag_team", [wrestlers[2].id, wrestlers[3].id, wrestlers[0].id, wrestlers[1].id])).toBe(true);
  });

  it("blocks intergender rivalry creation", () => {
    const mens = draftPool.find((wrestler) => divisionGroup(wrestler) === "mens");
    const womens = draftPool.find((wrestler) => divisionGroup(wrestler) === "womens");

    if (!mens || !womens) {
      throw new Error("Expected draft pool to contain mens and womens wrestlers for rivalry mutation coverage.");
    }

    const game = baseGame([mens, womens]);
    const updated = createRivalryInGame(game, {
      participantIds: [mens.id, womens.id],
      structure: "singles",
      stakes: "personal",
    });

    expect(updated).toBe(game);
  });
});
