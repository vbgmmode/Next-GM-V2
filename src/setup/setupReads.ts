import { affiliationCatalog } from "../game/affiliationCatalog";
import { getRosterFinanceValueForWrestler } from "../game/financeCatalog";
import { formatMoney } from "../game/formatters";
import { getWrestlerDivisionGroup } from "../game/scoring";
import { draftPool, getDraftedRosterValue, getStartingBudgetAmount } from "../game/seed";
import type { BrandStyle, DraftMode, GameDifficulty, RivalBrandState, StartingBudgetTier, Wrestler } from "../game/types";
import { brandChairs } from "../game/brandChairs";
import { getWrestlerIdentityContext } from "../game/wrestlerIdentityContext";

export type SetupStep = "contract" | "gm" | "brand" | "rules" | "draft";
export type DraftSort = "rank" | "starPower" | "popularity" | "momentum" | "ringSkill" | "promoSkill" | "fatigue";
export type DraftReservePressure = "Healthy" | "Tight" | "Over Budget";

export type ChoiceOption<T extends string = string> = {
  description?: string;
  label: T;
};

export type DraftFinanceReadout = {
  bundleDiscountUsd: number;
  grossRosterValue: number;
  isUnlimitedBudget: boolean;
  missingFinanceRows: Wrestler[];
  pressureLabel: DraftReservePressure;
  projectedReserve: number;
  recommendedReserveTarget: number;
  rosterValue: number;
  startingBudgetAmount: number;
};

export type DraftBundleOffer = {
  affiliationId: string;
  affiliationName: string;
  kind: "tag_team" | "faction";
  wrestlers: Wrestler[];
  wrestlerIds: string[];
  grossValue: number;
  discountedValue: number;
  discountAmount: number;
};

export const tvReadyDraftRosterTarget = 12;
export const recommendedDraftRosterTarget = 16;

export const draftSortOptions: { label: string; value: DraftSort }[] = [
  { label: "Top 200 Rank", value: "rank" },
  { label: "Star Power", value: "starPower" },
  { label: "Popularity", value: "popularity" },
  { label: "Momentum", value: "momentum" },
  { label: "Ring", value: "ringSkill" },
  { label: "Promo", value: "promoSkill" },
  { label: "Lowest Fatigue", value: "fatigue" },
];

export const draftBrandFilters = ["All Brands", "Raw", "SmackDown", "NXT", "AEW"];
export const draftRoleTierFilters = ["All Tiers", "MainEvent", "UpperCard", "Midcard", "Prospect", "Enhancement"];
export const draftAvailabilityFilters = ["All Status", "Active", "Injured", "Inactive"];
export const draftArchetypeFilters = ["All Styles", "Brawler", "HighFlyer", "Powerhouse", "RingGeneral", "Showman", "Technician"];

export const brandStyleOptions: ChoiceOption<BrandStyle>[] = brandChairs.map((chair) => ({
  label: chair.style,
  description: chair.description,
}));

export const difficultyOptions: ChoiceOption<GameDifficulty>[] = [
  {
    label: "Easy",
    description: "More forgiving first-season pressure while you find your GM rhythm.",
  },
  {
    label: "Medium",
    description: "Balanced GM challenge with enough pressure to make every week matter.",
  },
  {
    label: "Hard",
    description: "Tighter margins and less room for mistakes once the show goes live.",
  },
  {
    label: "Legendary",
    description: "Ruthless expectations for players who want pressure immediately.",
  },
];

export const setupBudgetModeOptions: ChoiceOption<"Money Based" | "Sandbox">[] = [
  {
    label: "Money Based",
    description: "Default $2M opening war chest. Draft and market moves spend real budget.",
  },
  {
    label: "Sandbox",
    description: "Unlimited money for fantasy booking and experimentation.",
  },
];

export const setupDraftModeOptions: ChoiceOption<"Snake Draft" | "Linear Draft" | "Randomized Each Round" | "Weighted Lottery">[] = [
  {
    label: "Snake Draft",
    description: "Brand order reverses every round. Fairest default for a four-chair league.",
  },
  {
    label: "Linear Draft",
    description: "Same brand order every round. The first chair keeps the timing edge.",
  },
  {
    label: "Randomized Each Round",
    description: "Fresh random brand order every round. Chaotic, unpredictable, good for party drafts.",
  },
  {
    label: "Weighted Lottery",
    description: "Early picks weighted toward weaker chairs. Full season weighting arrives in later saves.",
  },
];

export const budgetOptions: ChoiceOption<StartingBudgetTier>[] = [
  {
    label: "$2M",
    description: "Balanced standard war chest for a focused first season.",
  },
  {
    label: "Unlimited",
    description: "Sandbox-style money for fantasy booking and experimentation.",
  },
];

