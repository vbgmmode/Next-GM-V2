import type { BrandStyle, Championship, PrototypeBrand, Wrestler } from "./types";

export type TitleCatalogEntry = {
  catalogId: string;
  canonicalTitleId: string;
  brand: PrototypeBrand;
  division: "Mens" | "Womens" | "Tag Team";
  titleLevel: "Top" | "Middle" | "Tag";
  displayName: string;
  prestige: number;
  prestigeTier: string;
  eligibleMatchScope: "singles" | "tag_team";
  minimumDefenseFrequencyWeeks: number;
  sceneCopy: string;
};

export const titleCatalogEntries: TitleCatalogEntry[] = [
  {
    catalogId: "raw_mens_top_world_heavyweight_championship",
    canonicalTitleId: "world_heavyweight_championship",
    brand: "Raw",
    division: "Mens",
    titleLevel: "Top",
    displayName: "World Heavyweight Championship",
    prestige: 96,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top men's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "raw_womens_top_womens_world_championship",
    canonicalTitleId: "womens_world_championship",
    brand: "Raw",
    division: "Womens",
    titleLevel: "Top",
    displayName: "Women's World Championship",
    prestige: 96,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top women's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "raw_mens_middle_intercontinental_championship",
    canonicalTitleId: "intercontinental_championship",
    brand: "Raw",
    division: "Mens",
    titleLevel: "Middle",
    displayName: "Intercontinental Championship",
    prestige: 78,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard men's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "raw_womens_middle_womens_intercontinental_championship",
    canonicalTitleId: "womens_intercontinental_championship",
    brand: "Raw",
    division: "Womens",
    titleLevel: "Middle",
    displayName: "Women's Intercontinental Championship",
    prestige: 78,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard women's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "raw_tag_team_world_tag_team_championship",
    canonicalTitleId: "raw_tag_team_championship",
    brand: "Raw",
    division: "Tag Team",
    titleLevel: "Tag",
    displayName: "World Tag Team Championship",
    prestige: 84,
    prestigeTier: "Tag Team",
    eligibleMatchScope: "tag_team",
    minimumDefenseFrequencyWeeks: 5,
    sceneCopy: "Tag title scene. Built for 2v2 M020 title matches with no team records or rankings.",
  },
  {
    catalogId: "smackdown_mens_top_undisputed_wwe_championship",
    canonicalTitleId: "undisputed_wwe_championship",
    brand: "SmackDown",
    division: "Mens",
    titleLevel: "Top",
    displayName: "Undisputed WWE Championship",
    prestige: 96,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top men's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "smackdown_womens_top_wwe_womens_championship",
    canonicalTitleId: "wwe_womens_championship",
    brand: "SmackDown",
    division: "Womens",
    titleLevel: "Top",
    displayName: "WWE Women's Championship",
    prestige: 96,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top women's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "smackdown_mens_middle_united_states_championship",
    canonicalTitleId: "united_states_championship",
    brand: "SmackDown",
    division: "Mens",
    titleLevel: "Middle",
    displayName: "United States Championship",
    prestige: 78,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard men's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "smackdown_womens_middle_womens_united_states_championship",
    canonicalTitleId: "womens_united_states_championship",
    brand: "SmackDown",
    division: "Womens",
    titleLevel: "Middle",
    displayName: "Women's United States Championship",
    prestige: 78,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard women's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "smackdown_tag_team_wwe_tag_team_championship",
    canonicalTitleId: "smackdown_tag_team_championship",
    brand: "SmackDown",
    division: "Tag Team",
    titleLevel: "Tag",
    displayName: "WWE Tag Team Championship",
    prestige: 84,
    prestigeTier: "Tag Team",
    eligibleMatchScope: "tag_team",
    minimumDefenseFrequencyWeeks: 5,
    sceneCopy: "Tag title scene. Built for 2v2 M020 title matches with no team records or rankings.",
  },
  {
    catalogId: "nxt_mens_top_nxt_championship",
    canonicalTitleId: "nxt_championship",
    brand: "NXT",
    division: "Mens",
    titleLevel: "Top",
    displayName: "NXT Championship",
    prestige: 92,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top men's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "nxt_womens_top_nxt_womens_championship",
    canonicalTitleId: "nxt_womens_championship",
    brand: "NXT",
    division: "Womens",
    titleLevel: "Top",
    displayName: "NXT Women's Championship",
    prestige: 92,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top women's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "nxt_mens_middle_nxt_north_american_championship",
    canonicalTitleId: "nxt_north_american_championship",
    brand: "NXT",
    division: "Mens",
    titleLevel: "Middle",
    displayName: "NXT North American Championship",
    prestige: 74,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard men's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "nxt_womens_middle_nxt_womens_north_american_championship",
    canonicalTitleId: "nxt_womens_north_american_championship",
    brand: "NXT",
    division: "Womens",
    titleLevel: "Middle",
    displayName: "NXT Women's North American Championship",
    prestige: 74,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard women's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "nxt_tag_team_nxt_tag_team_championship",
    canonicalTitleId: "nxt_tag_team_championship",
    brand: "NXT",
    division: "Tag Team",
    titleLevel: "Tag",
    displayName: "NXT Tag Team Championship",
    prestige: 80,
    prestigeTier: "Tag Team",
    eligibleMatchScope: "tag_team",
    minimumDefenseFrequencyWeeks: 5,
    sceneCopy: "Tag title scene. Built for 2v2 M020 title matches with no team records or rankings.",
  },
  {
    catalogId: "aew_mens_top_aew_world_championship",
    canonicalTitleId: "aew_world_championship",
    brand: "AEW",
    division: "Mens",
    titleLevel: "Top",
    displayName: "AEW World Championship",
    prestige: 96,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top men's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "aew_womens_top_aew_womens_world_championship",
    canonicalTitleId: "aew_womens_world_championship",
    brand: "AEW",
    division: "Womens",
    titleLevel: "Top",
    displayName: "AEW Women's World Championship",
    prestige: 96,
    prestigeTier: "World/Main Event",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 6,
    sceneCopy: "Top women's title scene. Built for main event or co-main event stakes.",
  },
  {
    catalogId: "aew_mens_middle_aew_tnt_championship",
    canonicalTitleId: "aew_tnt_championship",
    brand: "AEW",
    division: "Mens",
    titleLevel: "Middle",
    displayName: "TNT Championship",
    prestige: 78,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard men's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "aew_womens_middle_aew_tbs_championship",
    canonicalTitleId: "aew_tbs_championship",
    brand: "AEW",
    division: "Womens",
    titleLevel: "Middle",
    displayName: "TBS Championship",
    prestige: 78,
    prestigeTier: "Secondary/Midcard",
    eligibleMatchScope: "singles",
    minimumDefenseFrequencyWeeks: 4,
    sceneCopy: "Upper-midcard women's title scene. Best for workhorse features and weekly TV pressure.",
  },
  {
    catalogId: "aew_tag_team_aew_world_tag_team_championship",
    canonicalTitleId: "aew_tag_team_championship",
    brand: "AEW",
    division: "Tag Team",
    titleLevel: "Tag",
    displayName: "AEW World Tag Team Championship",
    prestige: 84,
    prestigeTier: "Tag Team",
    eligibleMatchScope: "tag_team",
    minimumDefenseFrequencyWeeks: 5,
    sceneCopy: "Tag title scene. Built for 2v2 M020 title matches with no team records or rankings.",
  },
];

