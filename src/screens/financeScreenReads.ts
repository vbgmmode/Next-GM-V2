import { formatAttendance, formatMoney } from "../game/formatters";
import { getFinancePressureLabel } from "../game/finance";
import type { FinanceReport, GameState, PressureLabel, ShowResult, ShowType, Wrestler } from "../game/types";
import { getWrestlerValueProfile } from "../roster/rosterValueReads";

export type FinancePanelId = "talentValue" | "seasonReads" | "financeHistory";

export type TalentValuePressure = {
  bargainCount: number;
  gmRead: string;
  mappedCount: number;
  missingCount: number;
  premiumCount: number;
  totalCount: number;
};

export type FinanceOfficeRead = {
  headline: string;
  detail: string;
  focusLabel: string;
  pressureLabel: PressureLabel;
  items: {
    label: string;
    value: string;
    detail: string;
  }[];
};

export function getShowTypeLabel(showType: ShowType) {
  return showType === "ple" ? "PLE" : "TV";
}

export function getLatestFinanceReport(game: GameState) {
  return game.financeReports[game.financeReports.length - 1];
}

export function getFinanceReportForResult(game: GameState, result: ShowResult) {
  return game.financeReports.find((report) => report.id === `${result.id}-finance`);
}

export function getSeasonFinanceReports(game: GameState) {
  return game.financeReports.filter((report) => report.seasonNumber === game.seasonNumber);
}

function getLegacyFinanceRevenue(report: FinanceReport) {
  return report.ticketRevenue + report.merchRevenue + report.mediaRevenue;
}

function getLegacyFinanceExpenses(report: FinanceReport) {
  return (report.talentCost ?? 0) + report.productionCost;
}

export function getFinanceGrossRevenue(report: FinanceReport) {
  return report.grossRevenue ?? getLegacyFinanceRevenue(report);
}

export function getFinanceTotalExpenses(report: FinanceReport) {
  return report.totalExpenses ?? getLegacyFinanceExpenses(report);
}

export function getFinanceRevenueBreakdown(report: FinanceReport) {
  return report.revenueBreakdown?.length
    ? report.revenueBreakdown
    : [
        { id: "ticketRevenue", label: "Ticket Revenue", amount: report.ticketRevenue },
        { id: "merchRevenue", label: "Merch Revenue", amount: report.merchRevenue },
        { id: "mediaRevenue", label: "Media Revenue", amount: report.mediaRevenue },
      ];
}

export function getFinanceExpenseBreakdown(report: FinanceReport) {
  return report.expenseBreakdown?.length
    ? report.expenseBreakdown
    : [
        { id: "talentCost", label: "Legacy Talent Cost", amount: report.talentCost ?? 0 },
        { id: "productionCost", label: "Production Cost", amount: report.productionCost },
      ];
}

export function getFinanceReportModelLabel(report: FinanceReport) {
  return report.modelVersion === "show-production-finance-v3" ? "Show Production v3" : report.modelVersion ? "Legacy-Compatible v2" : "Legacy Report";
}

