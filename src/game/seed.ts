import type { BrandStyle, CalendarWeek, Championship, GameState, GMStyle, Rivalry, RivalryStakes, Wrestler } from "./types";

export type NewCareerOptions = {
  gmName?: string;
  gmStyle?: GMStyle;
  brandName?: string;
  brandStyle?: BrandStyle;
  draftedWrestlers?: Wrestler[];
};

export const defaultCareer: Required<Omit<NewCareerOptions, "draftedWrestlers">> = {
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

export const draftPool: Wrestler[] = [
  { id: "cass-blaze", name: "Cass Blaze", popularity: 73, momentum: 67, fatigue: 15, morale: 70, ringSkill: 74, promoSkill: 83 },
  { id: "atlas-rome", name: "Atlas Rome", popularity: 76, momentum: 60, fatigue: 21, morale: 66, ringSkill: 82, promoSkill: 64 },
  { id: "viva-valentine", name: "Viva Valentine", popularity: 69, momentum: 72, fatigue: 13, morale: 79, ringSkill: 66, promoSkill: 88 },
  { id: "knox-hallow", name: "Knox Hallow", popularity: 63, momentum: 58, fatigue: 18, morale: 62, ringSkill: 86, promoSkill: 51 },
  { id: "zara-volt", name: "Zara Volt", popularity: 71, momentum: 63, fatigue: 20, morale: 73, ringSkill: 78, promoSkill: 75 },
  { id: "brick-montoya", name: "Brick Montoya", popularity: 58, momentum: 55, fatigue: 16, morale: 68, ringSkill: 80, promoSkill: 49 },
  { id: "nova-raine", name: "Nova Raine", popularity: 67, momentum: 69, fatigue: 11, morale: 76, ringSkill: 70, promoSkill: 81 },
  { id: "malik-venom", name: "Malik Venom", popularity: 62, momentum: 64, fatigue: 23, morale: 60, ringSkill: 72, promoSkill: 84 },
  { id: "penny-onyx", name: "Penny Onyx", popularity: 54, momentum: 61, fatigue: 9, morale: 80, ringSkill: 77, promoSkill: 58 },
  { id: "rowan-steel", name: "Rowan Steel", popularity: 65, momentum: 53, fatigue: 17, morale: 71, ringSkill: 88, promoSkill: 45 },
  { id: "luca-saints", name: "Luca Saints", popularity: 60, momentum: 57, fatigue: 12, morale: 74, ringSkill: 63, promoSkill: 86 },
  { id: "ember-kai", name: "Ember Kai", popularity: 56, momentum: 66, fatigue: 14, morale: 69, ringSkill: 83, promoSkill: 55 },
  ...roster,
];

function cloneWrestlers(wrestlers: Wrestler[]) {
  return wrestlers.map((wrestler) => ({
    ...wrestler,
    appearancesThisSeason: wrestler.appearancesThisSeason ?? 0,
    lastBookedWeek: wrestler.lastBookedWeek ?? 0,
    consecutiveWeeksBooked: wrestler.consecutiveWeeksBooked ?? 0,
  }));
}

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
    wrestlers: startingRoster,
    championships: createDefaultChampionships(startingRoster),
    rivalries: createDefaultRivalries(startingRoster),
    calendar: createSeasonCalendar(),
    socialPosts: [],
    financeReports: [],
    currentShow: [],
    showHistory: [],
  };
}
