import { useEffect, useState } from "react";
import { CommandPanel, HeroDecisionPanel, MetricTile, getBroadcastTheme } from "../components/broadcast";
import { SetupBrandPortraitGrid } from "../components/SetupBrandPortraitGrid";
import { SetupGmPortraitGrid } from "../components/SetupGmPortraitGrid";
import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import { getRosterFinanceValueForWrestler } from "../game/financeCatalog";
import { formatMoney } from "../game/formatters";
import { getDifficultyRules } from "../game/difficultyRules";
import { PLE_COUNT, PLE_CYCLE_WEEKS, SEASON_WEEK_COUNT } from "../game/constants";
import { simulateOpeningDraft } from "../game/openingDraft";
import { createRivalBrandUniverse, createRivalGMAssignments, defaultCareer, draftPool, getStartingBudgetAmount } from "../game/seed";
import { getWrestlerDivisionGroup } from "../game/scoring";
import { brandChairs, getBrandChairByStyle } from "../game/brandChairs";
import { getGmPersonaByStyle, gmPersonas } from "../game/gmPersonas";
import type { BrandStyle, DraftMode, GameDifficulty, GMStyle, RivalGMAssignment, StartingBudgetTier, Wrestler } from "../game/types";
import {
  brandStyleOptions,
  difficultyOptions,
  draftArchetypeFilters,
  draftAvailabilityFilters,
  draftBrandFilters,
  draftRoleTierFilters,
  draftSortOptions,
  formatDraftGenderReadout,
  formatProjectedReserve,
  formatSetupBudgetHeaderReadout,
  formatSetupBudgetRulesReadout,
  getDraftBundleOffers,
  getDraftFinanceReadout,
  getDraftProspectNameClass,
  getDraftSearchText,
  getDraftSortValue,
  getDraftTag,
  getSetupBudgetModeLabel,
  getSetupBudgetRulesDetail,
  getSetupDraftModeLabel,
  getSetupDraftRulesDetail,
  getWrestlerOverall,
  recommendedDraftRosterTarget,
  selectSetupBudgetMode,
  selectSetupDraftMode,
  setupBudgetModeOptions,
  setupDraftModeOptions,
  tvReadyDraftRosterTarget,
  type ChoiceOption,
  type DraftBundleOffer,
  type DraftSort,
  type SetupStep,
} from "./setupReads";
import "./setup.css";

export type StartCareerConfig = {
  gmName: string;
  gmStyle: GMStyle;
  brandName: string;
  brandStyle: BrandStyle;
  difficulty: GameDifficulty;
  startingBudgetTier: StartingBudgetTier;
  draftMode: DraftMode;
  rivalGMAssignments: RivalGMAssignment[];
  draftedWrestlers: Wrestler[];
  draftPickGroups?: string[][];
  draftBundleDiscountUsd?: number;
};

