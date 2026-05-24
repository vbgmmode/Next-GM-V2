import type {
  Championship,
  GameDifficulty,
  GameState,
  GMStyle,
  LockerRoomFallout,
  CpuChampionshipState,
  CpuFinanceReport,
  CpuFreeAgentClaim,
  CpuRivalryState,
  CpuRosterAcquisitionSource,
  CpuRosterMemberState,
  CpuSeasonObjective,
  CpuSegmentResult,
  MarketContract,
  MarketState,
  MarketTransaction,
  MarketCooldown,
  OfficeMandateState,
  OfficeMandateStatus,
  WeeklyMarketBoard,
  SegmentType,
  RivalBrandState,
  RivalBrandTrend,
  RivalBrandWeeklyResult,
  RivalGMAssignment,
  Rivalry,
  Screen,
  Segment,
  SeasonArchiveSummary,
  ShowResult,
  StartingBudgetTier,
  DraftMode,
  Wrestler,
} from "./types";
import {
  createDefaultChampionships,
  createDefaultRivalries,
  createRivalBrandUniverse,
  createRivalGMAssignments,
  createSeasonCalendar,
  defaultCareer,
  getStartingBudgetAmount,
  draftPool,
  isPrototypeBrand,
  normalizeSeasonCalendar,
} from "./seed";
import { createDefaultMarketState, createMarketContract, getCpuBudgetDefault } from "./market";
import { enrichWrestlerIdentityContext } from "./wrestlerIdentityContext";
import { resolveWrestlerAlignment } from "./wrestlerAlignment";
import { getSegmentTypeDefaults } from "./matchFormatCatalog";
import { applyChampionshipCatalogDefaults } from "./titleCatalog";
import { applyRivalryCatalogDefaults } from "./rivalryCatalog";
import { getStipulationsForSegment } from "./stipulationCatalog";

export type GameScreen = Exclude<Screen, "title" | "setup">;
export type ProfileReturnScreen = Extract<GameScreen, "roster" | "booking" | "dashboard">;

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
  "market",
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

function isSeasonArchiveSummary(value: unknown): value is SeasonArchiveSummary {
  const candidate = value as Partial<SeasonArchiveSummary>;

  return (
    typeof value === "object" &&
    value !== null &&
    typeof candidate.seasonNumber === "number" &&
    typeof candidate.seasonStartingMoney === "number" &&
    typeof candidate.seasonDelta === "number" &&
    typeof candidate.finalMoney === "number" &&
    Array.isArray(candidate.championsSnapshot)
  );
}

function normalizeSeasonArchives(value: unknown): SeasonArchiveSummary[] {
  return Array.isArray(value) ? value.filter(isSeasonArchiveSummary) : [];
}

function isGameDifficulty(value: unknown): value is GameDifficulty {
  return value === "Easy" || value === "Medium" || value === "Hard" || value === "Legendary";
}

function isStartingBudgetTier(value: unknown): value is StartingBudgetTier {
  return value === "$1M" || value === "$2M" || value === "$4M" || value === "Unlimited";
}

function normalizeDraftMode(value: unknown): DraftMode {
  if (value === "open" || value === "brand") {
    return "snake";
  }

  return isDraftMode(value) ? value : defaultCareer.draftMode;
}

