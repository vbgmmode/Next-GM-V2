import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppBootRequest } from "./appBoot";
import { syncAppViewportHeight } from "./viewportHeight";
import { CommandPanel, HeroDecisionPanel, MetricTile, getBroadcastTheme } from "./components/broadcast";
import { GameNav, Header, Metric } from "./components/gameShell";
import { DynastyManagementShell, type DynastyManagementCta } from "./components/DynastyManagementShell";
import { SetupBrandPortraitGrid } from "./components/SetupBrandPortraitGrid";
import { SetupGmPortraitGrid } from "./components/SetupGmPortraitGrid";
import { getPrestigeMainEventAnchorSnapshot } from "./game/championshipPrestigeReads";
import { formatMoney } from "./game/formatters";
import {
  MAX_SAVE_SLOTS,
  createSaveRecord,
  deleteSaveRecord,
  loadSaveRecord,
  loadSaveSummaries,
  renameSaveRecord,
  updateSaveRecord,
} from "./gameStorage";
import { advanceGameWeek } from "./game/advanceWeek";
import { generateExternalAiSocialCommentary } from "./game/aiCommentary";
import { getRosterAffiliations, getWrestlerAffiliations } from "./game/affiliationCatalog";
import { getFinancePressureLabel } from "./game/finance";
import { getRosterFinanceValueForWrestler } from "./game/financeCatalog";
import {
  getMarketSnapshot,
  getRivalMarketEvents,
  proposePlayerTrade,
  releasePlayerWrestler,
  renewPlayerContract,
  signPlayerFreeAgentBundle,
  submitPlayerMarketOffer,
} from "./game/market";
import { MARKET_CONTRACT_MAX_WEEKS, PLE_COUNT, PLE_CYCLE_WEEKS, SEASON_WEEK_COUNT } from "./game/constants";
import {
  getCpuDraftPreviewSnapshot,
  getCpuResultsFeedSnapshot,
  getRatingsBattleSnapshot,
  type CpuDraftPreviewSnapshot,
  type CpuResultsFeedSnapshot,
  type RatingsBattleSnapshot,
} from "./game/cpuRivalLoop";
import { completeMidCareerDraft } from "./game/midCareerDraft";
import {
  bookingSegmentTypes,
  getCatalogOptionById,
  getCatalogOptionsForType,
  getDefaultCatalogOption,
  getSegmentCatalogOption,
  getSegmentParticipantRange,
  type SegmentCatalogOption,
} from "./game/matchFormatCatalog";
import { createMatchSimulationLabGame } from "./game/matchSimulationLab";
import { getStipulationById } from "./game/stipulationCatalog";
import { CURRENT_SAVE_VERSION, migrateSavedGameState } from "./game/migration";
import { buildSeasonArchiveSummary } from "./game/seasonArchiveReads";
import { createUniqueDomainId } from "./game/domainIds";
import { getWrestlerIdentityContext } from "./game/wrestlerIdentityContext";
import {
  getChampionshipPressureSnapshots,
  getLivingWorldPressureSnapshot,
  getPleBuildPressureSnapshot,
  getTitleDivisionScene,
  getWeeklyDecisionPressureSnapshot,
  type LivingWorldPressureSnapshot,
  type PleBuildPressureSnapshot,
  type WeeklyDecisionPressureSnapshot,
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
  deriveRivalryStage,
  getRivalryGMRead,
  getRivalryRelationship,
  getRivalryStoryline,
  safeRivalryStorylineOptions,
} from "./game/rivalryCatalog";
import {
  createNewGame,
  createRivalBrandUniverse,
  draftPool,
} from "./game/seed";
import {
  getBestSegment,
  getCurrentCalendarWeek,
  getResultChange,
  getShowGrade,
  getWrestlerDivisionGroup,
  hasIntergenderMatchParticipants,
  isValidSegment,
  createPlayableRunShowOptions,
  runShow,
} from "./game/scoring";
import { getChampionshipArtworkSrc, getTitleCatalogBrand, wrestlerFitsChampionshipDivision } from "./game/titleCatalog";
import {
  acceptSocialInboxPromise,
  acceptSocialInboxRest,
  declineSocialInboxRequest,
  getProtectedRestWrestlerIds,
  isWrestlerProtectedRest,
} from "./game/socialInboxActions";
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
  DraftMode,
  StartingBudgetTier,
  Wrestler,
  WrestlerAffiliation,
} from "./game/types";
import type { GameScreen, ProfileReturnScreen, SavedGameState } from "./game/migration";
import type { StoredSaveRecord, StoredSaveSummary } from "./gameStorage";
import type { RivalryCreateInput } from "./screens/RivalriesScreen";
import {
  getBestRevenueReport,
  getFinanceGrossRevenue,
  getFinanceReportForResult,
  getSeasonFinanceReports,
  getWorstProfitReport,
} from "./screens/financeScreenReads";
import { scheduleRivalryEndInGame } from "./game/rivalryEnd";
import { createRivalryInGame, getRivalryStructureParticipantRange, hasDuplicateRivalry } from "./game/rivalryMutations";
import {
  addBookingSegment,
  removeBookingSegment,
  replaceCurrentShow as replaceCurrentShowInGame,
  setSegmentChampionship as setSegmentChampionshipInGame,
  setSegmentRivalry as setSegmentRivalryInGame,
  setSegmentStipulation as setSegmentStipulationInGame,
  toggleSegmentParticipant,
  updateBookingSegment,
} from "./game/bookingMutations";
import { assignChampionshipInGame, revokeChampionshipInGame } from "./game/championshipMutations";
import {
  canSegmentAttachChampionship,
  canSegmentAttachRivalry,
  canSegmentContestChampionship,
  isSinglesChampionship,
  pickParticipantIdCombinations,
  resolveSinglesTitleMatchCatalogOption,
} from "./booking/bookingUtils";
import { getWrestlerValueProfile } from "./roster/rosterValueReads";
import type { WrestlerValueProfile } from "./roster/rosterTypes";
import type { SuperstarMailDecision, SuperstarMailItem } from "./social/socialTypes";
import { buildQaRuntimeHarnessState, getQaHarnessMode } from "./qa/qaHarness";
import {
  formatDraftGenderReadout,
  formatProjectedReserve,
  getDraftFinanceNote,
  getDraftTag,
  getRivalUniverseRead,
  recommendedDraftRosterTarget,
  tvReadyDraftRosterTarget,
  type DraftFinanceReadout,
} from "./setup/setupReads";

