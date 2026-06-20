import { describe, expect, it } from "vitest";
import { buildAiPromptPayload } from "./aiCommentary";
import { generateFinanceReport } from "./finance";
import { createNewGame } from "./seed";
import type { Segment, SegmentResult, ShowResult } from "./types";

function createAiPayloadFixture() {
  const game = createNewGame();
  const [first, second, third] = game.wrestlers;
  const segment: Segment = {
    id: "ai-main",
    type: "Match",
    participantIds: [first.id, second.id],
    winnerId: first.id,
    segmentCatalogId: "M001",
    segmentDisplayName: "Singles Match",
    durationMinutes: 14,
    participantMin: 2,
    participantMax: 2,
    stipulationId: "steel_cage",
  };
  const segmentResult: SegmentResult = {
    segmentId: segment.id,
    type: segment.type,
    participantNames: [first.name, second.name],
    participantIds: [first.id, second.id],
    score: 88,
    plannedDurationMinutes: 14,
    actualDurationMinutes: 15,
    momentumChanges: { [first.id]: 5, [second.id]: 5 },
    fatigueChanges: { [first.id]: 10, [second.id]: 12 },
    segmentCatalogId: "M001",
    stipulationId: "steel_cage",
    winnerId: first.id,
    recapNote: "Steel cage gave the match a bigger final-frame receipt.",
  };
  const result: ShowResult = {
    id: "ai-payload-test",
    seasonNumber: game.seasonNumber,
    week: game.currentWeek,
    brandName: game.brandName,
    showName: "Test TV",
    showType: "tv",
    plannedRuntimeMinutes: 14,
    actualRuntimeMinutes: 15,
    totalScore: 88,
    segmentResults: [segmentResult],
    biggestMomentumGain: { name: first.name, amount: 5 },
    biggestFatigueIncrease: { name: second.name, amount: 12 },
    titleNotes: [],
    rivalryNotes: [],
    titleHistoryEvents: [],
    rivalryHistoryEvents: [],
  };
  const gameWithContext = {
    ...game,
    currentShow: [segment],
    wrestlers: game.wrestlers.map((wrestler) =>
      wrestler.id === third.id
        ? {
            ...wrestler,
            popularity: 82,
            momentum: 70,
            lastBookedWeek: 0,
            consecutiveWeeksBooked: 0,
          }
        : wrestler.id === first.id
          ? {
              ...wrestler,
              fatigue: 72,
              consecutiveWeeksBooked: 4,
            }
          : wrestler,
    ),
  };
  const financeReport = generateFinanceReport(result, gameWithContext);

  return {
    game: {
      ...gameWithContext,
      financeReports: [financeReport],
      socialPosts: [
        {
          id: "existing-post",
          weekNumber: result.week,
          seasonNumber: result.seasonNumber,
          showName: result.showName,
          category: "viral_moment" as const,
          author: "@ExistingFan",
          text: "Existing deterministic post.",
          tone: "excited" as const,
          relatedWrestlerIds: [first.id],
        },
      ],
    },
    result,
  };
}

describe("aiCommentary payload", () => {
  it("enriches post-show AI commentary with resolved stipulation, finance, and roster-pressure context", () => {
    const { game, result } = createAiPayloadFixture();
    const payload = buildAiPromptPayload(result, game);
    const segment = payload.segments[0];

    expect(payload.task).toBe("next-gm-social-commentary-v3");
    expect(segment.stipulation?.label).toBe("Steel Cage");
    expect(segment.stipulation?.specialtyProductionCost).toBeGreaterThan(0);
    expect(payload.resolvedFacts.finance?.stipulationProductionCost).toBeGreaterThan(0);
    expect(payload.resolvedFacts.existingSocialFeed).toHaveLength(1);
    expect(payload.resolvedFacts.rosterPressure.overused.length).toBeGreaterThan(0);
    expect(payload.resolvedFacts.rosterPressure.offCardNotables.length).toBeGreaterThan(0);
    expect(payload.instructions).toContain("wrestlerPosts");
    expect(payload.instructions).toContain("segmentRecaps");
  });
});
