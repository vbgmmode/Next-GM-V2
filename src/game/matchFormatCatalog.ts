import type { Segment, SegmentType } from "./types";

export type MatchFormatStructure = "singles" | "multi_person" | "non_match";

export type SegmentCatalogOption = {
  id: string;
  family: SegmentType;
  group: string;
  label: string;
  variant: string;
  defaultDurationMinutes: number;
  minParticipants: number;
  maxParticipants: number;
  championshipAllowed: boolean;
  winnerRequired: boolean;
  rivalryRelevant: boolean;
  intent: string;
  note: string;
  productionCue: string;
  matchStructure: MatchFormatStructure;
  currentTitleEligible: boolean;
  presentationRiskLabel: string;
};

export const bookingSegmentTypes: SegmentType[] = ["Match", "Promo", "Backstage Angle", "Contract Signing", "Open Challenge"];

export const segmentCatalogOptions: SegmentCatalogOption[] = [
  {
    id: "M001",
    family: "Match",
    group: "Standard",
    label: "Singles Match",
    variant: "One on One",
    defaultDurationMinutes: 12,
    minParticipants: 2,
    maxParticipants: 2,
    championshipAllowed: true,
    winnerRequired: true,
    rivalryRelevant: true,
    intent: "Clean bell-to-bell focus for two wrestlers. Best when the card needs a clear sporting center.",
    note: "Two wrestlers, one finish, title eligible when the champion is involved.",
    productionCue: "Bell-to-bell spotlight",
    matchStructure: "singles",
    currentTitleEligible: true,
    presentationRiskLabel: "Controlled",
  },
  {
    id: "M020",
    family: "Match",
    group: "Standard",
    label: "Tag Team Match",
    variant: "Two-on-Two",
    defaultDurationMinutes: 12,
    minParticipants: 4,
    maxParticipants: 4,
    championshipAllowed: false,
    winnerRequired: true,
    rivalryRelevant: true,
    intent: "Two teams of two with clear side-by-side booking and shared workload. Team sides are read from participant order.",
    note: "Four wrestlers required. The first two are Team A, the last two are Team B. Non-title in v1.",
    productionCue: "Tag team pressure",
    matchStructure: "multi_person",
    currentTitleEligible: false,
    presentationRiskLabel: "Tag Build",
  },
  {
    id: "M002",
    family: "Match",
    group: "Standard",
    label: "Triple Threat",
    variant: "Three-way",
    defaultDurationMinutes: 13,
    minParticipants: 3,
    maxParticipants: 3,
    championshipAllowed: false,
    winnerRequired: true,
    rivalryRelevant: true,
    intent: "Three-way traffic for contender tension, uneasy alliances, and a crowded title-scene lane.",
    note: "Three wrestlers required. Title changes stay off this format in the current build.",
    productionCue: "Three-way traffic",
    matchStructure: "multi_person",
    currentTitleEligible: false,
    presentationRiskLabel: "Traffic",
  },
  {
    id: "M003",
    family: "Match",
    group: "Standard",
    label: "Fatal 4-Way",
    variant: "Four-way",
    defaultDurationMinutes: 14,
    minParticipants: 4,
    maxParticipants: 4,
    championshipAllowed: false,
    winnerRequired: true,
    rivalryRelevant: true,
    intent: "Four-wrestler showcase when the show needs chaos, shared spotlight, or contender congestion.",
    note: "Four wrestlers required. Title changes stay off this format in the current build.",
    productionCue: "Contender pileup",
    matchStructure: "multi_person",
    currentTitleEligible: false,
    presentationRiskLabel: "Congested",
  },
  {
    id: "M019",
    family: "Match",
    group: "Hardcore",
    label: "Extreme Rules",
    variant: "One on One",
    defaultDurationMinutes: 13,
    minParticipants: 2,
    maxParticipants: 2,
    championshipAllowed: true,
    winnerRequired: true,
    rivalryRelevant: true,
    intent: "No-DQ style TV escalation for a feud that needs a harder edge without changing hidden formulas.",
    note: "Two wrestlers, one finish, title eligible when the champion is involved.",
    productionCue: "No-DQ escalation",
    matchStructure: "singles",
    currentTitleEligible: true,
    presentationRiskLabel: "Escalation",
  },
  {
    id: "P001",
    family: "Promo",
    group: "Core Promo",
    label: "Standard Promo",
    variant: "Mic time",
    defaultDurationMinutes: 5,
    minParticipants: 1,
    maxParticipants: 3,
    championshipAllowed: false,
    winnerRequired: false,
    rivalryRelevant: false,
    intent: "Character and microphone time for a wrestler or small group without forcing a feud beat.",
    note: "One to three wrestlers. No winner is resolved because this is a talk segment.",
    productionCue: "Mic spotlight",
    matchStructure: "non_match",
    currentTitleEligible: false,
    presentationRiskLabel: "Low Contact",
  },
  {
    id: "P003",
    family: "Promo",
    group: "Core Promo",
    label: "Call-Out Promo",
    variant: "Calls out rival",
    defaultDurationMinutes: 6,
    minParticipants: 1,
    maxParticipants: 2,
    championshipAllowed: false,
    winnerRequired: false,
    rivalryRelevant: true,
    intent: "Direct microphone pressure for calling someone out, sharpening a feud, or setting a confrontation.",
    note: "One or two wrestlers. Rivalry context is especially useful but never forced.",
    productionCue: "Direct challenge",
    matchStructure: "non_match",
    currentTitleEligible: false,
    presentationRiskLabel: "Verbal Heat",
  },
  {
    id: "P002",
    family: "Promo",
    group: "Core Promo",
    label: "Hype Promo",
    variant: "Momentum builder",
    defaultDurationMinutes: 5,
    minParticipants: 1,
    maxParticipants: 1,
    championshipAllowed: false,
    winnerRequired: false,
    rivalryRelevant: false,
    intent: "Single-wrestler hype package for giving the audience a reason to care before the next beat.",
    note: "One wrestler. No opponent or winner is needed.",
    productionCue: "Character hype",
    matchStructure: "non_match",
    currentTitleEligible: false,
    presentationRiskLabel: "Low Contact",
  },
  {
    id: "A001",
    family: "Backstage Angle",
    group: "Backstage Interview",
    label: "Backstage Interview",
    variant: "Solo/duo interview",
    defaultDurationMinutes: 4,
    minParticipants: 1,
    maxParticipants: 3,
    championshipAllowed: false,
    winnerRequired: false,
    rivalryRelevant: false,
    intent: "Backstage camera time for character texture, locker-room read, or quiet story setup.",
    note: "One to three wrestlers. Useful for context without making the segment feel like a fight.",
    productionCue: "Backstage texture",
    matchStructure: "non_match",
    currentTitleEligible: false,
    presentationRiskLabel: "Backstage",
  },
  {
    id: "A046",
    family: "Backstage Angle",
    group: "Production/Entrance Adjacent",
    label: "Backstage Confrontation",
    variant: "Mid-ramp stop",
    defaultDurationMinutes: 4,
    minParticipants: 2,
    maxParticipants: 4,
    championshipAllowed: false,
    winnerRequired: false,
    rivalryRelevant: true,
    intent: "A tense production-area faceoff that puts bodies in the same frame before the show moves on.",
    note: "Two to four wrestlers. Rivalry context helps clarify why cameras are here.",
    productionCue: "Hallway pressure",
    matchStructure: "non_match",
    currentTitleEligible: false,
    presentationRiskLabel: "Confrontation",
  },
  {
    id: "A004",
    family: "Backstage Angle",
    group: "Attack Angle",
    label: "Backstage Attack",
    variant: "Surprise assault",
    defaultDurationMinutes: 4,
    minParticipants: 2,
    maxParticipants: 4,
    championshipAllowed: false,
    winnerRequired: false,
    rivalryRelevant: true,
    intent: "Ambush-style TV heat for making the backstage feed feel dangerous without new injury logic.",
    note: "Two to four wrestlers. This frames an attack but does not add new injury effects.",
    productionCue: "Ambush angle",
    matchStructure: "non_match",
    currentTitleEligible: false,
    presentationRiskLabel: "Physical Angle",
  },
  {
    id: "P008",
    family: "Contract Signing",
    group: "Special",
    label: "Contract Signing",
    variant: "Formal match signing",
    defaultDurationMinutes: 9,
    minParticipants: 2,
    maxParticipants: 2,
    championshipAllowed: true,
    winnerRequired: false,
    rivalryRelevant: true,
    intent: "Big-table confrontation for formal stakes, title framing, and pre-match tension.",
    note: "Two wrestlers. Championship context can be attached, but no championship changes here.",
    productionCue: "Table stakes",
    matchStructure: "non_match",
    currentTitleEligible: true,
    presentationRiskLabel: "Formal Stakes",
  },
  {
    id: "P007",
    family: "Open Challenge",
    group: "Special",
    label: "Open Challenge",
    variant: "Champion or star invites opponent",
    defaultDurationMinutes: 7,
    minParticipants: 1,
    maxParticipants: 1,
    championshipAllowed: true,
    winnerRequired: false,
    rivalryRelevant: false,
    intent: "One star or champion throws the door open. The answer stays hidden until the broadcast runs.",
    note: "One issuer only. The opponent is resolved at show-run time.",
    productionCue: "Unanswered call",
    matchStructure: "non_match",
    currentTitleEligible: true,
    presentationRiskLabel: "Unknown Answer",
  },
];

