import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GameNav, Header, Metric } from "./components/gameShell";
import { formatMoney } from "./game/formatters";
import {
  MAX_SAVE_SLOTS,
  createSaveRecord,
  deleteSaveRecord,
  loadSaveRecords,
  renameSaveRecord,
  updateSaveRecord,
} from "./gameStorage";
import { advanceGameWeek, startNextSeason } from "./game/advanceWeek";
import { generateExternalAiSocialCommentary } from "./game/aiCommentary";
import { getRosterAffiliations, getWrestlerAffiliations } from "./game/affiliationCatalog";
import { getFinancePressureLabel } from "./game/finance";
import { financeModelSummaryByRole, getRosterFinanceValueForWrestler } from "./game/financeCatalog";
import {
  getMarketSnapshot,
  getRivalMarketEvents,
  proposePlayerTrade,
  releasePlayerWrestler,
  signPlayerFreeAgent,
} from "./game/market";
import {
  getCpuDraftPreviewSnapshot,
  getCpuResultsFeedSnapshot,
  getRatingsBattleSnapshot,
  type CpuDraftPreviewSnapshot,
  type CpuResultsFeedSnapshot,
  type RatingsBattleSnapshot,
} from "./game/cpuRivalLoop";
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
import { getWrestlerPortraitSrc } from "./game/wrestlerPortraits";
import {
  buildBroadcastFalloutSnapshot,
  buildPostShowCauseLedger,
  getLivingWorldPressureSnapshot,
  getPleBuildPressureSnapshot,
  getWeeklyDecisionPressureSnapshot,
  getWeekReviewHandoffSnapshot,
  getWeekReviewOfficeSnapshot,
  type BroadcastFalloutSnapshot,
  type CauseLedgerSection,
  type LivingWorldPressureSnapshot,
  type PleBuildPressureSnapshot,
  type WeeklyDecisionPressureSnapshot,
  type WeekReviewHandoffSnapshot,
  type WeekReviewOfficeSnapshot,
} from "./game/gameContextReads";
import {
  getInjuryStatusLabel,
  getRosterPressureTags,
  getTopOverusedWrestler,
  getTopUnderusedWrestler,
  getWeeksSinceLastBooked,
  type RosterPressureTag,
} from "./game/rosterContextReads";
import {
  formatChampionshipEventType,
  formatRivalryEventType,
  formatRivalryStatus,
  getChampionshipHistory,
  getChampionshipHistoryAgeWeeks,
  getRivalryHistory,
  getRivalryHistoryAgeWeeks,
  hasPlePayoff,
} from "./game/storyContextReads";
import {
  applyRivalryCatalogDefaults,
  deriveRivalryStage,
  getDefaultStorylineIdForStakes,
  getRivalryGMRead,
  getRivalryRelationship,
  getRivalryStoryline,
  safeRivalryStorylineOptions,
} from "./game/rivalryCatalog";
import {
  createNewGame,
  createRivalBrandUniverse,
  createRivalGMAssignments,
  defaultCareer,
  draftPool,
  getDraftedRosterValue,
  getStartingBudgetAmount,
} from "./game/seed";
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
  RivalryStructure,
  RivalryStakes,
  RivalGMAssignment,
  Screen,
  Segment,
  SegmentResult,
  SegmentType,
  SeasonArchiveSummary,
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
import { MarketScreen } from "./screens/MarketScreen";

type RosterSort = "popularity" | "momentum" | "fatigue" | "morale";
type RosterFilter = "all" | "mens" | "womens" | "champions" | "injured" | "hot" | "tired" | "morale" | "underused";
type RosterStatus = "Hot" | "Tired" | "Frustrated" | "Steady";
type ProfilePanelId = "stats" | "gmRead" | "contractValue" | "affiliations" | "showHistory" | "championships" | "rivalries" | "social";
type FinancePanelId = "talentValue" | "latestReport" | "seasonReads" | "financeHistory";
type SocialFilter = "All" | "Fan Reaction" | "Dirt Sheets" | "Analyst Takes" | "Title Scene" | "Rivalries";
type IwcMoodTone = SocialPost["tone"];
type SetupStep = "contract" | "gm" | "brand" | "rules" | "draft";
type DraftSort = "rank" | "starPower" | "popularity" | "momentum" | "ringSkill" | "promoSkill" | "fatigue";
type DraftReservePressure = "Healthy" | "Tight" | "Over Budget";
type RivalryCreateInput = {
  participantIds: string[];
  structure: RivalryStructure;
  stakes: RivalryStakes;
  storylineId?: string;
};

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

type FinanceOfficeRead = {
  headline: string;
  detail: string;
  focusLabel: string;
  pressureLabel: PressureLabel;
  items: {
    label: string;
    value: string;
    detail: string;
  }[];
};

type FreeAgentWatchEntry = {
  profile: WrestlerValueProfile;
  wrestler: Wrestler;
};

type IwcMoodItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

type IwcMoodSummary = {
  headline: string;
  detail: string;
  weekLabel: string;
  tone: IwcMoodTone;
  items: IwcMoodItem[];
};

type GMRead = {
  usefulness: string;
  risk: string;
  need: string;
};

type LockerRoomTone = "hot" | "steady" | "watch";

type LockerRoomPulseItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: LockerRoomTone;
};

type LockerRoomPulse = {
  headline: string;
  detail: string;
  items: LockerRoomPulseItem[];
};

type WrestlerLockerRoomRead = {
  headline: string;
  detail: string;
  note: string;
  tone: LockerRoomTone;
};

