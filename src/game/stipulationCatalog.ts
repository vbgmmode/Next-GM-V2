import { type Segment, type ShowType } from "./types";

export type StipulationStageId = "seed" | "spark" | "escalation" | "go_home" | "blowoff" | "fallout";

export type StipulationCatalogOption = {
  id: string;
  label: string;
  description: string;
  scoreBonus: number;
  fatigueBonus: number;
  rivalryHeatBonus: number;
  socialPriorityBonus: number;
  weeklyTvCostUsd: number;
  pleCostUsd: number;
  riskContext: string;
  presentationalContext: string;
  rivalryTone: string;
  eligibleFormatIds: string[];
  recommendedStageIds: StipulationStageId[];
};

export const stipulationCatalog: StipulationCatalogOption[] = [
  {
    id: "no_dq",
    label: "No DQ",
    description: "No disqualification framing gives rivals a rougher finish lane without turning the match into a full spectacle.",
    scoreBonus: 1,
    fatigueBonus: 1,
    rivalryHeatBonus: 1,
    socialPriorityBonus: 4,
    weeklyTvCostUsd: 18000,
    pleCostUsd: 27000,
    riskContext: "Medium physical and production premium.",
    presentationalContext: "looser finish lane",
    rivalryTone: "escalation lens",
    eligibleFormatIds: ["M001", "M002", "M003", "M020"],
    recommendedStageIds: ["spark", "escalation", "go_home"],
  },
  {
    id: "extreme_rules",
    label: "Extreme Rules",
    description: "No disqualifications and no count-outs: a harder-edged finish window with broader in-ring risk.",
    scoreBonus: 2,
    fatigueBonus: 2,
    rivalryHeatBonus: 2,
    socialPriorityBonus: 8,
    weeklyTvCostUsd: 25000,
    pleCostUsd: 39500,
    riskContext: "Higher physical and production premium.",
    presentationalContext: "No-DQ escalation",
    rivalryTone: "escalation lens",
    eligibleFormatIds: ["M001", "M002", "M003", "M020"],
    recommendedStageIds: ["escalation", "go_home", "blowoff"],
  },
  {
    id: "street_fight",
    label: "Street Fight",
    description: "A personal rivalry match with brawling freedom and a grittier TV texture.",
    scoreBonus: 2,
    fatigueBonus: 2,
    rivalryHeatBonus: 2,
    socialPriorityBonus: 8,
    weeklyTvCostUsd: 26000,
    pleCostUsd: 41000,
    riskContext: "Medium premium with higher body-load.",
    presentationalContext: "fight spills past the ropes",
    rivalryTone: "personal grudge escalation",
    eligibleFormatIds: ["M001", "M002", "M003", "M020"],
    recommendedStageIds: ["escalation", "go_home", "blowoff"],
  },
  {
    id: "table_match",
    label: "Table Match",
    description: "A simple spectacle stipulation built around one decisive crash and a loud replay package.",
    scoreBonus: 2,
    fatigueBonus: 2,
    rivalryHeatBonus: 1,
    socialPriorityBonus: 7,
    weeklyTvCostUsd: 23500,
    pleCostUsd: 36000,
    riskContext: "Medium premium with visible crash risk.",
    presentationalContext: "table-break spectacle",
    rivalryTone: "viral escalation beat",
    eligibleFormatIds: ["M001", "M002", "M003", "M020"],
    recommendedStageIds: ["spark", "escalation", "go_home"],
  },
  {
    id: "steel_cage",
    label: "Steel Cage",
    description: "A containment framing match where the entrance, pace, and final sequence can feel like a late-fever payoff.",
    scoreBonus: 3,
    fatigueBonus: 3,
    rivalryHeatBonus: 2,
    socialPriorityBonus: 10,
    weeklyTvCostUsd: 40500,
    pleCostUsd: 62500,
    riskContext: "High premium with containment-stage risk.",
    presentationalContext: "title-worthy presentation",
    rivalryTone: "escalation lens",
    eligibleFormatIds: ["M001", "M002", "M003", "M020"],
    recommendedStageIds: ["go_home", "blowoff"],
  },
  {
    id: "ladder_match",
    label: "Ladder Match",
    description: "A major spectacle match built around climbing spots, near-misses, and title-scene electricity.",
    scoreBonus: 4,
    fatigueBonus: 4,
    rivalryHeatBonus: 3,
    socialPriorityBonus: 14,
    weeklyTvCostUsd: 69500,
    pleCostUsd: 111000,
    riskContext: "Top premium with major fatigue risk.",
    presentationalContext: "high-risk spectacle",
    rivalryTone: "major payoff signal",
    eligibleFormatIds: ["M001", "M002", "M003"],
    recommendedStageIds: ["go_home", "blowoff"],
  },
  {
    id: "tlc_match",
    label: "TLC Match",
    description: "Tables, ladders, and chairs turn the match into a full chaos package with premium social upside.",
    scoreBonus: 4,
    fatigueBonus: 4,
    rivalryHeatBonus: 3,
    socialPriorityBonus: 15,
    weeklyTvCostUsd: 85000,
    pleCostUsd: 134000,
    riskContext: "Top premium with the highest production load.",
    presentationalContext: "full-chaos spectacle",
    rivalryTone: "blowoff escalation",
    eligibleFormatIds: ["M001", "M002", "M003"],
    recommendedStageIds: ["blowoff"],
  },
  {
    id: "last_man_standing",
    label: "Last Man Standing",
    description: "A decisive one-on-one war where survival becomes the hook and the finish should feel final.",
    scoreBonus: 3,
    fatigueBonus: 4,
    rivalryHeatBonus: 3,
    socialPriorityBonus: 12,
    weeklyTvCostUsd: 52000,
    pleCostUsd: 82500,
    riskContext: "High premium with heavy fatigue risk.",
    presentationalContext: "survival blowoff",
    rivalryTone: "finality signal",
    eligibleFormatIds: ["M001"],
    recommendedStageIds: ["go_home", "blowoff"],
  },
  {
    id: "iron_man",
    label: "Iron Man",
    description: "A long-form test of endurance and skill where the match itself becomes the prestige argument.",
    scoreBonus: 3,
    fatigueBonus: 4,
    rivalryHeatBonus: 2,
    socialPriorityBonus: 11,
    weeklyTvCostUsd: 50000,
    pleCostUsd: 79000,
    riskContext: "High premium with endurance strain.",
    presentationalContext: "prestige endurance test",
    rivalryTone: "prove-it payoff",
    eligibleFormatIds: ["M001"],
    recommendedStageIds: ["go_home", "blowoff"],
  },
  {
    id: "submission_match",
    label: "Submission Match",
    description: "Finish pressure is explicitly constrained to submission completion framing and rivalry payoff pacing.",
    scoreBonus: 1,
    fatigueBonus: 1,
    rivalryHeatBonus: 1,
    socialPriorityBonus: 5,
    weeklyTvCostUsd: 11500,
    pleCostUsd: 18000,
    riskContext: "Low premium with targeted wear.",
    presentationalContext: "technical finish focus",
    rivalryTone: "special attraction feel",
    eligibleFormatIds: ["M001"],
    recommendedStageIds: ["escalation", "go_home", "blowoff"],
  },
];

export function getStipulationById(stipulationId?: string) {
  return stipulationCatalog.find((stipulation) => stipulation.id === stipulationId);
}

export function getStipulationsForSegment(segment: Pick<Segment, "segmentCatalogId" | "type">) {
  if (segment.type !== "Match") {
    return [];
  }

  const formatId = segment.segmentCatalogId;

  if (!formatId) {
    return [];
  }

  return stipulationCatalog.filter((stipulation) => stipulation.eligibleFormatIds.includes(formatId));
}

export function getSegmentStipulationLabel(segment: Pick<Segment, "stipulationId">) {
  return getStipulationById(segment.stipulationId)?.label ?? "No stipulation";
}

export function getStipulationCostForShow(stipulationId: string | undefined, showType: ShowType) {
  const stipulation = getStipulationById(stipulationId);

  if (!stipulation) {
    return 0;
  }

  return showType === "ple" ? stipulation.pleCostUsd : stipulation.weeklyTvCostUsd;
}
