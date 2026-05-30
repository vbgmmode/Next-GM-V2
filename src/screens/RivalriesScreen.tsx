import { useEffect, useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import { Metric } from "../components/gameShell";
import { RIVALRY_END_REASONS, isRivalryPendingEndThisWeek, wasRivalryBookedOnWeek } from "../game/rivalryEnd";
import { getDefaultStorylineIdForStakes, getRivalryStoryline, safeRivalryStorylineOptions } from "../game/rivalryCatalog";
import type { GameScreen } from "../game/migration";
import { getCurrentCalendarWeek } from "../game/scoring";
import { formatRivalryEventType, getRivalryHistory } from "../game/storyContextReads";
import type { GameState, RivalryStakes, RivalryStructure, ShowResult } from "../game/types";
import "./RivalriesScreen.css";
import {
  buildRivalryFeudSuggestions,
  buildRivalryGmRead,
  formatHistoryStamp,
  formatRivalryStakes,
  formatRivalryStructure,
  getDefaultRivalryComposerParticipantIds,
  getActiveRivalryParticipantIds,
  getPreferredTagPartnerId,
  getRivalryCreationBlockReason,
  getRivalryParticipants,
  getRivalryShortLabel,
  getRivalryStageContext,
  getRivalryStructure,
  getRivalryStructureMark,
  getRivalryStructureParticipantRange,
  getRivalryTimingSnapshot,
  getRivalryTimingSnapshots,
  hasDuplicateRivalry,
  isRivalryIntergenderBlocked,
  isRivalryOnClock,
  type RivalryFeudSuggestion,
} from "./rivalriesScreenReads";

export type RivalryCreateInput = {
  participantIds: string[];
  structure: RivalryStructure;
  stakes: RivalryStakes;
  storylineId?: string;
};

function renderFeudRow({
  rivalry,
  snapshot,
  isSelected,
  isPriority,
  wrestlers,
  onSelect,
}: {
  rivalry: (ReturnType<typeof getRivalryTimingSnapshots>[number])["rivalry"];
  snapshot: (ReturnType<typeof getRivalryTimingSnapshots>[number])["snapshot"];
  isSelected: boolean;
  isPriority: boolean;
  wrestlers: GameState["wrestlers"];
  onSelect: () => void;
}) {
  const participants = getRivalryParticipants(rivalry, wrestlers);
  const leadPortrait = participants[0];

  return (
    <button
      className={`rivalry-feud-row ${isSelected ? "is-selected" : ""} ${isPriority ? "is-priority" : ""} status-${rivalry.status}`.trim()}
      key={rivalry.id}
      onClick={onSelect}
      type="button"
    >
      <span className="rivalry-feud-row-mark">{getRivalryStructureMark(getRivalryStructure(rivalry))}</span>
      {leadPortrait ? <WrestlerPortrait className="rivalry-feud-row-portrait" wrestler={leadPortrait} /> : <span className="rivalry-feud-row-mark">—</span>}
      <span className="rivalry-feud-row-copy">
        <strong title={rivalry.name}>{getRivalryShortLabel(rivalry.name)}</strong>
        <small>{snapshot.primary.label}</small>
      </span>
      <b>{rivalry.heat}</b>
    </button>
  );
}

export function RivalriesScreen({
  game,
  initialSelectedRivalryId,
  latestResult,
  onBookRivalry,
  onCreateRivalry,
  onScheduleRivalryEnd,
  onNavigate,
}: {
  game: GameState;
  initialSelectedRivalryId?: string;
  latestResult?: ShowResult;
  onBookRivalry: (rivalryId: string) => void;
  onCreateRivalry: (input: RivalryCreateInput) => void;
  onScheduleRivalryEnd: (rivalryId: string, reason: string) => void;
  onNavigate: (screen: GameScreen) => void;
}) {
  const rivalrySnapshots = useMemo(() => getRivalryTimingSnapshots(game), [game]);
  const onClockEntries = useMemo(() => rivalrySnapshots.filter(({ rivalry, snapshot }) => isRivalryOnClock(rivalry, snapshot)), [rivalrySnapshots]);
  const onClockIds = useMemo(() => new Set(onClockEntries.map(({ rivalry }) => rivalry.id)), [onClockEntries]);
  const [selectedRivalryId, setSelectedRivalryId] = useState(initialSelectedRivalryId ?? "");
  const [structure, setStructure] = useState<RivalryStructure>("singles");
  const [participantIds, setParticipantIds] = useState<string[]>(() => getDefaultRivalryComposerParticipantIds(game.wrestlers));
  const [stakes, setStakes] = useState<RivalryStakes>("personal");
  const [storylineId, setStorylineId] = useState(getDefaultStorylineIdForStakes("personal"));
  const [storyFilesExpanded, setStoryFilesExpanded] = useState(false);
  const [feudSuggestionsExpanded, setFeudSuggestionsExpanded] = useState(true);
  const [endDraftOpen, setEndDraftOpen] = useState(false);
  const [endReason, setEndReason] = useState<string>(RIVALRY_END_REASONS[0]);
  const [sparkDeskOpen, setSparkDeskOpen] = useState(false);

  const currentWeek = getCurrentCalendarWeek(game);
  const range = getRivalryStructureParticipantRange(structure);
  const composerParticipantIds = participantIds.slice(0, range.max).filter(Boolean);
  const isDuplicate = composerParticipantIds.length >= range.min && hasDuplicateRivalry(game.rivalries, structure, composerParticipantIds);
  const rivalryBlockReason = getRivalryCreationBlockReason(structure, composerParticipantIds, game.wrestlers, game.rivalries);
  const canCreate = composerParticipantIds.length >= range.min && composerParticipantIds.length <= range.max && !isDuplicate && !rivalryBlockReason;
  const selectedStoryline = getRivalryStoryline({ stakes, storylineId });
  const selectedRivalry = game.rivalries.find((rivalry) => rivalry.id === selectedRivalryId);
  const hasFeudFocus = Boolean(selectedRivalry);
  const selectedSnapshot = selectedRivalry ? getRivalryTimingSnapshot(selectedRivalry, game) : undefined;
  const selectedHistory = selectedRivalry ? getRivalryHistory(game, selectedRivalry.id) : [];
  const selectedStorylineRead = selectedRivalry ? getRivalryStoryline(selectedRivalry) : undefined;
  const selectedStage = selectedRivalry ? getRivalryStageContext(game, selectedRivalry) : undefined;
  const selectedBlocked = selectedRivalry ? isRivalryIntergenderBlocked(selectedRivalry, game.wrestlers) : false;
  const selectedGmRead = selectedRivalry ? buildRivalryGmRead(game, selectedRivalry, currentWeek.isGoHome, currentWeek.showType === "ple") : "";
  const wallEntries = rivalrySnapshots.filter(({ rivalry }) => !onClockIds.has(rivalry.id));
  const feudSuggestions = useMemo(() => buildRivalryFeudSuggestions(game, 3), [game]);
  const activeRivalryParticipantIds = useMemo(() => getActiveRivalryParticipantIds(game.rivalries), [game.rivalries]);

  useEffect(() => {
    setParticipantIds((current) => current.map((id) => (id && activeRivalryParticipantIds.has(id) ? "" : id)));
  }, [activeRivalryParticipantIds]);

  useEffect(() => {
    if (initialSelectedRivalryId && game.rivalries.some((rivalry) => rivalry.id === initialSelectedRivalryId)) {
      setSelectedRivalryId(initialSelectedRivalryId);
    }
  }, [game.rivalries, initialSelectedRivalryId]);

  useEffect(() => {
    if (!game.rivalries.length) {
      setSelectedRivalryId("");
      return;
    }

    if (!game.rivalries.some((rivalry) => rivalry.id === selectedRivalryId)) {
      setSelectedRivalryId("");
    }
  }, [game.rivalries, selectedRivalryId]);

  function updateParticipantSlot(index: number, wrestlerId: string) {
    setParticipantIds((current) => {
      const next = [...current];
      next[index] = wrestlerId;

      if (structure === "tag_team" && wrestlerId) {
        const sideStart = index < 2 ? 0 : 2;
        const partnerIndex = index === sideStart ? sideStart + 1 : sideStart;

        if (!next[partnerIndex]) {
          const partnerId = getPreferredTagPartnerId(wrestlerId, game.wrestlers, next);

          if (partnerId && !activeRivalryParticipantIds.has(partnerId)) {
            next[partnerIndex] = partnerId;
          }
        }
      }

      return next;
    });
  }

  function handleCreateRivalry() {
    if (!canCreate) {
      return;
    }

    onCreateRivalry({ participantIds: composerParticipantIds, structure, stakes, storylineId });
    setSparkDeskOpen(false);
  }

  function applyFeudSuggestion(suggestion: RivalryFeudSuggestion) {
    setStructure(suggestion.structure);
    setParticipantIds([...suggestion.participantIds, "", "", "", ""].slice(0, 4));
    setStakes(suggestion.stakes);
    setStorylineId(suggestion.storylineId);
  }

  function handleSelectRivalry(rivalryId: string) {
    setSelectedRivalryId(rivalryId);
    setStoryFilesExpanded(false);
    setEndDraftOpen(false);
  }

  const pendingFinale = Boolean(selectedRivalry && isRivalryPendingEndThisWeek(selectedRivalry, game.currentWeek));
  const finaleBooked = Boolean(selectedRivalry && wasRivalryBookedOnWeek(game, selectedRivalry.id, game.currentWeek));

  const onClockCount = onClockEntries.length;
  const activeCount = game.rivalries.length;

  const focusReady = Boolean(selectedRivalry && selectedSnapshot && (pendingFinale ? finaleBooked : selectedSnapshot.currentCardBeats > 0));
  const focusBlocked = Boolean(selectedRivalry && selectedBlocked);
  const focusUrgent = Boolean(
    selectedRivalry && selectedSnapshot && (pendingFinale ? !finaleBooked : isRivalryOnClock(selectedRivalry, selectedSnapshot)),
  );
  const decisionTone = focusBlocked ? "blocked" : focusReady ? "ready" : focusUrgent ? "urgent" : "neutral";
  const decisionHeadline = selectedBlocked
    ? "Blocked Pairing"
    : pendingFinale
      ? finaleBooked
        ? "Finale Booked"
        : "Book Finale Beat"
      : selectedSnapshot?.currentCardBeats
        ? "Beat On The Board"
        : selectedSnapshot?.primary.label ?? "Select A Feud";
  const decisionBody = selectedBlocked
    ? "Legacy rivalry kept for save safety, but it cannot attach to booking under the current no-intergender rule."
    : pendingFinale
      ? finaleBooked
        ? `${selectedRivalry?.pendingEndReason ?? "Program scheduled to end."} Advance week to clear this feud from the board.`
        : `${selectedRivalry?.pendingEndReason ?? "Program scheduled to end."} Book the final TV beat this week or the finale will cancel on advance week.`
      : selectedSnapshot?.producerRead ?? "Pick a feud from the rail to open the story desk.";
  const cardStatusValue = selectedSnapshot?.currentCardBeats ? `${selectedSnapshot.currentCardBeats} Beat${selectedSnapshot.currentCardBeats === 1 ? "" : "s"}` : "Off Card";
  const cardStatusDetail = selectedSnapshot?.currentCardBeats ? `${selectedSnapshot.currentCardParticipants} on card` : "Book a beat this week";

  const rivalriesCta: DynastyManagementCta = hasFeudFocus && selectedRivalry && !selectedBlocked
    ? {
        eyebrow: "Selected Story",
        label: selectedSnapshot?.primary.label ?? "On Deck",
        tone: focusUrgent ? "warning" : "neutral",
      }
    : {
        eyebrow: "Story Room",
        label: hasFeudFocus ? selectedSnapshot?.primary.label ?? "Story Desk" : "No Story Selected",
        tone: "neutral",
      };

  const sparkDesk = (
    <div className="rivalry-spark-window rivalry-panel" role="document">
      <div className="rivalry-panel-head">
        <div>
          <p className="eyebrow">Spark Desk</p>
          <h2>Start The Spark</h2>
        </div>
        <button className="rivalry-panel-action" onClick={() => setSparkDeskOpen(false)} type="button">
          Close
        </button>
      </div>
      <div className="rivalry-mode-toggle" aria-label="Rivalry structure">
        {(["singles", "tag_team", "multi_person"] as RivalryStructure[]).map((option) => (
          <button className={structure === option ? "active-filter" : ""} key={option} onClick={() => setStructure(option)} type="button">
            {formatRivalryStructure(option)}
          </button>
        ))}
      </div>
      <div className={`rivalry-feud-suggestions ${feudSuggestionsExpanded ? "is-expanded" : ""}`} aria-label="Suggested feuds">
        <button
          aria-expanded={feudSuggestionsExpanded}
          className="rivalry-feud-suggestions-toggle"
          onClick={() => setFeudSuggestionsExpanded((open) => !open)}
          type="button"
        >
          <div>
            <p className="eyebrow">Suggest Feuds</p>
            <strong>{feudSuggestions.length} ready</strong>
          </div>
          <span>{feudSuggestionsExpanded ? "Hide" : "Show"}</span>
        </button>
        {feudSuggestionsExpanded ? (
          <div className="rivalry-feud-suggestion-list">
            {feudSuggestions.length ? (
              feudSuggestions.map((suggestion) => (
                <button className="rivalry-feud-suggestion" key={suggestion.id} onClick={() => applyFeudSuggestion(suggestion)} type="button">
                  <strong title={suggestion.headline}>{suggestion.headline}</strong>
                  <small>
                    {formatRivalryStructure(suggestion.structure)} · {formatRivalryStakes(suggestion.stakes)}
                  </small>
                  <p>{suggestion.reason}</p>
                </button>
              ))
            ) : (
              <p className="muted-copy">No clean feud lanes left on the roster board.</p>
            )}
          </div>
        ) : null}
      </div>
      <div className="rivalry-composer-body">
        <div className="rivalry-composer-selects">
          {Array.from({ length: range.max }).map((_, index) => {
            const slotLabel = structure === "tag_team" ? `${index < 2 ? "Team A" : "Team B"} ${(index % 2) + 1}` : `Wrestler ${index + 1}`;

            return (
              <label className="rivalry-composer-slot" key={`composer-slot-${index}`}>
                <span>{slotLabel}</span>
                <select className="rivalry-desk-select" value={participantIds[index] ?? ""} onChange={(event) => updateParticipantSlot(index, event.target.value)}>
                  <option value="">Choose wrestler</option>
                  {game.wrestlers
                    .filter((wrestler) => !activeRivalryParticipantIds.has(wrestler.id) || wrestler.id === (participantIds[index] ?? ""))
                    .map((wrestler) => (
                      <option key={wrestler.id} value={wrestler.id}>
                        {wrestler.name}
                      </option>
                    ))}
                </select>
              </label>
            );
          })}
        </div>
        <label className="rivalry-composer-field">
          Stakes
          <select className="rivalry-desk-select" value={stakes} onChange={(event) => setStakes(event.target.value as RivalryStakes)}>
            {(["personal", "title", "respect", "revenge"] as RivalryStakes[]).map((option) => (
              <option key={option} value={option}>
                {formatRivalryStakes(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="rivalry-composer-field">
          Storyline
          <select className="rivalry-desk-select" value={storylineId} onChange={(event) => setStorylineId(event.target.value)}>
            {safeRivalryStorylineOptions.map((storyline) => (
              <option key={storyline.id} value={storyline.id}>
                {storyline.name}
              </option>
            ))}
          </select>
        </label>
        <p className="rivalry-composer-read">{selectedStoryline.titleFit}</p>
        <div className="rivalry-composer-actions">
          <button className="primary-action" disabled={!canCreate} onClick={handleCreateRivalry} type="button">
            Start Rivalry
          </button>
          <div className="rivalry-composer-warnings">
            {isDuplicate ? <p className="form-warning">Duplicate active rivalry already exists.</p> : <p className="form-warning is-placeholder" aria-hidden="true">&nbsp;</p>}
            {rivalryBlockReason ? <p className="form-warning">{rivalryBlockReason}</p> : <p className="form-warning is-placeholder" aria-hidden="true">&nbsp;</p>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DynastyManagementShell className="rivalries-command-shell" currentScreen="rivalries" cta={rivalriesCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <div className="rivalry-desk-body">
        <section className="rivalry-command-board" aria-label="Rivalry creative desk">
          <div className="rivalry-desk-column">
            <div className="rivalry-feud-rail rivalry-panel is-desk-strip" aria-label="Active feuds">
              <div className="rivalry-panel-head">
                <div>
                  <p className="eyebrow">Heat Feed</p>
                  <h2>Active Feuds</h2>
                </div>
                <strong>{activeCount} Live</strong>
              </div>
              <p className="rivalry-feud-urgency">{onClockCount > 0 ? `${onClockCount} on the clock` : "All programs steady"}</p>
              <div className="rivalry-feud-list">
                {rivalrySnapshots.length ? (
                  <>
                    {onClockEntries.length ? (
                      <>
                        <p className="eyebrow">On The Clock</p>
                        {onClockEntries.map(({ rivalry, snapshot }) =>
                          renderFeudRow({
                            rivalry,
                            snapshot,
                            isSelected: selectedRivalryId === rivalry.id,
                            isPriority: true,
                            wrestlers: game.wrestlers,
                            onSelect: () => handleSelectRivalry(rivalry.id),
                          }),
                        )}
                      </>
                    ) : null}
                    {wallEntries.length ? (
                      <>
                        {onClockEntries.length ? <p className="eyebrow">All Feuds</p> : null}
                        {wallEntries.map(({ rivalry, snapshot }) =>
                          renderFeudRow({
                            rivalry,
                            snapshot,
                            isSelected: selectedRivalryId === rivalry.id,
                            isPriority: false,
                            wrestlers: game.wrestlers,
                            onSelect: () => handleSelectRivalry(rivalry.id),
                          }),
                        )}
                      </>
                    ) : onClockEntries.length ? null : (
                      rivalrySnapshots.map(({ rivalry, snapshot }) =>
                        renderFeudRow({
                          rivalry,
                          snapshot,
                          isSelected: selectedRivalryId === rivalry.id,
                          isPriority: false,
                          wrestlers: game.wrestlers,
                          onSelect: () => handleSelectRivalry(rivalry.id),
                        }),
                      )
                    )}
                  </>
                ) : (
                  <p className="muted-copy">No active rivalries. Open the Spark Desk to build the next program.</p>
                )}
              </div>
              <div className="rivalry-feud-footer">
                <button className="rivalry-spark-launch" onClick={() => setSparkDeskOpen(true)} type="button">
                  Start The Spark
                </button>
              </div>
            </div>

          {hasFeudFocus && selectedRivalry && selectedSnapshot && selectedStorylineRead && selectedStage ? (
            <section
              className={`rivalry-focus-workspace rivalry-panel ${focusBlocked ? "is-blocked" : focusReady ? "is-ready" : focusUrgent ? "is-urgent" : ""}`.trim()}
              aria-label={`${selectedRivalry.name} story focus`}
            >
              <div className="rivalry-desk-box">
                <div className="rivalry-desk-hero">
                  <div className={`rivalry-matchup-hero structure-${getRivalryStructure(selectedRivalry)}`}>
                    {getRivalryStructure(selectedRivalry) === "tag_team" && selectedRivalry.participantIds.length === 4 ? (
                      <>
                        <div className="rivalry-matchup-side">
                          {getRivalryParticipants(selectedRivalry, game.wrestlers)
                            .slice(0, 2)
                            .map((wrestler) => (
                              <WrestlerPortrait className="rivalry-hero-portrait" key={wrestler.id} wrestler={wrestler} />
                            ))}
                        </div>
                        <span className="rivalry-matchup-vs">VS</span>
                        <div className="rivalry-matchup-side">
                          {getRivalryParticipants(selectedRivalry, game.wrestlers)
                            .slice(2, 4)
                            .map((wrestler) => (
                              <WrestlerPortrait className="rivalry-hero-portrait" key={wrestler.id} wrestler={wrestler} />
                            ))}
                        </div>
                      </>
                    ) : (
                      getRivalryParticipants(selectedRivalry, game.wrestlers)
                        .slice(0, 4)
                        .map((wrestler) => <WrestlerPortrait className="rivalry-hero-portrait" key={wrestler.id} wrestler={wrestler} />)
                    )}
                  </div>
                  <div className="rivalry-desk-hero-copy">
                    <p className="eyebrow">On The Desk</p>
                    <h3 title={selectedRivalry.name}>{getRivalryShortLabel(selectedRivalry.name, 32)}</h3>
                    <div className="rivalry-focus-tags">
                      <span>{formatRivalryStructure(getRivalryStructure(selectedRivalry))}</span>
                      <span>{formatRivalryStakes(selectedRivalry.stakes)}</span>
                      <span>{selectedBlocked ? "Blocked" : pendingFinale ? "Finale Week" : selectedSnapshot.primary.label}</span>
                    </div>
                    <p className="rivalry-focus-pressure">{selectedSnapshot.timingRead}</p>
                  </div>
                  <button className="danger-action rivalry-focus-end" disabled={pendingFinale} onClick={() => setEndDraftOpen(true)} type="button">
                    {pendingFinale ? "Finale Set" : "End"}
                  </button>
                </div>

                {endDraftOpen && selectedRivalry && !pendingFinale ? (
                  <div className="rivalry-end-draft">
                    <div className="rivalry-end-draft-copy">
                      <p className="eyebrow">Schedule Finale</p>
                      <strong>Why is this program ending?</strong>
                    </div>
                    <label>
                      Reason
                      <select className="rivalry-desk-select rivalry-desk-select--urgent" value={endReason} onChange={(event) => setEndReason(event.target.value)}>
                        {RIVALRY_END_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="rivalry-end-draft-note">Final beat must hit this week&apos;s card. Program clears next week.</p>
                    <div className="rivalry-end-draft-actions">
                      <button
                        className="danger-action"
                        onClick={() => {
                          onScheduleRivalryEnd(selectedRivalry.id, endReason);
                          setEndDraftOpen(false);
                        }}
                        type="button"
                      >
                        Schedule Finale
                      </button>
                      <button className="secondary-action" onClick={() => setEndDraftOpen(false)} type="button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="rivalry-desk-telemetry">
                  <Metric label="Heat" value={`${selectedRivalry.heat}`} detail={`Fresh ${selectedRivalry.freshness}`} />
                  <Metric label="Fresh" value={`${selectedRivalry.freshness}`} detail={`${selectedRivalry.weeksActive} wk`} />
                  <Metric label="Card" value={cardStatusValue} detail={cardStatusDetail} />
                </div>

                <div className="rivalry-desk-panels">
                  <div className={`rivalry-focus-decision tone-${decisionTone}`}>
                    <div className="rivalry-focus-read">
                      <p className="eyebrow">Story Desk</p>
                      <h4>{decisionHeadline}</h4>
                      <p>{decisionBody}</p>
                    </div>
                    <div className="rivalry-focus-controls">
                      <button className="primary-action" disabled={selectedBlocked} onClick={() => onBookRivalry(selectedRivalry.id)} type="button">
                        Book Rivalry Beat
                      </button>
                    </div>
                  </div>

                  <div className={`rivalry-focus-story-control ${storyFilesExpanded ? "is-expanded" : ""}`}>
                    <button className="rivalry-story-control-toggle" onClick={() => setStoryFilesExpanded((open) => !open)} type="button">
                      <div>
                        <p className="eyebrow">Story Control</p>
                        <strong>{selectedStorylineRead.name} · {selectedStage.name}</strong>
                      </div>
                      <span>{storyFilesExpanded ? "Hide Files ▴" : "Story Files ▾"}</span>
                    </button>
                    {storyFilesExpanded ? (
                      <div className="rivalry-story-files-body">
                        <div className="rivalry-story-files-grid">
                          <article>
                            <span>Storyline</span>
                            <strong>{selectedStorylineRead.name}</strong>
                          </article>
                          <article>
                            <span>Stage</span>
                            <strong>{selectedStage.name}</strong>
                          </article>
                        </div>
                        <p className="rivalry-story-files-read">
                          <strong>GM Read:</strong> {selectedBlocked ? "Invalid pairing under current booking rules." : selectedGmRead}
                        </p>
                        <div className="history-list rivalry-history-scroll" aria-label="Rivalry history">
                          {selectedHistory.length ? (
                            selectedHistory.map((event) => (
                              <article className="history-event" key={event.id}>
                                <span>
                                  {formatRivalryEventType(event.eventType)} · {formatHistoryStamp(event)}
                                </span>
                                <p>{event.note}</p>
                              </article>
                            ))
                          ) : (
                            <p className="muted-copy">No resolved history yet.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="rivalry-focus-workspace rivalry-panel" aria-label="Story focus workspace">
              <div className="rivalry-empty-story">
                <p className="eyebrow">No Story Selected</p>
                <h3>Pick a feud from the rail or start one from Active Feuds.</h3>
                <p className="muted-copy">The Spark Desk opens from the bottom of the Active Feuds panel.</p>
              </div>
            </section>
          )}
          </div>
        </section>
      </div>
      {sparkDeskOpen ? (
        <div className="rivalry-spark-backdrop" aria-label="Spark Desk rivalry composer" aria-modal="true" role="dialog">
          <button className="rivalry-spark-scrim" aria-label="Close Spark Desk" onClick={() => setSparkDeskOpen(false)} type="button" />
          {sparkDesk}
        </div>
      ) : null}
    </DynastyManagementShell>
  );
}