type WrestlerIdentitySnapshot = {
  labels: string[];
  roleRead: string;
  usageRead: string;
  bookingUseRead: string;
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

type TitleSceneTalentRead = {
  wrestler: Wrestler;
  labels: string[];
  detail: string;
};

type ChampionshipSceneDeskRead = {
  headline: string;
  detail: string;
  championReads: TitleSceneTalentRead[];
  contenderReads: TitleSceneTalentRead[];
  recentActivityRead: string;
  pleWindowRead: string;
};

type TitleSceneIdentityRead = {
  headline: string;
  championIdentity: string;
  divisionRead: string;
  healthLabel: string;
  healthDetail: string;
  heatLabel: string;
  heatDetail: string;
  depthLabel: string;
  depthDetail: string;
  tone: TitleScenePressureTone;
};

type ChampionshipsOfficeRead = {
  headline: string;
  detail: string;
  anchorTitle: string;
  anchorDetail: string;
  attentionTitle: string;
  attentionDetail: string;
  prestigeTitle: string;
  prestigeDetail: string;
  tone: TitleScenePressureTone;
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

type RivalryParticipantRead = {
  wrestler: Wrestler;
  labels: string[];
  detail: string;
};

type RivalryStoryRoomRead = {
  headline: string;
  detail: string;
};

type RivalryCreativeDeskItem = {
  label: string;
  value: string;
  detail: string;
  tone: RivalryTimingTone;
};

type RivalryCreativeDeskRead = {
  headline: string;
  detail: string;
  focusLabel: string;
  tone: RivalryTimingTone;
  items: RivalryCreativeDeskItem[];
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













type QaHarnessMode = "runtime" | "legacy-runtime" | "title-defense-runtime" | "title-change-runtime";

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

function getBroadcastThemeForBrandStyle(brandStyle: BrandStyle) {
  if (brandStyle === "SmackDown") {
    return "blue";
  }

  if (brandStyle === "NXT") {
    return "gold";
  }

  if (brandStyle === "AEW") {
    return "fight";
  }

  return "red";
}

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
  const rosterValue = getDraftedRosterValue(wrestlers);
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

  return `Opening reserve after roster value is carried into Week 1. Draft picks still do not restrict availability in this build.${missingValueNote}`;
}

function getRivalUniverseRead(rivalBrands: RivalBrandState[]) {
  if (!rivalBrands.length) {
    return "No rival brand chairs are assigned for this career frame.";
  }

  const rosterCount = rivalBrands.reduce((sum, brand) => sum + brand.rosterWrestlerIds.length, 0);
  const activityCount = rivalBrands.reduce((sum, brand) => sum + brand.activityHistory.length, 0);

  return `${rivalBrands.length} rival brand chair${rivalBrands.length === 1 ? "" : "s"} active in the ratings race. ${rosterCount} CPU roster claim${rosterCount === 1 ? "" : "s"} and ${activityCount} activity beat${activityCount === 1 ? "" : "s"} are logged as competitive context.`;
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
        detail: `${rivalBrand.assignedGMName}'s desk is now part of the resolved ratings race; pressure stays contextual, not a finance penalty.`,
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
    market: "Market Desk",
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
      note: "This card is packed. If live timing drifts, the final slot could feel rushed.",
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

function getBookingCardStatus(segmentCount: number, invalidSegments: number, readiness: ReturnType<typeof getShowReadiness>) {
  if (segmentCount === 0) {
    return { label: "Empty Card", tone: "empty" };
  }

  if (readiness.canRun) {
    return { label: "Ready To Run", tone: "ready" };
  }

  if (invalidSegments > 0 || readiness.tone === "blocked" || readiness.tone === "overloaded") {
    return { label: "Needs Attention", tone: "blocked" };
  }

  return { label: "In Production", tone: "building" };
}

type BookingBoardSlot = {
  id: string;
  isBuildable: boolean;
  segment?: Segment;
  slotNumber: number;
};

function getBookingBoardSlots(currentShow: Segment[]): BookingBoardSlot[] {
  const visibleSlotCount = Math.min(maxBookingSegments, Math.max(3, currentShow.length + (currentShow.length < maxBookingSegments ? 1 : 0)));

  return Array.from({ length: visibleSlotCount }, (_, index) => {
    const segment = currentShow[index];
    const slotNumber = index + 1;

    return {
      id: segment?.id ?? `empty-slot-${slotNumber}`,
      isBuildable: !segment && index === currentShow.length,
      segment,
      slotNumber,
    };
  });
}

function getBookingSegmentBoardFlags(segment: Segment, game: GameState) {
  const flags: string[] = [];
  const championship = segment.championshipId ? game.championships.find((title) => title.id === segment.championshipId) : undefined;
  const rivalry = segment.rivalryId ? game.rivalries.find((item) => item.id === segment.rivalryId) : undefined;
  const majorStars = getSegmentParticipants(segment, game.wrestlers).filter(isMajorEventStar);

  if (championship) {
    flags.push(canSegmentContestChampionship(segment, championship, game.wrestlers) ? "Title" : "Title Context");
  }

  if (rivalry) {
    flags.push("Rivalry");
  }

  if (majorStars.length) {
    flags.push("Star");
  }

  if (segment.type === "Open Challenge") {
    flags.push("Open Challenge");
  }

  if (!isValidSegment(segment, game.wrestlers)) {
    flags.push("Needs Fix");
  }

  return flags.length ? flags : [getSegmentRuntime(segment)];
}

function getBookingWrestlerRiskReads(wrestler: Wrestler, bookedCount: number) {
  const reads: string[] = [];

  if (wrestler.injuryStatus === "major") {
    reads.push("major injury unavailable");
  } else if (wrestler.injuryStatus === "minor") {
    reads.push("minor injury");
  }

  if (wrestler.fatigue >= 75) {
    reads.push(`high fatigue ${wrestler.fatigue}`);
  } else if (wrestler.fatigue >= 60) {
    reads.push(`fatigue ${wrestler.fatigue}`);
  }

  if ((wrestler.consecutiveWeeksBooked ?? 0) >= 3) {
    reads.push(`${wrestler.consecutiveWeeksBooked} week booking streak`);
  }

  if (wrestler.morale <= 45) {
    reads.push(`morale ${wrestler.morale}`);
  }

  if (bookedCount > 1) {
    reads.push(`${bookedCount} segments tonight`);
  }

  return reads;
}

function getBookingProducerNote({
  missingMajorStars,
  readiness,
  riskCount,
  segmentCount,
  titleContextCount,
  rivalrySegmentCount,
}: {
  missingMajorStars: Wrestler[];
  readiness: ReturnType<typeof getShowReadiness>;
  riskCount: number;
  segmentCount: number;
  titleContextCount: number;
  rivalrySegmentCount: number;
}) {
  if (segmentCount === 0) {
    return "Production has no card slots filled yet. Add segments first; the existing validation path still controls when the show can run.";
  }

  if (!readiness.canRun) {
    return readiness.note;
  }

  const coverageReads = [
    titleContextCount ? "title context is on the board" : "no title context is attached",
    rivalrySegmentCount ? "rivalry beats are represented" : "no rivalry beat is attached",
  ];
  const riskRead = riskCount ? `${riskCount} current workload flag${riskCount === 1 ? "" : "s"} ${riskCount === 1 ? "needs" : "need"} a producer look` : "no current-card workload flags are surfacing";
  const missingRead = missingMajorStars.length ? `Top acts off card: ${missingMajorStars.slice(0, 3).map((wrestler) => wrestler.name).join(" / ")}.` : "";

  return `Ready state comes from existing validation: ${coverageReads.join(", ")} and ${riskRead}. ${missingRead}`.trim();
}

function formatRivalryCount(count: number) {
  return `${count} active ${count === 1 ? "rivalry" : "rivalries"}`;
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
        ? `${formatRivalryCount(representedRivalries.length)} on card. Still off card: ${unresolvedRivalries
            .slice(0, 2)
            .map((rivalry) => rivalry.name)
            .join(" / ")}${unresolvedRivalries.length > 2 ? " / more" : ""}.`
        : `${formatRivalryCount(representedRivalries.length)} represented on the card.`,
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

function getInjuryDetail(wrestler: Wrestler) {
  if (wrestler.injuryStatus === "healthy") {
    return "Available";
  }

  const weeks = wrestler.injuryWeeksRemaining;
  return `${weeks} week${weeks === 1 ? "" : "s"} remaining${wrestler.injuryDescription ? ` · ${wrestler.injuryDescription}` : ""}`;
}

function getWrestlerStatus(wrestler: Wrestler): RosterStatus {
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

function getWrestlerOverall(wrestler: Wrestler) {
  return Math.max(
    40,
    Math.min(
      99,
      Math.round(
        wrestler.popularity * 0.24 +
          wrestler.momentum * 0.22 +
          wrestler.ringSkill * 0.18 +
          wrestler.promoSkill * 0.16 +
          wrestler.morale * 0.12 +
          (100 - wrestler.fatigue) * 0.08,
      ),
    ),
  );
}

function getWrestlerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function WrestlerPortrait({ className, wrestler }: { className: string; wrestler: Pick<Wrestler, "id" | "name"> }) {
  const [imageFailed, setImageFailed] = useState(false);
  const portraitSrc = imageFailed ? undefined : getWrestlerPortraitSrc(wrestler.id);

  useEffect(() => {
    setImageFailed(false);
  }, [wrestler.id]);

  return (
    <span className={`${className} wrestler-portrait ${portraitSrc ? "has-portrait" : "missing-portrait"}`} aria-hidden="true">
      {portraitSrc ? (
        <img alt="" draggable={false} onError={() => setImageFailed(true)} src={portraitSrc} />
      ) : (
        <span>{getWrestlerInitials(wrestler.name)}</span>
      )}
    </span>
  );
}

function getMoraleEmoji(morale: number) {
  if (morale >= 80) return "😄";
  if (morale >= 65) return "🙂";
  if (morale >= 46) return "😐";
  return "😟";
}

function getMoraleTone(morale: number) {
  if (morale >= 80) return "hot";
  if (morale >= 65) return "steady";
  if (morale >= 46) return "watch";
  return "risk";
}

function getRosterAlignmentLabel(wrestler: Wrestler) {
  const alignment = wrestler.alignment?.trim();
  return alignment && alignment.toLowerCase() !== "unknown" ? alignment : "Alignment TBD";
}

function getWrestlerTitleLine(wrestlerId: string, championships: Championship[]) {
  const titles = championships.filter((championship) => championship.championIds.includes(wrestlerId));
  return titles.map((championship) => getChampionshipAcronym(championship.name)).join(" / ");
}

function getChampionshipAcronym(championshipName: string) {
  const words = championshipName.match(/[A-Za-z]+/g) ?? [];
  const acronym = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  return acronym || championshipName;
}

function getWrestlerMatchRecord(wrestlerId: string, showHistory: ShowResult[]) {
  return showHistory.reduce(
    (record, show) => {
      show.segmentResults.forEach((segment) => {
        if (segment.isNoContest || !segment.winnerId) {
          return;
        }

        const participantIds = new Set(segment.participantIds);
        if (segment.resolvedOpponentId) {
          participantIds.add(segment.resolvedOpponentId);
        }

        if (!participantIds.has(wrestlerId)) {
          return;
        }

        if (segment.segmentCatalogId === "M020" && segment.participantIds.length >= 4) {
          const teamAIds = segment.participantIds.slice(0, 2);
          const teamBIds = segment.participantIds.slice(2, 4);
          const winnerSideIds = teamAIds.includes(segment.winnerId) ? teamAIds : teamBIds;
          if (winnerSideIds.includes(wrestlerId)) {
            record.wins += 1;
          } else {
            record.losses += 1;
          }
          return;
        }

        if (segment.winnerId === wrestlerId) {
          record.wins += 1;
        } else {
          record.losses += 1;
        }
      });

      return record;
    },
    { wins: 0, losses: 0 },
  );
}

function getAverageRosterMorale(wrestlers: Wrestler[]) {
  return Math.round(wrestlers.reduce((sum, wrestler) => sum + wrestler.morale, 0) / Math.max(1, wrestlers.length));
}

function getShowMoraleDelta(result: ShowResult) {
  const fallout = result.lockerRoomFallout;
  const moraleMoves = [...(fallout?.moraleDrops ?? []), ...(fallout?.moraleBoosts ?? [])];

  return moraleMoves.reduce((sum, item) => sum + (item.moraleChange ?? 0), 0);
}

function getRosterMoraleTrend(game: GameState) {
  const rosterCount = Math.max(1, game.wrestlers.length);
  const currentAverage = getAverageRosterMorale(game.wrestlers);
  const seasonResults = game.showHistory
    .filter((result) => result.seasonNumber === game.seasonNumber)
    .sort((a, b) => a.week - b.week);
  const openingAverage = seasonResults.reduce((average, result) => average - getShowMoraleDelta(result) / rosterCount, currentAverage);
  const points = [{ label: "Open", value: Math.round(openingAverage) }];
  let runningAverage = openingAverage;

  seasonResults.forEach((result) => {
    runningAverage += getShowMoraleDelta(result) / rosterCount;
    points.push({ label: `W${result.week}`, value: Math.round(runningAverage) });
  });

  if (!seasonResults.some((result) => result.week === game.currentWeek)) {
    points.push({ label: `W${game.currentWeek}`, value: currentAverage });
  }

  return points.slice(-6);
}

function getMoraleTrendSvgPoints(points: { label: string; value: number }[]) {
  if (points.length <= 1) {
    const value = points[0]?.value ?? 0;
    return `50,${34 - (Math.max(0, Math.min(100, value)) / 100) * 32}`;
  }

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 34 - (Math.max(0, Math.min(100, point.value)) / 100) * 32;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function getWrestlerDivisionLabel(wrestler: Wrestler) {
  const division = wrestler.division?.toLowerCase();

  if (division === "mens") {
    return "Men";
  }

  if (division === "womens") {
    return "Women";
  }

  return wrestler.division ?? "Open";
}

function getRosterFilterMatch(filter: RosterFilter, wrestler: Wrestler, game: GameState) {
  const status = getWrestlerStatus(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const division = wrestler.division?.toLowerCase();

  if (filter === "mens") {
    return division === "mens";
  }

  if (filter === "womens") {
    return division === "womens";
  }

  if (filter === "champions") {
    return getWrestlerChampionships(wrestler.id, game.championships).length > 0;
  }

  if (filter === "injured") {
    return wrestler.injuryStatus !== "healthy";
  }

  if (filter === "hot") {
    return status === "Hot";
  }

  if (filter === "tired") {
    return status === "Tired" || pressureTags.includes("Injury Risk") || pressureTags.includes("Overused");
  }

  if (filter === "morale") {
    return pressureTags.includes("Morale Risk") || status === "Frustrated";
  }

  if (filter === "underused") {
    return pressureTags.includes("Underused");
  }

  return true;
}

function getRosterFilterLabel(filter: RosterFilter) {
  const labels: Record<RosterFilter, string> = {
    all: "All",
    mens: "Men",
    womens: "Women",
    champions: "Champions",
    injured: "Injured",
    hot: "Hot",
    tired: "Tired",
    morale: "Morale Risk",
    underused: "Underused",
  };

  return labels[filter];
}

function getRosterSortLabel(sort: RosterSort) {
  const labels: Record<RosterSort, string> = {
    popularity: "Popularity",
    momentum: "Momentum",
    fatigue: "Fatigue",
    morale: "Morale",
  };

  return labels[sort];
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

function getDraftValueCounts(wrestlers: Wrestler[], getValue: (wrestler: Wrestler) => string | undefined) {
  return wrestlers.reduce<Record<string, number>>((counts, wrestler) => {
    const value = getDraftTag(getValue(wrestler));
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function getMostCommonDraftValue(counts: Record<string, number>, fallback = "Balanced") {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
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

function buildSanctionedTitleMatchSegment(game: GameState, sourceSegment: Segment, championshipId: string) {
  const championship = game.championships.find((title) => title.id === championshipId);

  if (!championship || sourceSegment.type !== "Match") {
    return undefined;
  }

  const isTagTitle = isTagChampionship(championship);
  const option = getCatalogOptionById(isTagTitle ? "M020" : "M001") ?? getDefaultCatalogOption("Match");

  if (!option) {
    return undefined;
  }

  const makeCandidate = (participantIds: string[]): Segment => ({
    ...sourceSegment,
    type: "Match",
    participantIds,
    championshipId: undefined,
    rivalryId: undefined,
    segmentCatalogId: option.id,
    segmentDisplayName: option.label,
    durationMinutes: option.defaultDurationMinutes,
    participantMin: option.minParticipants,
    participantMax: option.maxParticipants,
  });
  const getAttachedCandidate = (candidate: Segment) => {
    if (!isValidSegment(candidate, game.wrestlers) || !canSegmentAttachChampionship(candidate, championship, game.wrestlers)) {
      return undefined;
    }

    return { ...candidate, championshipId: championship.id };
  };
  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
  const challengerPool = scene.eligibleRoster.length ? scene.eligibleRoster : scene.topContenders;

  if (!isTagTitle) {
    for (const contender of challengerPool) {
      const candidate = makeCandidate([...championship.championIds, contender.id]);
      const attachedCandidate = getAttachedCandidate(candidate);

      if (attachedCandidate) {
        return attachedCandidate;
      }
    }

    return undefined;
  }

  for (let firstIndex = 0; firstIndex < challengerPool.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < challengerPool.length; secondIndex += 1) {
      const contenderPairIds = [challengerPool[firstIndex].id, challengerPool[secondIndex].id];
      const candidate = makeCandidate([...championship.championIds, ...contenderPairIds]);
      const attachedCandidate = getAttachedCandidate(candidate);

      if (attachedCandidate) {
        return attachedCandidate;
      }
    }
  }

  return undefined;
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

function getTitleDivisionScene(championship: Championship, wrestlers: Wrestler[], rivalries: Rivalry[] = [], currentWeek = 1, championships: Championship[] = []) {
  const championIds = new Set(championship.championIds);
  const otherChampionIds = new Set(
    championships.filter((title) => title.id !== championship.id).flatMap((title) => title.championIds),
  );
  const champions = championship.championIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
  const manualContenders = (championship.contenderIds ?? [])
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler && !championIds.has(wrestler.id) && wrestlerFitsChampionshipDivision(wrestler, championship)));
  const manualContenderIds = new Set(manualContenders.map((wrestler) => wrestler.id));
  const eligibleRoster = wrestlers
    .filter((wrestler) => !championIds.has(wrestler.id))
    .filter((wrestler) => !otherChampionIds.has(wrestler.id))
    .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship))
    .sort((a, b) => getTitleSceneTalentScore(b, championship, rivalries) - getTitleSceneTalentScore(a, championship, rivalries));
  const derivedTopContenders = eligibleRoster.filter((wrestler) => !manualContenderIds.has(wrestler.id)).slice(0, Math.max(0, 3 - manualContenders.length));
  const topContenders = championship.contenderIds ? manualContenders : [...manualContenders, ...derivedTopContenders].slice(0, 3);
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

  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
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
    label: scene.champions.length >= 2 ? "Champion Pair Active" : "Champion Pair Needed",
    detail:
      scene.champions.length >= 2
        ? championPairActive
          ? `The champions, ${getWrestlerNames(championship.championIds, game.wrestlers)}, are active enough to make a credible defense.`
          : "One or both champions are currently quiet, so momentum checks are advisory only."
        : "No champion pair is assigned yet, so the tag title needs a GM assignment before it can be defended.",
    tone: scene.champions.length >= 2 ? (championPairActive ? "steady" : "watch") : "build",
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
  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
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
      label: scene.champions.length < 2 ? "Champion Pair Needed" : contenders.length >= 2 ? "Tag Title Ready" : "Needs Challengers",
      detail:
        scene.champions.length < 2
          ? "Assign a champion pair before this title can become a valid M020 defense."
          : contenders.length >= 2
          ? "The title can be defended in a valid M020 tag match with the champions together on one side."
          : "The current roster does not have two eligible challengers outside the champion pair.",
      tone: scene.champions.length < 2 ? "build" : contenders.length >= 2 ? "steady" : "build",
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

function getTitleSceneTalentRead(wrestler: Wrestler, game: GameState, currentChampionshipId: string): TitleSceneTalentRead {
  const identity = getWrestlerIdentityContext(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const otherTitleLabels = getOtherChampionshipHolderLabels(wrestler, game.championships, currentChampionshipId);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const labels = [
    wrestler.momentum >= 70 ? "Hot" : null,
    wrestler.momentum < 45 ? "Cold" : null,
    wrestler.injuryStatus === "major" ? "Unavailable" : null,
    wrestler.injuryStatus === "minor" ? "Working Hurt" : null,
    pressureTags.includes("Overused") ? "Overused" : null,
    pressureTags.includes("Underused") ? "Underused" : null,
    weeksSinceLastBooked >= 2 ? "Missing TV" : null,
    ...otherTitleLabels,
  ].filter((label): label is string => Boolean(label));
  const detail =
    wrestler.injuryStatus === "major"
      ? `${wrestler.name} is blocked by a major injury.`
      : pressureTags.includes("Overused")
        ? `${wrestler.name} carries ${wrestler.fatigue} fatigue and ${wrestler.consecutiveWeeksBooked ?? 0} straight week${(wrestler.consecutiveWeeksBooked ?? 0) === 1 ? "" : "s"} booked.`
        : pressureTags.includes("Underused")
          ? `${wrestler.name} has been off TV for ${formatWeekCount(weeksSinceLastBooked)}.`
          : otherTitleLabels.length
            ? `${wrestler.name} also carries ${otherTitleLabels.join(" / ")} context.`
            : `${identity.role} · ${identity.wrestlingStyle} · ${identity.promoStyle}.`;

  return {
    wrestler,
    labels: [...new Set(labels)].slice(0, 4),
    detail,
  };
}

function getChampionshipSceneDeskRead(
  championship: Championship,
  game: GameState,
  scene: ReturnType<typeof getTitleDivisionScene>,
  pressureSnapshot: TitleScenePressureSnapshot,
): ChampionshipSceneDeskRead {
  const latestTitleEvent = getChampionshipHistory(game, championship.id, 1)[0];
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const championReads = scene.champions.map((wrestler) => getTitleSceneTalentRead(wrestler, game, championship.id));
  const contenderReads = scene.topContenders.slice(0, isTagChampionship(championship) ? 4 : 3).map((wrestler) => getTitleSceneTalentRead(wrestler, game, championship.id));
  const championRivalries = game.rivalries.filter(
    (rivalry) => rivalry.status !== "stale" && rivalry.participantIds.some((id) => championship.championIds.includes(id)),
  );
  const recentActivityRead = latestTitleEvent
    ? `${formatChampionshipEventType(latestTitleEvent.eventType)} at ${formatHistoryStamp(latestTitleEvent)}.`
    : `No resolved title event yet; title clock reads ${formatWeekCount(pressureSnapshot.weeksSinceLastTitleEvent)}.`;
  const pleWindowRead =
    weeksUntilPle === 0
      ? `${getCurrentCalendarWeek(game).showName} is a PLE week. Title defense pressure is visible, not automatic.`
      : nextPle && weeksUntilPle <= 2
        ? `${nextPle.showName} is ${formatWeekCount(weeksUntilPle)} away, so major-defense context is close if the scene supports it.`
        : nextPle
          ? `${nextPle.showName} is ${formatWeekCount(weeksUntilPle)} away; TV can keep the title scene warm.`
          : "No remaining PLE window this season.";
  const championContext = championRivalries.length
    ? `${championRivalries[0].name} gives the champion active story context.`
    : championReads.length
      ? `${championReads.map((read) => read.wrestler.name).join(" / ")} currently anchors the scene without a title-specific active rivalry.`
      : "No champion resolves from the current roster data.";
  const contenderPressure = contenderReads.length
    ? `${contenderReads.length} front-line contender${contenderReads.length === 1 ? "" : "s"} are visible: ${contenderReads.map((read) => read.wrestler.name).join(" / ")}.`
    : "No front-line contender read is available for this title.";
  const headline = `${pressureSnapshot.primary.label} · ${pressureSnapshot.divisionHealth}`;
  const detail = `${championContext} ${contenderPressure} ${pressureSnapshot.producerRead}`;

  return {
    headline,
    detail,
    championReads,
    contenderReads,
    recentActivityRead,
    pleWindowRead,
  };
}

function getChampionIdentityRead(championship: Championship, scene: ReturnType<typeof getTitleDivisionScene>, game: GameState) {
  if (!scene.champions.length) {
    return "No champion resolves from the current roster data.";
  }

  const championNames = formatTitleSceneNames(scene.champions, "No champion assigned");
  const titleRivalries = getTitleRivalries(championship, game.wrestlers, game.rivalries);
  const championMomentum = Math.round(scene.champions.reduce((sum, wrestler) => sum + wrestler.momentum, 0) / Math.max(1, scene.champions.length));
  const championPopularity = Math.round(scene.champions.reduce((sum, wrestler) => sum + wrestler.popularity, 0) / Math.max(1, scene.champions.length));
  const championRisk = scene.champions.some((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"));

  if (championRisk) {
    return `${championNames} anchors the belt, but medical/fatigue pressure is visible around the reign.`;
  }

  if (titleRivalries.length) {
    return `${championNames} carries active title-story context through ${titleRivalries[0].name}.`;
  }

  if (championMomentum >= 75 || championPopularity >= 78) {
    return `${championNames} reads like a prestige centerpiece at ${championMomentum} momentum and ${championPopularity} popularity.`;
  }

  return `${championNames} gives the division a steady champion identity without forcing a defense.`;
}

function getTitleSceneIdentityRead(
  championship: Championship,
  game: GameState,
  scene: ReturnType<typeof getTitleDivisionScene>,
  pressureSnapshot: TitleScenePressureSnapshot,
): TitleSceneIdentityRead {
  const titleRivalries = getTitleRivalries(championship, game.wrestlers, game.rivalries);
  const hotContenders = scene.eligibleRoster.filter((wrestler) => wrestler.momentum >= 75);
  const championRisk = scene.champions.some((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"));
  const contenderDepth = scene.eligibleRoster.length;
  const isTagTitleScene = isTagChampionship(championship);
  const latestHistory = getChampionshipHistory(game, championship.id, 1)[0];
  const recentActivity = latestHistory
    ? `${formatChampionshipEventType(latestHistory.eventType)} at ${formatHistoryStamp(latestHistory)}.`
    : `No resolved title event yet; the title clock reads ${formatWeekCount(pressureSnapshot.weeksSinceLastTitleEvent)}.`;
  const healthLabel =
    pressureSnapshot.primary.tone === "build"
      ? "Needs Attention"
      : pressureSnapshot.primary.tone === "watch"
        ? "Office Watch"
        : pressureSnapshot.primary.tone === "hot"
          ? "Hot Scene"
          : "Stable Scene";
  const heatLabel = titleRivalries.length ? "Story Heat" : hotContenders.length ? "Contender Heat" : "Quiet Heat";
  const depthLabel =
    isTagTitleScene
      ? contenderDepth >= 4
        ? "Pair Depth"
        : contenderDepth >= 2
          ? "Playable Tag Lane"
          : "Thin Tag Lane"
      : contenderDepth >= 7
        ? "Deep Division"
        : contenderDepth >= 3
          ? "Credible Chase"
          : "Thin Division";
  const headline =
    isTagTitleScene
      ? contenderDepth >= 2
        ? "Tag Division Identity"
        : "Tag Division Needs Shape"
      : titleRivalries.length
        ? "Title Story Centerpiece"
        : championRisk
          ? "Protected Champion Scene"
          : hotContenders.length >= 2
            ? "Hot Contender Room"
            : contenderDepth < 3
              ? "Thin Title Lane"
              : "Prestige Division Lane";
  const divisionRead =
    titleRivalries.length
      ? `${titleRivalries[0].name} gives this belt an active story lane.`
      : hotContenders.length
        ? `${hotContenders.slice(0, 2).map((wrestler) => wrestler.name).join(" / ")} are carrying visible momentum near the title.`
        : contenderDepth
          ? `${formatTitleSceneNames(scene.topContenders, "The contender room")} keeps the belt readable without a forced title beat.`
          : "No eligible contender room is visible from the current roster.";

  return {
    headline,
    championIdentity: getChampionIdentityRead(championship, scene, game),
    divisionRead,
    healthLabel,
    healthDetail: `${pressureSnapshot.primary.detail} ${recentActivity}`,
    heatLabel,
    heatDetail: titleRivalries.length
      ? `Active title-story heat: ${titleRivalries.map((rivalry) => rivalry.name).slice(0, 2).join(" / ")}.`
      : hotContenders.length
        ? `${hotContenders.length} hot contender${hotContenders.length === 1 ? "" : "s"} in the current eligible pool.`
        : "No active title rivalry or hot contender is currently carrying the scene.",
    depthLabel,
    depthDetail: `${contenderDepth} eligible challenger${contenderDepth === 1 ? "" : "s"} outside the champion slot; ${scene.risingContenders.length} rising lane${scene.risingContenders.length === 1 ? "" : "s"} visible.`,
    tone: pressureSnapshot.primary.tone,
  };
}

function getTitleOfficeRank(tone: TitleScenePressureTone) {
  if (tone === "hot") {
    return 4;
  }

  if (tone === "steady") {
    return 3;
  }

  if (tone === "watch") {
    return 2;
  }

  return 1;
}

function getChampionshipOfficeRead(game: GameState): ChampionshipsOfficeRead {
  const snapshots = game.championships.map((championship) => {
    const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
    const pressureSnapshot = getTitleScenePressureSnapshot(championship, game);
    const identity = getTitleSceneIdentityRead(championship, game, scene, pressureSnapshot);
    const championRisk = scene.champions.some((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"));
    const titleRivalryCount = getTitleRivalries(championship, game.wrestlers, game.rivalries).length;
    const heatScore = championship.prestige + getTitleOfficeRank(identity.tone) * 18 + titleRivalryCount * 16 + scene.topContenders.filter((wrestler) => wrestler.momentum >= 75).length * 8;
    const attentionScore =
      (identity.tone === "build" ? 70 : identity.tone === "watch" ? 45 : 0) +
      (scene.eligibleRoster.length < (isTagChampionship(championship) ? 2 : 3) ? 35 : 0) +
      (championRisk ? 25 : 0) +
      pressureSnapshot.weeksSinceLastTitleEvent * 2;

    return {
      attentionScore,
      championship,
      heatScore,
      identity,
      pressureSnapshot,
      scene,
    };
  });
  const anchor = [...snapshots].sort((a, b) => b.heatScore - a.heatScore || b.championship.prestige - a.championship.prestige)[0];
  const attention = [...snapshots].sort((a, b) => b.attentionScore - a.attentionScore || b.championship.prestige - a.championship.prestige)[0];
  const prestige = [...snapshots].sort((a, b) => b.championship.prestige - a.championship.prestige)[0];
  const watchCount = snapshots.filter((snapshot) => snapshot.identity.tone === "watch" || snapshot.identity.tone === "build").length;

  return {
    headline: watchCount ? "Title Committee Has Active Decisions" : "Title Committee Has Stable Prestige",
    detail: "Read-only championship office context from current champions, contender rooms, active title stories, and resolved title history. No rankings or title mechanics are added here.",
    anchorTitle: anchor?.championship.name ?? "No championship",
    anchorDetail: anchor ? `${anchor.identity.headline}. ${anchor.identity.divisionRead}` : "No championship data is available.",
    attentionTitle: attention?.championship.name ?? "No championship",
    attentionDetail: attention ? `${attention.identity.healthLabel}. ${attention.identity.healthDetail}` : "No title scene needs attention.",
    prestigeTitle: prestige?.championship.name ?? "No championship",
    prestigeDetail: prestige ? `Prestige ${prestige.championship.prestige} with ${formatTitleSceneNames(prestige.scene.champions, "no champion assigned")}.` : "No prestige read is available.",
    tone: watchCount ? "watch" : anchor?.identity.tone ?? "steady",
  };
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
      const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
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

function getRivalryCreativeDeskRead(game: GameState): RivalryCreativeDeskRead {
  const rivalrySnapshots = getRivalryTimingSnapshots(game);

  if (!rivalrySnapshots.length) {
    return {
      headline: "Creative Room Is Waiting",
      detail: "No active rivalries are on the board. Start a two-wrestler story when the roster has a conflict worth turning into TV.",
      focusLabel: "No live program",
      tone: "build",
      items: [
        {
          label: "Story Count",
          value: "0 active",
          detail: "The next rivalry starts from the create desk below.",
          tone: "build",
        },
        {
          label: "TV Visibility",
          value: "No beats",
          detail: "No current rundown segments are attached to rivalries.",
          tone: "steady",
        },
        {
          label: "Latest Beat",
          value: "None logged",
          detail: "Rivalry history will fill in after stories hit TV.",
          tone: "steady",
        },
      ],
    };
  }

  const activeRivalryIds = new Set(rivalrySnapshots.map(({ rivalry }) => rivalry.id));
  const focus = rivalrySnapshots[0];
  const hotCount = rivalrySnapshots.filter(({ rivalry }) => rivalry.heat >= 75 && rivalry.freshness >= 50).length;
  const coolingCount = rivalrySnapshots.filter(({ rivalry, snapshot }) =>
    rivalry.status === "cooling" ||
    rivalry.status === "stale" ||
    rivalry.freshness <= 35 ||
    snapshot.diagnostics.some((diagnostic) => diagnostic.id === "cooling-off"),
  ).length;
  const payoffCount = rivalrySnapshots.filter(({ snapshot }) =>
    snapshot.diagnostics.some((diagnostic) => diagnostic.id === "ple-ready" || diagnostic.id === "payoff-overdue"),
  ).length;
  const needsTvCount = rivalrySnapshots.filter(({ snapshot }) =>
    snapshot.diagnostics.some((diagnostic) => diagnostic.id === "needs-tv"),
  ).length;
  const onCardCount = rivalrySnapshots.filter(({ snapshot }) => snapshot.currentCardBeats > 0).length;
  const latestHistory = [...(game.rivalryHistory ?? [])]
    .filter((event) => activeRivalryIds.has(event.rivalryId))
    .sort((a, b) => b.seasonNumber - a.seasonNumber || b.weekNumber - a.weekNumber)[0];
  const latestBeatValue = latestHistory ? `${latestHistory.rivalryName}: ${formatRivalryEventType(latestHistory.eventType)}` : "No beat logged";
  const latestBeatDetail = latestHistory
    ? `${formatHistoryStamp(latestHistory)}. ${latestHistory.note}`
    : "The room has live rivalries, but no rivalry history has been recorded yet.";

  const headline =
    payoffCount > 0
      ? "Payoff Pressure Is On The Board"
      : hotCount > 0
        ? "Story Room Has Live Heat"
        : coolingCount > 0
          ? "Creative Needs A Fresh Beat"
          : needsTvCount > 0
            ? "Stories Need TV Visibility"
            : "Programs Are Building At TV Pace";
  const detail = `${rivalrySnapshots.length} active program${rivalrySnapshots.length === 1 ? "" : "s"}. ${focus.rivalry.name} is the loudest room read: ${focus.snapshot.primary.label}. This is advisory context from current heat, freshness, history, card usage, and PLE timing.`;

  return {
    headline,
    detail,
    focusLabel: `${focus.rivalry.name} · ${focus.snapshot.primary.label}`,
    tone: focus.snapshot.primary.tone,
    items: [
      {
        label: "Feud Temperature",
        value: `${hotCount} hot / ${coolingCount} cooling`,
        detail: hotCount
          ? "At least one story has enough heat and freshness to feel like a live wire."
          : coolingCount
            ? "The board has stories losing heat or freshness."
            : "The room is steady without a clear red-hot program.",
        tone: hotCount ? "hot" : coolingCount ? "build" : "steady",
      },
      {
        label: "Payoff Watch",
        value: payoffCount ? `${payoffCount} pressure read${payoffCount === 1 ? "" : "s"}` : "No urgent payoff",
        detail: payoffCount
          ? "One or more stories are close to a major-event or overdue payoff window, but nothing is forced."
          : "No active story is demanding a payoff from current timing reads.",
        tone: payoffCount ? "watch" : "steady",
      },
      {
        label: "TV Visibility",
        value: onCardCount ? `${onCardCount} on current card` : `${needsTvCount} need TV`,
        detail: onCardCount
          ? "At least one rivalry already has a beat attached to tonight's rundown."
          : needsTvCount
            ? "Some stories need screen time before the audience loses the thread."
            : "No rivalry beat is currently attached, but timing pressure is stable.",
        tone: onCardCount ? "steady" : needsTvCount ? "watch" : "build",
      },
      {
        label: "Latest Story Beat",
        value: latestBeatValue,
        detail: latestBeatDetail,
        tone: latestHistory ? "steady" : "build",
      },
    ],
  };
}

function getRivalryParticipantReads(rivalry: Rivalry, game: GameState): RivalryParticipantRead[] {
  return getRivalryParticipants(rivalry, game.wrestlers).map((wrestler) => {
    const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
    const championships = getWrestlerChampionships(wrestler.id, game.championships);
    const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
    const labels = [
      championships.length ? "Champion" : null,
      wrestler.injuryStatus === "major" ? "Unavailable" : null,
      wrestler.injuryStatus === "minor" ? "Working Hurt" : null,
      pressureTags.includes("Overused") ? "Overused" : null,
      pressureTags.includes("Underused") ? "Underused" : null,
      weeksSinceLastBooked >= 2 ? "Missing TV" : null,
      wrestler.momentum >= 65 ? "Hot" : null,
      wrestler.morale <= 45 ? "Morale Risk" : null,
    ].filter((label): label is string => Boolean(label));
    const detail =
      wrestler.injuryStatus === "major"
        ? `${wrestler.name} is blocked by a major injury.`
        : championships.length
          ? `${wrestler.name} carries ${championships.map((championship) => championship.name).join(" / ")} context into this feud.`
          : pressureTags.includes("Overused")
            ? `${wrestler.name} has ${wrestler.fatigue} fatigue and ${wrestler.consecutiveWeeksBooked ?? 0} straight week${(wrestler.consecutiveWeeksBooked ?? 0) === 1 ? "" : "s"} booked.`
            : pressureTags.includes("Underused")
              ? `${wrestler.name} has been off TV for ${formatWeekCount(weeksSinceLastBooked)}.`
              : wrestler.lastBookedWeek
                ? `${wrestler.name} last appeared in Week ${wrestler.lastBookedWeek}.`
                : `${wrestler.name} has no recorded TV appearance this season.`;

    return {
      wrestler,
      labels: [...new Set(labels)].slice(0, 4),
      detail,
    };
  });
}

function getRivalryStoryRoomRead(
  rivalry: Rivalry,
  timingSnapshot: RivalryTimingSnapshot,
  participantReads: RivalryParticipantRead[],
  latestHistory?: RivalryHistoryEvent,
): RivalryStoryRoomRead {
  const participantPressure = participantReads.flatMap((read) => read.labels).filter((label) => label !== "Hot");
  const latestActivity = latestHistory
    ? `${formatRivalryEventType(latestHistory.eventType)} at ${formatHistoryStamp(latestHistory)}`
    : "No recorded rivalry beat yet";
  const temperature =
    rivalry.heat >= 75 && rivalry.freshness >= 50
      ? "Hot story"
      : rivalry.freshness <= 35 || rivalry.heat < 45
        ? "Cooling story"
        : rivalry.heat >= 55
          ? "Building story"
          : "Quiet story";
  const headline = `${temperature} · ${timingSnapshot.primary.label}`;
  const detail = participantPressure.length
    ? `${latestActivity}. Participant context: ${[...new Set(participantPressure)].slice(0, 4).join(" / ")}. ${timingSnapshot.producerRead}`
    : `${latestActivity}. ${timingSnapshot.producerRead}`;

  return { headline, detail };
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
  if (segment.type === "Open Challenge" || isRivalryIntergenderBlocked(rivalry, wrestlers)) {
    return false;
  }

  const structure = getRivalryStructure(rivalry);
  const range = getSegmentParticipantRange(segment);
  const hasOverlap = !segment.participantIds.length || segment.participantIds.some((id) => rivalry.participantIds.includes(id));

  if (!hasOverlap) {
    return false;
  }

  if (structure === "singles") {
    return range.max >= 2;
  }

  if (structure === "tag_team") {
    return (segment.type === "Match" && segment.segmentCatalogId === "M020") || (segment.type !== "Match" && range.max >= 4);
  }

  const option = getSegmentCatalogOption(segment);
  return range.max >= 3 && (segment.type !== "Contract Signing" || Boolean(option?.rivalryRelevant));
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

function getRivalryStructure(rivalry: Rivalry): RivalryStructure {
  return rivalry.structure ?? "singles";
}

function formatRivalryStructure(structure: RivalryStructure) {
  switch (structure) {
    case "tag_team":
      return "Tag 2v2";
    case "multi_person":
      return "Multi";
    default:
      return "Singles";
  }
}

function getRivalryStructureParticipantRange(structure: RivalryStructure) {
  if (structure === "tag_team") {
    return { min: 4, max: 4 };
  }

  if (structure === "multi_person") {
    return { min: 3, max: 4 };
  }

  return { min: 2, max: 2 };
}

function getDefaultRivalryComposerParticipantIds(wrestlers: Wrestler[]) {
  const compatibleGroup = wrestlers.find((wrestler, index) => wrestlers.slice(index + 1).some((candidate) => canWrestlersShareMatch([wrestler, candidate])));
  const compatiblePeers = compatibleGroup ? wrestlers.filter((wrestler) => canWrestlersShareMatch([compatibleGroup, wrestler])) : wrestlers;
  const selected = compatiblePeers.slice(0, 4).map((wrestler) => wrestler.id);

  return [...selected, "", "", "", ""].slice(0, 4);
}

function getPreferredTagPartnerId(wrestlerId: string, wrestlers: Wrestler[], excludedIds: string[]) {
  const wrestler = wrestlers.find((talent) => talent.id === wrestlerId);

  if (!wrestler) {
    return "";
  }

  const excluded = new Set(excludedIds.filter((id) => id && id !== wrestlerId));
  const affiliations = getRosterAffiliations(wrestlers)
    .filter((affiliation) => affiliation.memberWrestlerIds.includes(wrestlerId))
    .sort((a, b) => {
      const aRank = a.kind === "tag_team" ? 0 : a.kind === "faction" ? 1 : 2;
      const bRank = b.kind === "tag_team" ? 0 : b.kind === "faction" ? 1 : 2;
      return aRank - bRank || a.name.localeCompare(b.name);
    });

  for (const affiliation of affiliations) {
    const partner = affiliation.memberWrestlerIds
      .map((id) => wrestlers.find((talent) => talent.id === id))
      .filter((talent): talent is Wrestler => Boolean(talent))
      .find((candidate) => candidate.id !== wrestlerId && !excluded.has(candidate.id) && canWrestlersShareMatch([wrestler, candidate]));

    if (partner) {
      return partner.id;
    }
  }

  return "";
}

function getRivalryStructureKey(structure: RivalryStructure, participantIds: string[]) {
  if (structure === "tag_team" && participantIds.length === 4) {
    const firstSide = participantIds.slice(0, 2).sort().join("+");
    const secondSide = participantIds.slice(2, 4).sort().join("+");
    return [firstSide, secondSide].sort().join("|");
  }

  return [...participantIds].sort().join("|");
}

function formatRivalryParticipantsForStructure(rivalry: Rivalry, wrestlers: Wrestler[]) {
  if (getRivalryStructure(rivalry) === "tag_team" && rivalry.participantIds.length === 4) {
    return `${getWrestlerNames(rivalry.participantIds.slice(0, 2), wrestlers)} vs ${getWrestlerNames(rivalry.participantIds.slice(2, 4), wrestlers)}`;
  }

  return getWrestlerNames(rivalry.participantIds, wrestlers);
}

function isRivalryIntergenderBlocked(rivalry: Rivalry, wrestlers: Wrestler[]) {
  const participants = getRivalryParticipants(rivalry, wrestlers);

  return participants.length > 1 && !canWrestlersShareMatch(participants);
}

function getRivalryCreationBlockReason(structure: RivalryStructure, participantIds: string[], wrestlers: Wrestler[]) {
  const selectedIds = participantIds.filter(Boolean);
  const range = getRivalryStructureParticipantRange(structure);

  if (selectedIds.length < range.min) {
    return "";
  }

  if (selectedIds.length > range.max) {
    return `${formatRivalryStructure(structure)} rivalries can use at most ${range.max} wrestlers.`;
  }

  if (new Set(selectedIds).size !== selectedIds.length) {
    return "Each wrestler can only appear once in a rivalry.";
  }

  if (structure === "tag_team" && selectedIds.length !== 4) {
    return "Tag rivalries need exactly two wrestlers on each side.";
  }

  if (structure === "singles" && selectedIds.length !== 2) {
    return "Singles rivalries need exactly two wrestlers.";
  }

  if (structure === "multi_person" && (selectedIds.length < 3 || selectedIds.length > 4)) {
    return "Multi rivalries need three or four wrestlers.";
  }

  const participants = selectedIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  if (participants.length !== selectedIds.length) {
    return "";
  }

  if (!canWrestlersShareMatch(participants)) {
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

function hasDuplicateRivalry(rivalries: Rivalry[], structure: RivalryStructure, participantIds: string[]) {
  const key = getRivalryStructureKey(structure, participantIds);
  return rivalries.some((rivalry) => getRivalryStructureKey(getRivalryStructure(rivalry), rivalry.participantIds) === key);
}

function formatRivalryStakes(stakes: RivalryStakes) {
  return stakes.charAt(0).toUpperCase() + stakes.slice(1);
}

function getInitialRivalryHeat(wrestlers: Wrestler[]) {
  if (!wrestlers.length) {
    return 50;
  }

  return Math.round(wrestlers.reduce((total, wrestler) => total + wrestler.popularity + wrestler.momentum, 0) / (wrestlers.length * 2));
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

function getFinanceOfficeRead(game: GameState): FinanceOfficeRead {
  const latestReport = getLatestFinanceReport(game);
  const seasonReports = getSeasonFinanceReports(game);
  const totalProfitLoss = seasonReports.reduce((sum, report) => sum + report.profitLoss, 0);
  const pressureLabel = getFinancePressureLabel(game.money, latestReport?.profitLoss ?? 0);
  const bestRevenueReport = getBestRevenueReport(seasonReports);
  const worstProfitReport = getWorstProfitReport(seasonReports);
  const profitableWeeks = seasonReports.filter((report) => report.profitLoss >= 0).length;
  const lossWeeks = seasonReports.length - profitableWeeks;
  const averageProfitLoss = seasonReports.length ? Math.round(totalProfitLoss / seasonReports.length) : 0;
  const latestGrossRevenue = latestReport ? getFinanceGrossRevenue(latestReport) : 0;
  const latestTotalExpenses = latestReport ? getFinanceTotalExpenses(latestReport) : 0;
  const costRatio = latestGrossRevenue > 0 ? latestTotalExpenses / latestGrossRevenue : 0;

  const headline =
    pressureLabel === "Critical"
      ? "Ownership Pressure Is Loud"
      : pressureLabel === "Tight"
        ? "Front Office Is Tight"
        : pressureLabel === "Surging"
          ? "Business Office Has Room"
          : "Books Are Stable";
  const businessFeel =
    pressureLabel === "Critical"
      ? "exposed"
      : pressureLabel === "Tight"
        ? "tight"
        : pressureLabel === "Surging"
          ? "hot"
          : "stable";
  const detail = latestReport
    ? `${latestReport.showName} closed at ${formatMoney(latestReport.profitLoss)}. The brand feels ${businessFeel} with ${formatMoney(game.money)} on hand after ${seasonReports.length} closed report${seasonReports.length === 1 ? "" : "s"}.`
    : `${formatMoney(game.money)} is on hand and no show books have closed yet. The office read is current cash pressure only until the first report lands.`;

  return {
    headline,
    detail,
    focusLabel: latestReport ? `${latestReport.showName} · ${formatMoney(latestReport.profitLoss)}` : "Books pending",
    pressureLabel,
    items: [
      {
        label: "Money Pressure",
        value: pressureLabel,
        detail: `${formatMoney(game.money)} available. This read uses current cash and the latest closed P/L only.`,
      },
      {
        label: "Latest Close",
        value: latestReport ? `${formatMoney(latestReport.profitLoss)} · Week ${latestReport.weekNumber}` : "No report yet",
        detail: latestReport
          ? `${formatMoney(latestGrossRevenue)} gross against ${formatMoney(latestTotalExpenses)} costs.`
          : "Run a show to close the first business report.",
      },
      {
        label: "Season Trend",
        value: seasonReports.length ? formatMoney(totalProfitLoss) : "No ledger",
        detail: seasonReports.length
          ? `${profitableWeeks} profitable / ${lossWeeks} loss week${seasonReports.length === 1 ? "" : "s"} · ${formatMoney(averageProfitLoss)} average P/L.`
          : "Season trend begins after the first completed show.",
      },
      {
        label: "Business Swing",
        value: bestRevenueReport ? bestRevenueReport.showName : "No swing yet",
        detail: bestRevenueReport && worstProfitReport
          ? `Best gross: ${formatMoney(getFinanceGrossRevenue(bestRevenueReport))} in Week ${bestRevenueReport.weekNumber}. Toughest close: ${formatMoney(worstProfitReport.profitLoss)} in Week ${worstProfitReport.weekNumber}.`
          : "Best and worst week context will appear once reports exist.",
      },
      {
        label: "Cost Control",
        value: latestReport ? (costRatio >= 0.9 ? "Exposed" : costRatio >= 0.7 ? "Tight" : "Controlled") : "Pending",
        detail: latestReport
          ? `${Math.round(costRatio * 100)}% of latest gross went to reported costs. This is a closed-report read, not a forecast.`
          : "Cost control needs a closed report before the office can read it.",
      },
    ],
  };
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

function buildSeasonArchiveSummary(game: GameState): SeasonArchiveSummary {
  const bestShow = getBestShow(game.showHistory, game.seasonNumber);
  const topMomentumStar = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0];
  const mostDefendedChampionship = getMostDefendedChampionship(game);
  const biggestTitleChange = getBiggestTitleChange(game);
  const hottestRivalryStory = getHottestRivalryStory(game);
  const notablePlePayoff = getNotablePlePayoff(game);

  const championsSnapshot = game.championships
    .filter((championship) => championship.championIds.length > 0)
    .map((championship) => ({
      championshipName: championship.name,
      champions: getWrestlerNames(championship.championIds, game.wrestlers) || "No champion listed",
    }));

  return {
    seasonNumber: game.seasonNumber,
    seasonStartingMoney: game.seasonStartingMoney,
    seasonDelta: game.money - game.seasonStartingMoney,
    finalMoney: game.money,
    bestShow: bestShow
      ? {
          name: bestShow.showName,
          week: bestShow.week,
          score: bestShow.totalScore,
          type: bestShow.showType,
        }
      : undefined,
    topMomentumStar: topMomentumStar
      ? {
          name: topMomentumStar.name,
          value: topMomentumStar.momentum,
        }
      : undefined,
    mostDefendedTitle: mostDefendedChampionship
      ? {
          championshipName: mostDefendedChampionship.championship.name,
          defenses: mostDefendedChampionship.count,
        }
      : undefined,
    biggestTitleChange: biggestTitleChange
      ? {
          championshipName: biggestTitleChange.championshipName,
          note: biggestTitleChange.note,
          showName: biggestTitleChange.showName,
          week: biggestTitleChange.weekNumber,
        }
      : undefined,
    hottestRivalry: hottestRivalryStory
      ? {
          name: hottestRivalryStory.name,
          heat: hottestRivalryStory.heat,
        }
      : undefined,
    plePayoffHighlight: notablePlePayoff
      ? {
          rivalryName: notablePlePayoff.rivalryName,
          showName: notablePlePayoff.showName ?? "Untitled show",
          type: notablePlePayoff.showType,
          week: notablePlePayoff.weekNumber,
        }
      : undefined,
    championsSnapshot,
  };
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

function getDominantEntry<T extends string>(values: T[]) {
  const counts = values.reduce<Map<T, number>>((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>());
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
}

function getIwcMoodHeadline(tone: IwcMoodTone, primaryCategory?: SocialCategory) {
  if (tone === "chaotic") {
    return "Timeline Is Chaotic";
  }

  if (tone === "angry") {
    return "Fans Are Heated";
  }

  if (tone === "skeptical") {
    return "Timeline Is Skeptical";
  }

  if (tone === "impressed" || tone === "excited") {
    return primaryCategory === "title_scene" ? "Title Scene Has Buzz" : "Fans Are Buying In";
  }

  if (tone === "analytical") {
    return "Discourse Is In The Tape Room";
  }

  return "Discourse Is In The Tape Room";
}

function getIwcArgumentLabel(category?: SocialCategory) {
  if (category === "title_scene") {
    return "Title Scene";
  }

  if (category === "rivalry_heat") {
    return "Rivalry Heat";
  }

  if (category === "fatigue_concern") {
    return "Workload";
  }

  if (category === "push_complaint") {
    return "Booking Choice";
  }

  if (category === "viral_moment") {
    return "Breakout Clip";
  }

  if (category === "ple_reaction") {
    return "PLE Fallout";
  }

  if (category === "analyst_take") {
    return "Match Quality";
  }

  if (category === "dirt_sheet") {
    return "Backstage Read";
  }

  if (category === "fan_praise") {
    return "Fan Praise";
  }

  return "No Argument";
}

function getIwcMoodSummary(game: GameState): IwcMoodSummary | undefined {
  if (!game.socialPosts.length) {
    return undefined;
  }

  const latestPost = game.socialPosts[game.socialPosts.length - 1];
  const weekPosts = game.socialPosts.filter((post) => post.seasonNumber === latestPost.seasonNumber && post.weekNumber === latestPost.weekNumber);
  const result = game.showHistory.find((show) => show.seasonNumber === latestPost.seasonNumber && show.week === latestPost.weekNumber);
  const dominantTone = getDominantEntry(weekPosts.map((post) => post.tone));
  const dominantCategory = getDominantEntry(weekPosts.map((post) => post.category));
  const wrestlerCounts = new Map<string, number>();
  const rivalryCounts = new Map<string, number>();
  const championshipCounts = new Map<string, number>();

  weekPosts.forEach((post) => {
    post.relatedWrestlerIds.forEach((id) => wrestlerCounts.set(id, (wrestlerCounts.get(id) ?? 0) + 1));
    post.relatedRivalryIds?.forEach((id) => rivalryCounts.set(id, (rivalryCounts.get(id) ?? 0) + 1));
    post.relatedChampionshipIds?.forEach((id) => championshipCounts.set(id, (championshipCounts.get(id) ?? 0) + 1));
  });

  const topWrestlerId = [...wrestlerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topRivalryId = [...rivalryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topChampionshipId = [...championshipCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topWrestler = game.wrestlers.find((wrestler) => wrestler.id === topWrestlerId);
  const topRivalry = game.rivalries.find((rivalry) => rivalry.id === topRivalryId);
  const topChampionship = game.championships.find((championship) => championship.id === topChampionshipId);
  const tone = dominantTone?.[0] ?? "analytical";
  const category = dominantCategory?.[0];
  const toneLabel = formatSocialTone(tone);
  const bestSegment = result ? getBestSegment(result) : undefined;
  const argumentLabel = getIwcArgumentLabel(category);
  const focusValue = topChampionship?.name ?? topRivalry?.name ?? topWrestler?.name ?? bestSegment?.participantNames.join(" / ") ?? latestPost.showName;
  const focusDetail = topChampionship
    ? `${topChampionship.name} is the belt showing up most in the resolved posts.`
    : topRivalry
      ? `${topRivalry.name} is the story thread fans keep circling.`
      : topWrestler
        ? `${topWrestler.name} is drawing the loudest individual attention.`
        : bestSegment
          ? `${bestSegment.participantNames.join(" / ")} gave the feed its cleanest reference point.`
          : "The feed is talking about the show more than one person.";
  const showDetail = result
    ? `${result.showName} closed at ${result.totalScore} (${getShowGrade(result.totalScore)}), with ${bestSegment?.participantNames.join(" / ") ?? "the card"} as the strongest resolved beat.`
    : `${latestPost.showName} has resolved posts, but no matching show result was found in history.`;

  return {
    headline: getIwcMoodHeadline(tone, category),
    detail: `Resolved Week ${latestPost.weekNumber} posts only. This summarizes what the audience is arguing about after the show, not what will happen next.`,
    weekLabel: `Season ${latestPost.seasonNumber} · Week ${latestPost.weekNumber} · ${latestPost.showName}`,
    tone,
    items: [
      {
        id: "argument",
        label: "Main Argument",
        value: argumentLabel,
        detail: category
          ? `${dominantCategory?.[1] ?? 0} post${dominantCategory?.[1] === 1 ? " is" : "s are"} centered on ${formatSocialCategory(category).toLowerCase()}.`
          : "No dominant topic yet.",
      },
      {
        id: "focus",
        label: "Who/What Has The Feed",
        value: focusValue,
        detail: focusDetail,
      },
      {
        id: "mood",
        label: "Mood",
        value: toneLabel,
        detail: `${dominantTone?.[1] ?? 0} post${dominantTone?.[1] === 1 ? "" : "s"} carry ${toneLabel.toLowerCase()} energy.`,
      },
      {
        id: "receipt",
        label: "Resolved Receipt",
        value: result ? `${result.totalScore} ${getShowGrade(result.totalScore)}` : "Posts Only",
        detail: showDetail,
      },
    ],
  };
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

function getRosterContractWeeksLabel(game: GameState) {
  const seasonWeeksRemaining = Math.max(0, 13 - game.currentWeek);
  return `${seasonWeeksRemaining} WK${seasonWeeksRemaining === 1 ? "" : "S"} LEFT`;
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

function getWrestlerLockerRoomRead(wrestler: Wrestler, game: GameState): WrestlerLockerRoomRead {
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const rivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const tvLoad = `${wrestler.appearancesThisSeason ?? 0} appearance${(wrestler.appearancesThisSeason ?? 0) === 1 ? "" : "s"} · ${wrestler.consecutiveWeeksBooked ?? 0} week TV streak`;

  if (wrestler.injuryStatus === "major") {
    return {
      headline: "Medical Hold",
      detail: `${wrestler.name} is unavailable until recovery clears.`,
      note: getInjuryDetail(wrestler),
      tone: "watch",
    };
  }

  if (wrestler.injuryStatus === "minor" || pressureTags.includes("Injury Risk")) {
    return {
      headline: "Protect The Body",
      detail: `${wrestler.name} is carrying ${wrestler.fatigue} fatigue${wrestler.injuryStatus === "minor" ? " with a minor injury" : ""}.`,
      note: "Use as a protected piece if they stay on TV.",
      tone: "watch",
    };
  }

  if (pressureTags.includes("Overused")) {
    return {
      headline: "Overexposed",
      detail: `${wrestler.name} has been a regular presence and the room can feel the load.`,
      note: tvLoad,
      tone: "watch",
    };
  }

  if (pressureTags.includes("Underused")) {
    return {
      headline: "Wants TV Time",
      detail: `${wrestler.name} has been off TV for ${formatWeekCount(weeksSinceLastBooked)}.`,
      note: "Absence pressure is visible, but this is not a demand system.",
      tone: "watch",
    };
  }

  if (pressureTags.includes("Morale Risk")) {
    return {
      headline: "Morale Watch",
      detail: `${wrestler.name} is sitting at ${wrestler.morale} morale.`,
      note: "A meaningful role can steady the room without guaranteeing fallout.",
      tone: "watch",
    };
  }

  if (championships.length) {
    return {
      headline: "Carries Gold",
      detail: `${wrestler.name} walks in with ${championships.map((championship) => championship.name).join(" / ")} status.`,
      note: "Title context is current-state prestige, not a required booking.",
      tone: "hot",
    };
  }

  if (rivalries.length) {
    return {
      headline: "Story Active",
      detail: `${wrestler.name} has room heat through ${rivalries[0].name}.`,
      note: `Heat ${rivalries[0].heat} · Freshness ${rivalries[0].freshness}`,
      tone: "hot",
    };
  }

  if (wrestler.momentum >= 75) {
    return {
      headline: "Feels Hot",
      detail: `${wrestler.name} has ${wrestler.momentum} momentum and reads like a live piece.`,
      note: tvLoad,
      tone: "hot",
    };
  }

  if (wrestler.momentum < 45) {
    return {
      headline: "Losing Steam",
      detail: `${wrestler.name} is cold at ${wrestler.momentum} momentum.`,
      note: weeksSinceLastBooked >= 2 ? `${formatWeekCount(weeksSinceLastBooked)} off TV adds to the fade.` : "Current status is visible, not a hidden penalty.",
      tone: "watch",
    };
  }

  if (wrestler.popularity >= 72) {
    return {
      headline: "Star Presence",
      detail: `${wrestler.name} still carries recognizable room status at ${wrestler.popularity} popularity.`,
      note: tvLoad,
      tone: "steady",
    };
  }

  return {
    headline: "Steady Hand",
    detail: `${wrestler.name} is available for utility, texture, or a controlled TV beat.`,
    note: tvLoad,
    tone: "steady",
  };
}

function getLockerRoomPulse(game: GameState): LockerRoomPulse {
  const sortedByMomentum = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum || b.popularity - a.popularity);
  const hotLead = sortedByMomentum[0];
  const coldLead = [...game.wrestlers].sort((a, b) => a.momentum - b.momentum || a.morale - b.morale)[0];
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const protectionList = game.wrestlers.filter((wrestler) => {
    const tags = getRosterPressureTags(wrestler, game.currentWeek);
    return wrestler.injuryStatus !== "healthy" || tags.includes("Injury Risk") || tags.includes("Overused");
  });
  const moraleWatch = game.wrestlers.filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Morale Risk"));
  const averageMorale = Math.round(game.wrestlers.reduce((sum, wrestler) => sum + wrestler.morale, 0) / Math.max(1, game.wrestlers.length));
  const underusedDetail = topUnderused
    ? `${topUnderused.name} has been off TV for ${formatWeekCount(getWeeksSinceLastBooked(topUnderused, game.currentWeek))}.`
    : coldLead
      ? `${coldLead.name} has the coldest current momentum at ${coldLead.momentum}.`
      : "No absence or cold read is leading the room.";
  const protectionDetail = topOverused
    ? `${topOverused.name} is the loudest protection read at ${topOverused.fatigue} fatigue and ${topOverused.consecutiveWeeksBooked ?? 0} straight week${(topOverused.consecutiveWeeksBooked ?? 0) === 1 ? "" : "s"} booked.`
    : protectionList.length
      ? `${protectionList.length} wrestler${protectionList.length === 1 ? "" : "s"} need lighter handling.`
      : "No major protection read is active.";
  const headline =
    protectionList.length >= 3
      ? "Locker Room Needs Protection"
      : moraleWatch.length
        ? "Locker Room Mood Needs Attention"
        : topUnderused
          ? "Locker Room Has TV-Time Pressure"
          : "Locker Room Has A Usable Shape";

  return {
    headline,
    detail: "Read-only staff interpretation from current roster state. No contracts, promises, incidents, or morale events are active here.",
    items: [
      {
        id: "hot-hand",
        label: "Feels Hot",
        value: hotLead ? hotLead.name : "No read",
        detail: hotLead ? `${hotLead.momentum} momentum · ${hotLead.popularity} popularity.` : "Roster momentum is unavailable.",
        tone: hotLead && hotLead.momentum >= 75 ? "hot" : "steady",
      },
      {
        id: "tv-time",
        label: topUnderused ? "Wants TV Time" : "Cold Watch",
        value: topUnderused ? topUnderused.name : coldLead ? coldLead.name : "No read",
        detail: underusedDetail,
        tone: topUnderused || (coldLead && coldLead.momentum < 45) ? "watch" : "steady",
      },
      {
        id: "protection",
        label: "Protection Desk",
        value: protectionList.length ? `${protectionList.length} flagged` : "Clear",
        detail: protectionDetail,
        tone: protectionList.length ? "watch" : "steady",
      },
      {
        id: "room-mood",
        label: "Room Mood",
        value: moraleWatch.length ? `${moraleWatch.length} morale watch` : `${averageMorale} avg morale`,
        detail: moraleWatch.length ? `${moraleWatch.map((wrestler) => wrestler.name).slice(0, 2).join(" / ")} need a steadier role.` : "Morale is stable enough for normal TV planning.",
        tone: moraleWatch.length ? "watch" : "steady",
      },
    ],
  };
}

function getWrestlerIdentitySnapshot(wrestler: Wrestler, game: GameState): WrestlerIdentitySnapshot {
  const identity = getWrestlerIdentityContext(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const rivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const labels = [
    championships.length ? "Champion" : null,
    rivalries.length ? "Story Piece" : null,
    wrestler.popularity >= 72 ? "Attraction" : null,
    wrestler.promoSkill >= wrestler.ringSkill + 8 ? "Talker" : null,
    wrestler.ringSkill >= wrestler.promoSkill + 8 ? "Workhorse" : null,
    wrestler.roleTier?.toLowerCase() === "prospect" ? "Prospect" : null,
    wrestler.momentum < 45 ? "Cold" : null,
    ...pressureTags,
  ].filter((label): label is string => Boolean(label));
  const uniqueLabels = [...new Set(labels)].slice(0, 6);
  const roleRead = `${identity.role} · ${identity.wrestlingStyle} · ${identity.promoStyle}`;
  const usageRead =
    wrestler.injuryStatus === "major"
      ? "Unavailable with a major injury."
      : pressureTags.includes("Overused")
        ? `Heavy TV load: ${wrestler.fatigue} fatigue and ${wrestler.consecutiveWeeksBooked ?? 0} straight week${(wrestler.consecutiveWeeksBooked ?? 0) === 1 ? "" : "s"} booked.`
        : pressureTags.includes("Underused")
          ? `Off the board for ${formatWeekCount(weeksSinceLastBooked)}. Current read is absence pressure, not a hidden penalty.`
          : wrestler.lastBookedWeek
            ? `Last booked Week ${wrestler.lastBookedWeek}; current TV streak is ${wrestler.consecutiveWeeksBooked ?? 0}.`
            : "No TV appearance recorded yet this season.";
  const bookingUseRead =
    championships.length
      ? `Current title-holder context for ${championships.map((championship) => championship.name).join(" / ")}.`
      : rivalries.length
        ? `Active story context through ${rivalries[0].name}.`
        : wrestler.popularity >= 72
          ? "Useful as a star-power presence when the card needs a recognizable anchor."
          : wrestler.promoSkill >= wrestler.ringSkill + 8
            ? "Useful when the card needs talking, character texture, or non-match structure."
            : wrestler.ringSkill >= wrestler.promoSkill + 8
              ? "Useful when the card needs in-ring credibility or a steady match lane."
              : wrestler.roleTier?.toLowerCase() === "prospect"
                ? "Useful as a developmental TV piece without implying hidden potential."
                : "Useful as a flexible utility piece when the rundown needs balance.";

  return {
    labels: uniqueLabels.length ? uniqueLabels : ["Utility Piece"],
    roleRead,
    usageRead,
    bookingUseRead,
  };
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

type ResultsRecapTone = "strong" | "title" | "story" | "danger" | "reveal" | "steady" | "quiet";

type ResultsRecapBeat = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: ResultsRecapTone;
};

function getOpenChallengeReveals(result: ShowResult) {
  return result.segmentResults.filter((segment) => segment.type === "Open Challenge" && segment.resolvedOpponentName);
}

function buildResultsRecapPackage(result: ShowResult, broadcastFallout: BroadcastFalloutSnapshot, causeLedger: CauseLedgerSection[]) {
  const bestSegment = getBestSegment(result);
  const titleHistoryEvents = result.titleHistoryEvents ?? [];
  const titleChanges = titleHistoryEvents.filter((event) => event.eventType === "title_change");
  const rivalryHistoryEvents = result.rivalryHistoryEvents ?? [];
  const injuryNotes = result.lockerRoomFallout?.injuryNotes ?? [];
  const moraleDrops = result.lockerRoomFallout?.moraleDrops ?? [];
  const moraleBoosts = result.lockerRoomFallout?.moraleBoosts ?? [];
  const openChallengeReveals = getOpenChallengeReveals(result);
  const headline: ResultsRecapBeat = titleChanges[0]
    ? {
        id: "headline-title",
        label: "Headline Fallout",
        value: titleChanges[0].championshipName,
        detail: titleChanges[0].note,
        tone: "title",
      }
    : injuryNotes[0]
      ? {
          id: "headline-injury",
          label: "Headline Fallout",
          value: injuryNotes[0].wrestlerName,
          detail: injuryNotes[0].note,
          tone: "danger",
        }
      : openChallengeReveals[0]
        ? {
            id: "headline-open-challenge",
            label: "Headline Fallout",
            value: openChallengeReveals[0].resolvedOpponentName ?? "Open Challenge",
            detail: `${openChallengeReveals[0].resolvedOpponentName} answered ${openChallengeReveals[0].participantNames[0] ?? "the challenge"}.`,
            tone: "reveal",
          }
        : result.rivalryNotes[0]
          ? {
              id: "headline-rivalry",
              label: "Headline Fallout",
              value: "Story Movement",
              detail: result.rivalryNotes[0],
              tone: "story",
            }
          : {
              id: "headline-segment",
              label: "Biggest Moment",
              value: bestSegment.participantNames.join(" / ") || bestSegment.type,
              detail: bestSegment.recapNote ?? `${bestSegment.type} led the card with a ${bestSegment.score}.`,
              tone: bestSegment.score >= 85 ? "strong" : bestSegment.score < 60 ? "danger" : "steady",
            };

  const consequenceReel: ResultsRecapBeat[] = [
    {
      id: "title-scene",
      label: "Title Scene",
      value: titleChanges.length ? `${titleChanges.length} change${titleChanges.length === 1 ? "" : "s"}` : titleHistoryEvents.length ? `${titleHistoryEvents.length} logged` : "Quiet",
      detail: titleChanges[0]?.note ?? result.titleNotes[0] ?? "No title change or defense fallout was logged from this result.",
      tone: titleChanges.length ? "title" : titleHistoryEvents.length ? "steady" : "quiet",
    },
    {
      id: "rivalry-heat",
      label: "Rivalry Heat",
      value: rivalryHistoryEvents.length ? `${rivalryHistoryEvents.length} move${rivalryHistoryEvents.length === 1 ? "" : "s"}` : result.rivalryNotes.length ? `${result.rivalryNotes.length} note${result.rivalryNotes.length === 1 ? "" : "s"}` : "No move",
      detail: result.rivalryNotes[0] ?? "No rivalry movement was logged from this result.",
      tone: rivalryHistoryEvents.length || result.rivalryNotes.length ? "story" : "quiet",
    },
    {
      id: "locker-room",
      label: "Locker Room",
      value: injuryNotes.length ? `${injuryNotes.length} injury` : moraleBoosts.length || moraleDrops.length ? `${moraleBoosts.length + moraleDrops.length} morale` : "Level",
      detail: injuryNotes[0]?.note ?? moraleDrops[0]?.note ?? moraleBoosts[0]?.note ?? "No injury or morale fallout note was logged from this result.",
      tone: injuryNotes.length ? "danger" : moraleDrops.length ? "story" : moraleBoosts.length ? "strong" : "quiet",
    },
    {
      id: "open-challenge",
      label: "Open Challenge",
      value: openChallengeReveals.length ? `${openChallengeReveals.length} reveal${openChallengeReveals.length === 1 ? "" : "s"}` : "None",
      detail: openChallengeReveals[0]
        ? `${openChallengeReveals[0].resolvedOpponentName} answered ${openChallengeReveals[0].participantNames[0] ?? "the challenge"}.`
        : "No Open Challenge reveal was part of this result.",
      tone: openChallengeReveals.length ? "reveal" : "quiet",
    },
  ];

  const causeDriver = causeLedger[0]?.items[0]?.detail;
  const falloutDriver = broadcastFallout.items[0]?.detail;

  return {
    verdict: buildBroadcastRecap(result),
    headline,
    consequenceReel,
    whyItMattered: causeDriver ?? falloutDriver ?? `${result.showName} closed at ${result.totalScore} (${getShowGrade(result.totalScore)}), with ${bestSegment.participantNames.join(" / ") || "the top segment"} leading the score shape.`,
  };
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
  return mode === "runtime" || mode === "legacy-runtime" || mode === "title-defense-runtime" || mode === "title-change-runtime" ? mode : null;
}

function getQaSegmentOption(id: string) {
  const option = getCatalogOptionById(id);

  if (!option) {
    throw new Error(`Missing QA segment catalog option: ${id}`);
  }

  return option;
}

function createQaSegment(id: string, catalogId: string, participantIds: string[], durationMinutes: number, championshipId?: string): Segment {
  const option = getQaSegmentOption(catalogId);

  return {
    id,
    type: option.family,
    participantIds,
    championshipId,
    segmentCatalogId: option.id,
    segmentDisplayName: option.label,
    durationMinutes,
    participantMin: option.minParticipants,
    participantMax: option.maxParticipants,
  };
}

function tuneQaTitleFixtureWrestler(wrestler: Wrestler, role: "champion-favorite" | "champion-underdog" | "challenger-favorite" | "challenger-underdog") {
  const favoriteStats = {
    popularity: 99,
    momentum: 99,
    ringSkill: 99,
    morale: 92,
    fatigue: 8,
  };
  const underdogStats = {
    popularity: 58,
    momentum: 45,
    ringSkill: 52,
    morale: 58,
    fatigue: 42,
  };
  const stats = role === "champion-favorite" || role === "challenger-favorite" ? favoriteStats : underdogStats;

  return {
    ...wrestler,
    ...stats,
    injuryStatus: "healthy" as const,
    injuryDescription: undefined,
    injuryWeeksRemaining: 0,
    injuryOccurredWeek: undefined,
  };
}

function buildQaTitlePayoffHarnessState(mode: "title-defense-runtime" | "title-change-runtime", baseGame: GameState): SavedGameState {
  const fixtureGame: GameState = {
    ...baseGame,
    brandName: mode === "title-defense-runtime" ? "QA Title Defense" : "QA Title Change",
    championships: baseGame.championships.map((championship) => ({ ...championship, championIds: [...championship.championIds] })),
    currentShow: [],
  };
  const title = fixtureGame.championships.find((championship) => {
    if (championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team") {
      return false;
    }

    return fixtureGame.wrestlers.filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship)).length >= 2;
  });

  if (!title) {
    return buildSavedGameState(fixtureGame, "booking");
  }

  const eligibleWrestlers = fixtureGame.wrestlers.filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, title));
  const champion = eligibleWrestlers[0];
  const challenger = eligibleWrestlers[1];
  const supportIds = fixtureGame.wrestlers
    .filter((wrestler) => wrestler.id !== champion.id && wrestler.id !== challenger.id)
    .slice(0, 3)
    .map((wrestler) => wrestler.id);

  fixtureGame.wrestlers = fixtureGame.wrestlers.map((wrestler) => {
    if (wrestler.id === champion.id) {
      return tuneQaTitleFixtureWrestler(wrestler, mode === "title-defense-runtime" ? "champion-favorite" : "champion-underdog");
    }

    if (wrestler.id === challenger.id) {
      return tuneQaTitleFixtureWrestler(wrestler, mode === "title-defense-runtime" ? "challenger-underdog" : "challenger-favorite");
    }

    return { ...wrestler, injuryStatus: "healthy" as const, injuryWeeksRemaining: 0 };
  });
  fixtureGame.championships = fixtureGame.championships.map((championship) =>
    championship.id === title.id
      ? {
          ...championship,
          championIds: [champion.id],
          contenderIds: [challenger.id],
          defenses: mode === "title-defense-runtime" ? 2 : 0,
          reignStartWeek: 1,
        }
      : championship,
  );
  fixtureGame.currentShow = [
    createQaSegment("qa-title-opener", "P001", [supportIds[0] ?? champion.id], 20),
    createQaSegment("qa-title-feature", "M001", [champion.id, challenger.id], 35, title.id),
    createQaSegment("qa-title-story", "A001", [supportIds[1] ?? challenger.id], 20),
    createQaSegment("qa-title-main", "P002", [supportIds[2] ?? champion.id], 20),
  ];

  return buildSavedGameState(fixtureGame, "booking");
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

  if (mode === "title-defense-runtime" || mode === "title-change-runtime") {
    return buildQaTitlePayoffHarnessState(mode, game);
  }

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
  const [bookingFocusSegmentId, setBookingFocusSegmentId] = useState<string | undefined>();
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

  function getRivalryBookingCandidateOptions(rivalry: Rivalry, current: GameState) {
    const structure = getRivalryStructure(rivalry);
    const timingSnapshot = getRivalryTimingSnapshot(rivalry, current);
    const calendarWeek = getCurrentCalendarWeek(current);
    const isPleReady = timingSnapshot.diagnostics.some((diagnostic) => diagnostic.id === "ple-ready");
    const isPayoffOverdue = timingSnapshot.diagnostics.some((diagnostic) => diagnostic.id === "payoff-overdue");
    const candidateIds: string[] = [];

    if (structure === "tag_team" && rivalry.participantIds.length === 4) {
      candidateIds.push("M020");
    } else if (structure === "singles" && rivalry.participantIds.length === 2) {
      if (rivalry.stakes === "title" && calendarWeek.isGoHome) {
        candidateIds.push("P008");
      }

      if (calendarWeek.showType === "ple" || isPleReady || isPayoffOverdue || rivalry.heat >= 65) {
        candidateIds.push("M019", "M001");
      }

      candidateIds.push("P003", "A046");
    } else if (structure === "multi_person") {
      candidateIds.push("A046");
    }

    const fallbackOptions = bookingSegmentTypes
      .flatMap((type) => getCatalogOptionsForType(type))
      .filter((option) => option.rivalryRelevant && rivalry.participantIds.length >= option.minParticipants && rivalry.participantIds.length <= option.maxParticipants);
    const candidateOptions = [...candidateIds.map((id) => getCatalogOptionById(id)).filter((option): option is SegmentCatalogOption => Boolean(option)), ...fallbackOptions];
    const seenOptionIds = new Set<string>();

    return candidateOptions.filter((option) => {
      if (seenOptionIds.has(option.id)) {
        return false;
      }

      seenOptionIds.add(option.id);
      return true;
    });
  }

  function buildRivalryBookingSegment(current: GameState, rivalry: Rivalry, segmentId: string) {
    if (isRivalryIntergenderBlocked(rivalry, current.wrestlers)) {
      return undefined;
    }

    const participants = rivalry.participantIds.map((id) => current.wrestlers.find((wrestler) => wrestler.id === id));

    if (participants.some((wrestler) => !wrestler || wrestler.injuryStatus === "major")) {
      return undefined;
    }

    for (const option of getRivalryBookingCandidateOptions(rivalry, current)) {
      const candidate: Segment = {
        id: segmentId,
        type: option.family,
        participantIds: [...rivalry.participantIds],
        rivalryId: rivalry.id,
        segmentCatalogId: option.id,
        segmentDisplayName: option.label,
        durationMinutes: option.defaultDurationMinutes,
        participantMin: option.minParticipants,
        participantMax: option.maxParticipants,
      };

      if (!isValidSegment(candidate, current.wrestlers) || !canSegmentAttachRivalry(candidate, rivalry, current.wrestlers)) {
        continue;
      }

      const championship = option.championshipAllowed
        ? current.championships.find((title) => canSegmentAttachChampionship(candidate, title, current.wrestlers))
        : undefined;
      const segment = championship ? { ...candidate, championshipId: championship.id } : candidate;

      if (isValidSegment(segment, current.wrestlers) && canSegmentAttachRivalry(segment, rivalry, current.wrestlers)) {
        return segment;
      }
    }

    return undefined;
  }

  function bookRivalryStory(rivalryId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const existingSegment = current.currentShow.find((segment) => segment.rivalryId === rivalryId);

      if (existingSegment) {
        persistGameSnapshot(current, "booking");
        setBookingFocusSegmentId(existingSegment.id);
        setProfileWrestlerId(undefined);
        setProfileReturnScreen("booking");
        setScreen("booking");
        return current;
      }

      const rivalry = current.rivalries.find((item) => item.id === rivalryId);

      if (!rivalry || current.currentShow.length >= maxBookingSegments) {
        persistGameSnapshot(current, "booking");
        setBookingFocusSegmentId(undefined);
        setProfileWrestlerId(undefined);
        setProfileReturnScreen("booking");
        setScreen("booking");
        return current;
      }

      const segmentId = `rivalry-segment-${Date.now()}-${current.currentShow.length}`;
      const segment = buildRivalryBookingSegment(current, rivalry, segmentId);

      if (!segment) {
        persistGameSnapshot(current, "booking");
        setBookingFocusSegmentId(undefined);
        setProfileWrestlerId(undefined);
        setProfileReturnScreen("booking");
        setScreen("booking");
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: [...current.currentShow, segment],
      };

      persistGameSnapshot(updatedGame, "booking");
      setBookingFocusSegmentId(segmentId);
      setProfileWrestlerId(undefined);
      setProfileReturnScreen("booking");
      setScreen("booking");
      return updatedGame;
    });
  }

  function bookChampionship(championshipId: string) {
    setGame((current) => {
      if (!current || current.currentShow.length >= maxBookingSegments) {
        return current;
      }

      const championship = current.championships.find((title) => title.id === championshipId);

      if (!championship) {
        return current;
      }

      const isTagTitle = isTagChampionship(championship);
      const option = getCatalogOptionById(isTagTitle ? "M020" : "M001") ?? getDefaultCatalogOption("Match")!;
      const scene = getTitleDivisionScene(championship, current.wrestlers, current.rivalries, current.currentWeek, current.championships);
      const challengerIds = scene.topContenders.slice(0, isTagTitle ? 2 : 1).map((wrestler) => wrestler.id);
      const participantIds = [...championship.championIds, ...challengerIds];
      const segmentId = `title-segment-${Date.now()}-${current.currentShow.length}`;
      const titleSegment: Segment = {
        id: segmentId,
        type: "Match",
        participantIds,
        segmentCatalogId: option.id,
        segmentDisplayName: option.label,
        durationMinutes: option.defaultDurationMinutes,
        participantMin: option.minParticipants,
        participantMax: option.maxParticipants,
      };
      const updatedSegment = canSegmentAttachChampionship(titleSegment, championship, current.wrestlers)
        ? { ...titleSegment, championshipId: championship.id }
        : titleSegment;
      const updatedGame = {
        ...current,
        currentShow: [...current.currentShow, updatedSegment],
      };

      persistGameSnapshot(updatedGame, "booking");
      setBookingFocusSegmentId(segmentId);
      setProfileWrestlerId(undefined);
      setProfileReturnScreen("booking");
      setScreen("booking");
      return updatedGame;
    });
  }

  function setChampionshipContenders(championshipId: string, wrestlerIds: string[]) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        championships: current.championships.map((championship) => {
          if (championship.id !== championshipId) {
            return championship;
          }

          const contenderIds = wrestlerIds.filter((id, index) => {
            if (wrestlerIds.indexOf(id) !== index || championship.championIds.includes(id)) {
              return false;
            }

            const wrestler = current.wrestlers.find((talent) => talent.id === id);
            return Boolean(wrestler && wrestlerFitsChampionshipDivision(wrestler, championship));
          });
          return { ...championship, contenderIds };
        }),
      };

      persistGameSnapshot(updatedGame, "championships");
      return updatedGame;
    });
  }

  function revokeChampionship(championshipId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const championship = current.championships.find((title) => title.id === championshipId);

      if (!championship || !championship.championIds.length) {
        return current;
      }

      const calendarWeek = getCurrentCalendarWeek(current);
      const previousChampionIds = [...championship.championIds];
      const note = `${getWrestlerNames(previousChampionIds, current.wrestlers)} had the ${championship.name} revoked by the GM office. The title is vacant until the player books a new champion.`;
      const event: ChampionshipHistoryEvent = {
        id: `s${current.seasonNumber}-w${current.currentWeek}-${championship.id}-revoked-${Date.now()}`,
        championshipId: championship.id,
        championshipName: championship.name,
        eventType: "revoked",
        championIds: [],
        previousChampionIds,
        weekNumber: current.currentWeek,
        seasonNumber: current.seasonNumber,
        showName: calendarWeek.showName,
        showType: calendarWeek.showType,
        note,
      };
      const updatedGame = {
        ...current,
        championships: current.championships.map((title) =>
          title.id === championshipId
            ? {
                ...title,
                championIds: [],
                defenses: 0,
                reignStartWeek: current.currentWeek,
              }
            : title,
        ),
        championshipHistory: [...(current.championshipHistory ?? []), event],
        currentShow: current.currentShow.map((segment) => (segment.championshipId === championshipId ? { ...segment, championshipId: undefined } : segment)),
      };

      persistGameSnapshot(updatedGame, "championships");
      return updatedGame;
    });
  }

  function assignChampionship(championshipId: string, championIds: string[]) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const championship = current.championships.find((title) => title.id === championshipId);

      if (!championship || championship.championIds.length) {
        return current;
      }

      const isTagTitle = isTagChampionship(championship);
      const requiredChampionCount = isTagTitle ? 2 : 1;
      const nextChampionIds = championIds.slice(0, requiredChampionCount);

      if (nextChampionIds.length !== requiredChampionCount) {
        return current;
      }

      const nextChampions = nextChampionIds
        .map((id) => current.wrestlers.find((wrestler) => wrestler.id === id))
        .filter((wrestler): wrestler is Wrestler => Boolean(wrestler && wrestlerFitsChampionshipDivision(wrestler, championship)));

      if (nextChampions.length !== requiredChampionCount) {
        return current;
      }

      const calendarWeek = getCurrentCalendarWeek(current);
      const championLabel = getWrestlerNames(nextChampionIds, current.wrestlers);
      const note = `${championLabel} ${nextChampionIds.length === 1 ? "was" : "were"} assigned the vacant ${championship.name} by the GM office.`;
      const event: ChampionshipHistoryEvent = {
        id: `s${current.seasonNumber}-w${current.currentWeek}-${championship.id}-assigned-${Date.now()}`,
        championshipId: championship.id,
        championshipName: championship.name,
        eventType: "assigned",
        championIds: nextChampionIds,
        previousChampionIds: [],
        weekNumber: current.currentWeek,
        seasonNumber: current.seasonNumber,
        showName: calendarWeek.showName,
        showType: calendarWeek.showType,
        note,
      };
      const updatedGame = {
        ...current,
        championships: current.championships.map((title) =>
          title.id === championshipId
            ? {
                ...title,
                championIds: nextChampionIds,
                contenderIds: (title.contenderIds ?? []).filter((id) => !nextChampionIds.includes(id)),
                defenses: 0,
                reignStartWeek: current.currentWeek,
              }
            : title,
        ),
        championshipHistory: [...(current.championshipHistory ?? []), event],
      };

      persistGameSnapshot(updatedGame, "championships");
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

  function buildSegmentTitleMatch(segmentId: string, championshipId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      let changed = false;
      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          const titleSegment = buildSanctionedTitleMatchSegment(current, segment, championshipId);

          if (!titleSegment) {
            return segment;
          }

          changed = true;
          return titleSegment;
        }),
      };

      if (!changed) {
        return current;
      }

      persistGameSnapshot(updatedGame, "booking");
      setBookingFocusSegmentId(segmentId);
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
    void generateExternalAiSocialCommentary(resolvedShow.result, resolvedShow.game).then((posts) => {
      if (!posts.length) {
        return;
      }

      setGame((current) => {
        if (!current) {
          return current;
        }

        const existingIds = new Set(current.socialPosts.map((post) => post.id));
        const newPosts = posts.filter((post) => !existingIds.has(post.id));

        if (!newPosts.length) {
          return current;
        }

        const updatedGame = {
          ...current,
          socialPosts: [...current.socialPosts, ...newPosts],
        };

        persistGameSnapshot(updatedGame, "results");
        return updatedGame;
      });
    });
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

      const completedSeasonArchive = buildSeasonArchiveSummary(current);
      const updatedGame = startNextSeason(current, completedSeasonArchive);
      persistGameSnapshot(updatedGame, "dashboard");
      return updatedGame;
    });
    setScreen("dashboard");
  }

  function signFreeAgent(wrestlerId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = signPlayerFreeAgent(current, wrestlerId, draftPool);
      persistGameSnapshot(updatedGame, "market");
      return updatedGame;
    });
  }

  function releaseWrestler(wrestlerId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const wrestler = current.wrestlers.find((item) => item.id === wrestlerId);
      const titleWarning = current.championships.some((championship) => championship.championIds.includes(wrestlerId));
      const rivalryWarning = current.rivalries.some((rivalry) => rivalry.participantIds.includes(wrestlerId));

      if (!wrestler) {
        return current;
      }

      if ((titleWarning || rivalryWarning) && !window.confirm(`${wrestler.name} is tied to ${titleWarning ? "a championship" : "an active rivalry"}. Release anyway?`)) {
        return current;
      }

      const updatedGame = releasePlayerWrestler(current, wrestlerId);
      persistGameSnapshot(updatedGame, "market");
      return updatedGame;
    });
  }

  function proposeTrade(outgoingWrestlerId: string, targetWrestlerId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = proposePlayerTrade(current, outgoingWrestlerId, targetWrestlerId, draftPool);
      persistGameSnapshot(updatedGame, "market");
      return updatedGame;
    });
  }

  function createRivalry({ participantIds, structure, stakes, storylineId }: RivalryCreateInput) {
    setGame((current) => {
      const selectedIds = participantIds.filter(Boolean);

      if (!current || hasDuplicateRivalry(current.rivalries, structure, selectedIds) || getRivalryCreationBlockReason(structure, selectedIds, current.wrestlers)) {
        return current;
      }

      const participants = selectedIds
        .map((id) => current.wrestlers.find((wrestler) => wrestler.id === id))
        .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
      const range = getRivalryStructureParticipantRange(structure);

      if (participants.length !== selectedIds.length || selectedIds.length < range.min || selectedIds.length > range.max) {
        return current;
      }

      if (!canWrestlersShareMatch(participants)) {
        return current;
      }

      const heat = getInitialRivalryHeat(participants);
      const rivalryId = `rivalry-${Date.now()}`;
      const selectedStorylineId = storylineId ?? getDefaultStorylineIdForStakes(stakes);
      const storyline = getRivalryStoryline({ stakes, storylineId: selectedStorylineId });
      const rivalryName =
        structure === "tag_team" && selectedIds.length === 4
          ? `${getWrestlerNames(selectedIds.slice(0, 2), current.wrestlers)} vs ${getWrestlerNames(selectedIds.slice(2, 4), current.wrestlers)}`
          : structure === "multi_person"
            ? `${getWrestlerNames(selectedIds, current.wrestlers)} collision`
            : `${participants[0].name} vs ${participants[1].name}`;
      const rivalry = applyRivalryCatalogDefaults({
        id: rivalryId,
        name: rivalryName,
        participantIds: selectedIds,
        structure,
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
        focusSegmentId={bookingFocusSegmentId}
        game={game}
        isQaHarness={isQaHarness}
        onAddSegment={addSegment}
        onBuildTitleMatch={buildSegmentTitleMatch}
        onConsumeFocusSegment={() => setBookingFocusSegmentId(undefined)}
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

  if (screen === "market") {
    return (
      <MarketScreen
        game={game}
        latestResult={latestResult}
        onNavigate={navigateTo}
        onProposeTrade={proposeTrade}
        onReleaseWrestler={releaseWrestler}
        onSignFreeAgent={signFreeAgent}
      />
    );
  }

  if (screen === "championships") {
    return <ChampionshipsScreen game={game} latestResult={latestResult} onAssignChampionship={assignChampionship} onBookChampionship={bookChampionship} onNavigate={navigateTo} onRevokeChampionship={revokeChampionship} onSetContenders={setChampionshipContenders} />;
  }

  if (screen === "rivalries") {
    return (
      <RivalriesScreen
        game={game}
        latestResult={latestResult}
        onBookRivalry={bookRivalryStory}
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
  const [draftFocusId, setDraftFocusId] = useState<string>();
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
  const previewRivalBrands = createRivalBrandUniverse(rivalGMAssignments);
  const rivalDraftActivity = getCpuDraftPreviewSnapshot(previewRivalBrands, draftedWrestlers, draftPool);
  const cpuClaimedDraftIds = new Set(rivalDraftActivity?.claimedWrestlerIds ?? []);
  const availableDraftCount = draftPool.length - draftedWrestlers.length - cpuClaimedDraftIds.size;
  const availableWrestlers = draftPool
    .filter((wrestler) => !draftedIds.has(wrestler.id))
    .filter((wrestler) => !cpuClaimedDraftIds.has(wrestler.id))
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
  const focusedDraftWrestler = availableWrestlers.find((wrestler) => wrestler.id === draftFocusId) ?? boardLeader;
  const draftTierCounts = getDraftValueCounts(draftedWrestlers, (wrestler) => wrestler.roleTier);
  const draftArchetypeCounts = getDraftValueCounts(draftedWrestlers, (wrestler) => wrestler.archetype);
  const draftDivisionCounts = getDraftValueCounts(draftedWrestlers, (wrestler) => wrestler.division);
  const picksRemaining = Math.max(0, draftPickCount - draftedWrestlers.length);
  const draftClockRead =
    draftedWrestlers.length === 0
      ? `Draft floor is open. You have ${draftPickCount} clean picks to build your first locker-room direction.`
      : draftPickCount - draftedWrestlers.length <= 2
        ? "Final stretch. This final lane cements your Week 1 identity."
        : `${draftedWrestlers.length + 1} of ${draftPickCount} is the next lane and ${Math.max(
            0,
            draftPickCount - draftedWrestlers.length,
          )} picks remain to define the room.`;
  const rosterClassRead = (() => {
    if (!draftedWrestlers.length) {
      return "No class read yet. The board is still open, and every pick sets the early identity of this campaign.";
    }

    const topDraftTier = getMostCommonDraftValue(draftTierCounts, "Balanced Tier");
    const topDraftArchetype = getMostCommonDraftValue(draftArchetypeCounts, "Mixed Style");
    const topDraftDivision = getMostCommonDraftValue(draftDivisionCounts, "Mixed Division");
    return `Class profile is shaping as a ${topDraftDivision} roster with ${topDraftArchetype} emphasis and ${topDraftTier} depth.`;
  })();
  const focusedDraftIdentity = focusedDraftWrestler ? getWrestlerIdentityContext(focusedDraftWrestler) : undefined;
  const focusedDraftFinance = focusedDraftWrestler ? getRosterFinanceValueForWrestler(focusedDraftWrestler) : undefined;
  const focusedDraftOverall = focusedDraftWrestler ? getWrestlerOverall(focusedDraftWrestler) : 0;
  const focusedDraftCost = focusedDraftFinance?.draftValueUsd ?? 0;
  const draftedRosterNeedRows = [
    { label: "Main Event", count: draftedWrestlers.filter((wrestler) => getDraftTag(wrestler.roleTier).includes("Main")).length, target: 2 },
    { label: "Talkers", count: draftedWrestlers.filter((wrestler) => wrestler.promoSkill >= 82).length, target: 4 },
    { label: "Workers", count: draftedWrestlers.filter((wrestler) => wrestler.ringSkill >= 82).length, target: 4 },
    { label: "Women", count: draftedWrestlers.filter((wrestler) => getWrestlerDivisionGroup(wrestler) === "womens").length, target: 4 },
  ];
  const recentRivalClaims = (rivalDraftActivity?.claimedWrestlerIds ?? [])
    .slice(-5)
    .map((id) => draftPool.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
  const upNextRivals = previewRivalBrands.slice(0, 4);

  useEffect(() => {
    if (!availableWrestlers.length) {
      if (draftFocusId) {
        setDraftFocusId(undefined);
      }
      return;
    }

    if (!draftFocusId || !availableWrestlers.some((wrestler) => wrestler.id === draftFocusId)) {
      setDraftFocusId(availableWrestlers[0].id);
    }
  }, [availableWrestlers, draftFocusId]);

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

  function draftFocusedWrestler() {
    if (!focusedDraftWrestler) {
      return;
    }

    draftWrestler(focusedDraftWrestler);
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
    setDraftFocusId(undefined);
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

  const setupSteps: Array<{ id: SetupStep; label: string; detail: string }> = [
    { id: "contract", label: "Contract", detail: "Accept the job" },
    { id: "rules", label: "Rules", detail: "Set pressure" },
    { id: "gm", label: "GM", detail: "Choose identity" },
    { id: "brand", label: "Brand", detail: "Take a chair" },
    { id: "draft", label: "Draft", detail: "Build roster" },
  ];
  const activeSetupIndex = setupSteps.findIndex((item) => item.id === step);
  const currentStepLabel = setupSteps[activeSetupIndex]?.label ?? "Career";
  const nextActionLabel =
    step === "contract"
      ? "Set Rules"
      : step === "rules"
        ? "Choose GM"
        : step === "gm"
          ? "Choose Brand"
          : step === "brand"
            ? "Draft Night"
            : step === "draft"
              ? "Week 1"
              : "Career";
  const signedBrandName = brandName.trim() || defaultCareer.brandName;
  const signedGmName = gmName.trim() || defaultCareer.gmName;
  const rivalSummary = previewRivalBrands.map((brand) => `${brand.brandName}: ${brand.assignedGMName}`).join(" / ");

  return (
    <main className={`setup-screen setup-step-${step}`}>
      <section className="setup-shell">
        <div className={`setup-layout${step === "draft" ? " draft-war-room-layout" : ""}`}>
          {step === "draft" ? null : (
            <nav className="setup-step-rail" aria-label="Career start steps">
              <p className="eyebrow">Career Start</p>
              {setupSteps.map((item, index) => (
                <span className={step === item.id ? "active-step" : index < activeSetupIndex ? "complete-step" : ""} key={item.id}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              ))}
            </nav>
          )}

          <div className={`setup-workspace${step === "draft" ? " draft-war-room-workspace" : ""}`}>
            {step === "draft" ? null : (
              <div className="setup-workspace-head">
              <div>
                <p className="eyebrow">{currentStepLabel} Desk</p>
                <h1>{signedBrandName}</h1>
              </div>
              <strong>{nextActionLabel}</strong>
            </div>
            )}

        {step === "contract" ? (
          <div className="setup-panel setup-command-panel">
            <p className="eyebrow">Sign The Contract</p>
            <h1>You're Hired</h1>
            <p className="lede">
              A national broadcast window is open, the roster is restless, and the GM room is filling up. Ownership is hiring you to run a brand over seasons, not just survive one hot night.
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
          <div className="setup-panel setup-command-panel">
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
              <p>{selectedGmStyle.description} This is your leadership reputation in the room; it frames the fantasy without adding hidden bonuses.</p>
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
          <div className="setup-panel setup-command-panel">
            <p className="eyebrow">Choose Your Seat</p>
            <h2>Which Brand Chair Is Yours?</h2>
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
              <p className="eyebrow">Selected Brand Chair</p>
              <strong>{selectedBrandStyle.label}</strong>
              <p>{selectedBrandStyle.description} This frames the show you are taking into the GM universe; it does not add hidden gameplay modifiers.</p>
            </div>
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("gm")}>
                Back
              </button>
              <button className="primary-action" disabled={!canPreview} onClick={() => setStep("draft")}>
                Enter Draft Night
              </button>
            </div>
          </div>
        ) : null}

        {step === "rules" ? (
          <div className="setup-panel setup-command-panel">
            <p className="eyebrow">Game Rules</p>
            <h2>Set The Pressure Level</h2>
            <p className="lede">Lock the ownership mandate before Draft Night. Difficulty frames the pressure of the job for now; budget sets your opening war chest.</p>
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

        {step === "draft" ? (
          <div className="draft-war-room" aria-label="Draft Night war room">
            <header className="draft-war-room-hud">
              <div className="draft-night-title">
                <h1>Draft Night</h1>
                <span>Season 1 / Week 0</span>
                <small>Live from the {signedBrandName} war room</small>
              </div>
              <div className="draft-feed-banner">
                <span>GM War Room Feed</span>
                <strong>{draftClockRead}</strong>
              </div>
              <div className="draft-hud-metric">
                <span>Budget Remaining</span>
                <strong>{formatProjectedReserve(draftFinanceReadout)}</strong>
              </div>
              <div className="draft-hud-metric timer">
                <span>On The Clock</span>
                <strong>{picksRemaining ? `${picksRemaining} Picks` : "Locked"}</strong>
              </div>
              <div className="draft-brand-badge">
                <span>Your Pick</span>
                <strong>{signedBrandName}</strong>
                <small>{draftedWrestlers.length + 1 > draftPickCount ? draftPickCount : draftedWrestlers.length + 1} / {draftPickCount}</small>
              </div>
            </header>

            <section className="draft-war-room-grid">
              <aside className="draft-board-panel" aria-label="Available talent">
                <div className="draft-panel-head">
                  <div>
                    <p className="eyebrow">Available Talent</p>
                    <h2>{availableWrestlers.length} Showing</h2>
                  </div>
                  <button className="secondary-action" onClick={resetDraftBoard} type="button">
                    Reset
                  </button>
                </div>
                <div className="draft-tools draft-war-toolbar" aria-label="Draft board controls">
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
                    Brand
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
                    Status
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
                </div>
                <div className="draft-prospect-list">
                  {availableWrestlers.length ? (
                    availableWrestlers.map((wrestler) => (
                      <button
                        className={`draft-prospect-row${focusedDraftWrestler?.id === wrestler.id ? " is-focused" : ""}`}
                        key={wrestler.id}
                        onClick={() => setDraftFocusId(wrestler.id)}
                        type="button"
                      >
                        <WrestlerPortrait className="draft-prospect-portrait" wrestler={wrestler} />
                        <span>
                          <strong>{wrestler.name}</strong>
                          <small>{getDraftTag(wrestler.archetype)} / {getDraftTag(wrestler.roleTier)}</small>
                        </span>
                        <em>Pop {wrestler.popularity}</em>
                        <b>{getWrestlerOverall(wrestler)}</b>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state compact">No draft files match that search.</div>
                  )}
                </div>
              </aside>

              <section className="draft-clock-stage" aria-label="Selected prospect">
                <div className="draft-clock-strip">On The Clock</div>
                {focusedDraftWrestler ? (
                  <div className="draft-focus-card">
                    <WrestlerPortrait className="draft-focus-portrait" wrestler={focusedDraftWrestler} />
                    <div className="draft-focus-copy">
                      <p className="eyebrow">{getDraftTag(focusedDraftWrestler.roleTier)} / {getDraftTag(focusedDraftWrestler.archetype)}</p>
                      <h2>{focusedDraftWrestler.name}</h2>
                      <div className="draft-focus-tags">
                        <span>{getDraftTag(focusedDraftWrestler.sourceBrand, "Open Pool")}</span>
                        <span>{getDraftTag(focusedDraftWrestler.division)}</span>
                        <span>{getDraftTag(focusedDraftIdentity?.careerStageLabel, "Career Stage")}</span>
                      </div>
                      <div className="draft-focus-meta">
                        <span>Class <strong>{getDraftTag(focusedDraftIdentity?.role, "Performer")}</strong></span>
                        <span>Style <strong>{getDraftTag(focusedDraftIdentity?.wrestlingStyle, "Mixed")}</strong></span>
                        <span>Mic <strong>{getDraftTag(focusedDraftIdentity?.promoStyle, "Open")}</strong></span>
                      </div>
                      <div className="draft-focus-stat-grid">
                        <Metric label="Popularity" value={`${focusedDraftWrestler.popularity}`} />
                        <Metric label="Momentum" value={`${focusedDraftWrestler.momentum}`} />
                        <Metric label="Ring Work" value={`${focusedDraftWrestler.ringSkill}`} />
                        <Metric label="Mic Skill" value={`${focusedDraftWrestler.promoSkill}`} />
                      </div>
                      <div className="draft-focus-contract">
                        <span>Draft Value <strong>{focusedDraftCost ? formatMoney(focusedDraftCost) : "Catalog Pending"}</strong></span>
                        <span>Condition <strong>Fat {focusedDraftWrestler.fatigue} / Morale {focusedDraftWrestler.morale}</strong></span>
                      </div>
                    </div>
                    <div className="draft-focus-overall">
                      <span>Overall</span>
                      <strong>{focusedDraftOverall}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state compact">No focused draft file. Clear filters to reopen the board.</div>
                )}
                <div className="draft-main-actions">
                  <button className="secondary-action" onClick={() => setStep("brand")}>
                    Back
                  </button>
                  <button className="primary-action" disabled={!focusedDraftWrestler || draftedWrestlers.length >= draftPickCount} onClick={draftFocusedWrestler}>
                    Draft Selected
                  </button>
                  <button className={draftedWrestlers.length === draftPickCount ? "primary-action" : "secondary-action"} disabled={draftedWrestlers.length !== draftPickCount} onClick={startCareer}>
                    Enter Week 1
                  </button>
                </div>
              </section>

              <aside className="draft-rival-panel" aria-label="Rival brands and draft status">
                <div className="draft-panel-head">
                  <div>
                    <p className="eyebrow">Rival Brands</p>
                    <h2>Draft Status</h2>
                  </div>
                  <strong>{availableDraftCount} Open</strong>
                </div>
                <div className="draft-rival-list">
                  {previewRivalBrands.map((brand, index) => (
                    <article key={brand.id}>
                      <strong>{brand.brandName}</strong>
                      <span>{brand.assignedGMName}</span>
                      <small>Round 1 / Pick {draftedWrestlers.length + index + 2}</small>
                      <em>{formatMoney(brand.budget)}</em>
                    </article>
                  ))}
                </div>
                <div className="draft-recent-panel">
                  <p className="eyebrow">Recent Rival Claims</p>
                  {recentRivalClaims.length ? (
                    recentRivalClaims.map((wrestler) => (
                      <span key={wrestler.id}>
                        <strong>{wrestler.name}</strong>
                        <small>{getDraftTag(wrestler.sourceBrand, "Open Pool")} / {getWrestlerOverall(wrestler)}</small>
                      </span>
                    ))
                  ) : (
                    <span>
                      <strong>No rival claims yet</strong>
                      <small>CPU boards move once your room starts taking shape.</small>
                    </span>
                  )}
                </div>
                <div className="draft-update-panel">
                  <p className="eyebrow">War Room Updates</p>
                  {rivalDraftActivity?.notes.length ? (
                    rivalDraftActivity.notes.slice(0, 3).map((note) => (
                      <span key={note.id}>
                        <strong>{note.brandName}</strong>
                        <small>{note.detail}</small>
                      </span>
                    ))
                  ) : (
                    <span>
                      <strong>Boards are quiet</strong>
                      <small>Rival desks are waiting for your first move.</small>
                    </span>
                  )}
                </div>
              </aside>
            </section>

            <section className="draft-war-bottom" aria-label="Draft support panels">
              <article className="draft-bottom-panel scouting">
                <p className="eyebrow">Scouting Report</p>
                {focusedDraftWrestler ? (
                  <>
                    <strong>{focusedDraftWrestler.name}</strong>
                    <span>{getDraftTag(focusedDraftIdentity?.wrestlingStyle, "Ring style")} / {getDraftTag(focusedDraftIdentity?.promoStyle, "Promo style")}</span>
                    <small>{getDraftTag(focusedDraftWrestler.division)} roster fit with {focusedDraftWrestler.popularity} popularity and {focusedDraftWrestler.momentum} momentum.</small>
                  </>
                ) : (
                  <small>No scouting file selected.</small>
                )}
              </article>
              <article className="draft-bottom-panel needs">
                <p className="eyebrow">Roster Needs</p>
                {draftedRosterNeedRows.map((row) => (
                  <span key={row.label}>
                    <strong>{row.label}</strong>
                    <em>{row.count}/{row.target}</em>
                    <i style={{ width: `${Math.min(100, Math.round((row.count / row.target) * 100))}%` }} />
                  </span>
                ))}
              </article>
              <article className="draft-bottom-panel budget">
                <p className="eyebrow">Budget Overview</p>
                <span>Starting <strong>{draftFinanceReadout.isUnlimitedBudget ? "Unlimited" : formatMoney(draftFinanceReadout.startingBudgetAmount)}</strong></span>
                <span>Roster Value <strong>{formatMoney(draftFinanceReadout.rosterValue)}</strong></span>
                <span>Remaining <strong>{formatProjectedReserve(draftFinanceReadout)}</strong></span>
              </article>
              <article className="draft-bottom-panel info">
                <p className="eyebrow">Draft Information</p>
                <strong>{draftedWrestlers.length + 1 > draftPickCount ? draftPickCount : draftedWrestlers.length + 1} / {draftPickCount}</strong>
                <small>{activeDraftFilters.length ? activeDraftFilters.join(" / ") : "Open Board"}</small>
                <div className="draft-pick-dots">
                  {Array.from({ length: draftPickCount }).map((_, index) => (
                    <span className={index < draftedWrestlers.length ? "filled" : ""} key={index} />
                  ))}
                </div>
              </article>
              <article className="draft-bottom-panel up-next">
                <p className="eyebrow">Up Next</p>
                <div>
                  {upNextRivals.map((brand) => (
                    <span key={brand.id}>{brand.brandName}</span>
                  ))}
                </div>
              </article>
              <article className="draft-bottom-panel drafted-mini">
                <div>
                  <p className="eyebrow">Drafted Roster</p>
                  <button className="secondary-action" disabled={!draftedWrestlers.length} onClick={undoLastPick}>
                    Undo Pick
                  </button>
                </div>
                <section>
                  {draftedWrestlers.length ? (
                    draftedWrestlers.map((wrestler, index) => (
                      <span key={wrestler.id}>
                        <strong>{index + 1}. {wrestler.name}</strong>
                        <small>{getDraftTag(wrestler.roleTier)} / {getWrestlerOverall(wrestler)}</small>
                      </span>
                    ))
                  ) : (
                    <small>No picks made yet.</small>
                  )}
                </section>
              </article>
            </section>
          </div>
        ) : null}

          </div>

          {step === "draft" ? null : (
          <aside className="setup-summary-rail" aria-label="Career setup summary">
            <p className="eyebrow">Career Summary</p>
            <h2>{signedBrandName}</h2>
            <div className="setup-summary-list">
              <article>
                <span>GM</span>
                <strong>{signedGmName}</strong>
                <small>{gmStyle}</small>
              </article>
              <article>
                <span>Brand Chair</span>
                <strong>{brandStyle}</strong>
                <small>{selectedBrandStyle.description}</small>
              </article>
              <article>
                <span>Rules</span>
                <strong>{difficulty}</strong>
                <small>{formatStartingBudgetReadout(startingBudgetTier, startingBudgetAmount)} opening budget</small>
              </article>
              <article>
                <span>Draft</span>
                <strong>{draftedWrestlers.length}/{draftPickCount}</strong>
                <small>{picksRemaining ? `${picksRemaining} picks left` : "Ready for Week 1"}</small>
              </article>
              <article>
                <span>Season</span>
                <strong>12 Weeks</strong>
                <small>PLEs in Weeks 4, 8, and 12</small>
              </article>
            </div>
            <div className="setup-rival-summary">
              <span>Rival Chairs</span>
              <strong>{previewRivalBrands.length ? `${previewRivalBrands.length} assigned` : "Pending"}</strong>
              <small>{rivalSummary || "Choose a brand to fill the other desks."}</small>
            </div>
          </aside>
          )}
        </div>
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

function formatRivalTrend(trend: RivalBrandState["seasonTrend"]) {
  switch (trend) {
    case "surging":
      return "Surging";
    case "slipping":
      return "Slipping";
    case "steady":
      return "Steady";
    default:
      return "Unranked";
  }
}

function RatingsBattlePanel({ compact = false, snapshot }: { compact?: boolean; snapshot: RatingsBattleSnapshot }) {
  const playerEntry = snapshot.entries.find((entry) => entry.isPlayer);
  const visibleEntries = compact ? snapshot.entries.slice(0, 4) : snapshot.entries;

  return (
    <section className={`ratings-battle-panel${compact ? " compact" : ""}`} aria-label="Ratings battle standings">
      <div className="ratings-battle-head">
        <div>
          <p className="eyebrow">Ratings Battle</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>{snapshot.latestWeekLabel}</strong>
      </div>
      <p className="ratings-battle-copy">{snapshot.detail}</p>
      <div className="ratings-battle-summary">
        <Metric label="Your Rank" value={`#${snapshot.playerRank}`} detail={playerEntry ? `Average ${playerEntry.seasonAverage}` : "No player average"} />
        <Metric label="Leader" value={snapshot.leaderName} detail="Season average race" />
        <Metric label="Vs Nearest CPU" value={`${snapshot.playerDelta >= 0 ? "+" : ""}${snapshot.playerDelta}`} detail="Average score margin" />
      </div>
      <div className="ratings-battle-table">
        {visibleEntries.map((entry) => (
          <article className={`ratings-battle-row ${entry.isPlayer ? "is-player" : ""} trend-${entry.trend}`} key={entry.id}>
            <span>#{entry.rank}</span>
            <div>
              <strong>{entry.brandName}</strong>
              <small>{entry.isPlayer ? `GM ${entry.gmName}` : `${entry.gmName} · ${formatRivalTrend(entry.trend)}`}</small>
            </div>
            <div>
              <strong>{entry.latestScore ?? "No Show"}</strong>
              <small>Avg {entry.seasonAverage || "n/a"}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CpuResultsFeedPanel({ compact = false, snapshot }: { compact?: boolean; snapshot: CpuResultsFeedSnapshot }) {
  const visibleItems = compact ? snapshot.items.slice(0, 3) : snapshot.items;

  return (
    <section className={`cpu-results-feed${compact ? " compact" : ""}`} aria-label="CPU results feed">
      <div className="cpu-results-head">
        <div>
          <p className="eyebrow">CPU Results Feed</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>{visibleItems.filter((item) => item.score !== undefined).length} Live Desks</strong>
      </div>
      <p className="cpu-results-copy">{snapshot.detail}</p>
      <div className="cpu-results-list">
        {visibleItems.map((item) => (
          <article className={`cpu-results-card tone-${item.tone}`} key={item.id}>
            <div className="cpu-results-card-head">
              <div>
                <span>{item.brandName}</span>
                <strong>{item.headline}</strong>
              </div>
              <b>{item.score ?? "Hidden"}</b>
            </div>
            <p>{item.detail}</p>
            {!compact && item.segments.length ? (
              <div className="cpu-segment-strip">
                {item.segments.slice(0, 4).map((segment) => (
                  <span key={segment.id}>
                    {segment.type} {segment.score}
                  </span>
                ))}
              </div>
            ) : null}
            {item.notes.length ? (
              <div className="cpu-results-notes">
                {item.notes.slice(0, compact ? 2 : 5).map((note, index) => (
                  <small key={`${item.id}-note-${index}`}>{note}</small>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function RivalIntelligencePanel({ compact = false, game }: { compact?: boolean; game: GameState }) {
  const snapshot = getMarketSnapshot(game, draftPool);
  const office = game.marketState.officeMandate;
  const rivalEvents = getRivalMarketEvents(game).slice(0, compact ? 2 : 5);
  const latestMove = snapshot.latestTransaction?.note ?? "No market move has resolved yet.";

  return (
    <section className={`rival-intel-panel mandate-${office.mandateStatus}${compact ? " compact" : ""}`} aria-label="Rival intelligence">
      <div className="rival-intel-head">
        <div>
          <p className="eyebrow">Rival Intelligence</p>
          <h3>{office.mandateStatus === "critical" ? "Office Heat Rising" : office.mandateStatus === "surging" ? "Office Backing Strong" : "Market Race Active"}</h3>
        </div>
        <strong>{office.mandateStatus.toUpperCase()}</strong>
      </div>
      <p>{latestMove}</p>
      <div className="rival-intel-grid">
        <Metric label="Owner Trust" value={`${office.ownerTrust}`} />
        <Metric label="Reputation" value={`${office.brandReputation}`} />
        <Metric label="Payroll" value={formatMoney(snapshot.payroll)} />
        <Metric label="Open Market" value={`${snapshot.freeAgents.length}`} />
      </div>
      {!compact && rivalEvents.length ? (
        <div className="rival-intel-feed">
          {rivalEvents.map((event) => (
            <article key={event.id}>
              <span>
                S{event.seasonNumber} W{event.weekNumber} · {event.type}
              </span>
              <strong>{event.wrestlerNames.join(" / ")}</strong>
              <p>{event.note}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WeeklyDecisionPressurePanel({ compact = false, snapshot }: { compact?: boolean; snapshot: WeeklyDecisionPressureSnapshot }) {
  return (
    <section className={`weekly-pressure-panel${compact ? " compact" : ""}`} aria-label="GM desk brief">
      <div className="weekly-pressure-head">
        <div>
          <p className="eyebrow">GM Desk Brief</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>This Week's Pressure</strong>
      </div>
      <p className="weekly-pressure-copy">{snapshot.detail}</p>
      <div className="weekly-pressure-grid">
        {snapshot.items.map((item) => (
          <article className={`weekly-pressure-item tone-${item.tone}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LivingWorldPressurePanel({ snapshot }: { snapshot: LivingWorldPressureSnapshot }) {
  return (
    <section className="weekly-pressure-panel living-world-pressure-panel" aria-label="Living World Pressure">
      <div className="weekly-pressure-head">
        <div>
          <p className="eyebrow">Living World Pressure</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>Who Is Watching</strong>
      </div>
      <p className="weekly-pressure-copy">{snapshot.weekRead}</p>
      <div className="status-grid" aria-label="Living world summary">
        <Metric label="Watching" value={snapshot.whoIsWatching} />
        <Metric label="Risk" value={snapshot.riskRead} />
        <Metric label="Next Move" value={snapshot.nextAction} />
      </div>
      <div className="weekly-pressure-grid">
        {snapshot.items.map((item) => (
          <article className={`weekly-pressure-item tone-${item.tone}`} key={item.id}>
            <span>{item.voice} · {item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
            <small>{item.action}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function WeekReviewHandoffPanel({ snapshot }: { snapshot: WeekReviewHandoffSnapshot }) {
  return (
    <section className="week-handoff-panel" aria-label="Next week setup">
      <div className="week-handoff-head">
        <div>
          <p className="eyebrow">GM Handoff</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>Next Week Setup</strong>
      </div>
      <p className="week-handoff-copy">{snapshot.detail}</p>
      <div className="week-handoff-grid">
        {snapshot.items.map((item) => (
          <article className={`week-handoff-item item-${item.tone}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function WeekReviewOfficePanel({ snapshot }: { snapshot: WeekReviewOfficeSnapshot }) {
  return (
    <section className="week-office-panel" aria-label="GM office after-action">
      <div className="week-office-head">
        <div>
          <p className="eyebrow">GM Office Readout</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>After-Action</strong>
      </div>
      <p className="week-office-copy">{snapshot.detail}</p>
      <div className="week-office-grid">
        {snapshot.items.map((item) => (
          <article className={`week-office-item item-${item.tone}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PleBuildPressurePanel({ compact = false, snapshot }: { compact?: boolean; snapshot: PleBuildPressureSnapshot }) {
  return (
    <section className={`ple-build-panel${compact ? " compact" : ""}`} aria-label="PLE build pressure">
      <div className="ple-build-head">
        <div>
          <p className="eyebrow">PLE Build Pressure</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>{snapshot.phaseLabel}</strong>
      </div>
      <p className="ple-build-copy">{snapshot.detail}</p>
      <div className="ple-build-grid">
        {snapshot.items.map((item) => (
          <article className={`ple-build-item item-${item.tone}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      {!compact ? <p className="ple-build-note">{snapshot.spoilerNote}</p> : null}
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
        <Metric label="Projected Reserve" value={formatProjectedReserve(readout)} detail="Carries into Week 1 money" />
        <Metric label="Reserve Pressure" value={readout.pressureLabel} detail="No pick is blocked" />
      </div>
      <p>{getDraftFinanceNote(readout)}</p>
    </section>
  );
}

function RivalDraftActivityPanel({ snapshot }: { snapshot: CpuDraftPreviewSnapshot }) {
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
  const lastShow = game.showHistory[game.showHistory.length - 1];
  const validShowSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));
  const validSegments = validShowSegments.length;
  const invalidSegments = game.currentShow.length - validSegments;
  const averageFatigue = game.wrestlers.length ? Math.round(game.wrestlers.reduce((sum, wrestler) => sum + wrestler.fatigue, 0) / game.wrestlers.length) : 0;
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
  const latestFinanceReport = getLatestFinanceReport(game);
  const pressureLabel = getFinancePressureLabel(game.money, latestFinanceReport?.profitLoss ?? 0);
  const isPleWeek = currentShow.showType === "ple";
  const weeklyDecisionPressure = getWeeklyDecisionPressureSnapshot(game, latestResult);
  const pleBuildPressure = getPleBuildPressureSnapshot(game, validShowSegments);
  const livingWorldPressure = getLivingWorldPressureSnapshot(game, lastShow);
  const brandPulseSnapshot = getBrandPulseSnapshot(game, latestResult);
  const ratingsBattle = getRatingsBattleSnapshot(game, latestResult);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, latestResult);
  const rivalBrands = game.rivalBrands?.length ? game.rivalBrands : createRivalBrandUniverse(game.rivalGMAssignments);
  const latestSocialPost = game.socialPosts[game.socialPosts.length - 1];
  const financePresenceRead = getFinancePresenceRead(game.money, pressureLabel, latestFinanceReport);
  const rosterPressureTags = game.wrestlers.flatMap((wrestler) => getRosterPressureTags(wrestler, game.currentWeek));
  const rosterPressureCount = (tag: RosterPressureTag) => rosterPressureTags.filter((item) => item === tag).length;
  const overusedCount = rosterPressureCount("Overused");
  const underusedCount = rosterPressureCount("Underused");
  const protectedStarCount = rosterPressureCount("Protected Star");
  const moraleRiskCount = rosterPressureCount("Morale Risk");
  const injuryRiskCount = rosterPressureCount("Injury Risk");
  const minorInjuryCount = rosterPressureCount("Minor Injury");
  const unavailableCount = rosterPressureCount("Unavailable");
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const topMomentumTalent = [...game.wrestlers].sort((a, b) => b.momentum + b.popularity - (a.momentum + a.popularity))[0];
  const hotTalent = [...game.wrestlers].sort((a, b) => b.momentum + b.popularity - (a.momentum + a.popularity)).slice(0, 4);
  const atRisk = [...game.wrestlers].sort((a, b) => b.fatigue + (100 - b.morale) - (a.fatigue + (100 - a.morale))).slice(0, 4);
  const currentShowLabel = isPleWeek ? "Major Event" : getShowTypeLabel(currentShow.showType);
  const nextPleLabel = nextPle ? (weeksUntilPle === 0 ? "PLE Week" : `${weeksUntilPle} Week${weeksUntilPle === 1 ? "" : "s"} To ${nextPle.showName}`) : "Season End";
  const dashboardTheme = getBroadcastThemeForBrandStyle(game.brandStyle);
  const brandInitials = game.brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "HQ";
  const urgentStatus = hasCurrentWeekReview
    ? "Week Review Waiting"
    : validSegments >= 2
      ? "Card Runnable"
      : invalidSegments > 0
        ? "Card Needs Fixes"
        : "Booking Desk Open";
  const primaryActionScreen: GameScreen = hasCurrentWeekReview ? "weekReview" : "booking";
  const primaryActionLabel = hasCurrentWeekReview ? "Review Fallout" : validSegments >= 2 ? "Review Card" : "Book Show";
  const actionContext = hasCurrentWeekReview
    ? "Week Review is waiting before the office advances the calendar."
    : nextAction;
  const dashboardUrgentItems = weeklyDecisionPressure.items.slice(0, 3);
  const rosterHealthRead =
    unavailableCount > 0
      ? `${unavailableCount} unavailable`
      : injuryRiskCount + moraleRiskCount > 0
        ? `${injuryRiskCount + moraleRiskCount} watch`
        : "Room stable";
  const rosterHealthHudRead = unavailableCount > 0 ? `${unavailableCount} out` : injuryRiskCount + moraleRiskCount > 0 ? `${injuryRiskCount + moraleRiskCount} watch` : "Stable";
  const titleSceneRead = topTitlePressure?.primary.label ?? tagDivisionAttention?.label ?? "Scene steady";
  const rivalrySceneRead = focusRivalryTiming ? `${focusRivalryTiming.snapshot.primary.label} · Heat ${focusRivalryTiming.rivalry.heat}` : "No active rivalry";
  const financeStatusRead = latestFinanceReport ? `Latest P/L ${formatMoney(latestFinanceReport.profitLoss)}` : `${formatMoney(game.money)} available`;
  const compactDashboardRead = (read: string, limit = 76) => (read.length > limit ? `${read.slice(0, limit - 3)}...` : read);

  return (
    <main className={`app-shell gameplay-command-shell dashboard-command-shell broadcast-theme-${dashboardTheme}`} data-broadcast-theme={dashboardTheme}>
      <Header game={game} />
      <GameNav currentScreen="dashboard" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
      <section className="dashboard-command-room" aria-label="Brand HQ command center">
        <section className="dashboard-top-hud" aria-label="Brand HQ scoreboard">
          <div className="dashboard-brand-lockup">
            <div className="dashboard-brand-plate" aria-label={`${game.brandName} identity slot`}>
              <span>{brandInitials}</span>
            </div>
            <div>
              <span>Monday Night Brand</span>
              <strong>{game.brandName}</strong>
              <small>
                GM {game.gmName} · {game.gmStyle}
              </small>
            </div>
          </div>
          <div className="dashboard-hud-metrics" aria-label="Current brand readout">
            <Metric label="Money" value={formatMoney(game.money)} />
            <Metric label="Last Show" value={lastShow ? `${lastShow.totalScore} (${getShowGrade(lastShow.totalScore)})` : "No Result"} />
            <Metric label="Roster Health" value={rosterHealthHudRead} />
            <Metric label="Title Scene" value={titleSceneRead} />
          </div>
          <div className="dashboard-marquee" aria-label="Next show marquee">
            <span>Next Show</span>
            <strong>{currentShow.showName}</strong>
            <small>
              {currentShowLabel} · {nextPleLabel}
            </small>
          </div>
          <div className="dashboard-urgent-chip" data-state={hasCurrentWeekReview || invalidSegments > 0 ? "warning" : "ready"}>
            <span>Urgent Status</span>
            <strong>{urgentStatus}</strong>
          </div>
        </section>

        <section className="dashboard-main-console" aria-label="Brand HQ live desk">
          <aside className="dashboard-side-stack dashboard-left-rail" aria-label="Brand status rail">
            <article className="command-panel dashboard-rail-panel dashboard-status-panel">
              <div className="section-heading">
                <p className="eyebrow">Brand Status</p>
                <h3>Week {game.currentWeek} Readout</h3>
              </div>
              <div className="dashboard-stat-grid">
                <div>
                  <span>Show Phase</span>
                  <strong>{currentShowLabel}</strong>
                  <small>{currentShow.isGoHome ? "Go-home pressure" : nextPleLabel}</small>
                </div>
                <div>
                  <span>Finance</span>
                  <strong>{formatPressureLabel(pressureLabel)}</strong>
                  <small>{financeStatusRead}</small>
                </div>
                <div>
                  <span>Roster Health</span>
                  <strong>{rosterHealthRead}</strong>
                  <small>{averageFatigue >= 45 ? "Training room is busy" : "Load is controlled"}</small>
                </div>
                <div>
                  <span>Rivalry Heat</span>
                  <strong>{focusRivalryTiming ? focusRivalryTiming.rivalry.name : "Quiet Desk"}</strong>
                  <small>{rivalrySceneRead}</small>
                </div>
              </div>
              <p className="dashboard-panel-read">{weeklyDecisionPressure.detail}</p>
            </article>

            <article className="command-panel dashboard-rail-panel dashboard-title-panel">
              <div className="section-heading">
                <p className="eyebrow">Champions / Goals</p>
                <h3>{topChampionship?.name ?? "Title Office"}</h3>
              </div>
              <div className="dashboard-title-plate">
                <div className="dashboard-badge-slot">T</div>
                <div>
                  <span>Current Holder</span>
                  <strong>{topChampionship ? getWrestlerNames(topChampionship.championIds, game.wrestlers) : "No Champion"}</strong>
                  <small>{topTitlePressure?.primary.detail ?? topTitlePressure?.divisionHealth ?? "No active title pressure is demanding a booking promise."}</small>
                </div>
              </div>
              <div className="dashboard-mini-rows">
                <div>
                  <span>Contender Lane</span>
                  <strong>{topTitleContenders.map((wrestler) => wrestler.name).join(" / ") || "No Clear Lane"}</strong>
                </div>
                <div>
                  <span>Tag Division</span>
                  <strong>{tagDivisionAttention?.label ?? "Steady"}</strong>
                </div>
              </div>
            </article>
          </aside>

          <article className={`command-panel dashboard-primary-stage ${isPleWeek ? "ple-panel" : ""}`} aria-label="Current show focus">
            <div className="dashboard-stage-head">
              <div>
                <p className="eyebrow">Current Show Focus</p>
                <h2>{currentShow.showName}</h2>
                <p className="dashboard-focus-read">
              {isPleWeek
                ? `${currentShow.showName} is the season's major-event pulse. This desk is for card structure, visible pressure, and what the office needs to know before booking.`
                : `${currentShow.showName} is a ${currentShowLabel} stop${currentShow.isGoHome ? " and the last live wire before the next PLE." : " on the road to the next major event."}`}
                </p>
              </div>
              <div className="dashboard-show-art-slot" aria-label={`${currentShow.showName} show art slot`}>
                <span>{currentShowLabel}</span>
              </div>
            </div>
            <div className="dashboard-stage-metrics">
              <div>
                <span>Card Status</span>
                <strong>{validSegments >= 2 ? "Runnable" : "Needs Segments"}</strong>
                <small>{validSegments} ready / {invalidSegments} flagged</small>
              </div>
              <div>
                <span>PLE Timing</span>
                <strong>{nextPleLabel}</strong>
                <small>{pleBuildPressure.phaseLabel}</small>
              </div>
              <div>
                <span>Locker Room</span>
                <strong>{topMomentumTalent?.name ?? "No Roster"}</strong>
                <small>Top momentum {topMomentumTalent?.momentum ?? "n/a"}</small>
              </div>
              <div>
                <span>Office Pulse</span>
                <strong>{formatPressureLabel(pressureLabel)}</strong>
                <small>{latestFinanceReport ? `Latest P/L ${formatMoney(latestFinanceReport.profitLoss)}` : "No show books closed"}</small>
              </div>
            </div>
            <div className="dashboard-stage-rundown">
              <div className="section-heading">
                <p className="eyebrow">Production Rundown</p>
                <h3>{validSegments >= 2 ? "Broadcast-Ready Board" : "Open Booking Desk"}</h3>
              </div>
              <div className="dashboard-panel-scroll">
                {game.currentShow.length ? (
                  <div className="mini-card-list">
                    {game.currentShow.map((segment, index) => (
                      <div className="mini-card" key={segment.id}>
                        <span>
                          {String(index + 1).padStart(2, "0")} · {segment.type}
                        </span>
                        <strong>{getSegmentParticipantsLabel(segment, game.wrestlers)}</strong>
                        <small>{isValidSegment(segment, game.wrestlers) ? "Ready for TV" : getSegmentValidationWarning(segment, game.wrestlers)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty-slot">
                    <strong>Card spine is empty</strong>
                    <span>Book at least 2 valid segments. Open Challenge opponents stay hidden until show-run time.</span>
                  </div>
                )}
              </div>
            </div>
            <div className="dashboard-action-bar">
              <div>
                <span>Next Player Action</span>
                <strong>{actionContext}</strong>
              </div>
              <button className="primary-action" onClick={() => onNavigate(primaryActionScreen)}>
                {primaryActionLabel}
              </button>
              <button className="secondary-action" onClick={() => onNavigate("calendar")}>
                Calendar
              </button>
            </div>
          </article>

          <aside className="dashboard-side-stack dashboard-right-rail" aria-label="Urgent decisions and world pulse">
            <article className="command-panel dashboard-rail-panel dashboard-urgent-panel">
              <div className="section-heading">
                <p className="eyebrow">Urgent Decisions</p>
                <h3>{dashboardUrgentItems.length}</h3>
              </div>
              <div className="dashboard-decision-list">
                {dashboardUrgentItems.map((item, index) => (
                  <div className={`dashboard-decision-row tone-${item.tone}`} key={item.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{compactDashboardRead(item.detail)}</small>
                    </div>
                  </div>
                ))}
                {!dashboardUrgentItems.length ? (
                  <div className="dashboard-empty-slot">
                    <strong>No urgent reads</strong>
                    <span>Current state is quiet. Book the next show to create fresh fallout.</span>
                  </div>
                ) : null}
              </div>
            </article>

            <article className="command-panel dashboard-rail-panel dashboard-iwc-panel">
              <div className="section-heading">
                <p className="eyebrow">IWC / World Pulse</p>
                <h3>{brandPulseSnapshot?.headline ?? livingWorldPressure.headline}</h3>
              </div>
              <p className="dashboard-panel-read">{brandPulseSnapshot?.detail ?? livingWorldPressure.weekRead}</p>
              <div className="dashboard-mini-rows">
                <div>
                  <span>Living World</span>
                  <strong>{livingWorldPressure.whoIsWatching}</strong>
                </div>
                <div>
                  <span>Next Move</span>
                  <strong>{livingWorldPressure.nextAction}</strong>
                </div>
                <div>
                  <span>Rival Chairs</span>
                  <strong>{rivalBrands.length}</strong>
                </div>
                {latestSocialPost ? (
                  <div>
                    <span>IWC Buzz</span>
                    <strong>{formatSocialCategory(latestSocialPost.category)}</strong>
                  </div>
                ) : null}
              </div>
            </article>
            <RivalIntelligencePanel compact game={game} />
            {ratingsBattle ? <RatingsBattlePanel compact snapshot={ratingsBattle} /> : null}
            {cpuResultsFeed ? <CpuResultsFeedPanel compact snapshot={cpuResultsFeed} /> : null}
          </aside>
        </section>

        <section className="dashboard-bottom-telemetry" aria-label="Brand HQ telemetry boards">
          <article className="command-panel dashboard-telemetry-panel dashboard-roster-panel">
            <div className="section-heading">
              <p className="eyebrow">Roster Overview</p>
              <h3>{game.wrestlers.length} Signed</h3>
            </div>
            <div className="dashboard-pressure-tags">
              <span>Overused {overusedCount}</span>
              <span>Underused {underusedCount}</span>
              <span>Protected {protectedStarCount}</span>
              <span>Morale {moraleRiskCount}</span>
              <span>Injury {injuryRiskCount}</span>
              <span>Out {unavailableCount}</span>
            </div>
          </article>

          <article className="command-panel dashboard-telemetry-panel dashboard-locker-table">
            <div className="section-heading">
              <p className="eyebrow">Locker Room Table</p>
              <h3>Talent Watch</h3>
            </div>
            <div className="dashboard-table-list">
              {hotTalent.slice(0, 2).map((wrestler, index) => (
                <div className="dashboard-table-row" key={wrestler.id}>
                  <span>{index + 1}</span>
                  <strong>{wrestler.name}</strong>
                  <small>Mom {wrestler.momentum} · Pop {wrestler.popularity}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="command-panel dashboard-telemetry-panel dashboard-rivalry-panel">
            <div className="section-heading">
              <p className="eyebrow">Rivalry / Title Heat</p>
              <h3>{focusRivalryTiming ? focusRivalryTiming.rivalry.name : "Story Desk"}</h3>
            </div>
            <div className="dashboard-mini-rows">
              <div>
                <span>Rivalry Timing</span>
                <strong>{rivalrySceneRead}</strong>
              </div>
              <div>
                <span>Championship Desk</span>
                <strong>{titleSceneRead}</strong>
              </div>
              <div>
                <span>PLE Build</span>
                <strong>{pleBuildPressure.phaseLabel}</strong>
              </div>
            </div>
          </article>
        </section>

      </section>
    </main>
  );
}

function BookingScreen({
  focusSegmentId,
  game,
  isQaHarness,
  onBuildTitleMatch,
  onConsumeFocusSegment,
  onAddSegment,
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
  focusSegmentId?: string;
  game: GameState;
  isQaHarness?: boolean;
  onBuildTitleMatch: (segmentId: string, championshipId: string) => void;
  onConsumeFocusSegment: () => void;
  onAddSegment: (type: SegmentType, segmentId?: string) => void;
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
  const [bookingMode, setBookingMode] = useState<"board" | "setup">("board");
  const [setupDraftSegmentId, setSetupDraftSegmentId] = useState<string | undefined>();
  const [setupEmptySlotNumber, setSetupEmptySlotNumber] = useState<number | undefined>();
  const [productionDetailsOpen, setProductionDetailsOpen] = useState(false);
  const [smartRundownError, setSmartRundownError] = useState("");
  const [pendingClearCard, setPendingClearCard] = useState(false);
  const validShowSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));
  const validSegments = validShowSegments.length;
  const invalidSegments = game.currentShow.length - validSegments;
  const calendarWeek = getCurrentCalendarWeek(game);
  const runtimeMinutes = game.currentShow.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const validRuntimeMinutes = validShowSegments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const hasCurrentWeekReview = game.showHistory[game.showHistory.length - 1]?.week === game.currentWeek;
  const runtimePercent = Math.min(100, Math.round((validRuntimeMinutes / showRuntimeTargetMinutes) * 100));
  const readiness = getShowReadiness(validSegments, invalidSegments, validRuntimeMinutes);
  const canRunShow = readiness.canRun;
  const composerSegment = game.currentShow.find((segment) => segment.id === composerSegmentId);
  const bookedCounts = game.currentShow.reduce<Record<string, number>>((counts, segment) => {
    segment.participantIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, {});
  const bookedWrestlerIds = new Set(game.currentShow.flatMap((segment) => segment.participantIds));
  const bookedWrestlers = game.wrestlers.filter((wrestler) => bookedWrestlerIds.has(wrestler.id));
  const missingMajorStars = game.wrestlers.filter((wrestler) => isMajorEventStar(wrestler) && !bookedWrestlerIds.has(wrestler.id));
  const riskRows = bookedWrestlers
    .map((wrestler) => ({
      reads: getBookingWrestlerRiskReads(wrestler, bookedCounts[wrestler.id] ?? 0),
      wrestler,
    }))
    .filter((item) => item.reads.length);
  const bookedRosterCount = bookedWrestlerIds.size;
  const unusedRosterCount = Math.max(0, game.wrestlers.length - bookedRosterCount);
  const topUnusedWrestler = getTopUnderusedWrestler(
    game.wrestlers.filter((wrestler) => !bookedCounts[wrestler.id]),
    game.currentWeek,
  );
  const rivalrySegmentCount = game.currentShow.filter((segment) => Boolean(segment.rivalryId)).length;
  const titleContextCount = game.currentShow.filter((segment) => Boolean(segment.championshipId)).length;
  const cardStatus = getBookingCardStatus(game.currentShow.length, invalidSegments, readiness);
  const cardBoardSlots = getBookingBoardSlots(game.currentShow);
  const rosterDeskRead = topUnusedWrestler
    ? `${unusedRosterCount} roster member${unusedRosterCount === 1 ? "" : "s"} unused tonight. ${topUnusedWrestler.name} has been off TV for ${formatWeekCount(getWeeksSinceLastBooked(topUnusedWrestler, game.currentWeek))}.`
    : `${unusedRosterCount} roster member${unusedRosterCount === 1 ? "" : "s"} unused tonight. No long-absence pressure is surfacing from current roster history.`;
  const producerNote = getBookingProducerNote({
    missingMajorStars,
    readiness,
    riskCount: riskRows.length,
    rivalrySegmentCount,
    segmentCount: game.currentShow.length,
    titleContextCount,
  });

  function beginAddSegment(type: SegmentType) {
    const segmentId = `segment-${Date.now()}-${game.currentShow.length}`;
    onAddSegment(type, segmentId);
    setComposerSegmentId(segmentId);
    setSetupDraftSegmentId(segmentId);
    setSetupEmptySlotNumber(undefined);
    setBookingMode("setup");
    setPendingClearCard(false);
  }

  function removeAndClose(segmentId: string) {
    onRemoveSegment(segmentId);
    if (composerSegmentId === segmentId) {
      setComposerSegmentId(undefined);
      setBookingMode("board");
      setSetupDraftSegmentId(undefined);
      setSetupEmptySlotNumber(undefined);
    }
  }

  function openEmptySlot(slotNumber: number) {
    setComposerSegmentId(undefined);
    setSetupDraftSegmentId(undefined);
    setSetupEmptySlotNumber(slotNumber);
    setBookingMode("setup");
    setPendingClearCard(false);
  }

  function openExistingSegment(segmentId: string) {
    setComposerSegmentId(segmentId);
    setSetupDraftSegmentId(undefined);
    setSetupEmptySlotNumber(undefined);
    setBookingMode("setup");
    setPendingClearCard(false);
  }

  useEffect(() => {
    if (!focusSegmentId || !game.currentShow.some((segment) => segment.id === focusSegmentId)) {
      return;
    }

    openExistingSegment(focusSegmentId);
    onConsumeFocusSegment();
  }, [focusSegmentId, game.currentShow, onConsumeFocusSegment]);

  function returnToCardBoard() {
    setBookingMode("board");
    setComposerSegmentId(undefined);
    setSetupDraftSegmentId(undefined);
    setSetupEmptySlotNumber(undefined);
  }

  function cancelSegmentSetup() {
    if (setupDraftSegmentId) {
      onRemoveSegment(setupDraftSegmentId);
    }

    returnToCardBoard();
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
    const participantsFit = rivalry ? rivalry.participantIds.length >= range.min && rivalry.participantIds.length <= range.max : false;
    const canPrefill =
      rivalry &&
      segment.type !== "Open Challenge" &&
      participantsFit &&
      !isRivalryIntergenderBlocked(rivalry, game.wrestlers) &&
      rivalry.participantIds.every((id) => game.wrestlers.some((wrestler) => wrestler.id === id && wrestler.injuryStatus !== "major")) &&
      !hasIntergenderMatchParticipants({ ...segment, participantIds: rivalry.participantIds }, game.wrestlers);

    if (canPrefill && rivalry) {
      onUpdateSegment(segment.id, { rivalryId, participantIds: [...rivalry.participantIds] });
      return;
    }

    onSetSegmentRivalry(segment.id, rivalryId);
  }

  function generateSmartRundown() {
    const result = buildSmartRundown(game);

    if (result.error) {
      setSmartRundownError(result.error);
      setProductionDetailsOpen(true);
      return;
    }

    onReplaceCurrentShow(result.segments);
    setComposerSegmentId(undefined);
    setSetupDraftSegmentId(undefined);
    setSetupEmptySlotNumber(undefined);
    setBookingMode("board");
    setSmartRundownError("");
    setPendingClearCard(false);
    setProductionDetailsOpen(false);
  }

  function confirmClearCard() {
    onReplaceCurrentShow([]);
    setComposerSegmentId(undefined);
    setSetupDraftSegmentId(undefined);
    setSetupEmptySlotNumber(undefined);
    setBookingMode("board");
    setSmartRundownError("");
    setPendingClearCard(false);
  }

  return (
    <main className={`app-shell gameplay-command-shell booking-app-shell ${productionDetailsOpen ? "producer-note-expanded" : ""}`}>
      <Header game={game} />
      <GameNav currentScreen="booking" hasResults={Boolean(game.showHistory.length)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
      {isQaHarness ? (
        <section className="qa-harness-banner" aria-label="QA harness notice">
          <strong>QA Runtime Harness</strong>
          <span>In-memory fixture. Real career saves are not updated from this session.</span>
        </section>
      ) : null}

      {bookingMode === "board" ? (
        <>
          <section className="booking-controls" aria-label="Booking controls">
            <button className="secondary-action" onClick={generateSmartRundown}>
              Generate Smart Rundown
            </button>
            <button className="danger-action" disabled={!game.currentShow.length} onClick={() => setPendingClearCard(true)}>
              Remove All
            </button>
          </section>

          {pendingClearCard ? (
            <section className="clear-card-warning" aria-label="Confirm remove all card segments">
              <div>
                <span>Clear Card?</span>
                <strong>Remove every booked slot from tonight's card.</strong>
                <small>This only clears the current rundown. Results, roster, championships, and rivalries stay untouched.</small>
              </div>
              <div className="clear-card-actions">
                <button className="danger-action" onClick={confirmClearCard}>
                  Confirm Remove All
                </button>
                <button className="secondary-action" onClick={() => setPendingClearCard(false)}>
                  Keep Card
                </button>
              </div>
            </section>
          ) : null}

          <section className={`booking-card-board-panel status-${cardStatus.tone}`} aria-label="Booking card board">
            <div className="booking-card-board-head">
              <div>
                <p className="eyebrow">Card Board</p>
                <h3>{calendarWeek.showName} Slots</h3>
              </div>
              <button className="run-show-action board-run-show-action" disabled={!canRunShow} onClick={onRunShow}>
                Run Show
              </button>
            </div>

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
                <div>
                  <span>Ready Time</span>
                  <strong>{validRuntimeMinutes} min</strong>
                </div>
                <div>
                  <span>Segments</span>
                  <strong>{validSegments}/{game.currentShow.length || 0}</strong>
                </div>
                <div>
                  <span>Planned</span>
                  <strong>{runtimeMinutes} min</strong>
                </div>
                <div>
                  <span>Window</span>
                  <strong>{showRuntimeMinMinutes}-{tvRuntimeWarningMinutes} min</strong>
                </div>
              </div>
            </section>

            <div className="booking-slot-grid" aria-label="Numbered card slots">
                {cardBoardSlots.map((slot) => {
                  const segment = slot.segment;
                  const valid = segment ? isValidSegment(segment, game.wrestlers) : false;

                  return (
                  <article
                    className={`booking-slot ${segment ? "filled" : "empty"} ${valid ? "valid" : ""} ${segment && !valid ? "invalid" : ""} ${slot.isBuildable ? "buildable" : ""}`}
                    key={slot.id}
                  >
                    <div className="booking-slot-topline">
                      <span>Slot {String(slot.slotNumber).padStart(2, "0")}</span>
                      <strong>{segment ? (valid ? "Ready" : "Needs Fix") : slot.isBuildable ? "Open" : "Queued"}</strong>
                    </div>
                    {segment ? (
                      <>
                        <h3>{segment.segmentDisplayName ?? segment.type}</h3>
                        <p>{getSegmentParticipantsLabel(segment, game.wrestlers) || getSegmentValidationWarning(segment, game.wrestlers)}</p>
                        <div className="booking-slot-flags">
                          {getBookingSegmentBoardFlags(segment, game).map((flag) => (
                            <span key={flag}>{flag}</span>
                          ))}
                        </div>
                        <div className="booking-slot-actions">
                          <button className="secondary-action" onClick={() => openExistingSegment(segment.id)}>
                            Edit Slot
                          </button>
                          <button className="danger-action" onClick={() => removeAndClose(segment.id)}>
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3>{slot.isBuildable ? "Open Card Position" : "Standby Position"}</h3>
                        <p>{slot.isBuildable ? "Choose this slot to set up the next segment." : "This position opens after the previous slot is booked."}</p>
                        <button className="primary-action" disabled={!slot.isBuildable} onClick={() => openEmptySlot(slot.slotNumber)}>
                          Build Slot {slot.slotNumber}
                        </button>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className={`production-details-panel ${productionDetailsOpen ? "open" : ""}`} aria-label="Producer note">
            <button className="production-details-toggle" onClick={() => setProductionDetailsOpen((open) => !open)} type="button">
              <span>Producer Note</span>
              <strong>{productionDetailsOpen ? "Hide" : "Show"}</strong>
            </button>

            {productionDetailsOpen ? (
              <div className="production-details-grid">
                <div className="producer-note" aria-label="Producer note">
                  <span>Producer Note</span>
                  <p>{smartRundownError || producerNote}</p>
                  {smartRundownError ? null : topUnusedWrestler ? <small>{rosterDeskRead}</small> : null}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="focused-setup-shell" aria-label="Focused segment setup">
          <div className="focused-setup-head">
            <button className="secondary-action" onClick={cancelSegmentSetup}>
              Back To Card Board
            </button>
            <div>
              <p className="eyebrow">Focused Segment Setup</p>
              <h3>{composerSegment ? `Slot ${Math.max(1, game.currentShow.findIndex((segment) => segment.id === composerSegment.id) + 1)}` : `Slot ${setupEmptySlotNumber ?? game.currentShow.length + 1}`}</h3>
              <p>
                {composerSegment
                  ? "Set format, time, talent, title context, and story context before sending this slot back to the board."
                  : "Choose the segment type for this card position."}
              </p>
            </div>
            <strong>{readiness.status}</strong>
          </div>

          {composerSegment ? (
            <SegmentComposer
              championships={game.championships}
              game={game}
              onApplyCatalogOption={(option) => applyCatalogOption(composerSegment, option)}
              onBuildTitleMatch={onBuildTitleMatch}
              onSetSegmentStipulation={(segmentId, stipulationId) => onSetSegmentStipulation(segmentId, stipulationId)}
              onCancel={cancelSegmentSetup}
              onClose={returnToCardBoard}
              onOpenProfile={onOpenProfile}
              onRemoveSegment={() => removeAndClose(composerSegment.id)}
              onSetDuration={(durationMinutes) => onUpdateSegment(composerSegment.id, { durationMinutes })}
              onSetSegmentChampionship={onSetSegmentChampionship}
              onSetSegmentRivalry={(rivalryId) => setComposerRivalry(composerSegment, rivalryId)}
              onToggleParticipant={onToggleParticipant}
              rivalries={game.rivalries}
              saveLabel="Save To Card Board"
              segment={composerSegment}
              wrestlers={game.wrestlers}
            />
          ) : (
            <section className="segment-type-stage" aria-label="Choose segment type">
              <div>
                <p className="eyebrow">Segment Type</p>
                <h3>Build Slot {setupEmptySlotNumber ?? game.currentShow.length + 1}</h3>
                <p>Pick the production format. The existing setup controls open next and still own validation.</p>
              </div>
              <div className="segment-type-grid">
                {bookingSegmentTypes.map((type) => (
                  <button disabled={game.currentShow.length >= maxBookingSegments} key={type} onClick={() => beginAddSegment(type)}>
                    <span>{type}</span>
                    <small>{getSegmentDescription(type)}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      )}
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
  championships,
  game,
  onApplyCatalogOption,
  onBuildTitleMatch,
  onCancel,
  onClose,
  onOpenProfile,
  onRemoveSegment,
  onSetDuration,
  onSetSegmentChampionship,
  onSetSegmentStipulation,
  onSetSegmentRivalry,
  onToggleParticipant,
  rivalries,
  saveLabel = "Set Rundown Slot",
  segment,
  wrestlers,
}: {
  championships: Championship[];
  game: GameState;
  onApplyCatalogOption: (option: SegmentCatalogOption) => void;
  onBuildTitleMatch: (segmentId: string, championshipId: string) => void;
  onCancel?: () => void;
  onClose: () => void;
  onOpenProfile: (wrestlerId: string) => void;
  onRemoveSegment: () => void;
  onSetDuration: (durationMinutes: number) => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentStipulation: (segmentId: string, stipulationId: string) => void;
  onSetSegmentRivalry: (rivalryId: string) => void;
  onToggleParticipant: (segmentId: string, wrestlerId: string) => void;
  rivalries: Rivalry[];
  saveLabel?: string;
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
        <button className="secondary-action" onClick={onCancel ?? onClose}>
          Back
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

      {segment.type === "Match" ? (
        <div className="composer-block segment-stipulation">
          <div>
            <span>Match Stipulation</span>
            <strong>{selectedStipulation ? selectedStipulation.label : "Optional presentation context only"}</strong>
          </div>
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
        </div>
      ) : null}

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
      <TitleMatchControl
        championships={championships}
        game={game}
        onBuildTitleMatch={onBuildTitleMatch}
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
                    {wrestler.injuryStatus !== "healthy" ? ` · ${getInjuryStatusLabel(wrestler.injuryStatus)} · ${getInjuryDetail(wrestler)}` : ""}
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
          {saveLabel}
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
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWrestlerId, setSelectedWrestlerId] = useState(game.wrestlers[0]?.id ?? "");
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const rosterAffiliations = getRosterAffiliations(game.wrestlers);
  const visibleWrestlers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...game.wrestlers]
      .filter((wrestler) => getRosterFilterMatch(filter, wrestler, game))
      .filter((wrestler) => {
        if (!normalizedSearch) {
          return true;
        }

        return [wrestler.name, wrestler.roleTier, wrestler.archetype, wrestler.sourceBrand, wrestler.division]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [filter, game, searchQuery, sortBy]);
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const featuredAffiliations = rosterAffiliations
    .filter((affiliation) => affiliation.memberWrestlerIds.length > 1)
    .slice(0, 3);
  const moraleTrend = getRosterMoraleTrend(game);
  const moraleTrendLine = getMoraleTrendSvgPoints(moraleTrend);
  const averageMorale = moraleTrend[moraleTrend.length - 1]?.value ?? getAverageRosterMorale(game.wrestlers);
  const selectedWrestler = visibleWrestlers.find((wrestler) => wrestler.id === selectedWrestlerId) ?? visibleWrestlers[0] ?? game.wrestlers[0];
  const selectedPressureTags = selectedWrestler ? getRosterPressureTags(selectedWrestler, game.currentWeek) : [];
  const selectedValueProfile = selectedWrestler ? getWrestlerValueProfile(selectedWrestler) : undefined;
  const selectedIdentity = selectedWrestler ? getWrestlerIdentitySnapshot(selectedWrestler, game) : undefined;
  const selectedLockerRead = selectedWrestler ? getWrestlerLockerRoomRead(selectedWrestler, game) : undefined;
  const selectedChampionships = selectedWrestler ? getWrestlerChampionships(selectedWrestler.id, game.championships) : [];
  const selectedAffiliations = selectedWrestler ? rosterAffiliations.filter((affiliation) => affiliation.memberWrestlerIds.includes(selectedWrestler.id)) : [];
  const injuryWatch = game.wrestlers
    .filter((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"))
    .sort((a, b) => b.fatigue - a.fatigue)
    .slice(0, 4);
  const filterOptions: RosterFilter[] = ["all", "mens", "womens", "champions", "injured", "hot", "tired", "morale", "underused"];
  const sortOptions: RosterSort[] = ["momentum", "popularity", "fatigue", "morale"];
  const filterCounts = filterOptions.reduce(
    (counts, option) => ({
      ...counts,
      [option]: game.wrestlers.filter((wrestler) => getRosterFilterMatch(option, wrestler, game)).length,
    }),
    {} as Record<RosterFilter, number>,
  );

  return (
    <main className="app-shell gameplay-command-shell roster-command-shell">
      <Header game={game} />
      <GameNav currentScreen="roster" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />

      <section className="roster-command-board" aria-label="Locker Room command board">
        <aside className="roster-filter-rail" aria-label="Roster filters">
          <div className="roster-rail-title">
            <p className="eyebrow">Filters</p>
            <strong>{game.wrestlers.length} Signed</strong>
          </div>
          <div className="roster-filter-stack">
            {filterOptions.map((option) => (
              <button className={filter === option ? "active-filter" : ""} key={option} onClick={() => setFilter(option)}>
                <span>{getRosterFilterLabel(option)}</span>
                <strong>{filterCounts[option]}</strong>
              </button>
            ))}
          </div>
          <div className="roster-sort-box">
            <span>Sort By</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as RosterSort)}>
              {sortOptions.map((option) => (
                <option key={option} value={option}>
                  {getRosterSortLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="roster-quick-reads">
            <p className="eyebrow">Quick Reads</p>
            <span>{topOverused ? `${topOverused.name} needs protection` : "No overuse spike"}</span>
            <span>{topUnderused ? `${topUnderused.name} needs TV time` : "No long absence"}</span>
            <span>{featuredAffiliations.length ? `${featuredAffiliations.length} team links visible` : "No team links drafted"}</span>
          </div>
        </aside>

        <section className="roster-board-stage" aria-label="Superstar board">
          <div className="roster-board-toolbar">
            <div>
              <h2>Superstars ({visibleWrestlers.length})</h2>
            </div>
            <label className="roster-search-field">
              <span>Search</span>
              <input
                aria-label="Search superstars"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search superstars..."
                type="search"
                value={searchQuery}
              />
            </label>
          </div>

          <div className="roster-grid" aria-label="Roster list">
            {visibleWrestlers.length ? (
              visibleWrestlers.map((wrestler) => (
                <WrestlerCard
                  game={game}
                  isSelected={selectedWrestler?.id === wrestler.id}
                  key={wrestler.id}
                  onSelectWrestler={setSelectedWrestlerId}
                  rosterAffiliations={rosterAffiliations}
                  wrestler={wrestler}
                />
              ))
            ) : (
              <div className="empty-state">No wrestlers match this board view.</div>
            )}
          </div>
        </section>

        <aside className="roster-pulse-rail" aria-label="Locker room pulse">
          <header className="roster-pulse-title">
            <p className="eyebrow">Locker Room Pulse</p>
          </header>

          <section className="roster-side-panel morale-trend-panel" aria-label="Average morale trend">
            <div className="roster-side-heading">
              <p className="eyebrow">Morale Trend</p>
              <strong>{averageMorale} Avg</strong>
            </div>
            <svg className="morale-trend-plot" role="img" viewBox="0 0 100 36" aria-label={`Average morale trend ending at ${averageMorale}`}>
              <polyline points={moraleTrendLine} />
              {moraleTrend.map((point, index) => {
                const x = moraleTrend.length <= 1 ? 50 : (index / (moraleTrend.length - 1)) * 100;
                const y = 34 - (Math.max(0, Math.min(100, point.value)) / 100) * 32;

                return <circle cx={x} cy={y} key={`${point.label}-${index}`} r="1.8" />;
              })}
            </svg>
            <div className="morale-trend-axis-labels" aria-hidden="true">
              <span>Y: Morale</span>
              <span>X: Week</span>
            </div>
            <div className="morale-trend-labels">
              {moraleTrend.map((point, index) => (
                <span key={`${point.label}-${index}`}>
                  {point.label} <strong>{point.value}</strong>
                </span>
              ))}
            </div>
          </section>

          <section className="roster-side-panel" aria-label="Injury report">
            <div className="roster-side-heading">
              <p className="eyebrow">Injury Report</p>
              <strong>{injuryWatch.length ? `${injuryWatch.length} Flagged` : "Clear"}</strong>
            </div>
            <div className="roster-note-list">
              {injuryWatch.length ? (
                injuryWatch.map((wrestler) => (
                  <article className="injury-line-item" key={wrestler.id}>
                    <strong>{wrestler.name}</strong>
                    <span>{wrestler.injuryStatus === "healthy" ? "At risk" : formatWeekCount(wrestler.injuryWeeksRemaining)}</span>
                  </article>
                ))
              ) : (
                <p className="muted-copy">No injury or medical-risk read is leading the board.</p>
              )}
            </div>
          </section>
        </aside>

        <section className="roster-selected-dock" aria-label="Selected superstar">
          {selectedWrestler && selectedValueProfile && selectedIdentity && selectedLockerRead ? (
            <>
              <WrestlerPortrait className="roster-selected-portrait" wrestler={selectedWrestler} />
              <div className="roster-selected-summary">
                <p className="eyebrow">Selected Superstar</p>
                <h3>{selectedWrestler.name}</h3>
                <div className="roster-selected-meta">
                  <span>{selectedWrestler.roleTier ?? "Roster"}</span>
                  <span>{selectedWrestler.archetype ?? "Utility"}</span>
                  <span>{getWrestlerDivisionLabel(selectedWrestler)}</span>
                  {selectedChampionships.length ? <span>{selectedChampionships.map((championship) => championship.name).join(" / ")}</span> : null}
                </div>
              </div>
              <div className="roster-selected-overall">
                <span>Overall</span>
                <strong>{getWrestlerOverall(selectedWrestler)}</strong>
              </div>
              <div className="roster-selected-bars">
                <div>
                  <span>POP</span>
                  <b style={{ width: `${selectedWrestler.popularity}%` }} />
                  <strong>{selectedWrestler.popularity}</strong>
                </div>
                <div>
                  <span>MOR</span>
                  <b style={{ width: `${selectedWrestler.morale}%` }} />
                  <strong>{selectedWrestler.morale}</strong>
                </div>
                <div>
                  <span>FAT</span>
                  <b style={{ width: `${selectedWrestler.fatigue}%` }} />
                  <strong>{selectedWrestler.fatigue}</strong>
                </div>
              </div>
              <div className={`roster-selected-read tone-${selectedLockerRead.tone}`}>
                <span>{selectedLockerRead.headline}</span>
                <p>{selectedLockerRead.detail}</p>
                <small>{selectedIdentity.usageRead}</small>
              </div>
              <div className="roster-selected-tags">
                <span>{selectedValueProfile.valueTierLabel}</span>
                {selectedPressureTags.length ? selectedPressureTags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>) : <span>Balanced</span>}
                {selectedAffiliations.slice(0, 1).map((affiliation) => (
                  <span key={affiliation.id}>{affiliation.name}</span>
                ))}
              </div>
              <div className="roster-selected-actions">
                <button className="primary-action" onClick={() => onOpenProfile(selectedWrestler.id)}>
                  View Profile
                </button>
                <button className="secondary-action" onClick={() => onNavigate("booking")}>
                  Book Show
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state compact">Select a superstar to open the locker room read.</div>
          )}
        </section>
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
  const identitySnapshot = getWrestlerIdentitySnapshot(wrestler, game);
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const valueProfile = getWrestlerValueProfile(wrestler);
  const lockerRoomRead = getWrestlerLockerRoomRead(wrestler, game);
  const [expandedProfilePanels, setExpandedProfilePanels] = useState<Set<ProfilePanelId>>(() => new Set(["stats", "gmRead"]));
  const profileStatRows = [
    { label: "Popularity", value: `${wrestler.popularity}` },
    { label: "Momentum", value: `${wrestler.momentum}` },
    { label: "Fatigue", value: `${wrestler.fatigue}` },
    { label: "Morale", value: `${wrestler.morale}` },
    { label: "Ring Skill", value: `${wrestler.ringSkill}` },
    { label: "Promo Skill", value: `${wrestler.promoSkill}` },
    { label: "Injury", value: getInjuryStatusLabel(wrestler.injuryStatus), note: getInjuryDetail(wrestler) },
    { label: "Appearances", value: `${wrestler.appearancesThisSeason ?? 0}`, note: "This season" },
    { label: "Last Booked", value: wrestler.lastBookedWeek ? `Week ${wrestler.lastBookedWeek}` : "Never", note: `${weeksSinceLastBooked} weeks off TV` },
    { label: "TV Streak", value: `${wrestler.consecutiveWeeksBooked ?? 0}`, note: "Consecutive weeks booked" },
  ];
  const profilePanelExpanded = (panelId: ProfilePanelId) => expandedProfilePanels.has(panelId);
  const toggleProfilePanel = (panelId: ProfilePanelId) => {
    setExpandedProfilePanels((currentPanels) => {
      const nextPanels = new Set(currentPanels);
      if (nextPanels.has(panelId)) {
        nextPanels.delete(panelId);
      } else {
        nextPanels.add(panelId);
      }
      return nextPanels;
    });
  };
  useEffect(() => {
    setExpandedProfilePanels(new Set(["stats", "gmRead"]));
  }, [wrestler.id]);
  const statsSummary = `POP ${wrestler.popularity} / MOM ${wrestler.momentum} / FAT ${wrestler.fatigue} / MOR ${wrestler.morale}`;
  const gmReadSummary = `${lockerRoomRead.headline}${pressureTags.length ? ` / ${pressureTags.slice(0, 2).join(" / ")}` : " / Balanced"}`;
  const contractSummary = `${valueProfile.valueTierLabel} / ${valueProfile.weeklyValueLabel}`;
  const affiliationSummary = affiliations.length ? `${affiliations.length} locker room link${affiliations.length === 1 ? "" : "s"}` : "No source link";
  const showHistorySummary = recentAppearances.length ? `${recentAppearances.length} recent appearance${recentAppearances.length === 1 ? "" : "s"}` : "No show appearances";
  const championshipSummary = championships.length
    ? `${championships.length} current title${championships.length === 1 ? "" : "s"}`
    : titleSceneRows.length
      ? `${titleSceneRows.length} title scene fit${titleSceneRows.length === 1 ? "" : "s"}`
      : "No current title scene";
  const rivalrySummary = activeRivalries.length ? `${activeRivalries.length} active / ${activeRivalries[0].name}` : "No active rivalry";
  const socialSummary = recentSocialPosts.length ? `${recentSocialPosts.length} recent mention${recentSocialPosts.length === 1 ? "" : "s"}` : "No recent social mentions";

  return (
    <main className="app-shell profile-screen">
      <Header game={game} />
      <GameNav currentScreen="profile" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />
      <section className="profile-hero">
        <WrestlerPortrait className="profile-hero-portrait" wrestler={wrestler} />
        <div className="profile-hero-main">
          <p className="eyebrow">Wrestler Profile</p>
          <h2>{wrestler.name}</h2>
          <div className="identity-strip">
            <span>{identity.role}</span>
            <span>{getRosterAlignmentLabel(wrestler)}</span>
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
          <ProfileExpandablePanel
            className="profile-stats-panel"
            expanded={profilePanelExpanded("stats")}
            eyebrow="Current Value"
            id="stats"
            onToggle={toggleProfilePanel}
            summary={statsSummary}
            title="Stats And TV Load"
          >
            <div className="profile-stat-rows">
              {profileStatRows.map((row) => (
                <article className="profile-stat-row" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  <small>{row.note ?? ""}</small>
                </article>
              ))}
            </div>
          </ProfileExpandablePanel>

          <ProfileExpandablePanel
            className={`contract-value-panel ${valueProfile.contextMode === "missing" ? "contract-value-panel-missing" : ""}`}
            expanded={profilePanelExpanded("contractValue")}
            eyebrow="Contract Value Dossier"
            id="contractValue"
            onToggle={toggleProfilePanel}
            summary={contractSummary}
            title={valueProfile.valueTierLabel}
          >
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
          </ProfileExpandablePanel>

          <ProfileExpandablePanel
            className="affiliation-profile-panel"
            expanded={profilePanelExpanded("affiliations")}
            eyebrow="Affiliation Context"
            id="affiliations"
            onToggle={toggleProfilePanel}
            summary={affiliationSummary}
            title={affiliations.length ? "Locker Room Links" : "No Source Link"}
          >
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
          </ProfileExpandablePanel>

          <ProfileExpandablePanel
            expanded={profilePanelExpanded("showHistory")}
            eyebrow="Recent Show History"
            id="showHistory"
            onToggle={toggleProfilePanel}
            summary={showHistorySummary}
            title="Last Five Appearances"
          >
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
          </ProfileExpandablePanel>
        </div>

        <aside className="profile-side">
          <ProfileExpandablePanel
            className="gm-read-panel"
            expanded={profilePanelExpanded("gmRead")}
            eyebrow="GM Read"
            id="gmRead"
            onToggle={toggleProfilePanel}
            summary={gmReadSummary}
            title="Decision Context"
          >
            <div className="identity-snapshot-panel" aria-label="Identity snapshot">
              <div className="pressure-tags">
                {identitySnapshot.labels.map((label) => (
                  <span className="identity-chip" key={label}>
                    {label}
                  </span>
                ))}
              </div>
              <strong>{identitySnapshot.roleRead}</strong>
              <p>{identitySnapshot.bookingUseRead}</p>
              <small>{identitySnapshot.usageRead}</small>
            </div>
            <div className={`locker-room-profile-read tone-${lockerRoomRead.tone}`} aria-label={`${wrestler.name} locker room read`}>
              <span>Locker Room Read</span>
              <strong>{lockerRoomRead.headline}</strong>
              <p>{lockerRoomRead.detail}</p>
              <small>{lockerRoomRead.note}</small>
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
          </ProfileExpandablePanel>

          <ProfileExpandablePanel
            className="title-profile-panel"
            expanded={profilePanelExpanded("championships")}
            eyebrow="Championship Context"
            id="championships"
            onToggle={toggleProfilePanel}
            summary={championshipSummary}
            title={championships.length ? "Current Champion" : titleSceneRows.length ? "Title Scene Fit" : "No Current Title"}
          >
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
          </ProfileExpandablePanel>

          <ProfileExpandablePanel
            className="rivalry-profile-panel"
            expanded={profilePanelExpanded("rivalries")}
            eyebrow="Active Rivalries"
            id="rivalries"
            onToggle={toggleProfilePanel}
            summary={rivalrySummary}
            title={activeRivalries.length ? "Story Pressure" : "No Active Rivalry"}
          >
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
          </ProfileExpandablePanel>

          <ProfileExpandablePanel
            className="social-profile-panel"
            expanded={profilePanelExpanded("social")}
            eyebrow="Social Mentions"
            id="social"
            onToggle={toggleProfilePanel}
            summary={socialSummary}
            title="Recent IWC Read"
          >
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
          </ProfileExpandablePanel>
        </aside>
      </section>
    </main>
  );
}

function ProfileExpandablePanel({
  children,
  className,
  expanded,
  eyebrow,
  id,
  onToggle,
  summary,
  title,
}: {
  children: ReactNode;
  className?: string;
  expanded: boolean;
  eyebrow: string;
  id: ProfilePanelId;
  onToggle: (id: ProfilePanelId) => void;
  summary: string;
  title: string;
}) {
  const contentId = `profile-panel-${id}`;

  return (
    <section className={`profile-panel profile-expandable-panel ${expanded ? "expanded" : "collapsed"} ${className ?? ""}`} aria-label={eyebrow}>
      <button className="profile-expandable-head" type="button" aria-controls={contentId} aria-expanded={expanded} onClick={() => onToggle(id)}>
        <span>
          <em>{eyebrow}</em>
          <strong>{title}</strong>
        </span>
        <b>{expanded ? "Collapse" : "Expand"}</b>
      </button>
      <p className="profile-panel-summary">{summary}</p>
      {expanded ? (
        <div className="profile-panel-body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ChampionshipsScreen({
  game,
  latestResult,
  onAssignChampionship,
  onBookChampionship,
  onNavigate,
  onRevokeChampionship,
  onSetContenders,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onAssignChampionship: (championshipId: string, championIds: string[]) => void;
  onBookChampionship: (championshipId: string) => void;
  onNavigate: (screen: GameScreen) => void;
  onRevokeChampionship: (championshipId: string) => void;
  onSetContenders: (championshipId: string, wrestlerIds: string[]) => void;
}) {
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const officeRead = getChampionshipOfficeRead(game);
  const [editContendersOpen, setEditContendersOpen] = useState(false);
  const [assignChampionOpen, setAssignChampionOpen] = useState(false);
  const [isTitleOfficeExpanded, setIsTitleOfficeExpanded] = useState(false);
  const defaultSelectedChampionship =
    game.championships.find((championship) => championship.name === officeRead.attentionTitle) ??
    game.championships.find((championship) => championship.name === officeRead.prestigeTitle) ??
    game.championships[0];
  const [selectedChampionshipId, setSelectedChampionshipId] = useState(defaultSelectedChampionship?.id ?? "");
  const [selectedTitleTab, setSelectedTitleTab] = useState<"scene" | "contenders" | "history">("scene");
  const championshipReads = game.championships.map((championship) => {
    const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
    const recentHistory = getChampionshipHistory(game, championship.id);
    const titleRead = getTitleSceneRead(championship, game.wrestlers, game.currentWeek, game.rivalries);
    const pressureSnapshot = getTitleScenePressureSnapshot(championship, game);
    const gmRead = getTitleSceneGMRead(championship, scene);
    const isTagTitle = isTagChampionship(championship);
    const tagDivisionHealth = isTagTitle ? getTagDivisionHealthDiagnostics(championship, game) : [];
    const titleDeskRead = getChampionshipSceneDeskRead(championship, game, scene, pressureSnapshot);
    const identityRead = getTitleSceneIdentityRead(championship, game, scene, pressureSnapshot);

    return {
      championship,
      scene,
      recentHistory,
      titleRead,
      pressureSnapshot,
      gmRead,
      isTagTitle,
      tagDivisionHealth,
      titleDeskRead,
      identityRead,
    };
  });
  const selectedTitleRead =
    championshipReads.find((read) => read.championship.id === selectedChampionshipId) ??
    championshipReads.find((read) => read.championship.id === defaultSelectedChampionship?.id) ??
    championshipReads[0];
  const selectedContenderRows = selectedTitleRead
    ? selectedTitleRead.scene.topContenders.map((wrestler, index) => ({
        index,
        wrestler,
        read: getTitleSceneTalentRead(wrestler, game, selectedTitleRead.championship.id),
        lane: "Top Contender",
      }))
    : [];
  const selectedContenderIds = new Set(selectedContenderRows.map(({ wrestler }) => wrestler.id));
  const selectedChampionIds = new Set(selectedTitleRead?.championship.championIds ?? []);
  const addableContenders = selectedTitleRead
    ? game.wrestlers
        .filter((wrestler) => !selectedChampionIds.has(wrestler.id))
        .filter((wrestler) => !selectedContenderIds.has(wrestler.id))
        .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, selectedTitleRead.championship))
        .sort((a, b) => getTitleSceneTalentScore(b, selectedTitleRead.championship, game.rivalries) - getTitleSceneTalentScore(a, selectedTitleRead.championship, game.rivalries))
        .slice(0, 8)
    : [];
  const assignableChampionCandidates = selectedTitleRead
    ? game.wrestlers
        .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, selectedTitleRead.championship))
        .sort((a, b) => getTitleSceneTalentScore(b, selectedTitleRead.championship, game.rivalries) - getTitleSceneTalentScore(a, selectedTitleRead.championship, game.rivalries))
        .slice(0, 10)
    : [];
  const assignableChampionPairs = selectedTitleRead?.isTagTitle
    ? assignableChampionCandidates
        .flatMap((wrestler, index) => assignableChampionCandidates.slice(index + 1, index + 4).map((partner) => [wrestler, partner] as const))
        .slice(0, 8)
    : [];

  useEffect(() => {
    if (!championshipReads.some((read) => read.championship.id === selectedChampionshipId)) {
      setSelectedChampionshipId(defaultSelectedChampionship?.id ?? "");
    }
  }, [championshipReads, defaultSelectedChampionship?.id, selectedChampionshipId]);

  function handleSelectChampionship(championshipId: string, nextTab: "scene" | "contenders" | "history" = "scene") {
    setSelectedChampionshipId(championshipId);
    setSelectedTitleTab(nextTab);
    setEditContendersOpen(false);
    setAssignChampionOpen(false);
  }

  return (
    <main className="app-shell gameplay-command-shell championships-command-shell">
      <Header game={game} />
      <GameNav currentScreen="championships" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />

      <section className="championship-command-board" aria-label="Championship title office">
        <section className="championship-title-wall" aria-label="Championship spotlight wall">
          <div className="championship-wall-head">
            <div>
              <p className="eyebrow">Champion Wall</p>
              <h3>{game.championships.length} Active Title Scenes</h3>
            </div>
            <strong>All Belts Live</strong>
          </div>
          <div className="championship-spotlight-grid">
            {championshipReads.map(({ championship, identityRead, pressureSnapshot, scene }) => {
              const isSelected = selectedTitleRead?.championship.id === championship.id;

              return (
                <button
                  className={`championship-spotlight-card tone-${pressureSnapshot.primary.tone} ${isSelected ? "selected" : ""}`}
                  key={championship.id}
                  onClick={() => handleSelectChampionship(championship.id)}
                  type="button"
                >
                  <span className="championship-belt-mark">{getChampionshipAcronym(championship.name)}</span>
                  <span className="championship-card-copy">
                    <span>{getChampionshipOfficeLine(championship)}</span>
                    <strong>{championship.name}</strong>
                    <small>{getWrestlerNames(championship.championIds, game.wrestlers) || "Vacant"}</small>
                  </span>
                  <span className="championship-card-stats" aria-label={`${championship.name} quick read`}>
                    <span>
                      <b>Prestige</b>
                      <strong>{championship.prestige}</strong>
                    </span>
                    <span>
                      <b>Reign</b>
                      <strong>{formatWeekCount(getReignLength(championship, game.currentWeek))}</strong>
                    </span>
                    <span>
                      <b>Def</b>
                      <strong>{championship.defenses}</strong>
                    </span>
                  </span>
                  <span className="championship-card-read">
                    <b>{identityRead.headline}</b>
                    <small>{pressureSnapshot.primary.label} · {scene.topContenders.length} contender lane{scene.topContenders.length === 1 ? "" : "s"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {selectedTitleRead ? (
          <section className="championship-focus-workspace" aria-label={`${selectedTitleRead.championship.name} focused title desk`}>
            <div className="championship-focus-head">
              <div className="championship-focus-title">
                <span className="championship-belt-mark large">{getChampionshipAcronym(selectedTitleRead.championship.name)}</span>
                <div>
                  <p className="eyebrow">Selected Championship</p>
                  <h3>{selectedTitleRead.championship.name}</h3>
                </div>
              </div>
              <div className="championship-focus-actions">
                <button className="primary-action" onClick={() => onBookChampionship(selectedTitleRead.championship.id)}>
                  Book Title
                </button>
              </div>
            </div>

            <div className="championship-focus-metrics">
              <div className="metric championship-champion-metric">
                <span>Champion</span>
                <strong>{getWrestlerNames(selectedTitleRead.championship.championIds, game.wrestlers) || "Vacant"}</strong>
                {selectedTitleRead.championship.championIds.length ? (
                  <button className="danger-action" onClick={() => onRevokeChampionship(selectedTitleRead.championship.id)} type="button">
                    Revoke
                  </button>
                ) : (
                  <button className="secondary-action" onClick={() => setAssignChampionOpen((open) => !open)} type="button">
                    Assign
                  </button>
                )}
              </div>
              <Metric label="Reign" value={`${getReignLength(selectedTitleRead.championship, game.currentWeek)} Week${getReignLength(selectedTitleRead.championship, game.currentWeek) === 1 ? "" : "s"}`} />
              <Metric label="Defenses" value={`${selectedTitleRead.championship.defenses}`} />
              <Metric label="Scene" value={selectedTitleRead.pressureSnapshot.primary.label} />
            </div>

            {assignChampionOpen && !selectedTitleRead.championship.championIds.length ? (
              <section className="championship-assign-panel" aria-label={`Assign ${selectedTitleRead.championship.name} champion`}>
                <div>
                  <span>Vacant Title Assignment</span>
                  <strong>{selectedTitleRead.isTagTitle ? "Choose Champion Pair" : "Choose Champion"}</strong>
                </div>
                <div className="championship-assign-options">
                  {selectedTitleRead.isTagTitle ? (
                    assignableChampionPairs.length ? (
                      assignableChampionPairs.map(([first, second]) => (
                        <button
                          key={`${first.id}-${second.id}`}
                          onClick={() => {
                            onAssignChampionship(selectedTitleRead.championship.id, [first.id, second.id]);
                            setAssignChampionOpen(false);
                          }}
                          type="button"
                        >
                          <span>{first.name} / {second.name}</span>
                          <small>
                            Pair assignment
                            {[...getOtherChampionshipHolderLabels(first, game.championships, selectedTitleRead.championship.id), ...getOtherChampionshipHolderLabels(second, game.championships, selectedTitleRead.championship.id)].length
                              ? " · Champion elsewhere"
                              : ""}
                          </small>
                        </button>
                      ))
                    ) : (
                      <p className="muted-copy">No eligible same-division pair is available.</p>
                    )
                  ) : assignableChampionCandidates.length ? (
                    assignableChampionCandidates.map((wrestler) => (
                      <button
                        key={wrestler.id}
                        onClick={() => {
                          onAssignChampionship(selectedTitleRead.championship.id, [wrestler.id]);
                          setAssignChampionOpen(false);
                        }}
                        type="button"
                      >
                        <span>{wrestler.name}</span>
                        <small>
                          Momentum {wrestler.momentum} · Popularity {wrestler.popularity}
                          {getOtherChampionshipHolderLabels(wrestler, game.championships, selectedTitleRead.championship.id).length
                            ? " · Champion elsewhere"
                            : ""}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p className="muted-copy">No eligible same-division champion is available.</p>
                  )}
                </div>
              </section>
            ) : null}

            <div className="championship-focus-tabs" aria-label="Selected title detail tabs">
              <button className={selectedTitleTab === "scene" ? "active-filter" : ""} onClick={() => setSelectedTitleTab("scene")} type="button">
                Scene
              </button>
              <button className={selectedTitleTab === "contenders" ? "active-filter" : ""} onClick={() => setSelectedTitleTab("contenders")} type="button">
                Contenders
              </button>
              <button className={selectedTitleTab === "history" ? "active-filter" : ""} onClick={() => setSelectedTitleTab("history")} type="button">
                History
              </button>
            </div>

            {selectedTitleTab === "scene" ? (
              <div className="championship-focus-body">
                <section className={`title-identity-panel tone-${selectedTitleRead.identityRead.tone}`} aria-label={`${selectedTitleRead.championship.name} title scene identity`}>
                  <div>
                    <span>Title Scene Identity</span>
                    <strong>{selectedTitleRead.identityRead.headline}</strong>
                  </div>
                  <p>{selectedTitleRead.identityRead.championIdentity}</p>
                  <p>{selectedTitleRead.identityRead.divisionRead}</p>
                  <div className="title-identity-grid">
                    <article>
                      <span>{selectedTitleRead.identityRead.healthLabel}</span>
                      <p>{selectedTitleRead.identityRead.healthDetail}</p>
                    </article>
                    <article>
                      <span>{selectedTitleRead.identityRead.heatLabel}</span>
                      <p>{selectedTitleRead.identityRead.heatDetail}</p>
                    </article>
                    <article>
                      <span>{selectedTitleRead.identityRead.depthLabel}</span>
                      <p>{selectedTitleRead.identityRead.depthDetail}</p>
                    </article>
                  </div>
                </section>
                <section className={`championship-scene-summary pressure-${selectedTitleRead.pressureSnapshot.primary.tone}`} aria-label={`${selectedTitleRead.championship.name} title scene status`}>
                  <article className="championship-scene-lead">
                    <span>Pressure Read</span>
                    <strong>{selectedTitleRead.pressureSnapshot.primary.label}</strong>
                    <p>{selectedTitleRead.pressureSnapshot.primary.detail}</p>
                  </article>
                  <div className="championship-scene-support">
                    <article>
                      <span>Scene</span>
                      <strong>{selectedTitleRead.titleRead.label}</strong>
                      <small>{selectedTitleRead.titleRead.detail}</small>
                    </article>
                    <article>
                      <span>Eligibility</span>
                      <strong>{selectedTitleRead.championship.eligibleMatchScope === "tag_team" ? "Tag Scope" : `${selectedTitleRead.championship.division} Singles`}</strong>
                      <small>{selectedTitleRead.championship.minimumDefenseFrequencyWeeks ? `Defense rhythm: about ${selectedTitleRead.championship.minimumDefenseFrequencyWeeks} weeks` : "Legacy title cadence"}</small>
                    </article>
                    <article>
                      <span>Title Clock</span>
                      <strong>{selectedTitleRead.pressureSnapshot.weeksSinceLastTitleEvent ? `${formatWeekCount(selectedTitleRead.pressureSnapshot.weeksSinceLastTitleEvent)} since title event` : "Fresh title event"}</strong>
                      <small>Window read: about {formatWeekCount(selectedTitleRead.pressureSnapshot.defenseWindow)} · advisory only</small>
                    </article>
                  </div>
                </section>
                <div className="championship-office-notes" aria-label={`${selectedTitleRead.championship.name} office notes`}>
                  <span>Office Notes</span>
                  {selectedTitleRead.pressureSnapshot.diagnostics
                    .filter((diagnostic) => diagnostic.label !== selectedTitleRead.pressureSnapshot.primary.label)
                    .slice(0, 3)
                    .map((diagnostic) => (
                      <article className={`pressure-${diagnostic.tone}`} key={diagnostic.id}>
                        <strong>{diagnostic.label}</strong>
                        <p>{diagnostic.detail}</p>
                      </article>
                    ))}
                </div>
                {selectedTitleRead.tagDivisionHealth.length ? (
                  <div className="title-pressure-deck" aria-label={`${selectedTitleRead.championship.name} tag division health`}>
                    {selectedTitleRead.tagDivisionHealth.slice(0, 4).map((diagnostic) => (
                      <article className={`title-pressure-chip pressure-${diagnostic.tone}`} key={diagnostic.id}>
                        <span>{diagnostic.label}</span>
                        <p>{diagnostic.detail}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedTitleTab === "contenders" ? (
              <div className="championship-focus-body">
                <section className="championship-contender-board" aria-label={`${selectedTitleRead.championship.name} contender board`}>
                  <div className="championship-contender-head">
                    <div>
                      <span>{selectedTitleRead.championship.division} Division</span>
                      <strong>{selectedContenderRows.length ? `${selectedContenderRows.length} contender${selectedContenderRows.length === 1 ? "" : "s"}` : "No contenders"}</strong>
                    </div>
                    <div className="championship-contender-actions">
                      <small>Champion: {formatTitleSceneNames(selectedTitleRead.scene.champions, "No champion assigned")}</small>
                      <button className="secondary-action" onClick={() => setEditContendersOpen((open) => !open)} type="button">
                        Edit
                      </button>
                    </div>
                  </div>
                  {editContendersOpen ? (
                    <div className="championship-add-contender-panel" aria-label={`Add ${selectedTitleRead.championship.name} contender`}>
                      {selectedContenderRows.length ? (
                        <div className="championship-edit-contender-list">
                          {selectedContenderRows.map(({ index, wrestler }) => (
                            <article key={wrestler.id}>
                              <strong>{String(index + 1).padStart(2, "0")} · {wrestler.name}</strong>
                              <div>
                                <button
                                  className="secondary-action"
                                  disabled={index === 0}
                                  onClick={() => {
                                    const nextIds = selectedContenderRows.map((row) => row.wrestler.id);
                                    [nextIds[index - 1], nextIds[index]] = [nextIds[index], nextIds[index - 1]];
                                    onSetContenders(selectedTitleRead.championship.id, nextIds);
                                  }}
                                  type="button"
                                >
                                  Up
                                </button>
                                <button
                                  className="secondary-action"
                                  disabled={index === selectedContenderRows.length - 1}
                                  onClick={() => {
                                    const nextIds = selectedContenderRows.map((row) => row.wrestler.id);
                                    [nextIds[index], nextIds[index + 1]] = [nextIds[index + 1], nextIds[index]];
                                    onSetContenders(selectedTitleRead.championship.id, nextIds);
                                  }}
                                  type="button"
                                >
                                  Down
                                </button>
                                <button
                                  className="danger-action"
                                  onClick={() => onSetContenders(selectedTitleRead.championship.id, selectedContenderRows.map((row) => row.wrestler.id).filter((id) => id !== wrestler.id))}
                                  type="button"
                                >
                                  Remove
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                      {addableContenders.length ? (
                        addableContenders.map((wrestler) => (
                          <button
                            key={wrestler.id}
                            onClick={() => {
                              onSetContenders(selectedTitleRead.championship.id, [...selectedContenderRows.map((row) => row.wrestler.id), wrestler.id]);
                            }}
                            type="button"
                          >
                            <span>{wrestler.name}</span>
                            <small>
                              Momentum {wrestler.momentum} · Popularity {wrestler.popularity}
                              {getOtherChampionshipHolderLabels(wrestler, game.championships, selectedTitleRead.championship.id).length
                                ? " · Champion elsewhere"
                                : ""}
                            </small>
                          </button>
                        ))
                      ) : (
                        <p className="muted-copy">No additional same-division candidates are available.</p>
                      )}
                    </div>
                  ) : null}
                  <div className="championship-contender-list">
                    {selectedContenderRows.length ? (
                      selectedContenderRows.map(({ index, lane, read, wrestler }) => (
                        <article className="championship-contender-row" key={wrestler.id}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <strong>{wrestler.name}</strong>
                            <small>{lane}{read.labels.length ? ` · ${read.labels.join(" / ")}` : ""}</small>
                          </div>
                          <p>{read.detail}</p>
                        </article>
                      ))
                    ) : (
                      <p className="muted-copy">No eligible contender pressure is visible yet.</p>
                    )}
                  </div>
                </section>

                <p className="championship-contender-note">
                  <strong>GM Read:</strong> {selectedTitleRead.pressureSnapshot.producerRead} {selectedTitleRead.gmRead}
                </p>
              </div>
            ) : null}

            {selectedTitleTab === "history" ? (
              <div className="championship-focus-body">
                <div className="history-list title-history-focus" aria-label={`${selectedTitleRead.championship.name} recent history`}>
                <span className="history-label">Recent History</span>
                  {selectedTitleRead.recentHistory.length ? (
                    selectedTitleRead.recentHistory.map((event) => (
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
              </div>
            ) : null}
          </section>
        ) : null}
      </section>

      <section className={`title-office-panel tone-${officeRead.tone} ${isTitleOfficeExpanded ? "is-expanded" : "is-collapsed"}`} aria-label="Championship office readout">
        <button
          className="title-office-toggle"
          aria-expanded={isTitleOfficeExpanded}
          onClick={() => setIsTitleOfficeExpanded((current) => !current)}
          type="button"
        >
          <div>
            <p className="eyebrow">Championship Committee</p>
            <h3>{officeRead.headline}</h3>
          </div>
          <strong>Prestige Desk</strong>
          <span>{isTitleOfficeExpanded ? "Collapse" : "Expand"}</span>
        </button>
        {isTitleOfficeExpanded ? (
          <div className="title-office-grid">
            <article>
              <span>Brand Anchor</span>
              <strong>{officeRead.anchorTitle}</strong>
              <p>{officeRead.anchorDetail}</p>
            </article>
            <article>
              <span>Needs Attention</span>
              <strong>{officeRead.attentionTitle}</strong>
              <p>{officeRead.attentionDetail}</p>
            </article>
            <article>
              <span>Prestige Center</span>
              <strong>{officeRead.prestigeTitle}</strong>
              <p>{officeRead.prestigeDetail}</p>
            </article>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function RivalriesScreen({
  game,
  latestResult,
  onBookRivalry,
  onCreateRivalry,
  onEndRivalry,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onBookRivalry: (rivalryId: string) => void;
  onCreateRivalry: (input: RivalryCreateInput) => void;
  onEndRivalry: (rivalryId: string) => void;
  onNavigate: (screen: GameScreen) => void;
}) {
  const [selectedRivalryId, setSelectedRivalryId] = useState(game.rivalries[0]?.id ?? "");
  const [structure, setStructure] = useState<RivalryStructure>("singles");
  const [participantIds, setParticipantIds] = useState<string[]>(() => getDefaultRivalryComposerParticipantIds(game.wrestlers));
  const [stakes, setStakes] = useState<RivalryStakes>("personal");
  const [storylineId, setStorylineId] = useState(getDefaultStorylineIdForStakes("personal"));
  const [isCreativeDeskExpanded, setIsCreativeDeskExpanded] = useState(false);
  const range = getRivalryStructureParticipantRange(structure);
  const composerParticipantIds = participantIds.slice(0, range.max).filter(Boolean);
  const isDuplicate = composerParticipantIds.length >= range.min && hasDuplicateRivalry(game.rivalries, structure, composerParticipantIds);
  const rivalryBlockReason = getRivalryCreationBlockReason(structure, composerParticipantIds, game.wrestlers);
  const canCreate = composerParticipantIds.length >= range.min && composerParticipantIds.length <= range.max && !isDuplicate && !rivalryBlockReason;
  const selectedStoryline = getRivalryStoryline({ stakes, storylineId });
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const creativeDesk = getRivalryCreativeDeskRead(game);
  const selectedRivalry = game.rivalries.find((rivalry) => rivalry.id === selectedRivalryId) ?? game.rivalries[0];
  const currentWeek = getCurrentCalendarWeek(game);
  const rivalrySnapshots = getRivalryTimingSnapshots(game);
  const selectedSnapshot = selectedRivalry ? getRivalryTimingSnapshot(selectedRivalry, game) : undefined;
  const selectedHistory = selectedRivalry ? getRivalryHistory(game, selectedRivalry.id) : [];
  const selectedParticipantReads = selectedRivalry ? getRivalryParticipantReads(selectedRivalry, game) : [];
  const selectedStoryRoomRead =
    selectedRivalry && selectedSnapshot ? getRivalryStoryRoomRead(selectedRivalry, selectedSnapshot, selectedParticipantReads, selectedHistory[0]) : undefined;
  const selectedStorylineRead = selectedRivalry ? getRivalryStoryline(selectedRivalry) : undefined;
  const selectedStage = selectedRivalry ? getRivalryStageContext(game, selectedRivalry) : undefined;
  const selectedTitleRelevance = selectedRivalry ? getRivalryTitleRelevance(selectedRivalry, game.championships, game.wrestlers) : undefined;
  const selectedGmRead =
    selectedRivalry && selectedStage
      ? getRivalryGMRead(selectedRivalry, {
          hasPlePayoff: hasPlePayoff(game, selectedRivalry.id),
          isGoHome: currentWeek.isGoHome,
          isPle: currentWeek.showType === "ple",
          titleRelevant: Boolean(selectedTitleRelevance && selectedTitleRelevance.label !== "Title-Friendly Story"),
        })
      : "";
  useEffect(() => {
    if (!game.rivalries.length) {
      setSelectedRivalryId("");
      return;
    }

    if (!game.rivalries.some((rivalry) => rivalry.id === selectedRivalryId)) {
      setSelectedRivalryId(game.rivalries[0].id);
    }
  }, [game.rivalries, selectedRivalryId]);

  function updateParticipantSlot(index: number, wrestlerId: string) {
    setParticipantIds((current) => {
      const next = [...current];
      next[index] = wrestlerId;

      if (structure === "tag_team" && wrestlerId) {
        const sideStart = index < 2 ? 0 : 2;
        const partnerIndex = index === sideStart ? sideStart + 1 : sideStart;

        if (!next[partnerIndex]) {
          const partnerId = getPreferredTagPartnerId(wrestlerId, game.wrestlers, next);

          if (partnerId) {
            next[partnerIndex] = partnerId;
          }
        }
      }

      return next;
    });
  }

  function handleCreateRivalry() {
    if (!canCreate) {
      return;
    }

    onCreateRivalry({ participantIds: composerParticipantIds, structure, stakes, storylineId });
  }

  return (
    <main className="app-shell gameplay-command-shell rivalries-command-shell">
      <Header game={game} />
      <GameNav currentScreen="rivalries" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />

      <section className="rivalry-command-desk" aria-label="Rivalry command desk">
        <aside className="rivalry-active-rail" aria-label="Active rivalries">
          <div className="section-heading">
            <p className="eyebrow">Active Rivalries</p>
            <h3>{game.rivalries.length} Stories</h3>
          </div>
          <div className="rivalry-active-list">
            {game.rivalries.length ? (
              game.rivalries.map((rivalry, index) => {
                const timingSnapshot = getRivalryTimingSnapshot(rivalry, game);
                const isSelected = selectedRivalry?.id === rivalry.id;
                const rivalryBlocked = isRivalryIntergenderBlocked(rivalry, game.wrestlers);
                return (
                  <button className={`rivalry-active-row status-${rivalry.status} ${isSelected ? "is-selected" : ""}`} key={rivalry.id} onClick={() => setSelectedRivalryId(rivalry.id)}>
                    <span className="rivalry-row-index">{index + 1}</span>
                    <span className="rivalry-row-main">
                      <strong>{rivalry.name}</strong>
                    </span>
                    <span className="rivalry-row-tags">
                      <span>{formatRivalryStructure(getRivalryStructure(rivalry))}</span>
                      <span>{formatRivalryStakes(rivalry.stakes)}</span>
                      <span>{rivalryBlocked ? "Blocked" : timingSnapshot.primary.label}</span>
                    </span>
                    <span className="rivalry-row-meters" aria-label={`${rivalry.name} heat and freshness`}>
                      <span>Heat <strong>{rivalry.heat}</strong></span>
                      <span>Fresh <strong>{rivalry.freshness}</strong></span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="empty-state">No rivalries are active. Start a story to give the next broadcast more context.</div>
            )}
          </div>
        </aside>

        <section className="rivalry-spotlight-stage" aria-label="Selected rivalry spotlight">
          {selectedRivalry && selectedSnapshot && selectedStorylineRead && selectedStage && selectedStoryRoomRead ? (
            <>
              <div className="rivalry-spotlight-head">
                <div>
                  <p className="eyebrow">{formatRivalryStructure(getRivalryStructure(selectedRivalry))} · {formatRivalryStakes(selectedRivalry.stakes)} Stakes</p>
                  <h3>{selectedRivalry.name}</h3>
                  <div className="rivalry-spotlight-status">
                    <strong>{isRivalryIntergenderBlocked(selectedRivalry, game.wrestlers) ? "Blocked Context" : selectedSnapshot.primary.label}</strong>
                    <span>{selectedSnapshot.timingRead}</span>
                  </div>
                </div>
                <div className="rivalry-spotlight-actions">
                  <button className="primary-action" onClick={() => onBookRivalry(selectedRivalry.id)}>
                    Book This Story
                  </button>
                  <button className="danger-action" onClick={() => onEndRivalry(selectedRivalry.id)}>
                    End Rivalry
                  </button>
                </div>
              </div>

              <div className={`rivalry-matchup-stage structure-${getRivalryStructure(selectedRivalry)}`}>
                {getRivalryStructure(selectedRivalry) === "tag_team" && selectedRivalry.participantIds.length === 4 ? (
                  <>
                    <div className="rivalry-side-card">
                      <span>Team A</span>
                      <strong>{getWrestlerNames(selectedRivalry.participantIds.slice(0, 2), game.wrestlers)}</strong>
                    </div>
                    <div className="rivalry-versus">VS</div>
                    <div className="rivalry-side-card">
                      <span>Team B</span>
                      <strong>{getWrestlerNames(selectedRivalry.participantIds.slice(2, 4), game.wrestlers)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    {getRivalryParticipants(selectedRivalry, game.wrestlers).slice(0, 4).map((wrestler, index) => (
                      <div className="rivalry-side-card" key={wrestler.id}>
                        <span>{getRivalryStructure(selectedRivalry) === "multi_person" ? `Position ${index + 1}` : index === 0 ? "Side A" : "Side B"}</span>
                        <strong>{wrestler.name}</strong>
                        <small>Momentum {wrestler.momentum} · Morale {wrestler.morale}</small>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="rivalry-spotlight-metrics">
                <article>
                  <span>Heat</span>
                  <strong>{selectedRivalry.heat}</strong>
                  <i style={{ inlineSize: `${selectedRivalry.heat}%` }} />
                </article>
                <article>
                  <span>Freshness</span>
                  <strong>{selectedRivalry.freshness}</strong>
                  <i style={{ inlineSize: `${selectedRivalry.freshness}%` }} />
                </article>
                <article>
                  <span>Weeks Active</span>
                  <strong>{selectedRivalry.weeksActive}</strong>
                  <small>{selectedRivalry.lastAdvancedWeek ? `Last beat Week ${selectedRivalry.lastAdvancedWeek}` : "No TV beat yet"}</small>
                </article>
                <article>
                  <span>Current Card</span>
                  <strong>{selectedSnapshot.currentCardBeats} Beat{selectedSnapshot.currentCardBeats === 1 ? "" : "s"}</strong>
                  <small>{selectedSnapshot.currentCardParticipants} participant{selectedSnapshot.currentCardParticipants === 1 ? "" : "s"} visible</small>
                </article>
              </div>

              <div className="rivalry-story-map">
                <article>
                  <span>Storyline</span>
                  <strong>{selectedStorylineRead.name}</strong>
                  <p>{selectedStorylineRead.description}</p>
                </article>
                <article>
                  <span>Lifecycle Stage</span>
                  <strong>{selectedStage.name}</strong>
                  <p>{selectedStage.description}</p>
                </article>
                <article>
                  <span>GM Read</span>
                  <strong>{isRivalryIntergenderBlocked(selectedRivalry, game.wrestlers) ? "Invalid Pairing" : selectedTitleRelevance?.label ?? "Creative Direction"}</strong>
                  <p>
                    {isRivalryIntergenderBlocked(selectedRivalry, game.wrestlers)
                      ? "Legacy rivalry kept for save safety, but it cannot be attached to booking under the current no-intergender rule."
                      : selectedTitleRelevance?.detail ?? selectedGmRead}
                  </p>
                </article>
              </div>

              {selectedHistory.length ? (
                <div className="history-list rivalry-history-scroll" aria-label={`${selectedRivalry.name} recent history`}>
                  <span className="history-label">Recent History</span>
                  {selectedHistory.map((event) => (
                    <article className="history-event" key={event.id}>
                      <span>{formatRivalryEventType(event.eventType)} · {formatHistoryStamp(event)}</span>
                      <p>{event.note}</p>
                    </article>
                  ))}
                </div>
              ) : null}

            </>
          ) : (
            <div className="empty-state">No selected rivalry. Create a singles, tag, or multi-person story to open the desk.</div>
          )}
        </section>

        <aside className="rivalry-composer-panel" aria-label="Rivalry composer">
          <div className="section-heading">
            <p className="eyebrow">Rivalry Composer</p>
            <h3>Start The Spark</h3>
          </div>
          <div className="rivalry-mode-toggle" aria-label="Rivalry structure">
            {(["singles", "tag_team", "multi_person"] as RivalryStructure[]).map((option) => (
              <button className={structure === option ? "active-filter" : ""} key={option} onClick={() => setStructure(option)}>
                {formatRivalryStructure(option)}
              </button>
            ))}
          </div>
          <div className="rivalry-composer-selects">
            {Array.from({ length: range.max }).map((_, index) => (
              <label key={`${structure}-${index}`}>
                {structure === "tag_team" ? `${index < 2 ? "Team A" : "Team B"} Wrestler ${index % 2 + 1}` : structure === "multi_person" ? `Participant ${index + 1}` : `Wrestler ${index + 1}`}
                <select value={participantIds[index] ?? ""} onChange={(event) => updateParticipantSlot(index, event.target.value)}>
                  <option value="">Choose wrestler</option>
                  {game.wrestlers.map((wrestler) => (
                    <option key={wrestler.id} value={wrestler.id}>
                      {wrestler.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
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
            <p>{selectedStoryline.commonBeats}</p>
          </div>
          <button className="primary-action" disabled={!canCreate} onClick={handleCreateRivalry}>
            Start Rivalry
          </button>
          {isDuplicate ? <p className="form-warning">Duplicate active rivalry already exists.</p> : null}
          {rivalryBlockReason ? <p className="form-warning">{rivalryBlockReason}</p> : null}
        </aside>
      </section>

      <section className="rivalry-ecosystem-band" aria-label="Rivalry ecosystem">
        <article className={`rivalry-creative-desk creative-${creativeDesk.tone} ${isCreativeDeskExpanded ? "is-expanded" : "is-collapsed"}`}>
          <button
            className="rivalry-creative-toggle"
            aria-expanded={isCreativeDeskExpanded}
            onClick={() => setIsCreativeDeskExpanded((current) => !current)}
          >
            <div>
              <p className="eyebrow">Creative Desk</p>
              <h3>{creativeDesk.headline}</h3>
            </div>
            <strong>{creativeDesk.focusLabel}</strong>
            <span>{isCreativeDeskExpanded ? "Collapse" : "Expand"}</span>
          </button>
          {isCreativeDeskExpanded ? (
            <>
              <p className="rivalry-creative-detail">{creativeDesk.detail}</p>
              <div className="rivalry-creative-grid">
                {creativeDesk.items.map((item) => (
                  <article className={`creative-${item.tone}`} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </article>
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
  const pleBuildPressure = getPleBuildPressureSnapshot(game);
  const ratingsBattle = getRatingsBattleSnapshot(game, latestResult);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, latestResult);

  function getWeekResult(week: CalendarWeek) {
    return game.showHistory.find(
      (result) =>
        result.id === week.resultId ||
        (result.seasonNumber === game.seasonNumber && result.week === week.weekNumber && result.showName === week.showName),
    );
  }

  return (
    <main className="app-shell gameplay-command-shell">
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

      <PleBuildPressurePanel snapshot={pleBuildPressure} />

      {ratingsBattle ? <RatingsBattlePanel compact snapshot={ratingsBattle} /> : null}
      {cpuResultsFeed ? <CpuResultsFeedPanel compact snapshot={cpuResultsFeed} /> : null}

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
                    {game.rivalBrands.some((brand) => brand.weeklyResults.some((cpuResult) => cpuResult.seasonNumber === result.seasonNumber && cpuResult.weekNumber === result.week)) ? (
                      <small>CPU race logged</small>
                    ) : null}
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
  const moodSummary = getIwcMoodSummary(game);
  const ratingsBattle = getRatingsBattleSnapshot(game, latestResult);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, latestResult);

  return (
    <main className="app-shell gameplay-command-shell">
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

      {moodSummary ? (
        <section className={`iwc-mood-panel tone-${moodSummary.tone}`} aria-label="IWC mood summary">
          <div className="iwc-mood-head">
            <div>
              <p className="eyebrow">IWC Mood Summary</p>
              <h3>{moodSummary.headline}</h3>
            </div>
            <strong>{moodSummary.weekLabel}</strong>
          </div>
          <p>{moodSummary.detail}</p>
          <div className="iwc-mood-grid">
            {moodSummary.items.map((item) => (
              <article key={item.id}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {ratingsBattle ? <RatingsBattlePanel compact snapshot={ratingsBattle} /> : null}
      {cpuResultsFeed ? <CpuResultsFeedPanel compact snapshot={cpuResultsFeed} /> : null}

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
  const officeRead = getFinanceOfficeRead(game);
  const [expandedFinancePanels, setExpandedFinancePanels] = useState<Set<FinancePanelId>>(() => new Set());

  function toggleFinancePanel(panelId: FinancePanelId) {
    setExpandedFinancePanels((currentPanels) => {
      const nextPanels = new Set(currentPanels);
      if (nextPanels.has(panelId)) {
        nextPanels.delete(panelId);
      } else {
        nextPanels.add(panelId);
      }
      return nextPanels;
    });
  }

  return (
    <main className="app-shell gameplay-command-shell">
      <Header game={game} />
      <GameNav currentScreen="finance" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />

      <section className="status-grid finance-summary-strip" aria-label="Finance summary">
        <Metric label="Current Money" value={formatMoney(game.money)} />
        <Metric label="Pressure" value={pressureLabel} />
        <Metric label="Season P/L" value={formatMoney(totalProfitLoss)} />
        <Metric label="Reports" value={`${game.financeReports.length}`} />
      </section>

      <section className={`finance-office-desk pressure-${officeRead.pressureLabel.toLowerCase()}`} aria-label="Finance GM office pressure">
        <div className="finance-office-head">
          <div>
            <p className="eyebrow">GM Office Pressure</p>
            <h3>{officeRead.headline}</h3>
            <p>{officeRead.detail}</p>
          </div>
          <strong>{officeRead.focusLabel}</strong>
        </div>
        <div className="finance-office-grid">
          {officeRead.items.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <FinanceExpandablePanel
        className="finance-spotlight talent-value-pressure-panel"
        expanded={expandedFinancePanels.has("talentValue")}
        eyebrow="Talent Value Pressure"
        id="talentValue"
        summary={`${talentValuePressure.mappedCount}/${talentValuePressure.totalCount} mapped · ${talentValuePressure.premiumCount} premium · ${talentValuePressure.bargainCount} value`}
        title="Roster Value Read"
        onToggle={toggleFinancePanel}
      >
        <div className="spotlight-grid compact-grid">
          <Metric label="Premium / High-Cost" value={`${talentValuePressure.premiumCount}`} detail="Premium draw lanes" />
          <Metric label="Bargain / Rising" value={`${talentValuePressure.bargainCount}`} detail="Value-base lanes" />
          <Metric
            label="Mapped Profiles"
            value={`${talentValuePressure.mappedCount}/${talentValuePressure.totalCount}`}
            detail={talentValuePressure.missingCount ? `${talentValuePressure.missingCount} pending` : "All roster values mapped"}
          />
        </div>
      </FinanceExpandablePanel>

      {latestReport ? (
        <FinanceExpandablePanel
          className="finance-report-card"
          expanded={expandedFinancePanels.has("latestReport")}
          eyebrow={`Latest Report · ${getShowTypeLabel(latestReport.showType)} · ${getFinanceReportModelLabel(latestReport)}`}
          id="latestReport"
          summary={`${formatMoney(latestReport.profitLoss)} · Score ${latestReport.showScore} · ${latestReport.attendance.toLocaleString()} attendance`}
          title={latestReport.showName}
          onToggle={toggleFinancePanel}
        >
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
        </FinanceExpandablePanel>
      ) : (
        <div className="empty-state">No finance reports yet. Run a show and the brand office will close the books after results.</div>
      )}

      {seasonReports.length ? (
        <FinanceExpandablePanel
          expanded={expandedFinancePanels.has("seasonReads")}
          eyebrow="Season Business Reads"
          id="seasonReads"
          summary={`${seasonReports.length} closed report${seasonReports.length === 1 ? "" : "s"} · ${formatMoney(totalProfitLoss)} season P/L`}
          title="Best And Worst Closes"
          onToggle={toggleFinancePanel}
        >
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
        </FinanceExpandablePanel>
      ) : null}

      {game.financeReports.length ? (
        <FinanceExpandablePanel
          expanded={expandedFinancePanels.has("financeHistory")}
          eyebrow="Finance History"
          id="financeHistory"
          summary={`${game.financeReports.length} closed report${game.financeReports.length === 1 ? "" : "s"}`}
          title="Closed Books"
          onToggle={toggleFinancePanel}
        >
          <section className="finance-history" aria-label="Finance history">
            {[...game.financeReports].reverse().map((report) => (
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
            ))}
          </section>
        </FinanceExpandablePanel>
      ) : null}
    </main>
  );
}

function FinanceExpandablePanel({
  children,
  className,
  expanded,
  eyebrow,
  id,
  onToggle,
  summary,
  title,
}: {
  children: ReactNode;
  className?: string;
  expanded: boolean;
  eyebrow: string;
  id: FinancePanelId;
  onToggle: (panelId: FinancePanelId) => void;
  summary: string;
  title: string;
}) {
  const contentId = `finance-panel-${id}`;

  return (
    <section className={`finance-expandable-panel ${expanded ? "is-expanded" : "is-collapsed"} ${className ?? ""}`} aria-label={eyebrow}>
      <button className="finance-expandable-toggle" aria-controls={contentId} aria-expanded={expanded} onClick={() => onToggle(id)} type="button">
        <div>
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <em>{summary}</em>
        <b>{expanded ? "Collapse" : "Expand"}</b>
      </button>
      {expanded ? (
        <div className="finance-expandable-body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
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

function PostShowCauseLedger({ collapsible = false, compact = false, sections }: { collapsible?: boolean; compact?: boolean; sections: CauseLedgerSection[] }) {
  const [isExpanded, setIsExpanded] = useState(!collapsible);

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
  const itemCount = visibleSections.reduce((count, section) => count + section.items.length, 0);

  return (
    <section className={`cause-ledger-panel ${compact ? "compact" : ""} ${collapsible ? "is-collapsible" : ""} ${isExpanded ? "is-expanded" : "is-collapsed"}`} aria-label="Post-show cause ledger">
      {collapsible ? (
        <button className="cause-ledger-toggle" aria-expanded={isExpanded} aria-controls="post-show-cause-ledger-body" onClick={() => setIsExpanded((open) => !open)} type="button">
          <div>
            <span>Post-Show Cause Ledger</span>
            <strong>{compact ? "Why The Week Moved" : "Why It Happened"}</strong>
          </div>
          <em>{visibleSections.length} driver group{visibleSections.length === 1 ? "" : "s"} · {itemCount} read{itemCount === 1 ? "" : "s"}</em>
          <b>{isExpanded ? "Collapse" : "Expand"}</b>
        </button>
      ) : (
        <div className="section-heading">
          <p className="eyebrow">Post-Show Cause Ledger</p>
          <h3>{compact ? "Why The Week Moved" : "Why It Happened"}</h3>
        </div>
      )}
      {isExpanded ? (
        <div className="cause-ledger-grid" id={collapsible ? "post-show-cause-ledger-body" : undefined}>
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
      ) : null}
    </section>
  );
}

function BroadcastFalloutPanel({ snapshot }: { snapshot: BroadcastFalloutSnapshot }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className={`broadcast-fallout-panel ${isExpanded ? "is-expanded" : "is-collapsed"}`} aria-label="Operational fallout log">
      <button className="broadcast-fallout-toggle" aria-expanded={isExpanded} aria-controls="operational-fallout-body" onClick={() => setIsExpanded((open) => !open)} type="button">
        <div>
          <span>Operational Fallout</span>
          <strong>Resolved Consequence Notes</strong>
        </div>
        <em>{snapshot.items.length} resolved note{snapshot.items.length === 1 ? "" : "s"}</em>
        <b>{isExpanded ? "Collapse" : "Expand"}</b>
      </button>
      {isExpanded ? (
        <div className="broadcast-fallout-body" id="operational-fallout-body">
          <p className="broadcast-fallout-copy">{snapshot.detail}</p>
          <div className="broadcast-fallout-grid">
            {snapshot.items.map((item) => (
              <article className={`broadcast-fallout-item item-${item.tone}`} key={item.id}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
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
  const broadcastFallout = buildBroadcastFalloutSnapshot(result);
  const titleHistoryEvents = result.titleHistoryEvents ?? [];
  const titleChanges = titleHistoryEvents.filter((event) => event.eventType === "title_change");
  const isPleResult = result.showType === "ple";
  const baseCauseLedger = buildPostShowCauseLedger(game, result, financeReport);
  const titleChangeCauseLedgerItems = titleChanges.map((event) => ({
    id: `title-change-${event.id}`,
    label: "Crowning Impact",
    detail: `${event.championshipName}: ${event.note}${getChampionshipEventPairLine(event) ? ` ${getChampionshipEventPairLine(event)}.` : ""}`,
    tone: "strong" as const,
  }));
  const pleCauseLedgerItem = {
    id: "major-event-wrap",
    label: "Major Event Wrap",
    detail: `This major-event broadcast carried ${titleChanges.length ? `${titleChanges.length} title change${titleChanges.length === 1 ? "" : "s"}` : "no title changes"} and ${
      result.rivalryHistoryEvents?.length ? `${result.rivalryHistoryEvents.length} rivalry movement event${result.rivalryHistoryEvents.length === 1 ? "" : "s"}` : "no rivalry movement"
    }.`,
    tone: "strong" as const,
  };
  const resultsStakeItems = [...(isPleResult ? [pleCauseLedgerItem] : []), ...titleChangeCauseLedgerItems];
  const causeLedger = resultsStakeItems.length
    ? baseCauseLedger.some((section) => section.id === "stakes")
      ? baseCauseLedger.map((section) => (section.id === "stakes" ? { ...section, items: [...resultsStakeItems, ...section.items] } : section))
      : [{ id: "stakes", label: "Title And Rivalry Drivers", items: resultsStakeItems }, ...baseCauseLedger]
    : baseCauseLedger;
  const pleResultRead = isPleResult
    ? `Major-event night complete; the room now moves on the fallout instead of the build notes.`
    : `Broadcast locked; review the fallout before calendar movement.`;
  const recapPackage = buildResultsRecapPackage(result, broadcastFallout, causeLedger);
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, result);
  const [isSegmentBreakdownOpen, setIsSegmentBreakdownOpen] = useState(false);

  return (
    <main className="app-shell gameplay-command-shell results-command-shell">
      <Header game={game} />
      <GameNav currentScreen="results" hasResults hasWeekReview={canContinueWeekReview} onNavigate={onNavigate} />
      <section className={`results-recap-package ${isPleResult ? "ple-panel" : ""}`} aria-label="Broadcast recap package">
        <section className="results-hero">
          <div className="results-scoreboard">
            <p className="eyebrow">
              Season {result.seasonNumber} · Week {result.week} · {getShowTypeLabel(result.showType)}
            </p>
            <div className="results-score-line">
              <h2>{result.totalScore}</h2>
              <strong>{getShowGrade(result.totalScore)}</strong>
            </div>
            <p className="results-show-name">{result.showName}</p>
          </div>
          <div className="results-broadcast-verdict">
            <p className="eyebrow">{isPleResult ? "Major Event Recap" : "Broadcast Recap"}</p>
            <h3>{broadcastFallout.headline}</h3>
            <p>
              {isPleResult ? `${getShowTypeLabel(result.showType)} package locked. ${pleResultRead} ` : ""}
              {recapPackage.verdict}
            </p>
          </div>
          <button className="primary-action" onClick={onContinueWeekReview} disabled={!canContinueWeekReview}>
            {canContinueWeekReview ? "Continue to Week Review" : "Week Review Complete"}
          </button>
        </section>

        <section className="results-headline-grid" aria-label="Headline fallout">
          <article className={`results-headline-card tone-${recapPackage.headline.tone}`}>
            <span>{recapPackage.headline.label}</span>
            <strong>{recapPackage.headline.value}</strong>
            <p>{recapPackage.headline.detail}</p>
          </article>
          <article className="results-performer-swing">
            <span>Who Moved</span>
            <div>
              <strong>{result.biggestMomentumGain.name}</strong>
              <small>Momentum +{result.biggestMomentumGain.amount}</small>
            </div>
            <div>
              <strong>{result.biggestFatigueIncrease.name}</strong>
              <small>Fatigue +{result.biggestFatigueIncrease.amount}</small>
            </div>
          </article>
        </section>

        <section className="results-consequence-reel" aria-label="Consequence reel">
          {recapPackage.consequenceReel.map((beat) => (
            <article className={`results-reel-card tone-${beat.tone}`} key={beat.id}>
              <span>{beat.label}</span>
              <strong>{beat.value}</strong>
              <p>{beat.detail}</p>
            </article>
          ))}
        </section>

        <section className="results-why-strip" aria-label="Why this week mattered">
          <div>
            <p className="eyebrow">Why This Week Mattered</p>
            <h3>{bestSegment.participantNames.join(" / ") || bestSegment.type}</h3>
          </div>
          <p>{recapPackage.whyItMattered}</p>
        </section>
      </section>

      <PostShowCauseLedger sections={causeLedger} collapsible />

      <BroadcastFalloutPanel snapshot={broadcastFallout} />

      <RivalIntelligencePanel game={game} />
      {ratingsBattle ? <RatingsBattlePanel snapshot={ratingsBattle} /> : null}
      {cpuResultsFeed ? <CpuResultsFeedPanel snapshot={cpuResultsFeed} /> : null}

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

      <section className={`results-list ${isSegmentBreakdownOpen ? "is-expanded" : "is-collapsed"}`} aria-label="Segment results">
        <button
          className="results-breakdown-toggle"
          aria-expanded={isSegmentBreakdownOpen}
          aria-controls="results-segment-breakdown"
          onClick={() => setIsSegmentBreakdownOpen((open) => !open)}
          type="button"
        >
          <div>
            <span>Broadcast Breakdown</span>
            <strong>Segment By Segment</strong>
          </div>
          <em>{result.segmentResults.length} resolved segment{result.segmentResults.length === 1 ? "" : "s"}</em>
          <b>{isSegmentBreakdownOpen ? "Collapse" : "Expand"}</b>
        </button>
        {isSegmentBreakdownOpen ? (
          <div className="results-breakdown-body" id="results-segment-breakdown">
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
          </div>
        ) : null}
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
  const titleChanges = titleHistoryEvents.filter((event) => event.eventType === "title_change");
  const rivalryHistoryEvents = result.rivalryHistoryEvents ?? [];
  const nextWeek = game.calendar.find((week) => week.weekNumber === result.week + 1);
  const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= result.week + 1 && !week.completed);
  const weeksUntilNextPle = nextPle ? Math.max(0, nextPle.weekNumber - result.week) : 0;
  const weekReviewOffice = getWeekReviewOfficeSnapshot(game, result, financeReport);
  const weekReviewHandoff = getWeekReviewHandoffSnapshot(game, result, financeReport);
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, result);
  const isPleResult = result.showType === "ple";

  return (
    <main className="app-shell gameplay-command-shell week-review-command-shell">
      <Header game={game} />
      <GameNav currentScreen="weekReview" hasResults hasWeekReview={true} onNavigate={onNavigate} />
      <section className="week-review-command-board" aria-label="Week review command board">
        <section className="week-review-aftermath-hero" aria-label={isPleResult ? "PLE week aftermath" : "Week aftermath"}>
          <div className="week-review-scoreboard">
            <p className="eyebrow">
              Season {result.seasonNumber} · Week {result.week} · {getShowTypeLabel(result.showType)}
            </p>
            <div className="week-review-score-line">
              <h2>{result.totalScore}</h2>
              <strong>{getShowGrade(result.totalScore)}</strong>
            </div>
            <p>{result.showName}</p>
          </div>
          <div className="week-review-aftermath-copy">
            <p className="eyebrow">{isPleResult ? "PLE Aftermath" : "Week Aftermath"}</p>
            <h3>{isPleResult ? "Major-Event Consequences" : "After-Action Consequences"}</h3>
            <p>
              {financeReport
                ? `${result.showName} closed through ${financeReport.attendance.toLocaleString()} paid doors and ${formatMoney(financeReport.profitLoss)} net movement in the office books.`
                : "The office loaded this review without a finance snapshot."}
            </p>
            <p>
              {titleChanges.length
                ? `${titleChanges.length} title change${titleChanges.length === 1 ? "" : "s"} were logged, alongside ${result.rivalryHistoryEvents?.length ?? 0} rivalry event${(result.rivalryHistoryEvents?.length ?? 0) === 1 ? "" : "s"}.`
                : "No title transitions were logged on this show."}
            </p>
          </div>
          <div className="week-review-hero-metrics">
            <Metric label="Best Segment" value={`${bestSegment.score}`} detail={getSegmentResultParticipantsLabel(bestSegment, game.wrestlers)} />
            <Metric
              label="Runtime"
              value={result.actualRuntimeMinutes !== undefined ? `${result.actualRuntimeMinutes} min` : "Legacy"}
              detail={result.plannedRuntimeMinutes !== undefined ? `Planned ${result.plannedRuntimeMinutes} min` : "No runtime record"}
            />
          </div>
          <button className="primary-action" onClick={onAdvanceWeek}>
            {result.week >= 12 ? "Season Review" : "Advance Week"}
          </button>
        </section>

        <section className="week-review-main-board" aria-label="GM after-action handoff">
          <WeekReviewOfficePanel snapshot={weekReviewOffice} />
          <WeekReviewHandoffPanel snapshot={weekReviewHandoff} />
        </section>

        <aside className="week-review-side-rail" aria-label="Next week and world pressure">
          <section className="week-review-side-panel" aria-label="Next week teaser">
            <div className="section-heading">
              <p className="eyebrow">Next Week</p>
              <h3>{nextWeek ? nextWeek.showName : "Season Review"}</h3>
            </div>
            <div className="week-review-side-metrics">
              <Metric label="Next Show" value={nextWeek ? nextWeek.showName : "Season Complete"} detail={nextWeek ? getShowTypeLabel(nextWeek.showType) : "Review the year"} />
              <Metric
                label="Next PLE"
                value={nextPle ? nextPle.showName : "None"}
                detail={nextPle ? `${weeksUntilNextPle} week${weeksUntilNextPle === 1 ? "" : "s"} away` : "No remaining PLE"}
              />
              <Metric label="Action" value={result.week >= 12 ? "Review Season" : "Advance Week"} detail="Calendar moves after this screen" />
            </div>
          </section>

          {buzzPreview.length ? (
            <section className="week-review-side-panel week-review-social-panel" aria-label="Week review social buzz">
              <div className="section-heading">
                <p className="eyebrow">Social Buzz</p>
                <h3>IWC Readout</h3>
              </div>
              <div className="week-review-social-list">
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

          <RivalIntelligencePanel compact game={game} />
        </aside>

        <section className="week-review-consequence-strip" aria-label="Week review consequence strip">
          <section className="locker-room-fallout week-review-strip-panel" aria-label="Roster fallout">
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

          <section className="story-fallout week-review-strip-panel" aria-label="Rivalry and title fallout">
            <div className="section-heading">
              <p className="eyebrow">Rivalry / Title Fallout</p>
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
              <div className="history-list">
                {result.rivalryNotes.map((note, index) => (
                  <article className="history-event" key={`${note}-${index}`}>
                    <span>Rivalry Note</span>
                    <p>{note}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p>No attached rivalry movement.</p>
            )}
            {result.segmentResults.some((segment) => getResolvedSegmentStipulationLabel(segment)) ? (
              <div className="history-list compact-history">
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
            ) : null}
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

          {ratingsBattle ? <RatingsBattlePanel compact snapshot={ratingsBattle} /> : null}
          {cpuResultsFeed ? <CpuResultsFeedPanel compact snapshot={cpuResultsFeed} /> : null}
          {result.broadcastOverrunNotes?.length ? (
            <section className="broadcast-overrun-fallout week-review-overrun-panel" aria-label="Week review broadcast overrun">
              <div className="section-heading">
                <p className="eyebrow">Broadcast Fallout</p>
                <h3>Closing Block Pressure</h3>
              </div>
              {result.broadcastOverrunNotes.map((note, index) => (
                <p key={`${note}-${index}`}>{note}</p>
              ))}
            </section>
          ) : null}
        </section>
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
  const archivedSeasons = [...game.seasonArchives].reverse();
  const ratingsBattle = getRatingsBattleSnapshot(game, bestShow);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, bestShow);

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

      <section className="command-panel season-archive-panel" aria-label="Archived seasons">
        <div className="section-heading">
          <p className="eyebrow">Season Archive</p>
          <h3>Carried Legacy Log</h3>
        </div>
        {archivedSeasons.length === 0 ? (
          <p className="lede">No completed seasons are archived yet. This will capture this season when you advance.</p>
        ) : (
          <div className="spotlight-grid">
            {archivedSeasons.map((archive) => (
              <article key={`archive-${archive.seasonNumber}`} className="card">
                <p className="eyebrow">Season {archive.seasonNumber}</p>
                <h4>Closed at Week 12</h4>
                <div className="archive-metrics">
                  <Metric label="Final Money" value={formatMoney(archive.finalMoney)} detail={`Started at ${formatMoney(archive.seasonStartingMoney)}`} />
                  <Metric label="Season Delta" value={formatMoney(archive.seasonDelta)} detail="Read-only season summary" />
                  <Metric label="Best Show" value={archive.bestShow?.name ?? "No show data"} detail={archive.bestShow ? `${archive.bestShow.score} in week ${archive.bestShow.week}` : "No show closed this season"} />
                  <Metric
                    label="Top Momentum"
                    value={archive.topMomentumStar?.name ?? "No momentum signal"}
                    detail={archive.topMomentumStar ? `${archive.topMomentumStar.value} momentum` : "No complete momentum snapshots"}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="status-grid" aria-label="Season review">
        <Metric label="Starting Money" value={formatMoney(game.seasonStartingMoney)} />
        <Metric label="Final Money" value={formatMoney(game.money)} />
        <Metric label="Season P/L" value={formatMoney(seasonProfitLoss)} />
        <Metric label="Best Show" value={bestShow ? bestShow.showName : "No Shows"} detail={bestShow ? `${bestShow.totalScore} (${getShowGrade(bestShow.totalScore)})` : undefined} />
      </section>

      <RivalIntelligencePanel game={game} />
      {ratingsBattle ? <RatingsBattlePanel snapshot={ratingsBattle} /> : null}
      {cpuResultsFeed ? <CpuResultsFeedPanel snapshot={cpuResultsFeed} /> : null}

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
  game,
  isSelected,
  onSelectWrestler,
  rosterAffiliations,
  wrestler,
}: {
  game: GameState;
  isSelected: boolean;
  onSelectWrestler: (wrestlerId: string) => void;
  rosterAffiliations: WrestlerAffiliation[];
  wrestler: Wrestler;
}) {
  const status = getWrestlerStatus(wrestler);
  const affiliations = rosterAffiliations.filter((affiliation) => affiliation.memberWrestlerIds.includes(wrestler.id));
  const valueProfile = getWrestlerValueProfile(wrestler);
  const identitySnapshot = getWrestlerIdentitySnapshot(wrestler, game);
  const overall = getWrestlerOverall(wrestler);
  const stamina = Math.max(0, 100 - wrestler.fatigue);
  const showValueTierChip = valueProfile.valueTierLabel.toLowerCase() !== "protected star";
  const record = getWrestlerMatchRecord(wrestler.id, game.showHistory);
  const titleLine = getWrestlerTitleLine(wrestler.id, game.championships);
  const contractWeeksLabel = getRosterContractWeeksLabel(game);

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectWrestler(wrestler.id);
    }
  }

  return (
    <article
      aria-label={`Select ${wrestler.name}`}
      aria-pressed={isSelected}
      className={`wrestler-card status-${status.toLowerCase()} ${isSelected ? "selected" : ""}`}
      onClick={() => onSelectWrestler(wrestler.id)}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="wrestler-card-head">
        <div className="wrestler-card-select" aria-hidden="true">
          <span className="wrestler-card-overall">{overall}</span>
          <WrestlerPortrait className="wrestler-card-portrait" wrestler={wrestler} />
        </div>
        <div>
          {titleLine ? <p className="eyebrow">{titleLine}</p> : null}
          <h3>{wrestler.name}</h3>
          <small className="wrestler-card-meta-line">
            <span>{getRosterAlignmentLabel(wrestler)}</span>
            <span>Pop {wrestler.popularity}</span>
          </small>
        </div>
      </div>
      <div className="pressure-tags">
        {identitySnapshot.labels
          .filter((label) => {
            const normalizedLabel = label.toLowerCase();
            return normalizedLabel !== "protected star" && normalizedLabel !== "champion";
          })
          .slice(0, 2)
          .map((label) => (
            <span className="identity-chip" key={label}>
              {label}
            </span>
          ))}
        {showValueTierChip ? (
          <span className={`value-tier-chip ${valueProfile.contextMode === "missing" ? "value-tier-chip-missing" : ""}`}>
            {valueProfile.valueTierLabel}
          </span>
        ) : null}
      </div>
      {affiliations.length ? (
        <div className="affiliation-strip compact-affiliation-strip" aria-label={`${wrestler.name} affiliation context`}>
          {affiliations.slice(0, 1).map((affiliation) => (
            <span key={affiliation.id}>
              {affiliation.name} · {formatAffiliationKind(affiliation.kind)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="wrestler-card-readouts" aria-label={`${wrestler.name} compact stats`}>
        <div className="wrestler-card-stamina">
          <span>Stamina</span>
          <b style={{ width: `${stamina}%` }} />
          <strong>{stamina}</strong>
        </div>
        <div className={`wrestler-card-morale morale-${getMoraleTone(wrestler.morale)}`}>
          <span>Morale</span>
          <strong aria-label={`Morale ${wrestler.morale}`}>
            {getMoraleEmoji(wrestler.morale)}
            <em>{wrestler.morale}</em>
          </strong>
        </div>
      </div>
      <div className="wrestler-card-foot">
        <span>{contractWeeksLabel}</span>
        <span>{`W: ${record.wins} | L: ${record.losses}`}</span>
      </div>
    </article>
  );
}

function TitleMatchControl({
  championships,
  game,
  onBuildTitleMatch,
  onSetSegmentChampionship,
  segment,
  wrestlers,
}: {
  championships: Championship[];
  game: GameState;
  onBuildTitleMatch: (segmentId: string, championshipId: string) => void;
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
    const buildableTagChampionships = !eligibleChampionships.length
      ? tagChampionships.filter((championship) => buildSanctionedTitleMatchSegment(game, segment, championship.id))
      : [];
    const tagTitleStatus = (() => {
      if (!tagChampionships.length) {
        return "No tag championship is assigned to this brand yet.";
      }

      if (segment.participantIds.length !== 4) {
        return buildableTagChampionships.length
          ? "Choose a tag title below to auto-fill the champion pair and legal challengers into this slot."
          : "Needs exactly four unique wrestlers before a tag title defense can be sanctioned.";
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
        {eligibleChampionships.length || buildableTagChampionships.length || segment.championshipId ? (
          <div className="title-buttons">
            {eligibleChampionships.length || segment.championshipId ? (
              <button className={!segment.championshipId ? "active-filter" : ""} onClick={() => onSetSegmentChampionship(segment.id, "")}>
                Non-Title
              </button>
            ) : null}
            {(eligibleChampionships.length ? eligibleChampionships : buildableTagChampionships).map((championship) => (
              <button
                className={segment.championshipId === championship.id ? "active-filter" : ""}
                key={championship.id}
                onClick={() =>
                  eligibleChampionships.length
                    ? onSetSegmentChampionship(segment.id, championship.id)
                    : onBuildTitleMatch(segment.id, championship.id)
                }
              >
                {championship.name} · {eligibleChampionships.length ? "Tag Defense" : "Build Tag Defense"}
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
  const buildableChampionships = isTitleMatch && !eligibleChampionships.length
    ? championships.filter((championship) => buildSanctionedTitleMatchSegment(game, segment, championship.id))
    : [];
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
      return buildableChampionships.length
        ? "Choose a championship below to auto-fill the champion and challenger into this match slot."
        : "Select competitors to see whether this can become a sanctioned title defense.";
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

    if (buildableChampionships.length) {
      return "This slot is not title-eligible yet. Choose a championship below to rebuild it as a sanctioned defense.";
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
      {eligibleChampionships.length || buildableChampionships.length ? (
        <div className="title-buttons">
          {eligibleChampionships.length ? (
            <button className={!segment.championshipId ? "active-filter" : ""} onClick={() => onSetSegmentChampionship(segment.id, "")}>
              {clearLabel}
            </button>
          ) : null}
          {(eligibleChampionships.length ? eligibleChampionships : buildableChampionships).map((championship) => (
            <button
              className={segment.championshipId === championship.id ? "active-filter" : ""}
              key={championship.id}
              onClick={() =>
                eligibleChampionships.length
                  ? onSetSegmentChampionship(segment.id, championship.id)
                  : onBuildTitleMatch(segment.id, championship.id)
              }
            >
              {championship.name} · {eligibleChampionships.length ? (isTitleMatch ? "Sanctioned Defense" : championship.division) : "Build Defense"}
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

export default App;
