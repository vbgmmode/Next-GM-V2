import { useState } from "react";
import type { BookingSegmentRow, BookingViewModel } from "./buildBookingModel";
import { BookingPanel } from "./BookingPanel";

type Props = {
  canAddSegment: boolean;
  canRunShow: boolean;
  model: BookingViewModel;
  pendingClearCard: boolean;
  selectedSegmentId?: string;
  onAddSegment: () => void;
  onCancelClearCard: () => void;
  onClearCard: () => void;
  onGenerateSmartRundown: () => void;
  onRemoveSegment: (segmentId: string) => void;
  onRequestClearCard: () => void;
  onRunShow: () => void;
  onSelectSegment: (segmentId: string) => void;
};

function SegmentRowButton({
  pendingRemove,
  row,
  selected,
  onCancelRemove,
  onConfirmRemove,
  onRequestRemove,
  onSelect,
}: {
  pendingRemove: boolean;
  row: BookingSegmentRow;
  selected: boolean;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onRequestRemove: () => void;
  onSelect: (segmentId: string) => void;
}) {
  if (pendingRemove) {
    return (
      <div className="booking-segment-row booking-segment-row-confirm is-selected">
        <span className="booking-segment-index">{String(row.index).padStart(2, "0")}</span>
        <span className="booking-segment-copy">
          <strong>Remove segment?</strong>
          <em>{row.displayName}</em>
        </span>
        <span className="booking-segment-confirm-actions">
          <button className="booking-btn booking-btn-danger" onClick={onConfirmRemove} type="button">
            Confirm
          </button>
          <button className="booking-btn booking-btn-ghost" onClick={onCancelRemove} type="button">
            Cancel
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className={`booking-segment-row-wrap ${selected ? "is-selected" : ""}`.trim()}>
      <button
        className={[
          "booking-segment-row",
          row.valid ? "valid" : "is-invalid",
          selected ? "is-selected" : "",
          row.isMainEvent ? "main-event" : "",
          row.hasTitle ? "has-title" : "",
          row.hasRivalry ? "has-rivalry" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onSelect(row.id)}
        type="button"
      >
        <span className="booking-segment-index">{String(row.index).padStart(2, "0")}</span>
        <span className="booking-segment-copy">
          <strong>{row.displayName}</strong>
          <em>{row.participantLine2}</em>
          {row.participantLine3 ? <em>{row.participantLine3}</em> : null}
        </span>
        <span className="booking-segment-meta">
          <span className="booking-segment-duration">{row.durationLabel}</span>
          <span className={row.valid ? "booking-segment-status ready" : "booking-segment-status needs-talent"}>{row.statusLabel}</span>
        </span>
      </button>
      <button aria-label={`Remove ${row.displayName}`} className="booking-segment-trash booking-btn booking-btn-icon booking-btn-ghost" onClick={onRequestRemove} type="button">
        ×
      </button>
    </div>
  );
}

export function BookingSegmentRail({
  canAddSegment,
  canRunShow,
  model,
  pendingClearCard,
  selectedSegmentId,
  onAddSegment,
  onCancelClearCard,
  onClearCard,
  onGenerateSmartRundown,
  onRemoveSegment,
  onRequestClearCard,
  onRunShow,
  onSelectSegment,
}: Props) {
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  return (
    <BookingPanel className="booking-segment-rail" kicker="TV Segments" title={model.showName} badge={`${model.segmentCount} Total`}>
      <div className="booking-rail-header">
        <div className="booking-rail-meta">
          <span>{model.readiness.status}</span>
        </div>
      </div>

      <div className="booking-segment-list">
        {model.segments.length ? (
          <>
            {model.segments.map((row) => (
              <SegmentRowButton
                key={row.id}
                onCancelRemove={() => setPendingRemoveId(null)}
                onConfirmRemove={() => {
                  onRemoveSegment(row.id);
                  setPendingRemoveId(null);
                }}
                onRequestRemove={() => setPendingRemoveId(row.id)}
                onSelect={onSelectSegment}
                pendingRemove={pendingRemoveId === row.id}
                row={row}
                selected={selectedSegmentId === row.id}
              />
            ))}
            <button className="booking-add-slot-row" disabled={!canAddSegment} onClick={onAddSegment} type="button">
              <span>+</span>
              <strong>{canAddSegment ? `Add Slot ${model.segmentCount + 1}` : "Rundown Full"}</strong>
            </button>
          </>
        ) : (
          <div className="booking-empty-rundown">
            <p className="booking-empty-copy">No segments booked. Add a segment or generate a smart rundown.</p>
            <button className="booking-btn booking-btn-secondary" onClick={onAddSegment} type="button">
              + Add Segment
            </button>
          </div>
        )}
      </div>

      {pendingClearCard ? (
        <div className="booking-clear-confirm" aria-label="Confirm remove all card segments">
          <strong>Clear Card?</strong>
          <span>Removes current rundown only.</span>
          <button className="booking-btn booking-btn-danger" onClick={onClearCard} type="button">
            Confirm Remove All
          </button>
          <button className="booking-btn booking-btn-secondary" onClick={onCancelClearCard} type="button">
            Keep Card
          </button>
        </div>
      ) : (
        <div className="booking-rail-actions">
          <button className="booking-btn booking-btn-secondary" onClick={onGenerateSmartRundown} title="Generate Smart Rundown" type="button">
            Smart Rundown
          </button>
          <button className="booking-btn booking-btn-primary" disabled={!canRunShow} onClick={onRunShow} type="button">
            Run Show
          </button>
          <button className="booking-btn booking-btn-ghost booking-rail-clear" disabled={!model.segmentCount} onClick={onRequestClearCard} type="button">
            Remove All
          </button>
        </div>
      )}
    </BookingPanel>
  );
}
