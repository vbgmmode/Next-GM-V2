import type {
  BrandStyle,
  CalendarWeek,
  Championship,
  DraftMode,
  GameDifficulty,
  GameState,
  GMStyle,
  PrototypeBrand,
  RivalBrandState,
  RivalGMAssignment,
  StartingBudgetTier,
  Wrestler,
} from "./types";
import { getTitleCatalogEntriesForBrand } from "./titleCatalog";
import { top200DraftPool } from "./top200DraftPool";
import { enrichWrestlerIdentityContext } from "./wrestlerIdentityContext";
import { resolveWrestlerAlignment } from "./wrestlerAlignment";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import { allocateCpuDraftRosters } from "./cpuRivalLoop";
import { createDefaultMarketState, ensureWeeklyMarketBoard, getCpuBudgetDefault } from "./market";
import { createDefaultSocialInboxState } from "./socialInboxActions";
import { PLE_CYCLE_WEEKS, SEASON_WEEK_COUNT, SENTIMENT_NEUTRAL, STANDARD_BUDGET_AMOUNT, UNLIMITED_BUDGET_AMOUNT } from "./constants";
import { createCpuBrandIdentity, createPlayerBrandIdentity } from "./brandIdentity";
import { ensureMatchRatings } from "./matchRatings";

type SeedWrestler = Omit<Wrestler, "injuryStatus" | "injuryDescription" | "injuryWeeksRemaining" | "injuryOccurredWeek"> &
  Partial<Pick<Wrestler, "injuryStatus" | "injuryDescription" | "injuryWeeksRemaining" | "injuryOccurredWeek">>;

export type NewCareerOptions = {
  gmName?: string;
  gmStyle?: GMStyle;
  brandName?: string;
  brandStyle?: BrandStyle;
  difficulty?: GameDifficulty;
  startingBudgetTier?: StartingBudgetTier;
  draftMode?: DraftMode;
  rivalGMAssignments?: RivalGMAssignment[];
  draftedWrestlers?: Wrestler[];
  draftPickGroups?: string[][];
  draftBundleDiscountUsd?: number;
};

export const prototypeBrands: PrototypeBrand[] = ["Raw", "SmackDown", "NXT", "AEW"];

export const rivalGMCandidates: { gmName: string; gmStyle: GMStyle }[] = [
  { gmName: "Cassandra Vale", gmStyle: "Ruthless Executive" },
  { gmName: "Marcus King", gmStyle: "Ratings Chaser" },
  { gmName: "Elena Cross", gmStyle: "Talent Developer" },
  { gmName: "Teddy Knox", gmStyle: "Locker Room General" },
  { gmName: "Vivienne Riot", gmStyle: "Chaos Booker" },
  { gmName: "Jonah Steel", gmStyle: "Sports Realist" },
  { gmName: "Sloane Mercer", gmStyle: "Brand Architect" },
  { gmName: "Rafael Saint", gmStyle: "Big Money Promoter" },
];

export function isPrototypeBrand(value: unknown): value is PrototypeBrand {
  return typeof value === "string" && prototypeBrands.includes(value as PrototypeBrand);
}

export function createRivalGMAssignments(playerBrand: BrandStyle): RivalGMAssignment[] {
  if (!isPrototypeBrand(playerBrand)) {
    return [];
  }

  const playerBrandIndex = prototypeBrands.indexOf(playerBrand);
  const candidateOffset = playerBrandIndex * 2;
  const rivalCandidates = rivalGMCandidates.slice(candidateOffset).concat(rivalGMCandidates.slice(0, candidateOffset));

  return prototypeBrands
    .filter((brand) => brand !== playerBrand)
    .map((brand, index) => ({
      brand,
      ...rivalCandidates[index],
    }));
}

function createStableId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createRivalBrandUniverse(rivalGMAssignments: RivalGMAssignment[] = []): RivalBrandState[] {
  return rivalGMAssignments.map((assignment) => {
    const id = `rival-brand-${createStableId(assignment.brand)}`;

    return {
      id,
      brandIdentity: createCpuBrandIdentity(id, assignment.brand, assignment.brand),
      brandKey: assignment.brand,
      brandName: assignment.brand,
      assignedGMId: `rival-gm-${createStableId(assignment.gmName)}`,
      assignedGMName: assignment.gmName,
      assignedGMStyle: assignment.gmStyle,
      roleLabel: "Rival Brand",
      statusLabel: "Assigned / Watching",
      rosterWrestlerIds: [],
      rosterState: [],
      championships: [],
      rivalries: [],
      financeReports: [],
      freeAgentClaims: [],
      contracts: [],
      marketTransactions: [],
      budget: getCpuBudgetDefault(),
      seasonObjectives: [],
      activityHistory: [],
      weeklyResults: [],
      seasonAverageScore: 0,
      seasonRank: 0,
      seasonTrend: "unranked",
    };
  });
}