const setupDraftModeLabelByMode: Record<DraftMode, (typeof setupDraftModeOptions)[number]["label"]> = {
  snake: "Snake Draft",
  linear: "Linear Draft",
  random: "Randomized Each Round",
  lottery: "Weighted Lottery",
};

export function getSetupDraftRulesDetail(mode: DraftMode) {
  const label = setupDraftModeLabelByMode[mode];
  return setupDraftModeOptions.find((option) => option.label === label)?.description ?? "";
}

export function getSetupDraftModeLabel(mode: DraftMode) {
  return setupDraftModeLabelByMode[mode];
}

export function selectSetupDraftMode(choice: string): DraftMode {
  switch (choice) {
    case "Linear Draft":
      return "linear";
    case "Randomized Each Round":
      return "random";
    case "Weighted Lottery":
      return "lottery";
    default:
      return "snake";
  }
}

export function formatBudgetTier(tier: StartingBudgetTier) {
  return tier === "Unlimited" ? "Unlimited" : tier;
}

export function getSetupBudgetModeLabel(tier: StartingBudgetTier) {
  return tier === "Unlimited" ? "Sandbox" : "Money Based";
}

export function selectSetupBudgetMode(mode: string) {
  return mode === "Sandbox" ? "Unlimited" : "$2M";
}

export function formatSetupBudgetHeaderReadout(tier: StartingBudgetTier) {
  return tier === "Unlimited" ? "Sandbox" : formatMoney(getStartingBudgetAmount("$2M"));
}

export function formatSetupBudgetRulesReadout(tier: StartingBudgetTier, amount: number) {
  return tier === "Unlimited" ? "Sandbox" : formatStartingBudgetReadout("$2M", getStartingBudgetAmount("$2M"));
}

export function getSetupBudgetRulesDetail(tier: StartingBudgetTier, amount: number) {
  if (tier === "Unlimited") {
    return budgetOptions.find((option) => option.label === "Unlimited")?.description ?? "Unlimited sandbox money.";
  }

  return `$2M default opening war chest. ${budgetOptions.find((option) => option.label === "$2M")?.description ?? ""}`.trim();
}

export function formatStartingBudgetReadout(tier: StartingBudgetTier, amount: number) {
  return tier === "Unlimited" ? "Unlimited" : formatMoney(amount);
}

export function formatStartingBudgetDetail(tier: StartingBudgetTier, amount: number, description: string) {
  return tier === "Unlimited" ? `${description} Sandbox reference: ${formatMoney(amount)}.` : `${formatBudgetTier(tier)} opening money. ${description}`;
}

export function getDraftFinanceReadout(wrestlers: Wrestler[], startingBudgetTier: StartingBudgetTier, startingBudgetAmount: number, bundleDiscountUsd = 0): DraftFinanceReadout {
  const financeRows = wrestlers.map((wrestler) => ({
    financeRow: getRosterFinanceValueForWrestler(wrestler),
    wrestler,
  }));
  const grossRosterValue = getDraftedRosterValue(wrestlers);
  const rosterValue = Math.max(0, grossRosterValue - bundleDiscountUsd);
  const projectedReserve = startingBudgetAmount - rosterValue;
  const isUnlimitedBudget = startingBudgetTier === "Unlimited";
  const recommendedReserveTarget = startingBudgetTier === "$2M" ? 450000 : Math.max(250000, Math.round(startingBudgetAmount * 0.15));
  const pressureLabel: DraftReservePressure = isUnlimitedBudget
    ? "Healthy"
    : projectedReserve < 0
      ? "Over Budget"
      : projectedReserve < recommendedReserveTarget
        ? "Tight"
        : "Healthy";

  return {
    bundleDiscountUsd,
    grossRosterValue,
    isUnlimitedBudget,
    missingFinanceRows: financeRows.filter(({ financeRow }) => !financeRow).map(({ wrestler }) => wrestler),
    pressureLabel,
    projectedReserve,
    recommendedReserveTarget,
    rosterValue,
    startingBudgetAmount,
  };
}

