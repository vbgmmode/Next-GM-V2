import type {
  BrandStyle,
  CalendarWeek,
  Championship,
  GameDifficulty,
  GameState,
  GMStyle,
  PrototypeBrand,
  RivalGMAssignment,
  Rivalry,
  RivalryStakes,
  StartingBudgetTier,
  Wrestler,
} from "./types";
import { top200DraftPool } from "./top200DraftPool";

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

const defaultRosterSize = 12;

function cloneWrestlers(wrestlers: SeedWrestler[]) {
  return wrestlers.map((wrestler) => ({
    ...wrestler,
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

export function createDefaultChampionships(wrestlers: Wrestler[] = roster): Championship[] {
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

  return {
    id,
    name: `${first.name} vs ${second.name}`,
    participantIds: [first.id, second.id],
    heat,
    freshness,
    weeksActive: 1,
    lastAdvancedWeek: 0,
    status: heat >= 68 ? "rising" : "steady",
    stakes,
  };
}

export function createDefaultRivalries(wrestlers: Wrestler[] = roster): Rivalry[] {
  const ranked = byStarPower(wrestlers);
  const rivalries = [
    createRivalryFromPair("rivalry-opening-title", ranked.slice(0, 2), "title"),
    createRivalryFromPair("rivalry-locker-room-respect", ranked.slice(2, 4), "respect"),
    createRivalryFromPair("rivalry-personal-score", ranked.slice(4, 6), "personal"),
  ].filter((rivalry): rivalry is Rivalry => Boolean(rivalry));

  if (rivalries.length) {
    return rivalries;
  }

  return [
    {
      id: "rivalry-rex-jax",
      name: "Rex Carter vs Jax Ransom",
      participantIds: ["rex-carter", "jax-ransom"],
      heat: 68,
      freshness: 78,
      weeksActive: 1,
      lastAdvancedWeek: 0,
      status: "rising",
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
      stakes: "personal",
    },
  ];
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
  const startingMoney = getStartingBudgetAmount(career.startingBudgetTier);

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
    createdAt: new Date().toISOString(),
    money: startingMoney,
    wrestlers: startingRoster,
    championships: createDefaultChampionships(startingRoster),
    rivalries: createDefaultRivalries(startingRoster),
    championshipHistory: [],
    rivalryHistory: [],
    calendar: createSeasonCalendar(),
    socialPosts: [],
    financeReports: [],
    injuryRecoveryNotes: [],
    currentShow: [],
    showHistory: [],
  };
}
