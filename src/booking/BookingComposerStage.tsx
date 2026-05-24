import type { ReactNode } from "react";
import { BookingPanel } from "./BookingPanel";
import type { BookingViewModel } from "./buildBookingModel";

type Props = {
  children: ReactNode;
  model: BookingViewModel;
  onSegmentTypeClick?: () => void;
};

export function BookingComposerStage({ children, model, onSegmentTypeClick }: Props) {
  const composer = model.composer;

  return (
    <BookingPanel
      badge={composer?.type ?? "Open"}
      badgeAriaLabel={composer?.type ? `Change segment type from ${composer.type}` : undefined}
      className="booking-composer-stage"
      kicker="Selected Segment"
      onBadgeClick={composer && onSegmentTypeClick ? onSegmentTypeClick : undefined}
      title={composer?.displayName ?? "Active Slot"}
    >
      <div className="booking-composer-body">{children}</div>
    </BookingPanel>
  );
}
