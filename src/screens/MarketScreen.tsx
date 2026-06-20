import { useEffect, useState, type ReactNode } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SuperstarPortrait } from "../components/SuperstarPortrait";
import { Metric } from "../components/gameShell";
import { formatMoney } from "../game/formatters";
import { getRosterFinanceValueForWrestler } from "../game/financeCatalog";
import type { GameScreen } from "../game/migration";
import { getExternalMarketOffer, getMarketBundleOffers, getMarketOfferEvaluation, getMarketSnapshot, getPlayerTradeEvaluation, getRivalMarketEvents } from "../game/market";
import { draftPool } from "../game/seed";
import { MARKET_CONTRACT_MAX_WEEKS } from "../game/constants";
import type { GameState, ShowResult, Wrestler } from "../game/types";
import "./MarketScreen.css";

function MarketFocusWorkspace({
  wrestler,
  eyebrow,
  tags,
  badgeLabel,
  badgeValue,
  metrics,
  decisionEyebrow,
  decisionHeadline,
  decisionBody,
  decisionTone,
  result,
  controls,
}: {
  wrestler: Wrestler;
  eyebrow: string;
  tags: string[];
  badgeLabel: string;
  badgeValue: string | number;
  metrics: ReactNode;
  decisionEyebrow: string;
  decisionHeadline: string;
  decisionBody: string;
  decisionTone: "blocked" | "neutral" | "ready";
  result?: ReactNode;
  controls: ReactNode;
}) {
  return (
    <>
      <div className="market-focus-head">
        <div className="market-focus-title">
          <SuperstarPortrait className="market-focus-portrait market-wrestler-portrait" wrestler={wrestler} />
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h3>{wrestler.name}</h3>
            <div className="market-focus-tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="market-focus-badge">
          <span>{badgeLabel}</span>
          <strong>{badgeValue}</strong>
        </div>
      </div>

      <div className="market-focus-metrics">{metrics}</div>

      <div className={`market-focus-decision tone-${decisionTone}`}>
        <div className="market-focus-read">
          <p className="eyebrow">{decisionEyebrow}</p>
          <h4>{decisionHeadline}</h4>
          <p>{decisionBody}</p>
        </div>
        {result}
        <div className="market-focus-controls">{controls}</div>
      </div>
    </>
  );
}

function mandateHeadline(status: GameState["marketState"]["officeMandate"]["mandateStatus"]) {
  if (status === "critical") {
    return "Ownership Pressure Is Critical";
  }

  if (status === "surging") {
    return "Ownership Is Backing The Desk";
  }

  if (status === "watch") {
    return "Ownership Is Watching The Ledger";
  }

  return "Office Mandate Stable";
}

