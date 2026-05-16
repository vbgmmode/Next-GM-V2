import { useMemo, useState } from "react";
import {
  MAX_SAVE_SLOTS,
  createSaveRecord,
  deleteSaveRecord,
  loadSaveRecords,
  renameSaveRecord,
  updateSaveRecord,
} from "./gameStorage";
import { advanceGameWeek, startNextSeason } from "./game/advanceWeek";
import { getFinancePressureLabel } from "./game/finance";
import { migrateSavedGameState } from "./game/migration";
import { createNewGame, createRivalGMAssignments, defaultCareer, draftPool } from "./game/seed";
import {
  getBestSegment,
  getCurrentCalendarWeek,
  getResultChange,
  getRivalryStatus,
  getShowGrade,
  getWrestlerDivisionGroup,
  hasIntergenderMatchParticipants,
  isValidSegment,
  runShow,
} from "./game/scoring";
import type {
  CalendarWeek,
  BrandStyle,
  Championship,
  ChampionshipHistoryEvent,
  FinanceReport,
  GameDifficulty,
  GameState,
  GMStyle,
  InjuryStatus,
  PressureLabel,
  Rivalry,
  RivalryHistoryEvent,
  RivalryStakes,
  RivalGMAssignment,
  Screen,
  Segment,
  SegmentType,
  ShowResult,
  SocialCategory,
  SocialPost,
  ShowType,
  StartingBudgetTier,
  Wrestler,
} from "./game/types";
import type { GameScreen, ProfileReturnScreen, SavedGameState } from "./game/migration";
import type { StoredSaveRecord } from "./gameStorage";

type RosterSort = "popularity" | "momentum" | "fatigue" | "morale";
type RosterFilter = "All" | "Hot" | "Tired" | "Frustrated";
type RosterPressureTag = "Overused" | "Underused" | "Protected Star" | "Morale Risk" | "Injury Risk" | "Minor Injury" | "Unavailable";
type SocialFilter = "All" | "Fan Reaction" | "Dirt Sheets" | "Analyst Takes" | "Title Scene" | "Rivalries";
type SetupStep = "contract" | "gm" | "brand" | "rules" | "preview" | "draft" | "review";
type DraftSort = "rank" | "starPower" | "popularity" | "momentum" | "ringSkill" | "promoSkill" | "fatigue";

type TitleMode = "home" | "load";

type CareerPreview = {
  brandName: string;
  gmName: string;
  money: number;
  screen: GameScreen;
  seasonNumber: number;
  week: number;
};

type CareerSave = {
  id: string;
  name: string;
  createdAt: string;
  lastPlayedAt: string;
  state: SavedGameState;
  preview: CareerPreview;
};

type WrestlerAppearance = {
  id: string;
  week: number;
  showName: string;
  type: SegmentType;
  score: number;
  note?: string;
};

type GMRead = {
  usefulness: string;
  risk: string;
  need: string;
};

type SegmentCatalogOption = {
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
};

type SmartRundownResult = {
  error?: string;
  notes: string[];
  segments: Segment[];
};

const draftPickCount = 12;

const draftSortOptions: { label: string; value: DraftSort }[] = [
  { label: "Top 200 Rank", value: "rank" },
  { label: "Star Power", value: "starPower" },
  { label: "Popularity", value: "popularity" },
  { label: "Momentum", value: "momentum" },
  { label: "Ring", value: "ringSkill" },
  { label: "Promo", value: "promoSkill" },
  { label: "Lowest Fatigue", value: "fatigue" },
];

const draftBrandFilters = ["All Brands", "Raw", "SmackDown", "NXT", "AEW"];
const draftRoleTierFilters = ["All Tiers", "MainEvent", "UpperCard", "Midcard", "Prospect", "Enhancement"];
const draftAvailabilityFilters = ["All Status", "Active", "Injured", "Inactive"];
const draftArchetypeFilters = ["All Styles", "Brawler", "HighFlyer", "Powerhouse", "RingGeneral", "Showman", "Technician"];

type ChoiceOption<T extends string = string> = {
  description?: string;
  label: T;
};

const gmStyleOptions: ChoiceOption<GMStyle>[] = [
  {
    label: "Creative Visionary",
    description: "Story-first leader built for long arcs, character turns, and patient payoffs.",
  },
  {
    label: "Talent Developer",
    description: "Locker-room builder who protects prospects and turns overlooked wrestlers into stars.",
  },
  {
    label: "Ruthless Executive",
    description: "Business-first operator who makes cold calls when the pressure hits.",
  },
  {
    label: "Ratings Chaser",
    description: "Spectacle-first GM chasing headlines, big swings, and must-watch TV.",
  },
  {
    label: "Locker Room General",
    description: "Morale-first leader who keeps egos aligned and the room bought in.",
  },
  {
    label: "Star Maker",
    description: "Obsessed with finding the next face of the company before everyone else sees it.",
  },
  {
    label: "Chaos Booker",
    description: "Thrives on swerves, shocks, controversy, and wild live-TV energy.",
  },
  {
    label: "Sports Realist",
    description: "Treats the brand like a fight league where rankings, stakes, and credibility matter.",
  },
  {
    label: "Brand Architect",
    description: "Builds a clear identity, sharp presentation, and a long-term audience promise.",
  },
  {
    label: "Veteran Operator",
    description: "Steady, political, experienced, and hard to rattle when the office gets loud.",
  },
  {
    label: "Cult Favorite",
    description: "Internet-savvy and fan-trust driven, with room for unconventional acts.",
  },
  {
    label: "Big Money Promoter",
    description: "Sells premium attractions, business spectacle, and the biggest room possible.",
  },
];
const brandStyleOptions: ChoiceOption<BrandStyle>[] = [
  {
    label: "Raw",
    description: "Flagship spectacle with big personalities, weekly pressure, and mainstream sports-entertainment energy.",
  },
  {
    label: "SmackDown",
    description: "Sharp blue-brand identity with star power, athletic confidence, and prime-time polish.",
  },
  {
    label: "NXT",
    description: "Hungry prospects, breakout performances, developmental pressure, and future-stars atmosphere.",
  },
  {
    label: "AEW",
    description: "Alternative wrestling identity with workrate credibility, fan-driven buzz, and unpredictable edge.",
  },
];
const difficultyOptions: ChoiceOption<GameDifficulty>[] = [
  {
    label: "Easy",
    description: "More forgiving first-season pressure while you find your GM rhythm.",
  },
  {
    label: "Medium",
    description: "Balanced GM challenge with enough pressure to make every week matter.",
  },
  {
    label: "Hard",
    description: "Tighter margins and less room for mistakes once the show goes live.",
  },
  {
    label: "Legendary",
    description: "Ruthless expectations for players who want pressure immediately.",
  },
];
const budgetOptions: ChoiceOption<StartingBudgetTier>[] = [
  {
    label: "$1M",
    description: "Scrappy startup pressure with every signing feeling expensive.",
  },
  {
    label: "$2M",
    description: "Balanced standard war chest for a focused first season.",
  },
  {
    label: "$4M",
    description: "Big launch backing for a loaded opening draft board.",
  },
  {
    label: "Unlimited",
    description: "Sandbox-style money for fantasy booking and experimentation.",
  },
];
const bookingSegmentTypes: SegmentType[] = ["Match", "Promo", "Backstage Angle", "Contract Signing", "Open Challenge"];
const showRuntimeTargetMinutes = 120;
const showRuntimeMinMinutes = 90;
const showRuntimeOvertimeMinutes = 135;
const tvRuntimeWarningMinutes = 150;
const maxBookingSegments = 24;
const qaHarnessParam = "qa";

const segmentCatalogOptions: SegmentCatalogOption[] = [
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
  },
];

