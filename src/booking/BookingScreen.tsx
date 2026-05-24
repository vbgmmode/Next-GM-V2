import { useEffect, useMemo, useRef, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { getDefaultCatalogOption, getSegmentParticipantRange, type SegmentCatalogOption } from "../game/matchFormatCatalog";
import { hasIntergenderMatchParticipants, isValidSegment } from "../game/scoring";
import { getStipulationsForSegment } from "../game/stipulationCatalog";
import type { Segment, SegmentType } from "../game/types";
import { BookingComposerStage } from "./BookingComposerStage";
import { BookingContextRail } from "./BookingContextRail";
import { BookingEmptyStage } from "./BookingEmptyStage";
import { BookingSegmentRail } from "./BookingSegmentRail";
import { BookingStatusStrip } from "./BookingStatusStrip";
import { BookingSegmentTypePickerOverlay } from "./BookingSegmentTypePickerOverlay";
import { BookingTypePickerOverlay } from "./BookingTypePickerOverlay";
import { IntegratedSegmentComposer } from "./IntegratedSegmentComposer";
import { buildBookingModel } from "./buildBookingModel";
import type { BookingScreenProps } from "./bookingTypes";
import {
  canSegmentAttachRivalry,
  getSegmentDurationMinutes,
  getShowReadiness,
  isRivalryIntergenderBlocked,
  maxBookingSegments,
  trimParticipantsForCatalogOption,
} from "./bookingUtils";
import { buildSmartRundown, buildSmartSingleSegment } from "./smartRundown";

export function BookingScreen({
  focusSegmentId,
  game,
  isQaHarness,
  onBuildTitleMatch,
  onConsumeFocusSegment,
  onAddSegment,
  onNavigate,
  onOpenProfile,
  onRemoveSegment,
  onReplaceCurrentShow,
  onRunShow,
  onSetSegmentChampionship,
  onSetSegmentStipulation,
  onSetSegmentRivalry,
  onToggleParticipant,
  onUpdateSegment,
}: BookingScreenProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | undefined>(game.currentShow[0]?.id);
  const [smartRundownError, setSmartRundownError] = useState("");
  const [pendingClearCard, setPendingClearCard] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [segmentTypePickerOpen, setSegmentTypePickerOpen] = useState(false);
  const smartRundownVariantRef = useRef(0);
  const validShowSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));
  const validSegments = validShowSegments.length;
  const invalidSegments = game.currentShow.length - validSegments;
  const validRuntimeMinutes = validShowSegments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const readiness = getShowReadiness(validSegments, invalidSegments, validRuntimeMinutes);
  const model = useMemo(() => buildBookingModel(game, selectedSegmentId), [game, selectedSegmentId]);
  const selectedSegment = game.currentShow.find((segment) => segment.id === selectedSegmentId) ?? game.currentShow[0];
  const bookingCtaTone: DynastyManagementCta["tone"] =
    readiness.tone === "ready" ? "positive" : readiness.tone === "warning" ? "warning" : "danger";
  const bookingCta: DynastyManagementCta = {
    disabled: !readiness.canRun,
    eyebrow: readiness.status,
    label: "Run Show",
    onClick: onRunShow,
    tone: bookingCtaTone,
  };

  useEffect(() => {
    if (!focusSegmentId || !game.currentShow.some((segment) => segment.id === focusSegmentId)) {
      return;
    }

    setSelectedSegmentId(focusSegmentId);
    setPendingClearCard(false);
    onConsumeFocusSegment();
  }, [focusSegmentId, game.currentShow, onConsumeFocusSegment]);

  useEffect(() => {
    if (selectedSegmentId && game.currentShow.some((segment) => segment.id === selectedSegmentId)) {
      return;
    }

    setSelectedSegmentId(game.currentShow[0]?.id);
  }, [game.currentShow, selectedSegmentId]);

  function beginAddSegment(type: SegmentType) {
    if (game.currentShow.length >= maxBookingSegments) {
      return;
    }

    const segmentId = `segment-${Date.now()}-${game.currentShow.length}`;
    onAddSegment(type, segmentId);
    setSelectedSegmentId(segmentId);
    setPendingClearCard(false);
    setSmartRundownError("");
    setTypePickerOpen(false);
  }

  function removeAndClose(segmentId: string) {
    onRemoveSegment(segmentId);
    const nextSegment = game.currentShow.find((segment) => segment.id !== segmentId);
    setSelectedSegmentId(nextSegment?.id);
    setPendingClearCard(false);
  }

  function applySegmentType(segment: Segment, type: SegmentType) {
    if (segment.type === type) {
      setSegmentTypePickerOpen(false);
      return;
    }

    const option = getDefaultCatalogOption(type);

    if (option) {
      applyCatalogOption(segment, option);
    }

    setSegmentTypePickerOpen(false);
  }

  function applyCatalogOption(segment: Segment, option: SegmentCatalogOption) {
    const allowedStipulations = getStipulationsForSegment({ ...segment, type: option.family, segmentCatalogId: option.id });
    const hasCompatibleStipulation = segment.stipulationId && allowedStipulations.some((item) => item.id === segment.stipulationId);
    const draftSegment = { ...segment, type: option.family };
    const participantIds = trimParticipantsForCatalogOption(draftSegment, option, game.championships);
    const rivalryStillValid =
      Boolean(segment.rivalryId) &&
      game.rivalries.some(
        (rivalry) =>
          rivalry.id === segment.rivalryId && rivalry.participantIds.every((participantId) => participantIds.includes(participantId)),
      );

    onUpdateSegment(segment.id, {
      type: option.family,
      segmentCatalogId: option.id,
      segmentDisplayName: option.label,
      durationMinutes: option.defaultDurationMinutes,
      participantMin: option.minParticipants,
      participantMax: option.maxParticipants,
      participantIds,
      championshipId: option.championshipAllowed ? segment.championshipId : undefined,
      rivalryId: rivalryStillValid ? segment.rivalryId : undefined,
      winnerId: segment.winnerId && participantIds.includes(segment.winnerId) ? segment.winnerId : undefined,
      stipulationId: hasCompatibleStipulation ? segment.stipulationId : undefined,
    });
  }

  function setComposerRivalry(segment: Segment, rivalryId: string) {
    const rivalry = game.rivalries.find((activeRivalry) => activeRivalry.id === rivalryId);
    const range = getSegmentParticipantRange(segment);
    const participantsFit = rivalry ? rivalry.participantIds.length >= range.min && rivalry.participantIds.length <= range.max : false;
    const canPrefill =
      rivalry &&
      segment.type !== "Open Challenge" &&
      participantsFit &&
      canSegmentAttachRivalry(segment, rivalry, game.wrestlers) &&
      !isRivalryIntergenderBlocked(rivalry, game.wrestlers) &&
      rivalry.participantIds.every((id) => game.wrestlers.some((wrestler) => wrestler.id === id && wrestler.injuryStatus !== "major")) &&
      !hasIntergenderMatchParticipants({ ...segment, participantIds: rivalry.participantIds }, game.wrestlers);

    if (canPrefill && rivalry) {
      onUpdateSegment(segment.id, { rivalryId, participantIds: [...rivalry.participantIds] });
      return;
    }

    onSetSegmentRivalry(segment.id, rivalryId);
  }

  function generateSmartRundown() {
    smartRundownVariantRef.current += 1;
    const result = buildSmartRundown(game, smartRundownVariantRef.current);

    if (result.error) {
      setSmartRundownError(result.error);
      return;
    }

    onReplaceCurrentShow(result.segments);
    setSelectedSegmentId(result.segments[0]?.id);
    setSmartRundownError("");
    setPendingClearCard(false);
    setTypePickerOpen(false);
  }

  function generateSmartSegment() {
    smartRundownVariantRef.current += 1;
    const result = buildSmartSingleSegment(game, game.currentShow, smartRundownVariantRef.current);

    if (result.error) {
      setSmartRundownError(result.error);
      return;
    }

    const segment = result.segments[0];

    if (!segment) {
      setSmartRundownError("Production could not safely draft a ready segment from the current roster.");
      return;
    }

    onReplaceCurrentShow([...game.currentShow, segment]);
    setSelectedSegmentId(segment.id);
    setSmartRundownError("");
    setPendingClearCard(false);
    setTypePickerOpen(false);
  }

  function confirmClearCard() {
    onReplaceCurrentShow([]);
    setSelectedSegmentId(undefined);
    setSmartRundownError("");
    setPendingClearCard(false);
    setTypePickerOpen(false);
  }

  function reorderSegments(draggedSegmentId: string, targetSegmentId: string) {
    const fromIndex = game.currentShow.findIndex((segment) => segment.id === draggedSegmentId);
    const toIndex = game.currentShow.findIndex((segment) => segment.id === targetSegmentId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    const nextSegments = [...game.currentShow];
    const [movedSegment] = nextSegments.splice(fromIndex, 1);
    nextSegments.splice(toIndex, 0, movedSegment);
    onReplaceCurrentShow(nextSegments);
  }

  return (
    <DynastyManagementShell className="booking-dynasty-shell" currentScreen="booking" cta={bookingCta} game={game} latestResult={game.showHistory[game.showHistory.length - 1]} onNavigate={onNavigate}>
      {isQaHarness ? (
        <section className="qa-harness-banner" aria-label="QA harness notice">
          <strong>QA Runtime Harness</strong>
          <span>In-memory fixture. Real career saves are not updated from this session.</span>
        </section>
      ) : null}

      <section className="dynasty-booking-desk" aria-label="Booking Desk production console">
        <aside className="booking-desk-column booking-left-column" aria-label="Rundown and production commands">
          <BookingSegmentRail
            canAddSegment={game.currentShow.length < maxBookingSegments}
            canRunShow={readiness.canRun}
            model={model}
            pendingClearCard={pendingClearCard}
            selectedSegmentId={selectedSegment?.id}
            onAddSegment={() => setTypePickerOpen(true)}
            onCancelClearCard={() => setPendingClearCard(false)}
            onClearCard={confirmClearCard}
            onGenerateSmartRundown={generateSmartRundown}
            onRemoveSegment={removeAndClose}
            onReorderSegments={reorderSegments}
            onRequestClearCard={() => setPendingClearCard(true)}
            onRunShow={onRunShow}
            onSelectSegment={(segmentId) => {
              setSelectedSegmentId(segmentId);
              setPendingClearCard(false);
              setTypePickerOpen(false);
              setSegmentTypePickerOpen(false);
            }}
          />
        </aside>

        <section className="booking-desk-stage" aria-label="Selected segment composer">
          <BookingComposerStage model={model} onSegmentTypeClick={() => setSegmentTypePickerOpen(true)}>
            {selectedSegment && model.composer ? (
              <IntegratedSegmentComposer
                championships={game.championships}
                composer={model.composer}
                game={game}
                onApplyCatalogOption={(option) => applyCatalogOption(selectedSegment, option)}
                onBuildTitleMatch={onBuildTitleMatch}
                onClearParticipants={() => onUpdateSegment(selectedSegment.id, { participantIds: [] })}
                onOpenProfile={onOpenProfile}
                onRemoveSegment={() => removeAndClose(selectedSegment.id)}
                onSetDuration={(durationMinutes) => onUpdateSegment(selectedSegment.id, { durationMinutes })}
                onSetSegmentChampionship={onSetSegmentChampionship}
                onSetSegmentStipulation={onSetSegmentStipulation}
                onSetSegmentRivalry={(rivalryId) => setComposerRivalry(selectedSegment, rivalryId)}
                onSetManualWinner={(winnerId) => onUpdateSegment(selectedSegment.id, { winnerId })}
                onUpdateParticipants={(participantIds) => onUpdateSegment(selectedSegment.id, { participantIds })}
                rivalries={game.rivalries}
                segment={selectedSegment}
                wrestlers={game.wrestlers}
              />
            ) : (
              <BookingEmptyStage
                canAddSegment={game.currentShow.length < maxBookingSegments}
                smartRundownError={smartRundownError}
                onAddSegmentClick={() => setTypePickerOpen(true)}
                onGenerateSmartRundown={generateSmartRundown}
              />
            )}
          </BookingComposerStage>

          {segmentTypePickerOpen && selectedSegment ? (
            <BookingSegmentTypePickerOverlay
              onClose={() => setSegmentTypePickerOpen(false)}
              onSelectType={(type) => applySegmentType(selectedSegment, type)}
              segment={selectedSegment}
            />
          ) : null}
        </section>

        <BookingContextRail game={game} model={model} />
        <BookingStatusStrip model={model} onNavigate={onNavigate} />

        {typePickerOpen ? (
          <BookingTypePickerOverlay
            canAddSegment={game.currentShow.length < maxBookingSegments}
            smartRundownError={smartRundownError}
            onBeginAddSegment={beginAddSegment}
            onClose={() => setTypePickerOpen(false)}
            onGenerateSmartSegment={generateSmartSegment}
          />
        ) : null}
      </section>
    </DynastyManagementShell>
  );
}