function isDraftMode(value: unknown): value is DraftMode {
  return value === "snake" || value === "linear" || value === "random" || value === "lottery";
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

function normalizeRivalBrandTrend(value: unknown): RivalBrandTrend {
  return value === "surging" || value === "steady" || value === "slipping" || value === "unranked" ? value : "unranked";
}

function normalizeCpuRosterState(value: unknown): CpuRosterMemberState[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<CpuRosterMemberState>;
          const acquisitionSource: CpuRosterAcquisitionSource = candidate.acquisitionSource === "free_agent" ? "free_agent" : "draft";

          if (typeof candidate?.wrestlerId !== "string") {
            return undefined;
          }

          return {
            wrestlerId: candidate.wrestlerId,
            contractId: typeof candidate.contractId === "string" ? candidate.contractId : undefined,
            acquisitionSource,
            acquiredSeasonNumber: typeof candidate.acquiredSeasonNumber === "number" ? candidate.acquiredSeasonNumber : 1,
            acquiredWeekNumber: typeof candidate.acquiredWeekNumber === "number" ? candidate.acquiredWeekNumber : 1,
            momentum: typeof candidate.momentum === "number" ? candidate.momentum : 50,
            morale: typeof candidate.morale === "number" ? candidate.morale : 60,
            fatigue: typeof candidate.fatigue === "number" ? candidate.fatigue : 20,
            appearancesThisSeason: typeof candidate.appearancesThisSeason === "number" ? candidate.appearancesThisSeason : 0,
            lastBookedWeek: typeof candidate.lastBookedWeek === "number" ? candidate.lastBookedWeek : 0,
            consecutiveWeeksBooked: typeof candidate.consecutiveWeeksBooked === "number" ? candidate.consecutiveWeeksBooked : 0,
            injuryStatus: candidate.injuryStatus === "minor" || candidate.injuryStatus === "major" ? candidate.injuryStatus : "healthy",
            injuryDescription: typeof candidate.injuryDescription === "string" ? candidate.injuryDescription : undefined,
            injuryWeeksRemaining: typeof candidate.injuryWeeksRemaining === "number" ? candidate.injuryWeeksRemaining : 0,
          };
        })
        .filter(Boolean) as CpuRosterMemberState[]
    : [];
}

function normalizeMarketContract(value: unknown): MarketContract | undefined {
  const candidate = value as Partial<MarketContract>;

  if (!candidate || typeof candidate.wrestlerId !== "string") {
    return undefined;
  }

  const acquisitionSource =
    candidate.acquisitionSource === "free_agent" ||
    candidate.acquisitionSource === "trade" ||
    candidate.acquisitionSource === "renewal" ||
    candidate.acquisitionSource === "release"
      ? candidate.acquisitionSource
      : "draft";
  const paymentModel = acquisitionSource === "draft" ? "prepaid" : candidate.paymentModel === "weekly" ? "weekly" : "prepaid";

  return {
    id: typeof candidate.id === "string" ? candidate.id : `contract-${candidate.wrestlerId}`,
    wrestlerId: candidate.wrestlerId,
    ownerType: candidate.ownerType === "rival" || candidate.ownerType === "free_agent" ? candidate.ownerType : "player",
    ownerBrandId: typeof candidate.ownerBrandId === "string" ? candidate.ownerBrandId : undefined,
    contractWeeksRemaining: typeof candidate.contractWeeksRemaining === "number" ? candidate.contractWeeksRemaining : 12,
    weeklySalary: typeof candidate.weeklySalary === "number" ? candidate.weeklySalary : 8000,
    releasePenalty: paymentModel === "prepaid" ? 0 : typeof candidate.releasePenalty === "number" ? candidate.releasePenalty : 10000,
    acquisitionSource,
    contractStatus:
      candidate.contractStatus === "expiring" || candidate.contractStatus === "expired" || candidate.contractStatus === "released"
        ? candidate.contractStatus
        : "active",
    renewalRisk: typeof candidate.renewalRisk === "number" ? candidate.renewalRisk : 20,
    paymentModel,
    upfrontCostPaid: typeof candidate.upfrontCostPaid === "number" ? candidate.upfrontCostPaid : undefined,
  };
}

function normalizeMarketContracts(value: unknown): MarketContract[] {
  return Array.isArray(value) ? (value.map(normalizeMarketContract).filter(Boolean) as MarketContract[]) : [];
}

