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

  const attendance = roundMoney(
    (isPle ? 6500 : 1200) +
      result.totalScore * (isPle ? 70 : 22) +
      averagePopularity * (isPle ? 30 : 12) +
      titleMatches * (isPle ? 700 : 250),
  );
  const ticketRevenue = roundMoney(attendance * (isPle ? 38 : 24));
  const merchRevenue = roundMoney(attendance * ((isPle ? 8 : 4) + averagePopularity * 0.08 + result.totalScore * 0.04));
  const mediaRevenue = roundMoney((isPle ? 125000 : 42000) + result.totalScore * (isPle ? 1100 : 360));
  const talentCost = roundMoney(bookedPopularity * (isPle ? 190 : 105) + result.segmentResults.length * (isPle ? 3500 : 2500));
  const productionCost = roundMoney((isPle ? 210000 : 75000) + result.segmentResults.length * (isPle ? 12000 : 6000) + titleMatches * (isPle ? 8000 : 3000));
  const profitLoss = ticketRevenue + merchRevenue + mediaRevenue - talentCost - productionCost;
  const endingMoney = roundMoney(game.money + profitLoss);
  const notes = [
    `${result.showName} drew ${attendance.toLocaleString()} fans off a ${result.totalScore} show score.`,
    isPle ? "PLE staging raised production costs but opened a larger gate and media upside." : "TV production kept costs controlled, with revenue tied closely to show quality.",
    titleMatches ? `${titleMatches} title match${titleMatches === 1 ? "" : "es"} helped the live business.` : "No title match premium was attached to this card.",
  ];

  if (profitLoss < 0) {
    notes.push("The show lost money and tightened brand pressure.");
  } else if (profitLoss > 100000) {
    notes.push("The show materially improved the brand's cash position.");
  } else {
    notes.push("The show landed as a manageable business result.");
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
  };
}
