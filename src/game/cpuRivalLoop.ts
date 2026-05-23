import type {
  CpuChampionshipState,
  CpuFinanceReport,
  CpuRivalryState,
  CpuRosterMemberState,
  CpuSegmentResult,
  CpuSeasonObjective,
  DraftMode,
  GameState,
  InjuryStatus,
  RivalBrandState,
  RivalBrandTrend,
  RivalBrandWeeklyResult,
  RivalryStakes,
  RivalryStatus,
  SegmentType,
  ShowResult,
  ShowType,
  Wrestler,
} from "./types";
import { createMarketContract, getCpuBudgetDefault } from "./market";
import { simulateOpeningDraft } from "./openingDraft";

const cpuDraftPicksPerBrand = 12;
const cpuStartingMoney = 1800000;

export type CpuDraftPreviewNote = {
  id: string;
  brandName: string;
  gmName: string;
  label: string;
  detail: string;
  tone: "quiet" | "watch" | "aggressive" | "burst";
};

export type CpuDraftPreviewSnapshot = {
  headline: string;
  detail: string;
  tone: "quiet" | "watch" | "aggressive" | "burst";
  notes: CpuDraftPreviewNote[];
  claimedWrestlerIds: string[];
};

export type RatingsBattleEntry = {
  id: string;
  brandName: string;
  gmName: string;
  latestScore?: number;
  seasonAverage: number;
  rank: number;
  trend: RivalBrandTrend;
  note: string;
  isPlayer: boolean;
};

export type RatingsBattleSnapshot = {
  headline: string;
  detail: string;
  playerRank: number;
  playerDelta: number;
  leaderName: string;
  latestWeekLabel: string;
  entries: RatingsBattleEntry[];
};

export type CpuResultsFeedItem = {
  id: string;
  brandName: string;
  headline: string;
  score?: number;
  grade?: string;
  detail: string;
  segments: CpuSegmentResult[];
  notes: string[];
  tone: "strong" | "steady" | "watch";
};

export type CpuResultsFeedSnapshot = {
  headline: string;
  detail: string;
  items: CpuResultsFeedItem[];
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getShowGrade(score: number) {
  if (score >= 90) {
    return "A";
  }

  if (score >= 80) {
    return "B";
  }

  if (score >= 70) {
    return "C";
  }

  if (score >= 60) {
    return "D";
  }

  return "F";
}

function findWrestler(id: string, pool: Wrestler[]) {
  return pool.find((wrestler) => wrestler.id === id);
}

function getWrestlerName(id: string, pool: Wrestler[]) {
  return findWrestler(id, pool)?.name ?? "Unknown";
}

function getRosterAverage(roster: Wrestler[], score: (wrestler: Wrestler) => number, fallback: number) {
  return roster.length ? roster.reduce((sum, wrestler) => sum + score(wrestler), 0) / roster.length : fallback;
}

function getTrendFromScores(currentScore: number, previousScore?: number): RivalBrandTrend {
  if (previousScore === undefined) {
    return "steady";
  }

  if (currentScore >= previousScore + 5) {
    return "surging";
  }

  if (currentScore <= previousScore - 5) {
    return "slipping";
  }

  return "steady";
}

function getSeasonAverage(results: RivalBrandWeeklyResult[]) {
  return results.length ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length) : 0;
}

function rankScores(entries: { id: string; score: number }[]) {
  const ranks = new Map<string, number>();

  [...entries]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .forEach((entry, index) => ranks.set(entry.id, index + 1));

  return ranks;
}

function createCpuRosterMember(wrestler: Wrestler, seasonNumber: number, weekNumber: number, acquisitionSource: CpuRosterMemberState["acquisitionSource"]): CpuRosterMemberState {
  return {
    wrestlerId: wrestler.id,
    acquisitionSource,
    acquiredSeasonNumber: seasonNumber,
    acquiredWeekNumber: weekNumber,
    momentum: wrestler.momentum,
    morale: wrestler.morale,
    fatigue: wrestler.fatigue,
    appearancesThisSeason: 0,
    lastBookedWeek: 0,
    consecutiveWeeksBooked: 0,
    injuryStatus: "healthy",
    injuryWeeksRemaining: 0,
  };
}

function syncCpuContracts(brand: RivalBrandState, draftPool: Wrestler[]) {
  const existingByWrestlerId = new Map(brand.contracts.map((contract) => [contract.wrestlerId, contract]));
  return brand.rosterWrestlerIds
    .map((id) => {
      const wrestler = findWrestler(id, draftPool);
      const existing = existingByWrestlerId.get(id);

      return existing ?? (wrestler ? createMarketContract(wrestler, "rival", brand.id, "draft") : undefined);
    })
    .filter((contract): contract is RivalBrandState["contracts"][number] => Boolean(contract));
}

