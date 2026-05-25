import { describe, expect, it } from "vitest";
import { getChampionshipPressureSnapshots, getTitleDivisionScene, getTitleSceneTalentScore } from "./gameContextReads";
import { createNewGame, draftPool } from "./seed";
import type { Championship, Rivalry, Wrestler } from "./types";

function sameDivisionWrestlers(count: number) {
  const wrestlers = draftPool.filter((wrestler) => wrestler.division === "Mens").slice(0, count);
  expect(wrestlers).toHaveLength(count);
  return wrestlers.map((wrestler, index) => ({
    ...wrestler,
    popularity: 60 + index,
    momentum: 60 + index,
    fatigue: 0,
    morale: 70,
    injuryStatus: "healthy" as const,
    injuryWeeksRemaining: 0,
  }));
}

function title(id: string, championIds: string[], prestige: number): Championship {
  return {
    id,
    name: id === "vacant-title" ? "Vacant Title" : "Anchored Title",
    division: "Mens",
    eligibleMatchScope: "singles",
    prestige,
    championIds,
    contenderIds: [],
    reignStartWeek: 1,
    defenses: 0,
  };
}

function baseGame(wrestlers: Wrestler[], championships: Championship[], rivalries: Rivalry[] = []) {
  return {
    ...createNewGame({ draftedWrestlers: wrestlers }),
    wrestlers,
    championships,
    rivalries,
  };
}

describe("gameContextReads championship selectors", () => {
  it("keeps title-rivalry bonus inside the shared title talent score", () => {
    const wrestlers = sameDivisionWrestlers(3);
    const championship = title("anchored-title", [wrestlers[0].id], 90);
    const rivalry: Rivalry = {
      id: "title-rivalry",
      name: "Title Rivalry",
      participantIds: [wrestlers[0].id, wrestlers[1].id],
      structure: "singles",
      heat: 70,
      freshness: 75,
      weeksActive: 2,
      lastAdvancedWeek: 1,
      status: "rising",
      stakes: "title",
    };

    expect(getTitleSceneTalentScore(wrestlers[1], championship, [rivalry])).toBe(
      getTitleSceneTalentScore(wrestlers[1], championship) + 18,
    );
  });

  it("builds title scenes with manual contenders before derived contenders", () => {
    const wrestlers = sameDivisionWrestlers(4);
    const championship = {
      ...title("anchored-title", [wrestlers[0].id], 90),
      contenderIds: [wrestlers[3].id],
    };
    const scene = getTitleDivisionScene(championship, wrestlers, [], 1, [championship]);

    expect(scene.topContenders.map((wrestler) => wrestler.id)).toEqual([wrestlers[3].id]);
    expect(scene.eligibleRoster.map((wrestler) => wrestler.id)).toContain(wrestlers[1].id);
  });

  it("ranks build-pressure championship snapshots ahead of prestige-only stable scenes", () => {
    const wrestlers = sameDivisionWrestlers(5);
    const game = baseGame(wrestlers, [
      title("anchored-title", [wrestlers[0].id], 95),
      title("vacant-title", [], 70),
    ]);

    const snapshots = getChampionshipPressureSnapshots(game);

    expect(snapshots[0].championship.id).toBe("vacant-title");
    expect(snapshots[0].snapshot.primary.tone).toBe("build");
  });
});