function formatMoney(amount: number) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString()}`;
}

function formatBudgetTier(tier: StartingBudgetTier) {
  return tier === "Unlimited" ? "Unlimited" : tier;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLocationLabel(screen: GameScreen) {
  const labels: Record<GameScreen, string> = {
    booking: "Booking Desk",
    calendar: "Calendar",
    championships: "Title Office",
    dashboard: "Brand HQ",
    finance: "Finance & Pressure",
    profile: "Talent Profile",
    results: "Show Recap",
    rivalries: "Rivalry Desk",
    roster: "Locker Room",
    seasonReview: "Season Review",
    social: "IWC Pulse",
    weekReview: "Week Review",
  };

  return labels[screen];
}

function formatPressureLabel(label: PressureLabel) {
  return label;
}

function getCatalogOptionsForType(type: SegmentType) {
  return segmentCatalogOptions.filter((option) => option.family === type);
}

function getDefaultCatalogOption(type: SegmentType) {
  return getCatalogOptionsForType(type)[0];
}

function getCatalogOptionById(id: string) {
  return segmentCatalogOptions.find((option) => option.id === id);
}

function getSegmentCatalogOption(segment: Segment) {
  return segmentCatalogOptions.find((option) => option.id === segment.segmentCatalogId) ?? getDefaultCatalogOption(segment.type)!;
}

function getSegmentDurationMinutes(segment: Segment) {
  return segment.durationMinutes ?? getSegmentCatalogOption(segment)?.defaultDurationMinutes ?? 8;
}

function getSegmentRuntime(segment: Segment) {
  return `${getSegmentDurationMinutes(segment)} min TV time`;
}

function formatRuntimeVariance(variance = 0) {
  if (variance === 0) {
    return "on time";
  }

  return variance > 0 ? `+${variance} min` : `${variance} min`;
}

function getParticipantRequirementLabel(option: SegmentCatalogOption) {
  if (option.minParticipants === option.maxParticipants) {
    return `${option.minParticipants} ${option.minParticipants === 1 ? "person" : "people"} required`;
  }

  return `${option.minParticipants}-${option.maxParticipants} people allowed`;
}

function getSegmentIdentityBadges(segment: Segment) {
  const option = getSegmentCatalogOption(segment);
  const badges = [option.group, getParticipantRequirementLabel(option), option.championshipAllowed ? "Title context" : "No title change"];

  if (option.winnerRequired) {
    badges.push("Winner resolved");
  }

  if (option.rivalryRelevant) {
    badges.push("Rivalry friendly");
  }

  return badges;
}

function getSegmentRequirementDetails(segment: Segment) {
  const option = getSegmentCatalogOption(segment);
  const details = [
    getParticipantRequirementLabel(option),
    option.championshipAllowed ? "Championship context can be attached when eligible." : "No championship context or title change in this format.",
    option.winnerRequired ? "A winner is resolved when the show runs." : "No winner is required for this segment.",
  ];

  if (segment.type === "Match") {
    details.push("Match competitors must come from the same division.");
  }

  if (option.rivalryRelevant) {
    details.push("Rivalry context is useful when this beat belongs to an active story.");
  }

  if (segment.type === "Open Challenge") {
    details.push("The answering opponent stays hidden until Run Show.");
  }

  return details;
}

function getSegmentRequirement(type: SegmentType) {
  const option = getDefaultCatalogOption(type);

  if (option?.minParticipants === option?.maxParticipants) {
    const label = type === "Open Challenge" ? "issuer" : "wrestler";
    return `Needs exactly ${option.minParticipants} ${label}${option.minParticipants === 1 ? "" : "s"}`;
  }

  if (option) {
    return `Needs ${option.minParticipants} to ${option.maxParticipants} wrestlers`;
  }

  if (type === "Promo") {
    return "Needs 1 to 3 wrestlers";
  }

  if (type === "Backstage Angle") {
    return "Needs 2 to 4 wrestlers";
  }

  if (type === "Contract Signing") {
    return "Needs exactly 2 wrestlers";
  }

  return "Needs exactly 1 issuer";
}

function getSegmentRequirementForSegment(segment: Segment) {
  const range = getSegmentParticipantRange(segment);
  const label = segment.type === "Open Challenge" ? "issuer" : "wrestler";

  if (range.min === range.max) {
    return `Needs exactly ${range.min} ${label}${range.min === 1 ? "" : "s"}`;
  }

  return `Needs ${range.min} to ${range.max} wrestlers`;
}

function getSegmentDescription(type: SegmentType) {
  return getDefaultCatalogOption(type)?.note ?? "Build the segment structure without exposing hidden outcomes.";
}

function getSegmentParticipantRange(segment: Segment) {
  const option = getSegmentCatalogOption(segment);

  return {
    min: segment.participantMin ?? option?.minParticipants ?? (segment.type === "Open Challenge" ? 1 : 2),
    max: segment.participantMax ?? option?.maxParticipants ?? getFallbackParticipantLimit(segment.type),
  };
}

function getFallbackParticipantLimit(type: SegmentType) {
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

function getSegmentPickerLabel(type: SegmentType) {
  return type === "Open Challenge" ? "Issuer" : "Participants";
}

function getSegmentValidationWarning(segment: Segment, wrestlers: Wrestler[] = []) {
  if (isValidSegment(segment, wrestlers)) {
    return "";
  }

  const unavailable = getSegmentParticipants(segment, wrestlers).find((wrestler) => wrestler.injuryStatus === "major");

  if (unavailable) {
    return `${unavailable.name} is unavailable with a major injury.`;
  }

  if (hasIntergenderMatchParticipants(segment, wrestlers)) {
    return "Intergender matches are not allowed. Choose competitors from the same division.";
  }

  const range = getSegmentParticipantRange(segment);
  const label = segment.type === "Open Challenge" ? "issuer" : "wrestler";
  const option = getSegmentCatalogOption(segment);
  const segmentName = segment.segmentDisplayName ?? option.label ?? segment.type;

  if (range.min === range.max) {
    return `${segmentName} needs exactly ${range.min} ${label}${range.min === 1 ? "" : "s"} before it can hold a TV slot.`;
  }

  if (segment.participantIds.length < range.min) {
    return `${segmentName} needs ${range.min - segment.participantIds.length} more ${label}${range.min - segment.participantIds.length === 1 ? "" : "s"} for this format.`;
  }

  return `${segmentName} is over format capacity. Keep it to ${range.max} ${label}${range.max === 1 ? "" : "s"}.`;
}

function getShowReadiness(validSegments: number, invalidSegments: number, runtimeMinutes: number) {
  if (invalidSegments > 0) {
    return {
      canRun: false,
      status: "Fix The Rundown",
      tone: "blocked",
      note: `${invalidSegments} segment${invalidSegments === 1 ? "" : "s"} need talent or availability fixes before production can roll.`,
    };
  }

  if (validSegments < 2) {
    return {
      canRun: false,
      status: "Underbuilt Show",
      tone: "underbuilt",
      note: "Book at least 2 valid TV segments so the broadcast has more than one beat.",
    };
  }

  if (runtimeMinutes < showRuntimeMinMinutes) {
    return {
      canRun: false,
      status: "Underbuilt Show",
      tone: "underbuilt",
      note: `${showRuntimeMinMinutes - runtimeMinutes} more TV minutes needed to reach the live broadcast window.`,
    };
  }

  if (runtimeMinutes > tvRuntimeWarningMinutes) {
    return {
      canRun: false,
      status: "Overloaded Show",
      tone: "overloaded",
      note: `Cut ${runtimeMinutes - tvRuntimeWarningMinutes} TV minutes to fit the production block.`,
    };
  }

  if (runtimeMinutes > showRuntimeOvertimeMinutes) {
    return {
      canRun: true,
      status: "Overtime Window",
      tone: "warning",
      note: "This card can run, but the broadcast is packed. Trim time if you want a cleaner TV shape.",
    };
  }

  return {
    canRun: true,
    status: "Broadcast-Ready Window",
    tone: "ready",
    note: "The show has enough valid TV time and fits the production block.",
  };
}

function getBroadcastRuntimeRisk(runtimeMinutes: number) {
  if (runtimeMinutes > showRuntimeOvertimeMinutes) {
    return {
      tone: "strong",
      title: "Packed Broadcast Risk",
      note: "This card is packed. If live timing drifts, the main event could feel rushed.",
    };
  }

  if (runtimeMinutes > showRuntimeTargetMinutes) {
    return {
      tone: "warning",
      title: "Broadcast Risk",
      note: "The final block may lose breathing room if earlier segments run long.",
    };
  }

  if (runtimeMinutes >= showRuntimeTargetMinutes - 5) {
    return {
      tone: "soft",
      title: "Tight Timing Window",
      note: "This rundown leaves little room for live overrun.",
    };
  }

  return undefined;
}

function getSegmentParticipants(segment: Segment, wrestlers: Wrestler[]) {
  return segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function canWrestlersShareMatch(wrestlers: Wrestler[]) {
  const divisions = [...new Set(wrestlers.map((wrestler) => getWrestlerDivisionGroup(wrestler)).filter((division): division is "mens" | "womens" => Boolean(division)))];
  return divisions.length <= 1;
}

function wouldCreateIntergenderMatch(segment: Segment, wrestler: Wrestler, wrestlers: Wrestler[]) {
  if (segment.type !== "Match" || segment.participantIds.includes(wrestler.id)) {
    return false;
  }

  return !canWrestlersShareMatch([...getSegmentParticipants(segment, wrestlers), wrestler]);
}

function getInjuryStatusLabel(status: InjuryStatus) {
  if (status === "minor") {
    return "Minor Injury";
  }

  if (status === "major") {
    return "Major Injury";
  }

  return "Healthy";
}

function getInjuryDetail(wrestler: Wrestler) {
  if (wrestler.injuryStatus === "healthy") {
    return "Available";
  }

  const weeks = wrestler.injuryWeeksRemaining;
  return `${weeks} week${weeks === 1 ? "" : "s"} remaining${wrestler.injuryDescription ? ` · ${wrestler.injuryDescription}` : ""}`;
}

function getWrestlerStatus(wrestler: Wrestler): Exclude<RosterFilter, "All"> | "Steady" {
  if (wrestler.injuryStatus === "major") {
    return "Tired";
  }

  if (wrestler.fatigue >= 60) {
    return "Tired";
  }

  if (wrestler.morale <= 45) {
    return "Frustrated";
  }

  if (wrestler.momentum >= 65) {
    return "Hot";
  }

  return "Steady";
}

function getWeeksSinceLastBooked(wrestler: Wrestler, currentWeek: number) {
  if (!wrestler.lastBookedWeek) {
    return Math.max(0, currentWeek - 1);
  }

  return Math.max(0, currentWeek - wrestler.lastBookedWeek);
}

function getRosterPressureTags(wrestler: Wrestler, currentWeek: number): RosterPressureTag[] {
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, currentWeek);
  const isOverused = wrestler.fatigue >= 60 || (wrestler.consecutiveWeeksBooked ?? 0) >= 3;
  const tags: RosterPressureTag[] = [];

  if (wrestler.injuryStatus === "major") {
    tags.push("Unavailable");
  }

  if (wrestler.injuryStatus === "minor") {
    tags.push("Minor Injury");
  }

  if (wrestler.fatigue >= 75 || wrestler.injuryStatus === "minor") {
    tags.push("Injury Risk");
  }

  if (wrestler.morale <= 45) {
    tags.push("Morale Risk");
  }

  if (isOverused) {
    tags.push("Overused");
  }

  if (weeksSinceLastBooked >= 3) {
    tags.push("Underused");
  }

  if (wrestler.popularity >= 68 && wrestler.momentum >= 60 && !isOverused && wrestler.fatigue < 75) {
    tags.push("Protected Star");
  }

  return tags;
}

function getTopOverusedWrestler(wrestlers: Wrestler[]) {
  return wrestlers
    .filter((wrestler) => wrestler.fatigue >= 60 || (wrestler.consecutiveWeeksBooked ?? 0) >= 3)
    .sort((a, b) => b.fatigue + (b.consecutiveWeeksBooked ?? 0) * 8 - (a.fatigue + (a.consecutiveWeeksBooked ?? 0) * 8))[0];
}

function getTopUnderusedWrestler(wrestlers: Wrestler[], currentWeek: number) {
  return wrestlers
    .filter((wrestler) => getWeeksSinceLastBooked(wrestler, currentWeek) >= 3)
    .sort(
      (a, b) =>
        getWeeksSinceLastBooked(b, currentWeek) * 10 +
        b.popularity +
        b.momentum -
        (getWeeksSinceLastBooked(a, currentWeek) * 10 + a.popularity + a.momentum),
    )[0];
}

function getDraftSortValue(wrestler: Wrestler, sort: DraftSort) {
  if (sort === "rank") {
    return -(wrestler.draftRank ?? 999);
  }

  if (sort === "starPower") {
    return wrestler.popularity + wrestler.momentum;
  }

  if (sort === "fatigue") {
    return -wrestler.fatigue;
  }

  return wrestler[sort];
}

function getDraftSearchText(wrestler: Wrestler) {
  return [
    wrestler.name,
    wrestler.sourceBrand,
    wrestler.sourceAvailability,
    wrestler.roleTier,
    wrestler.alignment,
    wrestler.archetype,
    wrestler.division,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getDraftTag(value: string | undefined, fallback = "Unlisted") {
  return value?.trim() || fallback;
}

function getAverageDraftScore(wrestlers: Wrestler[], score: (wrestler: Wrestler) => number) {
  if (!wrestlers.length) {
    return 0;
  }

  return Math.round(wrestlers.reduce((sum, wrestler) => sum + score(wrestler), 0) / wrestlers.length);
}

function getDraftValueCounts(wrestlers: Wrestler[], getValue: (wrestler: Wrestler) => string | undefined) {
  return wrestlers.reduce<Record<string, number>>((counts, wrestler) => {
    const value = getDraftTag(getValue(wrestler));
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function getDraftCountSummary(counts: Record<string, number>, limit = 3) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return "No data";
  }

  return entries
    .slice(0, limit)
    .map(([label, count]) => `${label} ${count}`)
    .join(" / ");
}

function getMostCommonDraftValue(counts: Record<string, number>, fallback = "Balanced") {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function getDraftReviewPressure(wrestlers: Wrestler[]) {
  const sourceStatusWatch = wrestlers.filter((wrestler) => wrestler.sourceAvailability && wrestler.sourceAvailability !== "Active");
  const highFatigue = wrestlers.filter((wrestler) => wrestler.fatigue >= 40);
  const lowMorale = wrestlers.filter((wrestler) => wrestler.morale <= 64);
  const strongTalkers = wrestlers.filter((wrestler) => wrestler.promoSkill >= 85);
  const strongWorkers = wrestlers.filter((wrestler) => wrestler.ringSkill >= 85);
  const divisionCounts = getDraftValueCounts(wrestlers, (wrestler) => wrestler.division);
  const thinDivision = Object.entries(divisionCounts).find(([, count]) => count <= 2);

  if (sourceStatusWatch.length) {
    return {
      label: "Source Status Watch",
      value: `${sourceStatusWatch.length} Flagged`,
      detail: `${sourceStatusWatch.slice(0, 2).map((wrestler) => wrestler.name).join(" / ")} require a closer Week 1 read.`,
    };
  }

  if (highFatigue.length) {
    return {
      label: "Condition Watch",
      value: `${highFatigue.length} High Fatigue`,
      detail: `${highFatigue[0].name} is the first name to monitor before stacking TV time.`,
    };
  }

  if (lowMorale.length) {
    return {
      label: "Locker Room Watch",
      value: `${lowMorale.length} Low Morale`,
      detail: `${lowMorale[0].name} may need careful early usage to keep the room steady.`,
    };
  }

  if (strongTalkers.length < 4) {
    return {
      label: "Promo Depth",
      value: `${strongTalkers.length} Elite Talkers`,
      detail: "The room may need simple early mic assignments until voices separate.",
    };
  }

  if (strongWorkers.length < 4) {
    return {
      label: "Ring Depth",
      value: `${strongWorkers.length} Elite Workers`,
      detail: "The first cards may need protected matchups while the bell-to-bell core forms.",
    };
  }

  if (thinDivision) {
    return {
      label: "Division Shape",
      value: `${thinDivision[0]} ${thinDivision[1]}`,
      detail: "One side of the room is thinner, so early booking should balance exposure.",
    };
  }

  return {
    label: "Opening Pressure",
    value: "Balanced Room",
    detail: "No single pressure point dominates the first Week 1 board.",
  };
}

function getDraftReviewRead(wrestlers: Wrestler[]) {
  const averageRing = getAverageDraftScore(wrestlers, (wrestler) => wrestler.ringSkill);
  const averagePromo = getAverageDraftScore(wrestlers, (wrestler) => wrestler.promoSkill);
  const tierCounts = getDraftValueCounts(wrestlers, (wrestler) => wrestler.roleTier);
  const archetypeCounts = getDraftValueCounts(wrestlers, (wrestler) => wrestler.archetype);
  const brandCounts = getDraftValueCounts(wrestlers, (wrestler) => wrestler.sourceBrand);
  const topTier = getMostCommonDraftValue(tierCounts, "Mixed Tier");
  const topArchetype = getMostCommonDraftValue(archetypeCounts, "Mixed Style");
  const sourceMix = Object.keys(brandCounts).length;
  const identity =
    averagePromo >= averageRing + 4
      ? "a mic-forward locker room"
      : averageRing >= averagePromo + 4
        ? "a bell-to-bell locker room"
        : "a balanced TV locker room";

  return `This reads like ${identity} leaning ${topArchetype}, with ${topTier} depth setting the tone. You pulled from ${sourceMix} source brand${sourceMix === 1 ? "" : "s"}, so Week 1 can be framed as an open-board roster rather than a brand-restricted room.`;
}

function getRosterLeader(wrestlers: Wrestler[], score: (wrestler: Wrestler) => number) {
  return [...wrestlers].sort((a, b) => score(b) - score(a))[0];
}

function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}

function isSinglesChampionship(championship: Championship) {
  return championship.division !== "Tag Team" && championship.championIds.length === 1;
}

function canSegmentContestChampionship(segment: Segment, championship: Championship) {
  return (
    segment.type === "Match" &&
    isValidSegment(segment) &&
    segment.participantIds.length === 2 &&
    isSinglesChampionship(championship) &&
    segment.participantIds.includes(championship.championIds[0])
  );
}

function canSegmentAttachChampionship(segment: Segment, championship: Championship) {
  if (canSegmentContestChampionship(segment, championship)) {
    return true;
  }

  if (segment.type === "Contract Signing") {
    return isValidSegment(segment) && isSinglesChampionship(championship) && segment.participantIds.includes(championship.championIds[0]);
  }

  if (segment.type === "Open Challenge") {
    return isValidSegment(segment) && championship.championIds.includes(segment.participantIds[0]);
  }

  return false;
}

function getTopContenders(championship: Championship, wrestlers: Wrestler[], limit = 3) {
  return [...wrestlers]
    .filter((wrestler) => !championship.championIds.includes(wrestler.id))
    .sort((a, b) => b.popularity + b.momentum - (a.popularity + a.momentum))
    .slice(0, limit);
}

function getReignLength(championship: Championship, currentWeek: number) {
  return Math.max(1, currentWeek - championship.reignStartWeek + 1);
}

function getChampionshipHistory(game: GameState, championshipId: string, limit = 5) {
  return [...(game.championshipHistory ?? [])]
    .filter((event) => event.championshipId === championshipId)
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

function getRivalryHistory(game: GameState, rivalryId: string, limit = 5) {
  return [...(game.rivalryHistory ?? [])]
    .filter((event) => event.rivalryId === rivalryId)
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

function getWrestlerTitleHistory(game: GameState, wrestlerId: string, limit = 5) {
  return [...(game.championshipHistory ?? [])]
    .filter((event) => event.championIds.includes(wrestlerId) || Boolean(event.previousChampionIds?.includes(wrestlerId)))
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

function getWrestlerRivalryHistory(game: GameState, wrestlerId: string, limit = 5) {
  const majorEventTypes: RivalryHistoryEvent["eventType"][] = ["started", "heated_up", "became_stale", "ended", "ple_payoff"];

  return [...(game.rivalryHistory ?? [])]
    .filter((event) => event.participantIds.includes(wrestlerId) && majorEventTypes.includes(event.eventType))
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)
    .slice(0, limit);
}

function formatHistoryStamp(event: Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "seasonNumber" | "weekNumber" | "showName" | "showType">) {
  const showLabel = event.showName ? ` · ${event.showName}${event.showType ? ` (${getShowTypeLabel(event.showType)})` : ""}` : "";
  return `S${event.seasonNumber} W${event.weekNumber}${showLabel}`;
}

function formatChampionshipEventType(eventType: ChampionshipHistoryEvent["eventType"]) {
  return eventType === "title_change" ? "Title Change" : "Successful Defense";
}

function formatRivalryEventType(eventType: RivalryHistoryEvent["eventType"]) {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function hasPlePayoff(game: GameState, rivalryId: string) {
  return (game.rivalryHistory ?? []).some((event) => event.rivalryId === rivalryId && event.eventType === "ple_payoff");
}

function canSegmentAttachRivalry(segment: Segment, rivalry: Rivalry) {
  return segment.type !== "Open Challenge" && (!segment.participantIds.length || segment.participantIds.some((id) => rivalry.participantIds.includes(id)));
}

function isSmartRundownAvailable(wrestler: Wrestler) {
  return wrestler.injuryStatus !== "major";
}

function getSmartWeeksOff(wrestler: Wrestler, currentWeek: number) {
  return wrestler.lastBookedWeek ? Math.max(0, currentWeek - wrestler.lastBookedWeek) : currentWeek;
}

function getSmartUsagePenalty(wrestler: Wrestler, usage: Record<string, number>) {
  return (usage[wrestler.id] ?? 0) * 26;
}

function getSmartTalentScore(
  wrestler: Wrestler,
  game: GameState,
  usage: Record<string, number>,
  role: "match" | "promo" | "story" = "match",
) {
  const championBonus = game.championships.some((championship) => championship.championIds.includes(wrestler.id)) ? 10 : 0;
  const rivalryBonus = game.rivalries.some((rivalry) => rivalry.participantIds.includes(wrestler.id)) ? 8 : 0;
  const underuseBonus = Math.min(18, getSmartWeeksOff(wrestler, game.currentWeek) * 4);
  const conditionBonus = Math.max(0, 35 - wrestler.fatigue) * 0.35;
  const roleSkill = role === "promo" ? wrestler.promoSkill * 0.18 : role === "story" ? wrestler.momentum * 0.2 : wrestler.ringSkill * 0.18;

  return (
    wrestler.popularity * 0.28 +
    wrestler.momentum * 0.24 +
    wrestler.morale * 0.08 +
    roleSkill +
    championBonus +
    rivalryBonus +
    underuseBonus +
    conditionBonus -
    wrestler.fatigue * 0.22 -
    getSmartUsagePenalty(wrestler, usage)
  );
}

function sortSmartTalent(
  wrestlers: Wrestler[],
  game: GameState,
  usage: Record<string, number>,
  role: "match" | "promo" | "story" = "match",
) {
  return [...wrestlers].sort(
    (a, b) =>
      getSmartTalentScore(b, game, usage, role) - getSmartTalentScore(a, game, usage, role) ||
      b.popularity - a.popularity ||
      b.momentum - a.momentum ||
      a.fatigue - b.fatigue ||
      a.name.localeCompare(b.name),
  );
}

function getSmartPairKey(ids: string[]) {
  return [...ids].sort().join("|");
}

function getSmartRivalry(game: GameState, available: Wrestler[]) {
  const availableIds = new Set(available.map((wrestler) => wrestler.id));

  return [...game.rivalries]
    .filter((rivalry) => rivalry.participantIds.length === 2 && rivalry.participantIds.every((id) => availableIds.has(id)))
    .sort((a, b) => b.heat + b.freshness - (a.heat + a.freshness) || a.name.localeCompare(b.name))[0];
}

function chooseSmartTalent(
  game: GameState,
  available: Wrestler[],
  usage: Record<string, number>,
  role: "match" | "promo" | "story",
  excludeIds: string[] = [],
) {
  const excluded = new Set(excludeIds);
  return sortSmartTalent(
    available.filter((wrestler) => !excluded.has(wrestler.id) && (usage[wrestler.id] ?? 0) < 2),
    game,
    usage,
    role,
  )[0];
}

function chooseSmartPair(
  game: GameState,
  available: Wrestler[],
  usage: Record<string, number>,
  usedPairs: Set<string>,
) {
  const sorted = sortSmartTalent(available, game, usage, "match").filter((wrestler) => (usage[wrestler.id] ?? 0) < 2);

  for (const first of sorted) {
    const second = sorted.find(
      (candidate) =>
        candidate.id !== first.id &&
        !usedPairs.has(getSmartPairKey([first.id, candidate.id])) &&
        canWrestlersShareMatch([first, candidate]),
    );
    if (second) {
      return [first, second];
    }
  }

  return [];
}

function buildSmartSegment(
  game: GameState,
  optionId: string,
  participantIds: string[],
  durationMinutes: number,
  index: number,
  rivalryId?: string,
) {
  const option = getCatalogOptionById(optionId) ?? getDefaultCatalogOption("Match")!;
  let segment: Segment = {
    id: `smart-${Date.now()}-${index}`,
    type: option.family,
    participantIds,
    segmentCatalogId: option.id,
    segmentDisplayName: option.label,
    durationMinutes,
    participantMin: option.minParticipants,
    participantMax: option.maxParticipants,
    rivalryId,
  };

  if (option.championshipAllowed) {
    const championship = game.championships.find((title) => canSegmentAttachChampionship(segment, title));
    if (championship) {
      segment = { ...segment, championshipId: championship.id };
    }
  }

  return segment;
}

function buildSmartRundown(game: GameState): SmartRundownResult {
  const available = game.wrestlers.filter(isSmartRundownAvailable);
  const notes = new Set<string>();
  const segments: Segment[] = [];
  const usage: Record<string, number> = {};
  const usedPairs = new Set<string>();
  const addSegment = (optionId: string, participantIds: string[], durationMinutes: number, rivalryId?: string) => {
    const segment = buildSmartSegment(game, optionId, participantIds, durationMinutes, segments.length, rivalryId);
    if (!isValidSegment(segment, game.wrestlers)) {
      return false;
    }

    segments.push(segment);
    participantIds.forEach((id) => {
      usage[id] = (usage[id] ?? 0) + 1;
    });

    if (participantIds.length === 2) {
      usedPairs.add(getSmartPairKey(participantIds));
    }

    return true;
  };

  if (available.length < 4) {
    return {
      error: "Production needs at least 4 available wrestlers to draft a varied TV card.",
      notes: [],
      segments: [],
    };
  }

  const rivalry = getSmartRivalry(game, available);

  if (rivalry) {
    const [firstId, secondId] = rivalry.participantIds;
    const first = available.find((wrestler) => wrestler.id === firstId);
    const second = available.find((wrestler) => wrestler.id === secondId);

    if (first && second) {
      addSegment("P003", [first.id], 14, rivalry.id);
      if (canWrestlersShareMatch([first, second])) {
        addSegment(rivalry.heat >= 65 ? "M019" : "M001", [first.id, second.id], 30, rivalry.id);
        notes.add(`Featured active rivalry: ${rivalry.name}.`);
      } else {
        notes.add(`Featured ${rivalry.name} in a talk segment because current match rules need same-division competitors.`);
      }
    }
  }

  if (!segments.some((segment) => segment.type === "Match")) {
    const pair = chooseSmartPair(game, available, usage, usedPairs);
    if (pair.length === 2) {
      addSegment("M001", pair.map((wrestler) => wrestler.id), 28);
      notes.add(`Built a match around visible popularity, momentum, and manageable fatigue.`);
    }
  }

  if (!segments.some((segment) => segment.type === "Promo")) {
    const promoTalent = chooseSmartTalent(game, available, usage, "promo");
    if (promoTalent) {
      addSegment("P001", [promoTalent.id], 16);
      notes.add(`Showcased a strong talker with visible popularity or momentum.`);
    }
  }

  if (!segments.some((segment) => segment.type === "Backstage Angle" || segment.type === "Contract Signing" || segment.type === "Open Challenge")) {
    const storyTalent = chooseSmartTalent(game, available, usage, "story");
    const rivalryParticipants = rivalry?.participantIds.filter((id) => (usage[id] ?? 0) < 2) ?? [];

    if (rivalry && rivalryParticipants.length === 2) {
      addSegment("A046", rivalryParticipants, 14, rivalry.id);
      notes.add(`Added backstage texture so the rivalry has more than one TV surface.`);
    } else if (storyTalent) {
      addSegment("A001", [storyTalent.id], 14);
      notes.add(`Added backstage texture so the card is not only bell-to-bell segments.`);
    }
  }

  while (segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0) < showRuntimeMinMinutes && segments.length < 8) {
    const currentRuntime = segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
    const remaining = showRuntimeMinMinutes - currentRuntime;
    const pair = chooseSmartPair(game, available, usage, usedPairs);

    if (remaining >= 20 && pair.length === 2) {
      addSegment("M001", pair.map((wrestler) => wrestler.id), Math.min(26, Math.max(20, remaining)));
      notes.add(`Added another match to bring the card into the broadcast window.`);
      continue;
    }

    const talker = chooseSmartTalent(game, available, usage, "promo");
    if (talker && addSegment("P002", [talker.id], Math.min(14, Math.max(10, remaining)))) {
      notes.add(`Used short hype time to fill the TV block without forcing another match.`);
      continue;
    }

    break;
  }

  const mainEventCandidate = segments
    .map((segment, index) => ({
      index,
      segment,
      score: segment.participantIds.reduce((sum, id) => {
        const wrestler = game.wrestlers.find((talent) => talent.id === id);
        return sum + (wrestler ? wrestler.popularity + wrestler.momentum - wrestler.fatigue * 0.2 : 0);
      }, 0) + (segment.rivalryId ? 40 : 0) + (segment.type === "Match" ? 20 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (mainEventCandidate && mainEventCandidate.index !== segments.length - 1) {
    const [mainEvent] = segments.splice(mainEventCandidate.index, 1);
    segments.push(mainEvent);
    notes.add(`Moved the strongest visible rivalry/star-power segment into the closing slot.`);
  }

  const runtime = segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const readiness = getShowReadiness(segments.length, segments.filter((segment) => !isValidSegment(segment, game.wrestlers)).length, runtime);

  if (!readiness.canRun) {
    return {
      error: `Production could not safely draft a ready card: ${readiness.note}`,
      notes: [...notes],
      segments: [],
    };
  }

  const protectedNames = available
    .filter((wrestler) => wrestler.fatigue >= 60 && !(usage[wrestler.id] > 0))
    .slice(0, 2)
    .map((wrestler) => wrestler.name);
  const underusedNames = available
    .filter((wrestler) => (usage[wrestler.id] ?? 0) > 0 && getSmartWeeksOff(wrestler, game.currentWeek) >= 2)
    .slice(0, 2)
    .map((wrestler) => wrestler.name);

  if (protectedNames.length) {
    notes.add(`Protected tired talent: ${protectedNames.join(" / ")} stayed off the draft card.`);
  }

  if (underusedNames.length) {
    notes.add(`Gave underused talent TV time: ${underusedNames.join(" / ")}.`);
  }

  notes.add(`Kept the rough draft inside the ${showRuntimeMinMinutes}-${showRuntimeOvertimeMinutes} minute broadcast-ready window and away from an overrun-heavy layout.`);

  return {
    notes: [...notes],
    segments,
  };
}

function getRivalryParticipants(rivalry: Rivalry, wrestlers: Wrestler[]) {
  return rivalry.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function getHottestRivalry(rivalries: Rivalry[]) {
  return [...rivalries].sort((a, b) => b.heat - a.heat)[0];
}

function getCoolingRivalry(rivalries: Rivalry[]) {
  return rivalries.find((rivalry) => rivalry.status === "stale") ?? rivalries.find((rivalry) => rivalry.status === "cooling");
}

function hasDuplicateRivalry(rivalries: Rivalry[], wrestlerAId: string, wrestlerBId: string) {
  const pair = [wrestlerAId, wrestlerBId].sort().join("|");
  return rivalries.some((rivalry) => [...rivalry.participantIds].sort().join("|") === pair);
}

function formatRivalryStatus(status: Rivalry["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRivalryStakes(stakes: RivalryStakes) {
  return stakes.charAt(0).toUpperCase() + stakes.slice(1);
}

function getInitialRivalryHeat(wrestlerA: Wrestler, wrestlerB: Wrestler) {
  return Math.round((wrestlerA.popularity + wrestlerB.popularity + wrestlerA.momentum + wrestlerB.momentum) / 4);
}

function getShowTypeLabel(showType: ShowType) {
  return showType === "ple" ? "PLE" : "TV";
}

function getNextPle(calendar: CalendarWeek[], currentWeek: number) {
  return calendar.find((week) => week.showType === "ple" && week.weekNumber >= currentWeek && !week.completed);
}

function getWeeksUntilPle(nextPle: CalendarWeek | undefined, currentWeek: number) {
  if (!nextPle) {
    return 0;
  }

  return Math.max(0, nextPle.weekNumber - currentWeek);
}

function getBestShow(showHistory: ShowResult[], seasonNumber?: number) {
  const results = seasonNumber ? showHistory.filter((result) => result.seasonNumber === seasonNumber) : showHistory;
  return results.reduce<ShowResult | undefined>((best, result) => (!best || result.totalScore > best.totalScore ? result : best), undefined);
}

function getLatestFinanceReport(game: GameState) {
  return game.financeReports[game.financeReports.length - 1];
}

function getFinanceReportForResult(game: GameState, result: ShowResult) {
  return game.financeReports.find((report) => report.id === `${result.id}-finance`);
}

function getSeasonFinanceReports(game: GameState) {
  return game.financeReports.filter((report) => report.seasonNumber === game.seasonNumber);
}

function getBestRevenueReport(reports: FinanceReport[]) {
  return reports.reduce<FinanceReport | undefined>((best, report) => {
    const revenue = report.ticketRevenue + report.merchRevenue + report.mediaRevenue;
    const bestRevenue = best ? best.ticketRevenue + best.merchRevenue + best.mediaRevenue : -Infinity;
    return revenue > bestRevenue ? report : best;
  }, undefined);
}

function getWorstProfitReport(reports: FinanceReport[]) {
  return reports.reduce<FinanceReport | undefined>((worst, report) => (!worst || report.profitLoss < worst.profitLoss ? report : worst), undefined);
}

function getSeasonTitleHistory(game: GameState) {
  return (game.championshipHistory ?? []).filter((event) => event.seasonNumber === game.seasonNumber);
}

function getSeasonRivalryHistory(game: GameState) {
  return (game.rivalryHistory ?? []).filter((event) => event.seasonNumber === game.seasonNumber);
}

function getBiggestTitleChange(game: GameState) {
  return getSeasonTitleHistory(game)
    .filter((event) => event.eventType === "title_change")
    .sort((a, b) => {
      const titleA = game.championships.find((championship) => championship.id === a.championshipId);
      const titleB = game.championships.find((championship) => championship.id === b.championshipId);
      return (titleB?.prestige ?? 0) - (titleA?.prestige ?? 0) || b.weekNumber - a.weekNumber;
    })[0];
}

function getMostDefendedChampionship(game: GameState) {
  const defenseCounts = getSeasonTitleHistory(game)
    .filter((event) => event.eventType === "successful_defense")
    .reduce<Record<string, number>>((counts, event) => ({ ...counts, [event.championshipId]: (counts[event.championshipId] ?? 0) + 1 }), {});
  const [championshipId, count] = Object.entries(defenseCounts).sort((a, b) => b[1] - a[1])[0] ?? [];
  const championship = game.championships.find((title) => title.id === championshipId);

  return championship && count ? { championship, count } : undefined;
}

function getHottestRivalryStory(game: GameState) {
  const history = getSeasonRivalryHistory(game);
  const hottestEvent = [...history].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))[0];
  const activeRivalry = hottestEvent ? game.rivalries.find((rivalry) => rivalry.id === hottestEvent.rivalryId) : undefined;

  if (hottestEvent) {
    return { name: hottestEvent.rivalryName, heat: hottestEvent.heat ?? activeRivalry?.heat ?? 0, note: hottestEvent.note };
  }

  const hottestRivalry = getHottestRivalry(game.rivalries);
  return hottestRivalry ? { name: hottestRivalry.name, heat: hottestRivalry.heat, note: "No recorded rivalry history event this season yet." } : undefined;
}

function getMostEventfulRivalry(game: GameState) {
  const eventCounts = getSeasonRivalryHistory(game).reduce<Record<string, { name: string; count: number }>>((counts, event) => {
    const current = counts[event.rivalryId] ?? { name: event.rivalryName, count: 0 };
    return { ...counts, [event.rivalryId]: { ...current, count: current.count + 1 } };
  }, {});
  return Object.values(eventCounts).sort((a, b) => b.count - a.count)[0];
}

function getNotablePlePayoff(game: GameState) {
  return getSeasonRivalryHistory(game)
    .filter((event) => event.eventType === "ple_payoff")
    .sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0) || b.weekNumber - a.weekNumber)[0];
}

function formatSocialCategory(category: SocialCategory) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSocialTone(tone: SocialPost["tone"]) {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

function getSocialFilterCategory(filter: SocialFilter): SocialCategory[] | null {
  if (filter === "Fan Reaction") {
    return ["fan_praise", "push_complaint", "viral_moment", "ple_reaction", "fatigue_concern"];
  }

  if (filter === "Dirt Sheets") {
    return ["dirt_sheet"];
  }

  if (filter === "Analyst Takes") {
    return ["analyst_take"];
  }

  if (filter === "Title Scene") {
    return ["title_scene"];
  }

  if (filter === "Rivalries") {
    return ["rivalry_heat"];
  }

  return null;
}

function getRelatedWrestlerNames(post: SocialPost, wrestlers: Wrestler[]) {
  return post.relatedWrestlerIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name).filter(Boolean).join(" / ");
}

function getWrestlerChampionships(wrestlerId: string, championships: Championship[]) {
  return championships.filter((championship) => championship.championIds.includes(wrestlerId));
}

function getWrestlerRivalries(wrestlerId: string, rivalries: Rivalry[]) {
  return rivalries.filter((rivalry) => rivalry.participantIds.includes(wrestlerId));
}

function getRecentWrestlerAppearances(game: GameState, wrestlerId: string, limit = 5): WrestlerAppearance[] {
  return [...game.showHistory]
    .reverse()
    .flatMap((result) =>
      result.segmentResults
        .filter((segment) => segment.participantIds.includes(wrestlerId))
        .map((segment) => ({
          id: `${result.id}-${segment.segmentId}`,
          week: result.week,
          showName: result.showName,
          type: segment.type,
          score: segment.score,
          note: segment.titleNote ?? segment.rivalryNote ?? segment.recapNote,
        })),
    )
    .slice(0, limit);
}

function getRecentWrestlerSocialPosts(game: GameState, wrestlerId: string, limit = 5) {
  return game.socialPosts
    .filter((post) => post.relatedWrestlerIds.includes(wrestlerId))
    .slice(-limit)
    .reverse();
}

function getPrimaryStrength(wrestler: Wrestler) {
  if (wrestler.ringSkill >= wrestler.promoSkill + 8) {
    return `Ring work is the strongest lever at ${wrestler.ringSkill}.`;
  }

  if (wrestler.promoSkill >= wrestler.ringSkill + 8) {
    return `Promo work is the strongest lever at ${wrestler.promoSkill}.`;
  }

  return `Balanced ring and promo value gives you booking flexibility.`;
}

function getGMRead(wrestler: Wrestler, game: GameState): GMRead {
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const rivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const hasTitle = championships.length > 0;
  const hasRivalry = rivalries.length > 0;
  const usefulness =
    hasTitle
      ? `${wrestler.name} carries championship value as ${championships.map((championship) => championship.name).join(" / ")} holder.`
      : hasRivalry
        ? `${wrestler.name} has active story value in ${rivalries[0].name}.`
        : wrestler.momentum >= 65
          ? `${wrestler.name} is hot right now with ${wrestler.momentum} momentum.`
          : wrestler.popularity >= 68
            ? `${wrestler.name} has star power at ${wrestler.popularity} popularity.`
            : getPrimaryStrength(wrestler);

  const risk =
    wrestler.injuryStatus === "major"
      ? `${wrestler.name} is off the board with a major injury.`
      : wrestler.injuryStatus === "minor"
        ? `${wrestler.name} is working hurt, so every booking needs a lighter touch.`
        : pressureTags.includes("Injury Risk")
      ? `${wrestler.name} is carrying ${wrestler.fatigue} fatigue, high enough to light up medical concern.`
      : pressureTags.includes("Overused")
        ? `${wrestler.name} is carrying overuse pressure from fatigue or a long TV streak.`
        : pressureTags.includes("Morale Risk")
          ? `${wrestler.name} is at ${wrestler.morale} morale, which makes the next usage matter.`
          : weeksSinceLastBooked >= 3
            ? `${wrestler.name} has been off TV for ${weeksSinceLastBooked} weeks and is fading from the weekly board.`
            : "No major pressure label is active right now.";

  const need =
    wrestler.injuryStatus === "major"
      ? "Needs recovery time before they can be booked again."
      : wrestler.injuryStatus === "minor"
        ? "Can work, but needs protection instead of grind."
        : pressureTags.includes("Injury Risk") || wrestler.fatigue >= 70
      ? "Needs rest or a protected usage."
      : pressureTags.includes("Overused")
        ? "Needs lighter TV before the workload becomes the story."
        : pressureTags.includes("Underused")
          ? "Needs TV time before the absence becomes a locker room issue."
          : pressureTags.includes("Morale Risk")
            ? "Needs meaningful TV time or a stabilizing role."
            : wrestler.momentum < 45
              ? "Needs a momentum spark if they are going to matter on the card."
              : "Can be used for momentum, story texture, or a steady card role.";

  return { usefulness, risk, need };
}

function buildBroadcastRecap(result: ShowResult) {
  const bestSegment = getBestSegment(result);
  const bestNames = bestSegment.participantNames.join(" / ");
  const titleFallout = result.titleNotes?.length ? ` Title fallout: ${result.titleNotes.join(" ")}` : "";
  const rivalryFallout = result.rivalryNotes?.length ? ` Story movement: ${result.rivalryNotes[0]}` : "";
  const runtimeFallout = result.broadcastOverrunNotes?.length ? ` Production note: ${result.broadcastOverrunNotes[0]}` : "";
  const scoreTone = result.totalScore >= 85 ? "premium" : result.totalScore >= 70 ? "controlled" : result.totalScore >= 55 ? "uneven" : "cold";
  const showFrame =
    result.showType === "ple"
      ? `${result.showName} gave ${result.brandName} a ${scoreTone} major-event receipt`
      : `${result.brandName} posted a ${scoreTone} ${result.totalScore} (${getShowGrade(result.totalScore)})`;

  return `${showFrame} in Week ${result.week}. ${bestNames} delivered the strongest ${bestSegment.type.toLowerCase()} at ${bestSegment.score}. ${result.biggestMomentumGain.name} gained the most momentum, while ${result.biggestFatigueIncrease.name} took the biggest fatigue hit.${runtimeFallout}${titleFallout}${rivalryFallout}`;
}

function buildSavedGameState(
  game: GameState,
  screen: SavedGameState["screen"],
  profileState?: Pick<SavedGameState, "profileReturnScreen" | "profileWrestlerId">,
): SavedGameState {
  return { game, screen, ...profileState };
}

function buildCareerPreview(state: SavedGameState): CareerPreview {
  return {
    brandName: state.game.brandName,
    gmName: state.game.gmName,
    money: state.game.money,
    screen: state.screen,
    seasonNumber: state.game.seasonNumber,
    week: state.game.currentWeek,
  };
}

function normalizeCareerSave(record: StoredSaveRecord): CareerSave | null {
  const migratedState = migrateSavedGameState(record.state);

  if (!migratedState) {
    console.warn("Saved career state is invalid.");
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    lastPlayedAt: record.lastPlayedAt,
    state: migratedState,
    preview: buildCareerPreview(migratedState),
  };
}

function loadCareerSaves() {
  const careerSaves: CareerSave[] = [];

  loadSaveRecords().forEach((record) => {
    const careerSave = normalizeCareerSave(record);

    if (careerSave) {
      careerSaves.push(careerSave);
      return;
    }

    deleteSaveRecord(record.id);
  });

  return careerSaves;
}

function getMostRecentCareer(careerSaves: CareerSave[]) {
  return careerSaves[0] ?? null;
}

function isQaHarnessRequested() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get(qaHarnessParam) === "runtime";
}

function buildQaRuntimeHarnessState(): SavedGameState {
  const draftedWrestlers = draftPool.slice(0, draftPickCount);
  const game = createNewGame({
    ...defaultCareer,
    draftedWrestlers,
    brandName: "QA Runtime",
    brandStyle: "Raw",
    rivalGMAssignments: createRivalGMAssignments("Raw"),
  });

  return buildSavedGameState(game, "booking");
}

function App() {
  const qaHarnessState = useMemo(() => (isQaHarnessRequested() ? buildQaRuntimeHarnessState() : null), []);
  const isQaHarness = Boolean(qaHarnessState);
  const [careerSaves, setCareerSaves] = useState<CareerSave[]>(() => loadCareerSaves());
  const [savedGame, setSavedGame] = useState<SavedGameState | null>(qaHarnessState);
  const [activeSaveId, setActiveSaveId] = useState<string | undefined>();
  const [screen, setScreen] = useState<Screen>(qaHarnessState?.screen ?? "title");
  const [titleMode, setTitleMode] = useState<TitleMode>("home");
  const [game, setGame] = useState<GameState | null>(qaHarnessState?.game ?? null);
  const [profileWrestlerId, setProfileWrestlerId] = useState<string | undefined>(qaHarnessState?.profileWrestlerId);
  const [profileReturnScreen, setProfileReturnScreen] = useState<ProfileReturnScreen>(qaHarnessState?.profileReturnScreen ?? "roster");
  const latestResult = game?.showHistory[game.showHistory.length - 1];
  const recentCareer = getMostRecentCareer(careerSaves);

  function refreshCareerSaves() {
    const updatedCareerSaves = loadCareerSaves();
    setCareerSaves(updatedCareerSaves);
    return updatedCareerSaves;
  }

  function persistGameSnapshot(
    nextGame: GameState,
    nextScreen: SavedGameState["screen"],
    profileState?: Pick<SavedGameState, "profileReturnScreen" | "profileWrestlerId">,
  ) {
    const nextSavedGame = buildSavedGameState(nextGame, nextScreen, profileState);

    if (isQaHarness) {
      setSavedGame(nextSavedGame);
      return nextSavedGame;
    }

    if (!activeSaveId) {
      console.warn("Could not save career because no active save is selected.");
      setSavedGame(nextSavedGame);
      return nextSavedGame;
    }

    const updatedRecord = updateSaveRecord(activeSaveId, nextSavedGame);

    if (!updatedRecord) {
      console.warn("Could not update the active career save.");
    }

    refreshCareerSaves();
    setSavedGame(nextSavedGame);
    return nextSavedGame;
  }

  function startNewGame() {
    if (careerSaves.length >= MAX_SAVE_SLOTS) {
      window.alert(`You already have ${MAX_SAVE_SLOTS} careers. Delete a career from Load Careers before starting a new one.`);
      return;
    }

    setActiveSaveId(undefined);
    setSavedGame(null);
    setGame(null);
    setProfileWrestlerId(undefined);
    setProfileReturnScreen("roster");
    setTitleMode("home");
    setScreen("setup");
  }

  function startCareer(career: {
    gmName: string;
    gmStyle: GMStyle;
    brandName: string;
    brandStyle: BrandStyle;
    difficulty: GameDifficulty;
    startingBudgetTier: StartingBudgetTier;
    rivalGMAssignments: RivalGMAssignment[];
    draftedWrestlers: Wrestler[];
  }) {
    const newGame = createNewGame(career);
    const nextSavedGame = buildSavedGameState(newGame, "dashboard");
    const createdRecord = createSaveRecord(nextSavedGame, `${career.brandName} Career`);

    if (!createdRecord) {
      window.alert(`You already have ${MAX_SAVE_SLOTS} careers. Delete a career from Load Careers before starting a new one.`);
      setScreen("title");
      return;
    }

    setActiveSaveId(createdRecord.id);
    refreshCareerSaves();
    setSavedGame(nextSavedGame);
    setGame(newGame);
    setProfileWrestlerId(undefined);
    setProfileReturnScreen("roster");
    setScreen("dashboard");
  }

  function loadCareer(careerSave: CareerSave) {
    updateSaveRecord(careerSave.id, careerSave.state);
    refreshCareerSaves();
    setActiveSaveId(careerSave.id);
    setSavedGame(careerSave.state);
    setGame(careerSave.state.game);
    setProfileWrestlerId(careerSave.state.profileWrestlerId);
    setProfileReturnScreen(careerSave.state.profileReturnScreen ?? "roster");
    setTitleMode("home");
    setScreen(careerSave.state.screen);
  }

  function continueGame() {
    if (!recentCareer) {
      return;
    }

    loadCareer(recentCareer);
  }

  function renameCareer(careerSave: CareerSave) {
    const nextName = window.prompt("Rename career save", careerSave.name);

    if (nextName === null) {
      return;
    }

    const renamedRecord = renameSaveRecord(careerSave.id, nextName);

    if (!renamedRecord) {
      return;
    }

    refreshCareerSaves();
  }

  function deleteCareer(careerSave: CareerSave) {
    if (!window.confirm(`Delete "${careerSave.name}"? This cannot be undone.`)) {
      return;
    }

    deleteSaveRecord(careerSave.id);
    const updatedCareerSaves = refreshCareerSaves();

    if (careerSave.id === activeSaveId) {
      setActiveSaveId(undefined);
      setSavedGame(null);
      setGame(null);
      setProfileWrestlerId(undefined);
      setProfileReturnScreen("roster");
      setScreen("title");
    }

    if (!updatedCareerSaves.length) {
      setTitleMode("home");
    }
  }

  function navigateTo(nextScreen: GameScreen) {
    if (!game) {
      return;
    }

    persistGameSnapshot(game, nextScreen);
    setProfileWrestlerId(undefined);
    setProfileReturnScreen(nextScreen === "booking" ? "booking" : "roster");
    setScreen(nextScreen);
  }

  function openWrestlerProfile(wrestlerId: string, returnScreen: ProfileReturnScreen) {
    if (!game || !game.wrestlers.some((wrestler) => wrestler.id === wrestlerId)) {
      return;
    }

    const profileState = { profileReturnScreen: returnScreen, profileWrestlerId: wrestlerId };
    persistGameSnapshot(game, "profile", profileState);
    setProfileWrestlerId(wrestlerId);
    setProfileReturnScreen(returnScreen);
    setScreen("profile");
  }

  function closeWrestlerProfile(returnScreen: ProfileReturnScreen) {
    if (!game) {
      return;
    }

    persistGameSnapshot(game, returnScreen);
    setProfileWrestlerId(undefined);
    setProfileReturnScreen(returnScreen);
    setScreen(returnScreen);
  }

  function addSegment(type: SegmentType, segmentId?: string) {
    setGame((current) => {
      if (!current || current.currentShow.length >= maxBookingSegments) {
        return current;
      }

      const catalogOption = getDefaultCatalogOption(type);
      const updatedGame = {
        ...current,
        currentShow: [
          ...current.currentShow,
          {
            id: segmentId ?? `segment-${Date.now()}-${current.currentShow.length}`,
            type,
            participantIds: [],
            segmentCatalogId: catalogOption?.id,
            segmentDisplayName: catalogOption?.label,
            durationMinutes: catalogOption?.defaultDurationMinutes,
            participantMin: catalogOption?.minParticipants,
            participantMax: catalogOption?.maxParticipants,
          },
        ],
      };

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function updateSegment(segmentId: string, updates: Partial<Segment>) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          let updatedSegment = { ...segment, ...updates };
          const range = getSegmentParticipantRange(updatedSegment);

          if (updatedSegment.participantIds.length > range.max) {
            updatedSegment = { ...updatedSegment, participantIds: updatedSegment.participantIds.slice(0, range.max) };
          }

          const championship = updatedSegment.championshipId
            ? current.championships.find((title) => title.id === updatedSegment.championshipId)
            : undefined;

          if (championship && !canSegmentAttachChampionship(updatedSegment, championship)) {
            updatedSegment = { ...updatedSegment, championshipId: undefined };
          }

          const rivalry = updatedSegment.rivalryId
            ? current.rivalries.find((activeRivalry) => activeRivalry.id === updatedSegment.rivalryId)
            : undefined;

          if (rivalry && !canSegmentAttachRivalry(updatedSegment, rivalry)) {
            updatedSegment = { ...updatedSegment, rivalryId: undefined };
          }

          return updatedSegment;
        }),
      };

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function replaceCurrentShow(segments: Segment[]) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = { ...current, currentShow: segments };
      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function setSegmentChampionship(segmentId: string, championshipId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          const championship = current.championships.find((title) => title.id === championshipId);

          if (!championshipId || !championship || !canSegmentAttachChampionship(segment, championship)) {
            return { ...segment, championshipId: undefined };
          }

          return { ...segment, championshipId };
        }),
      };

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function setSegmentRivalry(segmentId: string, rivalryId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          const rivalry = current.rivalries.find((activeRivalry) => activeRivalry.id === rivalryId);

          if (!rivalryId || !rivalry || !canSegmentAttachRivalry(segment, rivalry)) {
            return { ...segment, rivalryId: undefined };
          }

          return { ...segment, rivalryId };
        }),
      };

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function removeSegment(id: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = { ...current, currentShow: current.currentShow.filter((segment) => segment.id !== id) };
      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function toggleParticipant(segmentId: string, wrestlerId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          const isSelected = segment.participantIds.includes(wrestlerId);
          const wrestler = current.wrestlers.find((talent) => talent.id === wrestlerId);

          if (!isSelected && wrestler?.injuryStatus === "major") {
            return segment;
          }

          const participantLimit = getSegmentParticipantRange(segment).max;
          const participantIds = isSelected
            ? segment.participantIds.filter((id) => id !== wrestlerId)
            : segment.participantIds.length < participantLimit
              ? [...segment.participantIds, wrestlerId]
              : segment.participantIds;

          let updatedSegment = { ...segment, participantIds };
          const championship = updatedSegment.championshipId
            ? current.championships.find((title) => title.id === updatedSegment.championshipId)
            : undefined;

          if (championship && !canSegmentAttachChampionship(updatedSegment, championship)) {
            updatedSegment = { ...updatedSegment, championshipId: undefined };
          }

          const rivalry = updatedSegment.rivalryId
            ? current.rivalries.find((activeRivalry) => activeRivalry.id === updatedSegment.rivalryId)
            : undefined;

          if (rivalry && !canSegmentAttachRivalry(updatedSegment, rivalry)) {
            updatedSegment = { ...updatedSegment, rivalryId: undefined };
          }

          return updatedSegment;
        }),
      };

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function handleRunShow() {
    if (!game) {
      return;
    }

    const resolvedShow = runShow(game);
    persistGameSnapshot(resolvedShow.game, "results");
    setGame(resolvedShow.game);
    setScreen("results");
  }

  function advanceWeek() {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = advanceGameWeek(current);
      const nextScreen = current.currentWeek >= 12 ? "seasonReview" : "dashboard";

      persistGameSnapshot(updatedGame, nextScreen);
      return updatedGame;
    });
    setScreen(game?.currentWeek === 12 ? "seasonReview" : "dashboard");
  }

  function handleStartNextSeason() {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = startNextSeason(current);
      persistGameSnapshot(updatedGame, "dashboard");
      return updatedGame;
    });
    setScreen("dashboard");
  }

  function createRivalry(wrestlerAId: string, wrestlerBId: string, stakes: RivalryStakes) {
    setGame((current) => {
      if (!current || wrestlerAId === wrestlerBId || hasDuplicateRivalry(current.rivalries, wrestlerAId, wrestlerBId)) {
        return current;
      }

      const wrestlerA = current.wrestlers.find((wrestler) => wrestler.id === wrestlerAId);
      const wrestlerB = current.wrestlers.find((wrestler) => wrestler.id === wrestlerBId);

      if (!wrestlerA || !wrestlerB) {
        return current;
      }

      const heat = getInitialRivalryHeat(wrestlerA, wrestlerB);
      const rivalryId = `rivalry-${Date.now()}`;
      const rivalry = {
        id: rivalryId,
        name: `${wrestlerA.name} vs ${wrestlerB.name}`,
        participantIds: [wrestlerAId, wrestlerBId],
        heat,
        freshness: 80,
        weeksActive: 1,
        lastAdvancedWeek: 0,
        status: getRivalryStatus(heat, 80),
        stakes,
      } satisfies Rivalry;
      const startEvent: RivalryHistoryEvent = {
        id: `s${current.seasonNumber}-w${current.currentWeek}-${rivalryId}-started`,
        rivalryId,
        rivalryName: rivalry.name,
        participantIds: [...rivalry.participantIds],
        weekNumber: current.currentWeek,
        seasonNumber: current.seasonNumber,
        eventType: "started",
        note: `${rivalry.name} started with ${formatRivalryStakes(stakes).toLowerCase()} stakes.`,
        heat: rivalry.heat,
        freshness: rivalry.freshness,
        status: rivalry.status,
      };
      const updatedGame = {
        ...current,
        rivalries: [...current.rivalries, rivalry],
        rivalryHistory: [...(current.rivalryHistory ?? []), startEvent],
      };

      persistGameSnapshot(updatedGame, "rivalries");
      return updatedGame;
    });
  }

  function endRivalry(rivalryId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const rivalry = current.rivalries.find((activeRivalry) => activeRivalry.id === rivalryId);
      const endEvent: RivalryHistoryEvent | undefined = rivalry
        ? {
            id: `s${current.seasonNumber}-w${current.currentWeek}-${rivalryId}-ended`,
            rivalryId,
            rivalryName: rivalry.name,
            participantIds: [...rivalry.participantIds],
            weekNumber: current.currentWeek,
            seasonNumber: current.seasonNumber,
            eventType: "ended",
            note: `${rivalry.name} ended at ${rivalry.heat} heat and ${rivalry.freshness} freshness.`,
            heat: rivalry.heat,
            freshness: rivalry.freshness,
            status: rivalry.status,
          }
        : undefined;
      const updatedGame = {
        ...current,
        rivalries: current.rivalries.filter((rivalry) => rivalry.id !== rivalryId),
        rivalryHistory: endEvent ? [...(current.rivalryHistory ?? []), endEvent] : current.rivalryHistory,
        currentShow: current.currentShow.map((segment) =>
          segment.rivalryId === rivalryId ? { ...segment, rivalryId: undefined } : segment,
        ),
      };

      persistGameSnapshot(updatedGame, "rivalries");
      return updatedGame;
    });
  }

  if (screen === "setup") {
    return <NewGameSetupScreen onCancel={() => setScreen("title")} onStartCareer={startCareer} />;
  }

  if (screen === "title" || !game) {
    return (
      <TitleScreen
        careerSaves={careerSaves}
        recentCareer={recentCareer}
        titleMode={titleMode}
        onContinue={continueGame}
        onDeleteCareer={deleteCareer}
        onLoadCareer={loadCareer}
        onRenameCareer={renameCareer}
        onSetTitleMode={setTitleMode}
        onStart={startNewGame}
      />
    );
  }

  if (screen === "booking") {
    return (
      <BookingScreen
        game={game}
        isQaHarness={isQaHarness}
        onAddSegment={addSegment}
        onBack={() => navigateTo("dashboard")}
        onNavigate={navigateTo}
        onRemoveSegment={removeSegment}
        onRunShow={handleRunShow}
        onOpenProfile={(wrestlerId) => openWrestlerProfile(wrestlerId, "booking")}
        onSetSegmentChampionship={setSegmentChampionship}
        onSetSegmentRivalry={setSegmentRivalry}
        onToggleParticipant={toggleParticipant}
        onReplaceCurrentShow={replaceCurrentShow}
        onUpdateSegment={updateSegment}
      />
    );
  }

  if (screen === "profile") {
    const profileWrestler = game.wrestlers.find((wrestler) => wrestler.id === profileWrestlerId);

    if (!profileWrestler) {
      return <RosterScreen game={game} latestResult={latestResult} onNavigate={navigateTo} onOpenProfile={(wrestlerId) => openWrestlerProfile(wrestlerId, "roster")} />;
    }

    return (
      <WrestlerProfileScreen
        game={game}
        latestResult={latestResult}
        onBackToBooking={() => closeWrestlerProfile("booking")}
        onBackToRoster={() => closeWrestlerProfile("roster")}
        onNavigate={navigateTo}
        returnScreen={profileReturnScreen}
        wrestler={profileWrestler}
      />
    );
  }

  if (screen === "roster") {
    return <RosterScreen game={game} latestResult={latestResult} onNavigate={navigateTo} onOpenProfile={(wrestlerId) => openWrestlerProfile(wrestlerId, "roster")} />;
  }

  if (screen === "championships") {
    return <ChampionshipsScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "rivalries") {
    return (
      <RivalriesScreen
        game={game}
        latestResult={latestResult}
        onCreateRivalry={createRivalry}
        onEndRivalry={endRivalry}
        onNavigate={navigateTo}
      />
    );
  }

  if (screen === "calendar") {
    return <CalendarScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "social") {
    return <SocialScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "finance") {
    return <FinanceScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "results" && latestResult) {
    return <ResultsScreen game={game} result={latestResult} onContinueWeekReview={() => navigateTo("weekReview")} onNavigate={navigateTo} />;
  }

  if (screen === "weekReview" && latestResult) {
    return <WeekReviewScreen game={game} onAdvanceWeek={advanceWeek} onNavigate={navigateTo} result={latestResult} />;
  }

  if (screen === "seasonReview") {
    return <SeasonReviewScreen game={game} onStartNextSeason={handleStartNextSeason} />;
  }

  return (
    <DashboardScreen
      game={game}
      latestResult={latestResult}
      onNavigate={navigateTo}
    />
  );
}

function TitleScreen({
  careerSaves,
  recentCareer,
  titleMode,
  onContinue,
  onDeleteCareer,
  onLoadCareer,
  onRenameCareer,
  onSetTitleMode,
  onStart,
}: {
  careerSaves: CareerSave[];
  recentCareer: CareerSave | null;
  titleMode: TitleMode;
  onContinue: () => void;
  onDeleteCareer: (careerSave: CareerSave) => void;
  onLoadCareer: (careerSave: CareerSave) => void;
  onRenameCareer: (careerSave: CareerSave) => void;
  onSetTitleMode: (mode: TitleMode) => void;
  onStart: () => void;
}) {
  const hasSaves = careerSaves.length > 0;
  const isAtSaveLimit = careerSaves.length >= MAX_SAVE_SLOTS;

  return (
    <main className="title-screen">
      <div className="title-shell">
        <section className="title-copy" aria-label="Next GM command center">
          <p className="eyebrow">Offline GM Command Center</p>
          <h1>Next GM</h1>
          <p className="lede">Enter the brand headquarters, book the card, run the show, and carry the locker room fallout into next week.</p>
          <div className="title-command-strip" aria-label="Career save status">
            <span>{careerSaves.length}/{MAX_SAVE_SLOTS} Careers</span>
            <span>Offline Career Mode</span>
            <span>Local Save Deck</span>
          </div>
          <div className="title-actions">
            {hasSaves ? (
              <button className="primary-action" onClick={onContinue}>
                Continue Career
              </button>
            ) : null}
            <button className="primary-action" disabled={isAtSaveLimit} onClick={onStart}>
              New Career
            </button>
            {hasSaves ? (
              <button className="secondary-action" onClick={() => onSetTitleMode(titleMode === "load" ? "home" : "load")}>
                {titleMode === "load" ? "Close Careers" : "Load Careers"}
              </button>
            ) : null}
          </div>
          {isAtSaveLimit ? <p className="title-limit-note">Save deck full. Delete a career from Load Careers before starting another.</p> : null}
        </section>

        <aside className="title-career-panel" aria-label={titleMode === "load" ? "Career saves" : "Recent career"}>
          {titleMode === "load" ? (
            <>
              <div className="panel-kicker">
                <p className="eyebrow">Career Deck</p>
                <h2>Load Careers</h2>
              </div>
              <div className="save-card-list">
                {careerSaves.map((careerSave) => (
                  <CareerSaveCard
                    careerSave={careerSave}
                    key={careerSave.id}
                    onDeleteCareer={onDeleteCareer}
                    onLoadCareer={onLoadCareer}
                    onRenameCareer={onRenameCareer}
                  />
                ))}
              </div>
            </>
          ) : recentCareer ? (
            <>
              <div className="panel-kicker">
                <p className="eyebrow">Most Recent Career</p>
                <h2>{recentCareer.name}</h2>
              </div>
              <CareerSaveSummary careerSave={recentCareer} />
              <button className="primary-action full-width-action" onClick={onContinue}>
                Resume {recentCareer.preview.brandName}
              </button>
            </>
          ) : (
            <>
              <div className="panel-kicker">
                <p className="eyebrow">Awaiting Contract</p>
                <h2>No Career Active</h2>
              </div>
              <p className="muted-copy">Start a new career to sign the contract, build a roster, and open Week 1 from Brand HQ.</p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function CareerSaveSummary({ careerSave }: { careerSave: CareerSave }) {
  const preview = careerSave.preview;

  return (
    <div className="save-summary-grid">
      <Metric label="Brand" value={preview.brandName} />
      <Metric label="GM" value={preview.gmName} />
      <Metric label="Season / Week" value={`S${preview.seasonNumber} / W${preview.week}`} />
      <Metric label="Money" value={formatMoney(preview.money)} />
      <Metric label="Location" value={formatLocationLabel(preview.screen)} />
      <Metric label="Last Played" value={formatDateTime(careerSave.lastPlayedAt)} />
    </div>
  );
}

function CareerSaveCard({
  careerSave,
  onDeleteCareer,
  onLoadCareer,
  onRenameCareer,
}: {
  careerSave: CareerSave;
  onDeleteCareer: (careerSave: CareerSave) => void;
  onLoadCareer: (careerSave: CareerSave) => void;
  onRenameCareer: (careerSave: CareerSave) => void;
}) {
  return (
    <article className="save-card">
      <div className="save-card-top">
        <div>
          <p className="eyebrow">{formatLocationLabel(careerSave.preview.screen)}</p>
          <h3>{careerSave.name}</h3>
        </div>
        <span>W{careerSave.preview.week}</span>
      </div>
      <CareerSaveSummary careerSave={careerSave} />
      <div className="save-card-actions">
        <button className="primary-action" onClick={() => onLoadCareer(careerSave)}>
          Load
        </button>
        <button className="secondary-action" onClick={() => onRenameCareer(careerSave)}>
          Rename
        </button>
        <button className="danger-action" onClick={() => onDeleteCareer(careerSave)}>
          Delete
        </button>
      </div>
    </article>
  );
}

function NewGameSetupScreen({
  onCancel,
  onStartCareer,
}: {
  onCancel: () => void;
  onStartCareer: (career: {
    gmName: string;
    gmStyle: GMStyle;
    brandName: string;
    brandStyle: BrandStyle;
    difficulty: GameDifficulty;
    startingBudgetTier: StartingBudgetTier;
    rivalGMAssignments: RivalGMAssignment[];
    draftedWrestlers: Wrestler[];
  }) => void;
}) {
  const [step, setStep] = useState<SetupStep>("contract");
  const [gmName, setGmName] = useState(defaultCareer.gmName);
  const [gmStyle, setGmStyle] = useState<GMStyle>(defaultCareer.gmStyle);
  const [brandName, setBrandName] = useState(defaultCareer.brandName);
  const [brandStyle, setBrandStyle] = useState<BrandStyle>(defaultCareer.brandStyle);
  const [difficulty, setDifficulty] = useState<GameDifficulty>(defaultCareer.difficulty);
  const [startingBudgetTier, setStartingBudgetTier] = useState<StartingBudgetTier>(defaultCareer.startingBudgetTier);
  const [rivalGMAssignments, setRivalGMAssignments] = useState<RivalGMAssignment[]>(() => createRivalGMAssignments(defaultCareer.brandStyle));
  const [draftedWrestlers, setDraftedWrestlers] = useState<Wrestler[]>([]);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSort>("rank");
  const [draftBrandFilter, setDraftBrandFilter] = useState(draftBrandFilters[0]);
  const [draftRoleTierFilter, setDraftRoleTierFilter] = useState(draftRoleTierFilters[0]);
  const [draftAvailabilityFilter, setDraftAvailabilityFilter] = useState(draftAvailabilityFilters[0]);
  const [draftArchetypeFilter, setDraftArchetypeFilter] = useState(draftArchetypeFilters[0]);
  const selectedGmStyle = gmStyleOptions.find((option) => option.label === gmStyle) ?? gmStyleOptions[0];
  const selectedBrandStyle = brandStyleOptions.find((option) => option.label === brandStyle) ?? brandStyleOptions[0];
  const selectedDifficulty = difficultyOptions.find((option) => option.label === difficulty) ?? difficultyOptions[1];
  const selectedBudget = budgetOptions.find((option) => option.label === startingBudgetTier) ?? budgetOptions[1];
  const canPreview = gmName.trim().length > 0 && brandName.trim().length > 0;
  const draftSearchTerm = draftSearch.trim().toLowerCase();
  const draftedIds = new Set(draftedWrestlers.map((wrestler) => wrestler.id));
  const availableDraftCount = draftPool.length - draftedWrestlers.length;
  const availableWrestlers = draftPool
    .filter((wrestler) => !draftedIds.has(wrestler.id))
    .filter((wrestler) => !draftSearchTerm || getDraftSearchText(wrestler).includes(draftSearchTerm))
    .filter((wrestler) => draftBrandFilter === "All Brands" || wrestler.sourceBrand === draftBrandFilter)
    .filter((wrestler) => draftRoleTierFilter === "All Tiers" || wrestler.roleTier === draftRoleTierFilter)
    .filter((wrestler) => draftAvailabilityFilter === "All Status" || wrestler.sourceAvailability === draftAvailabilityFilter)
    .filter((wrestler) => draftArchetypeFilter === "All Styles" || wrestler.archetype === draftArchetypeFilter)
    .sort((a, b) => getDraftSortValue(b, draftSort) - getDraftSortValue(a, draftSort));
  const activeDraftFilters = [
    draftBrandFilter !== "All Brands" ? draftBrandFilter : null,
    draftRoleTierFilter !== "All Tiers" ? draftRoleTierFilter : null,
    draftAvailabilityFilter !== "All Status" ? draftAvailabilityFilter : null,
    draftArchetypeFilter !== "All Styles" ? draftArchetypeFilter : null,
  ].filter(Boolean);
  const boardLeader = availableWrestlers[0];
  const topStar = getRosterLeader(draftedWrestlers, (wrestler) => wrestler.popularity + wrestler.momentum);
  const bestTalker = getRosterLeader(draftedWrestlers, (wrestler) => wrestler.promoSkill);
  const bestInRing = getRosterLeader(draftedWrestlers, (wrestler) => wrestler.ringSkill);
  const highestMomentum = getRosterLeader(draftedWrestlers, (wrestler) => wrestler.momentum);
  const weekOneAnchor = getRosterLeader(draftedWrestlers, (wrestler) => wrestler.morale + wrestler.momentum + (100 - wrestler.fatigue));
  const draftReviewPressure = getDraftReviewPressure(draftedWrestlers);
  const draftReviewRead = getDraftReviewRead(draftedWrestlers);
  const draftTierCounts = getDraftValueCounts(draftedWrestlers, (wrestler) => wrestler.roleTier);
  const draftArchetypeCounts = getDraftValueCounts(draftedWrestlers, (wrestler) => wrestler.archetype);
  const draftDivisionCounts = getDraftValueCounts(draftedWrestlers, (wrestler) => wrestler.division);
  const draftSourceBrandCounts = getDraftValueCounts(draftedWrestlers, (wrestler) => wrestler.sourceBrand);

  function startCareer() {
    if (!canPreview || draftedWrestlers.length !== draftPickCount) {
      return;
    }

    onStartCareer({
      gmName: gmName.trim(),
      gmStyle,
      brandName: brandName.trim(),
      brandStyle,
      difficulty,
      startingBudgetTier,
      rivalGMAssignments,
      draftedWrestlers,
    });
  }

  function draftWrestler(wrestler: Wrestler) {
    if (draftedWrestlers.length >= draftPickCount || draftedWrestlers.some((drafted) => drafted.id === wrestler.id)) {
      return;
    }

    setDraftedWrestlers((current) => [...current, wrestler]);
  }

  function undoLastPick() {
    setDraftedWrestlers((current) => current.slice(0, -1));
  }

  function resetDraftBoard() {
    setDraftSearch("");
    setDraftSort("rank");
    setDraftBrandFilter(draftBrandFilters[0]);
    setDraftRoleTierFilter(draftRoleTierFilters[0]);
    setDraftAvailabilityFilter(draftAvailabilityFilters[0]);
    setDraftArchetypeFilter(draftArchetypeFilters[0]);
  }

  function selectBrandStyle(choice: string) {
    const nextBrandStyle = choice as BrandStyle;
    const currentBrandStyleLabel = brandStyleOptions.find((option) => option.label === brandStyle)?.label ?? defaultCareer.brandName;
    const shouldSyncBrandName = !brandName.trim() || brandName.trim() === currentBrandStyleLabel || brandName.trim() === defaultCareer.brandName;

    setBrandStyle(nextBrandStyle);
    setRivalGMAssignments(createRivalGMAssignments(nextBrandStyle));

    if (shouldSyncBrandName) {
      setBrandName(choice);
    }
  }

  return (
    <main className="setup-screen">
      <section className="setup-shell">
        <div className="setup-progress" aria-label="Setup progress">
          {["contract", "rules", "gm", "brand", "preview", "draft", "review"].map((item, index) => (
            <span className={step === item ? "active-step" : ""} key={item}>
              {index + 1}
            </span>
          ))}
        </div>

        {step === "contract" ? (
          <div className="setup-panel">
            <p className="eyebrow">Sign The Contract</p>
            <h1>You're Hired</h1>
            <p className="lede">
              A national broadcast window is open, the roster is restless, and ownership wants a GM who can build more than one hot night. Take the chair and turn this brand into a lasting force.
            </p>
            <div className="title-actions">
              <button className="primary-action" onClick={() => setStep("rules")}>
                Accept The Job
              </button>
              <button className="secondary-action" onClick={onCancel}>
                Back
              </button>
            </div>
          </div>
        ) : null}

        {step === "gm" ? (
          <div className="setup-panel">
            <p className="eyebrow">Choose GM Identity</p>
            <h2>Who Runs The Room?</h2>
            <label className="setup-field">
              GM Name
              <input value={gmName} onChange={(event) => setGmName(event.target.value)} />
            </label>
            <ChoiceGrid
              choices={gmStyleOptions}
              selected={gmStyle}
              onSelect={(choice) => setGmStyle(choice as GMStyle)}
              variant="identity"
            />
            <div className="identity-note">
              <p className="eyebrow">Selected Identity</p>
              <strong>{selectedGmStyle.label}</strong>
              <p>{selectedGmStyle.description} This is roleplay framing for your GM fantasy, not a hidden bonus.</p>
            </div>
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("rules")}>
                Back
              </button>
              <button className="primary-action" disabled={!gmName.trim()} onClick={() => setStep("brand")}>
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "brand" ? (
          <div className="setup-panel">
            <p className="eyebrow">Choose Your Brand</p>
            <h2>Which Show Are You Taking Over?</h2>
            <label className="setup-field">
              Brand Name
              <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
            </label>
            <ChoiceGrid
              choices={brandStyleOptions}
              selected={brandStyle}
              onSelect={selectBrandStyle}
              variant="identity"
            />
            <div className="identity-note">
              <p className="eyebrow">Selected Prototype Brand</p>
              <strong>{selectedBrandStyle.label}</strong>
              <p>{selectedBrandStyle.description} This selects the show you want to run in the prototype, not a hidden gameplay modifier.</p>
            </div>
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("gm")}>
                Back
              </button>
              <button className="primary-action" disabled={!canPreview} onClick={() => setStep("preview")}>
                Preview Career
              </button>
            </div>
          </div>
        ) : null}

        {step === "rules" ? (
          <div className="setup-panel">
            <p className="eyebrow">Game Rules</p>
            <h2>Set The Pressure Level</h2>
            <p className="lede">Lock the shape of this career before Draft Night. Difficulty is challenge framing for now; budget sets your opening war chest.</p>
            <div className="rules-grid">
              <section>
                <p className="eyebrow">Difficulty</p>
                <ChoiceGrid
                  choices={difficultyOptions}
                  selected={difficulty}
                  onSelect={(choice) => setDifficulty(choice as GameDifficulty)}
                  variant="identity"
                />
              </section>
              <section>
                <p className="eyebrow">Starting Budget</p>
                <ChoiceGrid
                  choices={budgetOptions}
                  selected={startingBudgetTier}
                  onSelect={(choice) => setStartingBudgetTier(choice as StartingBudgetTier)}
                  variant="identity"
                />
              </section>
            </div>
            <div className="identity-note">
              <p className="eyebrow">Selected Rules</p>
              <strong>
                {difficulty} / {formatBudgetTier(startingBudgetTier)}
              </strong>
              <p>{selectedDifficulty.description} {selectedBudget.description}</p>
            </div>
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("contract")}>
                Back
              </button>
              <button className="primary-action" onClick={() => setStep("gm")}>
                Choose GM Identity
              </button>
            </div>
          </div>
        ) : null}

        {step === "preview" ? (
          <div className="setup-panel">
            <p className="eyebrow">Career Preview</p>
            <h2>{brandName.trim() || defaultCareer.brandName}</h2>
            <div className="status-grid setup-summary">
              <Metric label="GM" value={gmName.trim() || defaultCareer.gmName} detail={gmStyle} />
              <Metric label="Selected Brand" value={brandStyle} detail={selectedBrandStyle.description} />
              <Metric label="Difficulty" value={difficulty} detail="Challenge framing; no hidden tuning yet" />
              <Metric label="Starting Budget" value={formatBudgetTier(startingBudgetTier)} detail={selectedBudget.description} />
              <Metric label="First Season" value="12 Weeks" detail="PLEs in Weeks 4, 8, and 12" />
              <Metric label="Next Step" value="Draft Night" detail="Build the first locker room" />
            </div>
            <section className="rival-universe" aria-label="Rival GM assignments">
              <div>
                <p className="eyebrow">Rival GM Universe</p>
                <h3>The Other Chairs Are Filled</h3>
              </div>
              <div className="rival-universe-grid">
                {rivalGMAssignments.map((assignment) => (
                  <article key={assignment.brand}>
                    <span>{assignment.brand}</span>
                    <strong>{assignment.gmName}</strong>
                    <small>{assignment.gmStyle}</small>
                  </article>
                ))}
              </div>
            </section>
            <p className="lede">
              Week 1 opens on TV. This first campaign starts with Collision Course in Week 4, and ownership expects momentum before the road reaches Final Bell.
            </p>
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("brand")}>
                Back
              </button>
              <button className="primary-action" onClick={() => setStep("draft")}>
                Enter Draft Night
              </button>
            </div>
          </div>
        ) : null}

        {step === "draft" ? (
          <div className="setup-panel draft-panel">
            <p className="eyebrow">Draft Night</p>
            <h2>You're On The Clock</h2>
            <p className="lede">
              Build the first 12-person locker room for {brandName.trim() || defaultCareer.brandName}. The Top 200 board is open across every source brand, and every pick is yours.
            </p>
            <div className="draft-war-room-strip" aria-label="Draft board status">
              <span>{draftPool.length} Top 200 Files</span>
              <span>{availableWrestlers.length} Showing</span>
              <span>{draftedWrestlers.length}/{draftPickCount} Signed</span>
              <span>{activeDraftFilters.length ? activeDraftFilters.join(" / ") : "Open Board"}</span>
            </div>
            <div className="draft-board">
              <section className="draft-column">
                <div className="draft-head">
                  <div>
                    <p className="eyebrow">Available Talent</p>
                    <h3>Pick {Math.min(draftedWrestlers.length + 1, draftPickCount)} of {draftPickCount}</h3>
                  </div>
                  <strong>{draftSearchTerm ? `${availableWrestlers.length} Showing` : `${availableDraftCount} Available`}</strong>
                </div>
                <div className="draft-tools" aria-label="Draft board controls">
                  <label>
                    Search
                    <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Find a performer" />
                  </label>
                  <label>
                    Sort
                    <select value={draftSort} onChange={(event) => setDraftSort(event.target.value as DraftSort)}>
                      {draftSortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Source Brand
                    <select value={draftBrandFilter} onChange={(event) => setDraftBrandFilter(event.target.value)}>
                      {draftBrandFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tier
                    <select value={draftRoleTierFilter} onChange={(event) => setDraftRoleTierFilter(event.target.value)}>
                      {draftRoleTierFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Source Status
                    <select value={draftAvailabilityFilter} onChange={(event) => setDraftAvailabilityFilter(event.target.value)}>
                      {draftAvailabilityFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Style
                    <select value={draftArchetypeFilter} onChange={(event) => setDraftArchetypeFilter(event.target.value)}>
                      {draftArchetypeFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary-action" onClick={resetDraftBoard} type="button">
                    Reset Board
                  </button>
                </div>
                <div className="draft-board-note">
                  <strong>{boardLeader?.name ?? "No matching talent"}</strong>
                  <span>
                    {boardLeader
                      ? `Best visible file · ${getDraftTag(boardLeader.sourceBrand, "Open Pool")} · ${getDraftTag(boardLeader.roleTier)} · ${getDraftTag(boardLeader.archetype)}`
                      : "Clear a filter to reopen the board."}
                  </span>
                </div>
                <div className="draft-list">
                  {availableWrestlers.length ? (
                    availableWrestlers.map((wrestler) => (
                      <DraftTalentCard
                        actionLabel="Draft"
                        disabled={draftedWrestlers.length >= draftPickCount}
                        key={wrestler.id}
                        onAction={() => draftWrestler(wrestler)}
                        wrestler={wrestler}
                      />
                    ))
                  ) : (
                    <div className="empty-state compact">No draft files match that search.</div>
                  )}
                </div>
              </section>

              <section className="draft-column drafted-column">
                <div className="draft-head">
                  <div>
                    <p className="eyebrow">Drafted Roster</p>
                    <h3>{draftedWrestlers.length}/{draftPickCount} Signed</h3>
                  </div>
                  <button className="secondary-action" disabled={!draftedWrestlers.length} onClick={undoLastPick}>
                    Undo Pick
                  </button>
                </div>
                <div className="drafted-list">
                  {draftedWrestlers.length ? (
                    draftedWrestlers.map((wrestler, index) => (
                      <div className="drafted-pick" key={wrestler.id}>
                        <span>Pick {index + 1}</span>
                        <strong>{wrestler.name}</strong>
                        <em>
                          {getDraftTag(wrestler.sourceBrand, "Open Pool")} · {getDraftTag(wrestler.roleTier)} · {getDraftTag(wrestler.archetype)}
                        </em>
                        <small>
                          Pop {wrestler.popularity} · Mom {wrestler.momentum} · Ring {wrestler.ringSkill} · Promo {wrestler.promoSkill} · Fat {wrestler.fatigue} · Morale {wrestler.morale}
                        </small>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state compact">No picks made yet. The board is waiting.</div>
                  )}
                </div>
              </section>
            </div>
            <div className="title-actions draft-actions">
              <button className="secondary-action" onClick={() => setStep("preview")}>
                Back
              </button>
              <button className="primary-action" disabled={draftedWrestlers.length !== draftPickCount} onClick={() => setStep("review")}>
                Complete Draft
              </button>
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="setup-panel draft-review-panel">
            <p className="eyebrow">Draft Review</p>
            <h2>{brandName.trim() || defaultCareer.brandName} Roster</h2>
            <p className="lede">The board is locked. Read the room before you walk into Week 1.</p>
            <div className="status-grid setup-summary draft-review-summary">
              <Metric label="Franchise Player" value={topStar?.name ?? "None"} detail={topStar ? `Pop ${topStar.popularity} · Mom ${topStar.momentum}` : undefined} />
              <Metric label="Best Talker" value={bestTalker?.name ?? "None"} detail={bestTalker ? `Promo ${bestTalker.promoSkill}` : undefined} />
              <Metric label="Best In-Ring" value={bestInRing?.name ?? "None"} detail={bestInRing ? `Ring ${bestInRing.ringSkill}` : undefined} />
              <Metric label="Momentum Leader" value={highestMomentum?.name ?? "None"} detail={highestMomentum ? `Momentum ${highestMomentum.momentum}` : undefined} />
              <Metric label="Week 1 Anchor" value={weekOneAnchor?.name ?? "None"} detail={weekOneAnchor ? `Morale ${weekOneAnchor.morale} · Fat ${weekOneAnchor.fatigue}` : undefined} />
              <Metric label={draftReviewPressure.label} value={draftReviewPressure.value} detail={draftReviewPressure.detail} />
            </div>
            <section className="war-room-read" aria-label="Draft review war room read">
              <div>
                <p className="eyebrow">War Room Read</p>
                <h3>Locker Room Identity</h3>
              </div>
              <p>{draftReviewRead}</p>
            </section>
            <section className="draft-review-breakdown" aria-label="Drafted roster shape">
              <article>
                <span>Tier Mix</span>
                <strong>{getDraftCountSummary(draftTierCounts, 4)}</strong>
              </article>
              <article>
                <span>Style Lean</span>
                <strong>{getDraftCountSummary(draftArchetypeCounts, 4)}</strong>
              </article>
              <article>
                <span>Division Split</span>
                <strong>{getDraftCountSummary(draftDivisionCounts, 3)}</strong>
              </article>
              <article>
                <span>Source Mix</span>
                <strong>{getDraftCountSummary(draftSourceBrandCounts, 4)}</strong>
              </article>
            </section>
            <section className="draft-review-grid">
              {draftedWrestlers.map((wrestler) => (
                <DraftTalentCard key={wrestler.id} wrestler={wrestler} />
              ))}
            </section>
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("draft")}>
                Back To Draft
              </button>
              <button className="primary-action" onClick={startCareer}>
                Enter Week 1
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DraftTalentCard({
  actionLabel,
  disabled,
  onAction,
  wrestler,
}: {
  actionLabel?: string;
  disabled?: boolean;
  onAction?: () => void;
  wrestler: Wrestler;
}) {
  return (
    <article className="draft-talent-card">
      <div className="draft-talent-head">
        <div>
          <p className="eyebrow">{wrestler.draftRank ? `Top 200 #${wrestler.draftRank}` : "Draft File"}</p>
          <h3>{wrestler.name}</h3>
        </div>
        {onAction ? (
          <button disabled={disabled} onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="draft-card-tags" aria-label={`${wrestler.name} draft context`}>
        <span>{getDraftTag(wrestler.sourceBrand, "Open Pool")}</span>
        <span>{getDraftTag(wrestler.roleTier)}</span>
        <span>{getDraftTag(wrestler.archetype)}</span>
        <span>{getDraftTag(wrestler.sourceAvailability, "Source Status")}</span>
      </div>
      <p className="draft-card-read">
        {getDraftTag(wrestler.division)} · {getDraftTag(wrestler.alignment, "Alignment Open")} · open draft availability
      </p>
      <div className="draft-stat-grid">
        <Metric label="Popularity" value={`${wrestler.popularity}`} />
        <Metric label="Momentum" value={`${wrestler.momentum}`} />
        <Metric label="Ring" value={`${wrestler.ringSkill}`} />
        <Metric label="Promo" value={`${wrestler.promoSkill}`} />
        <Metric label="Fatigue" value={`${wrestler.fatigue}`} />
        <Metric label="Morale" value={`${wrestler.morale}`} />
      </div>
    </article>
  );
}

