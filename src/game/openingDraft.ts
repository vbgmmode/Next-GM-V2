import { getDraftRoundOrder } from "./draftOrder";
import type { DraftMode, RivalBrandState, Wrestler } from "./types";

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
  rostersByChairId: Record<string, Wrestler[]>;
  availableCount: number;
};

export type SimulateOpeningDraftOptions = {
  draftMode: DraftMode;
  draftSeed: string;
  draftPool: Wrestler[];
  playerBrandName: string;
  rivalBrands: RivalBrandState[];
  playerDraftedWrestlers: Pick<Wrestler, "id">[];
  playerPickTarget?: number;
  cpuPickTarget?: number;
  playerChairId?: string;
  lotteryWeightsByChairId?: Record<string, number>;
};

const defaultPlayerChairId = "player";
const defaultPickTarget = 12;

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

function scoreCpuDraftCandidate(chair: OpeningDraftChair, wrestler: Wrestler, roster: Wrestler[], round: number) {
  const rankScore = wrestler.draftRank ? Math.max(0, 220 - wrestler.draftRank) : 80;
  const sourceBrandBonus = wrestler.sourceBrand === chair.rivalBrand?.brandKey ? 10 : 0;
  const style = chair.rivalBrand?.assignedGMStyle ?? "";
  const roundNoise = hashString(`${chair.id}-${wrestler.id}-${round}`) % 9;

  return (
    rankScore +
    wrestler.popularity * 0.46 +
    Math.max(wrestler.ringSkill, wrestler.promoSkill) * 0.34 +
    getStyleDraftBonus(style, wrestler) +
    getDivisionNeedBonus(roster, wrestler) +
    sourceBrandBonus +
    roundNoise
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
  const roundOrder = getDraftRoundOrder(mode, chairs, roundIndex, seed);

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
  available: Map<string, Wrestler>,
  mode: DraftMode,
  seed: string,
  playerChairId: string,
): OpeningDraftState {
  const playerPicks = events.filter((event) => event.chair.kind === "player");
  const cpuPicks = events.filter((event) => event.chair.kind === "cpu");
  const rosterRecord = Object.fromEntries(chairs.map((chair) => [chair.id, rostersByChairId.get(chair.id) ?? []]));

  return {
    chairs,
    events,
    currentPick,
    upcomingPicks: currentPick ? getUpcomingPicks(chairs, mode, currentPick.roundIndex, currentPick.pickInRound, seed, playerChairId) : [],
    playerPicks,
    cpuPicks,
    cpuClaimedWrestlerIds: cpuPicks.map((event) => event.wrestler.id),
    draftedWrestlerIds: events.map((event) => event.wrestler.id),
    rostersByChairId: rosterRecord,
    availableCount: available.size,
  };
}

export function simulateOpeningDraft({
  draftMode,
  draftSeed,
  draftPool,
  playerBrandName,
  rivalBrands,
  playerDraftedWrestlers,
  playerPickTarget = defaultPickTarget,
  cpuPickTarget = defaultPickTarget,
  playerChairId = defaultPlayerChairId,
  lotteryWeightsByChairId = {},
}: SimulateOpeningDraftOptions): OpeningDraftState {
  const chairs = createOpeningDraftChairs(playerBrandName, rivalBrands, playerChairId, lotteryWeightsByChairId);
  const available = new Map(draftPool.map((wrestler) => [wrestler.id, wrestler]));
  const rostersByChairId = new Map<string, Wrestler[]>(chairs.map((chair) => [chair.id, []]));
  const events: OpeningDraftPickEvent[] = [];
  let playerPickIndex = 0;

  rivalBrands.forEach((brand) => {
    const roster = brand.rosterWrestlerIds.map((id) => available.get(id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
    rostersByChairId.set(brand.id, roster);
    roster.forEach((wrestler) => available.delete(wrestler.id));
  });

  for (let roundIndex = 0; roundIndex < playerPickTarget; roundIndex += 1) {
    const roundOrder = getOpeningDraftRoundOrder(draftMode, chairs, roundIndex, draftSeed, playerChairId);

    for (let pickInRound = 0; pickInRound < roundOrder.length; pickInRound += 1) {
      const chair = roundOrder[pickInRound];
      const clockPick: OpeningDraftClockPick = {
        roundIndex,
        pickInRound,
        overallPick: roundIndex * chairs.length + pickInRound + 1,
        chair,
      };

      if (chair.kind === "player") {
        if (playerPickIndex >= playerDraftedWrestlers.length) {
          return createState(chairs, events, clockPick, rostersByChairId, available, draftMode, draftSeed, playerChairId);
        }

        const requestedPick = playerDraftedWrestlers[playerPickIndex];
        const wrestler = available.get(requestedPick.id);

        if (!wrestler) {
          return createState(chairs, events, clockPick, rostersByChairId, available, draftMode, draftSeed, playerChairId);
        }

        available.delete(wrestler.id);
        rostersByChairId.set(chair.id, [...(rostersByChairId.get(chair.id) ?? []), wrestler]);
        events.push({ ...clockPick, wrestler });
        playerPickIndex += 1;
        continue;
      }

      const roster = rostersByChairId.get(chair.id) ?? [];

      if (roster.length >= cpuPickTarget || !available.size) {
        continue;
      }

      const wrestler = [...available.values()].sort(
        (left, right) =>
          scoreCpuDraftCandidate(chair, right, roster, roundIndex) -
            scoreCpuDraftCandidate(chair, left, roster, roundIndex) ||
          (left.draftRank ?? 999) - (right.draftRank ?? 999),
      )[0];

      if (!wrestler) {
        continue;
      }

      available.delete(wrestler.id);
      rostersByChairId.set(chair.id, [...roster, wrestler]);
      events.push({ ...clockPick, wrestler });
    }
  }

  return createState(chairs, events, undefined, rostersByChairId, available, draftMode, draftSeed, playerChairId);
}