const titleArtworkByCanonicalId: Record<string, string> = {
  aew_tag_team_championship: "/title-belts/aew-world-tag-team-championship.png",
  aew_tbs_championship: "/title-belts/tbs-championship.png",
  aew_tnt_championship: "/title-belts/tnt-championship.png",
  aew_womens_world_championship: "/title-belts/aew-womens-world-championship.png",
  aew_world_championship: "/title-belts/aew-world-championship.png",
  intercontinental_championship: "/title-belts/intercontinental-championship.png",
  nxt_championship: "/title-belts/nxt-championship.png",
  nxt_north_american_championship: "/title-belts/nxt-north-american-championship.png",
  nxt_tag_team_championship: "/title-belts/nxt-tag-team-championship.png",
  nxt_womens_championship: "/title-belts/nxt-womens-championship.png",
  nxt_womens_north_american_championship: "/title-belts/nxt-womens-north-american-championship.png",
  raw_tag_team_championship: "/title-belts/world-tag-team-championship.png",
  smackdown_tag_team_championship: "/title-belts/wwe-tag-team-championship.png",
  undisputed_wwe_championship: "/title-belts/undisputed-wwe-championship.png",
  united_states_championship: "/title-belts/united-states-championship.png",
  womens_intercontinental_championship: "/title-belts/womens-intercontinental-championship.png",
  womens_united_states_championship: "/title-belts/womens-united-states-championship.png",
  womens_world_championship: "/title-belts/womens-world-championship.png",
  world_heavyweight_championship: "/title-belts/world-heavyweight-championship.png",
  wwe_womens_championship: "/title-belts/wwe-womens-championship.png",
};

export function getTitleCatalogBrand(brandStyle: BrandStyle): PrototypeBrand {
  return brandStyle === "SmackDown" || brandStyle === "NXT" || brandStyle === "AEW" ? brandStyle : "Raw";
}

export function getTitleCatalogEntriesForBrand(brandStyle: BrandStyle) {
  const brand = getTitleCatalogBrand(brandStyle);
  return titleCatalogEntries.filter((entry) => entry.brand === brand);
}

export function getChampionshipArtworkSrc(championship: Championship) {
  const canonicalTitleId =
    championship.canonicalTitleId ??
    titleCatalogEntries.find((entry) => entry.catalogId === championship.catalogId || entry.displayName === championship.name)?.canonicalTitleId;

  return canonicalTitleId ? titleArtworkByCanonicalId[canonicalTitleId] : undefined;
}

