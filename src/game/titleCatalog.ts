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
];

export function getTitleCatalogBrand(brandStyle: BrandStyle): PrototypeBrand {
  return brandStyle === "SmackDown" || brandStyle === "NXT" || brandStyle === "AEW" ? brandStyle : "Raw";
}

export function getTitleCatalogEntriesForBrand(brandStyle: BrandStyle) {
  const brand = getTitleCatalogBrand(brandStyle);
  return titleCatalogEntries.filter((entry) => entry.brand === brand);
}

export function getChampionshipDivisionGroup(championship: Championship) {
  const division = championship.division.toLowerCase();

  if (division.includes("women")) {
    return "womens";
  }

  if (division.includes("men")) {
    return "mens";
  }

  return undefined;
}

export function wrestlerFitsChampionshipDivision(wrestler: Wrestler | undefined, championship: Championship) {
  const titleGroup = getChampionshipDivisionGroup(championship);

  if (!titleGroup) {
    return true;
  }

  const wrestlerDivision = wrestler?.division?.toLowerCase() ?? "";
  const wrestlerGroup = wrestlerDivision.includes("women") || wrestlerDivision.includes("female") ? "womens" : wrestlerDivision.includes("men") || wrestlerDivision.includes("male") ? "mens" : undefined;

  return wrestlerGroup === titleGroup;
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
        ? "Tag title scene. Displayed as championship context while tag-team booking remains outside this pass."
        : "Legacy singles title scene. Champion and contender context is derived from the current roster."),
  };
}