const BookingScreen = lazy(() => import("./booking").then((module) => ({ default: module.BookingScreen })));
const CalendarScreen = lazy(() => import("./screens/CalendarScreen").then((module) => ({ default: module.CalendarScreen })));
const DashboardScreen = lazy(() => import("./screens/DashboardScreen").then((module) => ({ default: module.DashboardScreen })));
const ChampionshipsScreen = lazy(() => import("./screens/ChampionshipsScreen").then((module) => ({ default: module.ChampionshipsScreen })));
const FinanceScreen = lazy(() => import("./screens/FinanceScreen").then((module) => ({ default: module.FinanceScreen })));
const MarketScreen = lazy(() => import("./screens/MarketScreen").then((module) => ({ default: module.MarketScreen })));
const MatchSimulationLabScreen = lazy(() => import("./screens/MatchSimulationLabScreen").then((module) => ({ default: module.MatchSimulationLabScreen })));
const NewGameSetupScreen = lazy(() => import("./setup/NewGameSetupScreen").then((module) => ({ default: module.NewGameSetupScreen })));
const OffseasonDraftScreen = lazy(() => import("./screens/OffseasonDraftScreen").then((module) => ({ default: module.OffseasonDraftScreen })));
const ResultsScreen = lazy(() => import("./screens/ResultsScreen").then((module) => ({ default: module.ResultsScreen })));
const SeasonReviewScreen = lazy(() => import("./screens/SeasonReviewScreen").then((module) => ({ default: module.SeasonReviewScreen })));
const RivalriesScreen = lazy(() => import("./screens/RivalriesScreen").then((module) => ({ default: module.RivalriesScreen })));
const RosterScreen = lazy(() => import("./roster").then((module) => ({ default: module.RosterScreen })));
const SocialScreen = lazy(() => import("./social").then((module) => ({ default: module.SocialScreen })));
const WrestlerProfileScreen = lazy(() => import("./roster").then((module) => ({ default: module.WrestlerProfileScreen })));

type RosterSort = "popularity" | "momentum" | "fatigue" | "morale";
type RosterFilter = "all" | "mens" | "womens" | "champions" | "injured" | "hot" | "tired" | "morale" | "underused";
type RosterStatus = "Hot" | "Tired" | "Frustrated" | "Steady";
type ProfilePanelId = "stats" | "gmRead" | "contractValue" | "affiliations" | "showHistory" | "championships" | "rivalries" | "social";
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
  state?: SavedGameState;
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

