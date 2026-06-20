import { describe, expect, it } from "vitest";
import { createNewGame, draftPool } from "../game/seed";
import type { Rivalry, Wrestler } from "../game/types";
import { getRivalryCreationBlockReason } from "./rivalriesScreenReads";

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

function sameDivisionWrestlers(count: number) {
  const groups = draftPool.reduce<Record<string, Wrestler[]>>((record, wrestler) => {
    const group = divisionGroup(wrestler);
    record[group] = [...(record[group] ?? []), wrestler];
    return record;
  }, {});

  return Object.values(groups).find((wrestlers) => wrestlers.length >= count)?.slice(0, count) ?? draftPool.slice(0, count);
}

describe("rivalries screen reads", () => {
  it("allows manual rivalry creation choices to include wrestlers already in another active feud", () => {
    const wrestlers = sameDivisionWrestlers(3);
    const game = createNewGame({ draftedWrestlers: wrestlers });
    const existingRivalry: Rivalry = {
      id: "existing-rivalry",
      name: `${wrestlers[0].name} vs ${wrestlers[2].name}`,
      participantIds: [wrestlers[0].id, wrestlers[2].id],
      structure: "singles",
      heat: 70,
      freshness: 80,
      weeksActive: 1,
      lastAdvancedWeek: 0,
      status: "rising",
      stakes: "personal",
    };

    expect(getRivalryCreationBlockReason("singles", [wrestlers[0].id, wrestlers[1].id], wrestlers, [existingRivalry])).toBe("");
    expect(getRivalryCreationBlockReason("singles", [wrestlers[0].id, wrestlers[0].id], wrestlers, [existingRivalry])).toBe(
      "Each wrestler can only appear once in a rivalry.",
    );
  });
});
