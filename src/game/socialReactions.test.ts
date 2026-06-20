import { describe, expect, it } from "vitest";
import { generateSocialPosts } from "./social";
import { createNewGame } from "./seed";
import type { GameState, SegmentResult, ShowResult } from "./types";

function createResult(segment: SegmentResult, overrides: Partial<ShowResult> = {}): ShowResult {
  return {
    id: overrides.id ?? "social-reaction-test",
    seasonNumber: 1,
    week: 1,
    brandName: "Raw",
    showName: "Test TV",
    showType: "tv",
    plannedRuntimeMinutes: 20,
    actualRuntimeMinutes: 20,
    totalScore: segment.score,
    segmentResults: [segment],
    biggestMomentumGain: { name: segment.participantNames[0], amount: 6 },
    biggestFatigueIncrease: { name: segment.participantNames[1] ?? segment.participantNames[0], amount: 8 },
    titleNotes: segment.titleNote ? [segment.titleNote] : [],
    rivalryNotes: segment.rivalryNote ? [segment.rivalryNote] : [],
    titleHistoryEvents: [],
    rivalryHistoryEvents: [],
    ...overrides,
  };
}

function createMatchSegment(game: GameState, score = 91): SegmentResult {
  const [winner, loser] = game.wrestlers;

  return {
    segmentId: "social-reaction-main",
    type: "Match",
    participantNames: [winner.name, loser.name],
    participantIds: [winner.id, loser.id],
    score,
    plannedDurationMinutes: 18,
    actualDurationMinutes: 18,
    momentumChanges: { [winner.id]: 5, [loser.id]: -2 },
    fatigueChanges: { [winner.id]: 6, [loser.id]: 7 },
    segmentCatalogId: "M001",
    winnerId: winner.id,
  };
}

describe("social reactions", () => {
  it("grounds clean losses as burial-watch discourse", () => {
    const game = createNewGame();
    const result = createResult(createMatchSegment(game, 82));
    const posts = generateSocialPosts(result, game);
    const cleanLossPost = posts.find((post) => post.triggerType === "clean_loss");

    expect(cleanLossPost).toMatchObject({
      persona: "burial_cop",
      sentiment: "negative",
      sourceResultId: result.id,
      segmentId: "social-reaction-main",
    });
    expect(cleanLossPost?.target?.type).toBe("wrestler");
    expect(cleanLossPost?.tags).toEqual(expect.arrayContaining(["burial", "clean-loss"]));
  });

  it("grounds high-rated matches as workrate discourse and strong presentation as aura discourse", () => {
    const game = createNewGame();
    const result = createResult(createMatchSegment(game, 93));
    const posts = generateSocialPosts(result, game);

    expect(posts.find((post) => post.triggerType === "high_rated_match")).toMatchObject({
      persona: "workrate_nerd",
      sentiment: "positive",
      sourceResultId: result.id,
    });
    expect(posts.find((post) => post.triggerType === "hot_crowd" && post.persona === "aura_poster")).toMatchObject({
      tags: expect.arrayContaining(["aura", "crowd-reaction"]),
      sourceResultId: result.id,
    });
  });

  it("grounds stagnant and long-term rivalry reactions in rivalry state", () => {
    const game = createNewGame();
    const [first, second] = game.wrestlers;
    const rivalry = {
      id: "social-reaction-rivalry",
      name: `${first.name} vs ${second.name}`,
      participantIds: [first.id, second.id],
      heat: 82,
      freshness: 72,
      weeksActive: 5,
      lastAdvancedWeek: 0,
      status: "rising" as const,
      stakes: "personal" as const,
      structure: "singles" as const,
    };
    const baseSegment = {
      ...createMatchSegment(game, 88),
      rivalryId: rivalry.id,
    };
    const stalePosts = generateSocialPosts(
      createResult({
        ...baseSegment,
        rivalryNote: `${rivalry.name} cooled after the latest beat and fans are losing patience.`,
      }),
      { ...game, rivalries: [rivalry] },
    );
    const callbackPosts = generateSocialPosts(
      createResult(
        {
          ...baseSegment,
          rivalryNote: `${rivalry.name} heated up after a callback to their first confrontation.`,
        },
        { id: "social-reaction-callback" },
      ),
      { ...game, rivalries: [rivalry] },
    );

    expect(stalePosts.find((post) => post.triggerType === "rivalry_stagnation")).toMatchObject({
      persona: "let_it_play_out_skeptic",
      target: { type: "rivalry", id: rivalry.id, name: rivalry.name },
    });
    expect(callbackPosts.find((post) => post.triggerType === "long_term_callback")).toMatchObject({
      persona: "continuity_nerd",
      target: { type: "rivalry", id: rivalry.id, name: rivalry.name },
      tags: expect.arrayContaining(["continuity", "long-term-storytelling"]),
    });
  });

  it("is deterministic and does not produce orphan reactions", () => {
    const game = createNewGame();
    const result = createResult(createMatchSegment(game, 91));
    const first = generateSocialPosts(result, game);
    const second = generateSocialPosts(result, game);

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((post) => post.sourceResultId === result.id)).toBe(true);
    expect(first.every((post) => post.persona && post.sentiment && post.triggerType && post.target && post.tags?.length)).toBe(true);
  });
});
