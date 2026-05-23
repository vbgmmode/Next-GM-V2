import type { MouseEvent } from "react";
import { bookingSegmentTypes } from "../game/matchFormatCatalog";
import type { SegmentType } from "../game/types";
import { BookingOverlay } from "./BookingOverlay";
import { getSegmentDescription } from "./bookingUtils";

type Props = {
  canAddSegment: boolean;
  smartRundownError?: string;
  onBeginAddSegment: (type: SegmentType) => void;
  onClose: () => void;
  onGenerateSmartRundown: () => void;
};

export function BookingTypePickerOverlay({
  canAddSegment,
  smartRundownError,
  onBeginAddSegment,
  onClose,
  onGenerateSmartRundown,
}: Props) {
  function handleSmartRundown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onGenerateSmartRundown();
  }

  return (
    <BookingOverlay
      ariaLabel="Segment type picker"
      footer={
        <div className="booking-type-picker-footer">
          {smartRundownError ? (
            <p className="booking-rundown-error booking-type-picker-error" role="status">
              <strong>Rundown Blocked</strong>
              <span>{smartRundownError}</span>
            </p>
          ) : null}
          <button className="booking-btn booking-btn-secondary booking-type-autogen" onClick={handleSmartRundown} type="button">
            Smart Rundown
          </button>
          <p className="booking-type-picker-note">Autogenerate a full card from current roster, titles, and rivalries.</p>
        </div>
      }
      onClose={onClose}
      title="Add Segment Type"
      wide
    >
      <div className="booking-type-picker-list">
        {bookingSegmentTypes.map((type) => (
          <button className="booking-type-option" disabled={!canAddSegment} key={type} onClick={() => onBeginAddSegment(type)} type="button">
            <span className="booking-type-option-label">{type}</span>
            <span className="booking-type-option-copy">{getSegmentDescription(type)}</span>
          </button>
        ))}
      </div>
    </BookingOverlay>
  );
}
