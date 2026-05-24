import { type Segment } from "./types";

export type StipulationCatalogOption = {
  id: string;
  label: string;
  description: string;
  riskContext: string;
  presentationalContext: string;
  rivalryTone: string;
  eligibleFormatIds: string[];
};

export const stipulationCatalog: StipulationCatalogOption[] = [
  {
    id: "extreme_rules",
    label: "Extreme Rules",
    description: "No disqualifications and no count-outs: a harder-edged finish window with broader in-ring risk.",
    riskContext: "Higher physical risk.",
    presentationalContext: "No-DQ escalation",
    rivalryTone: "escalation lens",
    eligibleFormatIds: ["M001", "M020"],
  },
  {
    id: "steel_cage",
    label: "Steel Cage",
    description: "A containment framing match where the entrance, pace, and final sequence can feel like a late-fever payoff.",
    riskContext: "Higher physicality risk.",
    presentationalContext: "title-worthy presentation",
    rivalryTone: "escalation lens",
    eligibleFormatIds: ["M001", "M020"],
  },
  {
    id: "submission_match",
    label: "Submission Match",
    description: "Finish pressure is explicitly constrained to submission completion framing and rivalry payoff pacing.",
    riskContext: "Targeted wear and fatigue risk for specialists.",
    presentationalContext: "technical finish focus",
    rivalryTone: "special attraction feel",
    eligibleFormatIds: ["M001"],
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
