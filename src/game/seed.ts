import type {
  BrandStyle,
  CalendarWeek,
  Championship,
  GameDifficulty,
  GameState,
  GMStyle,
  PrototypeBrand,
  RivalBrandState,
  RivalGMAssignment,
  Rivalry,
  RivalryStakes,
  StartingBudgetTier,
  Wrestler,
} from "./types";
import { getTitleCatalogEntriesForBrand } from "./titleCatalog";
import { applyRivalryCatalogDefaults, getDefaultStorylineIdForStakes, getRivalryStoryline } from "./rivalryCatalog";
import { top200DraftPool } from "./top200DraftPool";
import { enrichWrestlerIdentityContext } from "./wrestlerIdentityContext";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";

type SeedWrestler = Omit<Wrestler, "injuryStatus" | "injuryDescription" | "injuryWeeksRemaining" | "injuryOccurredWeek"> &
  Partial<Pick<Wrestler, "injuryStatus" | "injuryDescription" | "injuryWeeksRemaining" | "injuryOccurredWeek">>;

export type NewCareerOptions = {
  gmName?: string;
  gmStyle?: GMStyle;
  brandName?: string;
  brandStyle?: BrandStyle;
  difficulty?: GameDifficulty;
  startingBudgetTier?: StartingBudgetTier;
  rivalGMAssignments?: RivalGMAssignment[];
  draftedWrestlers?: Wrestler[];
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
  return rivalGMAssignments.map((assignment) => ({
    id: `rival-brand-${createStableId(assignment.brand)}`,
    brandKey: assignment.brand,
    brandName: assignment.brand,
    assignedGMId: `rival-gm-${createStableId(assignment.gmName)}`,
    assignedGMName: assignment.gmName,
    assignedGMStyle: assignment.gmStyle,
    roleLabel: "Rival Brand",
    statusLabel: "Assigned / Watching",
    rosterWrestlerIds: [],
    activityHistory: [],
  }));
}

export const defaultCareer: Required<Omit<NewCareerOptions, "draftedWrestlers">> = {
  gmName: "Alex Monroe",
  gmStyle: "Creative Visionary",
  brandName: "Raw",
  brandStyle: "Raw",
  difficulty: "Medium",
  startingBudgetTier: "$2M",
  rivalGMAssignments: createRivalGMAssignments("Raw"),
};

export const unlimitedStartingBudget = 999999999;

export function getStartingBudgetAmount(tier: StartingBudgetTier) {
  switch (tier) {
    case "$1M":
      return 1000000;
    case "$2M":
      return 2000000;
    case "$4M":
      return 4000000;
    case "Unlimited":
      return unlimitedStartingBudget;
  }
}

export function getDraftedRosterValue(wrestlers: Pick<Wrestler, "id">[]) {
  return wrestlers.reduce((sum, wrestler) => sum + (getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0), 0);
}

export function getOpeningMoneyAfterDraft(startingBudgetTier: StartingBudgetTier, draftedWrestlers: Pick<Wrestler, "id">[] = []) {
  const startingMoney = getStartingBudgetAmount(startingBudgetTier);

  if (startingBudgetTier === "Unlimited") {
    return startingMoney;
  }

  return startingMoney - getDraftedRosterValue(draftedWrestlers);
}

const defaultRosterSize = 12;

function cloneWrestlers(wrestlers: SeedWrestler[]) {
  return wrestlers.map((wrestler) => ({
    ...wrestler,
    ...enrichWrestlerIdentityContext(wrestler),
    appearancesThisSeason: wrestler.appearancesThisSeason ?? 0,
    lastBookedWeek: wrestler.lastBookedWeek ?? 0,
    consecutiveWeeksBooked: wrestler.consecutiveWeeksBooked ?? 0,
    injuryStatus: wrestler.injuryStatus ?? "healthy",
    injuryDescription: wrestler.injuryDescription,
    injuryWeeksRemaining: wrestler.injuryWeeksRemaining ?? 0,
    injuryOccurredWeek: wrestler.injuryOccurredWeek,
  }));
}

export const roster: Wrestler[] = cloneWrestlers(top200DraftPool.slice(0, defaultRosterSize));

export const draftPool: Wrestler[] = cloneWrestlers(top200DraftPool);

function byStarPower(wrestlers: Wrestler[]) {
  return [...wrestlers].sort((a, b) => b.popularity + b.momentum - (a.popularity + a.momentum));
}

function getSeedDivisionGroup(wrestler: Wrestler) {
  const division = wrestler.division?.toLowerCase() ?? "";

  if (division.includes("women") || division.includes("female")) {
    return "Womens";
  }

  if (division.includes("men") || division.includes("male")) {
    return "Mens";
  }

  return undefined;
}

