import { formatMoney } from "../game/formatters";
import { financeModelSummaryByRole, getRosterFinanceValueForWrestler } from "../game/financeCatalog";
import type { Wrestler } from "../game/types";
import type { WrestlerValueProfile } from "./rosterTypes";

const valueProfileFallbackSummary = financeModelSummaryByRole.reduce(
  (acc, summary) => {
    return {
      minDraftValue: Math.min(acc.minDraftValue, summary.minDraftValueUsd),
      maxDraftValue: Math.max(acc.maxDraftValue, summary.maxDraftValueUsd),
      medianWeeklyHireRate: Math.max(acc.medianWeeklyHireRate, summary.medianWeeklyHireRateUsd),
    };
  },
  { minDraftValue: Number.POSITIVE_INFINITY, maxDraftValue: Number.NEGATIVE_INFINITY, medianWeeklyHireRate: 0 },
);

const hasValueSummary = valueProfileFallbackSummary.minDraftValue < Number.POSITIVE_INFINITY;

export function getWrestlerValueProfile(wrestler: Wrestler): WrestlerValueProfile {
  const financeRow = getRosterFinanceValueForWrestler(wrestler);

  if (!financeRow) {
    return {
      contextMode: "missing",
      valueTierLabel: "Profile Pending",
      draftValueLabel: "Draft value not mapped",
      weeklyValueLabel: "Weekly signal unavailable",
      dossierRead: "Contract-value context is not yet available for this wrestler in the current catalog mapping.",
      costRead: "Use core booking context as the decision input until this roster profile maps.",
    };
  }

  const summary = financeModelSummaryByRole.find(
    (row) => row.roleTier.toLowerCase() === (financeRow.roleTier ?? wrestler.roleTier ?? "unknown").toLowerCase().trim(),
  );
  const minDraftValue = summary?.minDraftValueUsd ?? (hasValueSummary ? valueProfileFallbackSummary.minDraftValue : 0);
  const maxDraftValue = summary?.maxDraftValueUsd ?? (hasValueSummary ? valueProfileFallbackSummary.maxDraftValue : 0);
  const draftRange = Math.max(1, maxDraftValue - minDraftValue);
  const draftValueRatio = Math.max(0, Math.min(1, (financeRow.draftValueUsd - minDraftValue) / draftRange));
  const roleHireMedian = summary?.medianWeeklyHireRateUsd ?? (hasValueSummary ? valueProfileFallbackSummary.medianWeeklyHireRate : financeRow.weeklyHireRateUsd || 1);
  const weeklyPressureRatio = financeRow.weeklyHireRateUsd / Math.max(roleHireMedian, 1);
  const roleTierLabel = financeRow.roleTier || wrestler.roleTier || "Roster";
  const isMainEventRole = roleTierLabel.toLowerCase() === "mainevent";
  const isHighCost = weeklyPressureRatio >= 1.45;
  const isRiskySpend = isHighCost || financeRow.releasePenaltyPct >= 28;
  const isPremiumBand = draftValueRatio >= 0.7;
  const isTopBand = draftValueRatio >= 0.9;

  const valueTierLabel = isTopBand
    ? isHighCost
      ? "High-Cost Attraction"
      : isMainEventRole
        ? "Main Event Investment"
        : "Premium Draw"
    : isPremiumBand
      ? isRiskySpend
        ? "Risky Spend"
        : "Premium Draw"
      : draftValueRatio >= 0.4
        ? "Rising Value"
        : "Bargain Workhorse";

  const dossierRead = isTopBand
    ? isMainEventRole
      ? `${wrestler.name} is carrying a top-end profile where brand positioning and booking rhythm have outsized impact.`
      : `${wrestler.name} carries a heavy value footprint in the current roster map.`
    : draftValueRatio >= 0.4
      ? `${wrestler.name} shows reliable value with upside if protected for higher-value stories.`
      : `${wrestler.name} reads as a productive value anchor with room for workload shaping.`;

  const costRead = isRiskySpend
    ? "Expect elevated weekly-cost pressure and use this wrestler in moments that justify the commitment."
    : isTopBand
      ? "High-value commitments should be framed as deliberate GM calls, not routine depth options."
      : draftValueRatio < 0.4
        ? "Good for depth, experimentation, and controlled TV seasoning windows."
        : "Use with moderate planning around milestone spots and long-term card identity.";

  return {
    contextMode: "active",
    valueTierLabel,
    draftValueLabel: `${formatMoney(financeRow.draftValueUsd)} opening-rights read`,
    weeklyValueLabel: `${formatMoney(financeRow.weeklyHireRateUsd)} / week context`,
    dossierRead,
    costRead,
  };
}
