import { describe, expect, it } from "vitest";
import {
  applyMatchRatingProgression,
  calculateEffectiveMatchPower,
  calculateMatchupWinProbability,
  deriveMatchRatings,
  ensureMatchRatings,
  matchRatingKeys,
  resolveMatchOutcomePreview,
} from "./matchRatings";
import { migrateSavedGameState } from "./migration";
import { createNewGame } from "./seed";
import { runShow } from "./scoring";
import type { MatchRatings, Segment, Wrestler } from "./types";

function baseWrestler(overrides: Partial<Wrestler> = {}): Wrestler {
  return {
    id: "test-wrestler",
    name: "Test Wrestler",
    draftRank: 80,
    sourceBrand: "Raw",
    sourceAvailability: "Active",
    roleTier: "Midcard",
    role: "Singles",
    alignment: "Face",
    archetype: "RingGeneral",
    wrestlingStyle: "Balanced",
    presentationHook: "Prime-time wrestler",
    division: "Mens",
    popularity: 62,
    momentum: 54,
    audienceHeat: 50,
    fatigue: 10,
    morale: 60,
    trust: 50,
    ringSkill: 68,
    promoSkill: 58,
    appearancesThisSeason: 0,
    lastBookedWeek: 0,
    consecutiveWeeksBooked: 0,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
    ...overrides,
  };
}

function assertBounded(ratings: MatchRatings) {
  matchRatingKeys.forEach((key) => {
    expect(ratings[key], key).toBeGreaterThanOrEqual(0);
    expect(ratings[key], key).toBeLessThanOrEqual(100);
  });
}

function explicitRatings(overrides: Partial<MatchRatings> = {}): MatchRatings {
  return {
    technical: 60,
    submission: 60,
    power: 60,
    aerial: 60,
    brawling: 60,
    hardcore: 60,
    stamina: 60,
    resilience: 60,
    psychology: 60,
    selling: 60,
    timing: 60,
    explosiveness: 60,
    clutch: 60,
    ...overrides,
  };
}

