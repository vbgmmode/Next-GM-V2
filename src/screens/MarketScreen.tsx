import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SuperstarPortrait } from "../components/SuperstarPortrait";
import { Metric } from "../components/gameShell";
import { formatMoney } from "../game/formatters";
import { getRosterFinanceValueForWrestler } from "../game/financeCatalog";
import type { GameScreen } from "../game/migration";
import { getContractForWrestler, getExternalMarketOffer, getMarketBundleOffers, getMarketSnapshot, getRenewalOffer, getRivalMarketEvents } from "../game/market";
import { draftPool } from "../game/seed";
import type { GameState, ShowResult, Wrestler } from "../game/types";
import "./MarketScreen.css";

type FocusMode = "board" | "contract";

function getUrgentRosterWrestlerId(game: GameState) {
  const ranked = [...game.wrestlers].sort((left, right) => {
    const leftContract = getContractForWrestler(game, left.id);
    const rightContract = getContractForWrestler(game, right.id);
    const leftExpiring = leftContract?.contractStatus === "expiring" ? 0 : 1;
    const rightExpiring = rightContract?.contractStatus === "expiring" ? 0 : 1;

    if (leftExpiring !== rightExpiring) {
      return leftExpiring - rightExpiring;
    }

    return (leftContract?.contractWeeksRemaining ?? 999) - (rightContract?.contractWeeksRemaining ?? 999);
  });

  return ranked[0]?.id ?? "";
}

function contractRead(game: GameState, wrestlerId: string) {
  const contract = getContractForWrestler(game, wrestlerId);

  return contract
    ? `${contract.contractWeeksRemaining} wk · ${formatMoney(contract.weeklySalary)}/wk rate · ${contract.paymentModel === "prepaid" ? "Prepaid" : `Penalty ${formatMoney(contract.releasePenalty)}`}`
    : "No active contract read";
}

