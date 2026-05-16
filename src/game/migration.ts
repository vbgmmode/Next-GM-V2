import type { Championship, GameDifficulty, GameState, GMStyle, LockerRoomFallout, RivalGMAssignment, Rivalry, Screen, Segment, SegmentType, ShowResult, StartingBudgetTier, Wrestler } from "./types";
import { createDefaultChampionships, createDefaultRivalries, createSeasonCalendar, defaultCareer, isPrototypeBrand } from "./seed";
import { applyChampionshipCatalogDefaults } from "./titleCatalog";

export type GameScreen = Exclude<Screen, "title" | "setup">;
export type ProfileReturnScreen = Extract<GameScreen, "roster" | "booking">;

export type SavedGameState = {
  game: GameState;
  screen: GameScreen;
  profileReturnScreen?: ProfileReturnScreen;
  profileWrestlerId?: string;
};

const savedGameScreens: GameScreen[] = [
  "dashboard",
  "booking",
  "roster",
  "profile",
  "championships",
  "rivalries",
  "calendar",
  "social",
  "finance",
  "results",
  "weekReview",
  "seasonReview",
];

type SavedGameCandidate = {
  game: Partial<GameState>;
  screen?: unknown;
  profileReturnScreen?: unknown;
  profileWrestlerId?: unknown;
};

function isGameScreen(value: unknown): value is GameScreen {
  return typeof value === "string" && savedGameScreens.includes(value as GameScreen);
}

function isGameDifficulty(value: unknown): value is GameDifficulty {
  return value === "Easy" || value === "Medium" || value === "Hard" || value === "Legendary";
}

function isStartingBudgetTier(value: unknown): value is StartingBudgetTier {
  return value === "$1M" || value === "$2M" || value === "$4M" || value === "Unlimited";
}

function normalizeRivalGMAssignments(value: unknown): RivalGMAssignment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenBrands = new Set<string>();
  const seenGMs = new Set<string>();
  const assignments: RivalGMAssignment[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const candidate = item as Partial<RivalGMAssignment>;

    if (!isPrototypeBrand(candidate.brand) || typeof candidate.gmName !== "string" || typeof candidate.gmStyle !== "string") {
      return;
    }

    if (seenBrands.has(candidate.brand) || seenGMs.has(candidate.gmName)) {
      return;
    }

    seenBrands.add(candidate.brand);
    seenGMs.add(candidate.gmName);
    assignments.push({
      brand: candidate.brand,
      gmName: candidate.gmName,
      gmStyle: candidate.gmStyle as GMStyle,
    });
  });

  return assignments;
}

function isProfileReturnScreen(value: unknown): value is ProfileReturnScreen {
  return value === "roster" || value === "booking";
}

function isSavedGameCandidate(value: unknown): value is SavedGameCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const saved = value as Partial<SavedGameCandidate>;
  const game = saved.game;

  return Boolean(game && typeof game === "object" && Array.isArray(game.wrestlers));
}

function normalizeWrestlers(wrestlers: unknown): Wrestler[] {
  return (Array.isArray(wrestlers) ? (wrestlers as Partial<Wrestler>[]) : []).map((wrestler) => ({
    ...wrestler,
    appearancesThisSeason: wrestler.appearancesThisSeason ?? 0,
    lastBookedWeek: wrestler.lastBookedWeek ?? 0,
    consecutiveWeeksBooked: wrestler.consecutiveWeeksBooked ?? 0,
    injuryStatus: wrestler.injuryStatus ?? "healthy",
    injuryDescription: wrestler.injuryDescription,
    injuryWeeksRemaining: wrestler.injuryWeeksRemaining ?? 0,
    injuryOccurredWeek: wrestler.injuryOccurredWeek,
  })) as Wrestler[];
}

function normalizeShowHistory(showHistory: unknown): ShowResult[] {
  return (Array.isArray(showHistory) ? (showHistory as Partial<ShowResult>[]) : []).map((result) => {
    const fallout = result.lockerRoomFallout as Partial<LockerRoomFallout> | undefined;

    return {
      ...result,
      segmentResults: Array.isArray(result.segmentResults) ? result.segmentResults : [],
      titleNotes: Array.isArray(result.titleNotes) ? result.titleNotes : [],
      rivalryNotes: Array.isArray(result.rivalryNotes) ? result.rivalryNotes : [],
      titleHistoryEvents: Array.isArray(result.titleHistoryEvents) ? result.titleHistoryEvents : [],
      rivalryHistoryEvents: Array.isArray(result.rivalryHistoryEvents) ? result.rivalryHistoryEvents : [],
      lockerRoomFallout: fallout
        ? {
            moraleDrops: Array.isArray(fallout.moraleDrops) ? fallout.moraleDrops : [],
            moraleBoosts: Array.isArray(fallout.moraleBoosts) ? fallout.moraleBoosts : [],
            overuseWarnings: Array.isArray(fallout.overuseWarnings) ? fallout.overuseWarnings : [],
            underuseWarnings: Array.isArray(fallout.underuseWarnings) ? fallout.underuseWarnings : [],
            injuryNotes: Array.isArray(fallout.injuryNotes) ? fallout.injuryNotes : [],
          }
        : undefined,
    } as ShowResult;
  });
}

function normalizeChampionships(championships: unknown, wrestlers: Wrestler[], brandStyle: GameState["brandStyle"]) {
  return Array.isArray(championships) && championships.length
    ? (championships as Championship[]).map((championship) => applyChampionshipCatalogDefaults(championship, brandStyle))
    : createDefaultChampionships(wrestlers, brandStyle);
}

