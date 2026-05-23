import { useMemo, useState } from "react";
import { DashboardDynastyPortrait } from "../components/dashboardDynasty";
import { getCatalogOptionsForType, getSegmentCatalogOption, getSegmentParticipantRange, type SegmentCatalogOption } from "../game/matchFormatCatalog";
import { getStipulationById } from "../game/stipulationCatalog";
import { hasIntergenderMatchParticipants } from "../game/scoring";
import type { Championship, GameState, Rivalry, Segment, Wrestler } from "../game/types";
import { BookingOverlay } from "./BookingOverlay";
import type { BookingComposerView } from "./buildBookingModel";
import {
  getBuildableChampionships,
  getEligibleChampionships,
  getEligibleRivalries,
  getSelectedCatalogLabel,
  getSegmentBookedCounts,
  getStageLayout,
  getTalentPickerHints,
  getTalentPickerPressureLine,
  removeParticipantAtIndex,
  replaceParticipantAtIndex,
  sortTalentPickerRows,
  type StageSlot,
} from "./composerReads";
import {
  canSegmentAttachRivalry,
  getSegmentDurationMinutes,
  getStipulationsForSegmentId,
  getWrestlerNames,
  isRivalryIntergenderBlocked,
  wouldCreateIntergenderMatch,
} from "./bookingUtils";

export type IntegratedSegmentComposerProps = {
  championships: Championship[];
  composer: BookingComposerView;
  game: GameState;
  onApplyCatalogOption: (option: SegmentCatalogOption) => void;
  onBuildTitleMatch: (segmentId: string, championshipId: string) => void;
  onClearParticipants: () => void;
  onOpenProfile: (wrestlerId: string) => void;
  onRemoveSegment: () => void;
  onSetDuration: (durationMinutes: number) => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentStipulation: (segmentId: string, stipulationId: string) => void;
  onSetSegmentRivalry: (rivalryId: string) => void;
  onUpdateParticipants: (participantIds: string[]) => void;
  rivalries: Rivalry[];
  segment: Segment;
  wrestlers: Wrestler[];
};

type OverlayState =
  | { type: "closed" }
  | { type: "talent"; slotIndex: number }
  | { type: "slot-menu"; slotIndex: number }
  | { type: "format" }
  | { type: "title" }
  | { type: "rivalry" }
  | { type: "stipulation" }
  | { type: "stage-menu" };

function wrestlerById(wrestlers: Wrestler[], id?: string) {
  return id ? wrestlers.find((item) => item.id === id) : undefined;
}

function TalentSlotButton({
  locked,
  lockLabel,
  onClick,
  teamLabel,
  wrestler,
}: {
  locked?: boolean;
  lockLabel?: string;
  onClick?: () => void;
  teamLabel?: string;
  wrestler?: Wrestler;
}) {
  if (locked) {
    return (
      <div className="booking-stage-slot is-locked">
        {teamLabel ? <span className="booking-stage-slot-team">{teamLabel}</span> : null}
        <div className="booking-stage-slot-mystery">{lockLabel ?? "?"}</div>
        <span className="booking-stage-slot-label">Opponent at show time</span>
      </div>
    );
  }

  return (
    <button
      aria-label={wrestler ? `${wrestler.name} slot` : "Open talent slot"}
      className={`booking-stage-slot ${wrestler ? "is-filled" : "is-empty"}`.trim()}
      onClick={onClick}
      type="button"
    >
      {teamLabel ? <span className="booking-stage-slot-team">{teamLabel}</span> : null}
      {wrestler ? <DashboardDynastyPortrait size="lg" wrestler={wrestler} /> : <span className="booking-stage-slot-empty">+ Talent</span>}
      {wrestler ? null : <span className="booking-stage-slot-label">Open Slot</span>}
    </button>
  );
}