export function getVenueMarketContextReadout(report: FinanceReport | undefined, seasonReports: FinanceReport[]) {
  if (!report) {
    return {
      label: "Venue context pending",
      read: "Run a show to close books and get a venue/market read from the actual report.",
      summary: "No closed reports yet this run.",
    };
  }

  const seasonPeerReports = seasonReports.filter((peer) => peer.seasonNumber === report.seasonNumber);
  const avgAttendance = seasonPeerReports.length
    ? Math.round(
        seasonPeerReports.reduce((total, peer) => total + peer.attendance, 0) / Math.max(1, seasonPeerReports.length),
      )
    : undefined;
  const avgGrossRevenue = seasonPeerReports.length
    ? Math.round(
        seasonPeerReports.reduce((total, peer) => total + getFinanceGrossRevenue(peer), 0) / Math.max(1, seasonPeerReports.length),
      )
    : undefined;
  const avgProfit = seasonPeerReports.length
    ? Math.round(
        seasonPeerReports.reduce((total, peer) => total + peer.profitLoss, 0) / Math.max(1, seasonPeerReports.length),
      )
    : undefined;
  const attendance = report.attendance;
  const showScore = report.showScore;
  const gross = getFinanceGrossRevenue(report);
  const costs = getFinanceTotalExpenses(report);
  const isStrongCrowd = avgAttendance === undefined ? attendance >= 5500 : attendance >= avgAttendance * 1.2;
  const isWeakCrowd = avgAttendance === undefined ? attendance <= 2800 : attendance <= avgAttendance * 0.75;
  const isScoreStrong = showScore >= 82;
  const isFinanciallyEfficient = avgGrossRevenue === undefined
    ? report.profitLoss >= 1200
    : gross >= Math.max(avgGrossRevenue, 1) * 0.78 && report.profitLoss >= 800;
  const isCostHeavy = isWeakCrowd
    ? costs >= gross * 1.1 && report.profitLoss < 0
    : gross > 0
      ? costs / Math.max(1, gross) >= 0.75
      : false;

  let label = "Regional TV Market";
  if (report.showType === "ple") {
    if (isStrongCrowd && isFinanciallyEfficient && isScoreStrong) {
      label = "Premium PLE Market";
    } else if (isCostHeavy) {
      label = "Costly Production City";
    } else if (isStrongCrowd || showScore >= 78) {
      label = "Strong Touring Market";
    } else {
      label = "Regional TV Market";
    }
  } else if (isCostHeavy) {
    label = "Costly Production City";
  } else if (isStrongCrowd && isFinanciallyEfficient && isScoreStrong) {
    label = "Hot Wrestling Town";
  } else if (isFinanciallyEfficient && showScore >= 75) {
    label = "Efficient House";
  } else if (isStrongCrowd || report.weekNumber % 3 === 0) {
    label = "Strong Touring Market";
  } else if (isWeakCrowd) {
    label = "Regional TV Market";
  }

  const crowdRead = avgAttendance === undefined
    ? `Crowd landed at ${formatAttendance(attendance)} checks this board.`
    : `${formatAttendance(attendance)} attendance vs ${formatAttendance(avgAttendance)} this-season average.`;
  const moneyRead = avgProfit === undefined
    ? `Profit/Loss tracked at ${formatMoney(report.profitLoss)} from ${formatMoney(gross)} gross.`
    : `${formatMoney(report.profitLoss)} closed with a score ${showScore} ${report.profitLoss >= avgProfit ? "above" : "below"} season pace.`;
  const summary = `${crowdRead} ${moneyRead}`;

  return {
    label,
    read: summary,
    summary,
  };
}

export function getBestRevenueReport(reports: FinanceReport[]) {
  return reports.reduce<FinanceReport | undefined>((best, report) => {
    const revenue = getFinanceGrossRevenue(report);
    const bestRevenue = best ? getFinanceGrossRevenue(best) : -Infinity;
    return revenue > bestRevenue ? report : best;
  }, undefined);
}

export function getWorstProfitReport(reports: FinanceReport[]) {
  return reports.reduce<FinanceReport | undefined>((worst, report) => (!worst || report.profitLoss < worst.profitLoss ? report : worst), undefined);
}