export function MarketScreen({
  game,
  latestResult,
  onNavigate,
  onProposeTrade,
  onSignBundle,
  onSubmitMarketOffer,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onProposeTrade: (outgoingWrestlerId: string, targetWrestlerId: string) => void;
  onSignBundle: (affiliationId: string, contractWeeks: number) => void;
  onSubmitMarketOffer: (wrestlerId: string, contractWeeks: number, weeklySalary: number) => void;
}) {
  const hasCurrentPostShow = latestResult?.week === game.currentWeek;
  const snapshot = getMarketSnapshot(game, draftPool);
  const office = game.marketState.officeMandate;
  const marketClosed = Boolean(hasCurrentPostShow);
  const boardEntries = snapshot.weeklyBoard?.entries ?? [];
  const boardRows = boardEntries
    .map((entry) => {
      const wrestler = draftPool.find((item) => item.id === entry.wrestlerId);

      return wrestler ? { entry, wrestler } : null;
    })
    .filter((row): row is { entry: (typeof boardEntries)[number]; wrestler: Wrestler } => Boolean(row));
  const availableCount = boardEntries.filter((entry) => entry.status === "available").length;
  const rivalSignedCount = boardEntries.filter((entry) => entry.status === "rival_signed").length;
  const playerSignedCount = boardEntries.filter((entry) => entry.status === "player_signed").length;
  const defaultBoardId = boardEntries.find((entry) => entry.status === "available")?.wrestlerId ?? boardEntries[0]?.wrestlerId ?? "";

  const [selectedFreeAgentId, setSelectedFreeAgentId] = useState(defaultBoardId);
  const [selectedOutgoingId, setSelectedOutgoingId] = useState(game.wrestlers[0]?.id || "");
  const [selectedTargetId, setSelectedTargetId] = useState(snapshot.rivalTradeTargets[0]?.wrestler.id ?? "");
  const [selectedContractWeeks, setSelectedContractWeeks] = useState(MARKET_CONTRACT_MAX_WEEKS);
  const [selectedWeeklySalary, setSelectedWeeklySalary] = useState(0);
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [dealWindowOpen, setDealWindowOpen] = useState(false);
  const boardEntryIds = boardEntries.map((entry) => entry.wrestlerId).join("|");

  useEffect(() => {
    setSelectedFreeAgentId((current) => (boardEntries.some((entry) => entry.wrestlerId === current) ? current : defaultBoardId));
  }, [defaultBoardId, boardEntryIds]);

  useEffect(() => {
    setSelectedOutgoingId((current) => (game.wrestlers.some((wrestler) => wrestler.id === current) ? current : game.wrestlers[0]?.id || ""));
  }, [game.wrestlers]);

  useEffect(() => {
    setDealWindowOpen(false);
  }, [game.currentWeek, game.seasonNumber]);

  const selectedFreeAgent = boardRows.find((row) => row.wrestler.id === selectedFreeAgentId)?.wrestler ?? boardRows[0]?.wrestler;
  const selectedOutgoing = game.wrestlers.find((wrestler) => wrestler.id === selectedOutgoingId) ?? game.wrestlers[0];
  const selectedTarget = snapshot.rivalTradeTargets.find((target) => target.wrestler.id === selectedTargetId) ?? snapshot.rivalTradeTargets[0];
  const selectedBoardEntry = selectedFreeAgent ? boardEntries.find((entry) => entry.wrestlerId === selectedFreeAgent.id) : undefined;
  const latestRivalEvents = getRivalMarketEvents(game).slice(0, 4);
  const visibleTransactions = [...game.marketState.transactions, ...latestRivalEvents].sort((a, b) => b.weekNumber - a.weekNumber || b.id.localeCompare(a.id)).slice(0, 8);
  const selectedFreeAgentFinance = selectedFreeAgent ? getRosterFinanceValueForWrestler(selectedFreeAgent) : undefined;
  const selectedTargetFinance = selectedTarget ? getRosterFinanceValueForWrestler(selectedTarget.wrestler) : undefined;
  const selectedTradeEvaluation = getPlayerTradeEvaluation(game, selectedOutgoing?.id, selectedTarget?.wrestler.id, draftPool);
  const latestTradeResult = game.marketState.transactions
    .filter((transaction) => transaction.type === "trade" && transaction.weekNumber === game.currentWeek && transaction.seasonNumber === game.seasonNumber)
    .at(-1);
  const latestTradeTone = latestTradeResult?.accepted ? "accepted" : latestTradeResult ? "declined" : undefined;
  const latestTradeHeadline = latestTradeResult?.accepted ? "Trade Accepted" : latestTradeResult ? "Trade Declined" : "";
  const selectedExternalOffer = selectedFreeAgent ? getExternalMarketOffer(selectedFreeAgent, game.seasonNumber, game.currentWeek, selectedContractWeeks) : undefined;
  const selectedFreeAgentCost = selectedWeeklySalary || selectedExternalOffer?.weeklyAsk || selectedFreeAgentFinance?.weeklyHireRateUsd || 0;
  const selectedOfferDueNow = selectedFreeAgentCost * selectedContractWeeks;
  const selectedOfferEvaluation = selectedFreeAgent
    ? getMarketOfferEvaluation(game, selectedFreeAgent, {
        contractWeeks: selectedContractWeeks,
        weeklySalary: selectedFreeAgentCost,
      })
    : undefined;
  const recurringRosterCost = snapshot.payroll;
  const selectedFreeAgentOverall =
    selectedFreeAgentFinance?.gameOverall ??
    (selectedFreeAgent ? Math.round((selectedFreeAgent.popularity + selectedFreeAgent.ringSkill + selectedFreeAgent.promoSkill + selectedFreeAgent.momentum) / 4) : 0);
  const selectedTargetOverall =
    selectedTargetFinance?.gameOverall ??
    (selectedTarget ? Math.round((selectedTarget.wrestler.popularity + selectedTarget.wrestler.ringSkill + selectedTarget.wrestler.promoSkill + selectedTarget.wrestler.momentum) / 4) : 0);
  const bundleOffers = getMarketBundleOffers(game, draftPool, selectedContractWeeks);
  const selectedBundleOffer = selectedFreeAgent ? bundleOffers.find((offer) => offer.wrestlerIds.includes(selectedFreeAgent.id)) : undefined;
  const selectedBoardStatus = selectedBoardEntry?.status ?? "available";
  const selectedOfferResult = selectedBoardEntry?.offer;
  const selectedOfferResultTone = selectedOfferResult?.outcome === "accepted" ? "accepted" : selectedOfferResult ? "declined" : undefined;
  const selectedOfferResultHeadline =
    selectedOfferResult?.outcome === "accepted"
      ? "Offer Accepted"
      : selectedOfferResult?.outcome === "rival_signed"
        ? "Rival Closed It"
        : selectedOfferResult
          ? "Offer Declined"
          : "";
  const signDisabledReason = marketClosed
    ? "Market desk closes after the show runs."
    : selectedBoardStatus !== "available"
        ? selectedBoardEntry?.rivalBrandName
          ? `${selectedBoardEntry.rivalBrandName} already filed that contract.`
          : selectedBoardStatus === "offer_declined"
            ? "You already filed an offer for this talent this week."
            : "This board file is already signed."
        : game.money < selectedOfferDueNow
          ? "Insufficient cash for this offer."
          : "";
  const offerControlsDisabled = marketClosed || selectedBoardStatus !== "available";
  const bundleDisabledReason = marketClosed
    ? "Desk locked"
    : selectedBundleOffer && game.money < selectedBundleOffer.discountedDueNow
        ? "Cash short"
        : "";

  const boardUrgencyRead =
    boardEntries.length === 0
      ? "Cold week — no outside talent on the board"
      : `${availableCount} open · ${rivalSignedCount} sniped · ${playerSignedCount} signed by you`;

  const recapRead = marketClosed
    ? [
        `You signed ${playerSignedCount}`,
        `Rivals took ${rivalSignedCount}`,
        availableCount > 0 ? `${availableCount} left on the board` : null,
        snapshot.expiringContracts > 0 ? `${snapshot.expiringContracts} deals expiring` : null,
        "Desk locked until next week",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const marketCta: DynastyManagementCta =
    selectedFreeAgent
      ? {
          eyebrow: "Hot Talent",
          label: "Deal Window",
          onClick: () => setDealWindowOpen(true),
          tone: "positive",
        }
      : {
            eyebrow: "GM Desk",
            label: "No Action",
            tone: "neutral",
          };

  function selectBoardRow(wrestlerId: string) {
    setSelectedFreeAgentId(wrestlerId);
    setDealWindowOpen(true);
  }

  function submitSelectedMarketOffer() {
    if (!selectedFreeAgent) {
      return;
    }

    setSelectedFreeAgentId(selectedFreeAgent.id);
    setDealWindowOpen(true);
    onSubmitMarketOffer(selectedFreeAgent.id, selectedContractWeeks, selectedFreeAgentCost);
  }

  useEffect(() => {
    if (selectedExternalOffer) {
      setSelectedWeeklySalary(selectedExternalOffer.weeklyAsk);
    }
  }, [selectedFreeAgent?.id, game.currentWeek, game.seasonNumber]);

  return (
    <DynastyManagementShell className="market-command-shell" currentScreen="market" cta={marketCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <div className="market-desk-body">
        {marketClosed ? (
          <section className="market-recap-strip" aria-label="Weekly market recap">
            <p className="eyebrow">Desk Locked</p>
            <strong>{recapRead}</strong>
          </section>
        ) : null}

        <section className={`market-mandate-strip mandate-${office.mandateStatus}`} aria-label="Office mandate">
          <div className="market-mandate-copy">
            <p className="eyebrow">Front Office</p>
            <strong>{mandateHeadline(office.mandateStatus)}</strong>
            <span>{office.mandateHistory.at(-1)?.note ?? "Ownership holds the line until this week clears."}</span>
          </div>
          <div className="market-mandate-metrics">
            <Metric label="Owner Trust" value={`${office.ownerTrust}`} />
            <Metric label="Reputation" value={`${office.brandReputation}`} />
            <Metric label="Roster Recurrence" value={formatMoney(snapshot.payroll)} detail="Contracts are prepaid" />
            <Metric label="Roster" value={`${game.wrestlers.length}`} detail="No hard cap" />
          </div>
        </section>

        <section className="market-command-board" aria-label="Market command board">
          <aside className="market-talent-rail market-panel" aria-label="Weekly market board">
            <div className="market-panel-head">
              <div>
                <p className="eyebrow">Hot Talent</p>
                <h2>This Week&apos;s Board</h2>
              </div>
              <strong>{boardEntries.length}/6 Open</strong>
            </div>
            <p className="market-board-urgency">{boardUrgencyRead}</p>
            <div className="market-list market-talent-list">
              {boardRows.length ? (
                boardRows.map(({ entry, wrestler }) => {
                  const isSelected = selectedFreeAgent?.id === wrestler.id;
                  const isSigned = entry.status === "rival_signed" || entry.status === "player_signed";
                  const isUnavailable = isSigned || entry.status === "offer_declined";
                  const statusLabel =
                    entry.status === "rival_signed"
                      ? `Signed by ${entry.rivalBrandName ?? "Rival"}`
                      : entry.status === "player_signed"
                        ? `Signed by ${game.brandName}`
                        : entry.status === "offer_declined"
                          ? "Offer declined"
                          : "On the table";

                  return (
                    <button
                      className={`${isSelected ? "market-row is-selected" : "market-row"} ${isUnavailable ? "is-disabled-market-row" : ""}`.trim()}
                      key={wrestler.id}
                      onClick={() => selectBoardRow(wrestler.id)}
                      type="button"
                    >
                      <SuperstarPortrait className="market-row-portrait market-wrestler-portrait" wrestler={wrestler} />
                      <span>
                        <strong>{wrestler.name}</strong>
                        <small>
                          {wrestler.roleTier} · {statusLabel}
                        </small>
                      </span>
                      <b>From {formatMoney(entry.weeklyAsk)}/wk</b>
                    </button>
                  );
                })
              ) : (
                <p className="market-empty-state">Cold board this week. Work your roster deals, trade wire, and wire report while outside talent stays quiet.</p>
              )}
            </div>
          </aside>

          {dealWindowOpen && selectedFreeAgent ? (
            <div className="market-window-backdrop" role="presentation">
              <section
                className={`market-focus-workspace market-panel market-deal-window ${selectedFreeAgent && !signDisabledReason ? "is-ready" : signDisabledReason ? "is-blocked" : ""}`.trim()}
                aria-label="Market deal window"
                aria-modal="true"
                role="dialog"
              >
                <button className="market-window-close" onClick={() => setDealWindowOpen(false)} type="button">
                  Close
                </button>
                <MarketFocusWorkspace
                  badgeLabel="Overall"
                  badgeValue={selectedFreeAgentOverall}
                  controls={
                    <div className="market-deal-controls">
                      <div className="market-negotiation-panel">
                        <label className="market-week-stepper">
                          <span>Weekly Offer</span>
                          <input
                            disabled={offerControlsDisabled}
                            min="1000"
                            onChange={(event) => setSelectedWeeklySalary(Math.max(1000, Number(event.target.value) || 1000))}
                            step="500"
                            type="number"
                            value={selectedFreeAgentCost}
                          />
                        </label>
                        <label className="market-week-stepper">
                          <span>Deal Weeks</span>
                          <input
                            disabled={offerControlsDisabled}
                            min="1"
                            max={MARKET_CONTRACT_MAX_WEEKS}
                            onChange={(event) => setSelectedContractWeeks(Math.max(1, Math.min(MARKET_CONTRACT_MAX_WEEKS, Number(event.target.value) || 1)))}
                            type="number"
                            value={selectedContractWeeks}
                          />
                        </label>
                        <p className="market-negotiation-read">
                          {selectedOfferEvaluation?.interestRead ?? "Listening"} · Due now {formatMoney(selectedOfferDueNow)}
                        </p>
                        <div className="market-negotiation-context" aria-label="Negotiation context">
                          <strong>{selectedOfferEvaluation?.personalityLabel ?? "Negotiation Read"}</strong>
                          {(selectedOfferEvaluation?.contextReads ?? []).map((read) => (
                            <span key={read}>{read}</span>
                          ))}
                        </div>
                      </div>
                      <div className="market-deal-actions">
                        <button className="primary-action" disabled={Boolean(signDisabledReason)} onClick={submitSelectedMarketOffer} type="button">
                          Negotiate
                        </button>
                        {selectedBundleOffer ? (
                          <button className="secondary-action" disabled={Boolean(bundleDisabledReason)} onClick={() => onSignBundle(selectedBundleOffer.affiliationId, selectedContractWeeks)} type="button">
                            {bundleDisabledReason || `Hire Bundle · ${formatMoney(selectedBundleOffer.discountedDueNow)}`}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  }
                  decisionBody={
                    signDisabledReason ||
                    `File one formal package this week. ${selectedOfferEvaluation?.contextReads.join(" · ") ?? `${selectedFreeAgent.name} will judge weekly money, contract length, role fit, brand momentum, and rival pressure.`}`
                  }
                  decisionEyebrow="Deal Desk"
                  decisionHeadline={
                    selectedBoardStatus === "rival_signed"
                      ? `${selectedBoardEntry?.rivalBrandName ?? "A rival"} Got There First`
                      : selectedBoardStatus === "player_signed"
                        ? "Deal Closed"
                        : selectedBoardStatus === "offer_declined"
                          ? "Offer Declined"
                        : signDisabledReason
                          ? "Offer Dead"
                          : selectedOfferEvaluation?.interestRead ?? "Build The Offer"
                  }
                  decisionTone={
                    signDisabledReason
                      ? "blocked"
                      : selectedBoardStatus === "available"
                        ? "ready"
                        : "neutral"
                  }
                  eyebrow="On The Board"
                  metrics={
                    <>
                      <Metric label="Weekly Ask" value={formatMoney(selectedFreeAgentCost)} detail={`${selectedContractWeeks} week file`} />
                      <Metric label="Due Now" value={formatMoney(selectedOfferDueNow)} detail="Paid only if accepted" />
                      <Metric label="Roster Recurrence" value={formatMoney(recurringRosterCost)} detail="Roster rights are prepaid" />
                      <Metric label="Roster Count" value={`${game.wrestlers.length}`} detail="No hard cap" />
                    </>
                  }
                  tags={[
                    selectedFreeAgent.roleTier ?? "Performer",
                    selectedOfferEvaluation?.personalityLabel ?? selectedFreeAgent.archetype ?? "Open Market",
                    selectedFreeAgent.sourceBrand ?? "Top 200 Pool",
                  ]}
                  result={
                    selectedOfferResult && selectedOfferResultTone ? (
                      <div className={`market-offer-result tone-${selectedOfferResultTone}`} key={`${selectedFreeAgent.id}-${selectedOfferResult.outcome}-${selectedBoardEntry?.transactionId ?? "offer"}`}>
                        <div className="market-offer-result-pulse" aria-hidden="true" />
                        <div className="market-offer-result-copy">
                          <p className="eyebrow">Negotiation Result</p>
                          <h4>{selectedOfferResultHeadline}</h4>
                          <span>{selectedOfferResult.note}</span>
                        </div>
                        <div className="market-offer-result-terms">
                          <span>{selectedOfferResult.interestRead}</span>
                          <span>{formatMoney(selectedOfferResult.weeklySalary)}/wk</span>
                          <span>{selectedOfferResult.contractWeeks} wk</span>
                          <span>{selectedOfferResult.outcome === "accepted" ? formatMoney(selectedOfferResult.dueNow) : "No fee"}</span>
                        </div>
                      </div>
                    ) : null
                  }
                  wrestler={selectedFreeAgent}
                />
              </section>
            </div>
          ) : null}

          <aside className="market-action-rail" aria-label="Trade wire actions">
            <article className="market-panel market-compact-panel market-trade-panel">
              <div className="market-panel-head">
                <div>
                  <p className="eyebrow">Trade Wire</p>
                  <h2>Rival Intel</h2>
                </div>
                <strong>{snapshot.rivalTradeTargets.length} Targets</strong>
              </div>
              <div className="trade-builder">
                <label>
                  <span>Send</span>
                  <select value={selectedOutgoing?.id ?? ""} onChange={(event) => setSelectedOutgoingId(event.target.value)}>
                    {game.wrestlers.map((wrestler) => (
                      <option key={wrestler.id} value={wrestler.id}>
                        {wrestler.name}
                      </option>
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
              <div className="trade-intel-card" aria-label="Selected trade intel">
                <div className="trade-intel-side">
                  {selectedOutgoing ? <SuperstarPortrait className="market-row-portrait market-wrestler-portrait" wrestler={selectedOutgoing} /> : null}
                  <span>
                    <small>Your Side</small>
                    <strong>{selectedOutgoing?.name ?? "No selection"}</strong>
                  </span>
                </div>
                <div className="trade-intel-vs">for</div>
                <div className="trade-intel-side">
                  {selectedTarget ? <SuperstarPortrait className="market-row-portrait market-wrestler-portrait" wrestler={selectedTarget.wrestler} /> : null}
                  <span>
                    <small>{selectedTarget?.brand.brandName ?? "Rival"}</small>
                    <strong>{selectedTarget?.wrestler.name ?? "No target"}</strong>
                  </span>
                </div>
                <div className="trade-intel-metrics">
                  <span>Target OVR {selectedTarget ? selectedTargetOverall : "-"}</span>
                  <span>{selectedTargetFinance ? `${formatMoney(selectedTargetFinance.weeklyHireRateUsd)}/wk context` : "Pressure intel only"}</span>
                </div>
              </div>
              {selectedTradeEvaluation ? (
                <div className={`trade-read-card tone-${selectedTradeEvaluation.accepted ? "accepted" : "declined"}`} aria-label="Trade acceptance read">
                  <div>
                    <p className="eyebrow">Desk Read</p>
                    <strong>{selectedTradeEvaluation.read}</strong>
                  </div>
                  <span>{selectedTradeEvaluation.contextReads.slice(0, 2).join(" · ")}</span>
                  <div className="trade-read-tags">
                    <b>{selectedTradeEvaluation.accepted ? "Likely clears" : "Likely rejected"}</b>
                    <b>{selectedTradeEvaluation.transactionFee > 0 ? `${formatMoney(selectedTradeEvaluation.transactionFee)} fee` : "No fee if declined"}</b>
                  </div>
                </div>
              ) : null}
              {latestTradeResult && latestTradeTone ? (
                <div className={`market-offer-result market-trade-result tone-${latestTradeTone}`} key={latestTradeResult.id}>
                  <div className="market-offer-result-pulse" aria-hidden="true" />
                  <div className="market-offer-result-copy">
                    <p className="eyebrow">Trade Result</p>
                    <h4>{latestTradeHeadline}</h4>
                    <span>{latestTradeResult.note}</span>
                  </div>
                  <div className="market-offer-result-terms">
                    <span>{latestTradeResult.accepted ? "Accepted" : "Declined"}</span>
                    <span>{latestTradeResult.amount > 0 ? formatMoney(latestTradeResult.amount) : "No fee"}</span>
                  </div>
                </div>
              ) : null}
              <p className="market-action-note">
                {selectedTarget && selectedTradeEvaluation
                  ? `${selectedTarget.brand.brandName} · ${selectedTradeEvaluation.contextReads.at(-1)}`
                  : selectedTarget
                    ? `${selectedTarget.brand.brandName} · pressure intel only`
                    : "No rival names on the wire this week."}
              </p>
              <button className="primary-action" disabled={!selectedOutgoing || !selectedTarget || marketClosed} onClick={() => selectedOutgoing && selectedTarget && onProposeTrade(selectedOutgoing.id, selectedTarget.wrestler.id)} type="button">
                Propose Trade
              </button>
            </article>
          </aside>
        </section>

        <section className={`market-feed-collapsible market-panel ${feedExpanded ? "is-expanded" : ""}`} aria-label="Transaction feed">
          <button className="market-feed-toggle" onClick={() => setFeedExpanded((value) => !value)} type="button">
            <div>
              <p className="eyebrow">Wire Report</p>
              <strong>{snapshot.latestTransaction?.note ?? "No movement on the wire yet"}</strong>
            </div>
            <span>
              {visibleTransactions.length} Items {feedExpanded ? "▴" : "▾"}
            </span>
          </button>
          {feedExpanded ? (
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
          ) : null}
        </section>
      </div>
    </DynastyManagementShell>
  );
}
