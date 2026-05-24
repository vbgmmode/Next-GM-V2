import { bookingSegmentTypes } from "../game/matchFormatCatalog";
import type { Segment, SegmentType } from "../game/types";
import { BookingOverlay } from "./BookingOverlay";
import { getSegmentDescription } from "./bookingUtils";

type Props = {
  onClose: () => void;
  onSelectType: (type: SegmentType) => void;
  segment: Segment;
};

export function BookingSegmentTypePickerOverlay({ onClose, onSelectType, segment }: Props) {
  return (
    <BookingOverlay ariaLabel="Segment type picker" onClose={onClose} title="Segment Type" wide>
      <p className="booking-overlay-note">Switch the segment category. Assigned talent carries over when it still fits.</p>
      <div className="booking-format-type-list" aria-label="Segment type">
        {bookingSegmentTypes.map((type) => (
          <button
            className={`booking-format-type-option ${segment.type === type ? "is-selected" : ""}`.trim()}
            key={type}
            onClick={() => onSelectType(type)}
            type="button"
          >
            <strong>{type}</strong>
            <span>{getSegmentDescription(type)}</span>
          </button>
        ))}
      </div>
    </BookingOverlay>
  );
}