function StageSlots({
  layout,
  onSlotClick,
  wrestlers,
}: {
  layout: ReturnType<typeof getStageLayout>;
  onSlotClick: (slot: StageSlot) => void;
  wrestlers: Wrestler[];
}) {
  const renderSlot = (slot: StageSlot) => (
    <TalentSlotButton
      key={`${slot.index}-${slot.locked ? "locked" : "open"}`}
      lockLabel={slot.lockLabel}
      locked={slot.locked}
      onClick={slot.locked ? undefined : () => onSlotClick(slot)}
      teamLabel={slot.teamLabel}
      wrestler={wrestlerById(wrestlers, slot.wrestlerId)}
    />
  );

  if (layout.kind === "vs-singles") {
    return (
      <div className="booking-stage-matchup is-singles">
        {renderSlot(layout.slots[0])}
        <span className="booking-stage-vs">VS</span>
        {renderSlot(layout.slots[1])}
      </div>
    );
  }

  if (layout.kind === "vs-tag") {
    return (
      <div className="booking-stage-matchup is-tag">
        <div className="booking-stage-side">{layout.slots.slice(0, 2).map(renderSlot)}</div>
        <span className="booking-stage-vs">VS</span>
        <div className="booking-stage-side">{layout.slots.slice(2, 4).map(renderSlot)}</div>
      </div>
    );
  }

  if (layout.kind === "open-challenge") {
    return (
      <div className="booking-stage-matchup is-open-challenge">
        {renderSlot(layout.slots[0])}
        <span className="booking-stage-vs">VS</span>
        {renderSlot(layout.slots[1])}
      </div>
    );
  }

  return <div className="booking-stage-lineup">{layout.slots.map(renderSlot)}</div>;
}

