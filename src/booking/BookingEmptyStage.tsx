import { bookingSegmentTypes } from "../game/matchFormatCatalog";
import type { SegmentType } from "../game/types";
import { getSegmentDescription } from "./bookingUtils";

type Props = {
  canAddSegment: boolean;
  smartRundownError: string;
  onAddSegmentClick: () => void;
  onGenerateSmartRundown: () => void;
};

export function BookingEmptyStage({ canAddSegment, smartRundownError, onAddSegmentClick, onGenerateSmartRundown }: Props) {
  return (
    <section className="booking-empty-stage" aria-label="Choose segment type">
      <div className="booking-empty-lower-third">Segment Composer · Open Slot</div>
      <div className="booking-empty-stage-copy">
        <h3>No segments on the rundown</h3>
        <p>Build tonight&apos;s card from the production desk.</p>
      </div>
      {smartRundownError ? (
        <p className="booking-rundown-error" role="status">
          <strong>Rundown Blocked</strong>
          <span>{smartRundownError}</span>
        </p>
      ) : null}
      <div className="booking-empty-actions">
        <button className="booking-btn booking-btn-primary" disabled={!canAddSegment} onClick={onAddSegmentClick} type="button">
          + Add Segment
        </button>
        <button className="booking-btn booking-btn-secondary" onClick={onGenerateSmartRundown} type="button">
          Generate Booking
        </button>
      </div>
    </section>
  );
}
