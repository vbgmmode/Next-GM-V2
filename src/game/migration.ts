import type { Championship, GameState, LockerRoomFallout, Rivalry, Screen, ShowResult, Wrestler } from "./types";
import { createDefaultChampionships, createDefaultRivalries, createSeasonCalendar, defaultCareer } from "./seed";

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

  return {
    game: {
      seasonNumber: savedGame.seasonNumber ?? 1,
      seasonStartingMoney: savedGame.seasonStartingMoney ?? savedGame.money ?? 250000,
      currentWeek: savedGame.currentWeek ?? 1,
      gmName: savedGame.gmName ?? defaultCareer.gmName,
      gmStyle: savedGame.gmStyle ?? defaultCareer.gmStyle,
      brandName: savedGame.brandName ?? defaultCareer.brandName,
      brandStyle: savedGame.brandStyle ?? defaultCareer.brandStyle,
      createdAt: savedGame.createdAt ?? new Date().toISOString(),
      money: savedGame.money ?? 250000,
      wrestlers,
      championships:
        Array.isArray(savedGame.championships) && savedGame.championships.length
          ? (savedGame.championships as Championship[])
          : createDefaultChampionships(wrestlers),
      rivalries: Array.isArray(savedGame.rivalries) ? (savedGame.rivalries as Rivalry[]) : createDefaultRivalries(wrestlers),
      championshipHistory: Array.isArray(savedGame.championshipHistory) ? savedGame.championshipHistory : [],
      rivalryHistory: Array.isArray(savedGame.rivalryHistory) ? savedGame.rivalryHistory : [],
      calendar: Array.isArray(savedGame.calendar) && savedGame.calendar.length ? savedGame.calendar : createSeasonCalendar(),
      socialPosts: Array.isArray(savedGame.socialPosts) ? savedGame.socialPosts : [],
      financeReports: Array.isArray(savedGame.financeReports) ? savedGame.financeReports : [],
      injuryRecoveryNotes: Array.isArray(savedGame.injuryRecoveryNotes) ? savedGame.injuryRecoveryNotes : [],
      currentShow: Array.isArray(savedGame.currentShow) ? savedGame.currentShow : [],
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
