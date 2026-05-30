import { useState } from "react";
import { Header, Metric } from "../components/gameShell";
import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import { DRAFT_CONTRACT_WEEKS } from "../game/constants";
import { getRosterFinanceValueForWrestler } from "../game/financeCatalog";
import { formatMoney } from "../game/formatters";
import { getMidCareerDraftBudget, getMidCareerDraftPool } from "../game/midCareerDraft";
import type { GameState, Wrestler } from "../game/types";
import { getDraftProspectNameClass, getDraftTag, getWrestlerOverall } from "../setup/setupReads";
import "../setup/setup.css";

export function OffseasonDraftScreen({
  game,
  onBack,
  onCompleteDraft,
}: {
  game: GameState;
  onBack: () => void;
  onCompleteDraft: (selectedWrestlerIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const draftBudget = getMidCareerDraftBudget(game);
  const availablePool = getMidCareerDraftPool(game);
  const selectedWrestlers = selectedIds
    .map((id) => availablePool.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
  const selectedSpend = selectedWrestlers.reduce((sum, wrestler) => sum + (getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0), 0);
  const remainingBudget = game.startingBudgetTier === "Unlimited" ? draftBudget : Math.max(0, draftBudget - selectedSpend);
  const selectedIdSet = new Set(selectedIds);
  const focusedPool = availablePool.slice(0, 72);

  function toggleDraftPick(wrestler: Wrestler) {
    const cost = getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0;

    if (selectedIdSet.has(wrestler.id)) {
      setSelectedIds((current) => current.filter((id) => id !== wrestler.id));
      return;
    }

    if (game.startingBudgetTier !== "Unlimited" && cost > remainingBudget) {
      return;
    }

    setSelectedIds((current) => [...current, wrestler.id]);
  }

  return (
    <main className="app-shell">
      <Header game={game} />
      <section className="results-hero season-review-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} Offseason</p>
          <h2>Mid-Career Draft</h2>
          <p className="lede">The old season bank is wiped. Build the next roster from a fresh war chest before Week 1 opens.</p>
        </div>
        <button className="primary-action" onClick={() => onCompleteDraft(selectedIds)}>
          Start Next Season
        </button>
      </section>

      <section className="status-grid" aria-label="Offseason draft budget">
        <Metric label="War Chest" value={game.startingBudgetTier === "Unlimited" ? "Unlimited" : formatMoney(draftBudget)} detail="Fresh offseason draft budget" />
        <Metric label="Selected" value={`${selectedIds.length}`} detail="No hard pick minimum" />
        <Metric label="Committed" value={formatMoney(selectedSpend)} detail={`${DRAFT_CONTRACT_WEEKS}-week prepaid contracts`} />
        <Metric label="Week 1 Cash" value={game.startingBudgetTier === "Unlimited" ? "Unlimited" : formatMoney(remainingBudget)} detail="Carries after draft" />
      </section>

      <section className="command-panel">
        <div className="section-heading">
          <p className="eyebrow">Available Talent</p>
          <h3>Offseason Board</h3>
        </div>
        <div className="draft-prospect-list">
          {focusedPool.map((wrestler) => {
            const cost = getRosterFinanceValueForWrestler(wrestler)?.draftValueUsd ?? 0;
            const selected = selectedIdSet.has(wrestler.id);
            const disabled = !selected && game.startingBudgetTier !== "Unlimited" && cost > remainingBudget;

            return (
              <button
                className={`draft-prospect-row${selected ? " is-focused" : ""}`}
                disabled={disabled}
                key={wrestler.id}
                onClick={() => toggleDraftPick(wrestler)}
                type="button"
              >
                <WrestlerPortrait className="draft-prospect-portrait" wrestler={wrestler} />
                <span className="draft-prospect-copy">
                  <strong className={getDraftProspectNameClass(wrestler.name)}>{wrestler.name}</strong>
                  <small>
                    {getDraftTag(wrestler.roleTier)} · {getWrestlerOverall(wrestler)} OVR
                  </small>
                </span>
                <em>{formatMoney(cost)}</em>
                <b>{selected ? "Picked" : disabled ? "Cash" : "Add"}</b>
              </button>
            );
          })}
        </div>
        <div className="title-actions">
          <button className="secondary-action" onClick={onBack}>
            Back To Review
          </button>
          <button className="primary-action" onClick={() => onCompleteDraft(selectedIds)}>
            Start Next Season
          </button>
        </div>
      </section>
    </main>
  );
}
