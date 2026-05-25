import { describe, expect, it } from "vitest";
import { migrateSavedGameState } from "./migration";
import { createNewGame, createRivalGMAssignments } from "./seed";

describe("brand identity normalization", () => {
  it("persists shared identity mirrors for the player and CPU brands", () => {
    const game = createNewGame({
      brandName: "Raw",
      brandStyle: "Raw",
      gmName: "Test GM",
      rivalGMAssignments: createRivalGMAssignments("Raw"),
    });

    expect(game.playerBrand).toEqual({
      id: "player",
      ownerType: "player",
      brandKey: "Raw",
      name: game.brandName,
      style: game.brandStyle,
    });

    game.rivalBrands.forEach((brand) => {
      expect(brand.brandIdentity).toEqual({
        id: brand.id,
        ownerType: "cpu",
        brandKey: brand.brandKey,
        name: brand.brandName,
        style: brand.brandKey,
      });
    });
  });

  it("defaults legacy saves without changing current player and CPU brand reads", () => {
    const game = createNewGame({
      brandName: "SmackDown",
      brandStyle: "SmackDown",
      gmName: "Legacy GM",
      rivalGMAssignments: createRivalGMAssignments("SmackDown"),
    });
    const legacyGame = {
      ...game,
      rivalBrands: game.rivalBrands.map((brand) => {
        const legacyBrand = { ...brand } as { brandIdentity?: unknown };
        delete legacyBrand.brandIdentity;
        return legacyBrand;
      }),
    };
    delete (legacyGame as { playerBrand?: unknown }).playerBrand;

    const migrated = migrateSavedGameState({ game: legacyGame, screen: "dashboard" });

    expect(migrated?.game.brandName).toBe("SmackDown");
    expect(migrated?.game.brandStyle).toBe("SmackDown");
    expect(migrated?.game.playerBrand).toMatchObject({
      id: "player",
      ownerType: "player",
      brandKey: "SmackDown",
      name: "SmackDown",
      style: "SmackDown",
    });
    expect(migrated?.game.rivalBrands.map((brand) => brand.brandName)).toEqual(game.rivalBrands.map((brand) => brand.brandName));
    expect(migrated?.game.rivalBrands.map((brand) => brand.brandIdentity.name)).toEqual(game.rivalBrands.map((brand) => brand.brandName));
  });
});
