import { useMemo, useState } from "react";
import { DashboardDynastyPortrait } from "../components/dashboardDynasty";
import { bookedFinishCostUsd, getBookedFinishProductionCostForShow, getSegmentProductionCostForShow, getSegmentStipulationProductionCostForShow } from "../game/finance";
import { formatMoney } from "../game/formatters";
import { getCatalogOptionsForType, getSegmentCatalogOption, getSegmentParticipantRange, type SegmentCatalogOption } from "../game/matchFormatCatalog";
import { getStipulationById } from "../game/stipulationCatalog";
import { hasIntergenderMatchParticipants } from "../game/scoring";
import { isWrestlerProtectedRest } from "../game/socialInboxActions";
import type { Championship, GameState, Rivalry, Segment, Wrestler } from "../game/types";
import { BookingOverlay } from "./BookingOverlay";
import type { BookingComposerView } from "./buildBookingModel";
import {
  getBuildableChampionships,
  getEligibleChampionships,
  getEligibleRivalries,
  getActiveRivalryParticipantIds,
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
  onSetManualWinner: (winnerId?: string) => void;
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
  | { type: "finish" }
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
    </button>
  );
}

function TagTeamSide({
  onSlotClick,
  slots,
  teamLabel,
  wrestlers,
}: {
  onSlotClick: (slot: StageSlot) => void;
  slots: StageSlot[];
  teamLabel: string;
  wrestlers: Wrestler[];
}) {
  const hasTalent = slots.some((slot) => Boolean(slot.wrestlerId));

  return (
    <div className={`booking-stage-slot booking-stage-team ${hasTalent ? "is-filled" : "is-empty"}`.trim()}>
      <span className="booking-stage-slot-team">{teamLabel}</span>
      <div className="booking-stage-team-members">
        {slots.map((slot) => {
          const wrestler = wrestlerById(wrestlers, slot.wrestlerId);

          return (
            <button
              aria-label={wrestler ? `${wrestler.name} slot` : "Open talent slot"}
              className={`booking-stage-team-member ${wrestler ? "is-filled" : "is-empty"}`.trim()}
              key={`${slot.index}-${slot.locked ? "locked" : "open"}`}
              onClick={() => onSlotClick(slot)}
              type="button"
            >
              {wrestler ? <DashboardDynastyPortrait size="lg" wrestler={wrestler} /> : <span className="booking-stage-slot-empty">+ Talent</span>}
            </button>
          );
        })}
      </div>
    </div>
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
        <TagTeamSide onSlotClick={onSlotClick} slots={layout.slots.slice(0, 2)} teamLabel="Team A" wrestlers={wrestlers} />
        <span className="booking-stage-vs">VS</span>
        <TagTeamSide onSlotClick={onSlotClick} slots={layout.slots.slice(2, 4)} teamLabel="Team B" wrestlers={wrestlers} />
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
  onSetManualWinner,
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
  const activeRivalryParticipantIds = useMemo(() => getActiveRivalryParticipantIds(rivalries), [rivalries]);
  const selectedRivalry = rivalries.find((rivalry) => rivalry.id === segment.rivalryId);
  const selectedWinner = wrestlerById(wrestlers, segment.winnerId);
  const formatLabel = getSelectedCatalogLabel(segment);
  const currentShowType = game.calendar.find((week) => week.weekNumber === game.currentWeek)?.showType ?? "tv";
  const segmentProductionCost = getSegmentProductionCostForShow(segment, currentShowType) ?? 0;
  const stipulationProductionCost = getSegmentStipulationProductionCostForShow(segment, currentShowType);
  const bookedFinishCost = getBookedFinishProductionCostForShow(segment);
  const plannedSegmentCost = segmentProductionCost + stipulationProductionCost + bookedFinishCost;
  const currentShowTypeLabel = currentShowType === "ple" ? "PLE" : "TV";
  const showTitleBadge = segment.type === "Match" || segment.type === "Contract Signing" || segment.type === "Open Challenge";
  const showRivalryBadge = segment.type !== "Open Challenge";
  const showStipulationBadge = segment.type === "Match";
  const showFinishBadge = segment.type === "Match" && segment.participantIds.length > 0;
  const titleEligibleMatchOption = useMemo(
    () => catalogOptions.find((option) => option.championshipAllowed && option.minParticipants === 2 && option.maxParticipants === 2),
    [catalogOptions],
  );
  const needsTitleEligibleFormat =
    segment.type === "Match" &&
    !selectedOption.currentTitleEligible &&
    Boolean(titleEligibleMatchOption && segment.segmentCatalogId !== titleEligibleMatchOption.id);

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
    if (!wrestler || wrestler.injuryStatus === "major" || isWrestlerProtectedRest(game, wrestlerId) || wouldCreateIntergenderMatch(segment, wrestler, wrestlers)) {
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

  function applySegmentFormat(option: SegmentCatalogOption) {
    onApplyCatalogOption(option);
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
      !rivalry.participantIds.some((id) => isWrestlerProtectedRest(game, id)) &&
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
          <div className="booking-hero-cost-ledger" aria-label={`Planned segment cost ${formatMoney(plannedSegmentCost)}`}>
            <span>Segment Cost</span>
            <strong>{formatMoney(plannedSegmentCost)}</strong>
          </div>
          {showTitleBadge ? (
            <button
              className={`booking-hero-badge ${segment.championshipId ? "has-value" : ""}`.trim()}
              onClick={() => openOverlay({ type: "title" })}
              title={selectedChampionship?.name ?? "Attach title"}
              type="button"
            >
              <span>Title</span>
              <strong>{selectedChampionship?.name ?? "Attach title"}</strong>
            </button>
          ) : null}
          {showRivalryBadge ? (
            <button
              className={`booking-hero-badge ${segment.rivalryId ? "has-value" : ""}`.trim()}
              onClick={() => openOverlay({ type: "rivalry" })}
              title={selectedRivalry?.name ?? "Attach rivalry"}
              type="button"
            >
              <span>Rivalry</span>
              <strong>{selectedRivalry?.name ?? "Attach rivalry"}</strong>
            </button>
          ) : null}
          {showStipulationBadge ? (
            <button
              className={`booking-hero-badge ${segment.stipulationId ? "has-value" : ""}`.trim()}
              onClick={() => openOverlay({ type: "stipulation" })}
              title={selectedStipulation?.label ?? "Standard match"}
              type="button"
            >
              <span>Stipulation</span>
              <strong>{selectedStipulation?.label ?? "Standard match"}</strong>
            </button>
          ) : null}
          {showFinishBadge ? (
            <button
              className={`booking-hero-badge ${segment.winnerId ? "has-value" : ""}`.trim()}
              onClick={() => openOverlay({ type: "finish" })}
              title={selectedWinner ? selectedWinner.name : "Let match resolve"}
              type="button"
            >
              <span>Finish</span>
              <strong>{selectedWinner ? selectedWinner.name : "Let match resolve"}</strong>
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
        <div className="booking-strip-cost">
          <span>Planned Cost</span>
          <strong>{formatMoney(plannedSegmentCost)}</strong>
          <small>
            Production {formatMoney(segmentProductionCost)}
            {stipulationProductionCost ? ` + Stip ${formatMoney(stipulationProductionCost)}` : ""}
            {bookedFinishCost ? ` + Finish ${formatMoney(bookedFinishCost)}` : ""}
          </small>
        </div>
      </div>

      {overlay.type === "talent" ? (
        <BookingOverlay ariaLabel="Talent picker" onClose={closeOverlay} scrollable title="Assign Talent" wide>
          <div className="booking-picker-list">
            {pickerRows.map((wrestler) => {
              const disabled = wrestler.injuryStatus === "major" || isWrestlerProtectedRest(game, wrestler.id) || wouldCreateIntergenderMatch(segment, wrestler, wrestlers);
              const inRivalry = activeRivalryParticipantIds.has(wrestler.id);
              const hints = getTalentPickerHints(segment, wrestler, game, bookedCounts[wrestler.id] ?? 0);
              return (
                <div className={`booking-picker-row ${disabled ? "is-disabled" : ""} ${inRivalry ? "is-in-rivalry" : ""}`.trim()} key={wrestler.id}>
                  <button className="booking-picker-main" disabled={disabled} onClick={() => assignTalent(wrestler.id, overlay.slotIndex)} type="button">
                    <DashboardDynastyPortrait size="sm" wrestler={wrestler} />
                    <span className="booking-picker-copy">
                      <strong>{wrestler.name}</strong>
                      <em>{getTalentPickerPressureLine(wrestler, bookedCounts[wrestler.id] ?? 0)}</em>
                      {hints.length ? (
                        <span className="booking-picker-hints">
                          {hints.map((hint) => (
                            <b className={hint === "In feud" || hint === "Rivalry cast" ? "is-feud" : undefined} key={hint}>
                              {hint}
                            </b>
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
        <BookingOverlay ariaLabel="Format picker" onClose={closeOverlay} title={`${segment.type} Format`} wide>
          <p className="booking-overlay-note">Pick the {segment.type.toLowerCase()} variant for this segment.</p>
          <div className="booking-picker-grid">
            {catalogOptions.map((option) => (
              <button
                className={`booking-picker-card ${segment.segmentCatalogId === option.id ? "is-selected" : ""}`.trim()}
                key={option.id}
                onClick={() => applySegmentFormat(option)}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.variant}</span>
                <small>
                  {option.defaultDurationMinutes} min · {option.minParticipants}
                  {option.minParticipants === option.maxParticipants ? "" : `-${option.maxParticipants}`} talent
                </small>
                <b className="booking-picker-card-cost">{currentShowTypeLabel} cost {formatMoney(getSegmentProductionCostForShow({ segmentCatalogId: option.id, type: option.family }, currentShowType) ?? 0)}</b>
                <em>{option.productionCue}</em>
              </button>
            ))}
          </div>
        </BookingOverlay>
      ) : null}

      {overlay.type === "title" ? (
        <BookingOverlay ariaLabel="Title picker" onClose={closeOverlay} title={segment.type === "Match" ? "Title Match" : "Title Context"} wide>
          <div className="booking-action-stack">
            {needsTitleEligibleFormat && titleEligibleMatchOption ? (
              <>
                <p className="booking-overlay-note">
                  This format is not title eligible. Switch to a title-eligible match format to unlock title booking.
                </p>
                <button
                  className="booking-btn booking-btn-primary"
                  onClick={() => onApplyCatalogOption(titleEligibleMatchOption)}
                  type="button"
                >
                  Switch to {titleEligibleMatchOption.label}
                </button>
              </>
            ) : null}
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
                <small>Champion: {championship.championIds.length ? getWrestlerNames(championship.championIds, wrestlers) : "Vacant"}</small>
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
              <small>No specialty production surcharge</small>
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
                <small>
                  {option.riskContext} · {currentShowTypeLabel} +{formatMoney(getSegmentStipulationProductionCostForShow({ stipulationId: option.id }, currentShowType))}
                </small>
              </button>
            ))}
          </div>
        </BookingOverlay>
      ) : null}

      {overlay.type === "finish" ? (
        <BookingOverlay ariaLabel="Finish picker" onClose={closeOverlay} title="Booked Finish" wide>
          <p className="booking-overlay-note">
            Plain matches stay free. Choosing a winner adds {formatMoney(bookedFinishCostUsd)} in production handling.
          </p>
          <div className="booking-action-stack">
            <button
              className={`booking-btn booking-btn-secondary ${!segment.winnerId ? "is-active" : ""}`.trim()}
              onClick={() => {
                onSetManualWinner(undefined);
                closeOverlay();
              }}
              type="button"
            >
              Let Match Resolve
            </button>
            {segment.participantIds.map((wrestlerId) => {
              const wrestler = wrestlerById(wrestlers, wrestlerId);

              return wrestler ? (
                <button
                  className={`booking-btn booking-btn-secondary ${segment.winnerId === wrestler.id ? "is-active" : ""}`.trim()}
                  key={wrestler.id}
                  onClick={() => {
                    onSetManualWinner(wrestler.id);
                    closeOverlay();
                  }}
                  type="button"
                >
                  {wrestler.name}
                  <small>Booked Finish +{formatMoney(bookedFinishCostUsd)}</small>
                </button>
              ) : null;
            })}
          </div>
        </BookingOverlay>
      ) : null}
    </div>
  );
}