export const defaultCareer: Required<Omit<NewCareerOptions, "draftedWrestlers" | "draftPickGroups" | "draftBundleDiscountUsd">> = {
  gmName: "Mara Voss",
  gmStyle: "Creative Visionary",
  brandName: "Raw",
  brandStyle: "Raw",
  difficulty: "Medium",
  startingBudgetTier: "$2M",
  draftMode: "snake",
  rivalGMAssignments: createRivalGMAssignments("Raw"),
};

export const unlimitedStartingBudget = UNLIMITED_BUDGET_AMOUNT;

export function createDefaultWrestlerRecord(): NonNullable<Wrestler["record"]> {
  return {
    season: { wins: 0, losses: 0, draws: 0, tagWins: 0, tagLosses: 0, tagDraws: 0 },
    career: { wins: 0, losses: 0, draws: 0, tagWins: 0, tagLosses: 0, tagDraws: 0 },
  };
}

export function getStartingBudgetAmount(tier: StartingBudgetTier) {
  switch (tier) {
    case "$1M":
    case "$2M":
    case "$4M":
      return STANDARD_BUDGET_AMOUNT;
    case "Unlimited":
      return unlimitedStartingBudget;
  }
}

export function getDraftedRosterValue(wrestlers: Pick<Wrestler, "id">[]) {
  return wrestlers.reduce((sum, wrestler) => sum + (getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0), 0);
}

export function getOpeningMoneyAfterDraft(startingBudgetTier: StartingBudgetTier, draftedWrestlers: Pick<Wrestler, "id">[] = [], draftDiscountUsd = 0) {
  const startingMoney = getStartingBudgetAmount(startingBudgetTier);

  if (startingBudgetTier === "Unlimited") {
    return startingMoney;
  }

  return startingMoney - Math.max(0, getDraftedRosterValue(draftedWrestlers) - draftDiscountUsd);
}

const defaultRosterSize = 12;

function cloneWrestlers(wrestlers: SeedWrestler[]) {
  return wrestlers.map((wrestler) => ({
    ...wrestler,
    ...enrichWrestlerIdentityContext(wrestler),
    alignment: resolveWrestlerAlignment(wrestler.alignment, wrestler.id),
    audienceHeat: wrestler.audienceHeat ?? SENTIMENT_NEUTRAL,
    trust: wrestler.trust ?? SENTIMENT_NEUTRAL,
    record: wrestler.record ?? createDefaultWrestlerRecord(),
    appearancesThisSeason: wrestler.appearancesThisSeason ?? 0,
    lastBookedWeek: wrestler.lastBookedWeek ?? 0,
    consecutiveWeeksBooked: wrestler.consecutiveWeeksBooked ?? 0,
    matchRatings: ensureMatchRatings(wrestler as Wrestler),
    injuryStatus: wrestler.injuryStatus ?? "healthy",
    injuryDescription: wrestler.injuryDescription,
    injuryWeeksRemaining: wrestler.injuryWeeksRemaining ?? 0,
    injuryOccurredWeek: wrestler.injuryOccurredWeek,
  }));
}

export const roster: Wrestler[] = cloneWrestlers(top200DraftPool.slice(0, defaultRosterSize));

export const draftPool: Wrestler[] = cloneWrestlers(top200DraftPool);

export function createDefaultChampionships(wrestlers: Wrestler[] = roster, brandStyle: BrandStyle = defaultCareer.brandStyle): Championship[] {
  const brandCatalogTitles = getTitleCatalogEntriesForBrand(brandStyle);
  const catalogTitles = brandCatalogTitles.filter((title) => title.eligibleMatchScope === "singles");
  const tagCatalogTitle = brandCatalogTitles.find((title) => title.eligibleMatchScope === "tag_team");

  if (catalogTitles.length) {
    const championships = catalogTitles.map((title) => {
      return {
        id: title.canonicalTitleId,
        name: title.displayName,
        division: title.division,
        catalogId: title.catalogId,
        canonicalTitleId: title.canonicalTitleId,
        brand: title.brand,
        titleLevel: title.titleLevel,
        titleType: title.prestigeTier,
        prestigeTier: title.prestigeTier,
        eligibleMatchScope: title.eligibleMatchScope,
        minimumDefenseFrequencyWeeks: title.minimumDefenseFrequencyWeeks,
        titleSceneCopy: title.sceneCopy,
        prestige: title.prestige,
        championIds: [],
        reignStartWeek: 1,
        defenses: 0,
      };
    });

    if (tagCatalogTitle) {
      championships.push({
        id: tagCatalogTitle.canonicalTitleId,
        name: tagCatalogTitle.displayName,
        division: tagCatalogTitle.division,
        catalogId: tagCatalogTitle.catalogId,
        canonicalTitleId: tagCatalogTitle.canonicalTitleId,
        brand: tagCatalogTitle.brand,
        titleLevel: tagCatalogTitle.titleLevel,
        titleType: tagCatalogTitle.prestigeTier,
        prestigeTier: tagCatalogTitle.prestigeTier,
        eligibleMatchScope: tagCatalogTitle.eligibleMatchScope,
        minimumDefenseFrequencyWeeks: tagCatalogTitle.minimumDefenseFrequencyWeeks,
        titleSceneCopy: tagCatalogTitle.sceneCopy,
        prestige: tagCatalogTitle.prestige,
        championIds: [],
        reignStartWeek: 1,
        defenses: 0,
      });
    }

    return championships;
  }

  return [
    {
      id: "world-championship",
      name: "World Championship",
      division: "World",
      prestige: 92,
      championIds: [],
      reignStartWeek: 1,
      defenses: 0,
    },
    {
      id: "television-championship",
      name: "Television Championship",
      division: "Television",
      prestige: 76,
      championIds: [],
      reignStartWeek: 1,
      defenses: 0,
    },
    {
      id: "tag-team-championship",
      name: "Tag Team Championship",
      division: "Tag Team",
      titleLevel: "Tag",
      titleType: "Tag Team",
      prestigeTier: "Tag Team",
      eligibleMatchScope: "tag_team",
      minimumDefenseFrequencyWeeks: 5,
      titleSceneCopy: "Tag title scene. Built for 2v2 M020 title matches with no team records or rankings.",
      prestige: 82,
      championIds: [],
      reignStartWeek: 1,
      defenses: 0,
    },
  ];
}

