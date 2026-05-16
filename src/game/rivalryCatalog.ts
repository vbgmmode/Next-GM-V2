import type { Rivalry, RivalryStakes } from "./types";

export type RivalryStorylineEntry = {
  id: string;
  name: string;
  description: string;
  participantStructure: string;
  divisionFit: string;
  titleFit: string;
  commonBeats: string;
  recommendedBlowoffMatches: string;
  relationshipTag: string;
  bookingNotes: string;
};

export type RivalryStageEntry = {
  id: string;
  name: string;
  description: string;
  typicalSegmentTypes: string;
  notes: string;
};

export type RivalryRelationshipEntry = {
  tag: string;
  name: string;
  description: string;
  notes: string;
};

const genericStoryline: RivalryStorylineEntry = {
  id: "personal_grudge",
  name: "Personal Grudge",
  description: "A rivalry rooted in disrespect, insult, betrayal, or repeated attacks.",
  participantStructure: "1v1",
  divisionFit: "All",
  titleFit: "Non-title or title",
  commonBeats: "Retaliation, pull-apart brawl, challenge accepted, stipulation added",
  recommendedBlowoffMatches: "No Holds Barred, Street Fight, Last Man Standing",
  relationshipTag: "rivals",
  bookingNotes: "High heat but can get stale without escalation",
};

// Catalog-backed foundation derived from rivalry_storyline_catalog_2026-05-16.csv.
// Numeric formula/event fields are intentionally not used in this pass.
export const rivalryStorylineCatalog: RivalryStorylineEntry[] = [
  {
    id: "championship_chase",
    name: "Championship Chase",
    description: "A credible contender pursues a champion over several weeks.",
    participantStructure: "1v1 or tag",
    divisionFit: "Top/Middle/Tag/Women",
    titleFit: "Title",
    commonBeats: "Promo, contender win, champion response, contract signing, title match",
    recommendedBlowoffMatches: "Championship Match, Steel Cage, Ladder, Iron Man",
    relationshipTag: "rivals",
    bookingNotes: "Core title path; avoid overusing on every show",
  },
  {
    id: "champion_ducks_challenger",
    name: "Champion Ducks Challenger",
    description: "A heel or arrogant champion avoids defending against a rising threat.",
    participantStructure: "1v1",
    divisionFit: "All singles/tag",
    titleFit: "Title",
    commonBeats: "Open challenge fakeout, cheap attack, GM mandate, contract signing",
    recommendedBlowoffMatches: "No DQ, Steel Cage, Last Man Standing",
    relationshipTag: "rivals",
    bookingNotes: "Works best with arrogant or cowardly heels",
  },
  {
    id: "open_challenge_arc",
    name: "Open Challenge Run",
    description: "A champion or star issues recurring open challenges to build prestige.",
    participantStructure: "1v1 rotating",
    divisionFit: "All",
    titleFit: "Title or non-title",
    commonBeats: "Surprise challenger, near upset, post-match attack, escalating opponent quality",
    recommendedBlowoffMatches: "Standard Singles, Title Match, Ladder, Submission",
    relationshipTag: "respect_or_rivals",
    bookingNotes: "Great low-overhead weekly TV device",
  },
  {
    id: "contract_signing_escalation",
    name: "Contract Signing Escalation",
    description: "A major match becomes official through a tense contract signing.",
    participantStructure: "1v1 or tag",
    divisionFit: "All",
    titleFit: "Title or grudge",
    commonBeats: "Insults, table flip, security pull-apart, sneak attack",
    recommendedBlowoffMatches: "Any major stipulation; Hell in a Cell, Cage, Last Man Standing",
    relationshipTag: "rivals",
    bookingNotes: "Use sparingly as go-home segment",
  },
  genericStoryline,
  {
    id: "revenge_story",
    name: "Revenge Story",
    description: "A wronged wrestler seeks payback after an attack or betrayal.",
    participantStructure: "1v1/tag",
    divisionFit: "All",
    titleFit: "Mostly non-title",
    commonBeats: "Return promo, obstacle match, ambush, final revenge match",
    recommendedBlowoffMatches: "Street Fight, Steel Cage, I Quit",
    relationshipTag: "rivals",
    bookingNotes: "Very reliable babyface arc",
  },
  {
    id: "respect_feud",
    name: "Respect Feud",
    description: "Two wrestlers compete to prove who is better without deep hatred.",
    participantStructure: "1v1/tag",
    divisionFit: "All",
    titleFit: "Non-title or title",
    commonBeats: "Handshake tease, competitive promos, best-of series",
    recommendedBlowoffMatches: "Standard Singles, Iron Man, Submission, 2 out of 3 Falls",
    relationshipTag: "respect",
    bookingNotes: "Good for workrate divisions",
  },
  {
    id: "best_of_series",
    name: "Best Of Series",
    description: "A recurring competitive series decides superiority.",
    participantStructure: "1v1/tag",
    divisionFit: "All",
    titleFit: "Non-title or contender",
    commonBeats: "Scoreboard updates, tiebreaker stipulation, final decisive match",
    recommendedBlowoffMatches: "2 out of 3 Falls, Iron Man, Submission",
    relationshipTag: "respect_or_rivals",
    bookingNotes: "Great for technical/workrate stars",
  },
  {
    id: "underdog_vs_favorite",
    name: "Underdog Upset Chase",
    description: "A lower-ranked star tries to prove they belong against an established name.",
    participantStructure: "1v1",
    divisionFit: "All",
    titleFit: "Contender or title",
    commonBeats: "Gatekeeper match, mentor advice, near fall, decisive upset",
    recommendedBlowoffMatches: "Standard Singles, No DQ, Title Match",
    relationshipTag: "rivals",
    bookingNotes: "Excellent prospect-building arc",
  },
  {
    id: "veteran_vs_rookie",
    name: "Veteran vs Rookie",
    description: "An established veteran tests, dismisses, or mentors a rising talent.",
    participantStructure: "1v1",
    divisionFit: "All",
    titleFit: "Non-title",
    commonBeats: "Training montage equivalent, lesson match, respect/cheap shot turn",
    recommendedBlowoffMatches: "Standard Singles, Submission, 2 out of 3 Falls",
    relationshipTag: "respect_or_rivals",
    bookingNotes: "Can end in respect or betrayal",
  },
  {
    id: "jealousy_spotlight",
    name: "Jealousy Over Spotlight",
    description: "One wrestler resents another's push, title shot, or popularity.",
    participantStructure: "1v1",
    divisionFit: "All",
    titleFit: "Non-title/title-adjacent",
    commonBeats: "Interruptions, sabotage, stolen win, grudge match",
    recommendedBlowoffMatches: "Standard Singles, No DQ, Steel Cage",
    relationshipTag: "rivals",
    bookingNotes: "Great midcard-to-upper card story",
  },
  {
    id: "contender_sabotage",
    name: "Contender Sabotage",
    description: "A rival repeatedly interferes to stop another contender's rise.",
    participantStructure: "1v1",
    divisionFit: "All",
    titleFit: "Title-adjacent",
    commonBeats: "Distraction, backstage attack, stolen pin, final grudge",
    recommendedBlowoffMatches: "Steel Cage, No DQ, Street Fight",
    relationshipTag: "rivals",
    bookingNotes: "Cleanly ties matches to rivalry heat",
  },
];

