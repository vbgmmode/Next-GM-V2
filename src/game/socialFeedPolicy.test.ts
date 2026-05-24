import { describe, expect, it } from "vitest";
import { generateSocialPosts } from "./social";
import { createNewGame } from "./seed";
import type { SegmentResult, ShowResult } from "./types";

function createResult(segment: SegmentResult): ShowResult {
  return {
    id: "stip-social-test",
    seasonNumber: 1,
    week: 1,
    brandName: "Raw",
    showName: "Test TV",
    showType: "tv",
    plannedRuntimeMinutes: 12,
    actualRuntimeMinutes: 12,
    totalScore: segment.score,
    segmentResults: [segment],
    biggestMomentumGain: { name: segment.participantNames[0], amount: 4 },
    biggestFatigueIncrease: { name: segment.participantNames[1], amount: Math.max(0, ...Object.values(segment.fatigueChanges)) },
    titleNotes: [],
    rivalryNotes: segment.rivalryNote ? [segment.rivalryNote] : [],
    titleHistoryEvents: [],
    rivalryHistoryEvents: [],
  };
}

describe("social feed policy", () => {
  it("adds resolved stipulation discourse without creating new social categories", () => {
    const game = createNewGame();
    const [first, second] = game.wrestlers;
    const segment: SegmentResult = {
      segmentId: "stip-social-main",
      type: "Match",
      participantNames: [first.name, second.name],
      participantIds: [first.id, second.id],
      score: 91,
      plannedDurationMinutes: 16,
      actualDurationMinutes: 16,
      momentumChanges: { [first.id]: 5, [second.id]: 5 },
      fatigueChanges: { [first.id]: 13, [second.id]: 13 },
      segmentCatalogId: "M001",
      stipulationId: "tlc_match",
      rivalryId: "rivalry-test",
      rivalryNote: "Test rivalry surged after a premium beat.",
      winnerId: first.id,
    };
    const posts = generateSocialPosts(createResult(segment), {
      ...game,
      rivalries: [
        {
          id: "rivalry-test",
          name: "Test Rivalry",
          participantIds: [first.id, second.id],
          heat: 70,
          freshness: 70,
          weeksActive: 2,
          lastAdvancedWeek: 0,
          status: "rising",
          stakes: "personal",
          structure: "singles",
        },
      ],
    });
    const stipulationPost = posts.find((post) => post.text.includes("TLC Match"));

    expect(stipulationPost).toBeDefined();
    expect(stipulationPost?.category).toBe("fatigue_concern");
    expect(posts).toHaveLength(7);
    expect(new Set(posts.map((post) => post.category))).not.toContain("stipulation");
  });
});
