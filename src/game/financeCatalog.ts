import brandStartingBudgetTiersCsv from "../../data/finance/brand_starting_budget_tiers_2026-05-16.csv?raw";
import contractCostRulesCsv from "../../data/finance/contract_cost_rules_2026-05-16.csv?raw";
import expenseStreamCatalogCsv from "../../data/finance/expense_stream_catalog_no_bonus_2026-05-16.csv?raw";
import financeModelSummaryByRoleCsv from "../../data/finance/finance_model_summary_by_role_no_bonus_2026-05-16.csv?raw";
import financeSourcesAndMethodologyCsv from "../../data/finance/finance_sources_and_methodology_no_bonus_2026-05-16.csv?raw";
import openingDraftBalanceExamplesCsv from "../../data/finance/opening_draft_balance_examples_no_bonus_2026-05-16.csv?raw";
import revenueStreamCatalogCsv from "../../data/finance/revenue_stream_catalog_2026-05-16.csv?raw";
import rosterDraftAndContractValuesCsv from "../../data/finance/roster_draft_and_contract_values_top_200_no_bonus_full_season_2026-05-16.csv?raw";
import segmentBookingCostCatalogCsv from "../../data/finance/segment_booking_cost_catalog_2026-05-16.csv?raw";
import showFinanceFormulaWeightsCsv from "../../data/finance/show_finance_formula_weights_no_bonus_2026-05-16.csv?raw";
import venueTierCatalogCsv from "../../data/finance/venue_tier_catalog_2026-05-16.csv?raw";
import { top200DraftPool } from "./top200DraftPool";
import type { Wrestler } from "./types";

export type FinanceCatalogId =
  | "brandStartingBudgetTiers"
  | "contractCostRules"
  | "expenseStreamCatalog"
  | "financeModelSummaryByRole"
  | "financeSourcesAndMethodology"
  | "openingDraftBalanceExamples"
  | "revenueStreamCatalog"
  | "rosterDraftAndContractValues"
  | "segmentBookingCostCatalog"
  | "showFinanceFormulaWeights"
  | "venueTierCatalog";

type CsvRecord = Record<string, string>;

export type BrandStartingBudgetTierRow = {
  difficultyId: string;
  displayName: string;
  startingBudgetUsd: number;
  draftBudgetGuidanceUsd: number;
  bookingReserveGuidanceUsd: number;
  targetOpeningRosterCount: number;
  targetRosterMix: string;
  expectedBudgetFeel: string;
};

export type ContractCostRuleRow = {
  ruleId: string;
  phase: string;
  costFormula: string;
  contractLength: string;
  signingBonusAllowed: boolean;
  notes: string;
};

export type ExpenseStreamRow = {
  expenseStreamId: string;
  displayName: string;
  trigger: string;
  baseFormula: string;
  difficultyBehavior: string;
  notes: string;
};

export type FinanceModelSummaryByRoleRow = {
  roleTier: string;
  count: number;
  minDraftValueUsd: number;
  medianDraftValueUsd: number;
  maxDraftValueUsd: number;
  medianWeeklyHireRateUsd: number;
  contractNotes: string;
};

export type FinanceSourceMethodologyRow = {
  topic: string;
  method: string;
};

export type OpeningDraftBalanceExampleRow = {
  difficultyId: string;
  sampleMix: string;
  sampleRosterCount: number;
  sampleDraftSpendUsd: number;
  startingBudgetUsd: number;
  remainingBookingReserveUsd: number;
  sampleNamesPreview: string;
};

export type RevenueStreamRow = {
  revenueStreamId: string;
  displayName: string;
  trigger: string;
  baseFormula: string;
  easyModifier: number;
  mediumModifier: number;
  hardLegendModifier: number;
  scalesWith: string;
  payoutTiming: string;
  notes: string;
};