function syncCpuRosterState(brand: RivalBrandState, draftPool: Wrestler[], seasonNumber: number) {
  const existingById = new Map(brand.rosterState.map((member) => [member.wrestlerId, member]));
  return brand.rosterWrestlerIds
    .map((id) => {
      const wrestler = findWrestler(id, draftPool);
      const existing = existingById.get(id);

      if (existing) {
        return existing;
      }

      return wrestler ? createCpuRosterMember(wrestler, seasonNumber, 1, "draft") : undefined;
    })
    .filter((member): member is CpuRosterMemberState => Boolean(member));
}

function getCpuRosterWrestlers(brand: RivalBrandState, draftPool: Wrestler[]) {
  return brand.rosterWrestlerIds.map((id) => findWrestler(id, draftPool)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function getMember(brand: RivalBrandState, wrestlerId: string) {
  return brand.rosterState.find((member) => member.wrestlerId === wrestlerId);
}

function getAvailableCpuRoster(brand: RivalBrandState, draftPool: Wrestler[]) {
  return getCpuRosterWrestlers(brand, draftPool).filter((wrestler) => getMember(brand, wrestler.id)?.injuryStatus !== "major");
}

function createCpuChampionships(brand: RivalBrandState, draftPool: Wrestler[]): CpuChampionshipState[] {
  const roster = getCpuRosterWrestlers(brand, draftPool);
  const mensChampion = roster.find((wrestler) => wrestler.division === "Mens") ?? roster[0];
  const womensChampion = roster.find((wrestler) => wrestler.division === "Womens") ?? roster[1] ?? roster[0];

  return [
    {
      id: `${brand.id}-world-title`,
      name: `${brand.brandName} World Championship`,
      division: "Mens",
      championIds: mensChampion ? [mensChampion.id] : [],
      prestige: 82,
      defenses: 0,
      reignStartWeek: 1,
    },
    {
      id: `${brand.id}-womens-title`,
      name: `${brand.brandName} Women's Championship`,
      division: "Womens",
      championIds: womensChampion ? [womensChampion.id] : [],
      prestige: 78,
      defenses: 0,
      reignStartWeek: 1,
    },
  ];
}

function createCpuRivalries(brand: RivalBrandState, draftPool: Wrestler[]): CpuRivalryState[] {
  const roster = getCpuRosterWrestlers(brand, draftPool);
  const sorted = [...roster].sort((a, b) => b.popularity + b.momentum - (a.popularity + a.momentum));
  const first = sorted[0];
  const second = sorted.find((wrestler) => wrestler.id !== first?.id && wrestler.division === first?.division) ?? sorted[1];

  if (!first || !second) {
    return [];
  }

  return [
    {
      id: `${brand.id}-rivalry-1`,
      name: `${first.name} vs ${second.name}`,
      participantIds: [first.id, second.id],
      heat: 58,
      freshness: 70,
      weeksActive: 1,
      lastAdvancedWeek: 0,
      status: "rising",
      stakes: "respect",
    },
  ];
}

function createCpuObjectives(brand: RivalBrandState): CpuSeasonObjective[] {
  return [
    {
      id: `${brand.id}-ratings-top-two`,
      label: "Finish Top 2 In Ratings",
      target: 2,
      current: brand.seasonRank || 0,
      status: "on_track",
      note: "CPU rival objective tracks season standings pressure.",
    },
    {
      id: `${brand.id}-premium-show`,
      label: "Deliver An 85+ Show",
      target: 85,
      current: 0,
      status: "at_risk",
      note: "No premium rival show logged yet.",
    },
  ];
}

function ensureCpuBrandDepth(brand: RivalBrandState, draftPool: Wrestler[], seasonNumber: number): RivalBrandState {
  const withRosterState: RivalBrandState = {
    ...brand,
    budget: brand.budget || getCpuBudgetDefault(),
    contracts: syncCpuContracts(brand, draftPool),
    marketTransactions: brand.marketTransactions ?? [],
    rosterState: syncCpuRosterState(brand, draftPool, seasonNumber),
  };
  const withContractIds = {
    ...withRosterState,
    rosterState: withRosterState.rosterState.map((member) => ({
      ...member,
      contractId: member.contractId ?? withRosterState.contracts.find((contract) => contract.wrestlerId === member.wrestlerId)?.id,
    })),
  };
  const withChampionships = withContractIds.championships.length
    ? withContractIds
    : { ...withContractIds, championships: createCpuChampionships(withContractIds, draftPool) };
  const withRivalries = withChampionships.rivalries.length
    ? withChampionships
    : { ...withChampionships, rivalries: createCpuRivalries(withChampionships, draftPool) };

  return withRivalries.seasonObjectives.length ? withRivalries : { ...withRivalries, seasonObjectives: createCpuObjectives(withRivalries) };
}

export function allocateCpuDraftRosters(
  rivalBrands: RivalBrandState[],
  playerDraftedWrestlers: Pick<Wrestler, "id">[],
  draftPool: Wrestler[],
  cpuPickCount = cpuDraftPicksPerBrand,
  draftMode: DraftMode = "snake",
  draftSeed = "next-gm-draft",
  playerBrandName = "Player Brand",
): RivalBrandState[] {
  const draftState = simulateOpeningDraft({
    draftMode,
    draftSeed,
    draftPool,
    playerBrandName,
    rivalBrands,
    playerDraftedWrestlers,
    cpuPickTarget: cpuPickCount,
  });

  const nextBrands = rivalBrands.map((brand) => {
    const draftedRoster = draftState.rostersByChairId[brand.id] ?? [];
    const existingById = new Map(brand.rosterState.map((member) => [member.wrestlerId, member]));
    const rosterState = draftedRoster.map((wrestler) => existingById.get(wrestler.id) ?? createCpuRosterMember(wrestler, 1, 1, "draft"));

    return {
      ...brand,
      rosterWrestlerIds: draftedRoster.map((wrestler) => wrestler.id),
      rosterState,
    };
  });

  return nextBrands.map((brand) => ensureCpuBrandDepth(brand, draftPool, 1));
}

export function getCpuDraftPreviewSnapshot(
  rivalBrands: RivalBrandState[],
  playerDraftedWrestlers: Wrestler[],
  draftPool: Wrestler[],
  draftMode: DraftMode = "snake",
  draftSeed = "next-gm-draft",
): CpuDraftPreviewSnapshot | undefined {
  if (!rivalBrands.length) {
    return undefined;
  }

  const projectedBrands = allocateCpuDraftRosters(
    rivalBrands.map((brand) => ({ ...brand, rosterWrestlerIds: [], rosterState: [], activityHistory: [...brand.activityHistory] })),
    playerDraftedWrestlers,
    draftPool,
    cpuDraftPicksPerBrand,
    draftMode,
    draftSeed,
  );
  const claimedWrestlerIds = projectedBrands.flatMap((brand) => brand.rosterWrestlerIds);
  const claimedCount = claimedWrestlerIds.length;
  const playerPickCount = playerDraftedWrestlers.length;
  const tone: CpuDraftPreviewSnapshot["tone"] =
    playerPickCount >= cpuDraftPicksPerBrand
      ? "burst"
      : playerPickCount >= 9
        ? "aggressive"
        : playerPickCount >= 4
          ? "watch"
          : "quiet";
  const headline =
    playerPickCount === 0
      ? "The Rival Boards Are Waiting"
      : playerPickCount < 4
        ? "CPU Desks Start Their Parallel Boards"
        : playerPickCount < 10
          ? "Rival Rosters Are Taking Shape"
          : "Ratings Race Draft Class Is Nearly Set";
  const detail =
    playerPickCount === 0
      ? "Your first pick starts the parallel rival draft. No CPU claims are committed until the career begins."
      : `${claimedCount} rival claim${claimedCount === 1 ? "" : "s"} are projected from the same Top 200 pool. Undoing your last pick recalculates this board before anything is saved.`;
  const notes = projectedBrands.slice(0, 3).map<CpuDraftPreviewNote>((brand) => {
    const roster = getCpuRosterWrestlers(brand, draftPool);
    const topPick = roster[roster.length - 1] ?? roster[0];
    const rosterLead = roster[0];

    return {
      id: `${brand.id}-cpu-draft-${playerPickCount}`,
      brandName: brand.brandName,
      gmName: brand.assignedGMName,
      label: topPick ? `${topPick.name} Claimed` : "Board Held",
      detail: topPick
        ? `${brand.assignedGMStyle} desk has ${roster.length}/${cpuDraftPicksPerBrand}; class lead is ${rosterLead?.name ?? topPick.name}.`
        : `${brand.assignedGMName}'s desk waits for your first move before making a rival claim.`,
      tone: roster.length >= 10 ? "burst" : roster.length >= 6 ? "aggressive" : roster.length >= 2 ? "watch" : "quiet",
    };
  });

  return {
    headline,
    detail,
    tone,
    notes,
    claimedWrestlerIds,
  };
}

function chooseCpuParticipants(brand: RivalBrandState, draftPool: Wrestler[], seed: string, count = 2, division?: string) {
  const available = getAvailableCpuRoster(brand, draftPool)
    .filter((wrestler) => !division || wrestler.division === division)
    .sort((a, b) => {
      const aMember = getMember(brand, a.id);
      const bMember = getMember(brand, b.id);
      const aScore = a.popularity + a.momentum + Math.max(a.ringSkill, a.promoSkill) - (aMember?.fatigue ?? a.fatigue) * 0.45 + (hashString(`${seed}-${a.id}`) % 9);
      const bScore = b.popularity + b.momentum + Math.max(b.ringSkill, b.promoSkill) - (bMember?.fatigue ?? b.fatigue) * 0.45 + (hashString(`${seed}-${b.id}`) % 9);

      return bScore - aScore;
    });

  return available.slice(0, count);
}

function getCpuSegmentScore(type: SegmentType, participants: Wrestler[], brand: RivalBrandState, seed: string, isPle: boolean) {
  const rosterStateBonus = getRosterAverage(
    participants,
    (wrestler) => {
      const member = getMember(brand, wrestler.id);
      return (member?.momentum ?? wrestler.momentum) * 0.08 + (member?.morale ?? wrestler.morale) * 0.05 - (member?.fatigue ?? wrestler.fatigue) * 0.08;
    },
    0,
  );
  const talentBase = getRosterAverage(participants, (wrestler) => wrestler.popularity * 0.28 + wrestler.ringSkill * 0.2 + wrestler.promoSkill * 0.18, 50);
  const typeBonus = type === "Match" ? 3 : type === "Promo" ? 1 : type === "Contract Signing" ? 2 : 0;
  const styleBonus = brand.assignedGMStyle === "Ratings Chaser" ? 3 : brand.assignedGMStyle === "Chaos Booker" ? 2 : brand.assignedGMStyle === "Talent Developer" ? 1 : 0;
  const variance = (hashString(seed) % 15) - 7;

  return clamp(Math.round(talentBase + rosterStateBonus + typeBonus + styleBonus + (isPle ? 5 : 0) + variance));
}

function getCpuWinnerId(participants: Wrestler[], brand: RivalBrandState, seed: string) {
  return [...participants].sort((a, b) => {
    const aMember = getMember(brand, a.id);
    const bMember = getMember(brand, b.id);
    const aScore = a.popularity + a.ringSkill + (aMember?.momentum ?? a.momentum) + (hashString(`${seed}-winner-${a.id}`) % 8);
    const bScore = b.popularity + b.ringSkill + (bMember?.momentum ?? b.momentum) + (hashString(`${seed}-winner-${b.id}`) % 8);

    return bScore - aScore;
  })[0]?.id;
}

function buildCpuCard(brand: RivalBrandState, draftPool: Wrestler[], playerResult: ShowResult): CpuSegmentResult[] {
  const isPle = playerResult.showType === "ple";
  const segmentCount = isPle ? 6 : 4;
  const segments: CpuSegmentResult[] = [];
  const primaryRivalry = brand.rivalries[0];
  const title = brand.championships[0];

  for (let index = 0; index < segmentCount; index += 1) {
    const isMainEvent = index === segmentCount - 1;
    const isTitleMatch = isMainEvent && Boolean(title?.championIds.length);
    const type: SegmentType = isMainEvent || index === 1 ? "Match" : index === 2 ? "Backstage Angle" : "Promo";
    const division = isTitleMatch ? title?.division : undefined;
    const participants =
      primaryRivalry && index === 1
        ? primaryRivalry.participantIds.map((id) => findWrestler(id, draftPool)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
        : chooseCpuParticipants(brand, draftPool, `${brand.id}-${playerResult.seasonNumber}-${playerResult.week}-${index}`, type === "Backstage Angle" ? 1 : 2, division);
    const safeParticipants = participants.length ? participants : getAvailableCpuRoster(brand, draftPool).slice(0, type === "Backstage Angle" ? 1 : 2);
    const seed = `${brand.id}-${playerResult.seasonNumber}-${playerResult.week}-${type}-${index}`;
    const score = getCpuSegmentScore(type, safeParticipants, brand, seed, isPle);
    const winnerId = type === "Match" ? getCpuWinnerId(safeParticipants, brand, seed) : undefined;

    segments.push({
      id: `${brand.id}-s${playerResult.seasonNumber}-w${playerResult.week}-segment-${index + 1}`,
      type,
      participantIds: safeParticipants.map((wrestler) => wrestler.id),
      participantNames: safeParticipants.map((wrestler) => wrestler.name),
      score,
      winnerId,
      titleId: isTitleMatch ? title?.id : undefined,
      rivalryId: index === 1 ? primaryRivalry?.id : undefined,
      note: isTitleMatch
        ? `${brand.brandName}'s title desk used ${safeParticipants.map((wrestler) => wrestler.name).join(" / ")} as the headline pressure point.`
        : `${brand.assignedGMName}'s ${type.toLowerCase()} block landed at ${score}.`,
    });
  }

  return segments;
}

function resolveCpuTitles(brand: RivalBrandState, segments: CpuSegmentResult[], playerResult: ShowResult, draftPool: Wrestler[]) {
  const titleNotes: string[] = [];
  const championships = brand.championships.map((championship) => {
    const titleSegment = segments.find((segment) => segment.titleId === championship.id && segment.winnerId);

    if (!titleSegment?.winnerId) {
      return championship;
    }

    const championRetained = championship.championIds.includes(titleSegment.winnerId);
    const titleChangeChance = hashString(`${titleSegment.id}-title-change`) % 100;
    const shouldChange = !championRetained && titleSegment.score >= 78 && titleChangeChance >= 58;

    if (shouldChange) {
      titleNotes.push(`${getWrestlerName(titleSegment.winnerId, draftPool)} took the ${championship.name} in CPU results.`);
      return {
        ...championship,
        championIds: [titleSegment.winnerId],
        reignStartWeek: playerResult.week,
        defenses: 0,
      };
    }

    if (championRetained) {
      titleNotes.push(`${championship.name} was defended on ${brand.brandName}'s hidden card.`);
      return { ...championship, defenses: championship.defenses + 1 };
    }

    return championship;
  });

  return { championships, titleNotes };
}

function resolveCpuRivalries(brand: RivalBrandState, segments: CpuSegmentResult[], playerResult: ShowResult): { rivalries: CpuRivalryState[]; rivalryNotes: string[] } {
  const rivalryNotes: string[] = [];
  const rivalries = brand.rivalries.map((rivalry) => {
    const segment = segments.find((item) => item.rivalryId === rivalry.id);
    const heatDelta = segment ? (segment.score >= 82 ? 8 : segment.score >= 68 ? 4 : -3) : -4;
    const freshnessDelta = segment ? (segment.score >= 70 ? 3 : -2) : -3;
    const heat = clamp(rivalry.heat + heatDelta);
    const freshness = clamp(rivalry.freshness + freshnessDelta);
    const status: RivalryStatus = heat >= 78 && freshness >= 45 ? "rising" : heat < 45 || freshness < 30 ? "cooling" : "steady";

    if (segment) {
      rivalryNotes.push(`${rivalry.name} moved through a ${segment.score} CPU segment.`);
    }

    return {
      ...rivalry,
      heat,
      freshness,
      status,
      weeksActive: rivalry.weeksActive + 1,
      lastAdvancedWeek: segment ? playerResult.week : rivalry.lastAdvancedWeek,
    };
  });

  return { rivalries, rivalryNotes };
}

function resolveCpuRosterFallout(brand: RivalBrandState, segments: CpuSegmentResult[], playerResult: ShowResult, draftPool: Wrestler[]) {
  const usedIds = new Set(segments.flatMap((segment) => segment.participantIds));
  const injuryNotes: string[] = [];
  const rosterState: CpuRosterMemberState[] = brand.rosterState.map((member) => {
    if (member.injuryStatus === "major") {
      return member;
    }

    const used = usedIds.has(member.wrestlerId);
    const segmentLoad = segments.filter((segment) => segment.participantIds.includes(member.wrestlerId)).length;
    const fatigue = clamp(member.fatigue + (used ? 8 + segmentLoad * 3 + (playerResult.showType === "ple" ? 3 : 0) : -4));
    const momentum = clamp(member.momentum + (used ? 3 : -1));
    const morale = clamp(member.morale + (used ? 1 : -2));
    const injuryRoll = hashString(`${brand.id}-${member.wrestlerId}-injury-${playerResult.seasonNumber}-${playerResult.week}`) % 100;
    const injuryStatus: InjuryStatus = fatigue >= 78 && injuryRoll > 92 ? "major" : fatigue >= 62 && injuryRoll > 86 ? "minor" : member.injuryStatus;
    const injuryWeeksRemaining = injuryStatus === "major" ? 3 : injuryStatus === "minor" ? Math.max(member.injuryWeeksRemaining, 1) : member.injuryWeeksRemaining;

    if (injuryStatus !== member.injuryStatus && injuryStatus !== "healthy") {
      injuryNotes.push(`${getWrestlerName(member.wrestlerId, draftPool)} picked up a ${injuryStatus} injury on ${brand.brandName}'s card.`);
    }

    return {
      ...member,
      fatigue,
      momentum,
      morale,
      appearancesThisSeason: member.appearancesThisSeason + (used ? 1 : 0),
      lastBookedWeek: used ? playerResult.week : member.lastBookedWeek,
      consecutiveWeeksBooked: used ? member.consecutiveWeeksBooked + 1 : 0,
      injuryStatus,
      injuryDescription: injuryStatus === "major" ? "CPU card injury" : injuryStatus === "minor" ? "CPU workload knock" : member.injuryDescription,
      injuryWeeksRemaining,
    };
  });

  return { rosterState, injuryNotes };
}

function generateCpuFinanceReport(brand: RivalBrandState, result: RivalBrandWeeklyResult, previousMoney: number): CpuFinanceReport {
  const payroll = brand.contracts.filter((contract) => contract.contractStatus === "active" || contract.contractStatus === "expiring").reduce((sum, contract) => sum + contract.weeklySalary, 0);
  const revenue = Math.round(62000 + result.score * 950 + result.segments.length * 4200 + (result.showType === "ple" ? 115000 : 0));
  const expenses = Math.round(54000 + brand.rosterWrestlerIds.length * 3200 + result.segments.length * 3600 + payroll + (result.showType === "ple" ? 98000 : 0));
  const profitLoss = revenue - expenses;

  return {
    id: `${result.id}-finance`,
    seasonNumber: result.seasonNumber,
    weekNumber: result.weekNumber,
    showName: result.showName,
    revenue,
    expenses,
    profitLoss,
    endingMoney: previousMoney + profitLoss,
    note: `${brand.brandName} closed CPU books at ${profitLoss >= 0 ? "+" : ""}${profitLoss.toLocaleString()} after payroll and a ${result.score} show.`,
  };
}

function updateCpuObjectives(brand: RivalBrandState, latestResult: RivalBrandWeeklyResult, seasonRank: number): CpuSeasonObjective[] {
  const bestScore = Math.max(latestResult.score, ...brand.weeklyResults.map((result) => result.score));

  return brand.seasonObjectives.map((objective) => {
    if (objective.id.includes("ratings-top-two")) {
      return {
        ...objective,
        current: seasonRank,
        status: seasonRank <= 2 ? "on_track" : "at_risk",
        note: seasonRank <= 2 ? `${brand.brandName} is inside the top-two ratings lane.` : `${brand.brandName} is chasing the top-two ratings lane.`,
      };
    }

    return {
      ...objective,
      current: bestScore,
      status: bestScore >= objective.target ? "complete" : latestResult.weekNumber >= 10 ? "at_risk" : "on_track",
      note: bestScore >= objective.target ? `${brand.brandName} already delivered an ${objective.target}+ show.` : `${brand.brandName}'s best CPU show is ${bestScore}.`,
    };
  });
}

function getCpuShowScore(segments: CpuSegmentResult[], playerResult: ShowResult, brand: RivalBrandState) {
  const base = segments.length ? Math.round(segments.reduce((sum, segment) => sum + segment.score, 0) / segments.length) : 0;
  const rivalryBonus = brand.rivalries.some((rivalry) => rivalry.heat >= 75) ? 2 : 0;
  const titleBonus = brand.championships.some((championship) => championship.defenses >= 2) ? 1 : 0;

  return clamp(base + rivalryBonus + titleBonus + (playerResult.showType === "ple" ? 2 : 0));
}

export function generateCpuWeeklyResults(game: GameState, playerResult: ShowResult, draftPool: Wrestler[]): RivalBrandState[] {
  const seededBrands = game.rivalBrands.map((brand) => ensureCpuBrandDepth(brand, draftPool, game.seasonNumber));
  const rawResults = seededBrands.map((brand) => {
    const existing = brand.weeklyResults.find((result) => result.seasonNumber === playerResult.seasonNumber && result.weekNumber === playerResult.week);

    if (existing) {
      return { brand, result: existing, nextBrand: brand };
    }

    const segments = buildCpuCard(brand, draftPool, playerResult);
    const score = getCpuShowScore(segments, playerResult, brand);
    const previousScore = brand.weeklyResults.at(-1)?.score;
    const trend = getTrendFromScores(score, previousScore);
    const mainEventSegment = segments[segments.length - 1];
    const keyAngleSegment = segments.find((segment) => segment.type !== "Match") ?? segments[0];
    const titleResolution = resolveCpuTitles(brand, segments, playerResult, draftPool);
    const rivalryResolution = resolveCpuRivalries(brand, segments, playerResult);
    const rosterFallout = resolveCpuRosterFallout(brand, segments, playerResult, draftPool);
    const previousMoney = brand.financeReports.at(-1)?.endingMoney ?? cpuStartingMoney;
    const resultBase: RivalBrandWeeklyResult = {
      id: `${brand.id}-s${playerResult.seasonNumber}-w${playerResult.week}`,
      seasonNumber: playerResult.seasonNumber,
      weekNumber: playerResult.week,
      showName: `${brand.brandName} ${playerResult.showType === "ple" ? "Special Event" : "TV"}`,
      showType: playerResult.showType,
      score,
      grade: getShowGrade(score),
      rank: 1,
      playerScoreDelta: score - playerResult.totalScore,
      mainEvent: mainEventSegment?.participantNames.join(" vs ") || "No main-event roster signal",
      keyAngle: keyAngleSegment?.note ?? "No CPU key angle logged.",
      rosterFocusWrestlerIds: [...new Set(segments.flatMap((segment) => segment.participantIds))].slice(0, 4),
      segments,
      titleNotes: titleResolution.titleNotes,
      rivalryNotes: rivalryResolution.rivalryNotes,
      injuryNotes: rosterFallout.injuryNotes,
      freeAgentClaims: [],
      objectiveNotes: [],
      note:
        score > playerResult.totalScore
          ? `${brand.brandName} beat your number by ${score - playerResult.totalScore}.`
          : score === playerResult.totalScore
            ? `${brand.brandName} matched your number exactly.`
            : `${brand.brandName} finished ${playerResult.totalScore - score} point${playerResult.totalScore - score === 1 ? "" : "s"} behind your show.`,
      trend,
    };
    const financeReport = generateCpuFinanceReport(brand, resultBase, previousMoney);

    return {
      brand,
      result: { ...resultBase, financeReport },
      nextBrand: {
        ...brand,
        rosterState: rosterFallout.rosterState,
        championships: titleResolution.championships,
        rivalries: rivalryResolution.rivalries,
        financeReports: [...brand.financeReports, financeReport],
      },
    };
  });
  const weeklyRanks = rankScores([{ id: "player", score: playerResult.totalScore }, ...rawResults.map(({ brand, result }) => ({ id: brand.id, score: result.score }))]);
  const playerSeasonAverage = getPlayerSeasonAverage(game, playerResult);
  const seasonAverages = rawResults.map(({ brand, result, nextBrand }) => {
    const results = nextBrand.weeklyResults.some((item) => item.id === result.id) ? nextBrand.weeklyResults : [...nextBrand.weeklyResults, result];

    return { id: brand.id, score: getSeasonAverage(results) };
  });
  const seasonRanks = rankScores([{ id: "player", score: playerSeasonAverage }, ...seasonAverages]);

  return rawResults.map(({ brand, result, nextBrand }) => {
    const weeklyResult = { ...result, rank: weeklyRanks.get(brand.id) ?? 1 };
    const nextWeeklyResults = nextBrand.weeklyResults.some((item) => item.id === weeklyResult.id)
      ? nextBrand.weeklyResults.map((item) => (item.id === weeklyResult.id ? weeklyResult : item))
      : [...nextBrand.weeklyResults, weeklyResult];
    const seasonAverageScore = getSeasonAverage(nextWeeklyResults);
    const seasonRank = seasonRanks.get(brand.id) ?? 1;
    const seasonObjectives = updateCpuObjectives(nextBrand, weeklyResult, seasonRank);
    const objectiveNotes = seasonObjectives.map((objective) => `${objective.label}: ${objective.note}`);
    const finalWeeklyResult = { ...weeklyResult, objectiveNotes };
    const latestActivity = {
      id: `${brand.id}-activity-s${playerResult.seasonNumber}-w${playerResult.week}`,
      seasonNumber: playerResult.seasonNumber,
      weekNumber: playerResult.week,
      label: finalWeeklyResult.score > playerResult.totalScore ? "Won Ratings Battle" : finalWeeklyResult.score === playerResult.totalScore ? "Split Ratings Battle" : "Trailed Player Show",
      note: finalWeeklyResult.note,
    };

    return {
      ...nextBrand,
      statusLabel: "CPU Active",
      weeklyResults: nextWeeklyResults.some((item) => item.id === finalWeeklyResult.id)
        ? nextWeeklyResults.map((item) => (item.id === finalWeeklyResult.id ? finalWeeklyResult : item))
        : [...nextWeeklyResults, finalWeeklyResult],
      seasonAverageScore,
      seasonRank,
      seasonTrend: finalWeeklyResult.trend,
      seasonObjectives,
      activityHistory: [...nextBrand.activityHistory.filter((item) => item.id !== latestActivity.id), latestActivity],
    };
  });
}

export function advanceCpuRivalWeek(game: GameState): RivalBrandState[] {
  return game.rivalBrands.map((brand) => {
    const recoveredRoster = brand.rosterState.map((member) => {
      const injuryWeeksRemaining = Math.max(0, member.injuryWeeksRemaining - 1);
      const injuryStatus: InjuryStatus = injuryWeeksRemaining <= 0 ? "healthy" : member.injuryStatus;

      return {
        ...member,
        fatigue: clamp(member.fatigue - 6),
        injuryStatus,
        injuryDescription: injuryStatus === "healthy" ? undefined : member.injuryDescription,
        injuryWeeksRemaining,
      };
    });

    return { ...brand, rosterState: recoveredRoster };
  });
}

function getPlayerSeasonAverage(game: GameState, latestResult?: ShowResult) {
  const results = latestResult && !game.showHistory.some((result) => result.id === latestResult.id) ? [...game.showHistory, latestResult] : game.showHistory;
  const seasonResults = results.filter((result) => result.seasonNumber === game.seasonNumber);

  return seasonResults.length ? Math.round(seasonResults.reduce((sum, result) => sum + result.totalScore, 0) / seasonResults.length) : 0;
}

export function getRatingsBattleSnapshot(game: GameState, latestResult?: ShowResult): RatingsBattleSnapshot | undefined {
  if (!game.rivalBrands.length) {
    return undefined;
  }

  const playerSeasonAverage = getPlayerSeasonAverage(game, latestResult);
  const latestCurrentSeasonResult = latestResult ?? game.showHistory.filter((result) => result.seasonNumber === game.seasonNumber).at(-1);
  const playerLatestScore = latestCurrentSeasonResult?.totalScore;
  const entries: RatingsBattleEntry[] = [
    {
      id: "player",
      brandName: game.brandName,
      gmName: game.gmName,
      latestScore: playerLatestScore,
      seasonAverage: playerSeasonAverage,
      rank: 1,
      trend: "steady",
      note: latestResult ? `${game.brandName} closed Week ${latestResult.week} at ${latestResult.totalScore}.` : "No ratings-battle result has closed yet.",
      isPlayer: true,
    },
    ...game.rivalBrands.map((brand) => {
      const latestCpuResult = brand.weeklyResults.filter((result) => result.seasonNumber === game.seasonNumber).at(-1);

      return {
        id: brand.id,
        brandName: brand.brandName,
        gmName: brand.assignedGMName,
        latestScore: latestCpuResult?.score,
        seasonAverage: brand.seasonAverageScore,
        rank: brand.seasonRank || 1,
        trend: brand.seasonTrend,
        note: latestCpuResult?.note ?? `${brand.brandName} has a roster, but no CPU show has resolved this season.`,
        isPlayer: false,
      };
    }),
  ];
  const rankedEntries = entries
    .sort((a, b) => b.seasonAverage - a.seasonAverage || (b.latestScore ?? 0) - (a.latestScore ?? 0) || Number(b.isPlayer) - Number(a.isPlayer) || a.brandName.localeCompare(b.brandName))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const playerEntry = rankedEntries.find((entry) => entry.isPlayer) ?? rankedEntries[0];
  const leader = rankedEntries[0];
  const closestRival = rankedEntries.find((entry) => !entry.isPlayer);
  const playerDelta = closestRival ? playerSeasonAverage - closestRival.seasonAverage : 0;
  const latestWeek = latestCurrentSeasonResult;
  const headline =
    playerEntry.rank === 1
      ? "Your Brand Leads The Ratings Room"
      : playerEntry.rank === rankedEntries.length
        ? "The Rival Desks Own The Room"
        : "The Ratings Race Is Tight";

  return {
    headline,
    detail: latestWeek
      ? `Season average ${playerSeasonAverage}. Latest resolved ratings-battle week is Week ${latestWeek.week}; CPU pressure is competitive context only.`
      : "No show has resolved yet. The ratings race starts after Run Show.",
    playerRank: playerEntry.rank,
    playerDelta,
    leaderName: leader.brandName,
    latestWeekLabel: latestWeek ? `Week ${latestWeek.week}` : "Preseason",
    entries: rankedEntries,
  };
}

export function getCpuResultsFeedSnapshot(game: GameState, latestResult?: ShowResult): CpuResultsFeedSnapshot | undefined {
  if (!game.rivalBrands.length) {
    return undefined;
  }

  const result = latestResult ?? game.showHistory.filter((showResult) => showResult.seasonNumber === game.seasonNumber).at(-1);
  const weekNumber = result?.week ?? game.currentWeek;
  const items = game.rivalBrands.map<CpuResultsFeedItem>((brand) => {
    const currentSeasonResults = brand.weeklyResults.filter((item) => item.seasonNumber === game.seasonNumber);
    const weeklyResult = currentSeasonResults.find((item) => item.weekNumber === weekNumber) ?? (result ? currentSeasonResults.at(-1) : undefined);
    const latestClaim = brand.freeAgentClaims.filter((claim) => claim.seasonNumber === game.seasonNumber).at(-1);
    const titleNote = weeklyResult?.titleNotes[0];
    const injuryNote = weeklyResult?.injuryNotes[0];
    const financeNote = weeklyResult?.financeReport?.note;
    const marketNote = brand.marketTransactions.filter((transaction) => transaction.seasonNumber === game.seasonNumber).at(-1)?.note;
    const objectiveNote = weeklyResult?.objectiveNotes[0] ?? brand.seasonObjectives[0]?.note;
    const notes = [weeklyResult?.keyAngle, titleNote, injuryNote, latestClaim?.note, marketNote, financeNote, objectiveNote].filter((note): note is string => Boolean(note));
    const tone: CpuResultsFeedItem["tone"] = weeklyResult && result ? (weeklyResult.score > result.totalScore ? "strong" : weeklyResult.score < result.totalScore - 6 ? "watch" : "steady") : "steady";

    return {
      id: `${brand.id}-feed-${weekNumber}`,
      brandName: brand.brandName,
      headline: weeklyResult ? `${weeklyResult.showName} · ${weeklyResult.grade}` : "CPU Desk Waiting",
      score: weeklyResult?.score,
      grade: weeklyResult?.grade,
      detail: weeklyResult?.note ?? `${brand.brandName} has not resolved a CPU show yet.`,
      segments: weeklyResult?.segments ?? [],
      notes,
      tone,
    };
  });
  const resolvedCount = items.filter((item) => item.score !== undefined).length;

  return {
    headline: resolvedCount ? "CPU Results Feed" : "CPU Feed Waiting",
    detail: resolvedCount
      ? `${resolvedCount} rival desk${resolvedCount === 1 ? "" : "s"} have resolved hidden cards for the current ratings race.`
      : "Rival cards stay hidden until your show resolves.",
    items,
  };
}
