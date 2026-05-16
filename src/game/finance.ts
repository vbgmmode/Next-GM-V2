import type { FinanceReport, GameState, ShowResult, Wrestler } from "./types";

function getUniqueBookedWrestlers(result: ShowResult, wrestlers: Wrestler[]) {
  const ids = [...new Set(result.segmentResults.flatMap((segment) => segment.participantIds))];
  return ids
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function roundMoney(value: number) {
  return Math.round(value);
}

function formatTitleMatchCount(titleMatches: number) {
  return `${titleMatches} title match${titleMatches === 1 ? "" : "es"}`;
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

export function generateFinanceReport(result: ShowResult, game: GameState): FinanceReport {
  const bookedWrestlers = getUniqueBookedWrestlers(result, game.wrestlers);
  const bookedPopularity = bookedWrestlers.reduce((sum, wrestler) => sum + wrestler.popularity, 0);
  const averagePopularity = bookedWrestlers.length ? bookedPopularity / bookedWrestlers.length : 50;
  const titleMatches = result.segmentResults.filter((segment) => segment.type === "Match" && segment.championshipId).length;
  const isPle = result.showType === "ple";
  const overrunRevenueDrag =
    result.broadcastOverrunLevel === "major" ? 0.09 : result.broadcastOverrunLevel === "moderate" ? 0.05 : result.broadcastOverrunLevel === "minor" ? 0.02 : 0;
  const overrunProductionCost =
    result.broadcastOverrunLevel === "major" ? 16000 : result.broadcastOverrunLevel === "moderate" ? 8000 : result.broadcastOverrunLevel === "minor" ? 2500 : 0;
  const revenueMultiplier = 1 - overrunRevenueDrag;

  const attendance = roundMoney(
    ((isPle ? 6500 : 1200) +
      result.totalScore * (isPle ? 70 : 22) +
      averagePopularity * (isPle ? 30 : 12) +
      titleMatches * (isPle ? 700 : 250)) *
      revenueMultiplier,
  );
  const ticketRevenue = roundMoney(attendance * (isPle ? 38 : 24));
  const merchRevenue = roundMoney(attendance * ((isPle ? 8 : 4) + averagePopularity * 0.08 + result.totalScore * 0.04));
  const mediaRevenue = roundMoney(((isPle ? 125000 : 42000) + result.totalScore * (isPle ? 1100 : 360)) * revenueMultiplier);
  const talentCost = roundMoney(bookedPopularity * (isPle ? 190 : 105) + result.segmentResults.length * (isPle ? 3500 : 2500));
  const productionCost = roundMoney((isPle ? 210000 : 75000) + result.segmentResults.length * (isPle ? 12000 : 6000) + titleMatches * (isPle ? 8000 : 3000) + overrunProductionCost);
  const profitLoss = ticketRevenue + merchRevenue + mediaRevenue - talentCost - productionCost;
  const endingMoney = roundMoney(game.money + profitLoss);
  const revenue = ticketRevenue + merchRevenue + mediaRevenue;
  const expenses = talentCost + productionCost;
  const notes = [
    `${result.showName} drew ${attendance.toLocaleString()} fans off a ${result.totalScore} show score.`,
    isPle
      ? `Major-event staging pushed costs up, but the larger gate and media package brought in ${roundMoney(revenue).toLocaleString()}.`
      : "TV production stayed lean, with revenue tied tightly to show quality and booked star power.",
    titleMatches
      ? `${formatTitleMatchCount(titleMatches)} gave the live business a premium hook.`
      : "No title-match premium was attached to this card.",
  ];

  if (profitLoss < 0) {
    notes.push(profitLoss < -75000 ? "The red number hit hard enough to tighten the office immediately." : "The show lost money and put a little more pressure on the office.");
  } else if (profitLoss > 100000) {
    notes.push("The show materially improved the brand's cash position.");
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
    talentCost,
    productionCost,
    profitLoss,
    endingMoney,
    notes,
    modelVersion: "legacy-compatible-v2",
    grossRevenue: revenue,
    totalExpenses: expenses,
    revenueBreakdown: [
      { id: "ticketRevenue", label: "Ticket Revenue", amount: ticketRevenue },
      { id: "merchRevenue", label: "Merch Revenue", amount: merchRevenue },
      { id: "mediaRevenue", label: "Media Revenue", amount: mediaRevenue },
    ],
    expenseBreakdown: [
      { id: "talentCost", label: "Talent Cost", amount: talentCost },
      { id: "productionCost", label: "Production Cost", amount: productionCost },
    ],
  };
}
