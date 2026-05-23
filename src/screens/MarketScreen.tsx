import { useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SuperstarPortrait } from "../components/SuperstarPortrait";
import { Metric } from "../components/gameShell";
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
  const selectedFreeAgentFinance = selectedFreeAgent ? getRosterFinanceValueForWrestler(selectedFreeAgent) : undefined;
  const selectedFreeAgentCost = selectedFreeAgentFinance?.weeklyHireRateUsd ?? 0;
  const projectedPayroll = snapshot.payroll + selectedFreeAgentCost;
  const selectedFreeAgentOverall =
    selectedFreeAgentFinance?.gameOverall ??
    (selectedFreeAgent ? Math.round((selectedFreeAgent.popularity + selectedFreeAgent.ringSkill + selectedFreeAgent.promoSkill + selectedFreeAgent.momentum) / 4) : 0);
  const rosterIsFull = game.wrestlers.length >= snapshot.rosterLimit;
  const releaseGuardActive = game.wrestlers.length <= 8;
  const marketCta: DynastyManagementCta =
    selectedFreeAgent && !rosterIsFull
      ? {
          eyebrow: "Selected Free Agent",
          label: "Sign Talent",
          onClick: () => onSignFreeAgent(selectedFreeAgent.id),
          tone: "positive",
        }
      : selectedOutgoing && selectedTarget
        ? {
            eyebrow: "Trade Wire",
            label: "Propose Trade",
            onClick: () => onProposeTrade(selectedOutgoing.id, selectedTarget.wrestler.id),
            tone: "brand",
          }
        : {
            eyebrow: "Market Desk",
            label: "No Action",
            tone: "neutral",
          };

  function contractRead(wrestlerId: string) {
    const contract = getContractForWrestler(game, wrestlerId);

    return contract ? `${contract.contractWeeksRemaining} wk · ${formatMoney(contract.weeklySalary)}/wk · Penalty ${formatMoney(contract.releasePenalty)}` : "No active contract read";
  }

  return (
    <DynastyManagementShell className="market-command-shell" currentScreen="market" cta={marketCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <section className="market-command-board" aria-label="Market command board">
        <aside className="market-talent-rail market-panel" aria-label="Open market talent board">
          <div className="market-panel-head">
            <div>
              <p className="eyebrow">Free Agency</p>
              <h2>Open Market Board</h2>
            </div>
            <strong>{snapshot.freeAgents.length} Available</strong>
          </div>
          <div className="market-list market-talent-list">
            {snapshot.freeAgents.length ? (
              snapshot.freeAgents.map((wrestler) => {
                const finance = getRosterFinanceValueForWrestler(wrestler);
                const isSelected = selectedFreeAgent?.id === wrestler.id;

                return (
                  <button className={isSelected ? "market-row is-selected" : "market-row"} key={wrestler.id} onClick={() => setSelectedFreeAgentId(wrestler.id)} type="button">
                    <SuperstarPortrait className="market-row-portrait market-wrestler-portrait" wrestler={wrestler} />
                    <span>
                      <strong>{wrestler.name}</strong>
                      <small>{wrestler.roleTier} · Rank #{wrestler.draftRank ?? "n/a"}</small>
                    </span>
                    <b>{formatMoney(finance?.weeklyHireRateUsd ?? 0)}/wk</b>
                  </button>
                );
              })
            ) : (
              <p className="market-empty-state">No free agents are available from the current market pool.</p>
            )}
          </div>
        </aside>

        <section className="market-focus-stage market-panel" aria-label="Selected market file">
          {selectedFreeAgent ? (
            <>
              <div className="market-focus-hero">
                <SuperstarPortrait className="market-focus-portrait market-wrestler-portrait" wrestler={selectedFreeAgent} />
                <div className="market-focus-copy">
                  <p className="eyebrow">Selected Market File</p>
                  <h1>{selectedFreeAgent.name}</h1>
                  <div className="market-focus-tags">
                    <span>{selectedFreeAgent.roleTier}</span>
                    <span>{selectedFreeAgent.archetype ?? "Open Market"}</span>
                    <span>{selectedFreeAgent.sourceBrand ?? "Top 200 Pool"}</span>
                  </div>
                </div>
                <div className="market-focus-score">
                  <span>Overall</span>
                  <strong>{selectedFreeAgentOverall}</strong>
                </div>
              </div>

              <div className="market-focus-metrics">
                <Metric label="Weekly Rate" value={formatMoney(selectedFreeAgentCost)} detail="Informational hire cost" />
                <Metric label="Projected Payroll" value={formatMoney(projectedPayroll)} detail={`${snapshot.expiringContracts} expiring`} />
                <Metric label="Roster Slots" value={`${game.wrestlers.length}/${snapshot.rosterLimit}`} detail={rosterIsFull ? "Roster full" : `${snapshot.rosterLimit - game.wrestlers.length} open`} />
                <Metric label="Market Rank" value={`#${selectedFreeAgent.draftRank ?? "n/a"}`} detail={selectedFreeAgent.division ?? "Open division"} />
              </div>

              <div className="market-focus-read">
                <div>
                  <p className="eyebrow">Contract Desk Read</p>
                  <h3>{rosterIsFull ? "Roster Limit Reached" : "Offer Can Be Filed"}</h3>
                  <p>
                    {rosterIsFull
                      ? "The roster is at its current market limit. Clear a slot before signing another talent."
                      : `${selectedFreeAgent.name} would join the active roster immediately with the existing market contract defaults.`}
                  </p>
                </div>
                <button className="primary-action" disabled={!selectedFreeAgent || rosterIsFull} onClick={() => selectedFreeAgent && onSignFreeAgent(selectedFreeAgent.id)}>
                  Sign {selectedFreeAgent.name}
                </button>
              </div>
            </>
          ) : (
            <p className="market-empty-state">No selected market file. The board will repopulate when free agents are available.</p>
          )}
        </section>

        <aside className="market-action-rail" aria-label="Roster movement actions">
          <article className="market-panel market-compact-panel">
            <div className="market-panel-head">
              <div>
                <p className="eyebrow">Contracts / Releases</p>
                <h2>Locker Room Ledger</h2>
              </div>
              <strong>{game.wrestlers.length} Signed</strong>
            </div>
            <div className="market-list market-roster-list">
              {game.wrestlers.map((wrestler) => (
                <button className={selectedOutgoing?.id === wrestler.id ? "market-row is-selected" : "market-row"} key={wrestler.id} onClick={() => setSelectedOutgoingId(wrestler.id)} type="button">
                  <SuperstarPortrait className="market-row-portrait market-wrestler-portrait" wrestler={wrestler} />
                  <span>
                    <strong>{wrestler.name}</strong>
                    <small>{contractRead(wrestler.id)}</small>
                  </span>
                  <b>{formatMoney(getContractForWrestler(game, wrestler.id)?.weeklySalary ?? 0)}/wk</b>
                </button>
              ))}
            </div>
            <button className="secondary-action" disabled={!selectedOutgoing || releaseGuardActive} onClick={() => selectedOutgoing && onReleaseWrestler(selectedOutgoing.id)}>
              Release {selectedOutgoing?.name ?? "Talent"}
            </button>
            {releaseGuardActive ? <p className="market-action-note">Minimum roster guard is active at eight wrestlers.</p> : null}
          </article>

          <article className="market-panel market-compact-panel">
            <div className="market-panel-head">
              <div>
                <p className="eyebrow">Trade Wire</p>
                <h2>Limited Rival Visibility</h2>
              </div>
              <strong>{snapshot.rivalTradeTargets.length} Targets</strong>
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
                <select disabled={!snapshot.rivalTradeTargets.length} value={selectedTarget?.wrestler.id ?? ""} onChange={(event) => setSelectedTargetId(event.target.value)}>
                  {snapshot.rivalTradeTargets.map((target) => (
                    <option key={`${target.brand.id}-${target.wrestler.id}`} value={target.wrestler.id}>
                      {target.wrestler.name} · {target.brand.brandName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="market-action-note">
              {selectedTarget
                ? `${selectedTarget.brand.brandName} visibility is limited to market-eligible talent, contract pressure, and public form.`
                : "No rival trade targets are visible this week."}
            </p>
            <button className="primary-action" disabled={!selectedOutgoing || !selectedTarget} onClick={() => selectedOutgoing && selectedTarget && onProposeTrade(selectedOutgoing.id, selectedTarget.wrestler.id)}>
              Propose Trade
            </button>
          </article>
        </aside>

        <section className={`market-office-mandate market-panel mandate-${office.mandateStatus}`} aria-label="Office mandate">
          <div>
            <p className="eyebrow">Office Mandates</p>
            <h2>{office.mandateStatus === "critical" ? "Ownership Pressure Is Critical" : office.mandateStatus === "surging" ? "Ownership Is Backing The Desk" : office.mandateStatus === "watch" ? "Ownership Is Watching The Ledger" : "Office Mandate Stable"}</h2>
            <p>{office.mandateHistory.at(-1)?.note ?? "The office is waiting for the next resolved week before changing the mandate read."}</p>
          </div>
          <div className="market-mandate-metrics">
            <Metric label="Owner Trust" value={`${office.ownerTrust}`} />
            <Metric label="Reputation" value={`${office.brandReputation}`} />
            <Metric label="Payroll" value={formatMoney(snapshot.payroll)} detail={`${snapshot.expiringContracts} expiring`} />
            <Metric label="Slots" value={`${game.wrestlers.length}/${snapshot.rosterLimit}`} />
          </div>
        </section>

        <section className="market-panel market-feed-panel" aria-label="Transaction feed">
          <div className="market-panel-head">
            <div>
              <p className="eyebrow">Transaction Wire</p>
              <h2>{snapshot.latestTransaction?.note ?? "No market movement yet"}</h2>
            </div>
            <strong>{visibleTransactions.length} Items</strong>
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
              <p className="market-empty-state">The market opens after Draft Night. CPU and player moves will land here as resolved transactions.</p>
            )}
          </div>
        </section>
      </section>
    </DynastyManagementShell>
  );
}