export function getCatalogOptionsForType(type: SegmentType) {
  return segmentCatalogOptions.filter((option) => option.family === type);
}

export function getDefaultCatalogOption(type: SegmentType) {
  return getCatalogOptionsForType(type)[0];
}

export function getCatalogOptionById(id: string) {
  return segmentCatalogOptions.find((option) => option.id === id);
}

export function getSegmentCatalogOption(segment: Pick<Segment, "segmentCatalogId" | "type">) {
  return segmentCatalogOptions.find((option) => option.id === segment.segmentCatalogId) ?? getDefaultCatalogOption(segment.type);
}

export function getSegmentTypeDefaults(type: SegmentType) {
  const option = getDefaultCatalogOption(type);

  return {
    segmentCatalogId: option?.id,
    segmentDisplayName: option?.label,
    durationMinutes: option?.defaultDurationMinutes,
    participantMin: option?.minParticipants,
    participantMax: option?.maxParticipants,
  };
}

export function getSegmentParticipantRange(segment: Pick<Segment, "participantMin" | "participantMax" | "segmentCatalogId" | "type">) {
  const option = getSegmentCatalogOption(segment);

  return {
    min: segment.participantMin ?? option?.minParticipants ?? (segment.type === "Open Challenge" ? 1 : 2),
    max: segment.participantMax ?? option?.maxParticipants ?? getFallbackParticipantLimit(segment.type),
  };
}

export function getSegmentValidationRange(segment: Pick<Segment, "participantMin" | "participantMax" | "segmentCatalogId" | "type">) {
  if (segment.participantMin !== undefined || segment.participantMax !== undefined || segment.segmentCatalogId) {
    return getSegmentParticipantRange(segment);
  }

  switch (segment.type) {
    case "Match":
    case "Contract Signing":
      return { min: 2, max: 2 };
    case "Promo":
      return { min: 1, max: 3 };
    case "Backstage Angle":
      return { min: 2, max: 4 };
    case "Open Challenge":
      return { min: 1, max: 1 };
    default:
      return { min: 1, max: 0 };
  }
}

export function getFallbackParticipantLimit(type: SegmentType) {
  if (type === "Promo") {
    return 3;
  }

  if (type === "Backstage Angle") {
    return 4;
  }

  if (type === "Open Challenge") {
    return 1;
  }

  return 2;
}