export function createDefaultChampionships(wrestlers: Wrestler[] = roster, brandStyle: BrandStyle = defaultCareer.brandStyle): Championship[] {
  const brandCatalogTitles = getTitleCatalogEntriesForBrand(brandStyle);
  const catalogTitles = brandCatalogTitles.filter((title) => title.eligibleMatchScope === "singles");
  const tagCatalogTitle = brandCatalogTitles.find((title) => title.eligibleMatchScope === "tag_team");

  if (catalogTitles.length) {
    const ranked = byStarPower(wrestlers);
    const usedChampionIds = new Set<string>();

    const championships = catalogTitles.map((title) => {
      const sameDivision = ranked.filter((wrestler) => getSeedDivisionGroup(wrestler) === title.division);
      const champion = sameDivision.find((wrestler) => !usedChampionIds.has(wrestler.id)) ?? sameDivision[0] ?? ranked.find((wrestler) => !usedChampionIds.has(wrestler.id)) ?? ranked[0] ?? roster[0];

      usedChampionIds.add(champion.id);

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
        championIds: [champion.id],
        reignStartWeek: 1,
        defenses: 0,
      };
    });

    if (tagCatalogTitle) {
      const tagChampions = ranked.filter((wrestler) => !usedChampionIds.has(wrestler.id)).slice(0, 2);
      const fallbackTagChampions = ranked.slice(0, 2);
      const championIds = tagChampions.length === 2 ? tagChampions.map((wrestler) => wrestler.id) : fallbackTagChampions.map((wrestler) => wrestler.id);

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
        championIds,
        reignStartWeek: 1,
        defenses: 0,
      });
    }

    return championships;
  }

  const ranked = byStarPower(wrestlers);
  const worldChampion = ranked[0] ?? roster[0];
  const televisionChampion =
    [...wrestlers].filter((wrestler) => wrestler.id !== worldChampion.id).sort((a, b) => b.momentum + b.promoSkill - (a.momentum + a.promoSkill))[0] ??
    ranked[1] ??
    worldChampion;
  const tagChampions = [...wrestlers]
    .filter((wrestler) => wrestler.id !== worldChampion.id && wrestler.id !== televisionChampion.id)
    .sort((a, b) => b.ringSkill + b.popularity - (a.ringSkill + a.popularity))
    .slice(0, 2);

  return [
    {
      id: "world-championship",
      name: "World Championship",
      division: "World",
      prestige: 92,
      championIds: [worldChampion.id],
      reignStartWeek: 1,
      defenses: 0,
    },
    {
      id: "television-championship",
      name: "Television Championship",
      division: "Television",
      prestige: 76,
      championIds: [televisionChampion.id],
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
      championIds: tagChampions.length === 2 ? tagChampions.map((wrestler) => wrestler.id) : ranked.slice(0, 2).map((wrestler) => wrestler.id),
      reignStartWeek: 1,
      defenses: 0,
    },
  ];
}

function createRivalryFromPair(id: string, wrestlers: Wrestler[], stakes: RivalryStakes): Rivalry | null {
  const [first, second] = wrestlers;

  if (!first || !second) {
    return null;
  }

  const heat = Math.round((first.popularity + first.momentum + second.popularity + second.momentum) / 4);
  const freshness = stakes === "title" ? 78 : stakes === "respect" ? 72 : 66;

  return applyRivalryCatalogDefaults({
    id,
    name: `${first.name} vs ${second.name}`,
    participantIds: [first.id, second.id],
    storylineId: getDefaultStorylineIdForStakes(stakes),
    relationshipTag: getRivalryStoryline({ stakes, storylineId: getDefaultStorylineIdForStakes(stakes) }).relationshipTag,
    heat,
    freshness,
    weeksActive: 1,
    lastAdvancedWeek: 0,
    status: heat >= 68 ? "rising" : "steady",
    stakes,
  });
}