function normalizeMarketTransaction(value: unknown): MarketTransaction | undefined {
  const candidate = value as Partial<MarketTransaction>;

  if (!candidate || typeof candidate.id !== "string") {
    return undefined;
  }

  return {
    id: candidate.id,
    seasonNumber: typeof candidate.seasonNumber === "number" ? candidate.seasonNumber : 1,
    weekNumber: typeof candidate.weekNumber === "number" ? candidate.weekNumber : 1,
    type:
      candidate.type === "release" || candidate.type === "trade" || candidate.type === "renewal" || candidate.type === "expiry"
        ? candidate.type
        : "signing",
    wrestlerIds: Array.isArray(candidate.wrestlerIds) ? candidate.wrestlerIds.filter((id): id is string => typeof id === "string") : [],
    wrestlerNames: Array.isArray(candidate.wrestlerNames) ? candidate.wrestlerNames.filter((name): name is string => typeof name === "string") : [],
    fromBrandId: typeof candidate.fromBrandId === "string" ? candidate.fromBrandId : undefined,
    fromBrandName: typeof candidate.fromBrandName === "string" ? candidate.fromBrandName : undefined,
    toBrandId: typeof candidate.toBrandId === "string" ? candidate.toBrandId : undefined,
    toBrandName: typeof candidate.toBrandName === "string" ? candidate.toBrandName : undefined,
    amount: typeof candidate.amount === "number" ? candidate.amount : 0,
    accepted: typeof candidate.accepted === "boolean" ? candidate.accepted : undefined,
    note: typeof candidate.note === "string" ? candidate.note : "Market transaction restored.",
  };
}

function normalizeMarketTransactions(value: unknown): MarketTransaction[] {
  return Array.isArray(value) ? (value.map(normalizeMarketTransaction).filter(Boolean) as MarketTransaction[]) : [];
}

function normalizeMarketCooldowns(value: unknown): MarketCooldown[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<MarketCooldown>;
          return typeof candidate?.wrestlerId === "string"
            ? {
                wrestlerId: candidate.wrestlerId,
                availableWeek: typeof candidate.availableWeek === "number" ? candidate.availableWeek : 1,
                releasedByBrandId: typeof candidate.releasedByBrandId === "string" ? candidate.releasedByBrandId : undefined,
              }
            : undefined;
        })
        .filter(Boolean) as MarketCooldown[]
    : [];
}

function normalizeOfficeMandateStatus(value: unknown): OfficeMandateStatus {
  return value === "watch" || value === "critical" || value === "surging" ? value : "stable";
}

function normalizeOfficeMandate(value: unknown): OfficeMandateState {
  const candidate = value as Partial<OfficeMandateState>;

  return {
    ownerTrust: typeof candidate?.ownerTrust === "number" ? candidate.ownerTrust : 60,
    brandReputation: typeof candidate?.brandReputation === "number" ? candidate.brandReputation : 60,
    mandateStatus: normalizeOfficeMandateStatus(candidate?.mandateStatus),
    mandateHistory: Array.isArray(candidate?.mandateHistory)
      ? candidate.mandateHistory
          .map((item) => {
            const event = item as Partial<OfficeMandateState["mandateHistory"][number]>;
            return typeof event?.id === "string"
              ? {
                  id: event.id,
                  seasonNumber: typeof event.seasonNumber === "number" ? event.seasonNumber : 1,
                  weekNumber: typeof event.weekNumber === "number" ? event.weekNumber : 1,
                  status: normalizeOfficeMandateStatus(event.status),
                  ownerTrustDelta: typeof event.ownerTrustDelta === "number" ? event.ownerTrustDelta : 0,
                  brandReputationDelta: typeof event.brandReputationDelta === "number" ? event.brandReputationDelta : 0,
                  moneyDelta: typeof event.moneyDelta === "number" ? event.moneyDelta : 0,
                  note: typeof event.note === "string" ? event.note : "Office mandate restored.",
                }
              : undefined;
          })
          .filter(Boolean) as OfficeMandateState["mandateHistory"]
      : [],
  };
}

function normalizeWeeklyMarketBoard(value: unknown): WeeklyMarketBoard | undefined {
  const candidate = value as Partial<WeeklyMarketBoard>;

  if (!candidate || typeof candidate.seasonNumber !== "number" || typeof candidate.weekNumber !== "number" || !Array.isArray(candidate.entries)) {
    return undefined;
  }

  return {
    seasonNumber: candidate.seasonNumber,
    weekNumber: candidate.weekNumber,
    entries: candidate.entries
      .map((entry) => {
        const boardEntry = entry as Partial<WeeklyMarketBoard["entries"][number]>;
        const status =
          boardEntry.status === "rival_signed" || boardEntry.status === "player_signed" || boardEntry.status === "available"
            ? boardEntry.status
            : undefined;

        return typeof boardEntry.wrestlerId === "string" && status
          ? {
              wrestlerId: boardEntry.wrestlerId,
              status,
              weeklyAsk: typeof boardEntry.weeklyAsk === "number" ? boardEntry.weeklyAsk : 0,
              rivalBrandId: typeof boardEntry.rivalBrandId === "string" ? boardEntry.rivalBrandId : undefined,
              rivalBrandName: typeof boardEntry.rivalBrandName === "string" ? boardEntry.rivalBrandName : undefined,
              transactionId: typeof boardEntry.transactionId === "string" ? boardEntry.transactionId : undefined,
            }
          : undefined;
      })
      .filter(Boolean) as WeeklyMarketBoard["entries"],
  };
}

