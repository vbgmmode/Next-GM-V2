import { describe, expect, it } from "vitest";
import { createNewGame } from "../game/seed";
import { getSocialAuthorAvatarSrc, getSuperstarMailSnapshot, getWrestlerJabFeed } from "./socialReads";

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

  it("prefers persisted AI superstar posts for the resolved week", () => {
    const game = createNewGame();
    const [first] = game.wrestlers;

    const feed = getWrestlerJabFeed(
      {
        ...game,
        wrestlerSocialPosts: [
          {
            id: "ai-wrestler-1",
            weekNumber: 1,
            seasonNumber: 1,
            showName: "Test TV",
            authorId: first.id,
            authorName: first.name,
            contextLabel: "Momentum mood",
            jab: "the building felt different when my name kept getting louder.",
            intentLabel: "MOMENTUM READ",
            tone: "mood",
          },
        ],
      },
      6,
    );

    expect(feed?.items).toHaveLength(1);
    expect(feed?.items[0]?.jab).toContain("building felt different");
    expect(feed?.detail).toContain("generated from resolved show fallout");
  });
});

describe("superstar mail", () => {
  it("stays quiet during Week 1 even when opening title or roster context looks urgent", () => {
    const game = createNewGame();
    const pressuredWrestlers = game.wrestlers.map((wrestler, index) =>
      index < 4
        ? {
            ...wrestler,
            fatigue: 95,
            consecutiveWeeksBooked: 4,
            momentum: 88,
            popularity: 88,
          }
        : wrestler,
    );

    const snapshot = getSuperstarMailSnapshot({
      ...game,
      currentWeek: 1,
      wrestlers: pressuredWrestlers,
    });

    expect(snapshot?.items).toHaveLength(0);
    expect(snapshot?.detail).toContain("No active asks");
  });

  it("does not stack three direct asks from ordinary urgent pressure", () => {
    const game = createNewGame();
    const pressuredWrestlers = game.wrestlers.map((wrestler, index) =>
      index < 4
        ? {
            ...wrestler,
            fatigue: 95,
            consecutiveWeeksBooked: 4,
            momentum: 88,
            popularity: 88,
          }
        : wrestler,
    );

    const snapshot = getSuperstarMailSnapshot({
      ...game,
      currentWeek: 2,
      wrestlers: pressuredWrestlers,
    });

    expect(snapshot?.items.length ?? 0).toBeLessThanOrEqual(2);
  });
});