export function IntegratedSegmentComposer({
  championships,
  composer,
  game,
  onApplyCatalogOption,
  onBuildTitleMatch,
  onClearParticipants,
  onOpenProfile,
  onRemoveSegment,
  onSetDuration,
  onSetSegmentChampionship,
  onSetSegmentStipulation,
  onSetSegmentRivalry,
  onUpdateParticipants,
  rivalries,
  segment,
  wrestlers,
}: IntegratedSegmentComposerProps) {
  const [overlay, setOverlay] = useState<OverlayState>({ type: "closed" });
  const [stageMenuOpen, setStageMenuOpen] = useState(false);

  const selectedOption = getSegmentCatalogOption(segment);
  const range = getSegmentParticipantRange(segment);
  const durationMinutes = getSegmentDurationMinutes(segment);
  const durationMin = Math.max(3, selectedOption.defaultDurationMinutes - 4);
  const durationMax = 45;
  const layout = useMemo(() => getStageLayout(segment), [segment]);
  const bookedCounts = useMemo(() => getSegmentBookedCounts(game.currentShow), [game.currentShow]);
  const catalogOptions = getCatalogOptionsForType(segment.type);
  const availableStipulations = getStipulationsForSegmentId(segment);
  const selectedStipulation = getStipulationById(segment.stipulationId);
  const eligibleChampionships = getEligibleChampionships(segment, championships, wrestlers);
  const buildableChampionships = eligibleChampionships.length ? [] : getBuildableChampionships(segment, championships);
  const selectedChampionship = championships.find((championship) => championship.id === segment.championshipId);
  const eligibleRivalries = getEligibleRivalries(segment, rivalries, wrestlers);
  const selectedRivalry = rivalries.find((rivalry) => rivalry.id === segment.rivalryId);
  const formatLabel = getSelectedCatalogLabel(segment);
  const showTitleBadge = segment.type === "Match" || segment.type === "Contract Signing" || segment.type === "Open Challenge";
  const showRivalryBadge = segment.type !== "Open Challenge";
  const showStipulationBadge = segment.type === "Match";

  function openOverlay(next: OverlayState) {
    setStageMenuOpen(false);
    setOverlay(next);
  }

  function closeOverlay() {
    setOverlay({ type: "closed" });
  }

  function handleSlotClick(slot: StageSlot) {
    if (slot.locked || slot.index < 0) {
      return;
    }

    if (slot.wrestlerId) {
      openOverlay({ type: "slot-menu", slotIndex: slot.index });
      return;
    }

    openOverlay({ type: "talent", slotIndex: slot.index });
  }

  function assignTalent(wrestlerId: string, slotIndex: number) {
    const wrestler = wrestlers.find((item) => item.id === wrestlerId);
    if (!wrestler || wrestler.injuryStatus === "major" || wouldCreateIntergenderMatch(segment, wrestler, wrestlers)) {
      return;
    }

    if (segment.participantIds[slotIndex] === wrestlerId) {
      closeOverlay();
      return;
    }

    if (!segment.participantIds.includes(wrestlerId) && segment.participantIds.length >= range.max) {
      return;
    }

    onUpdateParticipants(replaceParticipantAtIndex(segment, slotIndex, wrestlerId));
    closeOverlay();
  }

  function removeSlotTalent(slotIndex: number) {
    onUpdateParticipants(removeParticipantAtIndex(segment, slotIndex));
    closeOverlay();
  }

  function setComposerRivalry(rivalryId: string) {
    if (!rivalryId) {
      onSetSegmentRivalry("");
      closeOverlay();
      return;
    }

    const rivalry = rivalries.find((item) => item.id === rivalryId);
    const participantsFit = rivalry ? rivalry.participantIds.length >= range.min && rivalry.participantIds.length <= range.max : false;
    const canPrefill =
      rivalry &&
      segment.type !== "Open Challenge" &&
      participantsFit &&
      canSegmentAttachRivalry(segment, rivalry, wrestlers) &&
      !isRivalryIntergenderBlocked(rivalry, wrestlers) &&
      rivalry.participantIds.every((id) => wrestlers.some((wrestler) => wrestler.id === id && wrestler.injuryStatus !== "major")) &&
      !hasIntergenderMatchParticipants({ ...segment, participantIds: rivalry.participantIds }, wrestlers);

    if (canPrefill && rivalry) {
      onUpdateParticipants([...rivalry.participantIds]);
    }

    onSetSegmentRivalry(rivalryId);
    closeOverlay();
  }

  const pickerRows = sortTalentPickerRows(wrestlers, segment, game, bookedCounts);

  return (
    <div className="booking-integrated-composer">
      <div className="booking-composer-hero is-compact">
        <div className="booking-hero-topline">
          <span className="booking-hero-lower-third">
            Segment Composer · {composer.displayName}
          </span>
          <div className="booking-hero-actions">
            <button
              aria-expanded={stageMenuOpen}
              aria-haspopup="menu"
              className="booking-btn booking-btn-ghost booking-btn-icon"
              onClick={() => setStageMenuOpen((open) => !open)}
              type="button"
            >
              ···
            </button>
            {stageMenuOpen ? (
              <div className="booking-stage-menu" role="menu">
                <button
                  className="booking-btn booking-btn-ghost"
                  onClick={() => {
                    onClearParticipants();
                    setStageMenuOpen(false);
                  }}
                  type="button"
                >
                  Clear Participants
                </button>
                <button
                  className="booking-btn booking-btn-danger"
                  onClick={() => {
                    onRemoveSegment();
                    setStageMenuOpen(false);
                  }}
                  type="button"
                >
                  Remove Segment
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="booking-hero-badges">
          {showTitleBadge ? (
            <button className={`booking-hero-badge ${segment.championshipId ? "has-value" : ""}`.trim()} onClick={() => openOverlay({ type: "title" })} type="button">
              <span>Title</span>
              <strong>{selectedChampionship?.name ?? "Attach title"}</strong>
            </button>
          ) : null}
          {showRivalryBadge ? (
            <button className={`booking-hero-badge ${segment.rivalryId ? "has-value" : ""}`.trim()} onClick={() => openOverlay({ type: "rivalry" })} type="button">
              <span>Rivalry</span>
              <strong>{selectedRivalry?.name ?? "Attach rivalry"}</strong>
            </button>
          ) : null}
          {showStipulationBadge ? (
            <button className={`booking-hero-badge ${segment.stipulationId ? "has-value" : ""}`.trim()} onClick={() => openOverlay({ type: "stipulation" })} type="button">
              <span>Stipulation</span>
              <strong>{selectedStipulation?.label ?? "Standard match"}</strong>
            </button>
          ) : null}
        </div>

        <StageSlots layout={layout} onSlotClick={handleSlotClick} wrestlers={wrestlers} />

        <div className="booking-main-event-copy">
          <span>{composer.durationLabel}</span>
          <strong>{composer.type}</strong>
          <em>{composer.producerNote}</em>
        </div>
      </div>

      <div className="booking-detail-strip">
        <button className="booking-strip-format" onClick={() => openOverlay({ type: "format" })} type="button">
          <span>Format</span>
          <strong>{formatLabel}</strong>
          <small>{selectedOption.variant}</small>
        </button>
        <div className="booking-strip-duration">
          <span>Runtime</span>
          <div className="booking-duration-stepper">
            <button
              aria-label="Shorter runtime"
              className="booking-btn booking-btn-secondary booking-btn-icon"
              disabled={durationMinutes <= durationMin}
              onClick={() => onSetDuration(Math.max(durationMin, durationMinutes - 1))}
              type="button"
            >
              −
            </button>
            <label className="booking-duration-slider">
              <strong>{durationMinutes} min</strong>
              <input
                aria-label="Segment runtime"
                max={durationMax}
                min={durationMin}
                onChange={(event) => onSetDuration(Number(event.target.value))}
                type="range"
                value={durationMinutes}
              />
            </label>
            <button
              aria-label="Longer runtime"
              className="booking-btn booking-btn-secondary booking-btn-icon"
              disabled={durationMinutes >= durationMax}
              onClick={() => onSetDuration(Math.min(durationMax, durationMinutes + 1))}
              type="button"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {overlay.type === "talent" ? (
        <BookingOverlay ariaLabel="Talent picker" onClose={closeOverlay} title="Assign Talent" wide>
          <div className="booking-picker-list">
            {pickerRows.map((wrestler) => {
              const disabled = wrestler.injuryStatus === "major" || wouldCreateIntergenderMatch(segment, wrestler, wrestlers);
              const hints = getTalentPickerHints(segment, wrestler, game, bookedCounts[wrestler.id] ?? 0);
              return (
                <div className={`booking-picker-row ${disabled ? "is-disabled" : ""}`.trim()} key={wrestler.id}>
                  <button className="booking-picker-main" disabled={disabled} onClick={() => assignTalent(wrestler.id, overlay.slotIndex)} type="button">
                    <DashboardDynastyPortrait size="sm" wrestler={wrestler} />
                    <span className="booking-picker-copy">
                      <strong>{wrestler.name}</strong>
                      <em>{getTalentPickerPressureLine(wrestler, bookedCounts[wrestler.id] ?? 0)}</em>
                      {hints.length ? (
                        <span className="booking-picker-hints">
                          {hints.map((hint) => (
                            <b key={hint}>{hint}</b>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button className="booking-btn booking-btn-ghost" onClick={() => onOpenProfile(wrestler.id)} type="button">
                    Profile
                  </button>
                </div>
              );
            })}
          </div>
        </BookingOverlay>
      ) : null}

      {overlay.type === "slot-menu" ? (
        <BookingOverlay ariaLabel="Slot actions" onClose={closeOverlay} title="Talent Slot">
          <div className="booking-action-stack">
            <button className="booking-btn booking-btn-primary" onClick={() => openOverlay({ type: "talent", slotIndex: overlay.slotIndex })} type="button">
              Swap Talent
            </button>
            <button className="booking-btn booking-btn-secondary" onClick={() => removeSlotTalent(overlay.slotIndex)} type="button">
              Remove from Slot
            </button>
            {segment.participantIds[overlay.slotIndex] ? (
              <button className="booking-btn booking-btn-ghost" onClick={() => onOpenProfile(segment.participantIds[overlay.slotIndex])} type="button">
                View Profile
              </button>
            ) : null}
          </div>
        </BookingOverlay>
      ) : null}

      {overlay.type === "format" ? (
        <BookingOverlay ariaLabel="Format picker" onClose={closeOverlay} title="Segment Format" wide>
          <div className="booking-picker-grid">
            {catalogOptions.map((option) => (
              <button
                className={`booking-picker-card ${segment.segmentCatalogId === option.id ? "is-selected" : ""}`.trim()}
                key={option.id}
                onClick={() => {
                  onApplyCatalogOption(option);
                  closeOverlay();
                }}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.variant}</span>
                <small>
                  {option.defaultDurationMinutes} min · {option.minParticipants}
                  {option.minParticipants === option.maxParticipants ? "" : `-${option.maxParticipants}`} talent
                </small>
                <em>{option.productionCue}</em>
              </button>
            ))}
          </div>
        </BookingOverlay>
      ) : null}

      {overlay.type === "title" ? (
        <BookingOverlay ariaLabel="Title picker" onClose={closeOverlay} title={segment.type === "Match" ? "Title Match" : "Title Context"} wide>
          <div className="booking-action-stack">
            {eligibleChampionships.length || selectedChampionship ? (
              <button className={`booking-btn booking-btn-secondary ${!segment.championshipId ? "is-active" : ""}`.trim()} onClick={() => { onSetSegmentChampionship(segment.id, ""); closeOverlay(); }} type="button">
                {segment.type === "Match" ? "Non-Title" : "No Title Context"}
              </button>
            ) : null}
            {eligibleChampionships.map((championship) => (
              <button
                className={`booking-btn booking-btn-secondary ${segment.championshipId === championship.id ? "is-active" : ""}`.trim()}
                key={championship.id}
                onClick={() => {
                  onSetSegmentChampionship(segment.id, championship.id);
                  closeOverlay();
                }}
                type="button"
              >
                {championship.name}
                <small>Champion: {getWrestlerNames(championship.championIds, wrestlers)}</small>
              </button>
            ))}
            {buildableChampionships.slice(0, 4).map((championship) => (
              <button
                className="booking-btn booking-btn-primary"
                key={championship.id}
                onClick={() => {
                  onBuildTitleMatch(segment.id, championship.id);
                  closeOverlay();
                }}
                type="button"
              >
                Build {championship.name}
              </button>
            ))}
            {!eligibleChampionships.length && !buildableChampionships.length && !selectedChampionship ? (
              <p className="booking-overlay-note">No eligible titles for current participants.</p>
            ) : null}
          </div>
        </BookingOverlay>
      ) : null}

      {overlay.type === "rivalry" ? (
        <BookingOverlay ariaLabel="Rivalry picker" onClose={closeOverlay} title="Rivalry Context" wide>
          <div className="booking-action-stack">
            {eligibleRivalries.length || selectedRivalry ? (
              <button className={`booking-btn booking-btn-secondary ${!segment.rivalryId ? "is-active" : ""}`.trim()} onClick={() => setComposerRivalry("")} type="button">
                No Rivalry
              </button>
            ) : null}
            {eligibleRivalries.map((rivalry) => (
              <button
                className={`booking-btn booking-btn-secondary ${segment.rivalryId === rivalry.id ? "is-active" : ""}`.trim()}
                key={rivalry.id}
                onClick={() => setComposerRivalry(rivalry.id)}
                type="button"
              >
                <span>Heat {rivalry.heat}</span>
                <strong>{rivalry.name}</strong>
              </button>
            ))}
            {!eligibleRivalries.length && !selectedRivalry ? (
              <p className="booking-overlay-note">Select participants to unlock rivalry options.</p>
            ) : null}
          </div>
        </BookingOverlay>
      ) : null}

      {overlay.type === "stipulation" ? (
        <BookingOverlay ariaLabel="Stipulation picker" onClose={closeOverlay} title="Match Stipulation" wide>
          {selectedStipulation ? <p className="booking-overlay-note">{selectedStipulation.description}</p> : null}
          <div className="booking-action-stack">
            <button className={`booking-btn booking-btn-secondary ${!segment.stipulationId ? "is-active" : ""}`.trim()} onClick={() => { onSetSegmentStipulation(segment.id, ""); closeOverlay(); }} type="button">
              Standard Match
            </button>
            {availableStipulations.map((option) => (
              <button
                className={`booking-btn booking-btn-secondary ${segment.stipulationId === option.id ? "is-active" : ""}`.trim()}
                key={option.id}
                onClick={() => {
                  onSetSegmentStipulation(segment.id, option.id);
                  closeOverlay();
                }}
                type="button"
              >
                {option.label}
                <small>{option.riskContext}</small>
              </button>
            ))}
          </div>
        </BookingOverlay>
      ) : null}
    </div>
  );
}