export function NewGameSetupScreen({
  onCancel,
  onStartCareer,
}
: {
  onCancel: () => void;
  onStartCareer: (career: {
    gmName: string;
    gmStyle: GMStyle;
    brandName: string;
    brandStyle: BrandStyle;
    difficulty: GameDifficulty;
    startingBudgetTier: StartingBudgetTier;
    draftMode: DraftMode;
    rivalGMAssignments: RivalGMAssignment[];
    draftedWrestlers: Wrestler[];
    draftPickGroups?: string[][];
    draftBundleDiscountUsd?: number;
  }) => void;
}) {
  const [step, setStep] = useState<SetupStep>("contract");
  const [gmName, setGmName] = useState(defaultCareer.gmName);
  const [gmStyle, setGmStyle] = useState<GMStyle>(defaultCareer.gmStyle);
  const [brandName, setBrandName] = useState(defaultCareer.brandName);
  const [brandStyle, setBrandStyle] = useState<BrandStyle>(defaultCareer.brandStyle);
  const [difficulty, setDifficulty] = useState<GameDifficulty>(defaultCareer.difficulty);
  const [startingBudgetTier, setStartingBudgetTier] = useState<StartingBudgetTier>(defaultCareer.startingBudgetTier);
  const [draftMode, setDraftMode] = useState<DraftMode>(defaultCareer.draftMode);
  const [rivalGMAssignments, setRivalGMAssignments] = useState<RivalGMAssignment[]>(() => createRivalGMAssignments(defaultCareer.brandStyle));
  const [draftedWrestlers, setDraftedWrestlers] = useState<Wrestler[]>([]);
  const [draftPickGroups, setDraftPickGroups] = useState<string[][]>([]);
  const [draftBundleDiscountUsd, setDraftBundleDiscountUsd] = useState(0);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftSort, setDraftSort] = useState<DraftSort>("rank");
  const [draftBrandFilter, setDraftBrandFilter] = useState(draftBrandFilters[0]);
  const [draftRoleTierFilter, setDraftRoleTierFilter] = useState(draftRoleTierFilters[0]);
  const [draftAvailabilityFilter, setDraftAvailabilityFilter] = useState(draftAvailabilityFilters[0]);
  const [draftArchetypeFilter, setDraftArchetypeFilter] = useState(draftArchetypeFilters[0]);
  const [draftFocusId, setDraftFocusId] = useState<string>();
  const selectedGmPersona = getGmPersonaByStyle(gmStyle);
  const selectedBrandChair = getBrandChairByStyle(brandStyle);
  const selectedDifficulty = difficultyOptions.find((option) => option.label === difficulty) ?? difficultyOptions[1];
  const selectedDifficultyRules = getDifficultyRules(difficulty);
  const startingBudgetAmount = getStartingBudgetAmount(startingBudgetTier);
  const draftFinanceReadout = getDraftFinanceReadout(draftedWrestlers, startingBudgetTier, startingBudgetAmount, draftBundleDiscountUsd);
  const canPreview = gmName.trim().length > 0 && brandName.trim().length > 0;
  const signedBrandName = brandName.trim() || defaultCareer.brandName;
  const signedGmName = gmName.trim() || defaultCareer.gmName;
  const draftSearchTerm = draftSearch.trim().toLowerCase();
  const draftSeed = `${brandStyle}-${signedGmName}`;
  const draftedIds = new Set(draftedWrestlers.map((wrestler) => wrestler.id));
  const previewRivalBrands = createRivalBrandUniverse(rivalGMAssignments);
  const openingDraftState = simulateOpeningDraft({
    draftMode,
    difficulty,
    draftSeed,
    draftPool,
    playerBrandName: signedBrandName,
    rivalBrands: previewRivalBrands,
    playerDraftedWrestlers: draftedWrestlers,
    playerDraftGroups: draftPickGroups,
    playerPickTarget: Math.max(tvReadyDraftRosterTarget, draftPickGroups.length + 1),
  });
  const cpuClaimedDraftIds = new Set(openingDraftState.cpuClaimedWrestlerIds);
  const availableDraftCount = openingDraftState.availableCount;
  const rivalLatestPicks = previewRivalBrands.map((brand) => {
    const roster = openingDraftState.rostersByChairId[brand.id] ?? [];
    return {
      brand,
      latestPick: roster[roster.length - 1],
      pickCount: roster.length,
    };
  });
  const rivalLatestPickIds = new Set(
    rivalLatestPicks.map((entry) => entry.latestPick?.id).filter((id): id is string => Boolean(id)),
  );
  const rivalPickHistory = openingDraftState.cpuPicks
    .slice()
    .reverse()
    .filter((event) => !rivalLatestPickIds.has(event.wrestler.id));
  const upNextPicks = openingDraftState.upcomingPicks.slice(1, 5);
  const availableWrestlers = draftPool
    .filter((wrestler) => !draftedIds.has(wrestler.id))
    .filter((wrestler) => !cpuClaimedDraftIds.has(wrestler.id))
    .filter((wrestler) => !draftSearchTerm || getDraftSearchText(wrestler).includes(draftSearchTerm))
    .filter((wrestler) => draftBrandFilter === "All Brands" || wrestler.sourceBrand === draftBrandFilter)
    .filter((wrestler) => draftRoleTierFilter === "All Tiers" || wrestler.roleTier === draftRoleTierFilter)
    .filter((wrestler) => draftAvailabilityFilter === "All Status" || wrestler.sourceAvailability === draftAvailabilityFilter)
    .filter((wrestler) => draftArchetypeFilter === "All Styles" || wrestler.archetype === draftArchetypeFilter)
    .sort((a, b) => getDraftSortValue(b, draftSort) - getDraftSortValue(a, draftSort));
  const availableDraftWrestlers = draftPool.filter((wrestler) => !draftedIds.has(wrestler.id) && !cpuClaimedDraftIds.has(wrestler.id));
  const draftBundleOffers = getDraftBundleOffers(availableDraftWrestlers);
  const boardLeader = availableWrestlers[0];
  const focusedDraftWrestler = availableWrestlers.find((wrestler) => wrestler.id === draftFocusId) ?? boardLeader;
  const focusedDraftBundleOffer = focusedDraftWrestler ? draftBundleOffers.find((offer) => offer.wrestlerIds.includes(focusedDraftWrestler.id)) : undefined;
  const readinessRemaining = Math.max(0, tvReadyDraftRosterTarget - draftedWrestlers.length);
  const currentDraftPick = openingDraftState.currentPick;
  const currentPlayerPickLabel = `${draftedWrestlers.length}/${recommendedDraftRosterTarget} target`;
  const currentOverallPickLabel = currentDraftPick ? `Pick ${currentDraftPick.overallPick}` : "Locked";
  const focusedDraftFinance = focusedDraftWrestler ? getRosterFinanceValueForWrestler(focusedDraftWrestler) : undefined;
  const focusedDraftOverall = focusedDraftWrestler ? getWrestlerOverall(focusedDraftWrestler) : 0;
  const focusedDraftCost = focusedDraftFinance?.draftValueUsd ?? 0;
  const focusedDraftExceedsBudget =
    Boolean(focusedDraftWrestler && focusedDraftFinance) &&
    !draftFinanceReadout.isUnlimitedBudget &&
    focusedDraftCost > draftFinanceReadout.projectedReserve;
  const focusedDraftBundleExceedsBudget =
    Boolean(focusedDraftBundleOffer) &&
    !draftFinanceReadout.isUnlimitedBudget &&
    (focusedDraftBundleOffer?.discountedValue ?? 0) > draftFinanceReadout.projectedReserve;
  const canDraftFocusedWrestler = Boolean(focusedDraftWrestler && !focusedDraftExceedsBudget);
  const canEnterWeekOne = canPreview;
  const draftClockRead =
    draftedWrestlers.length === 0
      ? `${signedBrandName} has the first pick.`
      : readinessRemaining > 0
        ? `${readinessRemaining} more reaches TV-ready guidance.`
        : draftedWrestlers.length < recommendedDraftRosterTarget
          ? `TV-ready. ${recommendedDraftRosterTarget - draftedWrestlers.length} more reaches the healthy roster target.`
        : currentDraftPick
          ? `Overall pick ${currentDraftPick.overallPick} is live.`
          : "Opening board locked.";
  const draftedRosterNeedRows = [
    { label: "Roster", count: draftedWrestlers.length, target: recommendedDraftRosterTarget },
    { label: "Main Event", count: draftedWrestlers.filter((wrestler) => getDraftTag(wrestler.roleTier).includes("Main")).length, target: 2 },
    { label: "Talkers", count: draftedWrestlers.filter((wrestler) => wrestler.promoSkill >= 82).length, target: 4 },
    { label: "Workers", count: draftedWrestlers.filter((wrestler) => wrestler.ringSkill >= 82).length, target: 4 },
    { label: "Women", count: draftedWrestlers.filter((wrestler) => getWrestlerDivisionGroup(wrestler) === "womens").length, target: 4 },
  ];

  useEffect(() => {
    if (!availableWrestlers.length) {
      if (draftFocusId) {
        setDraftFocusId(undefined);
      }
      return;
    }

    if (!draftFocusId || !availableWrestlers.some((wrestler) => wrestler.id === draftFocusId)) {
      setDraftFocusId(availableWrestlers[0].id);
    }
  }, [availableWrestlers, draftFocusId]);

  function startCareer() {
    if (!canEnterWeekOne) {
      return;
    }

    onStartCareer({
      gmName: gmName.trim(),
      gmStyle,
      brandName: brandName.trim(),
      brandStyle,
      difficulty,
      startingBudgetTier,
      draftMode,
      rivalGMAssignments,
      draftedWrestlers,
      draftPickGroups,
      draftBundleDiscountUsd,
    });
  }

  function draftWrestler(wrestler: Wrestler) {
    const financeRow = getRosterFinanceValueForWrestler(wrestler);
    const draftCost = financeRow?.draftValueUsd ?? 0;

    if (
      draftedWrestlers.some((drafted) => drafted.id === wrestler.id) ||
      (financeRow && !draftFinanceReadout.isUnlimitedBudget && draftCost > draftFinanceReadout.projectedReserve)
    ) {
      return;
    }

    setDraftedWrestlers((current) => [...current, wrestler]);
    setDraftPickGroups((current) => [...current, [wrestler.id]]);
  }

  function draftFocusedWrestler() {
    if (!focusedDraftWrestler) {
      return;
    }

    draftWrestler(focusedDraftWrestler);
  }

  function draftBundle(offer: DraftBundleOffer) {
    const alreadyUnavailable = offer.wrestlers.some((wrestler) => draftedIds.has(wrestler.id) || cpuClaimedDraftIds.has(wrestler.id));

    if (alreadyUnavailable || (!draftFinanceReadout.isUnlimitedBudget && offer.discountedValue > draftFinanceReadout.projectedReserve)) {
      return;
    }

    setDraftedWrestlers((current) => [...current, ...offer.wrestlers]);
    setDraftPickGroups((current) => [...current, offer.wrestlerIds]);
    setDraftBundleDiscountUsd((current) => current + offer.discountAmount);
  }

  function resetDraftBoard() {
    setDraftSearch("");
    setDraftSort("rank");
    setDraftBrandFilter(draftBrandFilters[0]);
    setDraftRoleTierFilter(draftRoleTierFilters[0]);
    setDraftAvailabilityFilter(draftAvailabilityFilters[0]);
    setDraftArchetypeFilter(draftArchetypeFilters[0]);
    setDraftFocusId(undefined);
  }

  function resetDraftSelections() {
    setDraftedWrestlers([]);
    setDraftPickGroups([]);
    setDraftBundleDiscountUsd(0);
    setDraftFocusId(undefined);
  }

  function applyDraftMode(mode: DraftMode) {
    setDraftMode(mode);
    resetDraftSelections();
  }

  function selectBrandStyle(choice: string) {
    const nextBrandStyle = choice as BrandStyle;
    const currentBrandStyleLabel = brandStyleOptions.find((option) => option.label === brandStyle)?.label ?? defaultCareer.brandName;
    const shouldSyncBrandName = !brandName.trim() || brandName.trim() === currentBrandStyleLabel || brandName.trim() === defaultCareer.brandName;

    setBrandStyle(nextBrandStyle);
    setRivalGMAssignments(createRivalGMAssignments(nextBrandStyle));

    if (shouldSyncBrandName) {
      setBrandName(choice);
    }
  }

  const setupSteps: Array<{ id: SetupStep; label: string; detail: string }> = [
    { id: "contract", label: "Contract", detail: "Accept the job" },
    { id: "rules", label: "Rules", detail: "Set pressure" },
    { id: "gm", label: "GM", detail: "Choose identity" },
    { id: "brand", label: "Brand", detail: "Take a chair" },
    { id: "draft", label: "Draft", detail: "Build roster" },
  ];
  const activeSetupIndex = setupSteps.findIndex((item) => item.id === step);
  const brandStepIndex = setupSteps.findIndex((item) => item.id === "brand");
  const hasReachedBrandStep = activeSetupIndex >= brandStepIndex;
  const currentStepLabel = setupSteps[activeSetupIndex]?.label ?? "Career";
  const nextActionLabel =
    step === "contract"
      ? "Set Rules"
      : step === "rules"
        ? "Choose GM"
        : step === "gm"
          ? "Choose Brand"
          : step === "brand"
            ? "Draft Night"
            : step === "draft"
              ? "Week 1"
              : "Career";
  const rivalSummary = previewRivalBrands.map((brand) => `${brand.brandName}: ${brand.assignedGMName}`).join(" / ");
  const setupBrandLabel = hasReachedBrandStep ? brandName.trim() || "Choose Brand" : "Unassigned";
  const setupTheme = hasReachedBrandStep ? getBroadcastTheme(brandStyle) : "neutral";

  return (
    <main
      className={`dashboard-dynasty-shell setup-dynasty-shell ${hasReachedBrandStep ? `broadcast-theme-${setupTheme}` : "setup-pre-brand"} setup-screen setup-step-${step}`}
      data-broadcast-theme={setupTheme}
    >
      <header className="dashboard-dynasty-header setup-dynasty-header">
        <section className="dashboard-dynasty-logo-lockup">
          <span>Next GM</span>
          <strong className={hasReachedBrandStep ? "" : "setup-pending-label"}>{setupBrandLabel}</strong>
        </section>
        <section className="dashboard-dynasty-header-module">
          <span>Career Start</span>
          <strong>{currentStepLabel} Desk</strong>
        </section>
        <section className="dashboard-dynasty-header-module">
          <span>Progress</span>
          <strong>
            {activeSetupIndex + 1} / {setupSteps.length}
          </strong>
        </section>
        <section className="dashboard-dynasty-header-module">
          <span>Difficulty</span>
          <strong>{difficulty}</strong>
        </section>
        <section className="dashboard-dynasty-header-module">
          <span>Opening Budget</span>
          <strong className="dashboard-dynasty-gold">{formatSetupBudgetHeaderReadout(startingBudgetTier)}</strong>
        </section>
        <section className="dashboard-dynasty-next-show setup-dynasty-cta">
          <span>Next Action</span>
          <strong>{nextActionLabel}</strong>
        </section>
      </header>

      {step === "draft" ? null : (
        <div className="setup-dynasty-progress" aria-label="Career start progress">
          {setupSteps.map((item, index) => (
            <div
              className={`setup-dynasty-progress-step${step === item.id ? " is-active" : ""}${index < activeSetupIndex ? " is-complete" : ""}`}
              key={item.id}
            >
              <span>Step {index + 1}</span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
      )}

      <div className="setup-dynasty-body">
      <section className="setup-shell">
        <div className={`setup-layout${step === "draft" ? " draft-war-room-layout" : ""}`}>
          <div className={`setup-workspace${step === "draft" ? " draft-war-room-workspace" : ""}`}>

        {step === "contract" ? (
          <div className="setup-panel setup-command-panel">
            <HeroDecisionPanel
              actions={
                <>
                  <button className="primary-action" onClick={() => setStep("rules")}>
                    Accept The Job
                  </button>
                  <button className="secondary-action" onClick={onCancel}>
                    Back
                  </button>
                </>
              }
              eyebrow="Sign The Contract"
              metrics={
                <>
                  <MetricTile detail={`${PLE_COUNT} PLE cycles, every ${PLE_CYCLE_WEEKS} weeks`} label="Season" tone="prestige" value={`${SEASON_WEEK_COUNT} Weeks`} />
                  <MetricTile detail={`${tvReadyDraftRosterTarget} TV-ready guidance, ${recommendedDraftRosterTarget} healthy roster target`} label="Draft Night" tone="brand" value={`${tvReadyDraftRosterTarget} guide / ${recommendedDraftRosterTarget} target`} />
                  <MetricTile detail="Four major brands in the GM universe" label="Universe" tone="info" value="4 Brands" />
                </>
              }
              summary="A national broadcast window is open, the roster is restless, and the GM room is filling up. Ownership is hiring you to run a brand over seasons, not just survive one hot night."
              title="You're Hired"
            />
          </div>
        ) : null}

        {step === "gm" ? (
          <div className="setup-panel setup-command-panel">
            <CommandPanel className="setup-gm-desk" eyebrow="Choose GM Identity" title="Who Runs The Room?" tone="brand">
              <SetupGmPortraitGrid
                onSelect={(persona) => {
                  setGmName(persona.name);
                  setGmStyle(persona.style);
                }}
                personas={gmPersonas}
                selectedStyle={gmStyle}
              />
              <div className="setup-gm-footer">
                <div className="identity-note setup-gm-identity-note">
                  <p>
                    <strong>{selectedGmPersona.name}</strong> · {selectedGmPersona.style} — {selectedGmPersona.description}
                  </p>
                </div>
                <div className="title-actions setup-gm-actions">
                  <button className="secondary-action" onClick={() => setStep("rules")}>
                    Back
                  </button>
                  <button className="primary-action" onClick={() => setStep("brand")}>
                    Continue
                  </button>
                </div>
              </div>
            </CommandPanel>
          </div>
        ) : null}

        {step === "brand" ? (
          <div className="setup-panel setup-command-panel">
            <CommandPanel className="setup-brand-desk" eyebrow="Choose Your Seat" title="Which Brand Chair Is Yours?" tone="brand">
              <SetupBrandPortraitGrid
                chairs={brandChairs}
                onSelect={(chair) => selectBrandStyle(chair.style)}
                selectedStyle={brandStyle}
              />
              <div className="setup-brand-footer">
                <div className="identity-note setup-brand-identity-note">
                  <p>
                    <strong>{selectedBrandChair.style}</strong> — {selectedBrandChair.description}
                  </p>
                </div>
                <div className="title-actions setup-brand-actions">
                  <button className="secondary-action" onClick={() => setStep("gm")}>
                    Back
                  </button>
                  <button className="primary-action" disabled={!canPreview} onClick={() => setStep("draft")}>
                    Enter Draft Night
                  </button>
                </div>
              </div>
            </CommandPanel>
          </div>
        ) : null}

        {step === "rules" ? (
          <div className="setup-panel setup-command-panel">
            <CommandPanel className="setup-rules-desk" eyebrow="Game Rules" title="Set The Pressure Level" tone="brand">
              <p className="lede setup-rules-lede">Choose difficulty, budget mode, and draft order before Draft Night.</p>
              <div className="setup-rules-compact">
                <section className="setup-rules-difficulty-section">
                  <p className="eyebrow">Difficulty</p>
                  <ChoiceGrid
                    choices={difficultyOptions}
                    selected={difficulty}
                    onSelect={(choice) => setDifficulty(choice as GameDifficulty)}
                    variant="identity"
                  />
                </section>
                <div className="setup-rules-modes-row">
                  <section className="setup-rules-budget-section">
                    <p className="eyebrow">Budget Mode</p>
                    <ChoiceGrid
                      choices={setupBudgetModeOptions}
                      selected={getSetupBudgetModeLabel(startingBudgetTier)}
                      onSelect={(choice) => setStartingBudgetTier(selectSetupBudgetMode(choice))}
                      variant="identity"
                    />
                  </section>
                  <section className="setup-rules-draft-section">
                    <p className="eyebrow">Draft Mode</p>
                    <ChoiceGrid
                      choices={setupDraftModeOptions}
                      selected={getSetupDraftModeLabel(draftMode)}
                      onSelect={(choice) => applyDraftMode(selectSetupDraftMode(choice))}
                      variant="identity"
                    />
                  </section>
                </div>
              </div>
              <div className="identity-note setup-rules-summary">
                <p className="eyebrow">Selected Rules</p>
                <strong>
                  {difficulty} / {formatSetupBudgetRulesReadout(startingBudgetTier, startingBudgetAmount)} / {getSetupDraftModeLabel(draftMode)}
                </strong>
                <p>
                  {selectedDifficulty.description} {selectedDifficultyRules.setupSummary} {getSetupBudgetRulesDetail(startingBudgetTier, startingBudgetAmount)} {getSetupDraftRulesDetail(draftMode)}
                </p>
              </div>
              <div className="title-actions setup-rules-actions">
                <button className="secondary-action" onClick={() => setStep("contract")}>
                  Back
                </button>
                <button className="primary-action" onClick={() => setStep("gm")}>
                  Choose GM Identity
                </button>
              </div>
            </CommandPanel>
          </div>
        ) : null}

        {step === "draft" ? (
          <div className="draft-war-room" aria-label="Draft Night war room">
            <header className="draft-war-room-hud">
              <div className="draft-night-title">
                <h1>Draft Night</h1>
              </div>
              <div className="draft-feed-banner">
                <span>Feed</span>
                <strong>{draftClockRead}</strong>
              </div>
              <div className="draft-hud-metric">
                <span>Budget</span>
                <strong>{formatProjectedReserve(draftFinanceReadout)}</strong>
              </div>
              <div className="draft-hud-metric timer">
                <span>Clock</span>
                <strong>{currentOverallPickLabel}</strong>
              </div>
              <div className="draft-brand-badge">
                <span>Room</span>
                <strong>
                  {signedBrandName}
                  <em>{currentPlayerPickLabel}</em>
                </strong>
              </div>
            </header>

            <section className="draft-war-room-grid">
              <aside className="draft-board-panel" aria-label="Available talent">
                <div className="draft-panel-head">
                  <div>
                    <p className="eyebrow">Available Talent</p>
                    <h2>{availableWrestlers.length} Showing</h2>
                  </div>
                  <button className="secondary-action" onClick={resetDraftBoard} type="button">
                    Reset
                  </button>
                </div>
                <div className="draft-tools draft-war-toolbar" aria-label="Draft board controls">
                  <label>
                    Search
                    <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Find a performer" />
                  </label>
                  <label>
                    Sort
                    <select value={draftSort} onChange={(event) => setDraftSort(event.target.value as DraftSort)}>
                      {draftSortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Brand
                    <select value={draftBrandFilter} onChange={(event) => setDraftBrandFilter(event.target.value)}>
                      {draftBrandFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tier
                    <select value={draftRoleTierFilter} onChange={(event) => setDraftRoleTierFilter(event.target.value)}>
                      {draftRoleTierFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={draftAvailabilityFilter} onChange={(event) => setDraftAvailabilityFilter(event.target.value)}>
                      {draftAvailabilityFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Style
                    <select value={draftArchetypeFilter} onChange={(event) => setDraftArchetypeFilter(event.target.value)}>
                      {draftArchetypeFilters.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="draft-prospect-list">
                  {availableWrestlers.length ? (
                    availableWrestlers.map((wrestler) => (
                      <button
                        className={`draft-prospect-row${focusedDraftWrestler?.id === wrestler.id ? " is-focused" : ""}`}
                        key={wrestler.id}
                        onClick={() => setDraftFocusId(wrestler.id)}
                        type="button"
                      >
                        <WrestlerPortrait className="draft-prospect-portrait" wrestler={wrestler} />
                        <span className="draft-prospect-copy">
                          <strong className={getDraftProspectNameClass(wrestler.name)}>{wrestler.name}</strong>
                          <small>{getWrestlerOverall(wrestler)} OVR</small>
                        </span>
                        <em>Pop {wrestler.popularity}</em>
                        <b>{getWrestlerOverall(wrestler)}</b>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state compact">No draft files match that search.</div>
                  )}
                </div>
              </aside>

              <section className="draft-clock-stage" aria-label="Selected prospect">
                <div className="draft-clock-strip">On The Clock</div>
                {focusedDraftWrestler ? (
                  <div className="draft-focus-card">
                    <div className="draft-focus-hero">
                      <div className="draft-focus-spotlight">
                        <p className="eyebrow">
                          {getDraftTag(focusedDraftWrestler.roleTier)} · {getDraftTag(focusedDraftWrestler.archetype)}
                        </p>
                        <WrestlerPortrait className="draft-focus-portrait" wrestler={focusedDraftWrestler} />
                        <h2>{focusedDraftWrestler.name}</h2>
                      </div>
                      <div className="draft-focus-overall">
                        <span>Overall</span>
                        <strong>{focusedDraftOverall}</strong>
                      </div>
                    </div>
                    <div className="draft-focus-footer">
                      <div aria-label="Core ratings" className="draft-focus-stat-strip">
                        <div className="draft-focus-stat">
                          <span>Pop</span>
                          <strong>{focusedDraftWrestler.popularity}</strong>
                        </div>
                        <div className="draft-focus-stat">
                          <span>Mom</span>
                          <strong>{focusedDraftWrestler.momentum}</strong>
                        </div>
                        <div className="draft-focus-stat">
                          <span>Ring</span>
                          <strong>{focusedDraftWrestler.ringSkill}</strong>
                        </div>
                        <div className="draft-focus-stat">
                          <span>Mic</span>
                          <strong>{focusedDraftWrestler.promoSkill}</strong>
                        </div>
                      </div>
                      <div className="draft-focus-cost">
                        <span>Value</span>
                        <strong>{focusedDraftCost ? formatMoney(focusedDraftCost) : "—"}</strong>
                        {focusedDraftFinance?.weeklyHireRateUsd ? (
                          <small>{formatMoney(focusedDraftFinance.weeklyHireRateUsd)}/wk</small>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state compact">No focused draft file. Clear filters to reopen the board.</div>
                )}
                <div className="draft-main-actions">
                  <button className="secondary-action" onClick={() => setStep("brand")}>
                    Back
                  </button>
                  <button className="primary-action" disabled={!canDraftFocusedWrestler} onClick={draftFocusedWrestler}>
                    {focusedDraftExceedsBudget ? "Over Budget" : "Draft Selected"}
                  </button>
                  {focusedDraftBundleOffer ? (
                    <button
                      className="secondary-action draft-bundle-action"
                      disabled={focusedDraftBundleExceedsBudget}
                      onClick={() => draftBundle(focusedDraftBundleOffer)}
                      type="button"
                    >
                      {focusedDraftBundleExceedsBudget ? (
                        "Bundle Over Budget"
                      ) : (
                        <>
                          <span>{`Draft ${focusedDraftBundleOffer.kind === "tag_team" ? "Team" : "Faction"}`}</span>
                          <strong>{formatMoney(focusedDraftBundleOffer.discountedValue)}</strong>
                        </>
                      )}
                    </button>
                  ) : null}
                  <button className={canEnterWeekOne ? "primary-action" : "secondary-action"} disabled={!canEnterWeekOne} onClick={startCareer}>
                    Enter Week 1
                  </button>
                </div>
              </section>

              <aside className="draft-rival-panel" aria-label="Rival brands and draft status">
                <section className="draft-rival-status">
                  <div className="draft-panel-head">
                    <div>
                      <p className="eyebrow">Rival Brands</p>
                      <h2>Draft Status</h2>
                    </div>
                    <strong>{availableDraftCount} Open</strong>
                  </div>
                  <div className="draft-rival-list">
                    {previewRivalBrands.map((brand) => {
                      const roster = openingDraftState.rostersByChairId[brand.id] ?? [];
                      const latestPick = roster[roster.length - 1];
                      const brandPortraitSrc = getBrandChairByStyle(brand.brandKey).portraitSrc;
                      const genderReadout = formatDraftGenderReadout(roster);

                      return (
                        <article key={brand.id}>
                          <span aria-hidden="true" className="draft-brand-mini-portrait">
                            <img alt="" draggable={false} src={brandPortraitSrc} />
                          </span>
                          <div className="draft-rival-card-copy">
                            <strong>{brand.brandName}</strong>
                            <span>{brand.assignedGMName}</span>
                            <small>
                              {latestPick
                                ? `Latest · ${latestPick.name} · ${roster.length} drafted`
                                : `${roster.length} drafted`}
                            </small>
                            <small>
                              {genderReadout} · {formatMoney(openingDraftState.remainingBudgetByChairId[brand.id] ?? brand.budget)} left
                            </small>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
                <div className="draft-update-panel">
                  <p className="eyebrow">War Room Updates</p>
                  <div className="draft-update-feed">
                    <div className="draft-update-latest">
                      {rivalLatestPicks.map(({ brand, latestPick, pickCount }) => {
                        const brandPortraitSrc = getBrandChairByStyle(brand.brandKey).portraitSrc;

                        return (
                        <div className="draft-update-brand-row" key={brand.id}>
                          {latestPick ? (
                            <WrestlerPortrait className="draft-mini-portrait" wrestler={latestPick} />
                          ) : (
                            <span aria-hidden="true" className="draft-brand-mini-portrait">
                              <img alt="" draggable={false} src={brandPortraitSrc} />
                            </span>
                          )}
                          <span className="draft-update-copy">
                            <strong>{brand.brandName}</strong>
                            <small>
                              {latestPick
                                ? `Latest · ${latestPick.name} · ${pickCount} drafted`
                                : "Waiting on your first pick"}
                            </small>
                          </span>
                        </div>
                        );
                      })}
                    </div>
                    <div className="draft-update-history" aria-label="Previous rival picks">
                      {rivalPickHistory.length ? (
                        rivalPickHistory.map((event) => (
                          <span className="draft-update-history-row" key={`${event.overallPick}-${event.wrestler.id}`}>
                            <WrestlerPortrait className="draft-mini-portrait" wrestler={event.wrestler} />
                            <span className="draft-update-copy">
                              <strong>{event.chair.brandName}</strong>
                              <small>
                                Pick {event.overallPick} · {event.wrestler.name}
                              </small>
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="draft-update-history-empty">
                          <small>No earlier rival picks yet.</small>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </section>

            <section className="draft-war-bottom" aria-label="Draft support panels">
              <article className="draft-bottom-panel needs">
                <p className="eyebrow">Roster Needs</p>
                {draftedRosterNeedRows.map((row) => (
                  <span key={row.label}>
                    <strong>{row.label}</strong>
                    <em>{row.count}/{row.target}</em>
                    <i style={{ width: `${Math.min(100, Math.round((row.count / row.target) * 100))}%` }} />
                  </span>
                ))}
              </article>
              <article className="draft-bottom-panel budget">
                <p className="eyebrow">Budget</p>
                <span>Start <strong>{draftFinanceReadout.isUnlimitedBudget ? "Unlimited" : formatMoney(draftFinanceReadout.startingBudgetAmount)}</strong></span>
                <span>Roster <strong>{formatMoney(draftFinanceReadout.rosterValue)}</strong></span>
                {draftFinanceReadout.bundleDiscountUsd > 0 ? <span>Bundle Save <strong>{formatMoney(draftFinanceReadout.bundleDiscountUsd)}</strong></span> : null}
                <span>Left <strong>{formatProjectedReserve(draftFinanceReadout)}</strong></span>
                <span>Healthy Reserve <strong>{draftFinanceReadout.isUnlimitedBudget ? "Open" : formatMoney(draftFinanceReadout.recommendedReserveTarget)}</strong></span>
              </article>
              <article className="draft-bottom-panel up-next">
                <p className="eyebrow">Up Next</p>
                <div>
                  {upNextPicks.length ? (
                    upNextPicks.map((pick) => (
                      <span key={`${pick.roundIndex}-${pick.pickInRound}-${pick.chair.id}`}>{pick.chair.brandName}</span>
                    ))
                  ) : (
                    <small>Board opens on pick one.</small>
                  )}
                </div>
              </article>
              <article className="draft-bottom-panel drafted-mini">
                <p className="eyebrow">
                  Drafted · {draftedWrestlers.length} · {formatDraftGenderReadout(draftedWrestlers)}
                </p>
                <section>
                  {draftedWrestlers.length ? (
                    draftedWrestlers.map((wrestler, index) => (
                      <span key={wrestler.id}>
                        <WrestlerPortrait className="draft-mini-portrait" wrestler={wrestler} />
                        <span>
                          <strong>{index + 1}. {wrestler.name}</strong>
                          <small>{getDraftTag(wrestler.roleTier)} / {getWrestlerOverall(wrestler)}</small>
                        </span>
                      </span>
                    ))
                  ) : (
                    <small>No picks made yet.</small>
                  )}
                </section>
              </article>
            </section>
          </div>
        ) : null}

          </div>
        </div>
      </section>
      </div>
    </main>
  );
}

function ChoiceGrid({
  choices,
  selected,
  onSelect,
  variant = "default",
}
: {
  choices: Array<string | ChoiceOption>;
  selected: string;
  onSelect: (choice: string) => void;
  variant?: "default" | "identity";
}) {
  return (
    <div className={`choice-grid${variant === "identity" ? " identity-grid" : ""}`}>
      {choices.map((choice) => {
        const option = typeof choice === "string" ? { label: choice } : choice;

        return (
          <button className={selected === option.label ? "active-filter" : ""} key={option.label} onClick={() => onSelect(option.label)}>
            <span>{option.label}</span>
            {option.description ? <small>{option.description}</small> : null}
        </button>
        );
      })}
    </div>
  );
}