export function getDraftBundleOffers(availableWrestlers: Wrestler[]): DraftBundleOffer[] {
  const availableById = new Map(availableWrestlers.map((wrestler) => [wrestler.id, wrestler]));

  return affiliationCatalog
    .filter((affiliation) => affiliation.kind === "tag_team" || affiliation.kind === "faction")
    .flatMap((affiliation) => {
      const eligibleMemberIds = affiliation.memberWrestlerIds.filter((id) => draftPool.some((wrestler) => wrestler.id === id));
      const wrestlers = eligibleMemberIds
        .map((id) => availableById.get(id))
        .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

      if (wrestlers.length < 2 || wrestlers.length !== eligibleMemberIds.length) {
        return [];
      }

      const grossValue = getDraftedRosterValue(wrestlers);
      const discountedValue = Math.round(grossValue * 0.8);
      const kind: DraftBundleOffer["kind"] = affiliation.kind === "tag_team" ? "tag_team" : "faction";

      return [
        {
          affiliationId: affiliation.id,
          affiliationName: affiliation.name,
          kind,
          wrestlers,
          wrestlerIds: wrestlers.map((wrestler) => wrestler.id),
          grossValue,
          discountedValue,
          discountAmount: grossValue - discountedValue,
        },
      ];
    })
    .sort((a, b) => b.discountAmount - a.discountAmount || a.affiliationName.localeCompare(b.affiliationName));
}

export function formatProjectedReserve(readout: DraftFinanceReadout) {
  return readout.isUnlimitedBudget ? "Unlimited" : formatMoney(readout.projectedReserve);
}

export function getDraftFinanceNote(readout: DraftFinanceReadout) {
  const missingValueNote = readout.missingFinanceRows.length
    ? ` ${readout.missingFinanceRows.length} roster value${readout.missingFinanceRows.length === 1 ? "" : "s"} pending and excluded from this total.`
    : "";

  return `Opening reserve after roster value is carried into Week 1. ${tvReadyDraftRosterTarget} wrestlers is TV-ready guidance; ${recommendedDraftRosterTarget} is the healthy roster target. Aim for about ${formatMoney(readout.recommendedReserveTarget)} left for production and market flexibility.${missingValueNote}`;
}

export function getRivalUniverseRead(rivalBrands: RivalBrandState[]) {
  if (!rivalBrands.length) {
    return "No rival brand chairs are assigned for this career frame.";
  }

  const rosterCount = rivalBrands.reduce((sum, brand) => sum + brand.rosterWrestlerIds.length, 0);
  const activityCount = rivalBrands.reduce((sum, brand) => sum + brand.activityHistory.length, 0);

  return `${rivalBrands.length} rival brand chair${rivalBrands.length === 1 ? "" : "s"} active in the ratings race. ${rosterCount} CPU roster claim${rosterCount === 1 ? "" : "s"} and ${activityCount} activity beat${activityCount === 1 ? "" : "s"} are logged as competitive context.`;
}

export function getDraftSortValue(wrestler: Wrestler, sort: DraftSort) {
  if (sort === "rank") {
    return -(wrestler.draftRank ?? 999);
  }

  if (sort === "starPower") {
    return wrestler.popularity + wrestler.momentum;
  }

  if (sort === "fatigue") {
    return -wrestler.fatigue;
  }

  return wrestler[sort];
}

export function getDraftSearchText(wrestler: Wrestler) {
  const identity = getWrestlerIdentityContext(wrestler);

  return [
    wrestler.name,
    wrestler.sourceBrand,
    wrestler.sourceAvailability,
    wrestler.roleTier,
    identity.role,
    wrestler.alignment,
    identity.wrestlingStyle,
    identity.promoStyle,
    wrestler.archetype,
    wrestler.division,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getDraftTag(value: string | undefined, fallback = "Unlisted") {
  return value?.trim() || fallback;
}

export function getDraftProspectNameClass(name: string) {
  const length = name.trim().length;

  if (length > 18) {
    return "is-xlong";
  }

  if (length > 14) {
    return "is-long";
  }

  return "";
}

function getDraftRosterGenderCounts(roster: Wrestler[]) {
  return roster.reduce(
    (counts, wrestler) => {
      const group = getWrestlerDivisionGroup(wrestler);

      if (group === "mens") {
        counts.men += 1;
      } else if (group === "womens") {
        counts.women += 1;
      }

      return counts;
    },
    { men: 0, women: 0 },
  );
}

export function formatDraftGenderReadout(roster: Wrestler[]) {
  const { men, women } = getDraftRosterGenderCounts(roster);
  return `${men} men · ${women} women`;
}

export function getWrestlerOverall(wrestler: Wrestler) {
  return Math.max(
    40,
    Math.min(
      99,
      Math.round(
        wrestler.popularity * 0.24 +
          wrestler.momentum * 0.22 +
          wrestler.ringSkill * 0.18 +
          wrestler.promoSkill * 0.16 +
          wrestler.morale * 0.12 +
          (100 - wrestler.fatigue) * 0.08,
      ),
    ),
  );
}