type FreeAgentWatchEntry = {
  profile: WrestlerValueProfile;
  wrestler: Wrestler;
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

const showRuntimeTargetMinutes = 120;
const showRuntimeMinMinutes = 90;
const showRuntimeOvertimeMinutes = 135;
const tvRuntimeWarningMinutes = 150;
const maxBookingSegments = 24;

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
    offseasonDraft: "Offseason Draft",
    social: "IWC Pulse",
    weekReview: "Show Recap",
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

function getSegmentStipulationLabel(segment: Pick<Segment, "stipulationId" | "type" | "segmentCatalogId">) {
  const stipulation = getStipulationById(segment.stipulationId);

  return stipulation ? stipulation.label : "No stipulation";
}

function getResolvedSegmentStipulationLabel(segment: Pick<SegmentResult, "stipulationId" | "type" | "segmentCatalogId">) {
  const stipulation = getStipulationById(segment.stipulationId);

  return stipulation ? stipulation.label : undefined;
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

  if (!isValidSegment(segment, game.wrestlers, getProtectedRestWrestlerIds(game))) {
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
      isValidSegment(mainEvent, game.wrestlers, getProtectedRestWrestlerIds(game)) &&
      (mainEvent.championshipId || mainEvent.rivalryId || mainEventParticipants.some(isMajorEventStar)),
  );
  const prestigeAnchor = getPrestigeMainEventAnchorSnapshot(game, validShowSegments);
  const mainEventAnchorStatus =
    prestigeAnchor.isSeasonFinalePle
      ? prestigeAnchor.status === "anchored"
        ? "Top belt closes the finale"
        : prestigeAnchor.status === "wrong_closer"
          ? "Wrong belt in closing slot"
          : prestigeAnchor.status === "anchor_missing"
            ? "Top belt missing from card"
            : "No closing slot yet"
      : mainEventHasAnchor
        ? "Closing slot has stakes"
        : mainEvent
          ? "Closing slot is light"
          : "No closing slot yet";
  const mainEventAnchorDetail =
    prestigeAnchor.isSeasonFinalePle
      ? prestigeAnchor.detail
      : mainEvent
        ? `${mainEvent.segmentDisplayName ?? mainEvent.type} closes the rundown${mainEventParticipants.length ? ` with ${getSegmentParticipantsLabel(mainEvent, game.wrestlers)}` : ""}.`
        : "Add a valid final segment before the PLE goes live.";
  const mainEventAnchorTone =
    prestigeAnchor.isSeasonFinalePle
      ? prestigeAnchor.status === "anchored"
        ? "ready"
        : prestigeAnchor.status === "wrong_closer"
          ? "watch"
          : "build"
      : mainEventHasAnchor
        ? "ready"
        : mainEvent
          ? "watch"
          : "build";
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
      label: prestigeAnchor.isSeasonFinalePle ? "Prestige Main Event" : "Main Event Anchor",
      status: mainEventAnchorStatus,
      detail: mainEventAnchorDetail,
      tone: mainEventAnchorTone,
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

function isTagChampionship(championship: Championship) {
  return championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team";
}

function buildSanctionedTitleMatchSegment(game: GameState, sourceSegment: Segment, championshipId: string) {
  const championship = game.championships.find((title) => title.id === championshipId);

  if (!championship || sourceSegment.type !== "Match") {
    return undefined;
  }

  const isTagTitle = isTagChampionship(championship);
  const option = resolveSinglesTitleMatchCatalogOption(sourceSegment, isTagTitle);

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
    if (!isValidSegment(candidate, game.wrestlers, getProtectedRestWrestlerIds(game)) || !canSegmentAttachChampionship(candidate, championship, game.wrestlers)) {
      return undefined;
    }

    return { ...candidate, championshipId: championship.id };
  };
  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
  const challengerPool = scene.eligibleRoster.length ? scene.eligibleRoster : scene.topContenders;

  if (!isTagTitle) {
    const participantCount = option.maxParticipants;
    const poolIds = challengerPool.map((wrestler) => wrestler.id);

    if (sourceSegment.participantIds.length === participantCount) {
      const attachedSourceCandidate = getAttachedCandidate(makeCandidate(sourceSegment.participantIds));

      if (attachedSourceCandidate) {
        return attachedSourceCandidate;
      }
    }

    if (championship.championIds.length === 0) {
      for (const participantIds of pickParticipantIdCombinations(poolIds, participantCount)) {
        const attachedCandidate = getAttachedCandidate(makeCandidate(participantIds));

        if (attachedCandidate) {
          return attachedCandidate;
        }
      }

      return undefined;
    }

    const championId = championship.championIds[0];

    for (const challengerIds of pickParticipantIdCombinations(poolIds, participantCount - 1)) {
      const attachedCandidate = getAttachedCandidate(makeCandidate([championId, ...challengerIds]));

      if (attachedCandidate) {
        return attachedCandidate;
      }
    }

    return undefined;
  }

  if (championship.championIds.length === 0) {
    for (let firstIndex = 0; firstIndex < challengerPool.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < challengerPool.length; secondIndex += 1) {
        for (let thirdIndex = secondIndex + 1; thirdIndex < challengerPool.length; thirdIndex += 1) {
          for (let fourthIndex = thirdIndex + 1; fourthIndex < challengerPool.length; fourthIndex += 1) {
            const candidate = makeCandidate([
              challengerPool[firstIndex].id,
              challengerPool[secondIndex].id,
              challengerPool[thirdIndex].id,
              challengerPool[fourthIndex].id,
            ]);
            const attachedCandidate = getAttachedCandidate(candidate);

            if (attachedCandidate) {
              return attachedCandidate;
            }
          }
        }
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

function formatWeekCount(weeks: number) {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
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

function formatHistoryStamp(
  event: Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "seasonNumber" | "weekNumber"> &
    Partial<Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "showName" | "showType">>,
) {
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
      .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship, wrestlers));

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
      return "Triple";
    default:
      return "Singles";
  }
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

function getRivalryCreationBlockReason(
  structure: RivalryStructure,
  participantIds: string[],
  wrestlers: Wrestler[],
  rivalries: Rivalry[] = [],
) {
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

  const activeRivalryParticipantIds = new Set(rivalries.flatMap((rivalry) => rivalry.participantIds));
  const busyParticipants = selectedIds.filter((id) => activeRivalryParticipantIds.has(id));

  if (busyParticipants.length) {
    const busyNames = getWrestlerNames(busyParticipants, wrestlers);

    return busyNames
      ? `${busyNames} ${busyParticipants.length === 1 ? "is" : "are"} already locked into an active feud.`
      : "One or more selected wrestlers are already locked into an active feud.";
  }

  if (structure === "tag_team" && selectedIds.length !== 4) {
    return "Tag rivalries need exactly two wrestlers on each side.";
  }

  if (structure === "singles" && selectedIds.length !== 2) {
    return "Singles rivalries need exactly two wrestlers.";
  }

  if (structure === "multi_person" && selectedIds.length !== 3) {
    return "Triple rivalries need exactly three wrestlers.";
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

function getRosterContractWeeksLabel(game: GameState) {
  const seasonWeeksRemaining = Math.max(0, (game.calendar.length || SEASON_WEEK_COUNT) - game.currentWeek + 1);
  return `${seasonWeeksRemaining} WK${seasonWeeksRemaining === 1 ? "" : "S"} LEFT`;
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

function buildSavedGameState(
  game: GameState,
  screen: SavedGameState["screen"],
  profileState?: Pick<SavedGameState, "profileReturnScreen" | "profileWrestlerId">,
): SavedGameState {
  return { saveVersion: CURRENT_SAVE_VERSION, game, screen, ...profileState };
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

function isGameScreenPreview(value: string): value is GameScreen {
  return (
    value === "dashboard" ||
    value === "booking" ||
    value === "roster" ||
    value === "market" ||
    value === "profile" ||
    value === "championships" ||
    value === "rivalries" ||
    value === "calendar" ||
    value === "social" ||
    value === "finance" ||
    value === "results" ||
    value === "weekReview" ||
    value === "seasonReview" ||
    value === "offseasonDraft"
  );
}

function normalizeCareerSummary(summary: StoredSaveSummary): CareerSave {
  const previewScreen = isGameScreenPreview(summary.preview.screen) ? summary.preview.screen : "dashboard";

  return {
    id: summary.id,
    name: summary.name,
    createdAt: summary.createdAt,
    lastPlayedAt: summary.lastPlayedAt,
    preview: {
      brandName: summary.preview.brandName,
      gmName: summary.preview.gmName,
      money: summary.preview.money,
      screen: previewScreen === "weekReview" ? "results" : previewScreen,
      seasonNumber: summary.preview.seasonNumber,
      week: summary.preview.week,
    },
  };
}

function loadCareerSaves() {
  return loadSaveSummaries().map(normalizeCareerSummary);
}

function isDevMatchSimulationLabRequested() {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

  if (!env?.DEV) {
    return false;
  }

  return new URLSearchParams(window.location.search).get("dev") === "match-simulation-lab";
}

function getMostRecentCareer(careerSaves: CareerSave[]) {
  return careerSaves[0] ?? null;
}

function ScreenLoadingState() {
  return (
    <main className="app-shell">
      <section className="command-panel">
        <p className="eyebrow">Loading Desk</p>
        <h2>Opening the command center</h2>
        <p className="muted-copy">Preparing the next playable screen.</p>
      </section>
    </main>
  );
}

function renderLazyScreen(screen: ReactNode) {
  return <Suspense fallback={<ScreenLoadingState />}>{screen}</Suspense>;
}

function App({ bootRequest }: { bootRequest?: AppBootRequest } = {}) {
  const qaHarnessState = useMemo(() => {
    const mode = getQaHarnessMode();
    return mode ? buildQaRuntimeHarnessState(mode) : null;
  }, []);
  const isQaHarness = Boolean(qaHarnessState);
  const initialScreen = bootRequest?.type === "new-career" ? "setup" : "title";
  const [careerSaves, setCareerSaves] = useState<CareerSave[]>(() => (isQaHarness ? [] : loadCareerSaves()));
  const [savedGame, setSavedGame] = useState<SavedGameState | null>(qaHarnessState);
  const [activeSaveId, setActiveSaveId] = useState<string | undefined>();
  const [screen, setScreen] = useState<Screen>(qaHarnessState?.screen ?? initialScreen);
  const [titleMode, setTitleMode] = useState<TitleMode>("home");
  const [game, setGame] = useState<GameState | null>(qaHarnessState?.game ?? null);
  const [profileWrestlerId, setProfileWrestlerId] = useState<string | undefined>(qaHarnessState?.profileWrestlerId);
  const [profileReturnScreen, setProfileReturnScreen] = useState<ProfileReturnScreen>(qaHarnessState?.profileReturnScreen ?? "roster");
  const [bookingFocusSegmentId, setBookingFocusSegmentId] = useState<string | undefined>();
  const [rivalriesFocusId, setRivalriesFocusId] = useState<string | undefined>();
  const [didApplyBootRequest, setDidApplyBootRequest] = useState(bootRequest?.type !== "load-career");
  const latestResult = game?.showHistory[game.showHistory.length - 1];
  const hasCurrentPostShow = latestResult ? latestResult.week === game?.currentWeek : false;
  const recentCareer = getMostRecentCareer(careerSaves);
  const isMatchSimulationLab = isDevMatchSimulationLabRequested();
  const matchSimulationLabGame = useMemo(() => createMatchSimulationLabGame(game ?? undefined), [game]);

  useEffect(() => syncAppViewportHeight(), []);

  useEffect(() => {
    if (!bootRequest || bootRequest.type !== "load-career" || didApplyBootRequest) {
      return;
    }

    const targetCareer = loadCareerSaves().find((careerSave) => careerSave.id === bootRequest.saveId);

    if (targetCareer) {
      loadCareer(targetCareer);
    }

    setDidApplyBootRequest(true);
  }, [bootRequest, didApplyBootRequest]);

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
    draftMode: DraftMode;
    rivalGMAssignments: RivalGMAssignment[];
    draftedWrestlers: Wrestler[];
    draftPickGroups?: string[][];
    draftBundleDiscountUsd?: number;
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
    const hydratedRecord = careerSave.state ? undefined : loadSaveRecord(careerSave.id);
    const hydratedCareerSave = careerSave.state ? careerSave : hydratedRecord ? normalizeCareerSave(hydratedRecord) : null;

    if (!hydratedCareerSave?.state) {
      deleteSaveRecord(careerSave.id);
      refreshCareerSaves();
      return;
    }

    updateSaveRecord(hydratedCareerSave.id, hydratedCareerSave.state);
    refreshCareerSaves();
    setActiveSaveId(hydratedCareerSave.id);
    setSavedGame(hydratedCareerSave.state);
    setGame(hydratedCareerSave.state.game);
    setProfileWrestlerId(hydratedCareerSave.state.profileWrestlerId);
    setProfileReturnScreen(hydratedCareerSave.state.profileReturnScreen ?? "roster");
    setTitleMode("home");
    setScreen(hydratedCareerSave.state.screen);
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

    if (nextScreen === "weekReview") {
      const destination = hasCurrentPostShow ? "results" : "dashboard";
      persistGameSnapshot(game, destination);
      setProfileWrestlerId(undefined);
      setProfileReturnScreen("roster");
      setScreen(destination);
      return;
    }

    if (nextScreen === "results" && !latestResult) {
      persistGameSnapshot(game, "dashboard");
      setProfileWrestlerId(undefined);
      setProfileReturnScreen("roster");
      setScreen("dashboard");
      return;
    }

    persistGameSnapshot(game, nextScreen);
    setProfileWrestlerId(undefined);
    setProfileReturnScreen(nextScreen === "booking" ? "booking" : "roster");
    setRivalriesFocusId(undefined);
    setScreen(nextScreen);
  }

  function openRivalryDesk(rivalryId: string) {
    if (!game || !game.rivalries.some((rivalry) => rivalry.id === rivalryId)) {
      return;
    }

    persistGameSnapshot(game, "rivalries");
    setRivalriesFocusId(rivalryId);
    setScreen("rivalries");
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
      if (!current) {
        return current;
      }

      const updatedGame = addBookingSegment(current, type, segmentId, maxBookingSegments);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function handleSuperstarMailAction(item: SuperstarMailItem, decision: SuperstarMailDecision) {
    const action = item.action;
    if (!action) {
      return;
    }

    setGame((current) => {
      if (!current) {
        return current;
      }

      if (decision === "decline") {
        const updatedGame = declineSocialInboxRequest(current, item, action.type);
        persistGameSnapshot(updatedGame, "social");
        return updatedGame;
      }

      if (action.type === "rest") {
        const updatedGame = acceptSocialInboxRest(current, item);
        persistGameSnapshot(updatedGame, "social");
        return updatedGame;
      }

      const updatedGame = acceptSocialInboxPromise(current, item, action.type);
      persistGameSnapshot(updatedGame, "social");
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
        candidateIds.push("M001");
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

    if (participants.some((wrestler) => !wrestler || wrestler.injuryStatus === "major" || isWrestlerProtectedRest(current, wrestler.id))) {
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

      if (!isValidSegment(candidate, current.wrestlers, getProtectedRestWrestlerIds(current)) || !canSegmentAttachRivalry(candidate, rivalry, current.wrestlers)) {
        continue;
      }

      const championship = option.championshipAllowed
        ? current.championships.find((title) => canSegmentAttachChampionship(candidate, title, current.wrestlers))
        : undefined;
      const segment = championship ? { ...candidate, championshipId: championship.id } : candidate;

      if (isValidSegment(segment, current.wrestlers, getProtectedRestWrestlerIds(current)) && canSegmentAttachRivalry(segment, rivalry, current.wrestlers)) {
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

      const segmentId = createUniqueDomainId("rivalry-segment", [current.seasonNumber, current.currentWeek, current.currentShow.length + 1, rivalry.id], current.currentShow.map((segment) => segment.id));
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

      if (championship.championIds.some((id) => isWrestlerProtectedRest(current, id))) {
        return current;
      }

      const isTagTitle = isTagChampionship(championship);
      const option = getCatalogOptionById(isTagTitle ? "M020" : "M001") ?? getDefaultCatalogOption("Match")!;
      const scene = getTitleDivisionScene(championship, current.wrestlers, current.rivalries, current.currentWeek, current.championships);
      const contenderPool = (scene.eligibleRoster.length ? scene.eligibleRoster : scene.topContenders).filter(
        (wrestler) => !isWrestlerProtectedRest(current, wrestler.id),
      );
      const contenderCount = isTagTitle ? (championship.championIds.length ? 2 : 4) : (championship.championIds.length ? 1 : 2);
      const challengerIds = contenderPool.slice(0, contenderCount).map((wrestler) => wrestler.id);
      const participantIds = [...championship.championIds, ...challengerIds];
      const segmentId = createUniqueDomainId("title-segment", [current.seasonNumber, current.currentWeek, current.currentShow.length + 1, championship.id], current.currentShow.map((segment) => segment.id));
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
            return Boolean(wrestler && wrestlerFitsChampionshipDivision(wrestler, championship, current.wrestlers));
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

      const updatedGame = revokeChampionshipInGame(current, championshipId);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "championships");
      return updatedGame;
    });
  }

  function assignChampionship(championshipId: string, championIds: string[]) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = assignChampionshipInGame(current, championshipId, championIds);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "championships");
      return updatedGame;
    });
  }

  function updateSegment(segmentId: string, updates: Partial<Segment>) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = updateBookingSegment(current, segmentId, updates);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function replaceCurrentShow(segments: Segment[]) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = replaceCurrentShowInGame(current, segments);
      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function setSegmentChampionship(segmentId: string, championshipId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = setSegmentChampionshipInGame(current, segmentId, championshipId);

      if (updatedGame === current) {
        return current;
      }

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

      const updatedGame = setSegmentStipulationInGame(current, segmentId, stipulationId);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function setSegmentRivalry(segmentId: string, rivalryId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = setSegmentRivalryInGame(current, segmentId, rivalryId);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function removeSegment(id: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = removeBookingSegment(current, id);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function toggleParticipant(segmentId: string, wrestlerId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = toggleSegmentParticipant(current, segmentId, wrestlerId);

      if (updatedGame === current) {
        return current;
      }

      persistGameSnapshot(updatedGame, "booking");
      return updatedGame;
    });
  }

  function handleRunShow() {
    if (!game) {
      return;
    }

    const resolvedShow = runShow(game, createPlayableRunShowOptions());
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
      const seasonWeekCount = current.calendar.length || 12;
      const nextScreen = current.currentWeek >= seasonWeekCount ? "seasonReview" : "dashboard";

      persistGameSnapshot(updatedGame, nextScreen);
      return updatedGame;
    });
    setScreen(game && game.currentWeek >= (game.calendar.length || 12) ? "seasonReview" : "dashboard");
  }

  function handleStartNextSeason() {
    if (!game) {
      return;
    }

    persistGameSnapshot(game, "offseasonDraft");
    setScreen("offseasonDraft");
  }

  function completeOffseasonDraft(selectedWrestlerIds: string[]) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const completedSeasonArchive = buildSeasonArchiveSummary(current);
      const updatedGame = completeMidCareerDraft(current, selectedWrestlerIds, completedSeasonArchive);
      persistGameSnapshot(updatedGame, "dashboard");
      return updatedGame;
    });
    setScreen("dashboard");
  }

  function submitMarketOffer(wrestlerId: string, contractWeeks: number, weeklySalary: number) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const latestCurrentResult = current.showHistory[current.showHistory.length - 1];
      if (latestCurrentResult?.week === current.currentWeek) {
        return current;
      }

      const updatedGame = submitPlayerMarketOffer(current, wrestlerId, draftPool, contractWeeks, weeklySalary);
      persistGameSnapshot(updatedGame, "market");
      return updatedGame;
    });
  }

  function signFreeAgentBundle(affiliationId: string, contractWeeks: number) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const latestCurrentResult = current.showHistory[current.showHistory.length - 1];
      if (latestCurrentResult?.week === current.currentWeek) {
        return current;
      }

      const updatedGame = signPlayerFreeAgentBundle(current, affiliationId, draftPool, contractWeeks);
      persistGameSnapshot(updatedGame, "market");
      return updatedGame;
    });
  }

  function setWrestlerAlignment(wrestlerId: string, alignment: import("./game/wrestlerAlignment").WrestlerAlignment) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        wrestlers: current.wrestlers.map((wrestler) => (wrestler.id === wrestlerId ? { ...wrestler, alignment } : wrestler)),
      };

      persistGameSnapshot(updatedGame, "roster");
      return updatedGame;
    });
  }

  function renewContract(
    wrestlerId: string,
    contractWeeks: number,
    nextScreen: SavedGameState["screen"] = "market",
    profileState?: Pick<SavedGameState, "profileReturnScreen" | "profileWrestlerId">,
  ) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const latestCurrentResult = current.showHistory[current.showHistory.length - 1];
      if (latestCurrentResult?.week === current.currentWeek) {
        return current;
      }

      const updatedGame = renewPlayerContract(current, wrestlerId, contractWeeks);
      persistGameSnapshot(updatedGame, nextScreen, profileState);
      return updatedGame;
    });
  }

  function releaseWrestler(wrestlerId: string, nextScreen: SavedGameState["screen"] = "market") {
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

      const latestCurrentResult = current.showHistory[current.showHistory.length - 1];
      if (latestCurrentResult?.week === current.currentWeek) {
        return current;
      }

      if ((titleWarning || rivalryWarning) && !window.confirm(`${wrestler.name} is tied to ${titleWarning ? "a championship" : "an active rivalry"}. Release anyway?`)) {
        return current;
      }

      const updatedGame = releasePlayerWrestler(current, wrestlerId);
      persistGameSnapshot(updatedGame, nextScreen);
      return updatedGame;
    });
  }

  function proposeTrade(outgoingWrestlerId: string, targetWrestlerId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const latestCurrentResult = current.showHistory[current.showHistory.length - 1];
      if (latestCurrentResult?.week === current.currentWeek) {
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

      if (
        !current ||
        hasDuplicateRivalry(current.rivalries, structure, selectedIds) ||
        getRivalryCreationBlockReason(structure, selectedIds, current.wrestlers, current.rivalries)
      ) {
        return current;
      }

      const updatedGame = createRivalryInGame(current, { participantIds: selectedIds, structure, stakes, storylineId });

      persistGameSnapshot(updatedGame, "rivalries");
      return updatedGame;
    });
  }

  function scheduleRivalryEnd(rivalryId: string, reason: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = scheduleRivalryEndInGame(current, rivalryId, reason);
      persistGameSnapshot(updatedGame, "rivalries");
      return updatedGame;
    });
  }

  if (isMatchSimulationLab) {
    return renderLazyScreen(<MatchSimulationLabScreen game={matchSimulationLabGame} />);
  }

  if (screen === "setup") {
    return renderLazyScreen(<NewGameSetupScreen onCancel={() => setScreen("title")} onStartCareer={startCareer} />);
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
    return renderLazyScreen(
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
      />,
    );
  }

  if (screen === "profile") {
    const profileWrestler = game.wrestlers.find((wrestler) => wrestler.id === profileWrestlerId);

    if (!profileWrestler) {
      return renderLazyScreen(<RosterScreen game={game} latestResult={latestResult} onNavigate={navigateTo} onOpenProfile={(wrestlerId) => openWrestlerProfile(wrestlerId, "roster")} />);
    }

    return renderLazyScreen(
      <WrestlerProfileScreen
        game={game}
        latestResult={latestResult}
        onBackToBooking={() => closeWrestlerProfile("booking")}
        onBackToDashboard={() => closeWrestlerProfile("dashboard")}
        onBackToRoster={() => closeWrestlerProfile("roster")}
        onNavigate={navigateTo}
        onReleaseWrestler={(wrestlerId) => releaseWrestler(wrestlerId, "roster")}
        onRenewContract={(wrestlerId, contractWeeks) =>
          renewContract(wrestlerId, contractWeeks, "profile", {
            profileReturnScreen,
            profileWrestlerId: wrestlerId,
          })
        }
        onSetAlignment={setWrestlerAlignment}
        returnScreen={profileReturnScreen}
        wrestler={profileWrestler}
      />,
    );
  }

  if (screen === "roster") {
    return renderLazyScreen(<RosterScreen game={game} latestResult={latestResult} onNavigate={navigateTo} onOpenProfile={(wrestlerId) => openWrestlerProfile(wrestlerId, "roster")} />);
  }

  if (screen === "market") {
    return renderLazyScreen(
      <MarketScreen
        game={game}
        latestResult={latestResult}
        onNavigate={navigateTo}
        onProposeTrade={proposeTrade}
        onSignBundle={signFreeAgentBundle}
        onSubmitMarketOffer={submitMarketOffer}
      />,
    );
  }

  if (screen === "championships") {
    return renderLazyScreen(
      <ChampionshipsScreen
        game={game}
        latestResult={latestResult}
        onAssignChampionship={assignChampionship}
        onBookChampionship={bookChampionship}
        onNavigate={navigateTo}
        onRevokeChampionship={revokeChampionship}
        onSetContenders={setChampionshipContenders}
      />,
    );
  }

  if (screen === "rivalries") {
    return renderLazyScreen(
      <RivalriesScreen
        game={game}
        initialSelectedRivalryId={rivalriesFocusId}
        latestResult={latestResult}
        onBookRivalry={bookRivalryStory}
        onCreateRivalry={createRivalry}
        onScheduleRivalryEnd={scheduleRivalryEnd}
        onNavigate={navigateTo}
      />,
    );
  }

  if (screen === "calendar") {
    return renderLazyScreen(<CalendarScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />);
  }

  if (screen === "social") {
    return renderLazyScreen(<SocialScreen game={game} latestResult={latestResult} onNavigate={navigateTo} onSuperstarMailAction={handleSuperstarMailAction} />);
  }

  if (screen === "finance") {
    return renderLazyScreen(<FinanceScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />);
  }

  if (screen === "results" && latestResult) {
    return renderLazyScreen(
      <ResultsScreen
        game={game}
        onAdvanceWeek={advanceWeek}
        result={latestResult}
        onNavigate={navigateTo}
      />,
    );
  }

  if (screen === "weekReview" && latestResult && hasCurrentPostShow) {
    return renderLazyScreen(<ResultsScreen game={game} onAdvanceWeek={advanceWeek} onNavigate={navigateTo} result={latestResult} />);
  }

  if (screen === "seasonReview") {
    return renderLazyScreen(<SeasonReviewScreen game={game} onStartNextSeason={handleStartNextSeason} />);
  }

  if (screen === "offseasonDraft") {
    return renderLazyScreen(<OffseasonDraftScreen game={game} onCompleteDraft={completeOffseasonDraft} onBack={() => setScreen("seasonReview")} />);
  }

  return renderLazyScreen(
    <DashboardScreen
      game={game}
      latestResult={latestResult}
      onNavigate={navigateTo}
      onOpenProfile={(wrestlerId) => openWrestlerProfile(wrestlerId, "dashboard")}
      onOpenRivalry={openRivalryDesk}
    />,
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
        <Metric
          label="Roster Value"
          value={formatMoney(readout.rosterValue)}
          detail={readout.bundleDiscountUsd ? `${formatMoney(readout.bundleDiscountUsd)} bundle discount applied` : "Static catalog draft value total"}
        />
        <Metric label="Projected Reserve" value={formatProjectedReserve(readout)} detail="Carries into Week 1 money" />
        <Metric label="Healthy Reserve" value={readout.isUnlimitedBudget ? "Open" : formatMoney(readout.recommendedReserveTarget)} detail="Production and market target" />
        <Metric label="Reserve Pressure" value={readout.pressureLabel} detail={`${tvReadyDraftRosterTarget} guide, ${recommendedDraftRosterTarget} target`} />
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



export default App;