export const rivalryStageCatalog: RivalryStageEntry[] = [
  {
    id: "seed",
    name: "Seed",
    description: "The rivalry becomes visible but is not yet fully heated.",
    typicalSegmentTypes: "callout, glance, interruption, cheap shot, competitive match",
    notes: "Low cost setup, minimal fatigue",
  },
  {
    id: "spark",
    name: "Spark",
    description: "The first clear conflict or opportunity is created.",
    typicalSegmentTypes: "promo interruption, post-match attack, contender win, miscommunication",
    notes: "Good weekly TV stage",
  },
  {
    id: "escalation",
    name: "Escalation",
    description: "Rivals trade wins, attacks, promos, or sabotage.",
    typicalSegmentTypes: "backstage angle, tag preview, non-title match, brawl",
    notes: "Do not escalate every rivalry every week",
  },
  {
    id: "go_home",
    name: "Go-Home",
    description: "Final hype before a major match.",
    typicalSegmentTypes: "contract signing, pull-apart brawl, final promo, champion/challenger faceoff",
    notes: "Best one week before PLE/special",
  },
  {
    id: "blowoff",
    name: "Blowoff",
    description: "Major match intended to resolve or transform the rivalry.",
    typicalSegmentTypes: "title match, cage, street fight, ladder, last man standing",
    notes: "Winner/loser consequences should be applied",
  },
  {
    id: "fallout",
    name: "Fallout",
    description: "Post-blowoff consequences, respect, breakup, transfer, or rematch hook.",
    typicalSegmentTypes: "handshake, revenge tease, injury update, morale impact, new challenger",
    notes: "Useful to avoid abrupt story endings",
  },
];

export const rivalryRelationshipCatalog: RivalryRelationshipEntry[] = [
  { tag: "rivals", name: "Rivals", description: "Default hostile rivalry state", notes: "Most feuds use this" },
  { tag: "respect", name: "Respectful Rivals", description: "Competitive but honorable", notes: "Good for face/face and workrate stories" },
  { tag: "respect_or_rivals", name: "Respect or Rivals", description: "Can branch based on booking", notes: "Flexible story state" },
  { tag: "competitive_rivals", name: "Competitive Rivals", description: "Contenders in a race/bracket", notes: "Lower personal hatred" },
  { tag: "redemption", name: "Redemption Arc", description: "Self or career status relationship", notes: "More internal than hostile" },
];

