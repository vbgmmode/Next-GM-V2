import type { BrandStyle, CalendarWeek, Championship, GameState, GMStyle, Rivalry, Wrestler } from "./types";

export type NewCareerOptions = {
  gmName?: string;
  gmStyle?: GMStyle;
  brandName?: string;
  brandStyle?: BrandStyle;
};

export const defaultCareer: Required<NewCareerOptions> = {
  gmName: "Alex Monroe",
  gmStyle: "Creative Visionary",
  brandName: "Neon Harbor Wrestling",
  brandStyle: "Prime Time Sports Entertainment",
};

export const roster: Wrestler[] = [
  { id: "jax-ransom", name: "Jax Ransom", popularity: 72, momentum: 58, fatigue: 18, morale: 65, ringSkill: 79, promoSkill: 61 },
  { id: "mara-volt", name: "Mara Volt", popularity: 68, momentum: 66, fatigue: 22, morale: 72, ringSkill: 73, promoSkill: 76 },
  { id: "toni-ash", name: "Toni Ash", popularity: 61, momentum: 54, fatigue: 12, morale: 69, ringSkill: 84, promoSkill: 48 },
  { id: "rex-carter", name: "Rex Carter", popularity: 75, momentum: 62, fatigue: 27, morale: 58, ringSkill: 65, promoSkill: 82 },
  { id: "ivy-maddox", name: "Ivy Maddox", popularity: 55, momentum: 49, fatigue: 10, morale: 77, ringSkill: 69, promoSkill: 71 },
  { id: "sol-kane", name: "Sol Kane", popularity: 64, momentum: 60, fatigue: 16, morale: 74, ringSkill: 77, promoSkill: 64 },
  { id: "nyx-cross", name: "Nyx Cross", popularity: 59, momentum: 70, fatigue: 20, morale: 67, ringSkill: 58, promoSkill: 87 },
  { id: "bruno-slate", name: "Bruno Slate", popularity: 51, momentum: 44, fatigue: 14, morale: 63, ringSkill: 81, promoSkill: 43 },
  { id: "elena-echo", name: "Elena Echo", popularity: 66, momentum: 57, fatigue: 19, morale: 70, ringSkill: 62, promoSkill: 84 },
  { id: "dante-knox", name: "Dante Knox", popularity: 48, momentum: 52, fatigue: 8, morale: 75, ringSkill: 74, promoSkill: 55 },
  { id: "sable-king", name: "Sable King", popularity: 70, momentum: 64, fatigue: 24, morale: 61, ringSkill: 71, promoSkill: 79 },
  { id: "miles-mercer", name: "Miles Mercer", popularity: 57, momentum: 46, fatigue: 11, morale: 68, ringSkill: 67, promoSkill: 68 },
];

export function createDefaultChampionships(): Championship[] {
  return [
    {
      id: "world-championship",
      name: "World Championship",
      division: "World",
      prestige: 92,
      championIds: ["rex-carter"],
      reignStartWeek: 1,
      defenses: 0,
    },
    {
      id: "television-championship",
      name: "Television Championship",
      division: "Television",
      prestige: 76,
      championIds: ["nyx-cross"],
      reignStartWeek: 1,
      defenses: 0,
    },
    {
      id: "tag-team-championship",
      name: "Tag Team Championship",
      division: "Tag Team",
      prestige: 82,
      championIds: ["jax-ransom", "mara-volt"],
      reignStartWeek: 1,
      defenses: 0,
    },
  ];
}

export function createDefaultRivalries(): Rivalry[] {
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

  return {
    seasonNumber: 1,
    seasonStartingMoney: 250000,
    currentWeek: 1,
    gmName: career.gmName.trim() || defaultCareer.gmName,
    gmStyle: career.gmStyle,
    brandName: career.brandName.trim() || defaultCareer.brandName,
    brandStyle: career.brandStyle,
    createdAt: new Date().toISOString(),
    money: 250000,
    wrestlers: roster.map((wrestler) => ({ ...wrestler })),
    championships: createDefaultChampionships(),
    rivalries: createDefaultRivalries(),
    calendar: createSeasonCalendar(),
    socialPosts: [],
    financeReports: [],
    currentShow: [],
    showHistory: [],
  };
}