function ChoiceGrid({
  choices,
  selected,
  onSelect,
  variant = "default",
}: {
  choices: Array<string | ChoiceOption>;
  selected: string;
  onSelect: (choice: string) => void;
  variant?: "default" | "identity";
}) {
  return (
    <div className={`choice-grid${variant === "identity" ? " identity-grid" : ""}`}>
      {choices.map((choice) => {
        const option = typeof choice === "string" ? { label: choice } : choice;

        return (
          <button className={selected === option.label ? "active-filter" : ""} key={option.label} onClick={() => onSelect(option.label)}>
            <span>{option.label}</span>
            {option.description ? <small>{option.description}</small> : null}
        </button>
        );
      })}
    </div>
  );
}

function DashboardScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const hotTalent = useMemo(
    () => [...game.wrestlers].sort((a, b) => b.momentum + b.popularity - (a.momentum + a.popularity)).slice(0, 3),
    [game.wrestlers],
  );
  const atRisk = useMemo(
    () => [...game.wrestlers].sort((a, b) => b.fatigue + (100 - b.morale) - (a.fatigue + (100 - a.morale))).slice(0, 3),
    [game.wrestlers],
  );
  const topMomentumTalent = useMemo(
    () => [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0],
    [game.wrestlers],
  );
  const lastShow = game.showHistory[game.showHistory.length - 1];
  const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers)).length;
  const averageFatigue = Math.round(game.wrestlers.reduce((sum, wrestler) => sum + wrestler.fatigue, 0) / game.wrestlers.length);
  const nextAction =
    validSegments >= 2 ? "The rundown can go live when you are ready." : "Book at least 2 valid segments before production can roll.";
  const topChampionship = [...game.championships].sort((a, b) => b.prestige - a.prestige)[0];
  const topTitleContenders = getTopContenders(topChampionship, game.wrestlers, 2);
  const hottestRivalry = getHottestRivalry(game.rivalries);
  const coolingRivalry = getCoolingRivalry(game.rivalries);
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const latestSocialPost = game.socialPosts[game.socialPosts.length - 1];
  const latestFinanceReport = getLatestFinanceReport(game);
  const pressureLabel = getFinancePressureLabel(game.money, latestFinanceReport?.profitLoss ?? 0);
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const overusedCount = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Overused")).length;
  const underusedCount = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Underused")).length;
  const protectedStarCount = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Protected Star")).length;
  const moraleRiskCount = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Morale Risk")).length;
  const injuryRiskCount = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk")).length;
  const minorInjuryCount = game.wrestlers.filter((wrestler) => wrestler.injuryStatus === "minor").length;
  const unavailableCount = game.wrestlers.filter((wrestler) => wrestler.injuryStatus === "major").length;
  const latestRecoveryNotes = game.injuryRecoveryNotes.filter((note) => note.weekNumber === game.currentWeek).slice(-3).reverse();

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="dashboard" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} · Week {game.currentWeek} Dashboard</p>
          <h2>{game.brandName}</h2>
          <div className="identity-strip">
            <span>GM {game.gmName}</span>
            <span>{game.gmStyle}</span>
            <span>{game.brandStyle}</span>
          </div>
          <p className="lede">
            {currentShow.showName} is a {getShowTypeLabel(currentShow.showType)} stop
            {currentShow.isGoHome ? " and the last live wire before the next PLE." : " on the road to the next major event."}
          </p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="command-grid">
        <article className="command-panel show-panel">
          <div className="section-heading">
            <p className="eyebrow">This Week's Show</p>
            <h3>{currentShow.showName}</h3>
          </div>
          <div className="show-strip">
            <span>{getShowTypeLabel(currentShow.showType)}</span>
            {currentShow.isGoHome ? <span>Go-Home</span> : null}
            {nextPle ? <span>{weeksUntilPle === 0 ? "PLE Week" : `${weeksUntilPle} Week${weeksUntilPle === 1 ? "" : "s"} To ${nextPle.showName}`}</span> : null}
          </div>
          {game.currentShow.length ? (
            <div className="mini-card-list">
              {game.currentShow.map((segment, index) => (
                <div className="mini-card" key={segment.id}>
                  <span>
                    Segment {index + 1} · {segment.type}
                  </span>
                  <strong>
                    {getSegmentParticipants(segment, game.wrestlers)
                      .map((wrestler) => wrestler.name)
                      .join(" / ") || "No participants selected"}
                  </strong>
                  <small>{isValidSegment(segment, game.wrestlers) ? "Ready for TV" : getSegmentValidationWarning(segment, game.wrestlers)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">No card booked yet. The production board is dark.</div>
          )}
        </article>

        <article className="command-panel next-action-panel">
          <div className="section-heading">
            <p className="eyebrow">Next Action</p>
            <h3>{validSegments >= 2 ? "Card Is Runnable" : "Book The Show"}</h3>
          </div>
          <p>{nextAction}</p>
          <div className="panel-actions">
            <button className="primary-action" onClick={() => onNavigate("booking")}>
              {validSegments >= 2 ? "Review Card" : "Book Show"}
            </button>
            <button className="secondary-action" onClick={() => onNavigate("roster")}>
              View Roster
            </button>
          </div>
        </article>
      </section>

      <section className="status-grid" aria-label="Brand pulse">
        <Metric label="Money" value={formatMoney(game.money)} />
        <Metric label="Last Show" value={lastShow ? `${lastShow.totalScore} (${getShowGrade(lastShow.totalScore)})` : "No Result"} />
        <Metric label="Avg Fatigue" value={`${averageFatigue}`} detail={averageFatigue >= 45 ? "Training room is busy" : "Load is controlled"} />
        <Metric label="Top Momentum" value={`${topMomentumTalent.momentum}`} detail={topMomentumTalent.name} />
      </section>

      <section className="command-panel roster-pressure-panel">
        <div className="section-heading">
          <p className="eyebrow">Roster Pressure</p>
          <h3>Locker Room Load</h3>
        </div>
        <div className="pressure-tags">
          <span>Overused {overusedCount}</span>
          <span>Underused {underusedCount}</span>
          <span>Protected Star {protectedStarCount}</span>
          <span>Morale Risk {moraleRiskCount}</span>
          <span>Injury Risk {injuryRiskCount}</span>
          <span>Minor Injury {minorInjuryCount}</span>
          <span>Unavailable {unavailableCount}</span>
        </div>
        <div className="spotlight-grid">
          <Metric
            label="Top Overused"
            value={topOverused ? topOverused.name : "None"}
            detail={topOverused ? `Fat ${topOverused.fatigue} · Streak ${topOverused.consecutiveWeeksBooked ?? 0}` : "No workload spike"}
          />
          <Metric
            label="Top Underused"
            value={topUnderused ? topUnderused.name : "None"}
            detail={topUnderused ? `${getWeeksSinceLastBooked(topUnderused, game.currentWeek)} weeks off TV` : "No long absences"}
          />
          <Metric label="Morale Risk" value={`${moraleRiskCount}`} detail={moraleRiskCount ? "Room needs care" : "Room is steady"} />
          <Metric label="Injury Risk" value={`${injuryRiskCount}`} detail={injuryRiskCount ? "Protect the load" : "No red flags"} />
          <Metric label="Minor Injuries" value={`${minorInjuryCount}`} detail={minorInjuryCount ? "Work light" : "None"} />
          <Metric label="Unavailable" value={`${unavailableCount}`} detail={unavailableCount ? "Major injuries blocked" : "Full roster available"} />
        </div>
        {latestRecoveryNotes.length ? (
          <div className="fallout-grid compact-grid">
            {latestRecoveryNotes.map((note) => (
              <div key={`${note.wrestlerId}-${note.weekNumber}`}>
                <span>Recovery</span>
                <p>{note.note}</p>
              </div>
            ))}
          </div>
        ) : null}
        <button className="secondary-action" onClick={() => onNavigate("roster")}>
          View Roster
        </button>
      </section>

      <section className={`command-panel finance-spotlight pressure-${pressureLabel.toLowerCase()}`}>
        <div className="section-heading">
          <p className="eyebrow">Brand Pressure</p>
          <h3>{formatPressureLabel(pressureLabel)}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Current Money" value={formatMoney(game.money)} />
          <Metric label="Latest P/L" value={latestFinanceReport ? formatMoney(latestFinanceReport.profitLoss) : "No Report"} />
          <Metric label="Latest Gate" value={latestFinanceReport ? latestFinanceReport.attendance.toLocaleString() : "No Show"} detail={latestFinanceReport?.showName} />
        </div>
        <button className="secondary-action" onClick={() => onNavigate("finance")}>
          View Finance
        </button>
      </section>

      <section className={`command-panel calendar-spotlight ${currentShow.showType === "ple" ? "ple-panel" : ""}`}>
        <div className="section-heading">
          <p className="eyebrow">Road To PLE</p>
          <h3>{nextPle ? nextPle.showName : "Season Complete"}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Current Show" value={currentShow.showName} detail={getShowTypeLabel(currentShow.showType)} />
          <Metric
            label="Next PLE"
            value={nextPle ? nextPle.showName : "None"}
            detail={nextPle ? `${weeksUntilPle} week${weeksUntilPle === 1 ? "" : "s"} away` : "Finish season review"}
          />
          <Metric label="Go-Home" value={currentShow.isGoHome ? "Tonight" : "No"} detail={currentShow.isGoHome ? "Final push before PLE" : "Build the road"} />
        </div>
        <button className="secondary-action" onClick={() => onNavigate("calendar")}>
          View Calendar
        </button>
      </section>

      <section className="command-panel championship-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Championship Spotlight</p>
          <h3>{topChampionship.name}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Champion" value={getWrestlerNames(topChampionship.championIds, game.wrestlers)} />
          <Metric label="Prestige" value={`${topChampionship.prestige}`} />
          <Metric label="Likely Contenders" value={topTitleContenders.map((wrestler) => wrestler.name).join(" / ")} />
        </div>
        <button className="secondary-action" onClick={() => onNavigate("championships")}>
          View Championships
        </button>
      </section>

      <section className="command-panel rivalry-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Rivalry Spotlight</p>
          <h3>{hottestRivalry ? hottestRivalry.name : "No Active Rivalries"}</h3>
        </div>
        {hottestRivalry ? (
          <div className="spotlight-grid">
            <Metric label="Heat" value={`${hottestRivalry.heat}`} detail={formatRivalryStatus(hottestRivalry.status)} />
            <Metric label="Stakes" value={formatRivalryStakes(hottestRivalry.stakes)} />
            <Metric
              label="Warning"
              value={coolingRivalry ? coolingRivalry.name : "Stories Holding"}
              detail={coolingRivalry ? formatRivalryStatus(coolingRivalry.status) : "No cooling angles"}
            />
          </div>
        ) : (
          <div className="empty-state compact">No rivalries are active. Start one to give weekly TV more story context.</div>
        )}
        <button className="secondary-action" onClick={() => onNavigate("rivalries")}>
          View Rivalries
        </button>
      </section>

      {latestSocialPost ? (
        <section className="command-panel social-spotlight">
          <div className="section-heading">
            <p className="eyebrow">IWC Buzz</p>
            <h3>{formatSocialCategory(latestSocialPost.category)}</h3>
          </div>
          <p className="social-preview-text">{latestSocialPost.text}</p>
          <div className="show-strip">
            <span>{latestSocialPost.author}</span>
            <span>{formatSocialTone(latestSocialPost.tone)}</span>
          </div>
          <button className="secondary-action" onClick={() => onNavigate("social")}>
            View Social
          </button>
        </section>
      ) : null}

      <section className="command-grid">
        <article className="command-panel">
          <div className="section-heading">
            <p className="eyebrow">Hot Talent</p>
            <h3>Who Feels Hot</h3>
          </div>
          <div className="talent-list">
            {hotTalent.map((wrestler) => (
              <div className="talent-row" key={wrestler.id}>
                <strong>{wrestler.name}</strong>
                <span>
                  Momentum {wrestler.momentum} · Popularity {wrestler.popularity}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="command-panel">
          <div className="section-heading">
            <p className="eyebrow">At Risk</p>
            <h3>Who Needs Protection</h3>
          </div>
          <div className="talent-list">
            {atRisk.map((wrestler) => (
              <div className="talent-row warning-row" key={wrestler.id}>
                <strong>{wrestler.name}</strong>
                <span>
                  Fatigue {wrestler.fatigue} · Morale {wrestler.morale}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="roster-table">
        <div className="section-heading">
          <p className="eyebrow">Brand Pulse</p>
          <h3>Locker Room Board</h3>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Pop</span>
            <span>Mom</span>
            <span>Fat</span>
            <span>Morale</span>
            <span>Ring</span>
            <span>Promo</span>
          </div>
          {game.wrestlers.map((wrestler) => (
            <div className="table-row" key={wrestler.id}>
              <strong>{wrestler.name}</strong>
              <span>{wrestler.popularity}</span>
              <span>{wrestler.momentum}</span>
              <span>{wrestler.fatigue}</span>
              <span>{wrestler.morale}</span>
              <span>{wrestler.ringSkill}</span>
              <span>{wrestler.promoSkill}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function BookingScreen({
  game,
  isQaHarness,
  onAddSegment,
  onBack,
  onNavigate,
  onOpenProfile,
  onRemoveSegment,
  onReplaceCurrentShow,
  onRunShow,
  onSetSegmentChampionship,
  onSetSegmentRivalry,
  onToggleParticipant,
  onUpdateSegment,
}: {
  game: GameState;
  isQaHarness?: boolean;
  onAddSegment: (type: SegmentType, segmentId?: string) => void;
  onBack: () => void;
  onNavigate: (screen: GameScreen) => void;
  onOpenProfile: (wrestlerId: string) => void;
  onRemoveSegment: (id: string) => void;
  onReplaceCurrentShow: (segments: Segment[]) => void;
  onRunShow: () => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentRivalry: (segmentId: string, rivalryId: string) => void;
  onToggleParticipant: (segmentId: string, wrestlerId: string) => void;
  onUpdateSegment: (segmentId: string, updates: Partial<Segment>) => void;
}) {
  const [composerSegmentId, setComposerSegmentId] = useState<string | undefined>();
  const [smartRundownNotes, setSmartRundownNotes] = useState<string[]>([]);
  const [smartRundownError, setSmartRundownError] = useState("");
  const [pendingSmartReplace, setPendingSmartReplace] = useState(false);
  const validShowSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));
  const validSegments = validShowSegments.length;
  const invalidSegments = game.currentShow.length - validSegments;
  const calendarWeek = getCurrentCalendarWeek(game);
  const runtimeMinutes = game.currentShow.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const validRuntimeMinutes = validShowSegments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const runtimePercent = Math.min(100, Math.round((validRuntimeMinutes / showRuntimeTargetMinutes) * 100));
  const readiness = getShowReadiness(validSegments, invalidSegments, validRuntimeMinutes);
  const broadcastRisk = getBroadcastRuntimeRisk(validRuntimeMinutes);
  const canRunShow = readiness.canRun;
  const composerSegment = game.currentShow.find((segment) => segment.id === composerSegmentId);
  const bookedCounts = game.currentShow.reduce<Record<string, number>>((counts, segment) => {
    segment.participantIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, {});

  function beginAddSegment(type: SegmentType) {
    const segmentId = `segment-${Date.now()}-${game.currentShow.length}`;
    onAddSegment(type, segmentId);
    setComposerSegmentId(segmentId);
    setPendingSmartReplace(false);
  }

  function removeAndClose(segmentId: string) {
    onRemoveSegment(segmentId);
    if (composerSegmentId === segmentId) {
      setComposerSegmentId(undefined);
    }
  }

  function applyCatalogOption(segment: Segment, option: SegmentCatalogOption) {
    onUpdateSegment(segment.id, {
      segmentCatalogId: option.id,
      segmentDisplayName: option.label,
      durationMinutes: option.defaultDurationMinutes,
      participantMin: option.minParticipants,
      participantMax: option.maxParticipants,
      championshipId: option.championshipAllowed ? segment.championshipId : undefined,
    });
  }

  function setComposerRivalry(segment: Segment, rivalryId: string) {
    const rivalry = game.rivalries.find((activeRivalry) => activeRivalry.id === rivalryId);
    const range = getSegmentParticipantRange(segment);
    const canPrefill =
      segment.type === "Match" &&
      rivalry?.participantIds.length === 2 &&
      range.min <= 2 &&
      range.max >= 2 &&
      rivalry.participantIds.every((id) => game.wrestlers.some((wrestler) => wrestler.id === id && wrestler.injuryStatus !== "major")) &&
      !hasIntergenderMatchParticipants({ ...segment, participantIds: rivalry.participantIds }, game.wrestlers);

    if (canPrefill && rivalry) {
      onUpdateSegment(segment.id, { rivalryId, participantIds: [...rivalry.participantIds] });
      return;
    }

    onSetSegmentRivalry(segment.id, rivalryId);
  }

  function generateSmartRundown(forceReplace = false) {
    if (game.currentShow.length && !forceReplace) {
      setPendingSmartReplace(true);
      setSmartRundownError("");
      setSmartRundownNotes(["Current rundown detected. Confirm replace to let production draft a fresh editable card."]);
      return;
    }

    const result = buildSmartRundown(game);

    if (result.error) {
      setPendingSmartReplace(false);
      setSmartRundownError(result.error);
      setSmartRundownNotes(result.notes);
      return;
    }

    onReplaceCurrentShow(result.segments);
    setComposerSegmentId(result.segments[0]?.id);
    setPendingSmartReplace(false);
    setSmartRundownError("");
    setSmartRundownNotes(result.notes);
  }

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="booking" hasResults={Boolean(game.showHistory.length)} onNavigate={onNavigate} />
      {isQaHarness ? (
        <section className="qa-harness-banner" aria-label="QA harness notice">
          <strong>QA Runtime Harness</strong>
          <span>In-memory fixture. Real career saves are not updated from this session.</span>
        </section>
      ) : null}
      <section className={`booking-top ${calendarWeek.showType === "ple" ? "ple-panel" : ""}`}>
        <button className="secondary-action" onClick={onBack}>
          Dashboard
        </button>
        <div>
          <p className="eyebrow">
            Season {game.seasonNumber} · Week {game.currentWeek} · {getShowTypeLabel(calendarWeek.showType)}
          </p>
          <h2>{calendarWeek.showName}</h2>
          <p className="lede">
            {calendarWeek.showType === "ple"
              ? "Major-event card. Shape the live block around enough valid TV time, then let the biggest title and rivalry beats breathe."
              : calendarWeek.isGoHome
                ? "Go-home broadcast. Build a complete TV block and set the final tone before the next PLE."
                : "TV production card. Build enough show, leave room to breathe, and protect the locker room."}
          </p>
        </div>
        <button className="primary-action" disabled={!canRunShow} onClick={onRunShow}>
          Run Show
        </button>
      </section>

      <section className="booking-controls" aria-label="Booking controls">
        {bookingSegmentTypes.map((type) => (
          <button disabled={game.currentShow.length >= maxBookingSegments} key={type} onClick={() => beginAddSegment(type)}>
            Add {type}
          </button>
        ))}
        <button className="primary-action" onClick={() => generateSmartRundown(false)}>
          Generate Smart Rundown
        </button>
        <button className="secondary-action" onClick={() => onNavigate("roster")}>
          View Roster
        </button>
        <button className="secondary-action" onClick={() => onNavigate("rivalries")}>
          View Rivalries
        </button>
        <span>{readiness.status} · {validRuntimeMinutes}/{showRuntimeTargetMinutes} ready min</span>
      </section>

      <section className="booking-rundown-layout" aria-label="Current show rundown">
        <div className="rundown-column">
          {(pendingSmartReplace || smartRundownNotes.length || smartRundownError) ? (
            <section className={`smart-rundown-panel ${smartRundownError ? "error" : pendingSmartReplace ? "warning" : ""}`} aria-label="Smart rundown production logic">
              <div className="section-heading">
                <p className="eyebrow">{pendingSmartReplace ? "Replace Rundown?" : "Production Logic"}</p>
                <h3>{pendingSmartReplace ? "Current Card Has Work On It" : smartRundownError ? "Draft Blocked" : "Why This Card?"}</h3>
              </div>
              {smartRundownError ? <p>{smartRundownError}</p> : null}
              {smartRundownNotes.length ? (
                <ul>
                  {smartRundownNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              {pendingSmartReplace ? (
                <div className="smart-rundown-actions">
                  <button className="primary-action" onClick={() => generateSmartRundown(true)}>
                    Confirm Replace Rundown
                  </button>
                  <button className="secondary-action" onClick={() => setPendingSmartReplace(false)}>
                    Keep Current
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={`runtime-board readiness-${readiness.tone}`} aria-label="Runtime plan">
            <div>
              <p className="eyebrow">Runtime Board</p>
              <h3>{readiness.status}</h3>
              <p>{readiness.note}</p>
            </div>
            <div className="runtime-meter" aria-label={`${validRuntimeMinutes} of ${showRuntimeTargetMinutes} valid minutes ready`}>
              <span style={{ width: `${runtimePercent}%` }} />
            </div>
            <div className="runtime-numbers">
              <strong>{validRuntimeMinutes} ready min</strong>
              <span>{runtimeMinutes} min planned</span>
              <span>Ready window {showRuntimeMinMinutes}-{tvRuntimeWarningMinutes} min</span>
            </div>
          </section>

          {broadcastRisk ? (
            <section className={`broadcast-risk-panel risk-${broadcastRisk.tone}`} aria-label="Broadcast runtime risk">
              <div className="section-heading">
                <p className="eyebrow">Live TV Timing</p>
                <h3>{broadcastRisk.title}</h3>
              </div>
              <p>{broadcastRisk.note}</p>
            </section>
          ) : null}

          <section className="segment-list" aria-label="Current show segments">
            {game.currentShow.length === 0 ? (
              <div className="empty-state">The rundown is empty. Add a segment to start building tonight's TV card.</div>
            ) : (
              game.currentShow.map((segment, index) => {
                const selected = composerSegmentId === segment.id;
                const valid = isValidSegment(segment, game.wrestlers);
                const participants = getSegmentParticipants(segment, game.wrestlers);
                const option = getSegmentCatalogOption(segment);

                return (
                  <article className={`segment rundown-segment ${valid ? "valid" : ""} ${selected ? "selected" : ""}`} key={segment.id}>
                    <div className="segment-header">
                      <div>
                        <p className="eyebrow">Segment {index + 1}</p>
                        <h3>
                          {segment.segmentDisplayName ?? segment.type} <span>{getSegmentRuntime(segment)}</span>
                        </h3>
                        <div className="segment-badges">
                          {getSegmentIdentityBadges(segment).map((badge) => (
                            <span key={badge}>{badge}</span>
                          ))}
                        </div>
                        <p className="segment-cue">{option.productionCue}</p>
                        <p>{participants.map((wrestler) => wrestler.name).join(" / ") || getSegmentValidationWarning(segment, game.wrestlers)}</p>
                      </div>
                      <div className="segment-actions">
                        <button className="secondary-action" onClick={() => setComposerSegmentId(segment.id)}>
                          Edit
                        </button>
                        <button className="danger-action" onClick={() => removeAndClose(segment.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    <SegmentContext segment={segment} wrestlers={game.wrestlers} bookedCounts={bookedCounts} />
                  </article>
                );
              })
            )}
          </section>
        </div>

        <aside className="composer-panel" aria-label="Segment composer">
          {composerSegment ? (
            <SegmentComposer
              bookedCounts={bookedCounts}
              championships={game.championships}
              onApplyCatalogOption={(option) => applyCatalogOption(composerSegment, option)}
              onClose={() => setComposerSegmentId(undefined)}
              onOpenProfile={onOpenProfile}
              onRemoveSegment={() => removeAndClose(composerSegment.id)}
              onSetDuration={(durationMinutes) => onUpdateSegment(composerSegment.id, { durationMinutes })}
              onSetSegmentChampionship={onSetSegmentChampionship}
              onSetSegmentRivalry={(rivalryId) => setComposerRivalry(composerSegment, rivalryId)}
              onToggleParticipant={onToggleParticipant}
              rivalries={game.rivalries}
              segment={composerSegment}
              wrestlers={game.wrestlers}
            />
          ) : (
            <div className="composer-empty">
              <p className="eyebrow">Composer</p>
              <h3>Choose a rundown slot</h3>
              <p>Add or edit a segment to set the format, time, talent, title context, and story context.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function SegmentComposer({
  bookedCounts,
  championships,
  onApplyCatalogOption,
  onClose,
  onOpenProfile,
  onRemoveSegment,
  onSetDuration,
  onSetSegmentChampionship,
  onSetSegmentRivalry,
  onToggleParticipant,
  rivalries,
  segment,
  wrestlers,
}: {
  bookedCounts: Record<string, number>;
  championships: Championship[];
  onApplyCatalogOption: (option: SegmentCatalogOption) => void;
  onClose: () => void;
  onOpenProfile: (wrestlerId: string) => void;
  onRemoveSegment: () => void;
  onSetDuration: (durationMinutes: number) => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentRivalry: (rivalryId: string) => void;
  onToggleParticipant: (segmentId: string, wrestlerId: string) => void;
  rivalries: Rivalry[];
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  const catalogOptions = getCatalogOptionsForType(segment.type);
  const selectedOption = getSegmentCatalogOption(segment);
  const range = getSegmentParticipantRange(segment);
  const durationMinutes = getSegmentDurationMinutes(segment);
  const durationMin = Math.max(3, selectedOption.defaultDurationMinutes - 4);
  const durationMax = 45;

  return (
    <div className="segment-composer">
      <div className="composer-head">
        <div>
          <p className="eyebrow">Composer · {segment.type}</p>
          <h3>{segment.segmentDisplayName ?? selectedOption.label}</h3>
          <p>
            {selectedOption.variant} · {selectedOption.group}
          </p>
          <div className="segment-badges">
            {getSegmentIdentityBadges(segment).map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        </div>
        <button className="secondary-action" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="composer-block">
        <div className="participant-label compact-label">
          <span>Format</span>
          <strong>{getSegmentRequirementForSegment(segment)}</strong>
        </div>
        <div className="catalog-grid">
          {catalogOptions.map((option) => (
            <button
              className={segment.segmentCatalogId === option.id ? "active-filter" : ""}
              key={option.id}
              onClick={() => onApplyCatalogOption(option)}
            >
              <span>{option.label}</span>
              <small>
                {option.defaultDurationMinutes} min · {option.minParticipants}
                {option.minParticipants === option.maxParticipants ? "" : `-${option.maxParticipants}`} talent
              </small>
              <small>{option.productionCue}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="composer-block segment-guidance">
        <div>
          <span>Segment Intent</span>
          <strong>{selectedOption.intent}</strong>
        </div>
        <div>
          <span>Production Guidance</span>
          <strong>{selectedOption.note}</strong>
        </div>
        <ul>
          {getSegmentRequirementDetails(segment).map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      </div>

      <div className="composer-block duration-editor">
        <div>
          <span>Runtime</span>
          <strong>{durationMinutes} minutes</strong>
        </div>
        <div className="duration-controls">
          <button
            className="secondary-action"
            disabled={durationMinutes <= durationMin}
            onClick={() => onSetDuration(Math.max(durationMin, durationMinutes - 1))}
          >
            Shorter
          </button>
          <input
            max={durationMax}
            min={durationMin}
            onChange={(event) => onSetDuration(Number(event.target.value))}
            type="range"
            value={durationMinutes}
          />
          <button
            className="secondary-action"
            disabled={durationMinutes >= durationMax}
            onClick={() => onSetDuration(Math.min(durationMax, durationMinutes + 1))}
          >
            Longer
          </button>
        </div>
      </div>

      <SegmentContext segment={segment} wrestlers={wrestlers} bookedCounts={bookedCounts} />
      <TitleMatchControl
        championships={championships}
        onSetSegmentChampionship={onSetSegmentChampionship}
        segment={segment}
        wrestlers={wrestlers}
      />
      <RivalryControl
        onSetSegmentRivalry={(segmentId, rivalryId) => {
          if (segmentId === segment.id) {
            onSetSegmentRivalry(rivalryId);
          }
        }}
        rivalries={rivalries}
        segment={segment}
        wrestlers={wrestlers}
      />

      <div className="participant-label">
        <span>
          {getSegmentPickerLabel(segment.type)} · {range.min === range.max ? `${range.min} required` : `${range.min}-${range.max} allowed`}
        </span>
        {segment.type === "Open Challenge" ? <strong>Opponent revealed after Run Show</strong> : null}
      </div>
      <div className="participant-grid composer-participant-grid">
        {wrestlers.map((wrestler) => {
          const checked = segment.participantIds.includes(wrestler.id);
          const isUnavailable = wrestler.injuryStatus === "major";
          const isDivisionBlocked = wouldCreateIntergenderMatch(segment, wrestler, wrestlers);
          const disabled = (!checked && segment.participantIds.length >= range.max) || (!checked && isUnavailable) || isDivisionBlocked;

          return (
            <div className={`participant-pick ${checked ? "selected" : ""} ${isUnavailable || isDivisionBlocked ? "unavailable" : ""}`} key={wrestler.id}>
              <label>
                <input
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggleParticipant(segment.id, wrestler.id)}
                  type="checkbox"
                />
                <span>
                  <strong>{wrestler.name}</strong>
                  <small>
                    Mom {wrestler.momentum} · Fat {wrestler.fatigue}
                    {wrestler.injuryStatus !== "healthy" ? ` · ${getInjuryStatusLabel(wrestler.injuryStatus)}` : ""}
                    {isDivisionBlocked ? " · Division mismatch" : ""}
                  </small>
                </span>
              </label>
              <button className="inline-action" onClick={() => onOpenProfile(wrestler.id)} type="button">
                Profile
              </button>
            </div>
          );
        })}
      </div>

      <div className="composer-foot">
        <button className="danger-action" onClick={onRemoveSegment}>
          Remove Segment
        </button>
        <button className="primary-action" disabled={!isValidSegment(segment, wrestlers)} onClick={onClose}>
          Set Rundown Slot
        </button>
      </div>
    </div>
  );
}

function RosterScreen({
  game,
  latestResult,
  onNavigate,
  onOpenProfile,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onOpenProfile: (wrestlerId: string) => void;
}) {
  const [sortBy, setSortBy] = useState<RosterSort>("momentum");
  const [filter, setFilter] = useState<RosterFilter>("All");
  const visibleWrestlers = useMemo(() => {
    return [...game.wrestlers]
      .filter((wrestler) => filter === "All" || getWrestlerStatus(wrestler) === filter)
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [filter, game.wrestlers, sortBy]);
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const moraleRiskCount = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Morale Risk")).length;
  const injuryRiskCount = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk")).length;
  const minorInjuryCount = game.wrestlers.filter((wrestler) => wrestler.injuryStatus === "minor").length;
  const unavailableCount = game.wrestlers.filter((wrestler) => wrestler.injuryStatus === "major").length;

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="roster" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Locker Room Report</p>
          <h2>Roster</h2>
          <p className="lede">Read the room before you commit TV time. Momentum, fatigue, and morale tell you who is ready for the push.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="status-grid" aria-label="Roster pressure summary">
        <Metric
          label="Top Overused"
          value={topOverused ? topOverused.name : "None"}
          detail={topOverused ? `Fat ${topOverused.fatigue} · Streak ${topOverused.consecutiveWeeksBooked ?? 0}` : "No pressure spike"}
        />
        <Metric
          label="Top Underused"
          value={topUnderused ? topUnderused.name : "None"}
          detail={topUnderused ? `${getWeeksSinceLastBooked(topUnderused, game.currentWeek)} weeks off TV` : "No long absence"}
        />
        <Metric label="Morale Risk" value={`${moraleRiskCount}`} detail={moraleRiskCount ? "Watch the room" : "Stable"} />
        <Metric label="Injury Risk" value={`${injuryRiskCount}`} detail={injuryRiskCount ? "Protect fatigue" : "Clear"} />
        <Metric label="Minor Injury" value={`${minorInjuryCount}`} detail={minorInjuryCount ? "Book with warnings" : "None"} />
        <Metric label="Unavailable" value={`${unavailableCount}`} detail={unavailableCount ? "Major injury block" : "None"} />
      </section>

      <section className="roster-controls" aria-label="Roster controls">
        <div>
          <span>Sort</span>
          {(["popularity", "momentum", "fatigue", "morale"] as RosterSort[]).map((option) => (
            <button className={sortBy === option ? "active-filter" : ""} key={option} onClick={() => setSortBy(option)}>
              {option}
            </button>
          ))}
        </div>
        <div>
          <span>Filter</span>
          {(["All", "Hot", "Tired", "Frustrated"] as RosterFilter[]).map((option) => (
            <button className={filter === option ? "active-filter" : ""} key={option} onClick={() => setFilter(option)}>
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="roster-grid" aria-label="Roster list">
        {visibleWrestlers.length ? (
          visibleWrestlers.map((wrestler) => (
            <WrestlerCard currentWeek={game.currentWeek} key={wrestler.id} onOpenProfile={onOpenProfile} wrestler={wrestler} />
          ))
        ) : (
          <div className="empty-state">No wrestlers match this filter.</div>
        )}
      </section>
    </main>
  );
}

function WrestlerProfileScreen({
  game,
  latestResult,
  onBackToBooking,
  onBackToRoster,
  onNavigate,
  returnScreen,
  wrestler,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onBackToBooking: () => void;
  onBackToRoster: () => void;
  onNavigate: (screen: GameScreen) => void;
  returnScreen: ProfileReturnScreen;
  wrestler: Wrestler;
}) {
  const status = getWrestlerStatus(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const activeRivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const recentTitleHistory = getWrestlerTitleHistory(game, wrestler.id);
  const recentRivalryHistory = getWrestlerRivalryHistory(game, wrestler.id);
  const recentAppearances = getRecentWrestlerAppearances(game, wrestler.id);
  const recentSocialPosts = getRecentWrestlerSocialPosts(game, wrestler.id);
  const gmRead = getGMRead(wrestler, game);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="profile" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="profile-hero">
        <div>
          <p className="eyebrow">Wrestler Profile</p>
          <h2>{wrestler.name}</h2>
          <div className="identity-strip">
            <span>{status}</span>
            <span>{getInjuryStatusLabel(wrestler.injuryStatus)}</span>
            {pressureTags.length ? pressureTags.map((tag) => <span key={tag}>{tag}</span>) : <span>Balanced</span>}
            {championships.length ? championships.map((championship) => <span key={championship.id}>{championship.name}</span>) : null}
          </div>
        </div>
        <div className="profile-actions">
          {returnScreen === "booking" ? (
            <button className="primary-action" onClick={onBackToBooking}>
              Back to Booking
            </button>
          ) : null}
          <button className={returnScreen === "roster" ? "primary-action" : "secondary-action"} onClick={onBackToRoster}>
            Back to Roster
          </button>
        </div>
      </section>

      <section className="profile-layout" aria-label={`${wrestler.name} profile`}>
        <div className="profile-main">
          <section className="profile-panel" aria-label="Wrestler stats">
            <div className="section-heading">
              <p className="eyebrow">Current Value</p>
              <h3>Stats And TV Load</h3>
            </div>
            <div className="wrestler-stats profile-stat-grid">
              <Metric label="Popularity" value={`${wrestler.popularity}`} />
              <Metric label="Momentum" value={`${wrestler.momentum}`} />
              <Metric label="Fatigue" value={`${wrestler.fatigue}`} />
              <Metric label="Morale" value={`${wrestler.morale}`} />
              <Metric label="Ring Skill" value={`${wrestler.ringSkill}`} />
              <Metric label="Promo Skill" value={`${wrestler.promoSkill}`} />
              <Metric label="Injury" value={getInjuryStatusLabel(wrestler.injuryStatus)} detail={getInjuryDetail(wrestler)} />
              <Metric label="Appearances" value={`${wrestler.appearancesThisSeason ?? 0}`} detail="This season" />
              <Metric label="Last Booked" value={wrestler.lastBookedWeek ? `Week ${wrestler.lastBookedWeek}` : "Never"} detail={`${weeksSinceLastBooked} weeks off TV`} />
              <Metric label="TV Streak" value={`${wrestler.consecutiveWeeksBooked ?? 0}`} detail="Consecutive weeks booked" />
            </div>
          </section>

          <section className="profile-panel gm-read-panel" aria-label="GM read">
            <div className="section-heading">
              <p className="eyebrow">GM Read</p>
              <h3>Decision Context</h3>
            </div>
            <div className="readout-list">
              <p>
                <strong>Useful:</strong> {gmRead.usefulness}
              </p>
              <p>
                <strong>Risk:</strong> {gmRead.risk}
              </p>
              <p>
                <strong>Need:</strong> {gmRead.need}
              </p>
            </div>
          </section>

          <section className="profile-panel" aria-label="Recent show history">
            <div className="section-heading">
              <p className="eyebrow">Recent Show History</p>
              <h3>Last Five Appearances</h3>
            </div>
            <div className="profile-list">
              {recentAppearances.length ? (
                recentAppearances.map((appearance) => (
                  <article className="profile-history-row" key={appearance.id}>
                    <div>
                      <span>
                        Week {appearance.week} · {appearance.showName}
                      </span>
                      <strong>{appearance.type}</strong>
                      {appearance.note ? <p>{appearance.note}</p> : null}
                    </div>
                    <b>{appearance.score}</b>
                  </article>
                ))
              ) : (
                <div className="empty-state compact">No show appearances recorded yet.</div>
              )}
            </div>
          </section>
        </div>

        <aside className="profile-side">
          <section className="profile-panel title-profile-panel" aria-label="Championship context">
            <div className="section-heading">
              <p className="eyebrow">Championship Context</p>
              <h3>{championships.length ? "Current Champion" : "No Current Title"}</h3>
            </div>
            <div className="profile-list">
              {championships.length ? (
                championships.map((championship) => (
                  <article className="profile-context-row" key={championship.id}>
                    <strong>{championship.name}</strong>
                    <span>
                      {championship.division} · Prestige {championship.prestige} · {championship.defenses} defenses
                    </span>
                  </article>
                ))
              ) : (
                <p className="muted-copy">No championship is currently assigned to {wrestler.name}.</p>
              )}
            </div>
            <div className="history-list compact-history" aria-label="Recent title history">
              {recentTitleHistory.length ? (
                recentTitleHistory.map((event) => (
                  <article className="history-event" key={event.id}>
                    <span>{formatChampionshipEventType(event.eventType)} · {formatHistoryStamp(event)}</span>
                    <p>{event.note}</p>
                  </article>
                ))
              ) : (
                <p className="muted-copy">No title history recorded for {wrestler.name} yet.</p>
              )}
            </div>
          </section>

          <section className="profile-panel rivalry-profile-panel" aria-label="Active rivalries">
            <div className="section-heading">
              <p className="eyebrow">Active Rivalries</p>
              <h3>{activeRivalries.length ? "Story Pressure" : "No Active Rivalry"}</h3>
            </div>
            <div className="profile-list">
              {activeRivalries.length ? (
                activeRivalries.map((rivalry) => (
                  <article className="profile-context-row" key={rivalry.id}>
                    <strong>{rivalry.name}</strong>
                    <span>
                      Heat {rivalry.heat} · Freshness {rivalry.freshness} · {formatRivalryStatus(rivalry.status)} · {formatRivalryStakes(rivalry.stakes)}
                    </span>
                  </article>
                ))
              ) : (
                <p className="muted-copy">No active rivalry currently includes {wrestler.name}.</p>
              )}
            </div>
            <div className="history-list compact-history" aria-label="Major rivalry history">
              {recentRivalryHistory.length ? (
                recentRivalryHistory.map((event) => (
                  <article className="history-event" key={event.id}>
                    <span>{formatRivalryEventType(event.eventType)} · {formatHistoryStamp(event)}</span>
                    <p>{event.note}</p>
                  </article>
                ))
              ) : (
                <p className="muted-copy">No major rivalry history recorded for {wrestler.name} yet.</p>
              )}
            </div>
          </section>

          <section className="profile-panel social-profile-panel" aria-label="Recent social mentions">
            <div className="section-heading">
              <p className="eyebrow">Social Mentions</p>
              <h3>Recent IWC Read</h3>
            </div>
            <div className="profile-list">
              {recentSocialPosts.length ? (
                recentSocialPosts.map((post) => (
                  <article className={`social-post compact-social tone-${post.tone}`} key={post.id}>
                    <div className="social-post-head">
                      <div>
                        <span>{formatSocialCategory(post.category)}</span>
                        <strong>{post.author}</strong>
                      </div>
                      <small>Week {post.weekNumber}</small>
                    </div>
                    <p>{post.text}</p>
                  </article>
                ))
              ) : (
                <div className="empty-state compact">No recent social posts mention {wrestler.name}.</div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function ChampionshipsScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="championships" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Title Office</p>
          <h2>Championships</h2>
          <p className="lede">Prestige lives here. Champions anchor the brand, contenders circle, and title matches create stakes once the bell rings.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="championship-grid" aria-label="Championships">
        {game.championships.map((championship) => {
          const contenders = getTopContenders(championship, game.wrestlers);
          const recentHistory = getChampionshipHistory(game, championship.id);

          return (
            <article className="championship-card" key={championship.id}>
              <div className="championship-head">
                <div>
                  <p className="eyebrow">{championship.division}</p>
                  <h3>{championship.name}</h3>
                </div>
                <strong>Prestige {championship.prestige}</strong>
              </div>
              <div className="spotlight-grid">
                <Metric label="Champion" value={getWrestlerNames(championship.championIds, game.wrestlers)} />
                <Metric label="Reign" value={`${getReignLength(championship, game.currentWeek)} Week${getReignLength(championship, game.currentWeek) === 1 ? "" : "s"}`} />
                <Metric label="Defenses" value={`${championship.defenses}`} />
              </div>
              <div className="contender-strip">
                <span>Top Contenders</span>
                <strong>{contenders.map((wrestler) => wrestler.name).join(" / ")}</strong>
              </div>
              <div className="history-list" aria-label={`${championship.name} recent history`}>
                <span className="history-label">Recent History</span>
                {recentHistory.length ? (
                  recentHistory.map((event) => (
                    <article className="history-event" key={event.id}>
                      <span>{formatChampionshipEventType(event.eventType)} · {formatHistoryStamp(event)}</span>
                      <p>{event.note}</p>
                    </article>
                  ))
                ) : (
                  <p className="muted-copy">No title changes or defenses recorded yet.</p>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function RivalriesScreen({
  game,
  latestResult,
  onCreateRivalry,
  onEndRivalry,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onCreateRivalry: (wrestlerAId: string, wrestlerBId: string, stakes: RivalryStakes) => void;
  onEndRivalry: (rivalryId: string) => void;
  onNavigate: (screen: GameScreen) => void;
}) {
  const [wrestlerAId, setWrestlerAId] = useState(game.wrestlers[0]?.id ?? "");
  const [wrestlerBId, setWrestlerBId] = useState(game.wrestlers[1]?.id ?? "");
  const [stakes, setStakes] = useState<RivalryStakes>("personal");
  const isDuplicate = hasDuplicateRivalry(game.rivalries, wrestlerAId, wrestlerBId);
  const canCreate = wrestlerAId && wrestlerBId && wrestlerAId !== wrestlerBId && !isDuplicate;

  function handleCreateRivalry() {
    if (!canCreate) {
      return;
    }

    onCreateRivalry(wrestlerAId, wrestlerBId, stakes);
  }

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="rivalries" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Story Room</p>
          <h2>Rivalries</h2>
          <p className="lede">Track the stories giving TV some bite. Hot angles deserve time, cooling angles need care, and stale ones need a clean exit.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="rivalry-form" aria-label="Create rivalry">
        <div className="section-heading">
          <p className="eyebrow">Start Rivalry</p>
          <h3>Book The Spark</h3>
        </div>
        <label>
          Wrestler A
          <select value={wrestlerAId} onChange={(event) => setWrestlerAId(event.target.value)}>
            {game.wrestlers.map((wrestler) => (
              <option key={wrestler.id} value={wrestler.id}>
                {wrestler.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Wrestler B
          <select value={wrestlerBId} onChange={(event) => setWrestlerBId(event.target.value)}>
            {game.wrestlers.map((wrestler) => (
              <option key={wrestler.id} value={wrestler.id}>
                {wrestler.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stakes
          <select value={stakes} onChange={(event) => setStakes(event.target.value as RivalryStakes)}>
            {(["personal", "title", "respect", "revenge"] as RivalryStakes[]).map((option) => (
              <option key={option} value={option}>
                {formatRivalryStakes(option)}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action" disabled={!canCreate} onClick={handleCreateRivalry}>
          Create Rivalry
        </button>
        {isDuplicate ? <p className="form-warning">Duplicate active rivalry already exists.</p> : null}
      </section>

      <section className="rivalry-grid" aria-label="Active rivalries">
        {game.rivalries.length ? (
          game.rivalries.map((rivalry) => {
            const recentHistory = getRivalryHistory(game, rivalry.id);
            const plePayoff = hasPlePayoff(game, rivalry.id);

            return (
              <article className={`rivalry-card status-${rivalry.status}`} key={rivalry.id}>
                <div className="rivalry-head">
                  <div>
                    <p className="eyebrow">{formatRivalryStakes(rivalry.stakes)} Stakes</p>
                    <h3>{rivalry.name}</h3>
                  </div>
                  <strong>{plePayoff ? "PLE Payoff" : formatRivalryStatus(rivalry.status)}</strong>
                </div>
                <div className="spotlight-grid">
                  <Metric label="Participants" value={getRivalryParticipants(rivalry, game.wrestlers).map((wrestler) => wrestler.name).join(" / ")} />
                  <Metric label="Heat" value={`${rivalry.heat}`} />
                  <Metric label="Freshness" value={`${rivalry.freshness}`} />
                  <Metric label="Weeks Active" value={`${rivalry.weeksActive}`} />
                  <Metric label="Last Advanced" value={rivalry.lastAdvancedWeek ? `Week ${rivalry.lastAdvancedWeek}` : "Not On TV Yet"} />
                  <Metric label="Stakes" value={formatRivalryStakes(rivalry.stakes)} />
                </div>
                <div className="history-list" aria-label={`${rivalry.name} recent history`}>
                  <span className="history-label">Recent History</span>
                  {recentHistory.length ? (
                    recentHistory.map((event) => (
                      <article className="history-event" key={event.id}>
                        <span>{formatRivalryEventType(event.eventType)} · {formatHistoryStamp(event)}</span>
                        <p>{event.note}</p>
                      </article>
                    ))
                  ) : (
                    <p className="muted-copy">No rivalry history recorded yet.</p>
                  )}
                </div>
                <button className="danger-action" onClick={() => onEndRivalry(rivalry.id)}>
                  End Rivalry
                </button>
              </article>
            );
          })
        ) : (
          <div className="empty-state">No rivalries are active. Start a two-wrestler story to give the next broadcast more context.</div>
        )}
      </section>
    </main>
  );
}

function CalendarScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);

  function getWeekResult(week: CalendarWeek) {
    return game.showHistory.find(
      (result) =>
        result.id === week.resultId ||
        (result.seasonNumber === game.seasonNumber && result.week === week.weekNumber && result.showName === week.showName),
    );
  }

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="calendar" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} Calendar</p>
          <h2>Road To PLE</h2>
          <p className="lede">
            Week {game.currentWeek} is {currentShow.showName}.{" "}
            {nextPle
              ? `${nextPle.showName} is ${weeksUntilPle === 0 ? "tonight" : `${weeksUntilPle} week${weeksUntilPle === 1 ? "" : "s"} away`}.`
              : "The season calendar is complete."}
          </p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="calendar-list" aria-label="Season calendar">
        {game.calendar.map((week) => {
          const result = getWeekResult(week);
          const isCurrent = week.weekNumber === game.currentWeek && !week.completed;
          const status = week.completed ? "Completed" : isCurrent ? "Current" : "Upcoming";

          return (
            <article className={`calendar-week ${week.showType} ${isCurrent ? "current" : ""} ${week.completed ? "completed" : ""}`} key={week.weekNumber}>
              <div>
                <p className="eyebrow">
                  Week {week.weekNumber} · {status}
                </p>
                <h3>{week.showName}</h3>
                <div className="show-strip">
                  <span>{getShowTypeLabel(week.showType)}</span>
                  {week.isGoHome ? <span>Go-Home</span> : null}
                  {week.weekNumber === 12 ? <span>Season Finale</span> : null}
                </div>
              </div>
              <div className="calendar-result">
                {result ? (
                  <>
                    <strong>{result.totalScore}</strong>
                    <span>Grade {getShowGrade(result.totalScore)}</span>
                  </>
                ) : (
                  <>
                    <strong>{week.completed ? "No Result" : "On Deck"}</strong>
                    <span>{week.showType === "ple" ? "Major event" : "Weekly TV"}</span>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function SocialScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const [filter, setFilter] = useState<SocialFilter>("All");
  const categories = getSocialFilterCategory(filter);
  const visiblePosts = [...game.socialPosts]
    .reverse()
    .filter((post) => !categories || categories.includes(post.category));

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="social" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Post-Show Pulse</p>
          <h2>Social / IWC</h2>
          <p className="lede">The feed only reacts to shows that actually happened: scores, title fallout, rivalry movement, fatigue, and major-event moments.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="roster-controls" aria-label="Social filters">
        <div>
          <span>Filter</span>
          {(["All", "Fan Reaction", "Dirt Sheets", "Analyst Takes", "Title Scene", "Rivalries"] as SocialFilter[]).map((option) => (
            <button className={filter === option ? "active-filter" : ""} key={option} onClick={() => setFilter(option)}>
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="social-feed" aria-label="Social posts">
        {visiblePosts.length ? (
          visiblePosts.map((post) => (
            <article className={`social-post tone-${post.tone}`} key={post.id}>
              <div className="social-post-head">
                <div>
                  <p className="eyebrow">
                    Season {post.seasonNumber} · Week {post.weekNumber} · {post.showName}
                  </p>
                  <h3>{post.author}</h3>
                </div>
                <div className="show-strip">
                  <span>{formatSocialCategory(post.category)}</span>
                  <span>{formatSocialTone(post.tone)}</span>
                </div>
              </div>
              <p>{post.text}</p>
              {post.relatedWrestlerIds.length ? (
                <small>Related: {getRelatedWrestlerNames(post, game.wrestlers)}</small>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            {game.socialPosts.length ? "No posts match this filter." : "The internet has nothing to react to yet. Run a show and the buzz will arrive after the results."}
          </div>
        )}
      </section>
    </main>
  );
}

function FinanceScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const latestReport = getLatestFinanceReport(game);
  const seasonReports = getSeasonFinanceReports(game);
  const totalProfitLoss = seasonReports.reduce((sum, report) => sum + report.profitLoss, 0);
  const bestRevenueReport = getBestRevenueReport(seasonReports);
  const worstProfitReport = getWorstProfitReport(seasonReports);
  const pressureLabel = getFinancePressureLabel(game.money, latestReport?.profitLoss ?? 0);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="finance" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Brand Office</p>
          <h2>Finance</h2>
          <p className="lede">Cash pressure, weekly business, and show fallout. No forecasts here, just what the last broadcast actually did.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="status-grid" aria-label="Finance summary">
        <Metric label="Current Money" value={formatMoney(game.money)} />
        <Metric label="Pressure" value={pressureLabel} />
        <Metric label="Season P/L" value={formatMoney(totalProfitLoss)} />
        <Metric label="Reports" value={`${game.financeReports.length}`} />
      </section>

      {latestReport ? (
        <section className="finance-report-card">
          <div className="section-heading">
            <p className="eyebrow">
              Latest Report · {getShowTypeLabel(latestReport.showType)}
            </p>
            <h3>{latestReport.showName}</h3>
          </div>
          <div className="spotlight-grid">
            <Metric label="Attendance" value={latestReport.attendance.toLocaleString()} />
            <Metric label="Revenue" value={formatMoney(latestReport.ticketRevenue + latestReport.merchRevenue + latestReport.mediaRevenue)} />
            <Metric label="Costs" value={formatMoney(latestReport.talentCost + latestReport.productionCost)} />
            <Metric label="Profit/Loss" value={formatMoney(latestReport.profitLoss)} />
            <Metric label="Ending Money" value={formatMoney(latestReport.endingMoney)} />
            <Metric label="Show Score" value={`${latestReport.showScore}`} />
          </div>
          <div className="finance-notes">
            {latestReport.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </section>
      ) : (
        <div className="empty-state">No finance reports yet. Run a show and the brand office will close the books after results.</div>
      )}

      {seasonReports.length ? (
        <section className="command-grid">
          <article className="command-panel">
            <div className="section-heading">
              <p className="eyebrow">Best Revenue Week</p>
              <h3>{bestRevenueReport?.showName ?? "None"}</h3>
            </div>
            <p className="social-preview-text">
              {bestRevenueReport
                ? `${formatMoney(bestRevenueReport.ticketRevenue + bestRevenueReport.merchRevenue + bestRevenueReport.mediaRevenue)} revenue in Week ${bestRevenueReport.weekNumber}.`
                : "No revenue booked yet."}
            </p>
          </article>
          <article className="command-panel">
            <div className="section-heading">
              <p className="eyebrow">Worst Profit/Loss</p>
              <h3>{worstProfitReport?.showName ?? "None"}</h3>
            </div>
            <p className="social-preview-text">
              {worstProfitReport ? `${formatMoney(worstProfitReport.profitLoss)} in Week ${worstProfitReport.weekNumber}.` : "No report yet."}
            </p>
          </article>
        </section>
      ) : null}

      <section className="finance-history" aria-label="Finance history">
        {game.financeReports.length ? (
          [...game.financeReports].reverse().map((report) => (
            <article className="finance-history-row" key={report.id}>
              <div>
                <p className="eyebrow">
                  Season {report.seasonNumber} · Week {report.weekNumber} · {getShowTypeLabel(report.showType)}
                </p>
                <h3>{report.showName}</h3>
              </div>
              <div className="finance-row-numbers">
                <span>Attendance {report.attendance.toLocaleString()}</span>
                <strong>{formatMoney(report.profitLoss)}</strong>
              </div>
            </article>
          ))
        ) : null}
      </section>
    </main>
  );
}

function ResultsScreen({
  game,
  onContinueWeekReview,
  onNavigate,
  result,
}: {
  game: GameState;
  onContinueWeekReview: () => void;
  result: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const bestSegment = getBestSegment(result);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="results" hasResults onNavigate={onNavigate} />
      <section className="results-hero">
        <div>
          <p className="eyebrow">
            Season {result.seasonNumber} · Week {result.week} · {getShowTypeLabel(result.showType)}
          </p>
          <h2>
            {result.totalScore} <span>{getShowGrade(result.totalScore)}</span>
          </h2>
          <p className="lede">{buildBroadcastRecap(result)}</p>
        </div>
        <button className="primary-action" onClick={onContinueWeekReview}>
          Continue to Week Review
        </button>
      </section>

      <section className="status-grid" aria-label="Show highlights">
        <Metric label="Show Score" value={`${result.totalScore}`} detail={`Grade ${getShowGrade(result.totalScore)}`} />
        <Metric label="Best Segment" value={`${bestSegment.score}`} detail={bestSegment.participantNames.join(" / ")} />
        <Metric
          label="Runtime"
          value={result.actualRuntimeMinutes !== undefined ? `${result.actualRuntimeMinutes} min` : "Legacy"}
          detail={result.plannedRuntimeMinutes !== undefined ? `Planned ${result.plannedRuntimeMinutes} min${result.broadcastOverrunMinutes ? ` · +${result.broadcastOverrunMinutes} over` : ""}` : "No runtime record"}
        />
        <Metric label="Best Type" value={bestSegment.type} detail={bestSegment.participantNames.join(" / ")} />
      </section>

      {result.broadcastOverrunNotes?.length ? (
        <section className="broadcast-overrun-fallout" aria-label="Broadcast overrun fallout">
          <div className="section-heading">
            <p className="eyebrow">Broadcast Timing</p>
            <h3>{result.broadcastOverrunLevel === "major" ? "Major Overrun" : result.broadcastOverrunLevel === "moderate" ? "Overrun Pressure" : "Minor Overrun"}</h3>
          </div>
          {result.broadcastOverrunNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      ) : null}

      {result.titleNotes?.length ? (
        <section className="title-fallout" aria-label="Title fallout">
          <div className="section-heading">
            <p className="eyebrow">Title Fallout</p>
            <h3>Championship Stakes</h3>
          </div>
          {result.titleNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      ) : null}

      {result.rivalryNotes?.length ? (
        <section className="story-fallout" aria-label="Rivalry fallout">
          <div className="section-heading">
            <p className="eyebrow">Story Fallout</p>
            <h3>Rivalry Movement</h3>
          </div>
          {result.rivalryNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      ) : null}

      {result.lockerRoomFallout?.injuryNotes?.length ? (
        <section className="locker-room-fallout" aria-label="Injury fallout">
          <div className="section-heading">
            <p className="eyebrow">Injury Fallout</p>
            <h3>Medical Update</h3>
          </div>
          <div className="fallout-grid">
            {result.lockerRoomFallout.injuryNotes.map((item) => (
              <div key={`${item.wrestlerId}-${item.status}`}>
                <span>{getInjuryStatusLabel(item.status)}</span>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="results-list" aria-label="Segment results">
        <div className="section-heading">
          <p className="eyebrow">Broadcast Breakdown</p>
          <h3>Segment By Segment</h3>
        </div>
        {result.segmentResults.map((segment, index) => (
          <article className="result-row" key={segment.segmentId}>
            <div>
              <p className="eyebrow">
                Segment {index + 1} · {segment.type}
              </p>
              <h3>{segment.participantNames.join(" / ")}</h3>
              <p>
                Momentum +{getResultChange(segment.momentumChanges)} · Fatigue +{getResultChange(segment.fatigueChanges)}
              </p>
              <p>
                {segment.actualDurationMinutes !== undefined
                  ? `Runtime ${segment.plannedDurationMinutes ?? 0} planned / ${segment.actualDurationMinutes} actual · ${formatRuntimeVariance(segment.durationVarianceMinutes)}`
                  : "Runtime not recorded for this legacy segment"}
                {segment.overrunAffected ? " · closing block compressed" : ""}
              </p>
              {segment.recapNote ? <p>{segment.recapNote}</p> : null}
              {segment.titleNote ? <p className="title-note">{segment.titleNote}</p> : null}
              {segment.rivalryNote ? <p className="rivalry-note">{segment.rivalryNote}</p> : null}
            </div>
            <strong>{segment.score}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}

function WeekReviewScreen({
  game,
  onAdvanceWeek,
  onNavigate,
  result,
}: {
  game: GameState;
  onAdvanceWeek: () => void;
  onNavigate: (screen: GameScreen) => void;
  result: ShowResult;
}) {
  const bestSegment = getBestSegment(result);
  const financeReport = getFinanceReportForResult(game, result);
  const buzzPreview = game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week).slice(-3).reverse();
  const bookedIds = [...new Set(result.segmentResults.flatMap((segment) => segment.participantIds))];
  const injuryRiskWrestlers = game.wrestlers.filter(
    (wrestler) => bookedIds.includes(wrestler.id) && getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );
  const rivalryIds = [...new Set(result.segmentResults.map((segment) => segment.rivalryId).filter((id): id is string => Boolean(id)))];
  const reviewedRivalries = rivalryIds
    .map((id) => game.rivalries.find((rivalry) => rivalry.id === id))
    .filter((rivalry): rivalry is Rivalry => Boolean(rivalry));
  const titleHistoryEvents = result.titleHistoryEvents ?? [];
  const rivalryHistoryEvents = result.rivalryHistoryEvents ?? [];
  const nextWeek = game.calendar.find((week) => week.weekNumber === result.week + 1);
  const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= result.week + 1 && !week.completed);
  const weeksUntilNextPle = nextPle ? Math.max(0, nextPle.weekNumber - result.week) : 0;

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="weekReview" hasResults onNavigate={onNavigate} />
      <section className="results-hero week-review-hero">
        <div>
          <p className="eyebrow">
            Season {result.seasonNumber} · Week {result.week} Review
          </p>
          <h2>Week Review</h2>
          <p className="lede">The broadcast is locked. Read the actual fallout before the office moves the calendar.</p>
        </div>
        <button className="primary-action" onClick={onAdvanceWeek}>
          {result.week >= 12 ? "Season Review" : "Advance Week"}
        </button>
      </section>

      <section className="status-grid" aria-label="Week review show outcome">
        <Metric label="Show Score" value={`${result.totalScore}`} detail={`Grade ${getShowGrade(result.totalScore)}`} />
        <Metric label="Best Segment" value={`${bestSegment.score}`} detail={bestSegment.participantNames.join(" / ")} />
        <Metric
          label="Runtime"
          value={result.actualRuntimeMinutes !== undefined ? `${result.actualRuntimeMinutes} min` : "Legacy"}
          detail={result.plannedRuntimeMinutes !== undefined ? `Planned ${result.plannedRuntimeMinutes} min` : "No runtime record"}
        />
        <Metric label="Show" value={result.showName} detail={getShowTypeLabel(result.showType)} />
      </section>

      {result.broadcastOverrunNotes?.length ? (
        <section className="broadcast-overrun-fallout" aria-label="Week review broadcast overrun">
          <div className="section-heading">
            <p className="eyebrow">Broadcast Fallout</p>
            <h3>Closing Block Pressure</h3>
          </div>
          {result.broadcastOverrunNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      ) : null}

      <section className="locker-room-fallout" aria-label="Locker room fallout">
        <div className="section-heading">
          <p className="eyebrow">Roster Fallout</p>
          <h3>Locker Room Pressure</h3>
        </div>
        <div className="fallout-grid">
          {result.lockerRoomFallout?.moraleDrops.length ? (
            <div>
              <span>Morale Drops</span>
              {result.lockerRoomFallout.moraleDrops.map((item) => (
                <p key={`${item.wrestlerId}-drop`}>
                  {item.note} {item.moraleChange ? `(${item.moraleChange})` : ""}
                </p>
              ))}
            </div>
          ) : null}
          {result.lockerRoomFallout?.moraleBoosts.length ? (
            <div>
              <span>Morale Boosts</span>
              {result.lockerRoomFallout.moraleBoosts.map((item) => (
                <p key={`${item.wrestlerId}-boost`}>
                  {item.note} {item.moraleChange ? `(+${item.moraleChange})` : ""}
                </p>
              ))}
            </div>
          ) : null}
          {result.lockerRoomFallout?.overuseWarnings.length ? (
            <div>
              <span>Overuse Warnings</span>
              {result.lockerRoomFallout.overuseWarnings.map((item) => (
                <p key={`${item.wrestlerId}-overuse`}>{item.note}</p>
              ))}
            </div>
          ) : null}
          {result.lockerRoomFallout?.underuseWarnings.length ? (
            <div>
              <span>Underuse Warnings</span>
              {result.lockerRoomFallout.underuseWarnings.map((item) => (
                <p key={`${item.wrestlerId}-underuse`}>{item.note}</p>
              ))}
            </div>
          ) : null}
          {result.lockerRoomFallout?.injuryNotes?.length ? (
            <div>
              <span>New Injuries</span>
              {result.lockerRoomFallout.injuryNotes.map((item) => (
                <p key={`${item.wrestlerId}-injury`}>
                  {item.note} {item.description}
                </p>
              ))}
            </div>
          ) : null}
          {injuryRiskWrestlers.length ? (
            <div>
              <span>Injury Risk Warnings</span>
              {injuryRiskWrestlers.map((wrestler) => (
                <p key={`${wrestler.id}-injury-risk`}>
                  {wrestler.name} finished the show at {wrestler.fatigue} fatigue.
                </p>
              ))}
            </div>
          ) : null}
          {!result.lockerRoomFallout?.moraleDrops.length &&
          !result.lockerRoomFallout?.moraleBoosts.length &&
          !result.lockerRoomFallout?.overuseWarnings.length &&
          !result.lockerRoomFallout?.underuseWarnings.length &&
          !result.lockerRoomFallout?.injuryNotes?.length &&
          !injuryRiskWrestlers.length ? (
            <div>
              <span>Locker Room</span>
              <p>No major roster pressure moved after this show. The room stays level for now.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="title-fallout" aria-label="Championship fallout">
        <div className="section-heading">
          <p className="eyebrow">Championship Fallout</p>
          <h3>Title Picture</h3>
        </div>
        {titleHistoryEvents.length ? (
          <div className="history-list">
            {titleHistoryEvents.map((event) => (
              <article className="history-event" key={event.id}>
                <span>{formatChampionshipEventType(event.eventType)} · {event.championshipName}</span>
                <p>{event.note}</p>
              </article>
            ))}
          </div>
        ) : result.titleNotes.length ? (
          result.titleNotes.map((note, index) => <p key={`${note}-${index}`}>{note}</p>)
        ) : (
          <p>No championship changes or defenses.</p>
        )}
      </section>

      <section className="story-fallout" aria-label="Rivalry fallout">
        <div className="section-heading">
          <p className="eyebrow">Rivalry Fallout</p>
          <h3>Story Movement</h3>
        </div>
        {rivalryHistoryEvents.length ? (
          <div className="history-list">
            {rivalryHistoryEvents.map((event) => (
              <article className="history-event" key={event.id}>
                <span>{formatRivalryEventType(event.eventType)} · {event.rivalryName}</span>
                <p>{event.note}</p>
              </article>
            ))}
          </div>
        ) : result.rivalryNotes.length ? (
          result.rivalryNotes.map((note, index) => <p key={`${note}-${index}`}>{note}</p>)
        ) : (
          <p>No attached rivalry movement.</p>
        )}
        {reviewedRivalries.length ? (
          <div className="spotlight-grid compact-grid">
            {reviewedRivalries.map((rivalry) => (
              <Metric
                detail={`Freshness ${rivalry.freshness} · ${formatRivalryStatus(rivalry.status)}`}
                key={rivalry.id}
                label={rivalry.name}
                value={`Heat ${rivalry.heat}`}
              />
            ))}
          </div>
        ) : null}
      </section>

      {buzzPreview.length ? (
        <section className="social-buzz" aria-label="Week review social buzz">
          <div className="section-heading">
            <p className="eyebrow">Social Buzz</p>
            <h3>IWC Readout</h3>
          </div>
          <div className="social-preview-grid">
            {buzzPreview.map((post) => (
              <article className="social-preview" key={post.id}>
                <span>{formatSocialCategory(post.category)}</span>
                <strong>{post.author}</strong>
                <p>{post.text}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {financeReport ? (
        <section className="finance-fallout" aria-label="Week review financial fallout">
          <div className="section-heading">
            <p className="eyebrow">Finance Fallout</p>
            <h3>Brand Office Close</h3>
          </div>
          <div className="spotlight-grid">
            <Metric label="Profit/Loss" value={formatMoney(financeReport.profitLoss)} />
            <Metric label="Attendance" value={financeReport.attendance.toLocaleString()} />
            <Metric label="Ending Money" value={formatMoney(financeReport.endingMoney)} />
          </div>
        </section>
      ) : null}

      <section className="command-panel calendar-spotlight" aria-label="Next week teaser">
        <div className="section-heading">
          <p className="eyebrow">Next Week</p>
          <h3>{nextWeek ? nextWeek.showName : "Season Review"}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Next Show" value={nextWeek ? nextWeek.showName : "Season Complete"} detail={nextWeek ? getShowTypeLabel(nextWeek.showType) : "Review the year"} />
          <Metric
            label="Next PLE"
            value={nextPle ? nextPle.showName : "None"}
            detail={nextPle ? `${weeksUntilNextPle} week${weeksUntilNextPle === 1 ? "" : "s"} away` : "No remaining PLE"}
          />
          <Metric label="Action" value={result.week >= 12 ? "Review Season" : "Advance Week"} detail="Calendar moves after this screen" />
        </div>
      </section>
    </main>
  );
}

function SeasonReviewScreen({
  game,
  onStartNextSeason,
}: {
  game: GameState;
  onStartNextSeason: () => void;
}) {
  const bestShow = getBestShow(game.showHistory, game.seasonNumber);
  const topMomentum = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0];
  const mostFatigued = [...game.wrestlers].sort((a, b) => b.fatigue - a.fatigue)[0];
  const hottestRivalry = getHottestRivalry(game.rivalries);
  const seasonReports = getSeasonFinanceReports(game);
  const seasonProfitLoss = game.money - game.seasonStartingMoney;
  const bestRevenueReport = getBestRevenueReport(seasonReports);
  const worstProfitReport = getWorstProfitReport(seasonReports);
  const biggestTitleChange = getBiggestTitleChange(game);
  const mostDefendedChampionship = getMostDefendedChampionship(game);
  const hottestRivalryStory = getHottestRivalryStory(game);
  const mostEventfulRivalry = getMostEventfulRivalry(game);
  const notablePlePayoff = getNotablePlePayoff(game);

  return (
    <main className="app-shell">
      <Header game={game} />
      <section className="results-hero season-review-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} Review</p>
          <h2>Final Bell</h2>
          <p className="lede">The 12-week road is complete. The ledger, locker room, titles, and grudges carry into the next season.</p>
        </div>
        <button className="primary-action" onClick={onStartNextSeason}>
          Start Next Season
        </button>
      </section>

      <section className="status-grid" aria-label="Season review">
        <Metric label="Starting Money" value={formatMoney(game.seasonStartingMoney)} />
        <Metric label="Final Money" value={formatMoney(game.money)} />
        <Metric label="Season P/L" value={formatMoney(seasonProfitLoss)} />
        <Metric label="Best Show" value={bestShow ? bestShow.showName : "No Shows"} detail={bestShow ? `${bestShow.totalScore} (${getShowGrade(bestShow.totalScore)})` : undefined} />
      </section>

      <section className="status-grid" aria-label="Season roster review">
        <Metric label="Top Momentum" value={topMomentum.name} detail={`${topMomentum.momentum}`} />
        <Metric label="Most Fatigued" value={mostFatigued.name} detail={`${mostFatigued.fatigue}`} />
        <Metric
          label="Best Revenue"
          value={bestRevenueReport ? bestRevenueReport.showName : "No Report"}
          detail={bestRevenueReport ? formatMoney(bestRevenueReport.ticketRevenue + bestRevenueReport.merchRevenue + bestRevenueReport.mediaRevenue) : undefined}
        />
        <Metric label="Worst P/L" value={worstProfitReport ? worstProfitReport.showName : "No Report"} detail={worstProfitReport ? formatMoney(worstProfitReport.profitLoss) : undefined} />
      </section>

      <section className="command-panel rivalry-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Hottest Rivalry</p>
          <h3>{hottestRivalryStory ? hottestRivalryStory.name : hottestRivalry ? hottestRivalry.name : "No Rivalry History"}</h3>
        </div>
        {hottestRivalryStory ? (
          <div className="spotlight-grid">
            <Metric label="Peak Heat" value={`${hottestRivalryStory.heat}`} />
            <Metric label="Most Eventful" value={mostEventfulRivalry ? mostEventfulRivalry.name : "No Events"} detail={mostEventfulRivalry ? `${mostEventfulRivalry.count} events` : undefined} />
            <Metric label="PLE Payoff" value={notablePlePayoff ? notablePlePayoff.rivalryName : "None"} detail={notablePlePayoff ? notablePlePayoff.showName : undefined} />
          </div>
        ) : hottestRivalry ? (
          <div className="spotlight-grid">
            <Metric label="Heat" value={`${hottestRivalry.heat}`} />
            <Metric label="Freshness" value={`${hottestRivalry.freshness}`} />
            <Metric label="Status" value={formatRivalryStatus(hottestRivalry.status)} />
          </div>
        ) : null}
      </section>

      <section className="championship-grid" aria-label="Current champions">
        <article className="championship-card">
          <div className="championship-head">
            <div>
              <p className="eyebrow">Season Title Story</p>
              <h3>{biggestTitleChange ? biggestTitleChange.championshipName : "No Title Changes"}</h3>
            </div>
            <strong>{mostDefendedChampionship ? `${mostDefendedChampionship.count} Defenses` : "No Defenses"}</strong>
          </div>
          <div className="history-list">
            {biggestTitleChange ? (
              <article className="history-event">
                <span>Biggest Title Change · {formatHistoryStamp(biggestTitleChange)}</span>
                <p>{biggestTitleChange.note}</p>
              </article>
            ) : (
              <p className="muted-copy">No championship changed hands this season.</p>
            )}
            {mostDefendedChampionship ? (
              <article className="history-event">
                <span>Most Defended Championship</span>
                <p>
                  {mostDefendedChampionship.championship.name} survived {mostDefendedChampionship.count} defense
                  {mostDefendedChampionship.count === 1 ? "" : "s"} this season.
                </p>
              </article>
            ) : (
              <p className="muted-copy">No successful title defenses were recorded this season.</p>
            )}
          </div>
        </article>
        {game.championships.map((championship) => (
          <article className="championship-card" key={championship.id}>
            <div className="championship-head">
              <div>
                <p className="eyebrow">{championship.division}</p>
                <h3>{championship.name}</h3>
              </div>
              <strong>{getWrestlerNames(championship.championIds, game.wrestlers)}</strong>
            </div>
            <div className="spotlight-grid">
              <Metric label="Prestige" value={`${championship.prestige}`} />
              <Metric label="Defenses" value={`${championship.defenses}`} />
              <Metric label="Reign" value={`${getReignLength(championship, game.currentWeek)} Week${getReignLength(championship, game.currentWeek) === 1 ? "" : "s"}`} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function WrestlerCard({
  currentWeek,
  onOpenProfile,
  wrestler,
}: {
  currentWeek: number;
  onOpenProfile: (wrestlerId: string) => void;
  wrestler: Wrestler;
}) {
  const status = getWrestlerStatus(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, currentWeek);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, currentWeek);

  return (
    <article className={`wrestler-card status-${status.toLowerCase()}`}>
      <div className="wrestler-card-head">
        <div>
          <p className="eyebrow">Talent File</p>
          <h3>{wrestler.name}</h3>
        </div>
        <div className="wrestler-card-actions">
          <strong>{status}</strong>
          <button className="secondary-action" onClick={() => onOpenProfile(wrestler.id)}>
            View Profile
          </button>
        </div>
      </div>
      <div className="pressure-tags">
        {pressureTags.length ? pressureTags.map((tag) => <span key={tag}>{tag}</span>) : <span>Balanced</span>}
      </div>
      <div className="wrestler-stats">
        <Metric label="Popularity" value={`${wrestler.popularity}`} />
        <Metric label="Momentum" value={`${wrestler.momentum}`} />
        <Metric label="Fatigue" value={`${wrestler.fatigue}`} />
        <Metric label="Morale" value={`${wrestler.morale}`} />
        <Metric label="Ring" value={`${wrestler.ringSkill}`} />
        <Metric label="Promo" value={`${wrestler.promoSkill}`} />
        <Metric label="Injury" value={getInjuryStatusLabel(wrestler.injuryStatus)} detail={getInjuryDetail(wrestler)} />
        <Metric label="Appearances" value={`${wrestler.appearancesThisSeason ?? 0}`} detail="This season" />
        <Metric label="Last Booked" value={wrestler.lastBookedWeek ? `Week ${wrestler.lastBookedWeek}` : "Never"} detail={`${weeksSinceLastBooked} weeks off TV`} />
        <Metric label="TV Streak" value={`${wrestler.consecutiveWeeksBooked ?? 0}`} detail="Consecutive weeks" />
      </div>
    </article>
  );
}

function TitleMatchControl({
  championships,
  onSetSegmentChampionship,
  segment,
  wrestlers,
}: {
  championships: Championship[];
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  if (segment.type !== "Match" && segment.type !== "Contract Signing" && segment.type !== "Open Challenge") {
    return null;
  }

  const eligibleChampionships = championships.filter((championship) => canSegmentAttachChampionship(segment, championship));
  const selectedChampionship = championships.find((championship) => championship.id === segment.championshipId);
  const isTitleMatch = segment.type === "Match";
  const controlLabel = isTitleMatch ? "Title Match" : "Title Context";
  const clearLabel = isTitleMatch ? "Non-Title" : "No Title Context";
  const emptyMessage =
    segment.type === "Open Challenge"
      ? "Select a champion as issuer to frame the challenge around their title scene."
      : segment.type === "Contract Signing"
        ? "Select a current singles champion to attach championship context."
        : "Singles title option opens when a match includes a current singles champion.";

  return (
    <div className="title-match-control">
      <div>
        <span>{controlLabel}</span>
        <strong>
          {selectedChampionship
            ? isTitleMatch
              ? `${selectedChampionship.name} at stake. Champion: ${getWrestlerNames(selectedChampionship.championIds, wrestlers)}.`
              : `${selectedChampionship.name} in the frame. Champion: ${getWrestlerNames(selectedChampionship.championIds, wrestlers)}.`
            : eligibleChampionships.length
              ? isTitleMatch
                ? "This match can be sanctioned for a singles championship."
                : "Attach championship context without putting the title at stake."
              : emptyMessage}
        </strong>
      </div>
      {eligibleChampionships.length ? (
        <div className="title-buttons">
          <button className={!segment.championshipId ? "active-filter" : ""} onClick={() => onSetSegmentChampionship(segment.id, "")}>
            {clearLabel}
          </button>
          {eligibleChampionships.map((championship) => (
            <button
              className={segment.championshipId === championship.id ? "active-filter" : ""}
              key={championship.id}
              onClick={() => onSetSegmentChampionship(segment.id, championship.id)}
            >
              {championship.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RivalryControl({
  onSetSegmentRivalry,
  rivalries,
  segment,
  wrestlers,
}: {
  onSetSegmentRivalry: (segmentId: string, rivalryId: string) => void;
  rivalries: Rivalry[];
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  const eligibleRivalries = rivalries.filter((rivalry) => canSegmentAttachRivalry(segment, rivalry));
  const selectedRivalry = rivalries.find((rivalry) => rivalry.id === segment.rivalryId);
  const selectedRivalryMatchBlocked = Boolean(
    selectedRivalry && segment.type === "Match" && hasIntergenderMatchParticipants({ ...segment, participantIds: selectedRivalry.participantIds }, wrestlers),
  );

  return (
    <div className="rivalry-control">
      <div>
        <span>Rivalry Context</span>
        <strong>
          {selectedRivalry
            ? selectedRivalryMatchBlocked
              ? `${selectedRivalry.name} attached for context. This rivalry works better as a promo or angle under current match rules.`
              : `${selectedRivalry.name} attached. Heat ${selectedRivalry.heat}, ${formatRivalryStatus(selectedRivalry.status)}.`
            : eligibleRivalries.length
              ? "Attach an active rivalry when this segment advances a story."
              : "Select a rivalry participant to attach story context."}
        </strong>
      </div>
      {eligibleRivalries.length ? (
        <div className="title-buttons">
          <button className={!segment.rivalryId ? "active-filter" : ""} onClick={() => onSetSegmentRivalry(segment.id, "")}>
            No Rivalry
          </button>
          {eligibleRivalries.map((rivalry) => (
            <button
              className={segment.rivalryId === rivalry.id ? "active-filter" : ""}
              key={rivalry.id}
              onClick={() => onSetSegmentRivalry(segment.id, rivalry.id)}
            >
              {rivalry.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GameNav({
  currentScreen,
  hasResults,
  onNavigate,
}: {
  currentScreen: GameScreen;
  hasResults: boolean;
  onNavigate: (screen: GameScreen) => void;
}) {
  return (
    <nav className="game-nav" aria-label="Game navigation">
      <button className={currentScreen === "dashboard" ? "active-filter" : ""} onClick={() => onNavigate("dashboard")}>
        Dashboard
      </button>
      <button className={currentScreen === "booking" ? "active-filter" : ""} onClick={() => onNavigate("booking")}>
        Booking
      </button>
      <button className={currentScreen === "roster" ? "active-filter" : ""} onClick={() => onNavigate("roster")}>
        Roster
      </button>
      <button className={currentScreen === "championships" ? "active-filter" : ""} onClick={() => onNavigate("championships")}>
        Championships
      </button>
      <button className={currentScreen === "rivalries" ? "active-filter" : ""} onClick={() => onNavigate("rivalries")}>
        Rivalries
      </button>
      <button className={currentScreen === "calendar" ? "active-filter" : ""} onClick={() => onNavigate("calendar")}>
        Calendar
      </button>
      <button className={currentScreen === "social" ? "active-filter" : ""} onClick={() => onNavigate("social")}>
        Social
      </button>
      <button className={currentScreen === "finance" ? "active-filter" : ""} onClick={() => onNavigate("finance")}>
        Finance
      </button>
      {hasResults ? (
        <button className={currentScreen === "results" ? "active-filter" : ""} onClick={() => onNavigate("results")}>
          Results
        </button>
      ) : null}
      {hasResults ? (
        <button className={currentScreen === "weekReview" ? "active-filter" : ""} onClick={() => onNavigate("weekReview")}>
          Week Review
        </button>
      ) : null}
    </nav>
  );
}

function SegmentContext({
  bookedCounts,
  segment,
  wrestlers,
}: {
  bookedCounts: Record<string, number>;
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  const participants = getSegmentParticipants(segment, wrestlers);
  const warnings = participants.flatMap((wrestler) => {
    const wrestlerWarnings: string[] = [];

    if (wrestler.fatigue >= 60) {
      wrestlerWarnings.push(`${wrestler.name} is carrying heavy fatigue.`);
    }

    if (wrestler.injuryStatus === "minor") {
      wrestlerWarnings.push(`${wrestler.name} is working through a minor injury.`);
    }

    if (wrestler.injuryStatus === "major") {
      wrestlerWarnings.push(`${wrestler.name} is unavailable with a major injury.`);
    }

    if (wrestler.morale <= 45) {
      wrestlerWarnings.push(`${wrestler.name} has low morale.`);
    }

    if ((bookedCounts[wrestler.id] ?? 0) > 1) {
      wrestlerWarnings.push(`${wrestler.name} is already booked elsewhere on this card.`);
    }

    return wrestlerWarnings;
  });

  if (!isValidSegment(segment, wrestlers)) {
    warnings.unshift(getSegmentValidationWarning(segment, wrestlers));
  }

  if (segment.type === "Open Challenge" && isValidSegment(segment, wrestlers)) {
    warnings.push("Opponent stays unrevealed until the show runs.");
  }

  return (
    <div className="segment-context">
      <div>
        <span>Selected</span>
        <strong>{participants.map((wrestler) => wrestler.name).join(" / ") || "No participants selected"}</strong>
      </div>
      <div>
        <span>Production Note</span>
        <strong>{warnings.length ? warnings[0] : "Ready for the rundown."}</strong>
      </div>
      {warnings.length > 1 ? (
        <ul>
          {warnings.slice(1).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Header({ game }: { game: GameState }) {
  return (
    <header className="top-bar">
      <strong>Next GM</strong>
      <span>
        {game.brandName} · GM {game.gmName}
      </span>
      <span>
        Season {game.seasonNumber} · Week {game.currentWeek}
      </span>
    </header>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export default App;