function normalizeMarketState(value: unknown, wrestlers: Wrestler[]): MarketState {
  const candidate = value as Partial<MarketState>;
  const defaultState = createDefaultMarketState(wrestlers);
  const playerContracts = normalizeMarketContracts(candidate?.playerContracts);

  return {
    playerContracts: playerContracts.length ? playerContracts : defaultState.playerContracts,
    transactions: normalizeMarketTransactions(candidate?.transactions),
    cooldowns: normalizeMarketCooldowns(candidate?.cooldowns),
    officeMandate: normalizeOfficeMandate(candidate?.officeMandate),
    weeklyBoard: normalizeWeeklyMarketBoard(candidate?.weeklyBoard),
  };
}

function normalizeCpuChampionships(value: unknown): CpuChampionshipState[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<CpuChampionshipState>;
          return typeof candidate?.id === "string" && typeof candidate.name === "string"
            ? {
                id: candidate.id,
                name: candidate.name,
                division: typeof candidate.division === "string" ? candidate.division : "Mens",
                championIds: Array.isArray(candidate.championIds) ? candidate.championIds.filter((id): id is string => typeof id === "string") : [],
                prestige: typeof candidate.prestige === "number" ? candidate.prestige : 75,
                defenses: typeof candidate.defenses === "number" ? candidate.defenses : 0,
                reignStartWeek: typeof candidate.reignStartWeek === "number" ? candidate.reignStartWeek : 1,
              }
            : undefined;
        })
        .filter(Boolean) as CpuChampionshipState[]
    : [];
}

function normalizeCpuRivalries(value: unknown): CpuRivalryState[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<CpuRivalryState>;
          return typeof candidate?.id === "string" && typeof candidate.name === "string"
            ? {
                id: candidate.id,
                name: candidate.name,
                participantIds: Array.isArray(candidate.participantIds) ? candidate.participantIds.filter((id): id is string => typeof id === "string") : [],
                heat: typeof candidate.heat === "number" ? candidate.heat : 50,
                freshness: typeof candidate.freshness === "number" ? candidate.freshness : 60,
                weeksActive: typeof candidate.weeksActive === "number" ? candidate.weeksActive : 1,
                lastAdvancedWeek: typeof candidate.lastAdvancedWeek === "number" ? candidate.lastAdvancedWeek : 0,
                status: candidate.status === "rising" || candidate.status === "steady" || candidate.status === "cooling" || candidate.status === "stale" ? candidate.status : "steady",
                stakes:
                  candidate.stakes === "title" || candidate.stakes === "revenge" || candidate.stakes === "respect" || candidate.stakes === "personal"
                    ? candidate.stakes
                    : "respect",
              }
            : undefined;
        })
        .filter(Boolean) as CpuRivalryState[]
    : [];
}

function normalizeCpuFinanceReports(value: unknown): CpuFinanceReport[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<CpuFinanceReport>;
          return typeof candidate?.id === "string" && typeof candidate.seasonNumber === "number" && typeof candidate.weekNumber === "number"
            ? {
                id: candidate.id,
                seasonNumber: candidate.seasonNumber,
                weekNumber: candidate.weekNumber,
                showName: typeof candidate.showName === "string" ? candidate.showName : "CPU Show",
                revenue: typeof candidate.revenue === "number" ? candidate.revenue : 0,
                expenses: typeof candidate.expenses === "number" ? candidate.expenses : 0,
                profitLoss: typeof candidate.profitLoss === "number" ? candidate.profitLoss : 0,
                endingMoney: typeof candidate.endingMoney === "number" ? candidate.endingMoney : 0,
                note: typeof candidate.note === "string" ? candidate.note : "CPU finance report restored.",
              }
            : undefined;
        })
        .filter(Boolean) as CpuFinanceReport[]
    : [];
}

