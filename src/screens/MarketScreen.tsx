import { useState } from "react";
import { GameNav, Header, Metric } from "../components/gameShell";
import { formatMoney } from "../game/formatters";
import { getRosterFinanceValueForWrestler } from "../game/financeCatalog";
import type { GameScreen } from "../game/migration";
import { getContractForWrestler, getMarketSnapshot, getRivalMarketEvents } from "../game/market";
import { draftPool } from "../game/seed";
import type { GameState, ShowResult } from "../game/types";
import "./MarketScreen.css";

export function MarketScreen({
  game,
  latestResult,
  onNavigate,
  onProposeTrade,
  onReleaseWrestler,
  onSignFreeAgent,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onProposeTrade: (outgoingWrestlerId: string, targetWrestlerId: string) => void;
  onReleaseWrestler: (wrestlerId: string) => void;
  onSignFreeAgent: (wrestlerId: string) => void;
}) {
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const snapshot = getMarketSnapshot(game, draftPool);
  const office = game.marketState.officeMandate;
  const [selectedFreeAgentId, setSelectedFreeAgentId] = useState(snapshot.freeAgents[0]?.id ?? "");
  const [selectedOutgoingId, setSelectedOutgoingId] = useState(game.wrestlers[0]?.id ?? "");
  const [selectedTargetId, setSelectedTargetId] = useState(snapshot.rivalTradeTargets[0]?.wrestler.id ?? "");
  const selectedFreeAgent = snapshot.freeAgents.find((wrestler) => wrestler.id === selectedFreeAgentId) ?? snapshot.freeAgents[0];
  const selectedOutgoing = game.wrestlers.find((wrestler) => wrestler.id === selectedOutgoingId) ?? game.wrestlers[0];
  const selectedTarget = snapshot.rivalTradeTargets.find((target) => target.wrestler.id === selectedTargetId) ?? snapshot.rivalTradeTargets[0];
  const latestRivalEvents = getRivalMarketEvents(game).slice(0, 4);
  const visibleTransactions = [...game.marketState.transactions, ...latestRivalEvents].sort((a, b) => b.weekNumber - a.weekNumber || b.id.localeCompare(a.id)).slice(0, 8);

  function contractRead(wrestlerId: string) {
    const contract = getContractForWrestler(game, wrestlerId);

    return contract ? `${contract.contractWeeksRemaining} wk · ${formatMoney(contract.weeklySalary)}/wk · Penalty ${formatMoney(contract.releasePenalty)}` : "No active contract read";
  }

  return (
    <main className="app-shell gameplay-command-shell market-command-shell">
      <Header game={game} />
      <GameNav currentScreen="market" hasResults={Boolean(latestResult)} hasWeekReview={hasCurrentWeekReview} onNavigate={onNavigate} />

      <section className={`market-office-mandate mandate-${office.mandateStatus}`} aria-label="Office mandate">
        <div>
          <p className="eyebrow">Office Mandates</p>
          <h2>{office.mandateStatus === "critical" ? "Ownership Pressure Is Critical" : office.mandateStatus === "surging" ? "Ownership Is Backing The Desk" : office.mandateStatus === "watch" ? "Ownership Is Watching The Ledger" : "Office Mandate Stable"}</h2>
          <p>{office.mandateHistory.at(-1)?.note ?? "The office is waiting for the next resolved week before changing the mandate read."}</p>
        </div>
        <div className="market-mandate-metrics">
          <Metric label="Owner Trust" value={`${office.ownerTrust}`} />
          <Metric label="Reputation" value={`${office.brandReputation}`} />
          <Metric label="Payroll" value={formatMoney(snapshot.payroll)} detail={`${snapshot.expiringContracts} expiring`} />
          <Metric label="Roster Slots" value={`${game.wrestlers.length}/${snapshot.rosterLimit}`} />
        </div>
      </section>

      <section className="market-grid" aria-label="Market command grid">
        <article className="command-panel market-panel">
          <div className="section-heading">
            <p className="eyebrow">Free Agency</p>
            <h3>Open Market Board</h3>
          </div>
          <div className="market-list">
            {snapshot.freeAgents.slice(0, 8).map((wrestler) => {
              const finance = getRosterFinanceValueForWrestler(wrestler);
              const isSelected = selectedFreeAgent?.id === wrestler.id;

              return (
                <button className={isSelected ? "market-row is-selected" : "market-row"} key={wrestler.id} onClick={() => setSelectedFreeAgentId(wrestler.id)} type="button">
                  <span>{wrestler.name}</span>
                  <strong>{formatMoney(finance?.weeklyHireRateUsd ?? 0)}/wk</strong>
                  <small>{wrestler.roleTier} · Rank #{wrestler.draftRank ?? "n/a"}</small>
                </button>
              );
            })}
          </div>
          <button className="primary-action" disabled={!selectedFreeAgent || game.wrestlers.length >= snapshot.rosterLimit} onClick={() => selectedFreeAgent && onSignFreeAgent(selectedFreeAgent.id)}>
            Sign {selectedFreeAgent?.name ?? "Talent"}
          </button>
        </article>

        <article className="command-panel market-panel">
          <div className="section-heading">
            <p className="eyebrow">Contracts / Releases</p>
            <h3>Locker Room Ledger</h3>
          </div>
          <div className="market-list">
            {game.wrestlers.slice(0, 10).map((wrestler) => (
              <button className={selectedOutgoing?.id === wrestler.id ? "market-row is-selected" : "market-row"} key={wrestler.id} onClick={() => setSelectedOutgoingId(wrestler.id)} type="button">
                <span>{wrestler.name}</span>
                <strong>{formatMoney(getContractForWrestler(game, wrestler.id)?.weeklySalary ?? 0)}/wk</strong>
                <small>{contractRead(wrestler.id)}</small>
              </button>
            ))}
          </div>
          <button className="secondary-action" disabled={!selectedOutgoing || game.wrestlers.length <= 8} onClick={() => selectedOutgoing && onReleaseWrestler(selectedOutgoing.id)}>
            Release {selectedOutgoing?.name ?? "Talent"}
          </button>
        </article>

        <article className="command-panel market-panel">
          <div className="section-heading">
            <p className="eyebrow">Trade Wire</p>
            <h3>Limited Rival Visibility</h3>
          </div>
          <div className="trade-builder">
            <label>
              <span>Send</span>
              <select value={selectedOutgoing?.id ?? ""} onChange={(event) => setSelectedOutgoingId(event.target.value)}>
                {game.wrestlers.map((wrestler) => (
                  <option key={wrestler.id} value={wrestler.id}>{wrestler.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Target</span>
              <select value={selectedTarget?.wrestler.id ?? ""} onChange={(event) => setSelectedTargetId(event.target.value)}>
                {snapshot.rivalTradeTargets.map((target) => (
                  <option key={`${target.brand.id}-${target.wrestler.id}`} value={target.wrestler.id}>
                    {target.wrestler.name} · {target.brand.brandName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedTarget ? (
            <p className="social-preview-text">
              {selectedTarget.brand.brandName} visibility is limited to market-eligible talent, contract pressure, and public form. Acceptance resolves deterministically after proposal.
            </p>
          ) : null}
          <button className="primary-action" disabled={!selectedOutgoing || !selectedTarget} onClick={() => selectedOutgoing && selectedTarget && onProposeTrade(selectedOutgoing.id, selectedTarget.wrestler.id)}>
            Propose Trade
          </button>
        </article>
      </section>

      <section className="command-panel market-panel market-feed-panel" aria-label="Transaction feed">
        <div className="section-heading">
          <p className="eyebrow">Transaction Wire</p>
          <h3>{snapshot.latestTransaction?.note ?? "No market movement yet"}</h3>
        </div>
        <div className="market-transaction-list">
          {visibleTransactions.length ? (
            visibleTransactions.map((transaction) => (
              <article key={transaction.id}>
                <span>
                  S{transaction.seasonNumber} W{transaction.weekNumber} · {transaction.type.toUpperCase()}
                </span>
                <strong>{transaction.wrestlerNames.join(" / ") || "Market Desk"}</strong>
                <p>{transaction.note}</p>
                <small>{transaction.amount ? formatMoney(transaction.amount) : "No fee"}</small>
              </article>
            ))
          ) : (
            <p className="muted-copy">The market opens after Draft Night. CPU and player moves will land here as resolved transactions.</p>
          )}
        </div>
      </section>
    </main>
  );
}