function getDefaultSegmentDefaults(type: SegmentType) {
  if (type === "Open Challenge") {
    return { segmentCatalogId: "P007", segmentDisplayName: "Open Challenge", durationMinutes: 7, participantMin: 1, participantMax: 1 };
  }

  if (type === "Contract Signing") {
    return { segmentCatalogId: "P008", segmentDisplayName: "Contract Signing", durationMinutes: 9, participantMin: 2, participantMax: 2 };
  }

  if (type === "Promo") {
    return { segmentCatalogId: "P001", segmentDisplayName: "Standard Promo", durationMinutes: 5, participantMin: 1, participantMax: 3 };
  }

  if (type === "Backstage Angle") {
    return { segmentCatalogId: "A001", segmentDisplayName: "Backstage Interview", durationMinutes: 4, participantMin: 1, participantMax: 3 };
  }

  return { segmentCatalogId: "M001", segmentDisplayName: "Singles Match", durationMinutes: 12, participantMin: 2, participantMax: 2 };
}

function normalizeCurrentShow(currentShow: unknown): Segment[] {
  return (Array.isArray(currentShow) ? (currentShow as Partial<Segment>[]) : []).map((segment, index) => {
    const type = segment.type ?? "Match";
    const defaults = getDefaultSegmentDefaults(type);

    return {
      id: segment.id ?? `migrated-segment-${index}`,
      type,
      participantIds: Array.isArray(segment.participantIds) ? segment.participantIds : [],
      championshipId: segment.championshipId,
      rivalryId: segment.rivalryId,
      segmentCatalogId: segment.segmentCatalogId ?? defaults.segmentCatalogId,
      segmentDisplayName: segment.segmentDisplayName ?? defaults.segmentDisplayName,
      durationMinutes: segment.durationMinutes ?? defaults.durationMinutes,
      participantMin: segment.participantMin ?? defaults.participantMin,
      participantMax: segment.participantMax ?? defaults.participantMax,
    };
  });
}

export function migrateSavedGameState(value: unknown): SavedGameState | null {
  if (!isSavedGameCandidate(value)) {
    return null;
  }

  const savedGame = value.game;
  const wrestlers = normalizeWrestlers(savedGame.wrestlers);
  const showHistory = normalizeShowHistory(savedGame.showHistory);
  const requestedScreen = isGameScreen(value.screen) ? value.screen : "dashboard";
  const shouldRestoreProfile =
    requestedScreen === "profile" &&
    typeof value.profileWrestlerId === "string" &&
    wrestlers.some((wrestler) => wrestler.id === value.profileWrestlerId);
  const profileWrestlerId = shouldRestoreProfile && typeof value.profileWrestlerId === "string" ? value.profileWrestlerId : undefined;
  const latestResult = showHistory[showHistory.length - 1];
  const hasReviewableResult = Boolean(latestResult?.segmentResults.length);
  let screen = requestedScreen === "profile" && !shouldRestoreProfile ? "roster" : requestedScreen;

  if ((screen === "results" || screen === "weekReview") && !hasReviewableResult) {
    screen = "dashboard";
  }

  const brandStyle = typeof savedGame.brandStyle === "string" ? (savedGame.brandStyle as GameState["brandStyle"]) : defaultCareer.brandStyle;

  return {
    game: {
      seasonNumber: savedGame.seasonNumber ?? 1,
      seasonStartingMoney: savedGame.seasonStartingMoney ?? savedGame.money ?? 250000,
      currentWeek: savedGame.currentWeek ?? 1,
      gmName: savedGame.gmName ?? defaultCareer.gmName,
      gmStyle: savedGame.gmStyle ?? defaultCareer.gmStyle,
      brandName: savedGame.brandName ?? defaultCareer.brandName,
      brandStyle,
      difficulty: isGameDifficulty(savedGame.difficulty) ? savedGame.difficulty : defaultCareer.difficulty,
      startingBudgetTier: isStartingBudgetTier(savedGame.startingBudgetTier) ? savedGame.startingBudgetTier : defaultCareer.startingBudgetTier,
      rivalGMAssignments: normalizeRivalGMAssignments(savedGame.rivalGMAssignments),
      createdAt: savedGame.createdAt ?? new Date().toISOString(),
      money: savedGame.money ?? 250000,
      wrestlers,
      championships: normalizeChampionships(savedGame.championships, wrestlers, brandStyle),
      rivalries: Array.isArray(savedGame.rivalries) ? (savedGame.rivalries as Rivalry[]) : createDefaultRivalries(wrestlers),
      championshipHistory: Array.isArray(savedGame.championshipHistory) ? savedGame.championshipHistory : [],
      rivalryHistory: Array.isArray(savedGame.rivalryHistory) ? savedGame.rivalryHistory : [],
      calendar: Array.isArray(savedGame.calendar) && savedGame.calendar.length ? savedGame.calendar : createSeasonCalendar(),
      socialPosts: Array.isArray(savedGame.socialPosts) ? savedGame.socialPosts : [],
      financeReports: Array.isArray(savedGame.financeReports) ? savedGame.financeReports : [],
      injuryRecoveryNotes: Array.isArray(savedGame.injuryRecoveryNotes) ? savedGame.injuryRecoveryNotes : [],
      currentShow: normalizeCurrentShow(savedGame.currentShow),
      showHistory,
    },
    screen,
    profileReturnScreen: shouldRestoreProfile
      ? isProfileReturnScreen(value.profileReturnScreen)
        ? value.profileReturnScreen
        : "roster"
      : undefined,
    profileWrestlerId,
  };
}
