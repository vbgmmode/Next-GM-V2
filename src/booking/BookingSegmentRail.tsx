import { useState } from "react";
import type { BookingSegmentRow, BookingViewModel } from "./buildBookingModel";
import { BookingPanel } from "./BookingPanel";

type Props = {
  canAddSegment: boolean;
  canRunShow: boolean;
  model: BookingViewModel;
  pendingClearCard: boolean;
  pendingReplaceCard: boolean;
  selectedSegmentId?: string;
  onAddSegment: () => void;
  onCancelClearCard: () => void;
  onCancelReplaceCard: () => void;
  onClearCard: () => void;
  onGenerateSmartRundown: () => void;
  onRemoveSegment: (segmentId: string) => void;
  onReplaceSmartRundown: () => void;
  onReorderSegments: (draggedSegmentId: string, targetSegmentId: string) => void;
  onRequestClearCard: () => void;
  onRequestReplaceCard: () => void;
  onRunShow: () => void;
  onSelectSegment: (segmentId: string) => void;
};

function SegmentRowButton({
  dragOver,
  dragging,
  pendingRemove,
  row,
  selected,
  onCancelRemove,
  onConfirmRemove,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onRequestRemove,
  onSelect,
}: {
  dragOver: boolean;
  dragging: boolean;
  pendingRemove: boolean;
  row: BookingSegmentRow;
  selected: boolean;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  onDragOver: (segmentId: string) => void;
  onDragStart: (segmentId: string) => void;
  onDrop: (segmentId: string) => void;
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
    <div
      className={`booking-segment-row-wrap ${selected ? "is-selected" : ""}${dragging ? " is-dragging" : ""}${dragOver ? " is-drag-over" : ""}`.trim()}
      onDragLeave={onDragLeave}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(row.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(row.id);
      }}
    >
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
        <span
          aria-label={`Drag segment ${row.index} to reorder`}
          className="booking-segment-index booking-segment-drag-handle"
          draggable
          onDragEnd={onDragEnd}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", row.id);
            onDragStart(row.id);
          }}
          onMouseDown={(event) => event.stopPropagation()}
          title="Drag to reorder"
        >
          {String(row.index).padStart(2, "0")}
        </span>
        <span className="booking-segment-copy">
          <strong>{row.displayName}</strong>
          <em>{row.participantLine2}</em>
          {row.participantLine3 ? <em>{row.participantLine3}</em> : null}
        </span>
        <span className="booking-segment-meta">
          <span className="booking-segment-cost">{row.plannedCostLabel}</span>
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
  pendingReplaceCard,
  selectedSegmentId,
  onAddSegment,
  onCancelClearCard,
  onCancelReplaceCard,
  onClearCard,
  onGenerateSmartRundown,
  onRemoveSegment,
  onReplaceSmartRundown,
  onReorderSegments,
  onRequestClearCard,
  onRequestReplaceCard,
  onRunShow,
  onSelectSegment,
}: Props) {
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [draggingSegmentId, setDraggingSegmentId] = useState<string | null>(null);
  const [dragOverSegmentId, setDragOverSegmentId] = useState<string | null>(null);

  function handleDrop(targetSegmentId: string) {
    if (draggingSegmentId && draggingSegmentId !== targetSegmentId) {
      onReorderSegments(draggingSegmentId, targetSegmentId);
    }

    setDraggingSegmentId(null);
    setDragOverSegmentId(null);
  }

  function handleDragEnd() {
    setDraggingSegmentId(null);
    setDragOverSegmentId(null);
  }

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
                dragOver={dragOverSegmentId === row.id && draggingSegmentId !== row.id}
                dragging={draggingSegmentId === row.id}
                key={row.id}
                onCancelRemove={() => setPendingRemoveId(null)}
                onConfirmRemove={() => {
                  onRemoveSegment(row.id);
                  setPendingRemoveId(null);
                }}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setDragOverSegmentId((current) => (current === row.id ? null : current))}
                onDragOver={setDragOverSegmentId}
                onDragStart={setDraggingSegmentId}
                onDrop={handleDrop}
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
            <p className="booking-empty-copy">No segments booked. Add a segment or generate booking.</p>
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
      ) : pendingReplaceCard ? (
        <div className="booking-clear-confirm" aria-label="Confirm replace card with generated booking">
          <strong>Replace Card?</strong>
          <span>Regenerates the full rundown and removes current segments.</span>
          <button className="booking-btn booking-btn-danger" onClick={onReplaceSmartRundown} type="button">
            Confirm Replace
          </button>
          <button className="booking-btn booking-btn-secondary" onClick={onCancelReplaceCard} type="button">
            Cancel
          </button>
        </div>
      ) : (
        <div className="booking-rail-actions">
          <button className="booking-btn booking-btn-secondary" onClick={onGenerateSmartRundown} title="Generate Booking" type="button">
            Generate Booking
          </button>
          <button className="booking-btn booking-btn-primary" disabled={!canRunShow} onClick={onRunShow} type="button">
            Run Show
          </button>
          <button className="booking-btn booking-btn-ghost" disabled={!model.segmentCount} onClick={onRequestReplaceCard} type="button">
            Replace Card
          </button>
          <button className="booking-btn booking-btn-ghost booking-rail-clear" disabled={!model.segmentCount} onClick={onRequestClearCard} type="button">
            Remove All
          </button>
        </div>
      )}
    </BookingPanel>
  );
}
