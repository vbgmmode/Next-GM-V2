import { describe, expect, it } from "vitest";
import { createNewGame } from "../game/seed";
import { getSocialAuthorAvatarSrc, getWrestlerJabFeed } from "./socialReads";

describe("social author avatars", () => {
  it("uses fixed avatar assignments for built-in timeline accounts", () => {
    expect(getSocialAuthorAvatarSrc("@ClipMachine")).toBe("/social-avatars/social-avatar-010.png");
    expect(getSocialAuthorAvatarSrc("Gorilla Position Analytics")).toBe("/social-avatars/social-avatar-054.png");
  });

  it("uses a stable exported avatar for generated authors", () => {
    const first = getSocialAuthorAvatarSrc("Dirt Sheet Dispatch");
    const second = getSocialAuthorAvatarSrc("Dirt Sheet Dispatch");

    expect(first).toBe(second);
    expect(first).toMatch(/^\/social-avatars\/social-avatar-\d{3}\.png$/);
  });
});

describe("superstar social feed", () => {
  it("uses wrestler mood posts instead of forced back-and-forth callouts", () => {
    const game = createNewGame();
    const [first, second] = game.wrestlers;
    const feed = getWrestlerJabFeed(
      {
        ...game,
        rivalries: [
          {
            id: "rivalry-social-test",
            name: `${first.name} vs ${second.name}`,
            participantIds: [first.id, second.id],
            heat: 88,
            freshness: 72,
            weeksActive: 3,
            lastAdvancedWeek: 1,
            status: "rising",
            stakes: "personal",
            structure: "singles",
          },
        ],
      },
      6,
    );

    expect(feed?.detail).toContain("current mood");
    expect(feed?.items.length).toBeGreaterThan(0);
    expect(feed?.items.every((item) => item.contextLabel && !item.jab.startsWith("hey "))).toBe(true);
    expect(feed?.items.some((item) => item.contextLabel === "Rivalry mood")).toBe(true);
  });
});