export function getChampionshipDivisionGroup(championship: Championship) {
  const division = championship.division.toLowerCase();
  const name = championship.name.toLowerCase();

  if (division.includes("women") || name.includes("women")) {
    return "womens";
  }

  if (division.includes("men")) {
    return "mens";
  }

  if (division.includes("tag") || championship.eligibleMatchScope === "tag_team") {
    return "mens";
  }

  return undefined;
}

function getWrestlerDivisionGroup(wrestler: Wrestler | undefined) {
  const wrestlerDivision = wrestler?.division?.toLowerCase() ?? "";
  return wrestlerDivision.includes("women") || wrestlerDivision.includes("female") ? "womens" : wrestlerDivision.includes("men") || wrestlerDivision.includes("male") ? "mens" : undefined;
}

function getTitleRankBounds(championship: Championship) {
  if (championship.eligibleMatchScope === "tag_team" || championship.titleLevel === "Tag") {
    return undefined;
  }

  if (championship.titleLevel === "Middle" || championship.prestigeTier?.toLowerCase().includes("midcard") || championship.titleType?.toLowerCase().includes("midcard")) {
    return { min: 4, max: 6 };
  }

  if (championship.titleLevel === "Top" || championship.prestigeTier?.toLowerCase().includes("world") || championship.titleType?.toLowerCase().includes("world")) {
    return { min: 1, max: 3 };
  }

  return undefined;
}

function getRankedGenderPool(wrestler: Wrestler, roster: Wrestler[]) {
  const wrestlerGroup = getWrestlerDivisionGroup(wrestler);
  return roster
    .filter((candidate) => getWrestlerDivisionGroup(candidate) === wrestlerGroup)
    .sort(
      (a, b) =>
        b.popularity + b.momentum - (a.popularity + a.momentum) ||
        b.popularity - a.popularity ||
        b.momentum - a.momentum ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}

export function getTitleDivisionRank(wrestler: Wrestler, roster: Wrestler[]) {
  const rankedPool = getRankedGenderPool(wrestler, roster);
  const index = rankedPool.findIndex((candidate) => candidate.id === wrestler.id);
  return index >= 0 ? index + 1 : undefined;
}

export function wrestlerFitsChampionshipDivision(wrestler: Wrestler | undefined, championship: Championship, roster: Wrestler[] = []) {
  const titleGroup = getChampionshipDivisionGroup(championship);

  if (!titleGroup) {
    return true;
  }

  const wrestlerGroup = getWrestlerDivisionGroup(wrestler);

  if (wrestlerGroup !== titleGroup) {
    return false;
  }

  if (!wrestler || championship.championIds.includes(wrestler.id) || !roster.length) {
    return true;
  }

  const rankedPool = getRankedGenderPool(wrestler, roster);

  if (rankedPool.length < 6) {
    return true;
  }

  const rank = getTitleDivisionRank(wrestler, roster);
  const bounds = getTitleRankBounds(championship);

  return !bounds || Boolean(rank && rank >= bounds.min && rank <= bounds.max);
}

export function applyChampionshipCatalogDefaults(championship: Championship, brandStyle: BrandStyle): Championship {
  const brand = getTitleCatalogBrand(brandStyle);
  const entry =
    titleCatalogEntries.find((item) => item.catalogId === championship.catalogId || item.canonicalTitleId === championship.canonicalTitleId) ??
    titleCatalogEntries.find((item) => item.brand === brand && item.displayName === championship.name);

  if (entry) {
    return {
      ...championship,
      catalogId: entry.catalogId,
      canonicalTitleId: entry.canonicalTitleId,
      brand: entry.brand,
      division: entry.division,
      titleLevel: entry.titleLevel,
      titleType: entry.prestigeTier,
      prestigeTier: entry.prestigeTier,
      eligibleMatchScope: entry.eligibleMatchScope,
      minimumDefenseFrequencyWeeks: entry.minimumDefenseFrequencyWeeks,
      titleSceneCopy: entry.sceneCopy,
    };
  }

  const isTag = championship.division === "Tag Team" || championship.name.toLowerCase().includes("tag");
  const isTelevision = championship.name.toLowerCase().includes("television");

  return {
    ...championship,
    brand: championship.brand ?? brand,
    titleLevel: championship.titleLevel ?? (isTag ? "Tag" : isTelevision ? "Middle" : "Top"),
    titleType: championship.titleType ?? (isTag ? "Tag Team" : isTelevision ? "Secondary/Midcard" : "World/Main Event"),
    prestigeTier: championship.prestigeTier ?? (isTag ? "Tag Team" : isTelevision ? "Secondary/Midcard" : "World/Main Event"),
    eligibleMatchScope: championship.eligibleMatchScope ?? (isTag ? "tag_team" : "singles"),
    minimumDefenseFrequencyWeeks: championship.minimumDefenseFrequencyWeeks ?? (isTelevision ? 4 : 6),
    titleSceneCopy:
      championship.titleSceneCopy ??
      (isTag
        ? "Tag title scene. Built for 2v2 M020 title matches with no team records or rankings."
        : "Legacy singles title scene. Champion and contender context is derived from the current roster."),
  };
}