export type RosterDraftAndContractValueRow = {
  top200Rank: number;
  wrestlerId: string;
  performerName: string;
  promotion: string;
  brand: string;
  genderDivision: string;
  roleTier: string;
  availability: string;
  gameOverall: number;
  top200SelectionScore: number;
  draftValueUsd: number;
  weeklyHireRateUsd: number;
  initialDraftContractScope: string;
  initialDraftContractWeeks: string;
  initialDraftCostFormula: string;
  midseasonMinContractWeeks: number;
  midseasonDefaultContractWeeks: number;
  midseasonMaxContractWeeks: number;
  midseasonDefaultContractTotalUsd: number;
  midseasonMinContractTotalUsd: number;
  midseasonMaxContractTotalUsd: number;
  midseasonHiringCostFormula: string;
  appearanceFeeUsd: number;
  downsideGuaranteeUsd: number;
  releasePenaltyPct: number;
  moraleCostIfUnderbooked: number;
  renewalRisk: number;
  valueFormulaVersion: string;
  valueNotes: string;
  sourceRatingBasis: string;
  primaryRosterSourceUrl: string;
  ratingsSourceUrl: string;
};

export type SegmentBookingCostRow = {
  segmentId: string;
  segmentFamily: string;
  segmentGroup: string;
  displayName: string;
  variant: string;
  defaultMinParticipants: number;
  defaultMaxParticipants: number;
  defaultDurationMinutes: number;
  championshipAllowed: boolean;
  winnerRequired: boolean;
  weeklyTvBookingCostUsd: number;
  plePpvBookingCostUsd: number;
  costTier: string;
  talentAppearanceFeesApply: boolean;
  championshipSurchargeUsd: number;
  rivalrySurchargeUsd: number;
  baseStaminaCost: number;
  staminaCostPerMinute: number;
  computedDefaultStaminaCost: number;
  fatigueGain: number;
  injuryRiskDeltaPct: number;
  medicalRiskCostEstimate: number;
  bookingCostMultiplier: number;
  physicalRisk1To5: number;
  stipulationIntensity1To5: number;
  spectacle1To5: number;
  rivalryHeatDelta: number;
  crowdBuzzDelta: number;
  showQualityWeight: number;
  financeFormulaNotes: string;
};

export type ShowFinanceFormulaWeightRow = {
  formulaId: string;
  calculationName: string;
  formula: string;
  inputTables: string;
  outputField: string;
  notes: string;
};

export type VenueTierRow = {
  venueTierId: string;
  displayName: string;
  capacity: number;
  baseRentUsd: number;
  productionFloorUsd: number;
  averageTicketPriceUsd: number;
  prestige1To5: number;
  recommendedFor: string;
};

export type FinanceRosterMappingIssue = {
  wrestlerId: string;
  normalizedId: string;
  performerName: string;
  top200Rank: number;
};

export type DraftPoolFinanceMappingIssue = {
  wrestlerId: string;
  normalizedId: string;
  name: string;
  draftRank?: number;
};

export type FinanceRosterMappingReport = {
  financeRosterRows: number;
  draftPoolRows: number;
  mappedFinanceRows: number;
  unmappedFinanceRows: FinanceRosterMappingIssue[];
  draftPoolRowsWithoutFinanceValue: DraftPoolFinanceMappingIssue[];
  duplicateNormalizedFinanceIds: string[];
};

export const financeCatalogCsvFiles: Record<FinanceCatalogId, string> = {
  brandStartingBudgetTiers: brandStartingBudgetTiersCsv,
  contractCostRules: contractCostRulesCsv,
  expenseStreamCatalog: expenseStreamCatalogCsv,
  financeModelSummaryByRole: financeModelSummaryByRoleCsv,
  financeSourcesAndMethodology: financeSourcesAndMethodologyCsv,
  openingDraftBalanceExamples: openingDraftBalanceExamplesCsv,
  revenueStreamCatalog: revenueStreamCatalogCsv,
  rosterDraftAndContractValues: rosterDraftAndContractValuesCsv,
  segmentBookingCostCatalog: segmentBookingCostCatalogCsv,
  showFinanceFormulaWeights: showFinanceFormulaWeightsCsv,
  venueTierCatalog: venueTierCatalogCsv,
};