describe("match ratings foundation", () => {
  it("migrates legacy wrestler data without matchRatings", () => {
    const game = createNewGame();
    const legacyGame = {
      ...game,
      wrestlers: game.wrestlers.map((wrestler) => {
        const { matchRatings, ...legacyWrestler } = wrestler;
        void matchRatings;
        return legacyWrestler;
      }),
    };

    const migrated = migrateSavedGameState({ game: legacyGame, screen: "dashboard" });

    expect(migrated?.game.wrestlers.every((wrestler) => wrestler.matchRatings)).toBe(true);
    migrated?.game.wrestlers.forEach((wrestler) => assertBounded(wrestler.matchRatings!));
  });

  it("derives stable bounded ratings for the same wrestler input", () => {
    const wrestler = baseWrestler();
    const first = deriveMatchRatings(wrestler);
    const second = deriveMatchRatings({ ...wrestler });

    expect(first).toEqual(second);
    assertBounded(first);
  });

  it("applies archetype and style bias to derived ratings", () => {
    const technician = deriveMatchRatings(baseWrestler({ archetype: "Technician", wrestlingStyle: "Mat technician" }));
    const highFlyer = deriveMatchRatings(baseWrestler({ archetype: "HighFlyer", wrestlingStyle: "Aerial lucha showcase" }));
    const powerhouse = deriveMatchRatings(baseWrestler({ archetype: "Powerhouse", wrestlingStyle: "Powerhouse hoss" }));

    expect(technician.technical).toBeGreaterThan(powerhouse.technical);
    expect(highFlyer.aerial).toBeGreaterThan(technician.aerial);
    expect(powerhouse.power).toBeGreaterThan(highFlyer.power);
  });

  it("does not let popularity alone dominate mechanical ratings", () => {
    const famousWeakWorker = deriveMatchRatings(baseWrestler({ popularity: 99, ringSkill: 45, promoSkill: 55, archetype: "Showman" }));
    const lessFamousTechnician = deriveMatchRatings(baseWrestler({ popularity: 50, ringSkill: 82, promoSkill: 55, archetype: "Technician" }));

    expect(lessFamousTechnician.technical).toBeGreaterThan(famousWeakWorker.technical);
    expect(lessFamousTechnician.timing).toBeGreaterThan(famousWeakWorker.timing);
  });

  it("keeps fatigue out of permanent base rating derivation", () => {
    const fresh = deriveMatchRatings(baseWrestler({ fatigue: 0 }));
    const exhausted = deriveMatchRatings(baseWrestler({ fatigue: 100 }));

    expect(exhausted).toEqual(fresh);
  });

  it("normalizes explicit overrides and keeps values bounded", () => {
    const ratings = ensureMatchRatings(baseWrestler({
      matchRatings: {
        technical: 200,
        submission: -10,
        power: 63.2,
        aerial: 61,
        brawling: 60,
        hardcore: 58,
        stamina: 57,
        resilience: 59,
        psychology: 62,
        selling: 64,
        timing: 66,
        explosiveness: 68,
        clutch: 70,
      },
    }));

    expect(ratings.technical).toBe(100);
    expect(ratings.submission).toBe(0);
    assertBounded(ratings);
  });

  it("progresses ratings gradually and can decrease ratings", () => {
    const wrestler = baseWrestler();
    const current = ensureMatchRatings(wrestler);
    const grown = applyMatchRatingProgression(wrestler, {
      segmentTypes: ["Match"],
      resultScore: 95,
      deltas: { technical: 10 },
    });
    const declined = applyMatchRatingProgression({ ...wrestler, matchRatings: grown }, {
      resultScore: 40,
      deltas: { technical: -10, stamina: -3 },
    });

    expect(grown.technical - current.technical).toBeLessThanOrEqual(2);
    expect(grown.technical).toBeGreaterThan(current.technical);
    expect(declined.technical).toBeLessThan(grown.technical);
    expect(declined.stamina).toBeLessThan(grown.stamina);
    assertBounded(declined);
  });

  it("calculates deterministic effective match power for the same inputs", () => {
    const wrestler = baseWrestler({
      id: "deterministic-power",
      matchRatings: explicitRatings({ technical: 82, timing: 78, clutch: 76 }),
    });
    const context = { segmentCatalogId: "M001", championshipId: "world-title", cardPosition: "main_event" as const };

    const first = calculateEffectiveMatchPower(wrestler, context);
    const second = calculateEffectiveMatchPower({ ...wrestler }, context);

    expect(first).toEqual(second);
    expect(first.effectivePower).toBeGreaterThan(0);
    expect(first.profileId).toBe("balanced");
  });

  it("uses a tuned Bradley-Terry-style win probability ratio", () => {
    const probability = calculateMatchupWinProbability(
      { competitorId: "a", effectivePower: 80 },
      { competitorId: "b", effectivePower: 20 },
    );

    expect(probability.rawCompetitorAWinProbability).toBeCloseTo(0.8, 5);
    expect(probability.competitorAWinProbability).toBeGreaterThan(probability.rawCompetitorAWinProbability);
    expect(probability.competitorAWinProbability).toBeLessThan(0.97);
    expect(probability.competitorBWinProbability).toBeGreaterThan(0.03);
  });

  it("favors stronger wrestlers without removing upset probability", () => {
    const strong = calculateEffectiveMatchPower(baseWrestler({ id: "strong", matchRatings: explicitRatings({ technical: 95, power: 95, clutch: 95 }) }));
    const weak = calculateEffectiveMatchPower(baseWrestler({ id: "weak", matchRatings: explicitRatings({ technical: 10, power: 10, clutch: 10 }) }));
    const probability = calculateMatchupWinProbability(strong, weak);

    expect(probability.competitorAWinProbability).toBeGreaterThan(probability.competitorBWinProbability);
    expect(probability.competitorBWinProbability).toBeGreaterThan(0);
  });

  it("weights submission matches toward submission and technical specialists", () => {
    const technician = baseWrestler({
      id: "submission-specialist",
      matchRatings: explicitRatings({ technical: 92, submission: 96, psychology: 82, resilience: 78, brawling: 45, hardcore: 35 }),
    });
    const fighter = baseWrestler({
      id: "standard-fighter",
      matchRatings: explicitRatings({ brawling: 92, hardcore: 88, power: 82, technical: 48, submission: 35 }),
    });
    const standardGap = calculateEffectiveMatchPower(technician, { segmentCatalogId: "M001" }).effectivePower -
      calculateEffectiveMatchPower(fighter, { segmentCatalogId: "M001" }).effectivePower;
    const submissionGap = calculateEffectiveMatchPower(technician, { segmentCatalogId: "M001", stipulationId: "submission_match" }).effectivePower -
      calculateEffectiveMatchPower(fighter, { segmentCatalogId: "M001", stipulationId: "submission_match" }).effectivePower;

    expect(submissionGap).toBeGreaterThan(standardGap);
  });

  it("weights hardcore and no-DQ matches toward hardcore brawlers", () => {
    const technician = baseWrestler({
      id: "clean-technician",
      matchRatings: explicitRatings({ technical: 92, submission: 90, timing: 85, hardcore: 35, brawling: 45 }),
    });
    const brawler = baseWrestler({
      id: "hardcore-brawler",
      matchRatings: explicitRatings({ hardcore: 96, brawling: 92, resilience: 86, power: 82, technical: 45, submission: 35 }),
    });
    const standardGap = calculateEffectiveMatchPower(brawler, { segmentCatalogId: "M001" }).effectivePower -
      calculateEffectiveMatchPower(technician, { segmentCatalogId: "M001" }).effectivePower;
    const noDqGap = calculateEffectiveMatchPower(brawler, { segmentCatalogId: "M001", stipulationId: "no_dq" }).effectivePower -
      calculateEffectiveMatchPower(technician, { segmentCatalogId: "M001", stipulationId: "no_dq" }).effectivePower;

    expect(noDqGap).toBeGreaterThan(standardGap);
  });

  it("weights ladder matches toward aerial and explosive wrestlers", () => {
    const flyer = baseWrestler({
      id: "ladder-flyer",
      matchRatings: explicitRatings({ aerial: 96, explosiveness: 94, timing: 90, resilience: 76, power: 45, submission: 35 }),
    });
    const striker = baseWrestler({
      id: "grounded-striker",
      matchRatings: explicitRatings({ brawling: 92, power: 86, resilience: 84, technical: 72, aerial: 42, explosiveness: 55 }),
    });
    const standardGap = calculateEffectiveMatchPower(flyer, { segmentCatalogId: "M001" }).effectivePower -
      calculateEffectiveMatchPower(striker, { segmentCatalogId: "M001" }).effectivePower;
    const ladderGap = calculateEffectiveMatchPower(flyer, { segmentCatalogId: "M001", stipulationId: "ladder_match" }).effectivePower -
      calculateEffectiveMatchPower(striker, { segmentCatalogId: "M001", stipulationId: "ladder_match" }).effectivePower;

    expect(ladderGap).toBeGreaterThan(standardGap);
  });

  it("weights iron-man matches toward stamina and resilience specialists", () => {
    const endurance = baseWrestler({
      id: "iron-man-specialist",
      matchRatings: explicitRatings({ stamina: 96, resilience: 94, technical: 88, psychology: 86, explosiveness: 45, hardcore: 38 }),
    });
    const sprinter = baseWrestler({
      id: "short-match-sprinter",
      matchRatings: explicitRatings({ explosiveness: 94, power: 88, brawling: 84, aerial: 82, stamina: 50, resilience: 52 }),
    });
    const standardGap = calculateEffectiveMatchPower(endurance, { segmentCatalogId: "M001" }).effectivePower -
      calculateEffectiveMatchPower(sprinter, { segmentCatalogId: "M001" }).effectivePower;
    const ironManGap = calculateEffectiveMatchPower(endurance, { segmentCatalogId: "M001", stipulationId: "iron_man" }).effectivePower -
      calculateEffectiveMatchPower(sprinter, { segmentCatalogId: "M001", stipulationId: "iron_man" }).effectivePower;

    expect(ironManGap).toBeGreaterThan(standardGap);
  });

  it("defaults missing match pacing to Normal without changing effective power", () => {
    const wrestler = baseWrestler({
      id: "normal-pacing-default",
      matchRatings: explicitRatings({ technical: 82, power: 75, stamina: 70, resilience: 73, psychology: 71, explosiveness: 77 }),
    });
    const baseContext = { segmentCatalogId: "M001", showType: "tv" as const, cardPosition: "midcard" as const };

    const implicitNormal = calculateEffectiveMatchPower(wrestler, baseContext);
    const explicitNormal = calculateEffectiveMatchPower(wrestler, { ...baseContext, matchPacing: "Normal" });

    expect(implicitNormal).toEqual(explicitNormal);
    expect(implicitNormal.profileId).toBe("balanced");
  });

  it("uses pacing context to favor sprint and epic specialists differently", () => {
    const sprinter = baseWrestler({
      id: "pacing-sprinter",
      matchRatings: explicitRatings({ power: 96, explosiveness: 96, stamina: 35, resilience: 50, psychology: 50 }),
    });
    const epicWorker = baseWrestler({
      id: "pacing-epic-worker",
      matchRatings: explicitRatings({ power: 50, explosiveness: 45, stamina: 96, resilience: 94, psychology: 92 }),
    });
    const normalSprinter = calculateEffectiveMatchPower(sprinter, { segmentCatalogId: "M001", matchPacing: "Normal" });
    const normalEpicWorker = calculateEffectiveMatchPower(epicWorker, { segmentCatalogId: "M001", matchPacing: "Normal" });
    const sprintSprinter = calculateEffectiveMatchPower(sprinter, { segmentCatalogId: "M001", matchPacing: "Sprint" });
    const sprintEpicWorker = calculateEffectiveMatchPower(epicWorker, { segmentCatalogId: "M001", matchPacing: "Sprint" });
    const epicSprinter = calculateEffectiveMatchPower(sprinter, { segmentCatalogId: "M001", matchPacing: "Epic" });
    const epicEpicWorker = calculateEffectiveMatchPower(epicWorker, { segmentCatalogId: "M001", matchPacing: "Epic" });

    const normalSprinterGap = normalSprinter.effectivePower - normalEpicWorker.effectivePower;
    const sprintSprinterGap = sprintSprinter.effectivePower - sprintEpicWorker.effectivePower;
    const normalEpicGap = normalEpicWorker.effectivePower - normalSprinter.effectivePower;
    const epicGap = epicEpicWorker.effectivePower - epicSprinter.effectivePower;

    expect(sprintSprinterGap).toBeGreaterThan(normalSprinterGap);
    expect(epicGap).toBeGreaterThan(normalEpicGap);
    expect(sprintSprinter.weights.power).toBeGreaterThan(normalSprinter.weights.power);
    expect(sprintSprinter.weights.explosiveness).toBeGreaterThan(normalSprinter.weights.explosiveness);
    expect(sprintSprinter.weights.stamina).toBeLessThan(normalSprinter.weights.stamina);
    expect(epicEpicWorker.weights.stamina).toBeGreaterThan(normalEpicWorker.weights.stamina);
    expect(epicEpicWorker.weights.psychology).toBeGreaterThan(normalEpicWorker.weights.psychology);
    expect(epicEpicWorker.weights.resilience).toBeGreaterThan(normalEpicWorker.weights.resilience);
  });

  it("diminishes high-end growth while allowing low-rated wrestlers to learn from strong performances", () => {
    const elite = baseWrestler({ matchRatings: explicitRatings(Object.fromEntries(matchRatingKeys.map((key) => [key, 96])) as Partial<MatchRatings>) });
    const prospect = baseWrestler({ matchRatings: explicitRatings(Object.fromEntries(matchRatingKeys.map((key) => [key, 42])) as Partial<MatchRatings>) });

    const eliteAfter = applyMatchRatingProgression(elite, {
      segmentTypes: ["Match"],
      resultScore: 95,
      deltas: { technical: 1.5, stamina: 1.5 },
    });
    const prospectAfter = applyMatchRatingProgression(prospect, {
      segmentTypes: ["Match"],
      resultScore: 95,
      deltas: { technical: 1.5, stamina: 1.5 },
    });

    expect(eliteAfter.technical - ensureMatchRatings(elite).technical).toBeLessThan(prospectAfter.technical - ensureMatchRatings(prospect).technical);
    expect(prospectAfter.technical).toBeGreaterThan(ensureMatchRatings(prospect).technical);
    assertBounded(eliteAfter);
    assertBounded(prospectAfter);
  });

  it("lets current fatigue affect effective power without mutating base matchRatings", () => {
    const baseRatings = explicitRatings({ stamina: 85, resilience: 82, explosiveness: 78 });
    const fresh = baseWrestler({ id: "fresh", fatigue: 5, matchRatings: baseRatings });
    const tired = baseWrestler({ id: "tired", fatigue: 95, matchRatings: baseRatings });
    const before = structuredClone(baseRatings);

    const freshPower = calculateEffectiveMatchPower(fresh).effectivePower;
    const tiredPower = calculateEffectiveMatchPower(tired).effectivePower;

    expect(tiredPower).toBeLessThan(freshPower);
    expect(baseRatings).toEqual(before);
    expect(fresh.matchRatings).toEqual(before);
    expect(tired.matchRatings).toEqual(before);
  });

  it("makes morale and fatigue visible current-state inputs in effective power", () => {
    const baseRatings = explicitRatings({ stamina: 75, resilience: 75, explosiveness: 75, clutch: 75, timing: 75 });
    const goodState = baseWrestler({ id: "good-state", momentum: 50, morale: 100, fatigue: 0, matchRatings: baseRatings });
    const badState = baseWrestler({ id: "bad-state", momentum: 50, morale: 0, fatigue: 100, matchRatings: baseRatings });
    const goodPower = calculateEffectiveMatchPower(goodState).effectivePower;
    const badPower = calculateEffectiveMatchPower(badState).effectivePower;
    const probability = calculateMatchupWinProbability(
      { competitorId: goodState.id, effectivePower: goodPower },
      { competitorId: badState.id, effectivePower: badPower },
    );

    expect(goodPower - badPower).toBeGreaterThan(3.5);
    expect(probability.competitorAWinProbability).toBeGreaterThan(0.53);
  });

  it("resolves deterministic preview outcomes from a seeded roll", () => {
    const favorite = baseWrestler({ id: "favorite", matchRatings: explicitRatings({ technical: 86, clutch: 82 }) });
    const underdog = baseWrestler({ id: "underdog", matchRatings: explicitRatings({ technical: 55, clutch: 58 }) });

    const first = resolveMatchOutcomePreview(favorite, underdog, { segmentCatalogId: "M001", seed: "fixed-preview-seed" });
    const second = resolveMatchOutcomePreview(favorite, underdog, { segmentCatalogId: "M001", seed: "fixed-preview-seed" });

    expect(first).toEqual(second);
    expect(first.roll).toBeGreaterThanOrEqual(0);
    expect(first.roll).toBeLessThan(1);
    expect([favorite.id, underdog.id]).toContain(first.winnerId);
  });

  it("does not change current match winner behavior", () => {
    const strongCurrentStats = baseWrestler({
      id: "strong-current",
      name: "Strong Current",
      popularity: 85,
      momentum: 80,
      ringSkill: 86,
      morale: 80,
      fatigue: 5,
      matchRatings: Object.fromEntries(matchRatingKeys.map((key) => [key, 0])) as MatchRatings,
    });
    const weakCurrentStats = baseWrestler({
      id: "weak-current",
      name: "Weak Current",
      popularity: 45,
      momentum: 42,
      ringSkill: 48,
      morale: 55,
      fatigue: 5,
      matchRatings: Object.fromEntries(matchRatingKeys.map((key) => [key, 100])) as MatchRatings,
    });
    const segment: Segment = {
      id: "ratings-neutral-winner",
      type: "Match",
      participantIds: [weakCurrentStats.id, strongCurrentStats.id],
      segmentCatalogId: "M001",
      segmentDisplayName: "Singles Match",
      durationMinutes: 12,
      participantMin: 2,
      participantMax: 2,
    };
    const game = {
      ...createNewGame({ draftedWrestlers: [strongCurrentStats, weakCurrentStats] }),
      wrestlers: [strongCurrentStats, weakCurrentStats],
      championships: [],
      rivalries: [],
      currentShow: [segment],
    };

    const { result } = runShow(game);

    expect(result.segmentResults[0].winnerId).toBe(strongCurrentStats.id);
  });
});