function contractRailRead(game: GameState, wrestlerId: string) {
  const contract = getContractForWrestler(game, wrestlerId);

  if (!contract) {
    return "No active contract";
  }

  const statusLabel = contract.contractStatus === "expiring" ? " · Expiring" : "";

  return `${contract.contractWeeksRemaining} wk · ${formatMoney(contract.weeklySalary)}/wk rate${statusLabel}`;
}

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
  onReleaseWrestler,
  onRenewContract,
  onSignBundle,
  onSignFreeAgent,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onProposeTrade: (outgoingWrestlerId: string, targetWrestlerId: string) => void;
  onReleaseWrestler: (wrestlerId: string) => void;
  onRenewContract: (wrestlerId: string, contractWeeks: number) => void;
  onSignBundle: (affiliationId: string, contractWeeks: number) => void;
  onSignFreeAgent: (wrestlerId: string, contractWeeks: number) => void;
}) {
  const hasCurrentWeekReview = latestResult?.week === game.currentWeek;
  const snapshot = getMarketSnapshot(game, draftPool);
  const office = game.marketState.officeMandate;
  const marketClosed = Boolean(hasCurrentWeekReview);
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
  const shouldAutoContract = boardEntries.length === 0 || availableCount === 0;
  const urgentRosterId = useMemo(() => getUrgentRosterWrestlerId(game), [game]);
  const defaultBoardId = boardEntries.find((entry) => entry.status === "available")?.wrestlerId ?? boardEntries[0]?.wrestlerId ?? "";

  const [manualFocusMode, setManualFocusMode] = useState<FocusMode | null>(null);
  const [selectedFreeAgentId, setSelectedFreeAgentId] = useState(defaultBoardId);
  const [selectedOutgoingId, setSelectedOutgoingId] = useState(urgentRosterId || game.wrestlers[0]?.id || "");
  const [selectedTargetId, setSelectedTargetId] = useState(snapshot.rivalTradeTargets[0]?.wrestler.id ?? "");
  const [selectedContractWeeks, setSelectedContractWeeks] = useState(Math.min(12, Math.max(1, 13 - game.currentWeek)));
  const [selectedRenewalWeeks, setSelectedRenewalWeeks] = useState(4);
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [boardNegotiating, setBoardNegotiating] = useState(false);
  const [contractNegotiating, setContractNegotiating] = useState(false);

  useEffect(() => {
    setManualFocusMode(null);
    setSelectedFreeAgentId(defaultBoardId);
    setSelectedOutgoingId(urgentRosterId || game.wrestlers[0]?.id || "");
    setBoardNegotiating(false);
    setContractNegotiating(false);
  }, [game.currentWeek, game.seasonNumber, defaultBoardId, urgentRosterId, game.wrestlers]);

  const focusMode: FocusMode = manualFocusMode ?? (shouldAutoContract ? "contract" : "board");
  const selectedFreeAgent = boardRows.find((row) => row.wrestler.id === selectedFreeAgentId)?.wrestler ?? boardRows[0]?.wrestler;
  const selectedOutgoing = game.wrestlers.find((wrestler) => wrestler.id === selectedOutgoingId) ?? game.wrestlers[0];
  const selectedTarget = snapshot.rivalTradeTargets.find((target) => target.wrestler.id === selectedTargetId) ?? snapshot.rivalTradeTargets[0];
  const selectedBoardEntry = selectedFreeAgent ? boardEntries.find((entry) => entry.wrestlerId === selectedFreeAgent.id) : undefined;
  const latestRivalEvents = getRivalMarketEvents(game).slice(0, 4);
  const visibleTransactions = [...game.marketState.transactions, ...latestRivalEvents].sort((a, b) => b.weekNumber - a.weekNumber || b.id.localeCompare(a.id)).slice(0, 8);
  const selectedFreeAgentFinance = selectedFreeAgent ? getRosterFinanceValueForWrestler(selectedFreeAgent) : undefined;
  const selectedExternalOffer = selectedFreeAgent ? getExternalMarketOffer(selectedFreeAgent, game.seasonNumber, game.currentWeek, selectedContractWeeks) : undefined;
  const selectedFreeAgentCost = selectedExternalOffer?.weeklyAsk ?? selectedFreeAgentFinance?.weeklyHireRateUsd ?? 0;
  const weeklyPayroll = snapshot.payroll;
  const selectedFreeAgentOverall =
    selectedFreeAgentFinance?.gameOverall ??
    (selectedFreeAgent ? Math.round((selectedFreeAgent.popularity + selectedFreeAgent.ringSkill + selectedFreeAgent.promoSkill + selectedFreeAgent.momentum) / 4) : 0);
  const rosterIsFull = game.wrestlers.length >= snapshot.rosterLimit;
  const releaseGuardActive = game.wrestlers.length <= 8;
  const selectedContract = selectedOutgoing ? getContractForWrestler(game, selectedOutgoing.id) : undefined;
  const selectedRenewalOffer = selectedOutgoing ? getRenewalOffer(selectedOutgoing, selectedRenewalWeeks) : undefined;
  const bundleOffers = getMarketBundleOffers(game, draftPool, selectedContractWeeks);
  const selectedBundleOffer = selectedFreeAgent ? bundleOffers.find((offer) => offer.wrestlerIds.includes(selectedFreeAgent.id)) : undefined;
  const selectedBoardStatus = selectedBoardEntry?.status ?? "available";
  const signDisabledReason = marketClosed
    ? "Market desk closes after the show runs."
    : rosterIsFull
      ? "Clear a roster slot before signing another talent."
      : selectedBoardStatus !== "available"
        ? selectedBoardEntry?.rivalBrandName
          ? `${selectedBoardEntry.rivalBrandName} already filed that contract.`
          : "This board file is already signed."
        : selectedExternalOffer && game.money < selectedExternalOffer.dueNow
          ? "Insufficient cash for this contract."
          : "";
  const negotiateDisabledReason = marketClosed
    ? "Market desk closes after the show runs."
    : rosterIsFull
      ? "Clear a roster slot before negotiating another talent."
      : selectedBoardStatus !== "available"
        ? selectedBoardEntry?.rivalBrandName
          ? `${selectedBoardEntry.rivalBrandName} already filed that contract.`
          : "This board file is already signed."
        : "";
  const renewalDisabledReason = marketClosed
    ? "Market desk closes after the show runs."
    : !selectedContract
      ? "No active contract to extend."
      : selectedRenewalOffer && game.money < selectedRenewalOffer.dueNow
        ? "Insufficient cash for this extension."
        : "";
  const bundleDisabledReason = marketClosed
    ? "Desk locked"
    : selectedBundleOffer && selectedBundleOffer.wrestlers.length > snapshot.rosterLimit - game.wrestlers.length
      ? "No roster slots"
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
    focusMode === "board" && selectedFreeAgent && !signDisabledReason
      ? {
          eyebrow: "Hot Talent",
          label: "Sign Talent",
          onClick: () => onSignFreeAgent(selectedFreeAgent.id, selectedContractWeeks),
          tone: "positive",
        }
      : focusMode === "contract" && selectedOutgoing && !renewalDisabledReason
        ? {
            eyebrow: "Contract Desk",
            label: "Extend Deal",
            onClick: () => onRenewContract(selectedOutgoing.id, selectedRenewalWeeks),
            tone: "positive",
          }
        : {
            eyebrow: "GM Desk",
            label: "No Action",
            tone: "neutral",
          };

  function selectBoardRow(wrestlerId: string) {
    setManualFocusMode("board");
    setSelectedFreeAgentId(wrestlerId);
    setBoardNegotiating(false);
  }

  function selectRosterRow(wrestlerId: string) {
    setManualFocusMode("contract");
    setSelectedOutgoingId(wrestlerId);
    setContractNegotiating(false);
  }

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
            <Metric label="Weekly Payroll" value={formatMoney(snapshot.payroll)} detail="No recurring roster payroll" />
            <Metric label="Slots" value={`${game.wrestlers.length}/${snapshot.rosterLimit}`} />
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
                  const isSelected = focusMode === "board" && selectedFreeAgent?.id === wrestler.id;
                  const isSigned = entry.status === "rival_signed" || entry.status === "player_signed";
                  const statusLabel =
                    entry.status === "rival_signed"
                      ? `Signed by ${entry.rivalBrandName ?? "Rival"}`
                      : entry.status === "player_signed"
                        ? `Signed by ${game.brandName}`
                        : "On the table";

                  return (
                    <button
                      className={`${isSelected ? "market-row is-selected" : "market-row"} ${isSigned ? "is-disabled-market-row" : ""}`.trim()}
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

          <section
            className={`market-focus-workspace market-panel ${focusMode === "board" && selectedFreeAgent && !signDisabledReason ? "is-ready" : focusMode === "contract" && selectedOutgoing && !renewalDisabledReason ? "is-ready" : signDisabledReason || renewalDisabledReason ? "is-blocked" : ""}`.trim()}
            aria-label="Market focus workspace"
          >
            {focusMode === "board" && selectedFreeAgent ? (
              <MarketFocusWorkspace
                badgeLabel="Overall"
                badgeValue={selectedFreeAgentOverall}
                controls={
                  <div className="market-deal-controls">
                    {boardNegotiating ? (
                      <div className="market-negotiation-panel">
                        <label className="market-week-stepper">
                          <span>Deal Weeks</span>
                          <input
                            min="1"
                            max="12"
                            onChange={(event) => setSelectedContractWeeks(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                            type="number"
                            value={selectedContractWeeks}
                          />
                        </label>
                        <p className="market-negotiation-read">
                          {formatMoney(selectedFreeAgentCost)}/wk · Due now {formatMoney(selectedExternalOffer?.dueNow ?? 0)}
                        </p>
                      </div>
                    ) : null}
                    <div className="market-deal-actions">
                      <button
                        className={`secondary-action ${boardNegotiating ? "is-active" : ""}`.trim()}
                        disabled={Boolean(negotiateDisabledReason)}
                        onClick={() => setBoardNegotiating((open) => !open)}
                        type="button"
                      >
                        {boardNegotiating ? "Hide Terms" : "Negotiate"}
                      </button>
                      <button className="primary-action" disabled={Boolean(signDisabledReason)} onClick={() => onSignFreeAgent(selectedFreeAgent.id, selectedContractWeeks)} type="button">
                        Sign {selectedFreeAgent.name}
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
                  boardNegotiating
                    ? negotiateDisabledReason ||
                      `Set the week count to move the weekly ask and due-now total. Short money up front costs more per week; longer runs buy the rate down.`
                    : signDisabledReason ||
                      `${selectedFreeAgent.name} can sign now on prepaid weeks. Open Negotiate to adjust the deal before filing.`
                }
                decisionEyebrow="Deal Desk"
                decisionHeadline={
                  boardNegotiating
                    ? "Negotiating Terms"
                    : selectedBoardStatus === "rival_signed"
                      ? `${selectedBoardEntry?.rivalBrandName ?? "A rival"} Got There First`
                      : selectedBoardStatus === "player_signed"
                        ? "Deal Closed"
                        : signDisabledReason
                          ? "Offer Dead"
                          : "Deal Ready"
                }
                decisionTone={
                  boardNegotiating
                    ? signDisabledReason
                      ? "blocked"
                      : "ready"
                    : signDisabledReason
                      ? "blocked"
                      : selectedBoardStatus === "available"
                        ? "ready"
                        : "neutral"
                }
                eyebrow="On The Board"
                metrics={
                  <>
                    <Metric label="Weekly Ask" value={formatMoney(selectedFreeAgentCost)} detail={`${selectedContractWeeks} week file`} />
                    <Metric label="Due Now" value={formatMoney(selectedExternalOffer?.dueNow ?? 0)} detail="No refund if released" />
                    <Metric label="Weekly Payroll" value={formatMoney(weeklyPayroll)} detail="Roster rights are prepaid" />
                    <Metric label="Roster Slots" value={`${game.wrestlers.length}/${snapshot.rosterLimit}`} detail={rosterIsFull ? "Roster full" : `${snapshot.rosterLimit - game.wrestlers.length} open`} />
                  </>
                }
                tags={[selectedFreeAgent.roleTier ?? "Performer", selectedFreeAgent.archetype ?? "Open Market", selectedFreeAgent.sourceBrand ?? "Top 200 Pool"]}
                wrestler={selectedFreeAgent}
              />
            ) : focusMode === "contract" && selectedOutgoing ? (
              <MarketFocusWorkspace
                badgeLabel="Weeks Left"
                badgeValue={selectedContract?.contractWeeksRemaining ?? 0}
                controls={
                  <div className="market-deal-controls">
                    {contractNegotiating ? (
                      <div className="market-negotiation-panel">
                        <label className="market-week-stepper">
                          <span>Extend Weeks</span>
                          <input
                            min="1"
                            max="12"
                            onChange={(event) => setSelectedRenewalWeeks(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                            type="number"
                            value={selectedRenewalWeeks}
                          />
                        </label>
                        <p className="market-negotiation-read">
                          {formatMoney(selectedRenewalOffer?.weeklyAsk ?? 0)}/wk · Due now {formatMoney(selectedRenewalOffer?.dueNow ?? 0)}
                        </p>
                      </div>
                    ) : null}
                    <div className="market-deal-actions">
                      <button
                        className={`secondary-action ${contractNegotiating ? "is-active" : ""}`.trim()}
                        disabled={marketClosed || !selectedContract}
                        onClick={() => setContractNegotiating((open) => !open)}
                        type="button"
                      >
                        {contractNegotiating ? "Hide Terms" : "Negotiate"}
                      </button>
                      <button className="primary-action" disabled={Boolean(renewalDisabledReason)} onClick={() => onRenewContract(selectedOutgoing.id, selectedRenewalWeeks)} type="button">
                        Extend {selectedOutgoing.name}
                      </button>
                      <button className="secondary-action" disabled={releaseGuardActive || marketClosed} onClick={() => onReleaseWrestler(selectedOutgoing.id)} type="button">
                        Release
                      </button>
                    </div>
                  </div>
                }
                decisionBody={
                  contractNegotiating
                    ? renewalDisabledReason ||
                      `Set extension weeks to move the rate basis and due-now total on this roster deal.`
                    : renewalDisabledReason ||
                      `Roster renewals hold steady pricing. Open Negotiate to adjust extension weeks before filing.`
                }
                decisionEyebrow="Locker Room Deal"
                decisionHeadline={
                  contractNegotiating
                    ? "Negotiating Extension"
                    : renewalDisabledReason
                      ? "Extension Dead"
                      : selectedContract?.contractStatus === "expiring"
                        ? "Renew Before Walkout"
                        : "Extension Open"
                }
                decisionTone={
                  contractNegotiating
                    ? renewalDisabledReason
                      ? "blocked"
                      : "ready"
                    : renewalDisabledReason
                      ? "blocked"
                      : selectedContract?.contractStatus === "expiring"
                        ? "ready"
                        : "neutral"
                }
                eyebrow="Under Contract"
                metrics={
                  <>
                    <Metric label="Rate Basis" value={formatMoney(selectedContract?.weeklySalary ?? 0)} detail={contractRead(game, selectedOutgoing.id)} />
                    <Metric label="Due Now" value={formatMoney(selectedRenewalOffer?.dueNow ?? 0)} detail={`${selectedRenewalWeeks} week extension`} />
                    <Metric label="Weekly Payroll" value={formatMoney(weeklyPayroll)} detail="Roster rights are prepaid" />
                    <Metric label="Roster Slots" value={`${game.wrestlers.length}/${snapshot.rosterLimit}`} detail={releaseGuardActive ? "Minimum roster guard active" : "Release opens a slot"} />
                  </>
                }
                tags={[
                  selectedOutgoing.roleTier ?? "Roster",
                  selectedContract?.contractStatus === "expiring" ? "Expiring Soon" : "Under Contract",
                  selectedContract?.paymentModel === "prepaid" ? "Prepaid Deal" : "Legacy Terms",
                ]}
                wrestler={selectedOutgoing}
              />
            ) : (
              <p className="market-empty-state">Pick board talent or a roster name to open the deal workspace.</p>
            )}
          </section>

          <aside className="market-action-rail" aria-label="Roster movement actions">
            <article className="market-panel market-compact-panel market-roster-panel">
              <div className="market-panel-head">
                <div>
                  <p className="eyebrow">Your Roster</p>
                  <h2>Locker Room</h2>
                </div>
                <strong>{game.wrestlers.length} Signed</strong>
              </div>
              <div className="market-list market-roster-list">
                {game.wrestlers.map((wrestler) => {
                  const contract = getContractForWrestler(game, wrestler.id);
                  const isSelected = focusMode === "contract" && selectedOutgoing?.id === wrestler.id;

                  return (
                    <button
                      className={`${isSelected ? "market-row is-selected" : "market-row"} ${contract?.contractStatus === "expiring" ? "is-expiring-row" : ""}`.trim()}
                      key={wrestler.id}
                      onClick={() => selectRosterRow(wrestler.id)}
                      type="button"
                    >
                      <SuperstarPortrait className="market-row-portrait market-wrestler-portrait" wrestler={wrestler} />
                      <span>
                        <strong>{wrestler.name}</strong>
                        <small>{contractRailRead(game, wrestler.id)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="market-action-note">Tap roster talent for renewals and releases.</p>
            </article>

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
                  <select value={selectedOutgoing?.id ?? ""} onChange={(event) => selectRosterRow(event.target.value)}>
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
              <p className="market-action-note">
                {selectedTarget ? `${selectedTarget.brand.brandName} · pressure intel only` : "No rival names on the wire this week."}
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