function normalizeCpuFreeAgentClaims(value: unknown): CpuFreeAgentClaim[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<CpuFreeAgentClaim>;
          return typeof candidate?.id === "string" && typeof candidate.wrestlerId === "string"
            ? {
                id: candidate.id,
                seasonNumber: typeof candidate.seasonNumber === "number" ? candidate.seasonNumber : 1,
                weekNumber: typeof candidate.weekNumber === "number" ? candidate.weekNumber : 1,
                wrestlerId: candidate.wrestlerId,
                wrestlerName: typeof candidate.wrestlerName === "string" ? candidate.wrestlerName : "Unknown",
                brandName: typeof candidate.brandName === "string" ? candidate.brandName : "CPU Brand",
                note: typeof candidate.note === "string" ? candidate.note : "CPU free-agent claim restored.",
              }
            : undefined;
        })
        .filter(Boolean) as CpuFreeAgentClaim[]
    : [];
}

function normalizeCpuObjectives(value: unknown): CpuSeasonObjective[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<CpuSeasonObjective>;
          return typeof candidate?.id === "string" && typeof candidate.label === "string"
            ? {
                id: candidate.id,
                label: candidate.label,
                target: typeof candidate.target === "number" ? candidate.target : 0,
                current: typeof candidate.current === "number" ? candidate.current : 0,
                status:
                  candidate.status === "on_track" || candidate.status === "at_risk" || candidate.status === "missed" || candidate.status === "complete"
                    ? candidate.status
                    : "at_risk",
                note: typeof candidate.note === "string" ? candidate.note : "CPU objective restored.",
              }
            : undefined;
        })
        .filter(Boolean) as CpuSeasonObjective[]
    : [];
}

function normalizeCpuSegments(value: unknown): CpuSegmentResult[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const candidate = item as Partial<CpuSegmentResult>;
          const type = candidate.type as SegmentType | undefined;

          return typeof candidate?.id === "string" &&
            (type === "Match" || type === "Promo" || type === "Backstage Angle" || type === "Contract Signing" || type === "Open Challenge")
            ? {
                id: candidate.id,
                type,
                participantIds: Array.isArray(candidate.participantIds) ? candidate.participantIds.filter((id): id is string => typeof id === "string") : [],
                participantNames: Array.isArray(candidate.participantNames) ? candidate.participantNames.filter((name): name is string => typeof name === "string") : [],
                score: typeof candidate.score === "number" ? candidate.score : 0,
                winnerId: typeof candidate.winnerId === "string" ? candidate.winnerId : undefined,
                titleId: typeof candidate.titleId === "string" ? candidate.titleId : undefined,
                rivalryId: typeof candidate.rivalryId === "string" ? candidate.rivalryId : undefined,
                note: typeof candidate.note === "string" ? candidate.note : "CPU segment restored.",
              }
            : undefined;
        })
        .filter(Boolean) as CpuSegmentResult[]
    : [];
}