export function createDefaultRivalries(wrestlers: Wrestler[] = roster): Rivalry[] {
  const ranked = byStarPower(wrestlers);
  const usedWrestlerIds = new Set<string>();
  const getNextSameDivisionPair = () => {
    const available = ranked.filter((wrestler) => !usedWrestlerIds.has(wrestler.id));
    const first = available.find((wrestler) => {
      const division = getSeedDivisionGroup(wrestler);
      return Boolean(division && available.some((candidate) => candidate.id !== wrestler.id && getSeedDivisionGroup(candidate) === division));
    });

    if (!first) {
      return [];
    }

    const second = available.find((wrestler) => wrestler.id !== first.id && getSeedDivisionGroup(wrestler) === getSeedDivisionGroup(first));

    if (!second) {
      return [];
    }

    usedWrestlerIds.add(first.id);
    usedWrestlerIds.add(second.id);
    return [first, second];
  };
  const rivalries = [
    createRivalryFromPair("rivalry-opening-title", getNextSameDivisionPair(), "title"),
    createRivalryFromPair("rivalry-locker-room-respect", getNextSameDivisionPair(), "respect"),
    createRivalryFromPair("rivalry-personal-score", getNextSameDivisionPair(), "personal"),
  ].filter((rivalry): rivalry is Rivalry => Boolean(rivalry));

  if (rivalries.length) {
    return rivalries;
  }

  const fallbackRivalries: Rivalry[] = [
    {
      id: "rivalry-rex-jax",
      name: "Rex Carter vs Jax Ransom",
      participantIds: ["rex-carter", "jax-ransom"],
      heat: 68,
      freshness: 78,
      weeksActive: 1,
      lastAdvancedWeek: 0,
      status: "rising",
      storylineId: "championship_chase",
      relationshipTag: "rivals",
      stakes: "title",
    },
    {
      id: "rivalry-mara-sable",
      name: "Mara Volt vs Sable King",
      participantIds: ["mara-volt", "sable-king"],
      heat: 61,
      freshness: 72,
      weeksActive: 1,
      lastAdvancedWeek: 0,
      status: "steady",
      storylineId: "respect_feud",
      relationshipTag: "respect",
      stakes: "respect",
    },
    {
      id: "rivalry-nyx-elena",
      name: "Nyx Cross vs Elena Echo",
      participantIds: ["nyx-cross", "elena-echo"],
      heat: 58,
      freshness: 66,
      weeksActive: 1,
      lastAdvancedWeek: 0,
      status: "steady",
      storylineId: "personal_grudge",
      relationshipTag: "rivals",
      stakes: "personal",
    },
  ];

  return fallbackRivalries.map(applyRivalryCatalogDefaults);
}

export function createSeasonCalendar(): CalendarWeek[] {
  return [
    { weekNumber: 1, showName: "Neon Harbor TV", showType: "tv", isGoHome: false, completed: false },
    { weekNumber: 2, showName: "Neon Harbor TV", showType: "tv", isGoHome: false, completed: false },
    { weekNumber: 3, showName: "Collision Course Go-Home", showType: "tv", isGoHome: true, completed: false },
    { weekNumber: 4, showName: "Collision Course", showType: "ple", isGoHome: false, completed: false },
    { weekNumber: 5, showName: "Neon Harbor TV", showType: "tv", isGoHome: false, completed: false },
    { weekNumber: 6, showName: "Neon Harbor TV", showType: "tv", isGoHome: false, completed: false },
    { weekNumber: 7, showName: "Heatwave Havoc Go-Home", showType: "tv", isGoHome: true, completed: false },
    { weekNumber: 8, showName: "Heatwave Havoc", showType: "ple", isGoHome: false, completed: false },
    { weekNumber: 9, showName: "Neon Harbor TV", showType: "tv", isGoHome: false, completed: false },
    { weekNumber: 10, showName: "Neon Harbor TV", showType: "tv", isGoHome: false, completed: false },
    { weekNumber: 11, showName: "Final Bell Go-Home", showType: "tv", isGoHome: true, completed: false },
    { weekNumber: 12, showName: "Final Bell", showType: "ple", isGoHome: false, completed: false },
  ];
}

export function createNewGame(options: NewCareerOptions = {}): GameState {
  const career = { ...defaultCareer, ...options };
  const startingRoster = cloneWrestlers(options.draftedWrestlers?.length ? options.draftedWrestlers : roster);
  const startingMoney = getOpeningMoneyAfterDraft(career.startingBudgetTier, options.draftedWrestlers);

  return {
    seasonNumber: 1,
    seasonStartingMoney: startingMoney,
    currentWeek: 1,
    gmName: career.gmName.trim() || defaultCareer.gmName,
    gmStyle: career.gmStyle,
    brandName: career.brandName.trim() || defaultCareer.brandName,
    brandStyle: career.brandStyle,
    difficulty: career.difficulty,
    startingBudgetTier: career.startingBudgetTier,
    rivalGMAssignments: career.rivalGMAssignments,
    rivalBrands: createRivalBrandUniverse(career.rivalGMAssignments),
    createdAt: new Date().toISOString(),
    money: startingMoney,
    wrestlers: startingRoster,
    championships: createDefaultChampionships(startingRoster, career.brandStyle),
    rivalries: createDefaultRivalries(startingRoster),
    championshipHistory: [],
    rivalryHistory: [],
    calendar: createSeasonCalendar(),
    socialPosts: [],
    financeReports: [],
    seasonArchives: [],
    injuryRecoveryNotes: [],
    currentShow: [],
    showHistory: [],
  };
}
