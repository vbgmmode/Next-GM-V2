import type { ReactNode } from "react";
import { BookingPanel } from "./BookingPanel";
import type { BookingViewModel } from "./buildBookingModel";

type Props = {
  children: ReactNode;
  model: BookingViewModel;
};

export function BookingComposerStage({ children, model }: Props) {
  const composer = model.composer;

  return (
    <BookingPanel badge={composer?.type ?? "Open"} className="booking-composer-stage" kicker="Selected Segment" title={composer?.displayName ?? "Active Slot"}>
      <div className="booking-composer-body">{children}</div>
    </BookingPanel>
  );
}