function normalizeRivalBrandWeeklyResults(value: unknown): RivalBrandWeeklyResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const candidate = item as Partial<RivalBrandWeeklyResult>;
      const seasonNumber = typeof candidate.seasonNumber === "number" ? candidate.seasonNumber : undefined;
      const weekNumber = typeof candidate.weekNumber === "number" ? candidate.weekNumber : undefined;
      const score = typeof candidate.score === "number" ? candidate.score : undefined;

      if (seasonNumber === undefined || weekNumber === undefined || score === undefined) {
        return undefined;
      }

      return {
        id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `migrated-cpu-result-${seasonNumber}-${weekNumber}-${index}`,
        seasonNumber,
        weekNumber,
        showName: typeof candidate.showName === "string" && candidate.showName.trim() ? candidate.showName : `Week ${weekNumber} Rival TV`,
        showType: candidate.showType === "ple" || candidate.showType === "tv" ? candidate.showType : "tv",
        score,
        grade: typeof candidate.grade === "string" && candidate.grade.trim() ? candidate.grade : "C",
        rank: typeof candidate.rank === "number" ? candidate.rank : 0,
        playerScoreDelta: typeof candidate.playerScoreDelta === "number" ? candidate.playerScoreDelta : 0,
        mainEvent: typeof candidate.mainEvent === "string" && candidate.mainEvent.trim() ? candidate.mainEvent : "CPU main event summary unavailable",
        keyAngle: typeof candidate.keyAngle === "string" && candidate.keyAngle.trim() ? candidate.keyAngle : "CPU key angle summary unavailable",
        rosterFocusWrestlerIds: Array.isArray(candidate.rosterFocusWrestlerIds)
          ? candidate.rosterFocusWrestlerIds.filter((id): id is string => typeof id === "string")
          : [],
        segments: normalizeCpuSegments(candidate.segments),
        titleNotes: Array.isArray(candidate.titleNotes) ? candidate.titleNotes.filter((note): note is string => typeof note === "string") : [],
        rivalryNotes: Array.isArray(candidate.rivalryNotes) ? candidate.rivalryNotes.filter((note): note is string => typeof note === "string") : [],
        injuryNotes: Array.isArray(candidate.injuryNotes) ? candidate.injuryNotes.filter((note): note is string => typeof note === "string") : [],
        financeReport: normalizeCpuFinanceReports(candidate.financeReport ? [candidate.financeReport] : [])[0],
        freeAgentClaims: normalizeCpuFreeAgentClaims(candidate.freeAgentClaims),
        objectiveNotes: Array.isArray(candidate.objectiveNotes) ? candidate.objectiveNotes.filter((note): note is string => typeof note === "string") : [],
        note: typeof candidate.note === "string" && candidate.note.trim() ? candidate.note : "CPU ratings-battle note unavailable.",
        trend: normalizeRivalBrandTrend(candidate.trend),
      };
    })
    .filter(Boolean) as RivalBrandWeeklyResult[];
}

function normalizeRivalBrands(value: unknown, fallbackAssignments: RivalGMAssignment[]): RivalBrandState[] {
  if (!Array.isArray(value) || !value.length) {
    return createRivalBrandUniverse(fallbackAssignments);
  }

  const seenBrands = new Set<string>();
  const rivalBrands: RivalBrandState[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const candidate = item as Partial<RivalBrandState>;

    if (!isPrototypeBrand(candidate.brandKey) || typeof candidate.assignedGMName !== "string" || typeof candidate.assignedGMStyle !== "string") {
      return;
    }

    if (seenBrands.has(candidate.brandKey)) {
      return;
    }

    seenBrands.add(candidate.brandKey);
    rivalBrands.push({
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `rival-brand-${candidate.brandKey.toLowerCase()}`,
      brandKey: candidate.brandKey,
      brandName: typeof candidate.brandName === "string" && candidate.brandName.trim() ? candidate.brandName : candidate.brandKey,
      assignedGMId: typeof candidate.assignedGMId === "string" && candidate.assignedGMId.trim() ? candidate.assignedGMId : undefined,
      assignedGMName: candidate.assignedGMName,
      assignedGMStyle: candidate.assignedGMStyle as GMStyle,
      roleLabel: typeof candidate.roleLabel === "string" && candidate.roleLabel.trim() ? candidate.roleLabel : "Rival Brand",
      statusLabel: typeof candidate.statusLabel === "string" && candidate.statusLabel.trim() ? candidate.statusLabel : "Assigned / Watching",
      rosterWrestlerIds: Array.isArray(candidate.rosterWrestlerIds) ? candidate.rosterWrestlerIds.filter((id): id is string => typeof id === "string") : [],
      rosterState: normalizeCpuRosterState(candidate.rosterState),
      championships: normalizeCpuChampionships(candidate.championships),
      rivalries: normalizeCpuRivalries(candidate.rivalries),
      financeReports: normalizeCpuFinanceReports(candidate.financeReports),
      freeAgentClaims: normalizeCpuFreeAgentClaims(candidate.freeAgentClaims),
      contracts: normalizeMarketContracts(candidate.contracts),
      marketTransactions: normalizeMarketTransactions(candidate.marketTransactions),
      budget: typeof candidate.budget === "number" ? candidate.budget : getCpuBudgetDefault(),
      seasonObjectives: normalizeCpuObjectives(candidate.seasonObjectives),
      activityHistory: Array.isArray(candidate.activityHistory) ? candidate.activityHistory : [],
      weeklyResults: normalizeRivalBrandWeeklyResults(candidate.weeklyResults),
      seasonAverageScore: typeof candidate.seasonAverageScore === "number" ? candidate.seasonAverageScore : 0,
      seasonRank: typeof candidate.seasonRank === "number" ? candidate.seasonRank : 0,
      seasonTrend: normalizeRivalBrandTrend(candidate.seasonTrend),
    });
  });

  return rivalBrands.length ? rivalBrands : createRivalBrandUniverse(fallbackAssignments);
}