export const safeRivalryStorylineOptions = rivalryStorylineCatalog.filter((storyline) => !storyline.participantStructure.includes("3") && !storyline.participantStructure.includes("Multi"));

function findStoryline(id?: string) {
  return rivalryStorylineCatalog.find((storyline) => storyline.id === id);
}

function findStage(id?: string) {
  return rivalryStageCatalog.find((stage) => stage.id === id);
}

function findRelationship(tag?: string) {
  return rivalryRelationshipCatalog.find((relationship) => relationship.tag === tag);
}

export function getDefaultStorylineIdForStakes(stakes: RivalryStakes) {
  if (stakes === "title") {
    return "championship_chase";
  }

  if (stakes === "respect") {
    return "respect_feud";
  }

  if (stakes === "revenge") {
    return "revenge_story";
  }

  return "personal_grudge";
}

export function getRivalryStoryline(rivalry: Pick<Rivalry, "storylineId" | "stakes">) {
  return findStoryline(rivalry.storylineId) ?? findStoryline(getDefaultStorylineIdForStakes(rivalry.stakes)) ?? genericStoryline;
}

export function getRivalryRelationship(rivalry: Pick<Rivalry, "relationshipTag" | "storylineId" | "stakes">) {
  const storyline = getRivalryStoryline(rivalry);
  return findRelationship(rivalry.relationshipTag) ?? findRelationship(storyline.relationshipTag) ?? rivalryRelationshipCatalog[0];
}

export function deriveRivalryStage(
  rivalry: Pick<Rivalry, "stageId" | "heat" | "freshness" | "weeksActive" | "lastAdvancedWeek">,
  options: { hasPlePayoff?: boolean; isGoHome?: boolean; isPle?: boolean } = {},
) {
  const storedStage = findStage(rivalry.stageId);

  if (storedStage) {
    return storedStage;
  }

  if (options.hasPlePayoff) {
    return findStage("fallout") ?? rivalryStageCatalog[0];
  }

  if (options.isPle && rivalry.heat >= 65 && rivalry.weeksActive >= 3) {
    return findStage("blowoff") ?? rivalryStageCatalog[0];
  }

  if (options.isGoHome && rivalry.heat >= 55) {
    return findStage("go_home") ?? rivalryStageCatalog[0];
  }

  if (rivalry.weeksActive <= 1 && rivalry.lastAdvancedWeek === 0 && rivalry.heat < 62) {
    return findStage("seed") ?? rivalryStageCatalog[0];
  }

  if (rivalry.weeksActive <= 2 || rivalry.heat < 55) {
    return findStage("spark") ?? rivalryStageCatalog[0];
  }

  return findStage("escalation") ?? rivalryStageCatalog[0];
}

export function getRivalryGMRead(
  rivalry: Pick<Rivalry, "heat" | "freshness" | "weeksActive" | "stakes" | "storylineId" | "relationshipTag" | "stageId" | "lastAdvancedWeek">,
  options: { titleRelevant?: boolean; hasPlePayoff?: boolean; isGoHome?: boolean; isPle?: boolean } = {},
) {
  const stage = deriveRivalryStage(rivalry, options);

  if (options.titleRelevant) {
    return "Clear title chase. Keep the champion and challenger visible without giving away the finish.";
  }

  if (rivalry.freshness <= 35 || rivalry.heat < 45) {
    return "Cooling off. Give it a distinct beat or consider a clean exit.";
  }

  if (stage.id === "blowoff" || (rivalry.heat >= 75 && rivalry.weeksActive >= 4)) {
    return "Good blowoff candidate. A major match or high-stakes segment can pay off the pressure.";
  }

  if (stage.id === "go_home") {
    return "Ready for final hype. Promos, contract tension, or a pull-apart can sharpen the match.";
  }

  if (stage.id === "seed" || stage.id === "spark") {
    return "Needs a spark. Use a callout, interruption, or pointed match to make the premise clear.";
  }

  return "Ready for escalation. Trade momentum through promos, backstage pressure, or a focused match.";
}

export function applyRivalryCatalogDefaults(rivalry: Rivalry): Rivalry {
  const storyline = getRivalryStoryline(rivalry);
  const relationship = getRivalryRelationship({ ...rivalry, storylineId: storyline.id });

  return {
    ...rivalry,
    storylineId: rivalry.storylineId ?? storyline.id,
    relationshipTag: rivalry.relationshipTag ?? relationship.tag,
  };
}
