import { getDraftRoundOrder } from "./draftOrder";
import { getDifficultyRules, type DifficultyRules } from "./difficultyRules";
import { getRosterFinanceValueForWrestler } from "./financeCatalog";
import type { DraftMode, GameDifficulty, RivalBrandState, Wrestler } from "./types";

export type OpeningDraftChairKind = "player" | "cpu";

export type OpeningDraftChair = {
  id: string;
  kind: OpeningDraftChairKind;
  brandName: string;
  lotteryWeight?: number;
  rivalBrand?: RivalBrandState;
};

export type OpeningDraftClockPick = {
  roundIndex: number;
  pickInRound: number;
  overallPick: number;
  chair: OpeningDraftChair;
};

export type OpeningDraftPickEvent = OpeningDraftClockPick & {
  wrestler: Wrestler;
};

export type OpeningDraftState = {
  chairs: OpeningDraftChair[];
  events: OpeningDraftPickEvent[];
  currentPick?: OpeningDraftClockPick;
  upcomingPicks: OpeningDraftClockPick[];
  playerPicks: OpeningDraftPickEvent[];
  cpuPicks: OpeningDraftPickEvent[];
  cpuClaimedWrestlerIds: string[];
  draftedWrestlerIds: string[];
  remainingBudgetByChairId: Record<string, number>;
  rostersByChairId: Record<string, Wrestler[]>;
  spentByChairId: Record<string, number>;
  availableCount: number;
};

export type SimulateOpeningDraftOptions = {
  draftMode: DraftMode;
  difficulty?: GameDifficulty;
  draftSeed: string;
  draftPool: Wrestler[];
  playerBrandName: string;
  rivalBrands: RivalBrandState[];
  playerDraftedWrestlers: Pick<Wrestler, "id">[];
  playerDraftGroups?: string[][];
  finalizeCpuDraft?: boolean;
  playerPickTarget?: number;
  cpuPickTarget?: number;
  playerChairId?: string;
  lotteryWeightsByChairId?: Record<string, number>;
};

const defaultPlayerChairId = "player";
const defaultPickTarget = 12;

