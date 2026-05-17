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
import { getRosterAffiliations, getWrestlerAffiliations } from "./game/affiliationCatalog";
import { getFinancePressureLabel } from "./game/finance";
import { financeModelSummaryByRole, getRosterFinanceValueForWrestler } from "./game/financeCatalog";
import {
  bookingSegmentTypes,
  getCatalogOptionById,
  getCatalogOptionsForType,
  getDefaultCatalogOption,
  getSegmentCatalogOption,
  getSegmentParticipantRange,
  type SegmentCatalogOption,
} from "./game/matchFormatCatalog";
import {
  getStipulationsForSegment,
  getStipulationById,
  type StipulationCatalogOption,
} from "./game/stipulationCatalog";
import { migrateSavedGameState } from "./game/migration";
import { getWrestlerIdentityContext } from "./game/wrestlerIdentityContext";
import {
  applyRivalryCatalogDefaults,
  deriveRivalryStage,
  getDefaultStorylineIdForStakes,
  getRivalryGMRead,
  getRivalryRelationship,
  getRivalryStoryline,
  safeRivalryStorylineOptions,
} from "./game/rivalryCatalog";
import { createNewGame, createRivalBrandUniverse, createRivalGMAssignments, defaultCareer, draftPool, getStartingBudgetAmount } from "./game/seed";
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
import { getChampionshipDivisionGroup, getTitleCatalogBrand, wrestlerFitsChampionshipDivision } from "./game/titleCatalog";
import type {
  CalendarWeek,
  AffiliationKind,
  BrandStyle,
  Championship,
  ChampionshipHistoryEvent,
  FinanceReport,
  GameDifficulty,
  GameState,
  GMStyle,
  InjuryStatus,
  PressureLabel,
  RivalBrandState,
  Rivalry,
  RivalryHistoryEvent,
  RivalryStakes,
  RivalGMAssignment,
  Screen,
  Segment,
  SegmentResult,
  SegmentType,
  ShowResult,
  SocialCategory,
  SocialPost,
  ShowType,
  StartingBudgetTier,
  Wrestler,
  WrestlerAffiliation,
} from "./game/types";
import type { GameScreen, ProfileReturnScreen, SavedGameState } from "./game/migration";
import type { StoredSaveRecord } from "./gameStorage";

type RosterSort = "popularity" | "momentum" | "fatigue" | "morale";
type RosterFilter = "All" | "Hot" | "Tired" | "Frustrated";
type RosterPressureTag = "Overused" | "Underused" | "Protected Star" | "Morale Risk" | "Injury Risk" | "Minor Injury" | "Unavailable";
type SocialFilter = "All" | "Fan Reaction" | "Dirt Sheets" | "Analyst Takes" | "Title Scene" | "Rivalries";
type SetupStep = "contract" | "gm" | "brand" | "rules" | "preview" | "draft" | "review";
type DraftSort = "rank" | "starPower" | "popularity" | "momentum" | "ringSkill" | "promoSkill" | "fatigue";
type DraftReservePressure = "Healthy" | "Tight" | "Over Budget";

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

type DraftFinanceReadout = {
  isUnlimitedBudget: boolean;
  missingFinanceRows: Wrestler[];
  pressureLabel: DraftReservePressure;
  projectedReserve: number;
  rosterValue: number;
  startingBudgetAmount: number;
};

type WrestlerValueProfile = {
  contextMode: "active" | "missing";
  valueTierLabel: string;
  draftValueLabel: string;
  weeklyValueLabel: string;
  dossierRead: string;
  costRead: string;
};

type TalentValuePressure = {
  bargainCount: number;
  gmRead: string;
  mappedCount: number;
  missingCount: number;
  premiumCount: number;
  totalCount: number;
};

type FreeAgentWatchEntry = {
  profile: WrestlerValueProfile;
  wrestler: Wrestler;
};

type GMRead = {
  usefulness: string;
  risk: string;
  need: string;
};

const valueProfileFallbackSummary = financeModelSummaryByRole.reduce(
  (acc, summary) => {
    return {
      minDraftValue: Math.min(acc.minDraftValue, summary.minDraftValueUsd),
      maxDraftValue: Math.max(acc.maxDraftValue, summary.maxDraftValueUsd),
      medianWeeklyHireRate: Math.max(acc.medianWeeklyHireRate, summary.medianWeeklyHireRateUsd),
    };
  },
  { minDraftValue: Number.POSITIVE_INFINITY, maxDraftValue: Number.NEGATIVE_INFINITY, medianWeeklyHireRate: 0 },
);

const hasValueSummary = valueProfileFallbackSummary.minDraftValue < Number.POSITIVE_INFINITY;

type SmartRundownResult = {
  error?: string;
  notes: string[];
  segments: Segment[];
};

type PleReadinessTone = "ready" | "watch" | "build";

type PleReadinessItem = {
  id: string;
  label: string;
  status: string;
  detail: string;
  tone: PleReadinessTone;
};

type PleReadinessSnapshot = {
  items: PleReadinessItem[];
  readyCount: number;
  titleMatchCount: number;
  representedRivalries: Rivalry[];
  unresolvedRivalries: Rivalry[];
  bookedMajorStars: Wrestler[];
  mainEvent?: Segment;
};

type TitleScenePressureTone = "hot" | "steady" | "watch" | "build";

type TitleScenePressureDiagnostic = {
  id: string;
  label: string;
  detail: string;
  tone: TitleScenePressureTone;
};

type TitleScenePressureSnapshot = {
  primary: TitleScenePressureDiagnostic;
  diagnostics: TitleScenePressureDiagnostic[];
  divisionHealth: string;
  producerRead: string;
  defenseWindow: number;
  reignLength: number;
  weeksSinceLastTitleEvent: number;
  titleRivalries: Rivalry[];
};

type RivalryTimingTone = "hot" | "steady" | "watch" | "build";

type RivalryTimingDiagnostic = {
  id: string;
  label: string;
  detail: string;
  tone: RivalryTimingTone;
};

type RivalryTimingSnapshot = {
  primary: RivalryTimingDiagnostic;
  diagnostics: RivalryTimingDiagnostic[];
  timingRead: string;
  producerRead: string;
  weeksSinceAdvanced: number;
  weeksUntilPle: number;
  currentCardBeats: number;
  currentCardParticipants: number;
  recentlyPaidOff: boolean;
};

type BrandPulseTone = "strong" | "steady" | "watch";

type BrandPulseRivalNote = {
  id: string;
  brandName: string;
  label: string;
  detail: string;
};

type BrandPulseSnapshot = {
  headline: string;
  detail: string;
  tone: BrandPulseTone;
  showRead: string;
  financeRead: string;
  socialRead: string;
  titleRead: string;
  rivalryRead: string;
  rivalNotes: BrandPulseRivalNote[];
};

type RivalDraftActivityTone = "quiet" | "watch" | "aggressive" | "burst";

type RivalDraftActivityNote = {
  id: string;
  brandName: string;
  gmName: string;
  label: string;
  detail: string;
  tone: RivalDraftActivityTone;
};

type RivalDraftActivitySnapshot = {
  headline: string;
  detail: string;
  tone: RivalDraftActivityTone;
  notes: RivalDraftActivityNote[];
};

type CauseLedgerTone = "strong" | "steady" | "watch";

type CauseLedgerItem = {
  id: string;
  label: string;
  detail: string;
  tone: CauseLedgerTone;
};

type CauseLedgerSection = {
  id: string;
  label: string;
  items: CauseLedgerItem[];
};

type QaHarnessMode = "runtime" | "legacy-runtime";

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
const showRuntimeTargetMinutes = 120;
const showRuntimeMinMinutes = 90;
const showRuntimeOvertimeMinutes = 135;
const tvRuntimeWarningMinutes = 150;
const maxBookingSegments = 24;
const qaHarnessParam = "qa";

function formatMoney(amount: number) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString()}`;
}

function formatBudgetTier(tier: StartingBudgetTier) {
  return tier === "Unlimited" ? "Unlimited" : tier;
}

function formatStartingBudgetReadout(tier: StartingBudgetTier, amount: number) {
  return tier === "Unlimited" ? "Unlimited" : formatMoney(amount);
}

function formatStartingBudgetDetail(tier: StartingBudgetTier, amount: number, description: string) {
  return tier === "Unlimited" ? `${description} Sandbox reference: ${formatMoney(amount)}.` : `${formatBudgetTier(tier)} opening money. ${description}`;
}

function getDraftFinanceReadout(wrestlers: Wrestler[], startingBudgetTier: StartingBudgetTier, startingBudgetAmount: number): DraftFinanceReadout {
  const financeRows = wrestlers.map((wrestler) => ({
    financeRow: getRosterFinanceValueForWrestler(wrestler),
    wrestler,
  }));
  const rosterValue = financeRows.reduce((sum, { financeRow }) => sum + (financeRow?.draftValueUsd ?? 0), 0);
  const projectedReserve = startingBudgetAmount - rosterValue;
  const isUnlimitedBudget = startingBudgetTier === "Unlimited";
  const tightReserveThreshold = Math.max(250000, Math.round(startingBudgetAmount * 0.15));
  const pressureLabel: DraftReservePressure = isUnlimitedBudget
    ? "Healthy"
    : projectedReserve < 0
      ? "Over Budget"
      : projectedReserve <= tightReserveThreshold
        ? "Tight"
        : "Healthy";

  return {
    isUnlimitedBudget,
    missingFinanceRows: financeRows.filter(({ financeRow }) => !financeRow).map(({ wrestler }) => wrestler),
    pressureLabel,
    projectedReserve,
    rosterValue,
    startingBudgetAmount,
  };
}

function formatProjectedReserve(readout: DraftFinanceReadout) {
  return readout.isUnlimitedBudget ? "Unlimited" : formatMoney(readout.projectedReserve);
}

function getDraftFinanceNote(readout: DraftFinanceReadout) {
  const missingValueNote = readout.missingFinanceRows.length
    ? ` ${readout.missingFinanceRows.length} roster value${readout.missingFinanceRows.length === 1 ? "" : "s"} pending and excluded from this total.`
    : "";

  return `Projected reserve only; draft picks do not spend money or restrict availability in this build.${missingValueNote}`;
}

function getRivalUniverseRead(rivalBrands: RivalBrandState[]) {
  if (!rivalBrands.length) {
    return "No rival brand chairs are assigned in this career setup.";
  }

  const rosterCount = rivalBrands.reduce((sum, brand) => sum + brand.rosterWrestlerIds.length, 0);
  const activityCount = rivalBrands.reduce((sum, brand) => sum + brand.activityHistory.length, 0);

  return `${rivalBrands.length} rival brand${rivalBrands.length === 1 ? "" : "s"} assigned. ${rosterCount} rival roster claim${rosterCount === 1 ? "" : "s"} and ${activityCount} activity beat${activityCount === 1 ? "" : "s"} recorded.`;
}

function getRivalDraftActivitySnapshot(
  rivalBrands: RivalBrandState[],
  draftedCount: number,
  maxDraftCount = draftPickCount,
): RivalDraftActivitySnapshot | undefined {
  if (!rivalBrands.length) {
    return undefined;
  }

  const safeDraftedCount = Math.max(0, Math.min(maxDraftCount, draftedCount));
  const rankedBrands = [...rivalBrands].sort((a, b) => {
    const aSignal = a.activityHistory.length + a.rosterWrestlerIds.length * 0.6;
    const bSignal = b.activityHistory.length + b.rosterWrestlerIds.length * 0.6;

    return bSignal - aSignal || a.brandName.localeCompare(b.brandName);
  });

  const tone: RivalDraftActivityTone =
    safeDraftedCount >= maxDraftCount
      ? "burst"
      : safeDraftedCount >= Math.floor(maxDraftCount * 0.8)
        ? "aggressive"
        : safeDraftedCount >= Math.floor(maxDraftCount * 0.4)
          ? "watch"
          : "quiet";

  const headline =
    safeDraftedCount === 0
      ? "The Other Desks Are Quietly Watching"
      : safeDraftedCount < 4
        ? "Rival Desks Hold"
        : safeDraftedCount < maxDraftCount - 2
          ? "Rival Desks Are Tracking the Draft"
          : "Rival Draft Activity Is Peaking";

  const detail =
    safeDraftedCount === 0
      ? "Draft Night has opened, but rival desks are still framing this board as watch-only noise."
      : `You are at pick ${safeDraftedCount}/${maxDraftCount}; rival desks stay active as flavor-only readouts around your live build.`;

  const notes: RivalDraftActivityNote[] = rankedBrands.slice(0, 3).map((brand) => {
    const activityCount = brand.activityHistory.length;
    const brandRosterClaims = brand.rosterWrestlerIds.length;
    const latestActivity = brand.activityHistory.at(-1);

    const noteTone: RivalDraftActivityTone =
      activityCount >= 3
        ? "aggressive"
        : safeDraftedCount >= maxDraftCount - 1 && brandRosterClaims >= 2
          ? "aggressive"
          : safeDraftedCount >= Math.floor(maxDraftCount / 2)
            ? "watch"
            : "quiet";

    const label =
      safeDraftedCount < 3
        ? "Quiet War Room"
        : activityCount >= 2
          ? "Scouting Aggressively"
          : safeDraftedCount >= maxDraftCount - 1
            ? "Building Around Star Power"
            : "Watching The Board";

    const activityNote = latestActivity
      ? `Recent desk read: ${latestActivity.label.toLowerCase()} · ${latestActivity.note}`
      : `No logged movement yet; desk is monitoring ${brandRosterClaims ? "roster claims" : "board position"}.`;

    return {
      id: `${brand.id}-${safeDraftedCount}`,
      brandName: brand.brandName,
      gmName: brand.assignedGMName,
      label,
      detail: `${brand.assignedGMName} (${brand.assignedGMStyle}) is ${safeDraftedCount < 5 ? "monitoring" : "pushing context"}: ${activityNote}`,
      tone: noteTone,
    };
  });

  return {
    headline,
    detail,
    tone,
    notes,
  };
}

function getBrandPulseRivalLabel(score: number, socialCount: number, profitLoss: number | undefined, index: number) {
  if (score >= 88 && socialCount >= 2) {
    return "Watching Your Momentum";
  }

  if (score >= 78 || socialCount >= 3) {
    return "Media Buzz";
  }

  if (score < 60 || (profitLoss !== undefined && profitLoss < 0 && index === 0)) {
    return "Pressure Rising";
  }

  return "Quiet Week";
}

function getBrandPulseSnapshot(game: GameState, result?: ShowResult): BrandPulseSnapshot | undefined {
  if (!result) {
    return undefined;
  }

  const financeReport = getFinanceReportForResult(game, result);
  const socialPosts = game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week);
  const recentShows = game.showHistory.filter((show) => show.seasonNumber === result.seasonNumber).slice(-3);
  const recentAverage = recentShows.length
    ? Math.round(recentShows.reduce((sum, show) => sum + show.totalScore, 0) / recentShows.length)
    : result.totalScore;
  const scoreDelta = result.totalScore - recentAverage;
  const scoreDeltaLabel = scoreDelta >= 4 ? "above recent pace" : scoreDelta <= -4 ? "below recent pace" : "near recent pace";
  const rivalBrands = game.rivalBrands?.length ? game.rivalBrands : createRivalBrandUniverse(game.rivalGMAssignments);
  const titlePressure = getChampionshipPressureSnapshots(game)[0];
  const rivalryTiming = getRivalryTimingSnapshots(game)[0];
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const profitLoss = financeReport?.profitLoss;
  const tone: BrandPulseTone =
    result.totalScore >= 82 && (profitLoss === undefined || profitLoss >= 0)
      ? "strong"
      : result.totalScore < 62 || (profitLoss !== undefined && profitLoss < 0)
        ? "watch"
        : "steady";
  const headline =
    tone === "strong"
      ? "Your Brand Owns The Room"
      : tone === "watch"
        ? "Office Pressure Is Showing"
        : "The Brand Holds Position";
  const pleDetail = nextPle
    ? weeksUntilPle === 0
      ? `${nextPle.showName} is this week.`
      : `${formatWeekCount(weeksUntilPle)} until ${nextPle.showName}.`
    : "No remaining PLE window on the calendar.";

  return {
    headline,
    detail: `${result.showName} landed at ${result.totalScore} (${getShowGrade(result.totalScore)}), ${scoreDeltaLabel}. ${pleDetail}`,
    tone,
    showRead: `Last Show · ${result.totalScore} (${getShowGrade(result.totalScore)})`,
    financeRead: financeReport ? `Brand Office · ${formatMoney(financeReport.profitLoss)}` : "Brand Office · No finance report",
    socialRead: socialPosts.length ? `IWC Pulse · ${socialPosts.length} post${socialPosts.length === 1 ? "" : "s"}` : "IWC Pulse · Quiet room",
    titleRead: titlePressure ? `${titlePressure.championship.name} · ${titlePressure.snapshot.primary.label}` : "Titles · No scene read",
    rivalryRead: rivalryTiming ? `${rivalryTiming.rivalry.name} · ${rivalryTiming.snapshot.primary.label}` : "Rivalries · No active read",
    rivalNotes: rivalBrands.slice(0, 3).map((rivalBrand, index) => {
      const label = getBrandPulseRivalLabel(result.totalScore, socialPosts.length, profitLoss, index);

      return {
        id: rivalBrand.id,
        brandName: rivalBrand.brandName,
        label,
        detail: `${rivalBrand.assignedGMName}'s desk logs this as flavor only; no rival show was simulated.`,
      };
    }),
  };
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

function formatAffiliationKind(kind: AffiliationKind) {
  if (kind === "tag_team") {
    return "Tag Team";
  }

  if (kind === "faction") {
    return "Faction";
  }

  return "Affiliation";
}

function getAffiliationMemberNames(affiliation: WrestlerAffiliation, wrestlers: Wrestler[]) {
  return affiliation.memberWrestlerIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name)
    .filter(Boolean)
    .join(" / ");
}

function getSegmentDurationMinutes(segment: Segment) {
  return segment.durationMinutes ?? getSegmentCatalogOption(segment)?.defaultDurationMinutes ?? 8;
}

function getStipulationsForSegmentId(segment: Segment): StipulationCatalogOption[] {
  return getStipulationsForSegment(segment);
}

function getSegmentStipulationLabel(segment: Pick<Segment, "stipulationId" | "type" | "segmentCatalogId">) {
  const stipulation = getStipulationById(segment.stipulationId);

  return stipulation ? stipulation.label : "No stipulation";
}

function getResolvedSegmentStipulationLabel(segment: Pick<SegmentResult, "stipulationId" | "type" | "segmentCatalogId">) {
  const stipulation = getStipulationById(segment.stipulationId);

  return stipulation ? stipulation.label : undefined;
}