function isProfileReturnScreen(value: unknown): value is ProfileReturnScreen {
  return value === "roster" || value === "booking" || value === "dashboard";
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
  return (Array.isArray(wrestlers) ? (wrestlers as Partial<Wrestler>[]) : []).map((wrestler) => {
    const wrestlerId = typeof wrestler.id === "string" ? wrestler.id : "unknown-wrestler";

    return {
      ...wrestler,
      ...enrichWrestlerIdentityContext(wrestler as Wrestler),
      alignment: resolveWrestlerAlignment(wrestler.alignment, wrestlerId),
      appearancesThisSeason: wrestler.appearancesThisSeason ?? 0,
      lastBookedWeek: wrestler.lastBookedWeek ?? 0,
      consecutiveWeeksBooked: wrestler.consecutiveWeeksBooked ?? 0,
      injuryStatus: wrestler.injuryStatus ?? "healthy",
      injuryDescription: wrestler.injuryDescription,
      injuryWeeksRemaining: wrestler.injuryWeeksRemaining ?? 0,
      injuryOccurredWeek: wrestler.injuryOccurredWeek,
    };
  }) as Wrestler[];
}

function normalizeShowHistory(showHistory: unknown): ShowResult[] {
  return (Array.isArray(showHistory) ? (showHistory as Partial<ShowResult>[]) : []).map((result) => {
    const fallout = result.lockerRoomFallout as Partial<LockerRoomFallout> | undefined;

    return {
      ...result,
      segmentResults: Array.isArray(result.segmentResults)
        ? result.segmentResults.map((segment) => {
            const segmentRecord = typeof segment === "object" && segment !== null ? (segment as Record<string, unknown>) : {};

            return {
              ...segmentRecord,
              stipulationId: typeof segmentRecord.stipulationId === "string" ? segmentRecord.stipulationId : undefined,
            };
          })
        : [],
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
  const wrestlerIds = new Set(wrestlers.map((wrestler) => wrestler.id));
  const normalized = Array.isArray(championships) && championships.length
    ? (championships as Championship[]).map((championship) => ({
        ...applyChampionshipCatalogDefaults(championship, brandStyle),
        contenderIds: Array.isArray(championship.contenderIds)
          ? championship.contenderIds.filter((id) => wrestlerIds.has(id) && !championship.championIds.includes(id))
          : undefined,
      }))
    : createDefaultChampionships(wrestlers, brandStyle);

  if (normalized.some((championship) => championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team")) {
    return normalized;
  }

  const tagTitle = createDefaultChampionships(wrestlers, brandStyle).find((championship) => championship.eligibleMatchScope === "tag_team");
  return tagTitle ? [...normalized, tagTitle] : normalized;
}

function normalizeRivalries(rivalries: unknown, wrestlers: Wrestler[]) {
  return Array.isArray(rivalries) ? (rivalries as Rivalry[]).map(applyRivalryCatalogDefaults) : createDefaultRivalries(wrestlers);
}

function normalizeCurrentShow(currentShow: unknown): Segment[] {
  return (Array.isArray(currentShow) ? (currentShow as Partial<Segment>[]) : []).map((segment, index) => {
    const type = segment.type ?? "Match";
    const defaults = getSegmentTypeDefaults(type);
    const candidateFormatId = segment.segmentCatalogId ?? defaults.segmentCatalogId;
    const normalizedStipulationId =
      typeof segment.stipulationId === "string" &&
      getStipulationsForSegment({ type, segmentCatalogId: candidateFormatId }).some((stipulation) => stipulation.id === segment.stipulationId)
        ? segment.stipulationId
        : undefined;

    return {
      id: segment.id ?? `migrated-segment-${index}`,
      type,
      participantIds: Array.isArray(segment.participantIds) ? segment.participantIds : [],
      championshipId: segment.championshipId,
      rivalryId: segment.rivalryId,
      stipulationId: normalizedStipulationId,
      winnerId: typeof segment.winnerId === "string" && segment.participantIds?.includes(segment.winnerId) ? segment.winnerId : undefined,
      segmentCatalogId: candidateFormatId,
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
  const rivalGMAssignments = normalizeRivalGMAssignments(savedGame.rivalGMAssignments);
  const safeRivalGMAssignments = rivalGMAssignments.length ? rivalGMAssignments : createRivalGMAssignments(brandStyle);
  const startingBudgetTier = isStartingBudgetTier(savedGame.startingBudgetTier) ? savedGame.startingBudgetTier : defaultCareer.startingBudgetTier;
  const draftMode = normalizeDraftMode(savedGame.draftMode);
  const fallbackMoney = getStartingBudgetAmount(startingBudgetTier);
  const seasonStartingMoney = savedGame.seasonStartingMoney ?? savedGame.money ?? fallbackMoney;

  const rivalBrands = normalizeRivalBrands(savedGame.rivalBrands, safeRivalGMAssignments).map((brand) => {
    const contracts = brand.contracts.length
      ? brand.contracts
      : brand.rosterWrestlerIds
          .map((id) => {
            const wrestler = draftPool.find((item) => item.id === id);
            return wrestler ? createMarketContract(wrestler, "rival", brand.id, "draft") : undefined;
          })
          .filter(Boolean) as MarketContract[];

    return {
      ...brand,
      contracts,
      rosterState: brand.rosterState.map((member) => ({
        ...member,
        contractId: member.contractId ?? contracts.find((contract) => contract.wrestlerId === member.wrestlerId)?.id,
      })),
    };
  });

  return {
    game: {
      seasonNumber: savedGame.seasonNumber ?? 1,
      seasonStartingMoney,
      currentWeek: savedGame.currentWeek ?? 1,
      gmName: savedGame.gmName ?? defaultCareer.gmName,
      gmStyle: savedGame.gmStyle ?? defaultCareer.gmStyle,
      brandName: savedGame.brandName ?? defaultCareer.brandName,
      brandStyle,
      difficulty: isGameDifficulty(savedGame.difficulty) ? savedGame.difficulty : defaultCareer.difficulty,
      startingBudgetTier,
      draftMode,
      rivalGMAssignments: safeRivalGMAssignments,
      rivalBrands,
      createdAt: savedGame.createdAt ?? new Date().toISOString(),
      money: savedGame.money ?? seasonStartingMoney,
      wrestlers,
      championships: normalizeChampionships(savedGame.championships, wrestlers, brandStyle),
      rivalries: normalizeRivalries(savedGame.rivalries, wrestlers),
      championshipHistory: Array.isArray(savedGame.championshipHistory) ? savedGame.championshipHistory : [],
      rivalryHistory: Array.isArray(savedGame.rivalryHistory) ? savedGame.rivalryHistory : [],
      calendar: normalizeSeasonCalendar(
        Array.isArray(savedGame.calendar) && savedGame.calendar.length ? savedGame.calendar : createSeasonCalendar(),
      ),
      socialPosts: Array.isArray(savedGame.socialPosts) ? savedGame.socialPosts : [],
      financeReports: Array.isArray(savedGame.financeReports) ? savedGame.financeReports : [],
      marketState: normalizeMarketState(savedGame.marketState, wrestlers),
      seasonArchives: normalizeSeasonArchives((savedGame as { seasonArchives?: unknown }).seasonArchives),
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