export function getFinanceOfficeRead(game: GameState): FinanceOfficeRead {
  const latestReport = getLatestFinanceReport(game);
  const seasonReports = getSeasonFinanceReports(game);
  const totalProfitLoss = seasonReports.reduce((sum, report) => sum + report.profitLoss, 0);
  const pressureLabel = getFinancePressureLabel(game.money, latestReport?.profitLoss ?? 0);
  const bestRevenueReport = getBestRevenueReport(seasonReports);
  const worstProfitReport = getWorstProfitReport(seasonReports);
  const profitableWeeks = seasonReports.filter((report) => report.profitLoss >= 0).length;
  const lossWeeks = seasonReports.length - profitableWeeks;
  const averageProfitLoss = seasonReports.length ? Math.round(totalProfitLoss / seasonReports.length) : 0;
  const latestGrossRevenue = latestReport ? getFinanceGrossRevenue(latestReport) : 0;
  const latestTotalExpenses = latestReport ? getFinanceTotalExpenses(latestReport) : 0;
  const costRatio = latestGrossRevenue > 0 ? latestTotalExpenses / latestGrossRevenue : 0;

  const headline =
    pressureLabel === "Critical"
      ? "Ownership Pressure Is Loud"
      : pressureLabel === "Tight"
        ? "Front Office Is Tight"
        : pressureLabel === "Surging"
          ? "Business Office Has Room"
          : "Books Are Stable";
  const businessFeel =
    pressureLabel === "Critical"
      ? "exposed"
      : pressureLabel === "Tight"
        ? "tight"
        : pressureLabel === "Surging"
          ? "hot"
          : "stable";
  const detail = latestReport
    ? `${latestReport.showName} closed at ${formatMoney(latestReport.profitLoss)}. The brand feels ${businessFeel} with ${formatMoney(game.money)} on hand after ${seasonReports.length} closed report${seasonReports.length === 1 ? "" : "s"}.`
    : `${formatMoney(game.money)} is on hand and no show books have closed yet. The office read is current cash pressure only until the first report lands.`;

  return {
    headline,
    detail,
    focusLabel: latestReport ? `${latestReport.showName} · ${formatMoney(latestReport.profitLoss)}` : "Books pending",
    pressureLabel,
    items: [
      {
        label: "Money Pressure",
        value: pressureLabel,
        detail: `${formatMoney(game.money)} available. This read uses current cash and the latest closed P/L only.`,
      },
      {
        label: "Latest Close",
        value: latestReport ? `${formatMoney(latestReport.profitLoss)} · Week ${latestReport.weekNumber}` : "No report yet",
        detail: latestReport
          ? `${formatMoney(latestGrossRevenue)} gross against ${formatMoney(latestTotalExpenses)} costs.`
          : "Run a show to close the first business report.",
      },
      {
        label: "Season Trend",
        value: seasonReports.length ? formatMoney(totalProfitLoss) : "No ledger",
        detail: seasonReports.length
          ? `${profitableWeeks} profitable / ${lossWeeks} loss week${seasonReports.length === 1 ? "" : "s"} · ${formatMoney(averageProfitLoss)} average P/L.`
          : "Season trend begins after the first completed show.",
      },
      {
        label: "Business Swing",
        value: bestRevenueReport ? bestRevenueReport.showName : "No swing yet",
        detail: bestRevenueReport && worstProfitReport
          ? `Best gross: ${formatMoney(getFinanceGrossRevenue(bestRevenueReport))} in Week ${bestRevenueReport.weekNumber}. Toughest close: ${formatMoney(worstProfitReport.profitLoss)} in Week ${worstProfitReport.weekNumber}.`
          : "Best and worst week context will appear once reports exist.",
      },
      {
        label: "Cost Control",
        value: latestReport ? (costRatio >= 0.9 ? "Exposed" : costRatio >= 0.7 ? "Tight" : "Controlled") : "Pending",
        detail: latestReport
          ? `${Math.round(costRatio * 100)}% of latest gross went to reported costs. This is a closed-report read, not a forecast.`
          : "Cost control needs a closed report before the office can read it.",
      },
    ],
  };
}

export function getTalentValuePressure(wrestlers: Wrestler[]): TalentValuePressure {
  const profiles = wrestlers.map(getWrestlerValueProfile);
  const mappedProfiles = profiles.filter((profile) => profile.contextMode === "active");
  const premiumLabels = new Set(["Premium Draw", "Main Event Investment", "High-Cost Attraction", "Risky Spend"]);
  const bargainLabels = new Set(["Bargain Workhorse", "Rising Value"]);
  const premiumCount = mappedProfiles.filter((profile) => premiumLabels.has(profile.valueTierLabel)).length;
  const bargainCount = mappedProfiles.filter((profile) => bargainLabels.has(profile.valueTierLabel)).length;
  const missingCount = profiles.length - mappedProfiles.length;
  const gmRead =
    mappedProfiles.length === 0
      ? "Talent value context is still pending for this roster. Finance pressure should be read from closed show reports until mappings are available."
      : premiumCount > bargainCount + 2
        ? "This roster leans top-heavy. The office read is prestige value with elevated acquisition-cost pressure, not a recurring payroll restriction."
        : bargainCount > premiumCount + 2
          ? "This roster has a strong value base. You have room to shape TV identity without every slot needing a premium draw."
          : "Roster value is balanced across premium anchors and useful value pieces. Treat this as context for booking emphasis, not an enforced budget gate.";

  return {
    bargainCount,
    gmRead,
    mappedCount: mappedProfiles.length,
    missingCount,
    premiumCount,
    totalCount: profiles.length,
  };
}