function getDraftCost(wrestler: Wrestler) {
  return getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function getStyleDraftBonus(style: string, wrestler: Wrestler) {
  switch (style) {
    case "Ratings Chaser":
      return wrestler.popularity * 0.34 + wrestler.momentum * 0.2;
    case "Talent Developer":
      return (wrestler.roleTier === "Prospect" ? 18 : 0) + wrestler.ringSkill * 0.22;
    case "Locker Room General":
      return wrestler.morale * 0.24 + (100 - wrestler.fatigue) * 0.18;
    case "Chaos Booker":
      return wrestler.momentum * 0.34 + (wrestler.archetype === "Brawler" ? 12 : 0);
    case "Sports Realist":
      return wrestler.ringSkill * 0.36 + (100 - wrestler.fatigue) * 0.16;
    case "Big Money Promoter":
      return wrestler.popularity * 0.42 + wrestler.promoSkill * 0.18;
    default:
      return wrestler.popularity * 0.24 + wrestler.ringSkill * 0.18 + wrestler.promoSkill * 0.16;
  }
}

function getDivisionNeedBonus(roster: Wrestler[], wrestler: Wrestler) {
  const sameDivisionCount = roster.filter((item) => item.division === wrestler.division).length;
  const targetBalanceBonus = sameDivisionCount <= 3 ? 12 : sameDivisionCount <= 5 ? 4 : -8;
  const tierBonus = roster.filter((item) => item.roleTier === wrestler.roleTier).length <= 2 ? 5 : 0;

  return targetBalanceBonus + tierBonus;
}

function scoreCpuDraftCandidate(chair: OpeningDraftChair, wrestler: Wrestler, roster: Wrestler[], round: number, rules: DifficultyRules) {
  const rankScore = wrestler.draftRank ? Math.max(0, 220 - wrestler.draftRank) : 80;
  const sourceBrandBonus = wrestler.sourceBrand === chair.rivalBrand?.brandKey ? 10 : 0;
  const style = chair.rivalBrand?.assignedGMStyle ?? "";
  const roundNoise = hashString(`${chair.id}-${wrestler.id}-${round}`) % 9;
  const talentScore =
    rankScore +
    wrestler.popularity * 0.46 +
    Math.max(wrestler.ringSkill, wrestler.promoSkill) * 0.34 +
    sourceBrandBonus;
  const draftCost = getDraftCost(wrestler);
  const valueScore = Math.max(0, 180000 - draftCost) / 4500;

  return (
    talentScore * rules.cpuDraft.talentWeight +
    getStyleDraftBonus(style, wrestler) * rules.cpuDraft.styleWeight +
    getDivisionNeedBonus(roster, wrestler) * rules.cpuDraft.rosterNeedWeight +
    valueScore * rules.cpuDraft.valueWeight +
    roundNoise * rules.cpuDraft.noiseWeight
  );
}

export function createOpeningDraftChairs(
  playerBrandName: string,
  rivalBrands: RivalBrandState[],
  playerChairId = defaultPlayerChairId,
  lotteryWeightsByChairId: Record<string, number> = {},
): OpeningDraftChair[] {
  return [
    {
      id: playerChairId,
      kind: "player",
      brandName: playerBrandName,
      lotteryWeight: lotteryWeightsByChairId[playerChairId] ?? 1,
    },
    ...rivalBrands.map((brand) => ({
      id: brand.id,
      kind: "cpu" as const,
      brandName: brand.brandName,
      lotteryWeight: lotteryWeightsByChairId[brand.id] ?? 1,
      rivalBrand: brand,
    })),
  ];
}

export function getOpeningDraftRoundOrder(
  mode: DraftMode,
  chairs: OpeningDraftChair[],
  roundIndex: number,
  seed: string,
  playerChairId = defaultPlayerChairId,
) {
  const roundOrder = getDraftRoundOrder(mode, chairs, roundIndex, seed) as OpeningDraftChair[];

  if (roundIndex !== 0) {
    return roundOrder;
  }

  const playerChair = roundOrder.find((chair) => chair.id === playerChairId);

  if (!playerChair) {
    return roundOrder;
  }

  return [playerChair, ...roundOrder.filter((chair) => chair.id !== playerChairId)];
}

function getClockPick(chairs: OpeningDraftChair[], mode: DraftMode, roundIndex: number, pickInRound: number, seed: string, playerChairId: string): OpeningDraftClockPick | undefined {
  const roundOrder = getOpeningDraftRoundOrder(mode, chairs, roundIndex, seed, playerChairId);
  const chair = roundOrder[pickInRound];

  if (!chair) {
    return undefined;
  }

  return {
    roundIndex,
    pickInRound,
    overallPick: roundIndex * chairs.length + pickInRound + 1,
    chair,
  };
}

function getUpcomingPicks(
  chairs: OpeningDraftChair[],
  mode: DraftMode,
  startRoundIndex: number,
  startPickInRound: number,
  seed: string,
  playerChairId: string,
  maxPicks = 8,
): OpeningDraftClockPick[] {
  const picks: OpeningDraftClockPick[] = [];
  let roundIndex = startRoundIndex;
  let pickInRound = startPickInRound;

  while (picks.length < maxPicks) {
    const pick = getClockPick(chairs, mode, roundIndex, pickInRound, seed, playerChairId);

    if (pick) {
      picks.push(pick);
    }

    pickInRound += 1;

    if (pickInRound >= chairs.length) {
      roundIndex += 1;
      pickInRound = 0;
    }
  }

  return picks;
}

function createState(
  chairs: OpeningDraftChair[],
  events: OpeningDraftPickEvent[],
  currentPick: OpeningDraftClockPick | undefined,
  rostersByChairId: Map<string, Wrestler[]>,
  remainingBudgetByChairId: Map<string, number>,
  spentByChairId: Map<string, number>,
  available: Map<string, Wrestler>,
  mode: DraftMode,
  seed: string,
  playerChairId: string,
): OpeningDraftState {
  const playerPicks = events.filter((event) => event.chair.kind === "player");
  const cpuPicks = events.filter((event) => event.chair.kind === "cpu");
  const rosterRecord = Object.fromEntries(chairs.map((chair) => [chair.id, rostersByChairId.get(chair.id) ?? []]));
  const remainingBudgetRecord = Object.fromEntries(chairs.map((chair) => [chair.id, remainingBudgetByChairId.get(chair.id) ?? 0]));
  const spentRecord = Object.fromEntries(chairs.map((chair) => [chair.id, spentByChairId.get(chair.id) ?? 0]));

  return {
    chairs,
    events,
    currentPick,
    upcomingPicks: currentPick ? getUpcomingPicks(chairs, mode, currentPick.roundIndex, currentPick.pickInRound, seed, playerChairId) : [],
    playerPicks,
    cpuPicks,
    cpuClaimedWrestlerIds: cpuPicks.map((event) => event.wrestler.id),
    draftedWrestlerIds: events.map((event) => event.wrestler.id),
    remainingBudgetByChairId: remainingBudgetRecord,
    rostersByChairId: rosterRecord,
    spentByChairId: spentRecord,
    availableCount: available.size,
  };
}

export function simulateOpeningDraft({
  draftMode,
  difficulty = "Medium",
  draftSeed,
  draftPool,
  playerBrandName,
  rivalBrands,
  playerDraftedWrestlers,
  playerDraftGroups,
  finalizeCpuDraft = false,
  playerPickTarget = defaultPickTarget,
  cpuPickTarget,
  playerChairId = defaultPlayerChairId,
  lotteryWeightsByChairId = {},
}: SimulateOpeningDraftOptions): OpeningDraftState {
  const rules = getDifficultyRules(difficulty);
  const chairs = createOpeningDraftChairs(playerBrandName, rivalBrands, playerChairId, lotteryWeightsByChairId);
  const available = new Map(draftPool.map((wrestler) => [wrestler.id, wrestler]));
  const normalizedPlayerDraftGroups = playerDraftGroups?.length
    ? playerDraftGroups.map((group) => [...new Set(group)].filter(Boolean)).filter((group) => group.length)
    : playerDraftedWrestlers.map((wrestler) => [wrestler.id]);
  const reservedPlayerIds = new Set(normalizedPlayerDraftGroups.flat());
  const rostersByChairId = new Map<string, Wrestler[]>(chairs.map((chair) => [chair.id, []]));
  const remainingBudgetByChairId = new Map<string, number>(chairs.map((chair) => [chair.id, chair.rivalBrand?.budget ?? 0]));
  const spentByChairId = new Map<string, number>(chairs.map((chair) => [chair.id, 0]));
  const events: OpeningDraftPickEvent[] = [];
  let playerPickIndex = 0;
  const maxRoundCount = Math.max(playerPickTarget, draftPool.length);

  rivalBrands.forEach((brand) => {
    const roster = brand.rosterWrestlerIds.map((id) => available.get(id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
    rostersByChairId.set(brand.id, roster);
    const existingSpend = roster.reduce((sum, wrestler) => sum + getDraftCost(wrestler), 0);

    spentByChairId.set(brand.id, existingSpend);
    remainingBudgetByChairId.set(brand.id, Math.max(0, (brand.budget ?? 0) - existingSpend));
    roster.forEach((wrestler) => available.delete(wrestler.id));
  });

  for (let roundIndex = 0; roundIndex < maxRoundCount; roundIndex += 1) {
    const roundOrder = getOpeningDraftRoundOrder(draftMode, chairs, roundIndex, draftSeed, playerChairId);
    let cpuPickedThisRound = false;

    for (let pickInRound = 0; pickInRound < roundOrder.length; pickInRound += 1) {
      const chair = roundOrder[pickInRound];
      const clockPick: OpeningDraftClockPick = {
        roundIndex,
        pickInRound,
        overallPick: roundIndex * chairs.length + pickInRound + 1,
        chair,
      };

      if (chair.kind === "player") {
        if (playerPickIndex >= normalizedPlayerDraftGroups.length) {
          if (finalizeCpuDraft) {
            continue;
          }

          return createState(chairs, events, clockPick, rostersByChairId, remainingBudgetByChairId, spentByChairId, available, draftMode, draftSeed, playerChairId);
        }

        const requestedGroup = normalizedPlayerDraftGroups[playerPickIndex];
        const wrestlers = requestedGroup.map((id) => available.get(id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

        if (!wrestlers.length) {
          if (finalizeCpuDraft) {
            playerPickIndex += 1;
            continue;
          }

          return createState(chairs, events, clockPick, rostersByChairId, remainingBudgetByChairId, spentByChairId, available, draftMode, draftSeed, playerChairId);
        }

        wrestlers.forEach((wrestler) => available.delete(wrestler.id));
        rostersByChairId.set(chair.id, [...(rostersByChairId.get(chair.id) ?? []), ...wrestlers]);
        wrestlers.forEach((wrestler) => events.push({ ...clockPick, wrestler }));
        playerPickIndex += 1;
        continue;
      }

      const roster = rostersByChairId.get(chair.id) ?? [];
      const remainingBudget = remainingBudgetByChairId.get(chair.id) ?? 0;

      if ((cpuPickTarget !== undefined && roster.length >= cpuPickTarget) || !available.size || remainingBudget <= 0) {
        continue;
      }

      const wrestler = [...available.values()]
        .filter((candidate) => !reservedPlayerIds.has(candidate.id))
        .filter((candidate) => getDraftCost(candidate) <= remainingBudget)
        .sort(
          (left, right) =>
            scoreCpuDraftCandidate(chair, right, roster, roundIndex, rules) -
              scoreCpuDraftCandidate(chair, left, roster, roundIndex, rules) ||
            (left.draftRank ?? 999) - (right.draftRank ?? 999),
        )[0];

      if (!wrestler) {
        continue;
      }

      const draftCost = getDraftCost(wrestler);

      available.delete(wrestler.id);
      rostersByChairId.set(chair.id, [...roster, wrestler]);
      remainingBudgetByChairId.set(chair.id, Math.max(0, remainingBudget - draftCost));
      spentByChairId.set(chair.id, (spentByChairId.get(chair.id) ?? 0) + draftCost);
      events.push({ ...clockPick, wrestler });
      cpuPickedThisRound = true;
    }

    if (finalizeCpuDraft && !cpuPickedThisRound && playerPickIndex >= normalizedPlayerDraftGroups.length) {
      break;
    }
  }

  return createState(chairs, events, undefined, rostersByChairId, remainingBudgetByChairId, spentByChairId, available, draftMode, draftSeed, playerChairId);
}