export function createSeasonCalendar(): CalendarWeek[] {
  const cycleCities = [
    "Chicago",
    "Philadelphia",
    "Las Vegas",
    "Atlanta",
    "Boston",
    "Toronto",
    "Nashville",
    "Dallas",
    "Houston",
    "Phoenix",
  ];
  const tvCities = ["Dallas", "Houston", "Milwaukee", "Atlanta", "Nashville", "Cleveland", "Boston", "Toronto", "Phoenix", "Seattle", "Portland", "Detroit", "New York"];

  return Array.from({ length: SEASON_WEEK_COUNT }, (_, index) => {
    const weekNumber = index + 1;
    const cycleIndex = Math.floor(index / PLE_CYCLE_WEEKS);
    const weekInCycle = index % PLE_CYCLE_WEEKS;
    const pleCity = cycleCities[cycleIndex] ?? `PLE ${cycleIndex + 1}`;
    const isPle = weekInCycle === PLE_CYCLE_WEEKS - 1;
    const isGoHome = weekInCycle === PLE_CYCLE_WEEKS - 2;

    return {
      weekNumber,
      showName: isPle ? pleCity : isGoHome ? `${pleCity} Go-Home` : (tvCities[(cycleIndex + weekInCycle) % tvCities.length] ?? "Tour Stop"),
      showType: isPle ? "ple" : "tv",
      isGoHome,
      completed: false,
    };
  });
}

export function normalizeSeasonCalendar(calendar: CalendarWeek[]): CalendarWeek[] {
  const template = createSeasonCalendar();

  if (calendar.length !== template.length) {
    return calendar;
  }

  return calendar.map((week) => {
    const canonical = template.find((entry) => entry.weekNumber === week.weekNumber);

    if (!canonical) {
      return week;
    }

    return {
      ...week,
      showName: canonical.showName,
      showType: canonical.showType,
      isGoHome: canonical.isGoHome,
    };
  });
}

export function createNewGame(options: NewCareerOptions = {}): GameState {
  const career = { ...defaultCareer, ...options };
  const startingRoster = cloneWrestlers(options.draftedWrestlers ? options.draftedWrestlers : roster);
  const startingMoney = getOpeningMoneyAfterDraft(career.startingBudgetTier, options.draftedWrestlers, options.draftBundleDiscountUsd);

  const rivalBrands = allocateCpuDraftRosters(
    createRivalBrandUniverse(career.rivalGMAssignments),
    startingRoster,
    draftPool,
    undefined,
    career.draftMode,
    `${career.brandStyle}-${career.gmName}`,
    career.brandName,
    career.difficulty,
    options.draftPickGroups,
  );

  const newGame: GameState = {
    seasonNumber: 1,
    seasonStartingMoney: startingMoney,
    currentWeek: 1,
    gmName: career.gmName.trim() || defaultCareer.gmName,
    gmStyle: career.gmStyle,
    playerBrand: createPlayerBrandIdentity(career.brandName.trim() || defaultCareer.brandName, career.brandStyle),
    brandName: career.brandName.trim() || defaultCareer.brandName,
    brandStyle: career.brandStyle,
    difficulty: career.difficulty,
    startingBudgetTier: career.startingBudgetTier,
    draftMode: career.draftMode,
    rivalGMAssignments: career.rivalGMAssignments,
    rivalBrands,
    createdAt: new Date().toISOString(),
    money: startingMoney,
    wrestlers: startingRoster,
    championships: createDefaultChampionships(startingRoster, career.brandStyle),
    rivalries: [],
    championshipHistory: [],
    rivalryHistory: [],
    calendar: createSeasonCalendar(),
    socialPosts: [],
    wrestlerSocialPosts: [],
    financeReports: [],
    marketState: createDefaultMarketState(startingRoster),
    seasonArchives: [],
    injuryRecoveryNotes: [],
    socialInbox: createDefaultSocialInboxState(),
    eventLedger: [],
    currentShow: [],
    showHistory: [],
  };

  return ensureWeeklyMarketBoard(newGame, draftPool);
}