function parseCsv(csv: string): CsvRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      field += character;
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(field);
      field = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += character;
  }

  row.push(field);

  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;

  if (!headers?.length) {
    return [];
  }

  return dataRows.map((dataRow) =>
    headers.reduce<CsvRecord>((record, header, index) => {
      record[header] = dataRow[index] ?? "";
      return record;
    }, {}),
  );
}

function toNumber(value: string, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Finance catalog field ${fieldName} expected a number, received "${value}".`);
  }

  return parsed;
}

function toBoolean(value: string, fieldName: string) {
  if (value === "TRUE") {
    return true;
  }

  if (value === "FALSE") {
    return false;
  }

  throw new Error(`Finance catalog field ${fieldName} expected TRUE or FALSE, received "${value}".`);
}

function rowsFor(catalogId: FinanceCatalogId) {
  return parseCsv(financeCatalogCsvFiles[catalogId]);
}

function buildLookup<T>(rows: T[], getKey: (row: T) => string) {
  return new Map(rows.map((row) => [getKey(row), row]));
}

export function normalizeFinanceWrestlerId(wrestlerId: string) {
  return wrestlerId.trim().toLowerCase().replace(/_/g, "-");
}

export function normalizeAppWrestlerId(wrestlerId: string) {
  return wrestlerId.trim().toLowerCase().replace(/_/g, "-");
}

export const brandStartingBudgetTiers: BrandStartingBudgetTierRow[] = rowsFor("brandStartingBudgetTiers").map((row) => ({
  difficultyId: row.difficulty_id,
  displayName: row.display_name,
  startingBudgetUsd: toNumber(row.starting_budget_usd, "starting_budget_usd"),
  draftBudgetGuidanceUsd: toNumber(row.draft_budget_guidance_usd, "draft_budget_guidance_usd"),
  bookingReserveGuidanceUsd: toNumber(row.booking_reserve_guidance_usd, "booking_reserve_guidance_usd"),
  targetOpeningRosterCount: toNumber(row.target_opening_roster_count, "target_opening_roster_count"),
  targetRosterMix: row.target_roster_mix,
  expectedBudgetFeel: row.expected_budget_feel,
}));

export const contractCostRules: ContractCostRuleRow[] = rowsFor("contractCostRules").map((row) => ({
  ruleId: row.rule_id,
  phase: row.phase,
  costFormula: row.cost_formula,
  contractLength: row.contract_length,
  signingBonusAllowed: toBoolean(row.signing_bonus_allowed, "signing_bonus_allowed"),
  notes: row.notes,
}));

export const expenseStreams: ExpenseStreamRow[] = rowsFor("expenseStreamCatalog").map((row) => ({
  expenseStreamId: row.expense_stream_id,
  displayName: row.display_name,
  trigger: row.trigger,
  baseFormula: row.base_formula,
  difficultyBehavior: row.difficulty_behavior,
  notes: row.notes,
}));

export const financeModelSummaryByRole: FinanceModelSummaryByRoleRow[] = rowsFor("financeModelSummaryByRole").map((row) => ({
  roleTier: row.role_tier,
  count: toNumber(row.count, "count"),
  minDraftValueUsd: toNumber(row.min_draft_value_usd, "min_draft_value_usd"),
  medianDraftValueUsd: toNumber(row.median_draft_value_usd, "median_draft_value_usd"),
  maxDraftValueUsd: toNumber(row.max_draft_value_usd, "max_draft_value_usd"),
  medianWeeklyHireRateUsd: toNumber(row.median_weekly_hire_rate_usd, "median_weekly_hire_rate_usd"),
  contractNotes: row.contract_notes,
}));

export const financeSourcesAndMethodology: FinanceSourceMethodologyRow[] = rowsFor("financeSourcesAndMethodology").map((row) => ({
  topic: row.topic,
  method: row.method,
}));

export const openingDraftBalanceExamples: OpeningDraftBalanceExampleRow[] = rowsFor("openingDraftBalanceExamples").map((row) => ({
  difficultyId: row.difficulty_id,
  sampleMix: row.sample_mix,
  sampleRosterCount: toNumber(row.sample_roster_count, "sample_roster_count"),
  sampleDraftSpendUsd: toNumber(row.sample_draft_spend_usd, "sample_draft_spend_usd"),
  startingBudgetUsd: toNumber(row.starting_budget_usd, "starting_budget_usd"),
  remainingBookingReserveUsd: toNumber(row.remaining_booking_reserve_usd, "remaining_booking_reserve_usd"),
  sampleNamesPreview: row.sample_names_preview,
}));

export const revenueStreams: RevenueStreamRow[] = rowsFor("revenueStreamCatalog").map((row) => ({
  revenueStreamId: row.revenue_stream_id,
  displayName: row.display_name,
  trigger: row.trigger,
  baseFormula: row.base_formula,
  easyModifier: toNumber(row.easy_modifier, "easy_modifier"),
  mediumModifier: toNumber(row.medium_modifier, "medium_modifier"),
  hardLegendModifier: toNumber(row.hard_legend_modifier, "hard_legend_modifier"),
  scalesWith: row.scales_with,
  payoutTiming: row.payout_timing,
  notes: row.notes,
}));

export const rosterDraftAndContractValues: RosterDraftAndContractValueRow[] = rowsFor("rosterDraftAndContractValues").map((row) => ({
  top200Rank: toNumber(row.top_200_rank, "top_200_rank"),
  wrestlerId: row.wrestler_id,
  performerName: row.performer_name,
  promotion: row.promotion,
  brand: row.brand,
  genderDivision: row.gender_division,
  roleTier: row.role_tier,
  availability: row.availability,
  gameOverall: toNumber(row.game_overall, "game_overall"),
  top200SelectionScore: toNumber(row.top_200_selection_score, "top_200_selection_score"),
  draftValueUsd: toNumber(row.draft_value_usd, "draft_value_usd"),
  weeklyHireRateUsd: toNumber(row.weekly_hire_rate_usd, "weekly_hire_rate_usd"),
  initialDraftContractScope: row.initial_draft_contract_scope,
  initialDraftContractWeeks: row.initial_draft_contract_weeks,
  initialDraftCostFormula: row.initial_draft_cost_formula,
  midseasonMinContractWeeks: toNumber(row.midseason_min_contract_weeks, "midseason_min_contract_weeks"),
  midseasonDefaultContractWeeks: toNumber(row.midseason_default_contract_weeks, "midseason_default_contract_weeks"),
  midseasonMaxContractWeeks: toNumber(row.midseason_max_contract_weeks, "midseason_max_contract_weeks"),
  midseasonDefaultContractTotalUsd: toNumber(row.midseason_default_contract_total_usd, "midseason_default_contract_total_usd"),
  midseasonMinContractTotalUsd: toNumber(row.midseason_min_contract_total_usd, "midseason_min_contract_total_usd"),
  midseasonMaxContractTotalUsd: toNumber(row.midseason_max_contract_total_usd, "midseason_max_contract_total_usd"),
  midseasonHiringCostFormula: row.midseason_hiring_cost_formula,
  appearanceFeeUsd: toNumber(row.appearance_fee_usd, "appearance_fee_usd"),
  downsideGuaranteeUsd: toNumber(row.downside_guarantee_usd, "downside_guarantee_usd"),
  releasePenaltyPct: toNumber(row.release_penalty_pct, "release_penalty_pct"),
  moraleCostIfUnderbooked: toNumber(row.morale_cost_if_underbooked, "morale_cost_if_underbooked"),
  renewalRisk: toNumber(row.renewal_risk, "renewal_risk"),
  valueFormulaVersion: row.value_formula_version,
  valueNotes: row.value_notes,
  sourceRatingBasis: row.source_rating_basis,
  primaryRosterSourceUrl: row.primary_roster_source_url,
  ratingsSourceUrl: row.ratings_source_url,
}));

export const segmentBookingCosts: SegmentBookingCostRow[] = rowsFor("segmentBookingCostCatalog").map((row) => ({
  segmentId: row.segment_id,
  segmentFamily: row.segment_family,
  segmentGroup: row.segment_group,
  displayName: row.display_name,
  variant: row.variant,
  defaultMinParticipants: toNumber(row.default_min_participants, "default_min_participants"),
  defaultMaxParticipants: toNumber(row.default_max_participants, "default_max_participants"),
  defaultDurationMinutes: toNumber(row.default_duration_minutes, "default_duration_minutes"),
  championshipAllowed: toBoolean(row.championship_allowed, "championship_allowed"),
  winnerRequired: toBoolean(row.winner_required, "winner_required"),
  weeklyTvBookingCostUsd: toNumber(row.weekly_tv_booking_cost_usd, "weekly_tv_booking_cost_usd"),
  plePpvBookingCostUsd: toNumber(row.ple_ppv_booking_cost_usd, "ple_ppv_booking_cost_usd"),
  costTier: row.cost_tier,
  talentAppearanceFeesApply: toBoolean(row.talent_appearance_fees_apply, "talent_appearance_fees_apply"),
  championshipSurchargeUsd: toNumber(row.championship_surcharge_usd, "championship_surcharge_usd"),
  rivalrySurchargeUsd: toNumber(row.rivalry_surcharge_usd, "rivalry_surcharge_usd"),
  baseStaminaCost: toNumber(row.base_stamina_cost, "base_stamina_cost"),
  staminaCostPerMinute: toNumber(row.stamina_cost_per_minute, "stamina_cost_per_minute"),
  computedDefaultStaminaCost: toNumber(row.computed_default_stamina_cost, "computed_default_stamina_cost"),
  fatigueGain: toNumber(row.fatigue_gain, "fatigue_gain"),
  injuryRiskDeltaPct: toNumber(row.injury_risk_delta_pct, "injury_risk_delta_pct"),
  medicalRiskCostEstimate: toNumber(row.medical_risk_cost_estimate, "medical_risk_cost_estimate"),
  bookingCostMultiplier: toNumber(row.booking_cost_multiplier, "booking_cost_multiplier"),
  physicalRisk1To5: toNumber(row.physical_risk_1_5, "physical_risk_1_5"),
  stipulationIntensity1To5: toNumber(row.stipulation_intensity_1_5, "stipulation_intensity_1_5"),
  spectacle1To5: toNumber(row.spectacle_1_5, "spectacle_1_5"),
  rivalryHeatDelta: toNumber(row.rivalry_heat_delta, "rivalry_heat_delta"),
  crowdBuzzDelta: toNumber(row.crowd_buzz_delta, "crowd_buzz_delta"),
  showQualityWeight: toNumber(row.show_quality_weight, "show_quality_weight"),
  financeFormulaNotes: row.finance_formula_notes,
}));

export const showFinanceFormulaWeights: ShowFinanceFormulaWeightRow[] = rowsFor("showFinanceFormulaWeights").map((row) => ({
  formulaId: row.formula_id,
  calculationName: row.calculation_name,
  formula: row.formula,
  inputTables: row.input_tables,
  outputField: row.output_field,
  notes: row.notes,
}));

export const venueTiers: VenueTierRow[] = rowsFor("venueTierCatalog").map((row) => ({
  venueTierId: row.venue_tier_id,
  displayName: row.display_name,
  capacity: toNumber(row.capacity, "capacity"),
  baseRentUsd: toNumber(row.base_rent_usd, "base_rent_usd"),
  productionFloorUsd: toNumber(row.production_floor_usd, "production_floor_usd"),
  averageTicketPriceUsd: toNumber(row.average_ticket_price_usd, "average_ticket_price_usd"),
  prestige1To5: toNumber(row.prestige_1_5, "prestige_1_5"),
  recommendedFor: row.recommended_for,
}));

const brandStartingBudgetTierByDifficultyId = buildLookup(brandStartingBudgetTiers, (row) => row.difficultyId);
const contractCostRuleById = buildLookup(contractCostRules, (row) => row.ruleId);
const expenseStreamById = buildLookup(expenseStreams, (row) => row.expenseStreamId);
const revenueStreamById = buildLookup(revenueStreams, (row) => row.revenueStreamId);
const rosterFinanceRowByNormalizedWrestlerId = buildLookup(rosterDraftAndContractValues, (row) => normalizeFinanceWrestlerId(row.wrestlerId));
const segmentBookingCostById = buildLookup(segmentBookingCosts, (row) => row.segmentId);
const venueTierById = buildLookup(venueTiers, (row) => row.venueTierId);

export const financeCatalogs = {
  brandStartingBudgetTiers,
  contractCostRules,
  expenseStreams,
  financeModelSummaryByRole,
  financeSourcesAndMethodology,
  openingDraftBalanceExamples,
  revenueStreams,
  rosterDraftAndContractValues,
  segmentBookingCosts,
  showFinanceFormulaWeights,
  venueTiers,
} as const;

export function getBrandStartingBudgetTier(difficultyId: string) {
  return brandStartingBudgetTierByDifficultyId.get(difficultyId);
}

export function getContractCostRule(ruleId: string) {
  return contractCostRuleById.get(ruleId);
}

export function getExpenseStream(expenseStreamId: string) {
  return expenseStreamById.get(expenseStreamId);
}

export function getRevenueStream(revenueStreamId: string) {
  return revenueStreamById.get(revenueStreamId);
}

export function getRosterFinanceValueByWrestlerId(wrestlerId: string) {
  return rosterFinanceRowByNormalizedWrestlerId.get(normalizeAppWrestlerId(wrestlerId));
}

export function getRosterFinanceValueForWrestler(wrestler: Pick<Wrestler, "id">) {
  return getRosterFinanceValueByWrestlerId(wrestler.id);
}

export function getSegmentBookingCost(segmentId: string) {
  return segmentBookingCostById.get(segmentId);
}

export function getVenueTier(venueTierId: string) {
  return venueTierById.get(venueTierId);
}

export function getDuplicateNormalizedFinanceRosterIds() {
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();

  rosterDraftAndContractValues.forEach((row) => {
    const normalizedId = normalizeFinanceWrestlerId(row.wrestlerId);

    if (seenIds.has(normalizedId)) {
      duplicateIds.add(normalizedId);
    }

    seenIds.add(normalizedId);
  });

  return [...duplicateIds].sort();
}

export function createFinanceRosterMappingReport(draftPool: Pick<Wrestler, "id" | "name" | "draftRank">[] = top200DraftPool): FinanceRosterMappingReport {
  const draftPoolIds = new Set(draftPool.map((wrestler) => normalizeAppWrestlerId(wrestler.id)));
  const financeIds = new Set(rosterDraftAndContractValues.map((row) => normalizeFinanceWrestlerId(row.wrestlerId)));
  const unmappedFinanceRows = rosterDraftAndContractValues
    .filter((row) => !draftPoolIds.has(normalizeFinanceWrestlerId(row.wrestlerId)))
    .map((row) => ({
      wrestlerId: row.wrestlerId,
      normalizedId: normalizeFinanceWrestlerId(row.wrestlerId),
      performerName: row.performerName,
      top200Rank: row.top200Rank,
    }));
  const draftPoolRowsWithoutFinanceValue = draftPool
    .filter((wrestler) => !financeIds.has(normalizeAppWrestlerId(wrestler.id)))
    .map((wrestler) => ({
      wrestlerId: wrestler.id,
      normalizedId: normalizeAppWrestlerId(wrestler.id),
      name: wrestler.name,
      draftRank: wrestler.draftRank,
    }));

  return {
    financeRosterRows: rosterDraftAndContractValues.length,
    draftPoolRows: draftPool.length,
    mappedFinanceRows: rosterDraftAndContractValues.length - unmappedFinanceRows.length,
    unmappedFinanceRows,
    draftPoolRowsWithoutFinanceValue,
    duplicateNormalizedFinanceIds: getDuplicateNormalizedFinanceRosterIds(),
  };
}

export const financeRosterMappingReport = createFinanceRosterMappingReport();
