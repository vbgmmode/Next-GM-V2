import { getSegmentBookingCost } from "./financeCatalog";
import type { FinanceReport, GameState, SegmentResult, ShowResult, ShowType, Wrestler } from "./types";

export const bookedFinishCostUsd = 10000;

function getUniqueBookedWrestlers(result: ShowResult, wrestlers: Wrestler[]) {
  const ids = [...new Set(result.segmentResults.flatMap((segment) => segment.participantIds))];
  return ids
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function roundMoney(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTitleMatchCount(titleMatches: number) {
  return `${titleMatches} title match${titleMatches === 1 ? "" : "es"}`;
}

function getAverageScore(wrestlers: Wrestler[], score: (wrestler: Wrestler) => number, fallback: number) {
  if (!wrestlers.length) {
    return fallback;
  }

  return wrestlers.reduce((sum, wrestler) => sum + score(wrestler), 0) / wrestlers.length;
}

export function getFinancePressureLabel(money: number, latestProfitLoss = 0) {
  if (money < 100000 || latestProfitLoss < -75000) {
    return "Critical";
  }

  if (money < 200000 || latestProfitLoss < 0) {
    return "Tight";
  }

  if (money > 500000 && latestProfitLoss > 0) {
    return "Surging";
  }

  return "Stable";
}

export function getSegmentProductionCostForShow(segment: Pick<SegmentResult, "segmentCatalogId" | "type">, showType: ShowType) {
  if (!segment.segmentCatalogId) {
    return undefined;
  }

  const costRow = getSegmentBookingCost(segment.segmentCatalogId);

  if (!costRow) {
    return undefined;
  }

  return showType === "ple" ? costRow.plePpvBookingCostUsd : costRow.weeklyTvBookingCostUsd;
}

function getShowProductionCostProfile(result: ShowResult, game: GameState) {
  const plannedSegmentsById = new Map(game.currentShow.map((segment) => [segment.id, segment]));
  const missingSegmentCostIds: string[] = [];
  const segmentProductionCost = result.segmentResults.reduce((total, segment) => {
    const cost = getSegmentProductionCostForShow(segment, result.showType);

    if (cost === undefined) {
      missingSegmentCostIds.push(segment.segmentCatalogId ?? `${segment.type}:missing-catalog`);
      return total;
    }

    return total + cost;
  }, 0);
  const bookedFinishCost = result.segmentResults.reduce((total, segment) => {
    const plannedSegment = plannedSegmentsById.get(segment.segmentId);
    const manualWinnerId = plannedSegment?.winnerId;

    if (segment.type !== "Match" || !manualWinnerId || !segment.participantIds.includes(manualWinnerId)) {
      return total;
    }

    return total + bookedFinishCostUsd;
  }, 0);
  const baseShowProductionCost = result.showType === "ple" ? 240000 : 65000;
  const overrunCost =
    result.broadcastOverrunLevel === "major" ? 16000 : result.broadcastOverrunLevel === "moderate" ? 8000 : result.broadcastOverrunLevel === "minor" ? 2500 : 0;

  return {
    baseShowProductionCost,
    bookedFinishCost,
    missingSegmentCostIds: [...new Set(missingSegmentCostIds)],
    overrunCost,
    segmentProductionCost,
  };
}

export function generateFinanceReport(result: ShowResult, game: GameState): FinanceReport {
  const bookedWrestlers = getUniqueBookedWrestlers(result, game.wrestlers);
  const averageDraw = getAverageScore(bookedWrestlers, (wrestler) => wrestler.popularity * 0.5 + wrestler.momentum * 0.25 + Math.max(wrestler.ringSkill, wrestler.promoSkill) * 0.25, 55);
  const merchandiseAppeal = getAverageScore(bookedWrestlers, (wrestler) => wrestler.popularity * 0.45 + wrestler.momentum * 0.35 + wrestler.promoSkill * 0.2, 55);
  const titleMatches = result.segmentResults.filter((segment) => segment.type === "Match" && segment.championshipId).length;
  const isPle = result.showType === "ple";
  const segmentCount = result.segmentResults.length;
  const runtimeMinutes =
    result.actualRuntimeMinutes ??
    result.plannedRuntimeMinutes ??
    result.segmentResults.reduce((sum, segment) => sum + (segment.actualDurationMinutes ?? segment.plannedDurationMinutes ?? 10), 0);
  const scoreFactor = clamp((result.totalScore - 50) / 50, 0, 1);
  const overrunRevenueDrag =
    result.broadcastOverrunLevel === "major" ? 0.09 : result.broadcastOverrunLevel === "moderate" ? 0.05 : result.broadcastOverrunLevel === "minor" ? 0.02 : 0;
  const revenueMultiplier = 1 - overrunRevenueDrag;
  const productionCostProfile = getShowProductionCostProfile(result, game);

  const attendance = roundMoney(
    clamp(
      ((isPle ? 4500 : 950) +
        result.totalScore * (isPle ? 35 : 16) +
        averageDraw * (isPle ? 18 : 10) +
        Math.min(segmentCount, isPle ? 10 : 6) * (isPle ? 75 : 45) +
        titleMatches * (isPle ? 450 : 175)) *
        revenueMultiplier,
      isPle ? 4500 : 700,
      isPle ? 18500 : 6500,
    ),
  );
  const averageTicketPrice = isPle ? 33 + scoreFactor * 5 + titleMatches * 0.75 : 24 + scoreFactor * 3 + titleMatches * 0.4;
  const merchPerHead = isPle ? 6 + merchandiseAppeal * 0.05 + scoreFactor * 2.5 : 3 + merchandiseAppeal * 0.045 + scoreFactor * 1.5;
  const ticketRevenue = roundMoney(attendance * averageTicketPrice);
  const merchRevenue = roundMoney(attendance * merchPerHead);
  const mediaRevenue = roundMoney(((isPle ? 120000 : 62000) + result.totalScore * (isPle ? 550 : 240) + averageDraw * (isPle ? 150 : 85) + titleMatches * (isPle ? 10000 : 3500)) * revenueMultiplier);
  const productionCost = roundMoney(
    productionCostProfile.baseShowProductionCost +
      productionCostProfile.segmentProductionCost +
      productionCostProfile.bookedFinishCost +
      productionCostProfile.overrunCost,
  );
  const revenue = ticketRevenue + merchRevenue + mediaRevenue;
  const expenses = productionCost;
  const profitLoss = revenue - expenses;
  const endingMoney = roundMoney(game.money + profitLoss);
  const notes = [
    `${result.showName} drew ${attendance.toLocaleString()} fans off a ${result.totalScore} show score, closing at ${roundMoney(revenue).toLocaleString()} revenue against ${roundMoney(expenses).toLocaleString()} costs.`,
    isPle
      ? "PLE economics paid out through a larger gate and media package, with major-event production costs attached."
      : "TV economics stayed bounded: gate, merch, and media money tracked the resolved score and booked star power.",
    titleMatches
      ? `${formatTitleMatchCount(titleMatches)} gave the live business a premium hook.`
      : "No title-match premium was attached to this card.",
  ];

  if (productionCostProfile.segmentProductionCost > 0) {
    notes.push(`Segment production booked ${productionCostProfile.segmentProductionCost.toLocaleString()} in catalog costs for the resolved card.`);
  }

  if (productionCostProfile.bookedFinishCost > 0) {
    notes.push(`Manually booked finishes added ${productionCostProfile.bookedFinishCost.toLocaleString()} in production handling.`);
  }

  if (productionCostProfile.missingSegmentCostIds.length) {
    notes.push("Some production lines used standard office handling because segment cost mapping needs a catalog pass.");
  }

  if (profitLoss < 0) {
    notes.push(profitLoss < -75000 ? "The red number was meaningful, but it came from resolved show economics rather than hidden pre-show penalties." : "The show lost money, but the miss stayed inside normal weekly operating pressure.");
  } else if (profitLoss > 100000) {
    notes.push("The show materially improved the brand's cash position without changing any draft or contract rules.");
  } else {
    notes.push(profitLoss > 0 ? "The show banked a controlled win without changing the whole season." : "The show landed close to break-even, manageable but not invisible.");
  }

  if (result.broadcastOverrunLevel && result.broadcastOverrunMinutes) {
    notes.push(`The broadcast overran by ${result.broadcastOverrunMinutes} minutes, softening revenue and adding live-production cost.`);
  }

  return {
    id: `${result.id}-finance`,
    seasonNumber: result.seasonNumber,
    weekNumber: result.week,
    showName: result.showName,
    showType: result.showType,
    showScore: result.totalScore,
    attendance,
    ticketRevenue,
    merchRevenue,
    mediaRevenue,
    productionCost,
    profitLoss,
    endingMoney,
    notes,
    modelVersion: "show-production-finance-v3",
    grossRevenue: revenue,
    totalExpenses: expenses,
    baseShowProductionCost: productionCostProfile.baseShowProductionCost,
    segmentProductionCost: productionCostProfile.segmentProductionCost,
    bookedFinishCost: productionCostProfile.bookedFinishCost,
    overrunCost: productionCostProfile.overrunCost,
    revenueBreakdown: [
      { id: "ticketRevenue", label: "Ticket Revenue", amount: ticketRevenue },
      { id: "merchRevenue", label: "Merch Revenue", amount: merchRevenue },
      { id: "mediaRevenue", label: "Media Revenue", amount: mediaRevenue },
    ],
    expenseBreakdown: [
      { id: "baseShowProductionCost", label: "Base Production", amount: productionCostProfile.baseShowProductionCost },
      { id: "segmentProductionCost", label: "Segment Production", amount: productionCostProfile.segmentProductionCost },
      { id: "bookedFinishCost", label: "Booked Finish", amount: productionCostProfile.bookedFinishCost },
      { id: "overrunCost", label: "Overrun", amount: productionCostProfile.overrunCost },
    ],
  };
}