function sanitizeSegmentStipulation(segment: Segment) {
  const allowedStipulations = getStipulationsForSegmentId(segment);
  if (!segment.stipulationId) {
    return segment;
  }

  if (!allowedStipulations.some((option) => option.id === segment.stipulationId)) {
    return { ...segment, stipulationId: undefined };
  }

  return segment;
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

function getSegmentPickerLabel(type: SegmentType) {
  return type === "Open Challenge" ? "Issuer" : "Participants";
}

function getSegmentValidationWarning(segment: Segment, wrestlers: Wrestler[] = []) {
  if (isValidSegment(segment, wrestlers)) {
    return "";
  }

  const uniqueParticipantCount = new Set(segment.participantIds).size;
  if (segment.participantIds.length !== uniqueParticipantCount) {
    return "Each wrestler can only appear once in a segment.";
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

function isMajorEventStar(wrestler: Wrestler) {
  return wrestler.popularity >= 90 || wrestler.momentum >= 90 || wrestler.roleTier?.toLowerCase() === "mainevent";
}

function getPleReadinessSnapshot(game: GameState, validShowSegments: Segment[], calendarWeek: CalendarWeek): PleReadinessSnapshot | undefined {
  if (calendarWeek.showType !== "ple") {
    return undefined;
  }

  const titleMatchSegments = validShowSegments.filter((segment) => {
    const championship = segment.championshipId ? game.championships.find((title) => title.id === segment.championshipId) : undefined;
    return Boolean(championship && canSegmentContestChampionship(segment, championship, game.wrestlers));
  });
  const representedRivalryIds = new Set(validShowSegments.map((segment) => segment.rivalryId).filter((id): id is string => Boolean(id)));
  const activeRivalries = game.rivalries.filter((rivalry) => rivalry.status !== "stale");
  const representedRivalries = activeRivalries.filter((rivalry) => representedRivalryIds.has(rivalry.id));
  const unresolvedRivalries = activeRivalries.filter((rivalry) => !representedRivalryIds.has(rivalry.id));
  const bookedWrestlerIds = new Set(validShowSegments.flatMap((segment) => segment.participantIds));
  const bookedMajorStars = game.wrestlers.filter((wrestler) => bookedWrestlerIds.has(wrestler.id) && isMajorEventStar(wrestler));
  const majorMatchCount = validShowSegments.filter((segment) => {
    const participants = getSegmentParticipants(segment, game.wrestlers);
    return segment.type === "Match" && participants.length >= 2 && (segment.championshipId || segment.rivalryId || participants.some(isMajorEventStar));
  }).length;
  const mainEvent = validShowSegments[validShowSegments.length - 1];
  const mainEventParticipants = mainEvent ? getSegmentParticipants(mainEvent, game.wrestlers) : [];
  const mainEventHasAnchor = Boolean(
    mainEvent &&
      isValidSegment(mainEvent, game.wrestlers) &&
      (mainEvent.championshipId || mainEvent.rivalryId || mainEventParticipants.some(isMajorEventStar)),
  );
  const items: PleReadinessItem[] = [
    {
      id: "event-block",
      label: "Event Block",
      status: validShowSegments.length >= 5 ? "Card feels filled" : validShowSegments.length >= 3 ? "Core card forming" : "Needs more structure",
      detail: `${validShowSegments.length} valid segment${validShowSegments.length === 1 ? "" : "s"} ready for ${calendarWeek.showName}.`,
      tone: validShowSegments.length >= 5 ? "ready" : validShowSegments.length >= 3 ? "watch" : "build",
    },
    {
      id: "title-stakes",
      label: "Title Stakes",
      status: titleMatchSegments.length >= 2 ? "Multiple defenses" : titleMatchSegments.length === 1 ? "One sanctioned defense" : "No title match yet",
      detail: `${titleMatchSegments.length} current match${titleMatchSegments.length === 1 ? "" : "es"} with title stakes attached.`,
      tone: titleMatchSegments.length >= 2 ? "ready" : titleMatchSegments.length === 1 ? "watch" : "build",
    },
    {
      id: "rivalry-payoff",
      label: "Rivalry Payoff",
      status: representedRivalries.length >= 2 ? "Stories represented" : representedRivalries.length === 1 ? "One story beat" : "No active rivalry beat",
      detail: unresolvedRivalries.length
        ? `${representedRivalries.length} active rivalr${representedRivalries.length === 1 ? "y" : "ies"} on card. Still off card: ${unresolvedRivalries
            .slice(0, 2)
            .map((rivalry) => rivalry.name)
            .join(" / ")}${unresolvedRivalries.length > 2 ? " / more" : ""}.`
        : `${representedRivalries.length} active rivalr${representedRivalries.length === 1 ? "y" : "ies"} represented on the card.`,
      tone: representedRivalries.length >= 2 ? "ready" : representedRivalries.length === 1 ? "watch" : "build",
    },
    {
      id: "main-event-anchor",
      label: "Main Event Anchor",
      status: mainEventHasAnchor ? "Closing slot has stakes" : mainEvent ? "Closing slot is light" : "No closing slot yet",
      detail: mainEvent
        ? `${mainEvent.segmentDisplayName ?? mainEvent.type} closes the rundown${mainEventParticipants.length ? ` with ${getSegmentParticipantsLabel(mainEvent, game.wrestlers)}` : ""}.`
        : "Add a valid final segment before the PLE goes live.",
      tone: mainEventHasAnchor ? "ready" : mainEvent ? "watch" : "build",
    },
    {
      id: "star-power",
      label: "Star Power",
      status: bookedMajorStars.length >= 4 ? "Top acts visible" : bookedMajorStars.length >= 2 ? "Some star power" : "Star power light",
      detail: bookedMajorStars.length
        ? `${bookedMajorStars.length} high-popularity or high-momentum wrestler${bookedMajorStars.length === 1 ? "" : "s"} booked: ${bookedMajorStars
            .slice(0, 3)
            .map((wrestler) => wrestler.name)
            .join(" / ")}${bookedMajorStars.length > 3 ? " / more" : ""}.`
        : "No high-popularity or high-momentum wrestlers are booked yet.",
      tone: bookedMajorStars.length >= 4 ? "ready" : bookedMajorStars.length >= 2 ? "watch" : "build",
    },
    {
      id: "major-match-gravity",
      label: "Major Match Gravity",
      status: majorMatchCount >= 2 ? "Match spine is strong" : majorMatchCount === 1 ? "One feature match" : "Needs a feature match",
      detail: `${majorMatchCount} valid match${majorMatchCount === 1 ? "" : "es"} currently carry title, rivalry, or top-star context.`,
      tone: majorMatchCount >= 2 ? "ready" : majorMatchCount === 1 ? "watch" : "build",
    },
  ];

  return {
    items,
    readyCount: items.filter((item) => item.tone === "ready").length,
    titleMatchCount: titleMatchSegments.length,
    representedRivalries,
    unresolvedRivalries,
    bookedMajorStars,
    mainEvent,
  };
}

function getSegmentParticipants(segment: Segment, wrestlers: Wrestler[]) {
  return segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function getSegmentParticipantsLabel(segment: Segment, wrestlers: Wrestler[]) {
  const participants = getSegmentParticipants(segment, wrestlers);

  if (!participants.length) {
    return "No participants selected";
  }

  if (segment.segmentCatalogId === "M020" && segment.participantIds.length === 4) {
    const teamA = participants
      .slice(0, 2)
      .map((wrestler) => wrestler.name)
      .join(" / ");
    const teamB = participants
      .slice(2)
      .map((wrestler) => wrestler.name)
      .join(" / ");
    return `Team A (${teamA || "TBD"}) vs Team B (${teamB || "TBD"})`;
  }

  return participants.map((wrestler) => wrestler.name).join(" / ");
}

function getSegmentResultParticipantsLabel(segment: SegmentResult, wrestlers: Wrestler[]) {
  if (!segment.participantIds.length) {
    return "No participants";
  }

  if (segment.segmentCatalogId === "M020" && segment.participantIds.length === 4) {
    const teamA = segment.participantIds
      .slice(0, 2)
      .map((id: string) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown")
      .join(" / ");
    const teamB = segment.participantIds
      .slice(2)
      .map((id: string) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown")
      .join(" / ");
    const winnerLabel = getTagMatchResultWinnerLabel(segment, wrestlers);
    return `${winnerLabel ? `${winnerLabel} · ` : ""}Team A (${teamA || "TBD"}) vs Team B (${teamB || "TBD"})`;
  }

  return segment.participantNames.join(" / ");
}

function getTagMatchResultWinnerLabel(segment: SegmentResult, wrestlers: Wrestler[]) {
  if (segment.type !== "Match" || segment.segmentCatalogId !== "M020" || !segment.winnerId) {
    return undefined;
  }

  const winner = wrestlers.find((wrestler) => wrestler.id === segment.winnerId);

  if (!winner) {
    return undefined;
  }

  const teamAIds = segment.participantIds.slice(0, 2);
  const winningSide = teamAIds.includes(segment.winnerId) ? "Team A" : "Team B";
  return `${winningSide} winner: ${winner.name}`;
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
  const identity = getWrestlerIdentityContext(wrestler);

  return [
    wrestler.name,
    wrestler.sourceBrand,
    wrestler.sourceAvailability,
    wrestler.roleTier,
    identity.role,
    wrestler.alignment,
    identity.wrestlingStyle,
    identity.promoStyle,
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
  return championship.eligibleMatchScope !== "tag_team" && championship.division !== "Tag Team" && championship.championIds.length === 1;
}

function isTagChampionship(championship: Championship) {
  return championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team";
}

function doSegmentParticipantsFitChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[]) {
  const titleDivision = getChampionshipDivisionGroup(championship);

  if (!titleDivision) {
    return true;
  }

  return segment.participantIds.every((id) => wrestlerFitsChampionshipDivision(wrestlers.find((wrestler) => wrestler.id === id), championship));
}

function getTagTitleSides(segment: Segment, championship: Championship) {
  if (segment.type !== "Match" || segment.segmentCatalogId !== "M020" || segment.participantIds.length !== 4 || championship.championIds.length !== 2) {
    return undefined;
  }

  const teamAIds = segment.participantIds.slice(0, 2);
  const teamBIds = segment.participantIds.slice(2, 4);
  const championIds = new Set(championship.championIds);
  const teamAHasChampions = teamAIds.every((id) => championIds.has(id));
  const teamBHasChampions = teamBIds.every((id) => championIds.has(id));

  if (teamAHasChampions === teamBHasChampions) {
    return undefined;
  }

  return {
    championSideIds: teamAHasChampions ? teamAIds : teamBIds,
    challengerSideIds: teamAHasChampions ? teamBIds : teamAIds,
  };
}

function canSegmentContestChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[] = []) {
  if (isTagChampionship(championship)) {
    return Boolean(isValidSegment(segment, wrestlers) && getTagTitleSides(segment, championship));
  }

  return (
    segment.type === "Match" &&
    isValidSegment(segment, wrestlers) &&
    segment.participantIds.length === 2 &&
    isSinglesChampionship(championship) &&
    segment.participantIds.includes(championship.championIds[0]) &&
    doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
  );
}

function canSegmentAttachChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[] = []) {
  if (canSegmentContestChampionship(segment, championship, wrestlers)) {
    return true;
  }

  if (segment.type === "Contract Signing") {
    return (
      isValidSegment(segment, wrestlers) &&
      isSinglesChampionship(championship) &&
      segment.participantIds.includes(championship.championIds[0]) &&
      doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
    );
  }

  if (segment.type === "Open Challenge") {
    return (
      isValidSegment(segment, wrestlers) &&
      isSinglesChampionship(championship) &&
      championship.championIds.includes(segment.participantIds[0]) &&
      doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
    );
  }

  return false;
}

function getTopContenders(championship: Championship, wrestlers: Wrestler[], limit = 3) {
  return getTitleDivisionScene(championship, wrestlers).topContenders.slice(0, limit);
}

function getTitleSceneTalentScore(wrestler: Wrestler, championship: Championship, rivalries: Rivalry[] = []) {
  const championIds = new Set(championship.championIds);
  const titleRivalryBonus = rivalries.some(
    (rivalry) => rivalry.stakes === "title" && rivalry.participantIds.includes(wrestler.id) && rivalry.participantIds.some((id) => championIds.has(id)),
  )
    ? 18
    : 0;

  return wrestler.popularity + wrestler.momentum + titleRivalryBonus;
}

function getTitleDivisionScene(championship: Championship, wrestlers: Wrestler[], rivalries: Rivalry[] = [], currentWeek = 1) {
  const championIds = new Set(championship.championIds);
  const champions = championship.championIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
  const eligibleRoster = wrestlers
    .filter((wrestler) => !championIds.has(wrestler.id))
    .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship))
    .sort((a, b) => getTitleSceneTalentScore(b, championship, rivalries) - getTitleSceneTalentScore(a, championship, rivalries));
  const topContenders = eligibleRoster.slice(0, 3);
  const topContenderIds = new Set(topContenders.map((wrestler) => wrestler.id));
  const risingContenders = eligibleRoster
    .filter((wrestler) => !topContenderIds.has(wrestler.id))
    .filter((wrestler) => wrestler.momentum >= 80 || getWeeksSinceLastBooked(wrestler, currentWeek) >= 2)
    .sort((a, b) => b.momentum - a.momentum || b.popularity - a.popularity)
    .slice(0, 3);
  const outsideDivision = wrestlers.filter((wrestler) => !championIds.has(wrestler.id) && !wrestlerFitsChampionshipDivision(wrestler, championship));

  return {
    champions,
    topContenders,
    risingContenders,
    eligibleRoster,
    outsideDivision,
  };
}

function getTagDivisionHealthDiagnostics(championship: Championship, game: GameState): TitleScenePressureDiagnostic[] {
  if (!isTagChampionship(championship)) {
    return [];
  }

  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek);
  const diagnostics: TitleScenePressureDiagnostic[] = [];
  const challengers = scene.eligibleRoster;
  const champions = scene.champions;
  const championPairActive =
    champions.length === 2 &&
    champions.every(
      (wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) <= 2 && !getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
    );
  const restedChallengers = challengers.filter((wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2);
  const challengerInjuryRisk = challengers.some(
    (wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );

  const hasFreshMatchup = restedChallengers.length >= 2;
  const hasHotPair = (() => {
    for (let index = 0; index < challengers.length; index += 1) {
      const first = challengers[index];
      for (let next = index + 1; next < challengers.length; next += 1) {
        const second = challengers[next];
        if (
          (first.momentum >= 75 && second.momentum >= 75) ||
          (first.popularity >= 78 && second.popularity >= 78)
        ) {
          return true;
        }
      }
    }

    return false;
  })();

  const championInjuryRisk = champions.some(
    (wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );
  const recentHistory = getChampionshipHistory(game, championship.id, 1);
  const latestTitleEvent = recentHistory[0];
  const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
  const reignLength = getReignLength(championship, game.currentWeek);
  const weeksSinceLastTitleEvent = latestTitleEvent
    ? getChampionshipHistoryAgeWeeks(game, latestTitleEvent)
    : Math.max(0, reignLength - 1);

  diagnostics.push({
    id: "tag-champion-pair-active",
    label: "Champion Pair Active",
    detail: championPairActive
      ? `The champions, ${getWrestlerNames(championship.championIds, game.wrestlers)}, are active enough to make a credible defense.`
      : "One or both champions are currently quiet, so momentum checks are advisory only.",
    tone: championPairActive ? "steady" : "watch",
  });

  if (challengers.length < 2) {
    diagnostics.push({
      id: "tag-needs-challengers",
      label: "Needs Challengers",
      detail: "Two eligible non-champion wrestlers are required to safely build another tag title defense lane.",
      tone: "build",
    });
  } else if (challengers.length < 4) {
    diagnostics.push({
      id: "tag-underrepresented",
      label: "Tag Title Underrepresented",
      detail: "The challenger pool is thin for repeated title-defenses while keeping rotation variety.",
      tone: "watch",
    });
  }

  if (hasFreshMatchup) {
    diagnostics.push({
      id: "tag-fresh-matchup",
      label: "Fresh Matchup Available",
      detail: "There are rested challengers available for a fresh 2v2 defense booking.",
      tone: "hot",
    });
  }

  if (hasHotPair) {
    diagnostics.push({
      id: "tag-hot-pair",
      label: "Hot Pair Available",
      detail: "At least one eligible pair is showing strong momentum/popularity for immediate tag title challenge framing.",
      tone: "hot",
    });
  }

  if (championInjuryRisk || challengerInjuryRisk) {
    diagnostics.push({
      id: "tag-injury-risk",
      label: "Injury Risk Around Champions",
      detail: "Injury flags around champions/challengers should be checked before deciding the defense lane.",
      tone: "watch",
    });
  }

  if (latestTitleEvent?.eventType === "successful_defense" && weeksSinceLastTitleEvent <= 1) {
    diagnostics.push({
      id: "tag-recent-defense",
      label: "Recently Defended",
      detail: "The title was actively defended in the latest resolvable title event.",
      tone: "steady",
    });
  }

  if (reignLength >= defenseWindow && championship.defenses === 0) {
    diagnostics.push({
      id: "tag-stale-reign",
      label: "Stale Reign",
      detail: `${Math.max(weeksSinceLastTitleEvent, defenseWindow)} weeks since last title event. A fresh defense is advisable.`,
      tone: "build",
    });
  }

  return diagnostics;
}

function getTitleSceneRead(championship: Championship, wrestlers: Wrestler[], currentWeek: number, rivalries: Rivalry[] = []) {
  const scene = getTitleDivisionScene(championship, wrestlers, rivalries, currentWeek);
  const contenders = scene.eligibleRoster;
  const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
  const reignLength = getReignLength(championship, currentWeek);

  if (championship.eligibleMatchScope === "tag_team") {
    return {
      label: contenders.length >= 2 ? "Tag Lane Ready" : "Needs Challengers",
      detail:
        contenders.length >= 2
          ? "The champions have enough roster depth for a 2v2 M020 title defense."
          : "The tag title needs two available challengers outside the champion pair.",
    };
  }

  if (contenders.length < 2) {
    return {
      label: "Needs Contenders",
      detail: "The roster needs more same-division contenders around this championship.",
    };
  }

  if (contenders.length < 4) {
    return {
      label: "Thin Scene",
      detail: "There is a title lane, but the challenger pool is narrow.",
    };
  }

  if (reignLength >= defenseWindow && championship.defenses === 0) {
    return {
      label: "Needs Attention",
      detail: `No defense recorded across a ${reignLength}-week reign.`,
    };
  }

  if (contenders.length > 7) {
    return {
      label: "Crowded Scene",
      detail: "Plenty of eligible talent can credibly circle this title.",
    };
  }

  if (!contenders.some((wrestler) => wrestler.momentum >= 75)) {
    return {
      label: "Cold Scene",
      detail: "The division has bodies, but nobody is carrying hot momentum yet.",
    };
  }

  return {
    label: "Strong Scene",
    detail: `${contenders.length} same-division contender${contenders.length === 1 ? "" : "s"} fit the title picture.`,
  };
}

function formatWeekCount(weeks: number) {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

function getChampionshipHistoryAgeWeeks(game: GameState, event: ChampionshipHistoryEvent) {
  const seasonDelta = Math.max(0, game.seasonNumber - event.seasonNumber);
  return Math.max(0, seasonDelta * 12 + game.currentWeek - event.weekNumber);
}

function getTitleRivalries(championship: Championship, wrestlers: Wrestler[], rivalries: Rivalry[]) {
  const championIds = new Set(championship.championIds);

  return rivalries.filter((rivalry) => {
    if (rivalry.status === "stale" || rivalry.stakes !== "title") {
      return false;
    }

    const hasChampion = rivalry.participantIds.some((id) => championIds.has(id));
    const hasEligibleChallenger = rivalry.participantIds.some((id) => {
      const wrestler = wrestlers.find((talent) => talent.id === id);
      return Boolean(wrestler && !championIds.has(id) && wrestlerFitsChampionshipDivision(wrestler, championship));
    });

    return hasChampion && hasEligibleChallenger;
  });
}

function getTitleScenePressureSnapshot(championship: Championship, game: GameState): TitleScenePressureSnapshot {
  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek);
  const recentHistory = getChampionshipHistory(game, championship.id, 1);
  const latestTitleEvent = recentHistory[0];
  const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
  const reignLength = getReignLength(championship, game.currentWeek);
  const weeksSinceLastTitleEvent = latestTitleEvent ? getChampionshipHistoryAgeWeeks(game, latestTitleEvent) : Math.max(0, reignLength - 1);
  const calendarWeek = getCurrentCalendarWeek(game);
  const contenders = scene.eligibleRoster;
  const hotContenders = contenders.filter((wrestler) => wrestler.momentum >= 75);
  const premiumContenders = contenders.filter((wrestler) => wrestler.popularity >= 75);
  const titleRivalries = getTitleRivalries(championship, game.wrestlers, game.rivalries);
  const championNeedsTv = scene.champions.some((wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2);
  const diagnostics: TitleScenePressureDiagnostic[] = [];

  if (championship.eligibleMatchScope === "tag_team") {
    diagnostics.push(...getTagDivisionHealthDiagnostics(championship, game).slice(0, 4));
    diagnostics.push({
      id: "tag-scope",
      label: contenders.length >= 2 ? "Tag Title Ready" : "Needs Challengers",
      detail:
        contenders.length >= 2
          ? "The title can be defended in a valid M020 tag match with the champions together on one side."
          : "The current roster does not have two eligible challengers outside the champion pair.",
      tone: contenders.length >= 2 ? "steady" : "build",
    });
  } else if (!scene.champions.length) {
    diagnostics.push({
      id: "no-champion",
      label: "Champion Assignment Gap",
      detail: "No current champion resolves from the saved roster data, so this scene can only show fallback context.",
      tone: "build",
    });
  } else {
    if (contenders.length < 2) {
      diagnostics.push({
        id: "needs-challenger",
        label: "Needs A Challenger",
        detail: "The title office has fewer than two eligible same-division challengers around the champion.",
        tone: "build",
      });
    }

    if (championNeedsTv) {
      const quietChampion = scene.champions.find((wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2);
      diagnostics.push({
        id: "champion-tv",
        label: "Champion Needs TV",
        detail: quietChampion
          ? `${quietChampion.name} has been off the current-season TV board for ${formatWeekCount(getWeeksSinceLastBooked(quietChampion, game.currentWeek))}.`
          : "The champion has been away from recent TV time.",
        tone: "watch",
      });
    }

    if (weeksSinceLastTitleEvent >= defenseWindow && reignLength >= defenseWindow) {
      diagnostics.push({
        id: "defense-drought",
        label: "Defense Drought",
        detail: `No resolved defense or title change is recorded in ${formatWeekCount(weeksSinceLastTitleEvent)}; this is advisory only.`,
        tone: "watch",
      });
    }

    if (titleRivalries.length || hotContenders.length >= 2) {
      diagnostics.push({
        id: "hot-scene",
        label: "Hot Scene",
        detail: titleRivalries.length
          ? `${titleRivalries[0].name} gives the title picture active story heat.`
          : `${hotContenders.slice(0, 2).map((wrestler) => wrestler.name).join(" / ")} are carrying strong momentum near this belt.`,
        tone: "hot",
      });
    }

    if ((calendarWeek.showType === "ple" || calendarWeek.isGoHome) && (titleRivalries.length || hotContenders.length || premiumContenders.length) && contenders.length >= 2) {
      diagnostics.push({
        id: "ple-ready",
        label: "PLE-Ready Stakes",
        detail: `${calendarWeek.showName} has enough visible champion/challenger context for a major-event title beat if you want it.`,
        tone: "hot",
      });
    }

    if (contenders.length >= 7) {
      diagnostics.push({
        id: "contender-crowding",
        label: "Contender Crowding",
        detail: `${contenders.length} eligible wrestlers fit this lane, so the title scene can support eliminators or spotlight matches.`,
        tone: "steady",
      });
    }

    if (!titleRivalries.length && !hotContenders.length && weeksSinceLastTitleEvent >= Math.max(3, defenseWindow - 2)) {
      diagnostics.push({
        id: "cooling-division",
        label: "Cooling Division",
        detail: "No hot contender or active title rivalry is currently propping up the scene.",
        tone: "build",
      });
    }
  }

  if (!diagnostics.length) {
    diagnostics.push({
      id: "stable-scene",
      label: "Stable Division",
      detail: "Champion, challenger depth, and recent title context are all readable without a forced title beat.",
      tone: "steady",
    });
  }

  const primary =
    diagnostics.find((item) => item.tone === "build") ??
    diagnostics.find((item) => item.tone === "watch") ??
    diagnostics.find((item) => item.tone === "hot") ??
    diagnostics[0];
  const divisionHealth = `${contenders.length} eligible · ${hotContenders.length} hot · ${titleRivalries.length} title rivalr${titleRivalries.length === 1 ? "y" : "ies"}`;
  const producerRead =
    primary.tone === "hot"
      ? "Title office reads hot. Feature it, protect it, or let the chase breathe."
      : primary.tone === "build"
        ? "Title office wants attention, but the choice stays with booking."
        : primary.tone === "watch"
          ? "Title office is flagging pressure without requiring a defense."
          : "Title office is steady and ready to support TV when you need it.";

  return {
    primary,
    diagnostics: diagnostics.slice(0, 4),
    divisionHealth,
    producerRead,
    defenseWindow,
    reignLength,
    weeksSinceLastTitleEvent,
    titleRivalries,
  };
}

function getTitleScenePressureRank(tone: TitleScenePressureTone) {
  if (tone === "build") {
    return 4;
  }

  if (tone === "watch") {
    return 3;
  }

  if (tone === "hot") {
    return 2;
  }

  return 1;
}

function getChampionshipPressureSnapshots(game: GameState) {
  return game.championships
    .map((championship) => ({
      championship,
      snapshot: getTitleScenePressureSnapshot(championship, game),
    }))
    .sort(
      (a, b) =>
        getTitleScenePressureRank(b.snapshot.primary.tone) - getTitleScenePressureRank(a.snapshot.primary.tone) ||
        b.championship.prestige - a.championship.prestige,
    );
}

function getTitleSceneGMRead(championship: Championship, scene: ReturnType<typeof getTitleDivisionScene>) {
  if (championship.eligibleMatchScope === "tag_team") {
    return "Tag title defenses are available only as 2v2 M020 matches with the champion pair together on one side.";
  }

  if (scene.eligibleRoster.length < 2) {
    return "Division is thin. This belt needs more eligible wrestlers before the title scene can breathe.";
  }

  const [first, second] = scene.topContenders;

  if (first && second && getTitleSceneTalentScore(first, championship) - getTitleSceneTalentScore(second, championship) >= 20) {
    return `Clear challenger emerging: ${first.name} is separating from the pack.`;
  }

  if (scene.eligibleRoster.length > 7) {
    return "Crowded contender field. This belt can support eliminators, contender promos, or a multi-person spotlight.";
  }

  if (scene.risingContenders.length) {
    return `${scene.risingContenders[0].name} is rising behind the front line.`;
  }

  return "Stable title lane. The champion has enough credible challengers for weekly TV.";
}

function formatTitleSceneNames(wrestlers: Wrestler[], fallback: string) {
  return wrestlers.length ? wrestlers.map((wrestler) => wrestler.name).join(" / ") : fallback;
}

function getOtherChampionshipHolderLabels(wrestler: Wrestler, championships: Championship[], currentChampionshipId?: string) {
  return championships
    .filter((championship) => championship.id !== currentChampionshipId)
    .filter((championship) => championship.championIds.includes(wrestler.id))
    .map((championship) => `${championship.name} holder`);
}

function formatTitleSceneNamesWithChampionContext(wrestlers: Wrestler[], championships: Championship[], currentChampionshipId: string, fallback: string) {
  if (!wrestlers.length) {
    return fallback;
  }

  return wrestlers
    .map((wrestler) => {
      const holderLabels = getOtherChampionshipHolderLabels(wrestler, championships, currentChampionshipId);
      return holderLabels.length ? `${wrestler.name} (${holderLabels.join(", ")})` : wrestler.name;
    })
    .join(" / ");
}

function getWrestlerTitleSceneRows(wrestler: Wrestler, game: GameState) {
  return game.championships
    .filter((championship) => championship.eligibleMatchScope !== "tag_team")
    .filter((championship) => wrestlerFitsChampionshipDivision(wrestler, championship) || championship.championIds.includes(wrestler.id))
    .map((championship) => {
      const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek);
      const isChampion = championship.championIds.includes(wrestler.id);
      const topIndex = scene.topContenders.findIndex((contender) => contender.id === wrestler.id);
      const risingIndex = scene.risingContenders.findIndex((contender) => contender.id === wrestler.id);
      const relevance = isChampion
        ? "Champion"
        : topIndex >= 0
          ? `Top Contender ${topIndex + 1}`
          : risingIndex >= 0
            ? "Rising Contender"
            : "Eligible Roster";

      return {
        championship,
        relevance,
        detail: `${championship.brand ?? "Brand"} · ${championship.division} · ${championship.titleLevel ?? "Title"}`,
      };
    });
}

function getChampionshipOfficeLine(championship: Championship) {
  const brand = championship.brand ?? "Brand";
  const level = championship.titleLevel ?? "Title";
  const type = championship.titleType ?? championship.prestigeTier ?? championship.division;

  return `${brand} · ${championship.division} · ${level} · ${type}`;
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

function getChampionshipEventPairLine(event: ChampionshipHistoryEvent) {
  if (!event.winningPairIds?.length && !event.winningPairLabel) {
    return undefined;
  }

  const winner = event.winningPairLabel ?? event.winningPairIds?.join(" / ") ?? "Winning pair";
  const loser = event.losingPairLabel ?? event.losingPairIds?.join(" / ");
  return loser ? `${winner} over ${loser}` : winner;
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

function getRivalryHistoryAgeWeeks(game: GameState, event: RivalryHistoryEvent) {
  const seasonDelta = Math.max(0, game.seasonNumber - event.seasonNumber);
  return Math.max(0, seasonDelta * 12 + game.currentWeek - event.weekNumber);
}

function getRivalryStageContext(game: GameState, rivalry: Rivalry) {
  const calendarWeek = getCurrentCalendarWeek(game);

  return deriveRivalryStage(rivalry, {
    hasPlePayoff: hasPlePayoff(game, rivalry.id),
    isGoHome: calendarWeek.isGoHome,
    isPle: calendarWeek.showType === "ple",
  });
}

function getRivalryTimingSnapshot(rivalry: Rivalry, game: GameState): RivalryTimingSnapshot {
  const calendarWeek = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const history = getRivalryHistory(game, rivalry.id, 20);
  const latestPlePayoff = history.find((event) => event.eventType === "ple_payoff");
  const latestHistory = history[0];
  const latestHistoryAge = latestHistory ? getRivalryHistoryAgeWeeks(game, latestHistory) : Math.max(0, game.currentWeek - 1);
  const latestPayoffAge = latestPlePayoff ? getRivalryHistoryAgeWeeks(game, latestPlePayoff) : Infinity;
  const recentlyPaidOff = latestPayoffAge <= 2;
  const weeksSinceAdvanced = rivalry.lastAdvancedWeek ? Math.max(0, game.currentWeek - rivalry.lastAdvancedWeek) : Math.max(0, game.currentWeek - 1);
  const currentCardSegments = game.currentShow.filter((segment) => segment.rivalryId === rivalry.id);
  const currentCardParticipants = new Set(
    game.currentShow
      .flatMap((segment) => segment.participantIds)
      .filter((id) => rivalry.participantIds.includes(id)),
  );
  const diagnostics: RivalryTimingDiagnostic[] = [];

  if (recentlyPaidOff) {
    diagnostics.push({
      id: "recently-paid-off",
      label: "Recently Paid Off",
      detail: `${rivalry.name} hit a PLE checkpoint ${formatWeekCount(latestPayoffAge)} ago.`,
      tone: "steady",
    });
  }

  if (!recentlyPaidOff && rivalry.heat >= 78 && rivalry.weeksActive >= 5 && weeksSinceAdvanced >= 2) {
    diagnostics.push({
      id: "payoff-overdue",
      label: "Payoff Overdue",
      detail: `High heat, ${formatWeekCount(rivalry.weeksActive)} active, and ${formatWeekCount(weeksSinceAdvanced)} since the last recorded beat.`,
      tone: "watch",
    });
  }

  if (!recentlyPaidOff && (calendarWeek.showType === "ple" || weeksUntilPle <= 1) && rivalry.heat >= 65 && rivalry.weeksActive >= 3 && rivalry.freshness >= 40) {
    diagnostics.push({
      id: "ple-ready",
      label: "PLE-Ready",
      detail: `${nextPle?.showName ?? calendarWeek.showName} is close, and this feud has enough heat and time on the board for a major payoff if you choose it.`,
      tone: "hot",
    });
  }

  if (rivalry.status === "stale" || rivalry.status === "cooling" || rivalry.freshness <= 35 || rivalry.heat < 45) {
    diagnostics.push({
      id: "cooling-off",
      label: "Cooling Off",
      detail: `Heat ${rivalry.heat}, freshness ${rivalry.freshness}, and ${formatRivalryStatus(rivalry.status)} status say the room is losing the thread.`,
      tone: "build",
    });
  }

  if (!recentlyPaidOff && currentCardSegments.length === 0 && (weeksSinceAdvanced >= 2 || rivalry.lastAdvancedWeek === 0)) {
    diagnostics.push({
      id: "needs-tv",
      label: "Needs TV",
      detail: rivalry.lastAdvancedWeek
        ? `${formatWeekCount(weeksSinceAdvanced)} since the last recorded beat, and no current rundown segment is attached.`
        : "No recorded TV beat yet, and no current rundown segment is attached.",
      tone: "watch",
    });
  }

  if (rivalry.heat >= 75 && rivalry.freshness >= 50 && !recentlyPaidOff) {
    diagnostics.push({
      id: "hot-program",
      label: "Hot Program",
      detail: `Heat ${rivalry.heat} with ${rivalry.freshness} freshness gives creative a strong live wire.`,
      tone: "hot",
    });
  }

  if (rivalry.weeksActive <= 1 && latestHistory?.eventType === "started") {
    diagnostics.push({
      id: "just-sparked",
      label: "Just Sparked",
      detail: "The premise is fresh. A clean TV beat can make the audience understand why it matters.",
      tone: "build",
    });
  } else if (rivalry.heat >= 55 && rivalry.weeksActive <= 4 && rivalry.freshness >= 45) {
    diagnostics.push({
      id: "building-heat",
      label: "Building Heat",
      detail: `${formatWeekCount(rivalry.weeksActive)} active with enough freshness to keep layering TV beats.`,
      tone: "steady",
    });
  }

  if (currentCardSegments.length) {
    diagnostics.push({
      id: "on-card",
      label: "On Tonight's Board",
      detail: `${currentCardSegments.length} current segment${currentCardSegments.length === 1 ? "" : "s"} attached, with ${currentCardParticipants.size} participant${currentCardParticipants.size === 1 ? "" : "s"} visible.`,
      tone: "steady",
    });
  }

  if (!diagnostics.length) {
    diagnostics.push({
      id: "steady-program",
      label: "Steady Program",
      detail: "The feud has readable state and no urgent timing pressure from the current board.",
      tone: "steady",
    });
  }

  const primary =
    diagnostics.find((item) => item.id === "payoff-overdue") ??
    diagnostics.find((item) => item.id === "ple-ready") ??
    diagnostics.find((item) => item.id === "cooling-off") ??
    diagnostics.find((item) => item.id === "needs-tv") ??
    diagnostics.find((item) => item.id === "hot-program") ??
    diagnostics[0];
  const timingRead = `${formatWeekCount(rivalry.weeksActive)} active · ${rivalry.lastAdvancedWeek ? `${formatWeekCount(weeksSinceAdvanced)} since beat` : "no TV beat yet"} · ${weeksUntilPle === 0 ? "PLE week" : `${formatWeekCount(weeksUntilPle)} to PLE`}`;
  const producerRead =
    primary.id === "payoff-overdue"
      ? "Creative room reads this as high-pressure. Payoff is available, not forced."
      : primary.id === "ple-ready"
        ? "Major-event window is open. The final call stays with the GM."
        : primary.id === "cooling-off"
          ? "This needs a distinct beat or a deliberate exit plan soon."
          : primary.id === "needs-tv"
            ? "The feud needs visibility before the audience loses the thread."
            : primary.id === "hot-program"
              ? "Strong program. Feature it, protect it, or let anticipation breathe."
              : "The feud can keep building at TV pace.";

  return {
    primary,
    diagnostics: diagnostics.slice(0, 4),
    timingRead,
    producerRead,
    weeksSinceAdvanced,
    weeksUntilPle,
    currentCardBeats: currentCardSegments.length,
    currentCardParticipants: currentCardParticipants.size,
    recentlyPaidOff,
  };
}

function getRivalryTimingRank(tone: RivalryTimingTone) {
  if (tone === "watch") {
    return 4;
  }

  if (tone === "build") {
    return 3;
  }

  if (tone === "hot") {
    return 2;
  }

  return 1;
}

function getRivalryTimingSnapshots(game: GameState) {
  return game.rivalries
    .map((rivalry) => ({
      rivalry,
      snapshot: getRivalryTimingSnapshot(rivalry, game),
    }))
    .sort(
      (a, b) =>
        getRivalryTimingRank(b.snapshot.primary.tone) - getRivalryTimingRank(a.snapshot.primary.tone) ||
        b.rivalry.heat - a.rivalry.heat ||
        a.rivalry.name.localeCompare(b.rivalry.name),
    );
}

function getRivalryTitleRelevance(rivalry: Rivalry, championships: Championship[], wrestlers: Wrestler[]) {
  const storyline = getRivalryStoryline(rivalry);
  const participantIds = new Set(rivalry.participantIds);

  for (const championship of championships.filter(isSinglesChampionship)) {
    const championId = championship.championIds[0];
    const hasChampion = participantIds.has(championId);
    const eligibleChallengers = rivalry.participantIds
      .filter((id) => id !== championId)
      .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
      .filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
      .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship));

    if (hasChampion && eligibleChallengers.length) {
      return {
        label: storyline.titleFit === "Title" || rivalry.stakes === "title" ? "Title Rivalry" : "Title-Relevant",
        detail: `${championship.name}: ${getWrestlerNames([championId], wrestlers)} vs ${eligibleChallengers.map((wrestler) => wrestler.name).join(" / ")}`,
      };
    }
  }

  if (storyline.titleFit.includes("Title") || storyline.titleFit.includes("title")) {
    return {
      label: "Title-Friendly Story",
      detail: `${storyline.name} can connect to a title scene when champion and contender fit the same division.`,
    };
  }

  return undefined;
}

function canSegmentAttachRivalry(segment: Segment, rivalry: Rivalry, wrestlers: Wrestler[] = []) {
  return (
    segment.type !== "Open Challenge" &&
    !isRivalryIntergenderBlocked(rivalry, wrestlers) &&
    (!segment.participantIds.length || segment.participantIds.some((id) => rivalry.participantIds.includes(id)))
  );
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
    const championship = game.championships.find((title) => canSegmentAttachChampionship(segment, title, game.wrestlers));
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

function isRivalryIntergenderBlocked(rivalry: Rivalry, wrestlers: Wrestler[]) {
  const participants = getRivalryParticipants(rivalry, wrestlers);

  return participants.length > 1 && !canWrestlersShareMatch(participants);
}

function getRivalryCreationBlockReason(wrestlerAId: string, wrestlerBId: string, wrestlers: Wrestler[]) {
  if (!wrestlerAId || !wrestlerBId || wrestlerAId === wrestlerBId) {
    return "";
  }

  const participants = [wrestlers.find((wrestler) => wrestler.id === wrestlerAId), wrestlers.find((wrestler) => wrestler.id === wrestlerBId)].filter(
    (wrestler): wrestler is Wrestler => Boolean(wrestler),
  );

  if (participants.length === 2 && !canWrestlersShareMatch(participants)) {
    return "Rivalry blocked: this build follows the same no-intergender boundary as match booking. Choose wrestlers from the same division.";
  }

  return "";
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

function getLegacyFinanceRevenue(report: FinanceReport) {
  return report.ticketRevenue + report.merchRevenue + report.mediaRevenue;
}

function getLegacyFinanceExpenses(report: FinanceReport) {
  return report.talentCost + report.productionCost;
}

function getFinanceGrossRevenue(report: FinanceReport) {
  return report.grossRevenue ?? getLegacyFinanceRevenue(report);
}

function getFinanceTotalExpenses(report: FinanceReport) {
  return report.totalExpenses ?? getLegacyFinanceExpenses(report);
}

function getFinanceRevenueBreakdown(report: FinanceReport) {
  return report.revenueBreakdown?.length
    ? report.revenueBreakdown
    : [
        { id: "ticketRevenue", label: "Ticket Revenue", amount: report.ticketRevenue },
        { id: "merchRevenue", label: "Merch Revenue", amount: report.merchRevenue },
        { id: "mediaRevenue", label: "Media Revenue", amount: report.mediaRevenue },
      ];
}

function getFinanceExpenseBreakdown(report: FinanceReport) {
  return report.expenseBreakdown?.length
    ? report.expenseBreakdown
    : [
        { id: "talentCost", label: "Talent Cost", amount: report.talentCost },
        { id: "productionCost", label: "Production Cost", amount: report.productionCost },
      ];
}

function getFinanceReportModelLabel(report: FinanceReport) {
  return report.modelVersion ? "Legacy-Compatible v2" : "Legacy Report";
}

function getVenueMarketContextReadout(report: FinanceReport | undefined, seasonReports: FinanceReport[]) {
  if (!report) {
    return {
      label: "Venue context pending",
      read: "Run a show to close books and get a venue/market read from the actual report.",
      summary: "No closed reports yet this run.",
    };
  }

  const seasonPeerReports = seasonReports.filter((peer) => peer.seasonNumber === report.seasonNumber);
  const avgAttendance = seasonPeerReports.length
    ? Math.round(
        seasonPeerReports.reduce((total, peer) => total + peer.attendance, 0) / Math.max(1, seasonPeerReports.length),
      )
    : undefined;
  const avgGrossRevenue = seasonPeerReports.length
    ? Math.round(
        seasonPeerReports.reduce((total, peer) => total + getFinanceGrossRevenue(peer), 0) / Math.max(1, seasonPeerReports.length),
      )
    : undefined;
  const avgProfit = seasonPeerReports.length
    ? Math.round(
        seasonPeerReports.reduce((total, peer) => total + peer.profitLoss, 0) / Math.max(1, seasonPeerReports.length),
      )
    : undefined;
  const attendance = report.attendance;
  const showScore = report.showScore;
  const gross = getFinanceGrossRevenue(report);
  const costs = getFinanceTotalExpenses(report);
  const isStrongCrowd = avgAttendance === undefined ? attendance >= 5500 : attendance >= avgAttendance * 1.2;
  const isWeakCrowd = avgAttendance === undefined ? attendance <= 2800 : attendance <= avgAttendance * 0.75;
  const isScoreStrong = showScore >= 82;
  const isFinanciallyEfficient = avgGrossRevenue === undefined
    ? report.profitLoss >= 1200
    : gross >= Math.max(avgGrossRevenue, 1) * 0.78 && report.profitLoss >= 800;
  const isCostHeavy = isWeakCrowd
    ? costs >= gross * 1.1 && report.profitLoss < 0
    : gross > 0
      ? costs / Math.max(1, gross) >= 0.75
      : false;

  let label = "Regional TV Market";
  if (report.showType === "ple") {
    if (isStrongCrowd && isFinanciallyEfficient && isScoreStrong) {
      label = "Premium PLE Market";
    } else if (isCostHeavy) {
      label = "Costly Production City";
    } else if (isStrongCrowd || showScore >= 78) {
      label = "Strong Touring Market";
    } else {
      label = "Regional TV Market";
    }
  } else if (isCostHeavy) {
    label = "Costly Production City";
  } else if (isStrongCrowd && isFinanciallyEfficient && isScoreStrong) {
    label = "Hot Wrestling Town";
  } else if (isFinanciallyEfficient && showScore >= 75) {
    label = "Efficient House";
  } else if (isStrongCrowd || report.weekNumber % 3 === 0) {
    label = "Strong Touring Market";
  } else if (isWeakCrowd) {
    label = "Regional TV Market";
  }

  const crowdRead = avgAttendance === undefined
    ? `Crowd landed at ${attendance.toLocaleString()} checks this board.`
    : `${attendance.toLocaleString()} attendance vs ${avgAttendance.toLocaleString()} this-season average.`;
  const moneyRead = avgProfit === undefined
    ? `Profit/Loss tracked at ${formatMoney(report.profitLoss)} from ${formatMoney(gross)} gross.`
    : `${formatMoney(report.profitLoss)} closed with a score ${showScore} ${report.profitLoss >= avgProfit ? "above" : "below"} season pace.`;
  const summary = `${crowdRead} ${moneyRead}`;

  return {
    label,
    read: summary,
    summary,
  };
}

function getBestRevenueReport(reports: FinanceReport[]) {
  return reports.reduce<FinanceReport | undefined>((best, report) => {
    const revenue = getFinanceGrossRevenue(report);
    const bestRevenue = best ? getFinanceGrossRevenue(best) : -Infinity;
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

function getWrestlerValueProfile(wrestler: Wrestler): WrestlerValueProfile {
  const financeRow = getRosterFinanceValueForWrestler(wrestler);

  if (!financeRow) {
    return {
      contextMode: "missing",
      valueTierLabel: "Profile Pending",
      draftValueLabel: "Draft value not mapped",
      weeklyValueLabel: "Weekly signal unavailable",
      dossierRead: "Contract-value context is not yet available for this wrestler in the current catalog mapping.",
      costRead: "Use core booking context as the decision input until this roster profile maps.",
    };
  }

  const summary = financeModelSummaryByRole.find(
    (row) => row.roleTier.toLowerCase() === (financeRow.roleTier ?? wrestler.roleTier ?? "unknown").toLowerCase().trim(),
  );
  const minDraftValue = summary?.minDraftValueUsd ?? (hasValueSummary ? valueProfileFallbackSummary.minDraftValue : 0);
  const maxDraftValue = summary?.maxDraftValueUsd ?? (hasValueSummary ? valueProfileFallbackSummary.maxDraftValue : 0);
  const draftRange = Math.max(1, maxDraftValue - minDraftValue);
  const draftValueRatio = Math.max(
    0,
    Math.min(1, (financeRow.draftValueUsd - minDraftValue) / draftRange),
  );
  const roleHireMedian = summary?.medianWeeklyHireRateUsd ?? (hasValueSummary ? valueProfileFallbackSummary.medianWeeklyHireRate : financeRow.weeklyHireRateUsd || 1);
  const weeklyPressureRatio = financeRow.weeklyHireRateUsd / Math.max(roleHireMedian, 1);
  const roleTierLabel = financeRow.roleTier || wrestler.roleTier || "Roster";
  const isMainEventRole = roleTierLabel.toLowerCase() === "mainevent";
  const isHighCost = weeklyPressureRatio >= 1.45;
  const isRiskySpend = isHighCost || financeRow.releasePenaltyPct >= 28;
  const isPremiumBand = draftValueRatio >= 0.7;
  const isTopBand = draftValueRatio >= 0.9;

  const valueTierLabel = isTopBand
    ? isHighCost
      ? "High-Cost Attraction"
      : isMainEventRole
        ? "Main Event Investment"
        : "Premium Draw"
    : isPremiumBand
      ? isRiskySpend
        ? "Risky Spend"
        : "Premium Draw"
      : draftValueRatio >= 0.4
        ? "Rising Value"
        : "Bargain Workhorse";

  const dossierRead = isTopBand
    ? isMainEventRole
      ? `${wrestler.name} is carrying a top-end profile where brand positioning and booking rhythm have outsized impact.`
      : `${wrestler.name} carries a heavy value footprint in the current roster map.`
    : draftValueRatio >= 0.4
      ? `${wrestler.name} shows reliable value with upside if protected for higher-value stories.`
      : `${wrestler.name} reads as a productive value anchor with room for workload shaping.`;

  const costRead = isRiskySpend
    ? "Expect elevated weekly-cost pressure and use this wrestler in moments that justify the commitment."
    : isTopBand
      ? "High-value commitments should be framed as deliberate GM calls, not routine depth options."
      : draftValueRatio < 0.4
        ? "Good for depth, experimentation, and controlled TV seasoning windows."
        : "Use with moderate planning around milestone spots and long-term card identity.";

  return {
    contextMode: "active",
    valueTierLabel,
    draftValueLabel: `${formatMoney(financeRow.draftValueUsd)} opening-rights read`,
    weeklyValueLabel: `${formatMoney(financeRow.weeklyHireRateUsd)} / week context`,
    dossierRead,
    costRead,
  };
}

function getTalentValuePressure(wrestlers: Wrestler[]): TalentValuePressure {
  const profiles = wrestlers.map(getWrestlerValueProfile);
  const mappedProfiles = profiles.filter((profile) => profile.contextMode === "active");
  const premiumLabels = new Set(["Premium Draw", "Main Event Investment", "High-Cost Attraction", "Risky Spend"]);
  const bargainLabels = new Set(["Bargain Workhorse", "Rising Value"]);
  const premiumCount = mappedProfiles.filter((profile) => premiumLabels.has(profile.valueTierLabel)).length;
  const bargainCount = mappedProfiles.filter((profile) => bargainLabels.has(profile.valueTierLabel)).length;
  const missingCount = profiles.length - mappedProfiles.length;
  const gmRead =
    mappedProfiles.length === 0
      ? "Talent value context is still pending for this roster. Finance pressure should be read from closed show reports until mappings are available."
      : premiumCount > bargainCount + 2
        ? "This roster leans top-heavy. The office read is prestige value with elevated weekly-cost pressure, not a payroll restriction."
        : bargainCount > premiumCount + 2
          ? "This roster has a strong value base. You have room to shape TV identity without every slot needing a premium draw."
          : "Roster value is balanced across premium anchors and useful value pieces. Treat this as context for booking emphasis, not an enforced budget gate.";

  return {
    bargainCount,
    gmRead,
    mappedCount: mappedProfiles.length,
    missingCount,
    premiumCount,
    totalCount: profiles.length,
  };
}

function getFreeAgentWatchlist(wrestlers: Wrestler[], maxEntries = 8) {
  const rosterIds = new Set(wrestlers.map((wrestler) => wrestler.id));
  const allWatch = draftPool
    .filter((candidate) => !rosterIds.has(candidate.id))
    .map((wrestler) => ({ wrestler, profile: getWrestlerValueProfile(wrestler) }))
    .sort(
      (a, b) =>
        (a.wrestler.draftRank ?? Number.MAX_SAFE_INTEGER) - (b.wrestler.draftRank ?? Number.MAX_SAFE_INTEGER) ||
        b.wrestler.popularity - a.wrestler.popularity ||
        b.wrestler.momentum - a.wrestler.momentum,
    );

  return {
    total: allWatch,
    visible: allWatch.slice(0, maxEntries),
  };
}

function getFinancePresenceRead(money: number, pressureLabel: PressureLabel, latestReport?: FinanceReport) {
  if (!latestReport) {
    return `${formatPressureLabel(pressureLabel)} pressure with ${formatMoney(money)} available. No show books have closed yet this season.`;
  }

  return `${formatPressureLabel(pressureLabel)} pressure with ${formatMoney(money)} available after ${latestReport.showName} closed at ${formatMoney(latestReport.profitLoss)}.`;
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

function getSafeBestSegment(result: ShowResult) {
  return result.segmentResults?.length ? getBestSegment(result) : undefined;
}

function buildPostShowCauseLedger(game: GameState, result: ShowResult, financeReport?: FinanceReport): CauseLedgerSection[] {
  const segmentResults = result.segmentResults ?? [];
  const bestSegment = getSafeBestSegment(result);
  const validSegmentCount = segmentResults.length;
  const titleSegments = segmentResults.filter((segment) => segment.titleNote || segment.championshipId);
  const rivalrySegments = segmentResults.filter((segment) => segment.rivalryNote || segment.rivalryId);
  const affectedOverrunSegments = segmentResults.filter((segment) => segment.overrunAffected);
  const fallout = result.lockerRoomFallout;
  const socialPosts = game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week);
  const strongSegments = segmentResults.filter((segment) => segment.score >= 85);
  const coldSegments = segmentResults.filter((segment) => segment.score < 60);
  const sections: CauseLedgerSection[] = [];

  const performanceItems: CauseLedgerItem[] = [];
  if (bestSegment) {
    performanceItems.push({
      id: "best-segment",
      label: "Top Driver",
      detail: `${bestSegment.participantNames.join(" / ")} carried the night with a ${bestSegment.score} ${bestSegment.type.toLowerCase()}.`,
      tone: bestSegment.score >= 85 ? "strong" : bestSegment.score >= 70 ? "steady" : "watch",
    });
  }
  if (strongSegments.length || coldSegments.length) {
    performanceItems.push({
      id: "score-shape",
      label: "Score Shape",
      detail: `${strongSegments.length} segment${strongSegments.length === 1 ? "" : "s"} landed at 85+, while ${coldSegments.length} segment${coldSegments.length === 1 ? "" : "s"} finished below 60.`,
      tone: coldSegments.length ? "watch" : strongSegments.length ? "strong" : "steady",
    });
  }
  if (result.broadcastOverrunNotes?.length) {
    performanceItems.push({
      id: "runtime-pressure",
      label: "Runtime Pressure",
      detail: result.broadcastOverrunNotes[0],
      tone: result.broadcastOverrunLevel === "major" || result.broadcastOverrunLevel === "moderate" ? "watch" : "steady",
    });
  } else if (result.actualRuntimeMinutes !== undefined) {
    performanceItems.push({
      id: "runtime-clean",
      label: "Runtime Shape",
      detail: `${result.actualRuntimeMinutes} actual minutes against ${result.plannedRuntimeMinutes ?? "unknown"} planned kept the broadcast record clean.`,
      tone: "steady",
    });
  }
  if (performanceItems.length) {
    sections.push({ id: "performance", label: "Show Performance Drivers", items: performanceItems });
  }

  const structureItems: CauseLedgerItem[] = [];
  if (validSegmentCount) {
    structureItems.push({
      id: "card-volume",
      label: "Card Structure",
      detail: `${validSegmentCount} resolved segment${validSegmentCount === 1 ? "" : "s"} shaped the final average.`,
      tone: validSegmentCount >= 5 ? "strong" : validSegmentCount >= 2 ? "steady" : "watch",
    });
  }
  if (titleSegments.length || rivalrySegments.length) {
    structureItems.push({
      id: "stakes-mix",
      label: "Stakes Mix",
      detail: `${titleSegments.length} title-linked segment${titleSegments.length === 1 ? "" : "s"} and ${rivalrySegments.length} rivalry-linked segment${rivalrySegments.length === 1 ? "" : "s"} gave the recap its consequence lanes.`,
      tone: titleSegments.length + rivalrySegments.length >= 2 ? "strong" : "steady",
    });
  }
  if (affectedOverrunSegments.length) {
    structureItems.push({
      id: "compressed-block",
      label: "Compressed Block",
      detail: `${affectedOverrunSegments.length} late segment${affectedOverrunSegments.length === 1 ? " was" : "s were"} marked as affected by broadcast overrun.`,
      tone: "watch",
    });
  }
  if (structureItems.length) {
    sections.push({ id: "structure", label: "Card Structure Drivers", items: structureItems });
  }

  const stakesItems: CauseLedgerItem[] = [];
  if (result.titleNotes?.length) {
    stakesItems.push({
      id: "title-fallout",
      label: "Title Desk",
      detail: result.titleNotes[0],
      tone: "strong",
    });
  }
  if (result.rivalryNotes?.length) {
    stakesItems.push({
      id: "rivalry-fallout",
      label: "Rivalry Desk",
      detail: result.rivalryNotes[0],
      tone: "strong",
    });
  }
  if (!stakesItems.length && validSegmentCount) {
    stakesItems.push({
      id: "no-stakes-fallout",
      label: "Stakes Desk",
      detail: "No championship or rivalry note fired because the resolved card did not attach those consequence lanes.",
      tone: "watch",
    });
  }
  if (stakesItems.length) {
    sections.push({ id: "stakes", label: "Title And Rivalry Drivers", items: stakesItems });
  }

  const rosterItems: CauseLedgerItem[] = [];
  if (result.biggestMomentumGain?.name) {
    rosterItems.push({
      id: "momentum-driver",
      label: "Momentum",
      detail: `${result.biggestMomentumGain.name} gained the most momentum after their resolved TV usage.`,
      tone: "strong",
    });
  }
  if (result.biggestFatigueIncrease?.name) {
    rosterItems.push({
      id: "fatigue-driver",
      label: "Fatigue Load",
      detail: `${result.biggestFatigueIncrease.name} took the biggest fatigue hit from the finished card.`,
      tone: result.biggestFatigueIncrease.amount >= 12 ? "watch" : "steady",
    });
  }
  const falloutCount =
    (fallout?.moraleDrops.length ?? 0) +
    (fallout?.moraleBoosts.length ?? 0) +
    (fallout?.overuseWarnings.length ?? 0) +
    (fallout?.underuseWarnings.length ?? 0) +
    (fallout?.injuryNotes.length ?? 0);
  if (falloutCount) {
    rosterItems.push({
      id: "locker-room-fallout",
      label: "Locker Room",
      detail: `${falloutCount} roster fallout note${falloutCount === 1 ? "" : "s"} came out of actual usage, morale, fatigue, and injury checks.`,
      tone: fallout?.injuryNotes.length || fallout?.moraleDrops.length ? "watch" : "steady",
    });
  }
  if (rosterItems.length) {
    sections.push({ id: "roster", label: "Roster Pressure Drivers", items: rosterItems });
  }

  const businessItems: CauseLedgerItem[] = [];
  if (financeReport) {
    businessItems.push({
      id: "finance-close",
      label: "Brand Office",
      detail: `${financeReport.showName} closed at ${formatMoney(financeReport.profitLoss)} on ${formatMoney(getFinanceGrossRevenue(financeReport))} revenue and ${formatMoney(getFinanceTotalExpenses(financeReport))} costs.`,
      tone: financeReport.profitLoss >= 0 ? "strong" : "watch",
    });
    if (financeReport.notes.length) {
      businessItems.push({
        id: "finance-note",
        label: "Business Cause",
        detail: financeReport.notes[0],
        tone: financeReport.profitLoss >= 0 ? "steady" : "watch",
      });
    }
  }
  if (socialPosts.length) {
    businessItems.push({
      id: "audience-pulse",
      label: "Audience Pulse",
      detail: `${socialPosts.length} IWC/social post${socialPosts.length === 1 ? "" : "s"} reacted to resolved score, title, rivalry, fatigue, or major-event facts.`,
      tone: "steady",
    });
  }
  if (businessItems.length) {
    sections.push({ id: "business", label: "Business And Audience Drivers", items: businessItems });
  }

  return sections;
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

function getQaHarnessMode(): QaHarnessMode | null {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

  if (!env?.DEV) {
    return null;
  }

  const mode = new URLSearchParams(window.location.search).get(qaHarnessParam);
  return mode === "runtime" || mode === "legacy-runtime" ? mode : null;
}

function buildQaRuntimeHarnessState(mode: QaHarnessMode): SavedGameState {
  const draftedWrestlers = draftPool.slice(0, draftPickCount);
  const game = createNewGame({
    ...defaultCareer,
    draftedWrestlers,
    brandName: "QA Runtime",
    brandStyle: "Raw",
    rivalGMAssignments: createRivalGMAssignments("Raw"),
  });

  if (mode === "legacy-runtime") {
    const focusWrestler = game.wrestlers[0];
    const legacyResult: ShowResult = {
      id: "qa-legacy-runtime-result",
      seasonNumber: game.seasonNumber,
      week: game.currentWeek,
      brandName: game.brandName,
      showName: "Legacy Runtime TV",
      showType: "tv",
      totalScore: 82,
      segmentResults: [
        {
          segmentId: "qa-legacy-runtime-segment",
          type: "Promo",
          participantNames: [focusWrestler.name],
          participantIds: [focusWrestler.id],
          score: 82,
          momentumChanges: { [focusWrestler.id]: 4 },
          fatigueChanges: { [focusWrestler.id]: 2 },
          recapNote: `${focusWrestler.name} carried a legacy promo result without runtime fields.`,
        },
      ],
      biggestMomentumGain: { name: focusWrestler.name, amount: 4 },
      biggestFatigueIncrease: { name: focusWrestler.name, amount: 2 },
      titleNotes: [],
      rivalryNotes: [],
      titleHistoryEvents: [],
      rivalryHistoryEvents: [],
      lockerRoomFallout: {
        moraleDrops: [],
        moraleBoosts: [],
        overuseWarnings: [],
        underuseWarnings: [],
        injuryNotes: [],
      },
    };

    return buildSavedGameState({ ...game, showHistory: [legacyResult] }, "results");
  }

  return buildSavedGameState(game, "booking");
}

function App() {
  const qaHarnessState = useMemo(() => {
    const mode = getQaHarnessMode();
    return mode ? buildQaRuntimeHarnessState(mode) : null;
  }, []);
  const isQaHarness = Boolean(qaHarnessState);
  const [careerSaves, setCareerSaves] = useState<CareerSave[]>(() => (isQaHarness ? [] : loadCareerSaves()));
  const [savedGame, setSavedGame] = useState<SavedGameState | null>(qaHarnessState);
  const [activeSaveId, setActiveSaveId] = useState<string | undefined>();
  const [screen, setScreen] = useState<Screen>(qaHarnessState?.screen ?? "title");
  const [titleMode, setTitleMode] = useState<TitleMode>("home");
  const [game, setGame] = useState<GameState | null>(qaHarnessState?.game ?? null);
  const [profileWrestlerId, setProfileWrestlerId] = useState<string | undefined>(qaHarnessState?.profileWrestlerId);
  const [profileReturnScreen, setProfileReturnScreen] = useState<ProfileReturnScreen>(qaHarnessState?.profileReturnScreen ?? "roster");
  const latestResult = game?.showHistory[game.showHistory.length - 1];
  const hasCurrentWeekReview = latestResult ? latestResult.week === game?.currentWeek : false;
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

    if (nextScreen === "weekReview" && !hasCurrentWeekReview) {
      persistGameSnapshot(game, "dashboard");
      setProfileWrestlerId(undefined);
      setProfileReturnScreen("roster");
      setScreen("dashboard");
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

          if (championship && !canSegmentAttachChampionship(updatedSegment, championship, current.wrestlers)) {
            updatedSegment = { ...updatedSegment, championshipId: undefined };
          }

          const rivalry = updatedSegment.rivalryId
            ? current.rivalries.find((activeRivalry) => activeRivalry.id === updatedSegment.rivalryId)
            : undefined;

          if (rivalry && !canSegmentAttachRivalry(updatedSegment, rivalry, current.wrestlers)) {
            updatedSegment = { ...updatedSegment, rivalryId: undefined };
          }

          updatedSegment = sanitizeSegmentStipulation(updatedSegment);

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

          if (!championshipId || !championship || !canSegmentAttachChampionship(segment, championship, current.wrestlers)) {
            return { ...segment, championshipId: undefined };
          }

          return { ...segment, championshipId };
        }),
      };

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function setSegmentStipulation(segmentId: string, stipulationId: string) {
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

          if (!stipulationId) {
            return { ...segment, stipulationId: undefined };
          }

          const allowed = getStipulationsForSegmentId({ ...segment });
          if (!allowed.some((option) => option.id === stipulationId)) {
            return { ...segment, stipulationId: undefined };
          }

          return { ...segment, stipulationId };
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

          if (!rivalryId || !rivalry || !canSegmentAttachRivalry(segment, rivalry, current.wrestlers)) {
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

          if (championship && !canSegmentAttachChampionship(updatedSegment, championship, current.wrestlers)) {
            updatedSegment = { ...updatedSegment, championshipId: undefined };
          }

          const rivalry = updatedSegment.rivalryId
            ? current.rivalries.find((activeRivalry) => activeRivalry.id === updatedSegment.rivalryId)
            : undefined;

          if (rivalry && !canSegmentAttachRivalry(updatedSegment, rivalry, current.wrestlers)) {
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

  function createRivalry(wrestlerAId: string, wrestlerBId: string, stakes: RivalryStakes, storylineId?: string) {
    setGame((current) => {
      if (!current || wrestlerAId === wrestlerBId || hasDuplicateRivalry(current.rivalries, wrestlerAId, wrestlerBId)) {
        return current;
      }

      const wrestlerA = current.wrestlers.find((wrestler) => wrestler.id === wrestlerAId);
      const wrestlerB = current.wrestlers.find((wrestler) => wrestler.id === wrestlerBId);

      if (!wrestlerA || !wrestlerB) {
        return current;
      }

      if (!canWrestlersShareMatch([wrestlerA, wrestlerB])) {
        return current;
      }

      const heat = getInitialRivalryHeat(wrestlerA, wrestlerB);
      const rivalryId = `rivalry-${Date.now()}`;
      const selectedStorylineId = storylineId ?? getDefaultStorylineIdForStakes(stakes);
      const storyline = getRivalryStoryline({ stakes, storylineId: selectedStorylineId });
      const rivalry = applyRivalryCatalogDefaults({
        id: rivalryId,
        name: `${wrestlerA.name} vs ${wrestlerB.name}`,
        participantIds: [wrestlerAId, wrestlerBId],
        storylineId: storyline.id,
        relationshipTag: storyline.relationshipTag,
        heat,
        freshness: 80,
        weeksActive: 1,
        lastAdvancedWeek: 0,
        status: getRivalryStatus(heat, 80),
        stakes,
      } satisfies Rivalry);
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
        onSetSegmentStipulation={setSegmentStipulation}
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
    return (
      <ResultsScreen
        game={game}
        canContinueWeekReview={hasCurrentWeekReview}
        result={latestResult}
        onContinueWeekReview={() => navigateTo("weekReview")}
        onNavigate={navigateTo}
      />
    );
  }

  if (screen === "weekReview" && latestResult && hasCurrentWeekReview) {
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
  const selectedBudgetDescription = selectedBudget.description ?? "";
  const startingBudgetAmount = getStartingBudgetAmount(startingBudgetTier);
  const draftFinanceReadout = getDraftFinanceReadout(draftedWrestlers, startingBudgetTier, startingBudgetAmount);
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
  const previewRivalBrands = createRivalBrandUniverse(rivalGMAssignments);
  const rivalDraftActivity = getRivalDraftActivitySnapshot(previewRivalBrands, draftedWrestlers.length, draftPickCount);

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
                {difficulty} / {formatStartingBudgetReadout(startingBudgetTier, startingBudgetAmount)}
              </strong>
              <p>{selectedDifficulty.description} {formatStartingBudgetDetail(startingBudgetTier, startingBudgetAmount, selectedBudgetDescription)}</p>
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
              <Metric
                label="Starting Budget"
                value={formatStartingBudgetReadout(startingBudgetTier, startingBudgetAmount)}
                detail={formatStartingBudgetDetail(startingBudgetTier, startingBudgetAmount, selectedBudgetDescription)}
              />
              <Metric label="First Season" value="12 Weeks" detail="PLEs in Weeks 4, 8, and 12" />
              <Metric label="Next Step" value="Draft Night" detail="Build the first locker room" />
            </div>
            <RivalBrandUniversePanel rivalBrands={previewRivalBrands} title="The Other Chairs Are Filled" />
            {rivalDraftActivity ? <RivalDraftActivityPanel snapshot={rivalDraftActivity} /> : null}
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
            {rivalDraftActivity ? <RivalDraftActivityPanel snapshot={rivalDraftActivity} /> : null}
            <DraftFinanceSummary readout={draftFinanceReadout} />
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
            <DraftFinanceSummary readout={draftFinanceReadout} />
            <section className="war-room-read" aria-label="Draft review war room read">
              <div>
                <p className="eyebrow">War Room Read</p>
                <h3>Locker Room Identity</h3>
              </div>
              <p>{draftReviewRead}</p>
            </section>
            {rivalDraftActivity ? <RivalDraftActivityPanel snapshot={rivalDraftActivity} /> : null}
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

function RivalBrandUniversePanel({
  className = "",
  rivalBrands,
  title,
}: {
  className?: string;
  rivalBrands: RivalBrandState[];
  title: string;
}) {
  const rosterClaims = rivalBrands.reduce((sum, brand) => sum + brand.rosterWrestlerIds.length, 0);
  const activityBeats = rivalBrands.reduce((sum, brand) => sum + brand.activityHistory.length, 0);

  return (
    <section className={`rival-universe ${className}`.trim()} aria-label="Rival Brand Universe">
      <div className="rival-universe-head">
        <div>
          <p className="eyebrow">Rival Brand Universe</p>
          <h3>{title}</h3>
        </div>
        <div className="show-strip">
          <span>{rivalBrands.length} Chairs</span>
          <span>{rosterClaims} Rival Picks</span>
          <span>{activityBeats} Activity Beats</span>
        </div>
      </div>
      {rivalBrands.length ? (
        <>
          <p className="rival-universe-read">{getRivalUniverseRead(rivalBrands)}</p>
          <div className="rival-universe-grid">
            {rivalBrands.map((rivalBrand) => (
              <article key={rivalBrand.id}>
                <span>{rivalBrand.brandName}</span>
                <strong>{rivalBrand.assignedGMName}</strong>
                <small>{rivalBrand.assignedGMStyle}</small>
                <div className="rival-brand-meta">
                  <span>{rivalBrand.roleLabel}</span>
                  <span>{rivalBrand.statusLabel}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state compact">No rival brand chairs are assigned for this career setup.</div>
      )}
    </section>
  );
}

function BrandPulsePanel({ compact = false, snapshot }: { compact?: boolean; snapshot: BrandPulseSnapshot }) {
  return (
    <section className={`brand-pulse-panel tone-${snapshot.tone}${compact ? " compact" : ""}`} aria-label="Brand Pulse">
      <div className="brand-pulse-head">
        <div>
          <p className="eyebrow">Brand Pulse</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>{snapshot.showRead}</strong>
      </div>
      <p className="brand-pulse-copy">{snapshot.detail}</p>
      <div className="brand-pulse-grid">
        <span>{snapshot.financeRead}</span>
        <span>{snapshot.socialRead}</span>
        <span>{snapshot.titleRead}</span>
        <span>{snapshot.rivalryRead}</span>
      </div>
      {!compact && snapshot.rivalNotes.length ? (
        <div className="brand-pulse-rivals" aria-label="Rival brand flavor readout">
          {snapshot.rivalNotes.map((note) => (
            <article key={note.id}>
              <span>{note.brandName}</span>
              <strong>{note.label}</strong>
              <small>{note.detail}</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DraftFinanceSummary({ readout }: { readout: DraftFinanceReadout }) {
  const pressureClass = readout.pressureLabel.toLowerCase().replace(/\s+/g, "-");

  return (
    <section className={`draft-finance-readout reserve-${pressureClass}`} aria-label="Draft finance context">
      <div className="draft-finance-head">
        <div>
          <p className="eyebrow">Draft Finance Context</p>
          <h3>Projected Reserve</h3>
        </div>
        <strong>{readout.pressureLabel}</strong>
      </div>
      <div className="draft-finance-grid">
        <Metric
          label="Starting Budget"
          value={readout.isUnlimitedBudget ? "Unlimited" : formatMoney(readout.startingBudgetAmount)}
          detail={readout.isUnlimitedBudget ? `${formatMoney(readout.startingBudgetAmount)} sandbox reference` : "Current setup selection"}
        />
        <Metric label="Roster Value" value={formatMoney(readout.rosterValue)} detail="Static catalog draft value total" />
        <Metric label="Projected Reserve" value={formatProjectedReserve(readout)} detail="If roster value were startup cost" />
        <Metric label="Reserve Pressure" value={readout.pressureLabel} detail="Readout only; no pick is blocked" />
      </div>
      <p>{getDraftFinanceNote(readout)}</p>
    </section>
  );
}

function RivalDraftActivityPanel({ snapshot }: { snapshot: RivalDraftActivitySnapshot }) {
  return (
    <section className={`rival-draft-panel tone-${snapshot.tone}`} aria-label="Rival draft activity">
      <div className="rival-draft-head">
        <div>
          <p className="eyebrow">Rival Draft Activity</p>
          <h3>{snapshot.headline}</h3>
        </div>
      </div>
      <p className="rival-draft-copy">{snapshot.detail}</p>
      {snapshot.notes.length ? (
        <div className="rival-draft-notes">
          {snapshot.notes.map((note) => (
            <article key={note.id} className={`rival-draft-note tone-${note.tone}`}>
              <span>{note.brandName}</span>
              <small>{note.gmName}</small>
              <strong>{note.label}</strong>
              <p>{note.detail}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
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
  const identity = getWrestlerIdentityContext(wrestler);

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
        {getDraftTag(wrestler.division)} · {getDraftTag(identity.role)} · {getDraftTag(identity.careerStageLabel)} · open draft availability
      </p>
      <p className="draft-card-read">
        {getDraftTag(identity.wrestlingStyle)} · {getDraftTag(identity.promoStyle)}
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
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const championshipPressureSnapshots = getChampionshipPressureSnapshots(game);
  const tagChampionshipSnapshot = championshipPressureSnapshots.find((item) => isTagChampionship(item.championship));
  const tagDivisionAttention = tagChampionshipSnapshot?.snapshot.diagnostics.find((diagnostic) => diagnostic.tone !== "steady");
  const topChampionship = championshipPressureSnapshots[0]?.championship ?? [...game.championships].sort((a, b) => b.prestige - a.prestige)[0];
  const topTitlePressure = championshipPressureSnapshots.find((item) => item.championship.id === topChampionship?.id)?.snapshot;
  const topTitleContenders = topChampionship ? getTopContenders(topChampionship, game.wrestlers, 2) : [];
  const rivalryTimingSnapshots = getRivalryTimingSnapshots(game);
  const focusRivalryTiming = rivalryTimingSnapshots[0];
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const latestSocialPost = game.socialPosts[game.socialPosts.length - 1];
  const latestFinanceReport = getLatestFinanceReport(game);
  const pressureLabel = getFinancePressureLabel(game.money, latestFinanceReport?.profitLoss ?? 0);
  const financePresenceRead = getFinancePresenceRead(game.money, pressureLabel, latestFinanceReport);
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
  const rivalBrands = game.rivalBrands ?? createRivalBrandUniverse(game.rivalGMAssignments);
  const brandPulseSnapshot = getBrandPulseSnapshot(game, lastShow);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="dashboard" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
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
                  <strong>{getSegmentParticipantsLabel(segment, game.wrestlers)}</strong>
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

      <RivalBrandUniversePanel className="command-panel rival-universe-dashboard" rivalBrands={rivalBrands} title="Competitive Landscape" />

      {brandPulseSnapshot ? <BrandPulsePanel snapshot={brandPulseSnapshot} /> : null}

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
        <p className="social-preview-text">{financePresenceRead}</p>
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
          <h3>{topChampionship?.name ?? "No Titles"}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Pressure" value={topTitlePressure?.primary.label ?? "No Read"} detail={topTitlePressure?.primary.detail} />
          <Metric label="Champion" value={topChampionship ? getWrestlerNames(topChampionship.championIds, game.wrestlers) : "None"} />
          <Metric label="Top Contenders" value={topTitleContenders.map((wrestler) => wrestler.name).join(" / ") || "No clear lane"} />
        </div>
        {tagChampionshipSnapshot && tagDivisionAttention ? (
          <p className="title-pressure-dashboard">
            Tag division attention: {tagDivisionAttention.label} · {tagDivisionAttention.detail}
          </p>
        ) : null}
        {topTitlePressure ? <p className="title-pressure-dashboard">{topTitlePressure.divisionHealth}</p> : null}
        <button className="secondary-action" onClick={() => onNavigate("championships")}>
          View Championships
        </button>
      </section>

      <section className="command-panel rivalry-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Rivalry Timing</p>
          <h3>{focusRivalryTiming ? focusRivalryTiming.rivalry.name : "No Active Rivalries"}</h3>
        </div>
        {focusRivalryTiming ? (
          <div className="spotlight-grid">
            <Metric label="Timing" value={focusRivalryTiming.snapshot.primary.label} detail={focusRivalryTiming.snapshot.primary.detail} />
            <Metric label="Heat" value={`${focusRivalryTiming.rivalry.heat}`} detail={formatRivalryStatus(focusRivalryTiming.rivalry.status)} />
            <Metric label="PLE Window" value={focusRivalryTiming.snapshot.weeksUntilPle === 0 ? "This Week" : formatWeekCount(focusRivalryTiming.snapshot.weeksUntilPle)} detail={focusRivalryTiming.snapshot.timingRead} />
          </div>
        ) : (
          <div className="empty-state compact">No rivalries are active. Start one to give weekly TV more story context.</div>
        )}
        {focusRivalryTiming ? <p className="rivalry-timing-dashboard">{focusRivalryTiming.snapshot.producerRead}</p> : null}
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
  onSetSegmentStipulation,
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
  onSetSegmentStipulation: (segmentId: string, stipulationId: string) => void;
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
  const hasCurrentWeekReview = game.showHistory[game.showHistory.length - 1]?.week === game.currentWeek;
  const runtimePercent = Math.min(100, Math.round((validRuntimeMinutes / showRuntimeTargetMinutes) * 100));
  const readiness = getShowReadiness(validSegments, invalidSegments, validRuntimeMinutes);
  const broadcastRisk = getBroadcastRuntimeRisk(validRuntimeMinutes);
  const pleReadiness = getPleReadinessSnapshot(game, validShowSegments, calendarWeek);
  const canRunShow = readiness.canRun;
  const composerSegment = game.currentShow.find((segment) => segment.id === composerSegmentId);
  const latestFinanceReport = getLatestFinanceReport(game);
  const financePressureLabel = getFinancePressureLabel(game.money, latestFinanceReport?.profitLoss ?? 0);
  const talentValuePressure = getTalentValuePressure(game.wrestlers);
  const bookingFinanceRead = `${getFinancePresenceRead(game.money, financePressureLabel, latestFinanceReport)} Roster value map: ${talentValuePressure.premiumCount} premium/high-cost and ${talentValuePressure.bargainCount} bargain/rising profiles.`;
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
    const allowedStipulations = getStipulationsForSegment({ ...segment, segmentCatalogId: option.id });
    const hasCompatibleStipulation = segment.stipulationId && allowedStipulations.some((item) => item.id === segment.stipulationId);

    onUpdateSegment(segment.id, {
      segmentCatalogId: option.id,
      segmentDisplayName: option.label,
      durationMinutes: option.defaultDurationMinutes,
      participantMin: option.minParticipants,
      participantMax: option.maxParticipants,
      championshipId: option.championshipAllowed ? segment.championshipId : undefined,
      stipulationId: hasCompatibleStipulation ? segment.stipulationId : undefined,
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
      !isRivalryIntergenderBlocked(rivalry, game.wrestlers) &&
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
      <GameNav currentScreen="booking" hasResults={Boolean(game.showHistory.length)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
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

      <section className="booking-finance-context" aria-label="Booking finance context">
        <span>Brand Office</span>
        <p>{bookingFinanceRead}</p>
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

          {pleReadiness ? <PleReadinessChecklist calendarWeek={calendarWeek} snapshot={pleReadiness} /> : null}

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
                        <p>{getSegmentParticipantsLabel(segment, game.wrestlers) || getSegmentValidationWarning(segment, game.wrestlers)}</p>
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
              game={game}
              onApplyCatalogOption={(option) => applyCatalogOption(composerSegment, option)}
              onSetSegmentStipulation={(segmentId, stipulationId) => onSetSegmentStipulation(segmentId, stipulationId)}
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

function PleReadinessChecklist({ calendarWeek, snapshot }: { calendarWeek: CalendarWeek; snapshot: PleReadinessSnapshot }) {
  return (
    <section className="ple-readiness-panel" aria-label="PLE readiness checklist">
      <div className="section-heading">
        <p className="eyebrow">PLE Readiness Checklist</p>
        <h3>{calendarWeek.showName} Control Room</h3>
      </div>
      <div className="ple-readiness-summary">
        <Metric label="Producer Notes" value={`${snapshot.readyCount}/${snapshot.items.length}`} detail="Advisory only" />
        <Metric label="Title Matches" value={`${snapshot.titleMatchCount}`} detail="Sanctioned current-card defenses" />
        <Metric label="Story Beats" value={`${snapshot.representedRivalries.length}`} detail={`${snapshot.unresolvedRivalries.length} active off card`} />
      </div>
      <div className="ple-checklist-items">
        {snapshot.items.map((item) => (
          <article className={`ple-checklist-item item-${item.tone}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.status}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <p className="ple-readiness-note">
        Producer note only. This panel reads the current card shape and does not forecast grades, audience reaction, finances, injuries, morale, title outcomes, or rivalry movement.
      </p>
    </section>
  );
}

function SegmentComposer({
  bookedCounts,
  championships,
  game,
  onApplyCatalogOption,
  onClose,
  onOpenProfile,
  onRemoveSegment,
  onSetDuration,
  onSetSegmentChampionship,
  onSetSegmentStipulation,
  onSetSegmentRivalry,
  onToggleParticipant,
  rivalries,
  segment,
  wrestlers,
}: {
  bookedCounts: Record<string, number>;
  championships: Championship[];
  game: GameState;
  onApplyCatalogOption: (option: SegmentCatalogOption) => void;
  onClose: () => void;
  onOpenProfile: (wrestlerId: string) => void;
  onRemoveSegment: () => void;
  onSetDuration: (durationMinutes: number) => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentStipulation: (segmentId: string, stipulationId: string) => void;
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
  const availableStipulations = getStipulationsForSegmentId(segment);
  const selectedStipulation = getStipulationById(segment.stipulationId);
  const stipulationContextLines = selectedStipulation
    ? [selectedStipulation.riskContext, selectedStipulation.presentationalContext, selectedStipulation.rivalryTone]
    : [];

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

      <div className="composer-block segment-stipulation">
        <div>
          <span>Match Stipulation</span>
          <strong>{selectedStipulation ? selectedStipulation.label : segment.type === "Match" ? "Optional presentation context only" : "Match-only context layer"}</strong>
        </div>
        {segment.type === "Match" ? (
          <>
            <p>
              {selectedStipulation
                ? selectedStipulation.description
                : "No stipulation keeps standard match behavior and title/fellout math unchanged."}
            </p>
            {selectedStipulation ? <p>{stipulationContextLines.join(" · ")}</p> : null}
            {availableStipulations.length ? (
              <div className="title-buttons">
                <button
                  className={!segment.stipulationId ? "active-filter" : ""}
                  onClick={() => onSetSegmentStipulation(segment.id, "")}
                >
                  Standard Match
                </button>
                {availableStipulations.map((option) => (
                  <button
                    className={segment.stipulationId === option.id ? "active-filter" : ""}
                    key={option.id}
                    onClick={() => onSetSegmentStipulation(segment.id, option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p>Stipulation metadata is available on match-format segments only in the current metadata slice.</p>
        )}
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
        game={game}
        onSetSegmentChampionship={onSetSegmentChampionship}
        segment={segment}
        wrestlers={wrestlers}
      />
      <RivalryControl
        championships={championships}
        game={game}
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
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const rosterAffiliations = getRosterAffiliations(game.wrestlers);
  const featuredAffiliations = rosterAffiliations
    .filter((affiliation) => affiliation.memberWrestlerIds.length > 1)
    .slice(0, 3);
  const freeAgentWatch = getFreeAgentWatchlist(game.wrestlers, 8);
  const roleStyleFallback = "Role/style not mapped";

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="roster" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
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

      <section className="command-panel affiliation-roster-panel" aria-label="Affiliation intelligence">
        <div className="section-heading">
          <p className="eyebrow">Locker Room Links</p>
          <h3>{rosterAffiliations.length ? "Affiliation Context" : "No Source Affiliations"}</h3>
        </div>
        {rosterAffiliations.length ? (
          <>
            <div className="spotlight-grid compact-grid">
              <Metric label="Visible Groups" value={`${rosterAffiliations.length}`} detail="Source roster labels only" />
              <Metric
                label="Team/Faction Fits"
                value={`${featuredAffiliations.length}`}
                detail={featuredAffiliations.length ? featuredAffiliations.map((affiliation) => affiliation.name).join(" / ") : "No multi-member links drafted"}
              />
              <Metric label="Gameplay Status" value="Read-Only" detail="No tag mechanics active" />
            </div>
            {featuredAffiliations.length ? (
              <div className="affiliation-strip">
                {featuredAffiliations.map((affiliation) => (
                  <span key={affiliation.id}>
                    {affiliation.name} · {formatAffiliationKind(affiliation.kind)}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state compact">No drafted wrestler has a source team or faction label in the current Top 200 data.</div>
        )}
      </section>

      <section className="command-panel free-agent-watchlist-panel" aria-label="Free agent watchlist">
        <div className="section-heading">
          <p className="eyebrow">Free Agent Watchlist</p>
          <h3>{`Top ${freeAgentWatch.visible.length} Draft-Ready Prospects`}</h3>
        </div>
        <p className="social-preview-text">
          Read-only scouting signal: these are undrafted Top 200 wrestlers available for TV context, not an active signing mechanism.
        </p>
        {freeAgentWatch.visible.length ? (
          <div className="free-agent-watch-list">
            {freeAgentWatch.visible.map((entry: FreeAgentWatchEntry) => {
              const roleStyleLabel = [entry.wrestler.roleTier, entry.wrestler.archetype].filter(Boolean).join(" / ") || roleStyleFallback;

              return (
                <article className="free-agent-watch-row" key={entry.wrestler.id}>
                  <div className="free-agent-watch-row-head">
                    <strong>{entry.wrestler.name}</strong>
                    <span className={`watchlist-tier ${entry.profile.contextMode === "missing" ? "watchlist-tier-missing" : ""}`}>
                      {entry.profile.valueTierLabel}
                    </span>
                  </div>
                  <div className="free-agent-watch-meta">
                    <span>
                      {entry.wrestler.sourceBrand ? `${entry.wrestler.sourceBrand} · #${entry.wrestler.draftRank ?? "—"}` : `Top 200 #${entry.wrestler.draftRank ?? "—"}`}
                    </span>
                    <span>{roleStyleLabel}</span>
                    <span>Pop {entry.wrestler.popularity}</span>
                    <span>Mom {entry.wrestler.momentum}</span>
                  </div>
                  <small>{entry.profile.dossierRead}</small>
                </article>
              );
            })}
            {freeAgentWatch.total.length > freeAgentWatch.visible.length ? (
              <small className="muted-copy">{freeAgentWatch.total.length - freeAgentWatch.visible.length} more undrafted names are available in the open pool.</small>
            ) : null}
          </div>
        ) : (
          <div className="empty-state compact">No undrafted Top 200 names available in this watchlist window.</div>
        )}
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
            <WrestlerCard
              currentWeek={game.currentWeek}
              key={wrestler.id}
              onOpenProfile={onOpenProfile}
              rosterAffiliations={rosterAffiliations}
              wrestler={wrestler}
            />
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
  const titleSceneRows = getWrestlerTitleSceneRows(wrestler, game);
  const activeRivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const recentTitleHistory = getWrestlerTitleHistory(game, wrestler.id);
  const recentRivalryHistory = getWrestlerRivalryHistory(game, wrestler.id);
  const recentAppearances = getRecentWrestlerAppearances(game, wrestler.id);
  const recentSocialPosts = getRecentWrestlerSocialPosts(game, wrestler.id);
  const affiliations = getWrestlerAffiliations(wrestler.id, game.wrestlers);
  const gmRead = getGMRead(wrestler, game);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const identity = getWrestlerIdentityContext(wrestler);
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const valueProfile = getWrestlerValueProfile(wrestler);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="profile" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
      <section className="profile-hero">
        <div>
          <p className="eyebrow">Wrestler Profile</p>
          <h2>{wrestler.name}</h2>
          <div className="identity-strip">
            <span>{identity.role}</span>
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
              <Metric label="Career Stage" value={identity.careerStageLabel} />
              <Metric label="Identity" value={identity.role} detail={identity.wrestlingStyle} />
              <Metric label="Promo Type" value={identity.promoStyle} detail={identity.presentationHook} />
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

          <section className={`profile-panel contract-value-panel ${valueProfile.contextMode === "missing" ? "contract-value-panel-missing" : ""}`} aria-label="Contract value context">
            <div className="section-heading">
              <p className="eyebrow">Contract Value Dossier</p>
              <h3>{valueProfile.valueTierLabel}</h3>
            </div>
            <div className="readout-list">
              <p>
                <strong>Draft profile:</strong> {valueProfile.draftValueLabel}
              </p>
              <p>
                <strong>Weekly context:</strong> {valueProfile.weeklyValueLabel}
              </p>
              <p>
                <strong>GM lens:</strong> {valueProfile.dossierRead}
              </p>
              <p>
                <strong>Cost read:</strong> {valueProfile.costRead}
              </p>
              <small className="muted-copy">
                Context-only readout. No contract mechanics, payroll locks, or automatic booking restrictions are active in this build.
              </small>
            </div>
          </section>

          <section className="profile-panel affiliation-profile-panel" aria-label="Affiliation context">
            <div className="section-heading">
              <p className="eyebrow">Affiliation Context</p>
              <h3>{affiliations.length ? "Locker Room Links" : "No Source Link"}</h3>
            </div>
            <div className="profile-list">
              {affiliations.length ? (
                affiliations.map((affiliation) => (
                  <article className="profile-context-row affiliation-context-row" key={affiliation.id}>
                    <strong>{affiliation.name}</strong>
                    <span>
                      {formatAffiliationKind(affiliation.kind)} · {affiliation.status}
                    </span>
                    <p>{getAffiliationMemberNames(affiliation, game.wrestlers) || wrestler.name}</p>
                    <small>{affiliation.notes}</small>
                  </article>
                ))
              ) : (
                <div className="empty-state compact">No team, faction, or affiliation label is available for {wrestler.name} in the current Top 200 source data.</div>
              )}
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
              <h3>{championships.length ? "Current Champion" : titleSceneRows.length ? "Title Scene Fit" : "No Current Title"}</h3>
            </div>
            <div className="profile-list">
              {titleSceneRows.length ? (
                titleSceneRows.map(({ championship, detail, relevance }) => (
                  <article className="profile-context-row" key={championship.id}>
                    <strong>{championship.name}</strong>
                    <span>
                      {relevance} · {detail} · Prestige {championship.prestige}
                    </span>
                  </article>
                ))
              ) : (
                <p className="muted-copy">{wrestler.name} does not currently fit an active singles title scene.</p>
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
                activeRivalries.map((rivalry) => {
                  const storyline = getRivalryStoryline(rivalry);
                  const relationship = getRivalryRelationship(rivalry);
                  const stage = getRivalryStageContext(game, rivalry);
                  const titleRelevance = getRivalryTitleRelevance(rivalry, game.championships, game.wrestlers);
                  const rivalryBlocked = isRivalryIntergenderBlocked(rivalry, game.wrestlers);

                  return (
                    <article className="profile-context-row" key={rivalry.id}>
                      <strong>{rivalry.name}</strong>
                      <span>
                        {storyline.name} · {stage.name} · {relationship.name}
                        {rivalryBlocked ? " · Blocked Context" : titleRelevance ? ` · ${titleRelevance.label}` : ""}
                      </span>
                      <p>
                        {rivalryBlocked
                          ? "Legacy rivalry is visible, but booking context is blocked by the no-intergender rule."
                          : `Heat ${rivalry.heat} · Freshness ${rivalry.freshness} · ${formatRivalryStatus(rivalry.status)}`}
                      </p>
                    </article>
                  );
                })
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
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="championships" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Title Office</p>
          <h2>Championships</h2>
          <p className="lede">
            {getTitleCatalogBrand(game.brandStyle)} title scenes. Champions anchor the brand, contenders circle by division, and title matches create stakes once the bell rings.
          </p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="championship-grid" aria-label="Championships">
        {game.championships.map((championship) => {
          const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek);
          const recentHistory = getChampionshipHistory(game, championship.id);
          const titleRead = getTitleSceneRead(championship, game.wrestlers, game.currentWeek, game.rivalries);
          const pressureSnapshot = getTitleScenePressureSnapshot(championship, game);
          const gmRead = getTitleSceneGMRead(championship, scene);
          const isTagTitle = isTagChampionship(championship);
          const tagDivisionHealth = isTagTitle ? getTagDivisionHealthDiagnostics(championship, game) : [];

          return (
            <article className="championship-card" key={championship.id}>
              <div className="championship-head">
                <div>
                  <p className="eyebrow">{getChampionshipOfficeLine(championship)}</p>
                  <h3>{championship.name}</h3>
                </div>
                <strong>Prestige {championship.prestige}</strong>
              </div>
              <p className="title-scene-copy">{championship.titleSceneCopy ?? "Title scene context is derived from the current roster and resolved title history."}</p>
              <div className="spotlight-grid">
                <Metric label="Champion" value={getWrestlerNames(championship.championIds, game.wrestlers)} />
                <Metric label="Reign" value={`${getReignLength(championship, game.currentWeek)} Week${getReignLength(championship, game.currentWeek) === 1 ? "" : "s"}`} />
                <Metric label="Defenses" value={`${championship.defenses}`} />
              </div>
              <div className="title-scene-board" aria-label={`${championship.name} title scene status`}>
                <article className={`title-pressure-card pressure-${pressureSnapshot.primary.tone}`}>
                  <span>Pressure Read</span>
                  <strong>{pressureSnapshot.primary.label}</strong>
                  <small>{pressureSnapshot.primary.detail}</small>
                </article>
                <article>
                  <span>Scene Read</span>
                  <strong>{titleRead.label}</strong>
                  <small>{titleRead.detail}</small>
                </article>
                <article>
                  <span>Eligibility</span>
                  <strong>{championship.eligibleMatchScope === "tag_team" ? "Tag Scope" : `${championship.division} Singles`}</strong>
                  <small>{championship.minimumDefenseFrequencyWeeks ? `Defense rhythm: about ${championship.minimumDefenseFrequencyWeeks} weeks` : "Legacy title cadence"}</small>
                </article>
                <article>
                  <span>Title Clock</span>
                  <strong>{pressureSnapshot.weeksSinceLastTitleEvent ? `${formatWeekCount(pressureSnapshot.weeksSinceLastTitleEvent)} since title event` : "Fresh title event"}</strong>
                  <small>Window read: about {formatWeekCount(pressureSnapshot.defenseWindow)} · advisory only</small>
                </article>
              </div>
              <div className="title-pressure-deck" aria-label={`${championship.name} pressure diagnostics`}>
                {pressureSnapshot.diagnostics.map((diagnostic) => (
                  <article className={`title-pressure-chip pressure-${diagnostic.tone}`} key={diagnostic.id}>
                    <span>{diagnostic.label}</span>
                    <p>{diagnostic.detail}</p>
                  </article>
                ))}
              </div>
              {tagDivisionHealth.length ? (
                <div className="title-pressure-deck" aria-label={`${championship.name} tag division health`}>
                  {tagDivisionHealth.slice(0, 4).map((diagnostic) => (
                    <article className={`title-pressure-chip pressure-${diagnostic.tone}`} key={diagnostic.id}>
                      <span>{diagnostic.label}</span>
                      <p>{diagnostic.detail}</p>
                    </article>
                  ))}
                </div>
              ) : null}
              <div className="title-division-builder" aria-label={`${championship.name} division builder`}>
                <article>
                  <span>Champion</span>
                  <strong>{formatTitleSceneNames(scene.champions, "No champion assigned")}</strong>
                </article>
                <article>
                  <span>{isTagTitle ? "Available Challengers" : "Top Contenders"}</span>
                  <strong>{formatTitleSceneNamesWithChampionContext(scene.topContenders, game.championships, championship.id, isTagTitle ? "No challenger pair depth yet" : "No clear challengers")}</strong>
                </article>
                <article>
                  <span>{isTagTitle ? "Fresh Pair Options" : "Rising Contenders"}</span>
                  <strong>{formatTitleSceneNamesWithChampionContext(scene.risingContenders, game.championships, championship.id, isTagTitle ? "No fresh pair read yet" : "No rising lane yet")}</strong>
                </article>
                <article>
                  <span>Eligible Roster</span>
                  <strong>{scene.eligibleRoster.length} wrestler{scene.eligibleRoster.length === 1 ? "" : "s"}</strong>
                  <small>{formatTitleSceneNamesWithChampionContext(scene.eligibleRoster.slice(0, 5), game.championships, championship.id, "No eligible roster depth")}</small>
                </article>
                <article>
                  <span>Outside The Division</span>
                  <strong>{scene.outsideDivision.length} not eligible</strong>
                  <small>{formatTitleSceneNames(scene.outsideDivision.slice(0, 4), "Everyone fits this lane")}</small>
                </article>
                <article>
                  <span>GM Read</span>
                  <strong>{pressureSnapshot.producerRead}</strong>
                  <small>{gmRead}</small>
                </article>
              </div>
              <div className="history-list" aria-label={`${championship.name} recent history`}>
                <span className="history-label">Recent History</span>
                {recentHistory.length ? (
                  recentHistory.map((event) => (
                    <article className="history-event" key={event.id}>
                      <span>{formatChampionshipEventType(event.eventType)} · {formatHistoryStamp(event)}</span>
                      {getChampionshipEventPairLine(event) ? <strong>{getChampionshipEventPairLine(event)}</strong> : null}
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
  onCreateRivalry: (wrestlerAId: string, wrestlerBId: string, stakes: RivalryStakes, storylineId?: string) => void;
  onEndRivalry: (rivalryId: string) => void;
  onNavigate: (screen: GameScreen) => void;
}) {
  const [wrestlerAId, setWrestlerAId] = useState(game.wrestlers[0]?.id ?? "");
  const [wrestlerBId, setWrestlerBId] = useState(game.wrestlers[1]?.id ?? "");
  const [stakes, setStakes] = useState<RivalryStakes>("personal");
  const [storylineId, setStorylineId] = useState(getDefaultStorylineIdForStakes("personal"));
  const isDuplicate = hasDuplicateRivalry(game.rivalries, wrestlerAId, wrestlerBId);
  const rivalryBlockReason = getRivalryCreationBlockReason(wrestlerAId, wrestlerBId, game.wrestlers);
  const canCreate = wrestlerAId && wrestlerBId && wrestlerAId !== wrestlerBId && !isDuplicate && !rivalryBlockReason;
  const selectedStoryline = getRivalryStoryline({ stakes, storylineId });
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;

  function handleCreateRivalry() {
    if (!canCreate) {
      return;
    }

    onCreateRivalry(wrestlerAId, wrestlerBId, stakes, storylineId);
  }

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="rivalries" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
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
        <label>
          Storyline
          <select value={storylineId} onChange={(event) => setStorylineId(event.target.value)}>
            {safeRivalryStorylineOptions.map((storyline) => (
              <option key={storyline.id} value={storyline.id}>
                {storyline.name}
              </option>
            ))}
          </select>
        </label>
        <div className="rivalry-form-read">
          <span>{selectedStoryline.titleFit}</span>
          <strong>{selectedStoryline.description}</strong>
        </div>
        <button className="primary-action" disabled={!canCreate} onClick={handleCreateRivalry}>
          Create Rivalry
        </button>
        {isDuplicate ? <p className="form-warning">Duplicate active rivalry already exists.</p> : null}
        {rivalryBlockReason ? <p className="form-warning">{rivalryBlockReason}</p> : null}
      </section>

      <section className="rivalry-grid" aria-label="Active rivalries">
        {game.rivalries.length ? (
          game.rivalries.map((rivalry) => {
            const recentHistory = getRivalryHistory(game, rivalry.id);
            const plePayoff = hasPlePayoff(game, rivalry.id);
            const storyline = getRivalryStoryline(rivalry);
            const relationship = getRivalryRelationship(rivalry);
            const stage = getRivalryStageContext(game, rivalry);
            const titleRelevance = getRivalryTitleRelevance(rivalry, game.championships, game.wrestlers);
            const rivalryBlocked = isRivalryIntergenderBlocked(rivalry, game.wrestlers);
            const timingSnapshot = getRivalryTimingSnapshot(rivalry, game);
            const gmRead = getRivalryGMRead(rivalry, {
              hasPlePayoff: plePayoff,
              isGoHome: getCurrentCalendarWeek(game).isGoHome,
              isPle: getCurrentCalendarWeek(game).showType === "ple",
              titleRelevant: Boolean(titleRelevance && titleRelevance.label !== "Title-Friendly Story"),
            });

            return (
              <article className={`rivalry-card status-${rivalry.status}`} key={rivalry.id}>
                <div className="rivalry-head">
                  <div>
                    <p className="eyebrow">{formatRivalryStakes(rivalry.stakes)} Stakes · {stage.name}</p>
                    <h3>{rivalry.name}</h3>
                  </div>
                  <strong>{rivalryBlocked ? "Blocked Context" : timingSnapshot.primary.label}</strong>
                </div>
                <div className="rivalry-timing-board" aria-label={`${rivalry.name} timing diagnostics`}>
                  <article className={`rivalry-timing-card timing-${timingSnapshot.primary.tone}`}>
                    <span>Payoff Window</span>
                    <strong>{timingSnapshot.primary.label}</strong>
                    <p>{timingSnapshot.primary.detail}</p>
                  </article>
                  <article>
                    <span>Timing Read</span>
                    <strong>{timingSnapshot.timingRead}</strong>
                    <p>{timingSnapshot.producerRead}</p>
                  </article>
                  {timingSnapshot.diagnostics.filter((diagnostic) => diagnostic.id !== timingSnapshot.primary.id).map((diagnostic) => (
                    <article className={`rivalry-timing-card timing-${diagnostic.tone}`} key={diagnostic.id}>
                      <span>{diagnostic.label}</span>
                      <strong>{diagnostic.tone === "hot" ? "Feature" : diagnostic.tone === "watch" ? "Watch" : diagnostic.tone === "build" ? "Build" : "Hold"}</strong>
                      <p>{diagnostic.detail}</p>
                    </article>
                  ))}
                </div>
                <div className="rivalry-story-map">
                  <article>
                    <span>Storyline</span>
                    <strong>{storyline.name}</strong>
                    <p>{storyline.description}</p>
                  </article>
                  <article>
                    <span>Relationship</span>
                    <strong>{relationship.name}</strong>
                    <p>{relationship.description}</p>
                  </article>
                  <article>
                    <span>Lifecycle Stage</span>
                    <strong>{stage.name}</strong>
                    <p>{stage.description}</p>
                  </article>
                  <article>
                    <span>GM Read</span>
                    <strong>{rivalryBlocked ? "Invalid Pairing" : titleRelevance?.label ?? "Creative Direction"}</strong>
                    <p>
                      {rivalryBlocked
                        ? "Legacy rivalry kept for save safety, but it cannot be attached to booking under the current no-intergender rule."
                        : titleRelevance?.detail ?? gmRead}
                    </p>
                  </article>
                </div>
                <div className="spotlight-grid">
                  <Metric label="Participants" value={getRivalryParticipants(rivalry, game.wrestlers).map((wrestler) => wrestler.name).join(" / ")} />
                  <Metric label="Heat" value={`${rivalry.heat}`} />
                  <Metric label="Freshness" value={`${rivalry.freshness}`} />
                  <Metric label="Weeks Active" value={`${rivalry.weeksActive}`} />
                  <Metric label="Last Advanced" value={rivalry.lastAdvancedWeek ? `Week ${rivalry.lastAdvancedWeek}` : "Not On TV Yet"} />
                  <Metric label="Current Card" value={`${timingSnapshot.currentCardBeats} Beat${timingSnapshot.currentCardBeats === 1 ? "" : "s"}`} detail={`${timingSnapshot.currentCardParticipants} participant${timingSnapshot.currentCardParticipants === 1 ? "" : "s"} visible`} />
                  <Metric label="Blowoff Ideas" value={storyline.recommendedBlowoffMatches} />
                </div>
                <div className="story-guidance">
                  <span>Common Beats</span>
                  <p>{storyline.commonBeats}</p>
                  <span>Booking Note</span>
                  <p>{stage.typicalSegmentTypes}. {storyline.bookingNotes}</p>
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
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;

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
      <GameNav currentScreen="calendar" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
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
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="social" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
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
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const talentValuePressure = getTalentValuePressure(game.wrestlers);
  const venueMarketReadout = getVenueMarketContextReadout(latestReport, seasonReports);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="finance" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
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

      <section className="command-panel finance-spotlight talent-value-pressure-panel" aria-label="Talent value pressure">
        <div className="section-heading">
          <p className="eyebrow">Talent Value Pressure</p>
          <h3>Roster Value Read</h3>
        </div>
        <div className="spotlight-grid compact-grid">
          <Metric label="Premium / High-Cost" value={`${talentValuePressure.premiumCount}`} detail="Premium draw lanes" />
          <Metric label="Bargain / Rising" value={`${talentValuePressure.bargainCount}`} detail="Value-base lanes" />
          <Metric
            label="Mapped Profiles"
            value={`${talentValuePressure.mappedCount}/${talentValuePressure.totalCount}`}
            detail={talentValuePressure.missingCount ? `${talentValuePressure.missingCount} pending` : "All roster values mapped"}
          />
        </div>
        <p className="social-preview-text">{talentValuePressure.gmRead}</p>
      </section>

      {latestReport ? (
        <section className="finance-report-card">
          <div className="section-heading">
            <p className="eyebrow">
              Latest Report · {getShowTypeLabel(latestReport.showType)} · {getFinanceReportModelLabel(latestReport)}
            </p>
            <h3>{latestReport.showName}</h3>
          </div>
          <p className="social-preview-text">
            <strong>{venueMarketReadout.label}</strong> · {venueMarketReadout.read}
          </p>
          <div className="spotlight-grid">
            <Metric label="Attendance" value={latestReport.attendance.toLocaleString()} />
            <Metric label="Revenue" value={formatMoney(getFinanceGrossRevenue(latestReport))} />
            <Metric label="Costs" value={formatMoney(getFinanceTotalExpenses(latestReport))} />
            <Metric label="Profit/Loss" value={formatMoney(latestReport.profitLoss)} />
            <Metric label="Ending Money" value={formatMoney(latestReport.endingMoney)} />
            <Metric label="Show Score" value={`${latestReport.showScore}`} />
          </div>
          <div className="finance-breakdown-grid" aria-label="Latest report breakdown">
            <FinanceBreakdownList title="Revenue" items={getFinanceRevenueBreakdown(latestReport)} />
            <FinanceBreakdownList title="Expenses" items={getFinanceExpenseBreakdown(latestReport)} />
          </div>
          <div className="finance-notes">
            {latestReport.notes.map((note, index) => (
              <p key={`${note}-${index}`}>{note}</p>
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
                ? `${formatMoney(getFinanceGrossRevenue(bestRevenueReport))} revenue in Week ${bestRevenueReport.weekNumber}.`
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
                <span>{getFinanceReportModelLabel(report)}</span>
                <strong>{formatMoney(report.profitLoss)}</strong>
              </div>
            </article>
          ))
        ) : null}
      </section>
    </main>
  );
}

function FinanceBreakdownList({
  items,
  title,
}: {
  items: NonNullable<FinanceReport["revenueBreakdown"]>;
  title: string;
}) {
  return (
    <article className="finance-breakdown-panel">
      <span>{title}</span>
      {items.map((item) => (
        <div className="finance-breakdown-row" key={item.id}>
          <strong>{item.label}</strong>
          <em>{formatMoney(item.amount)}</em>
        </div>
      ))}
    </article>
  );
}

function PostShowCauseLedger({ compact = false, sections }: { compact?: boolean; sections: CauseLedgerSection[] }) {
  if (!sections.length) {
    return (
      <section className="cause-ledger-panel compact" aria-label="Post-show cause ledger">
        <div className="section-heading">
          <p className="eyebrow">Cause Ledger</p>
          <h3>Limited Record</h3>
        </div>
        <p className="cause-ledger-empty">This result has limited legacy data, so there is no deeper cause ledger beyond the visible recap.</p>
      </section>
    );
  }

  const visibleSections = compact ? sections.slice(0, 4) : sections;

  return (
    <section className={`cause-ledger-panel ${compact ? "compact" : ""}`} aria-label="Post-show cause ledger">
      <div className="section-heading">
        <p className="eyebrow">Post-Show Cause Ledger</p>
        <h3>{compact ? "Why The Week Moved" : "Why It Happened"}</h3>
      </div>
      <div className="cause-ledger-grid">
        {visibleSections.map((section) => (
          <article className="cause-ledger-section" key={section.id}>
            <span>{section.label}</span>
            <div>
              {section.items.map((item) => (
                <div className={`cause-ledger-item item-${item.tone}`} key={item.id}>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultsScreen({
  game,
  canContinueWeekReview,
  onContinueWeekReview,
  onNavigate,
  result,
}: {
  game: GameState;
  canContinueWeekReview: boolean;
  onContinueWeekReview: () => void;
  result: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const bestSegment = getBestSegment(result);
  const financeReport = getFinanceReportForResult(game, result);
  const causeLedger = buildPostShowCauseLedger(game, result, financeReport);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="results" hasResults hasWeekReview={canContinueWeekReview} onNavigate={onNavigate} />
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
        <button className="primary-action" onClick={onContinueWeekReview} disabled={!canContinueWeekReview}>
          {canContinueWeekReview ? "Continue to Week Review" : "Week Review Complete"}
        </button>
      </section>

      <section className="status-grid" aria-label="Show highlights">
        <Metric label="Show Score" value={`${result.totalScore}`} detail={`Grade ${getShowGrade(result.totalScore)}`} />
        <Metric label="Best Segment" value={`${bestSegment.score}`} detail={getSegmentResultParticipantsLabel(bestSegment, game.wrestlers)} />
        <Metric
          label="Runtime"
          value={result.actualRuntimeMinutes !== undefined ? `${result.actualRuntimeMinutes} min` : "Legacy"}
          detail={result.plannedRuntimeMinutes !== undefined ? `Planned ${result.plannedRuntimeMinutes} min${result.broadcastOverrunMinutes ? ` · +${result.broadcastOverrunMinutes} over` : ""}` : "No runtime record"}
        />
        <Metric label="Best Type" value={bestSegment.type} detail={getSegmentResultParticipantsLabel(bestSegment, game.wrestlers)} />
      </section>

      <PostShowCauseLedger sections={causeLedger} />

      {result.broadcastOverrunNotes?.length ? (
        <section className="broadcast-overrun-fallout" aria-label="Broadcast overrun fallout">
          <div className="section-heading">
            <p className="eyebrow">Broadcast Timing</p>
            <h3>{result.broadcastOverrunLevel === "major" ? "Major Overrun" : result.broadcastOverrunLevel === "moderate" ? "Overrun Pressure" : "Minor Overrun"}</h3>
          </div>
          {result.broadcastOverrunNotes.map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
          ))}
        </section>
      ) : null}

      {result.titleNotes?.length ? (
        <section className="title-fallout" aria-label="Title fallout">
          <div className="section-heading">
            <p className="eyebrow">Title Fallout</p>
            <h3>Championship Stakes</h3>
          </div>
          {result.titleNotes.map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
          ))}
        </section>
      ) : null}

      {result.rivalryNotes?.length ? (
        <section className="story-fallout" aria-label="Rivalry fallout">
          <div className="section-heading">
            <p className="eyebrow">Story Fallout</p>
            <h3>Rivalry Movement</h3>
          </div>
          {result.rivalryNotes.map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
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
              <h3>{getSegmentResultParticipantsLabel(segment, game.wrestlers)}</h3>
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
              {getResolvedSegmentStipulationLabel(segment) ? <p className="title-note">Match stipulation: {getResolvedSegmentStipulationLabel(segment)}</p> : null}
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
  const causeLedger = buildPostShowCauseLedger(game, result, financeReport);
  const buzzPreview = game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week).slice(-3).reverse();
  const bookedIds = [...new Set(result.segmentResults.flatMap((segment) => segment.participantIds))];
  const injuryRiskWrestlers = game.wrestlers.filter(
    (wrestler) => bookedIds.includes(wrestler.id) && getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );
  const rivalryIds = [...new Set(result.segmentResults.map((segment) => segment.rivalryId).filter((id): id is string => Boolean(id)))];
  const reviewedRivalries = rivalryIds
    .map((id) => game.rivalries.find((rivalry) => rivalry.id === id))
    .filter((rivalry): rivalry is Rivalry => Boolean(rivalry));
  const financeMarketContext = getVenueMarketContextReadout(financeReport, getSeasonFinanceReports(game));
  const titleHistoryEvents = result.titleHistoryEvents ?? [];
  const rivalryHistoryEvents = result.rivalryHistoryEvents ?? [];
  const nextWeek = game.calendar.find((week) => week.weekNumber === result.week + 1);
  const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= result.week + 1 && !week.completed);
  const weeksUntilNextPle = nextPle ? Math.max(0, nextPle.weekNumber - result.week) : 0;
  const brandPulseSnapshot = getBrandPulseSnapshot(game, result);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="weekReview" hasResults hasWeekReview={true} onNavigate={onNavigate} />
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
        <Metric label="Best Segment" value={`${bestSegment.score}`} detail={getSegmentResultParticipantsLabel(bestSegment, game.wrestlers)} />
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
          {result.broadcastOverrunNotes.map((note, index) => (
            <p key={`${note}-${index}`}>{note}</p>
          ))}
        </section>
      ) : null}

      {result.segmentResults.some((segment) => getResolvedSegmentStipulationLabel(segment)) ? (
        <section className="title-fallout" aria-label="Week review stipulations">
          <div className="section-heading">
            <p className="eyebrow">Presentation Context</p>
            <h3>Match Stipulations</h3>
          </div>
          <div className="history-list">
            {result.segmentResults
              .map((segment, index) => ({ segment, index, label: getResolvedSegmentStipulationLabel(segment) }))
              .filter((entry) => entry.label)
              .map((entry) => (
                <article className="history-event" key={`${entry.segment.segmentId}-${entry.index}`}>
                  <span>Segment {entry.index + 1} · {entry.segment.type}</span>
                  <p>
                    {entry.label} for {getSegmentResultParticipantsLabel(entry.segment, game.wrestlers)}
                  </p>
                </article>
              ))}
          </div>
        </section>
      ) : null}

      <PostShowCauseLedger sections={causeLedger} compact />

      {brandPulseSnapshot ? <BrandPulsePanel compact snapshot={brandPulseSnapshot} /> : null}

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
                {getChampionshipEventPairLine(event) ? <strong>{getChampionshipEventPairLine(event)}</strong> : null}
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
            <Metric label="Revenue" value={formatMoney(getFinanceGrossRevenue(financeReport))} />
            <Metric label="Costs" value={formatMoney(getFinanceTotalExpenses(financeReport))} />
            <Metric label="Attendance" value={financeReport.attendance.toLocaleString()} />
            <Metric label="Ending Money" value={formatMoney(financeReport.endingMoney)} />
            <Metric label="Venue / Market" value={financeMarketContext.label} detail={financeMarketContext.summary} />
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
  const sortedByMomentum = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum);
  const sortedByFatigue = [...game.wrestlers].sort((a, b) => b.fatigue - a.fatigue);
  const topMomentum = sortedByMomentum[0];
  const mostFatigued = sortedByFatigue[0];
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
  const topChampions = game.championships.filter((championship) => championship.championIds.length > 0);
  const strongestChampionshipName = biggestTitleChange?.championshipName ?? mostDefendedChampionship?.championship.name ?? "No title movement";
  const legacyProfitDeltaLabel = seasonProfitLoss >= 0 ? "Positive" : "Negative";
  const legacyFinancialRead =
    seasonReports.length > 0
      ? `Season finance held at ${seasonReports.length} closed shows with a ${legacyProfitDeltaLabel} cash movement of ${formatMoney(seasonProfitLoss)}.`
      : "No full-season finance ledger was captured yet.";

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

      <section className="command-panel season-legacy-snapshot" aria-label="Legacy snapshot">
        <div className="section-heading">
          <p className="eyebrow">Legacy Snapshot</p>
          <h3>Season Memory Card</h3>
        </div>
        <p className="lede legacy-snapshot-copy">No mechanics attached. This is a read-only GM ledger of what defined the year.</p>
        <div className="spotlight-grid">
          <Metric label="Best Show" value={bestShow ? bestShow.showName : "No show data"} detail={bestShow ? `${bestShow.totalScore} (${getShowGrade(bestShow.totalScore)})` : "Run a full season to lock first place"} />
          <Metric label="Final Money" value={formatMoney(game.money)} detail={legacyFinancialRead} />
          <Metric label="Season Delta" value={formatMoney(seasonProfitLoss)} detail={`From ${formatMoney(game.seasonStartingMoney)}`} />
          <Metric
            label="Top Momentum"
            value={topMomentum ? topMomentum.name : "No momentum profile"}
            detail={topMomentum ? `${topMomentum.momentum} momentum` : "No readable momentum snapshots for this save"}
          />
          <Metric
            label="Most Defended Title"
            value={mostDefendedChampionship ? mostDefendedChampionship.championship.name : "No title defenses"}
            detail={mostDefendedChampionship ? `${mostDefendedChampionship.count} this season` : "No successful defenses recorded"}
          />
          <Metric
            label="Biggest Title Change"
            value={strongestChampionshipName}
            detail={biggestTitleChange ? formatHistoryStamp(biggestTitleChange) : "No title changes recorded"}
          />
        </div>
        <div className="spotlight-grid">
          <Metric
            label="Rivalry Highlight"
            value={hottestRivalryStory ? hottestRivalryStory.name : hottestRivalry ? hottestRivalry.name : "No rivalry events"}
            detail={hottestRivalryStory ? `${hottestRivalryStory.note}` : hottestRivalry ? `Heat ${hottestRivalry.heat}` : "No rivalry movement this season"}
          />
          <Metric
            label="PLE Payoff"
            value={notablePlePayoff ? notablePlePayoff.rivalryName : "None"}
            detail={
              notablePlePayoff
                ? `${notablePlePayoff.showName}${notablePlePayoff.showType ? ` · ${getShowTypeLabel(notablePlePayoff.showType)}` : ""}`
                : "No PLE payoff recorded"
            }
          />
          <Metric
            label="Champion Snapshot"
            value={topChampions.length ? topChampions.length.toString() : "0"}
            detail={topChampions.length ? `Active title holders: ${topChampions.map((championship) => `${championship.name} (${getWrestlerNames(championship.championIds, game.wrestlers)})`).join(" · ")}` : "No current title holders listed"}
          />
        </div>
      </section>

      <section className="status-grid" aria-label="Season review">
        <Metric label="Starting Money" value={formatMoney(game.seasonStartingMoney)} />
        <Metric label="Final Money" value={formatMoney(game.money)} />
        <Metric label="Season P/L" value={formatMoney(seasonProfitLoss)} />
        <Metric label="Best Show" value={bestShow ? bestShow.showName : "No Shows"} detail={bestShow ? `${bestShow.totalScore} (${getShowGrade(bestShow.totalScore)})` : undefined} />
      </section>

      <section className="status-grid" aria-label="Season roster review">
        <Metric label="Top Momentum" value={topMomentum ? topMomentum.name : "No Momentum Data"} detail={topMomentum ? `${topMomentum.momentum}` : "No momentum snapshots available"} />
        <Metric label="Most Fatigued" value={mostFatigued ? mostFatigued.name : "No Fatigue Data"} detail={mostFatigued ? `${mostFatigued.fatigue}` : "No fatigue snapshots available"} />
        <Metric
          label="Best Revenue"
          value={bestRevenueReport ? bestRevenueReport.showName : "No Report"}
          detail={bestRevenueReport ? formatMoney(getFinanceGrossRevenue(bestRevenueReport)) : undefined}
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
                {getChampionshipEventPairLine(biggestTitleChange) ? <strong>{getChampionshipEventPairLine(biggestTitleChange)}</strong> : null}
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
  rosterAffiliations,
  wrestler,
}: {
  currentWeek: number;
  onOpenProfile: (wrestlerId: string) => void;
  rosterAffiliations: WrestlerAffiliation[];
  wrestler: Wrestler;
}) {
  const status = getWrestlerStatus(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, currentWeek);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, currentWeek);
  const affiliations = rosterAffiliations.filter((affiliation) => affiliation.memberWrestlerIds.includes(wrestler.id));
  const valueProfile = getWrestlerValueProfile(wrestler);

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
        <span className={`value-tier-chip ${valueProfile.contextMode === "missing" ? "value-tier-chip-missing" : ""}`}>
          {valueProfile.valueTierLabel}
        </span>
        {pressureTags.length ? pressureTags.map((tag) => <span key={tag}>{tag}</span>) : <span>Balanced</span>}
      </div>
      {affiliations.length ? (
        <div className="affiliation-strip compact-affiliation-strip" aria-label={`${wrestler.name} affiliation context`}>
          {affiliations.slice(0, 2).map((affiliation) => (
            <span key={affiliation.id}>
              {affiliation.name} · {formatAffiliationKind(affiliation.kind)}
            </span>
          ))}
        </div>
      ) : null}
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
  game,
  onSetSegmentChampionship,
  segment,
  wrestlers,
}: {
  championships: Championship[];
  game: GameState;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  if (segment.type !== "Match" && segment.type !== "Contract Signing" && segment.type !== "Open Challenge") {
    return null;
  }

  const isTagMatch = segment.type === "Match" && segment.segmentCatalogId === "M020";

  if (isTagMatch) {
    const participantsLabel = getSegmentParticipantsLabel(segment, wrestlers);
    const tagChampionships = championships.filter(isTagChampionship);
    const eligibleChampionships = tagChampionships.filter((championship) => canSegmentAttachChampionship(segment, championship, wrestlers));
    const selectedChampionship = championships.find((championship) => championship.id === segment.championshipId);
    const selectedTagChampionship = selectedChampionship && isTagChampionship(selectedChampionship) ? selectedChampionship : undefined;
    const selectedSides = selectedTagChampionship ? getTagTitleSides(segment, selectedTagChampionship) : undefined;
    const tagHealthChampionship = selectedTagChampionship ?? eligibleChampionships[0];
    const tagHealthDiagnostics = tagHealthChampionship ? getTagDivisionHealthDiagnostics(tagHealthChampionship, game) : [];
    const tagTitleStatus = (() => {
      if (!tagChampionships.length) {
        return "No tag championship is assigned to this brand yet.";
      }

      if (segment.participantIds.length !== 4) {
        return "Needs exactly four unique wrestlers before a tag title defense can be sanctioned.";
      }

      if (!isValidSegment(segment, wrestlers)) {
        return getSegmentValidationWarning(segment, wrestlers);
      }

      if (eligibleChampionships.length) {
        const championship = selectedTagChampionship && eligibleChampionships.some((title) => title.id === selectedTagChampionship.id) ? selectedTagChampionship : eligibleChampionships[0];
        const sides = getTagTitleSides(segment, championship);
        return sides
          ? `Sanctioned tag title defense available: ${getWrestlerNames(sides.championSideIds, wrestlers)} can defend against ${getWrestlerNames(sides.challengerSideIds, wrestlers)}.`
          : "Tag title defense available when the champion pair is together on one side.";
      }

      return `Tag title blocked: keep ${tagChampionships.map((championship) => getWrestlerNames(championship.championIds, wrestlers)).join(" / ")} together on Team A or Team B.`;
    })();

    return (
      <div className="title-match-control">
        <div>
          <span>Title Match</span>
          <strong>
            {selectedTagChampionship
              ? `Selected title: ${selectedTagChampionship.name}. Champions: ${getWrestlerNames(selectedTagChampionship.championIds, wrestlers)}.`
              : eligibleChampionships.length
                ? "Tag championship defense is available."
                : "M020 can become a tag title match only when the champion pair is on one side."}
          </strong>
          <small>{participantsLabel}</small>
        </div>
        <div className="title-defense-state">
          <span>Title Controls</span>
          <strong>{tagTitleStatus}</strong>
        </div>
        {eligibleChampionships.length || segment.championshipId ? (
          <div className="title-buttons">
            <button className={!segment.championshipId ? "active-filter" : ""} onClick={() => onSetSegmentChampionship(segment.id, "")}>
              Non-Title
            </button>
            {eligibleChampionships.map((championship) => (
              <button
                className={segment.championshipId === championship.id ? "active-filter" : ""}
                key={championship.id}
                onClick={() => onSetSegmentChampionship(segment.id, championship.id)}
              >
                {championship.name} · Tag Defense
              </button>
            ))}
          </div>
        ) : null}
        {selectedSides ? (
          <div className="title-eligible-readout" aria-label="Eligible tag title challengers">
            <article>
              <span>Champion Side</span>
              <strong>{getWrestlerNames(selectedSides.championSideIds, wrestlers)}</strong>
              <small>Challenger side: {getWrestlerNames(selectedSides.challengerSideIds, wrestlers)}</small>
            </article>
          </div>
        ) : null}
        {tagHealthDiagnostics.length ? (
          <div className="title-eligible-readout" aria-label="Tag division health">
            {tagHealthDiagnostics.slice(0, 3).map((diagnostic) => (
              <article key={`${diagnostic.id}-${tagHealthChampionship?.id}`}>
                <span>{diagnostic.label}</span>
                <small>{diagnostic.detail}</small>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const eligibleChampionships = championships.filter((championship) => canSegmentAttachChampionship(segment, championship, wrestlers));
  const selectedChampionship = championships.find((championship) => championship.id === segment.championshipId);
  const isTitleMatch = segment.type === "Match";
  const singlesChampionships = championships.filter(isSinglesChampionship);
  const completeMatch = isTitleMatch && segment.participantIds.length === 2;
  const sameDivisionTitleOptions = completeMatch ? singlesChampionships.filter((championship) => doSegmentParticipantsFitChampionship(segment, championship, wrestlers)) : [];
  const selectedParticipantNames = getWrestlerNames(segment.participantIds, wrestlers);
  const titleDefenseOptions = eligibleChampionships.filter((championship) => canSegmentContestChampionship(segment, championship, wrestlers));
  const controlLabel = isTitleMatch ? "Title Match" : "Title Context";
  const clearLabel = isTitleMatch ? "Non-Title" : "No Title Context";
  const emptyMessage =
    segment.type === "Open Challenge"
      ? "Select a champion as issuer to frame the challenge around their title scene."
      : segment.type === "Contract Signing"
        ? "Select a current singles champion and same-division talent to attach championship context."
        : "Singles title option opens when a match includes a current champion and same-division challenger.";
  const titleDefenseStatus = (() => {
    if (!isTitleMatch) {
      return selectedChampionship ? "Championship context attached. No title change can happen in this segment format." : emptyMessage;
    }

    if (!segment.participantIds.length) {
      return "Select competitors to see whether this can become a sanctioned title defense.";
    }

    if (!completeMatch) {
      return "Needs exactly two wrestlers before the title office can sanction a singles defense.";
    }

    if (titleDefenseOptions.length) {
      const championship = selectedChampionship && titleDefenseOptions.some((title) => title.id === selectedChampionship.id) ? selectedChampionship : titleDefenseOptions[0];
      const challengers = segment.participantIds.filter((id) => !championship.championIds.includes(id));
      return `Sanctioned title defense available: ${getWrestlerNames(championship.championIds, wrestlers)} can defend against ${getWrestlerNames(challengers, wrestlers)}.`;
    }

    if (sameDivisionTitleOptions.length) {
      return `Title-adjacent, not a title match: ${selectedParticipantNames} fit the division, but no current champion is in this match.`;
    }

    return "Title blocked: these competitors do not fit the same current title division.";
  })();
  const titleContextLine = selectedChampionship
    ? `${selectedChampionship.brand ?? "Brand"} · ${selectedChampionship.division} · ${selectedChampionship.titleLevel ?? "Title"}`
    : "Title office checks champion, participants, and division before sanctioning.";
  const titleSceneSummaries = eligibleChampionships.map((championship) => ({
    championship,
    contenders: getTitleDivisionScene(championship, wrestlers).topContenders,
    challengers: segment.participantIds.filter((id) => !championship.championIds.includes(id)),
    pressure: getTitleScenePressureSnapshot(championship, game),
  }));
  const titleAdjacentSummaries = isTitleMatch && !eligibleChampionships.length ? sameDivisionTitleOptions : [];

  return (
    <div className="title-match-control">
      <div>
        <span>{controlLabel}</span>
        <strong>
          {selectedChampionship
            ? isTitleMatch
              ? `Selected title: ${selectedChampionship.name}. Champion: ${getWrestlerNames(selectedChampionship.championIds, wrestlers)}.`
              : `${selectedChampionship.name} in the frame. Champion: ${getWrestlerNames(selectedChampionship.championIds, wrestlers)}.`
            : eligibleChampionships.length
              ? isTitleMatch
                ? "Sanctioned title defense is available."
                : "Attach championship context without putting the title at stake."
              : emptyMessage}
        </strong>
        <small>{titleContextLine}</small>
      </div>
      <div className="title-defense-state">
        <span>{isTitleMatch ? "Defense Status" : "Title Scene Status"}</span>
        <strong>{titleDefenseStatus}</strong>
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
              {championship.name} · {isTitleMatch ? "Sanctioned Defense" : championship.division}
            </button>
          ))}
        </div>
      ) : null}
      {titleSceneSummaries.length ? (
        <div className="title-eligible-readout" aria-label="Eligible title challengers">
          {titleSceneSummaries.map(({ championship, contenders, challengers, pressure }) => (
            <article key={championship.id}>
              <span>{isTitleMatch ? "Sanctioned title defense" : championship.name}</span>
              <strong>{championship.name}</strong>
              <small>
                Champion: {getWrestlerNames(championship.championIds, wrestlers)}
                {isTitleMatch && challengers.length ? ` · Eligible challenger: ${getWrestlerNames(challengers, wrestlers)}` : ""}
              </small>
              <small>
                Pressure: {pressure.primary.label} · {pressure.divisionHealth}
              </small>
              <small>Title scene: {formatTitleSceneNamesWithChampionContext(contenders, championships, championship.id, "No clear same-division challengers")}</small>
            </article>
          ))}
        </div>
      ) : null}
      {titleAdjacentSummaries.length ? (
        <div className="title-eligible-readout" aria-label="Title-adjacent contender context">
          {titleAdjacentSummaries.map((championship) => {
            const pressure = getTitleScenePressureSnapshot(championship, game);

            return (
            <article key={championship.id}>
              <span>Title-adjacent, not a defense</span>
              <strong>{championship.name}</strong>
              <small>Needs champion: {getWrestlerNames(championship.championIds, wrestlers)}</small>
              <small>
                Pressure: {pressure.primary.label} · {pressure.divisionHealth}
              </small>
            </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RivalryControl({
  championships,
  game,
  onSetSegmentRivalry,
  rivalries,
  segment,
  wrestlers,
}: {
  championships: Championship[];
  game: GameState;
  onSetSegmentRivalry: (segmentId: string, rivalryId: string) => void;
  rivalries: Rivalry[];
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  const eligibleRivalries = rivalries.filter((rivalry) => canSegmentAttachRivalry(segment, rivalry, wrestlers));
  const selectedRivalry = rivalries.find((rivalry) => rivalry.id === segment.rivalryId);
  const selectedRivalryBlocked = Boolean(selectedRivalry && isRivalryIntergenderBlocked(selectedRivalry, wrestlers));
  const selectedStoryline = selectedRivalry ? getRivalryStoryline(selectedRivalry) : undefined;
  const selectedRelationship = selectedRivalry ? getRivalryRelationship(selectedRivalry) : undefined;
  const selectedStage = selectedRivalry ? deriveRivalryStage(selectedRivalry) : undefined;
  const selectedTitleRelevance = selectedRivalry ? getRivalryTitleRelevance(selectedRivalry, championships, wrestlers) : undefined;
  const selectedTiming = selectedRivalry ? getRivalryTimingSnapshot(selectedRivalry, game) : undefined;
  const selectedRivalryMatchBlocked = Boolean(
    selectedRivalry && segment.type === "Match" && hasIntergenderMatchParticipants({ ...segment, participantIds: selectedRivalry.participantIds }, wrestlers),
  );

  return (
    <div className="rivalry-control">
      <div>
        <span>Rivalry Context</span>
        <strong>
          {selectedRivalry
            ? selectedRivalryBlocked
              ? `${selectedRivalry.name} is blocked by the no-intergender rivalry rule. Clear it or choose a valid rivalry.`
              : selectedRivalryMatchBlocked
                ? `${selectedRivalry.name} attached for context. This rivalry works better as a promo or angle under current match rules.`
                : `${selectedRivalry.name} attached. ${selectedTiming?.primary.label ?? selectedStage?.name ?? formatRivalryStatus(selectedRivalry.status)}.`
            : eligibleRivalries.length
              ? "Attach an active rivalry when this segment advances a story."
              : "Select a rivalry participant to attach story context."}
        </strong>
        {selectedRivalry && selectedStoryline && selectedStage && selectedRelationship ? (
          <small>
            {selectedRivalryBlocked
              ? "Legacy context is visible for save safety, but it cannot be used for booking."
              : `${selectedRelationship.name} · ${selectedTiming?.timingRead ?? selectedStage.notes}. ${selectedTitleRelevance ? selectedTitleRelevance.detail : selectedTiming?.producerRead ?? selectedStoryline.commonBeats}`}
          </small>
        ) : null}
      </div>
      {eligibleRivalries.length || selectedRivalryBlocked ? (
        <div className="title-buttons">
          <button className={!segment.rivalryId ? "active-filter" : ""} onClick={() => onSetSegmentRivalry(segment.id, "")}>
            No Rivalry
          </button>
          {eligibleRivalries.map((rivalry) => (
            <button className={segment.rivalryId === rivalry.id ? "active-filter" : ""} key={rivalry.id} onClick={() => onSetSegmentRivalry(segment.id, rivalry.id)}>
              <span>{getRivalryTimingSnapshot(rivalry, game).primary.label}</span>
              <strong>{rivalry.name}</strong>
              <small>{getRivalryStoryline(rivalry).name} · {getRivalryTimingSnapshot(rivalry, game).timingRead}</small>
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
  hasWeekReview,
  onNavigate,
}: {
  currentScreen: GameScreen;
  hasResults: boolean;
  hasWeekReview?: boolean;
  onNavigate: (screen: GameScreen) => void;
}) {
  const showWeekReview = hasWeekReview ?? hasResults;

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
      {showWeekReview ? (
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
        <strong>{getSegmentParticipantsLabel(segment, wrestlers)}</strong>
      </div>
      <div>
        <span>Production Note</span>
        <strong>{warnings.length ? warnings[0] : "Ready for the rundown."}</strong>
      </div>
      <div>
        <span>Presentation</span>
        <strong>{getSegmentStipulationLabel(segment)}</strong>
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
