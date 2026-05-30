import type { GameScreen } from "../game/migration";
import { BookingPanel } from "./BookingPanel";
import type { BookingViewModel } from "./buildBookingModel";

type Props = {
  model: BookingViewModel;
  onNavigate: (screen: GameScreen) => void;
};

export function BookingStatusStrip({ model, onNavigate }: Props) {
  const { runtime } = model;
  const matchMinutes = model.segments.filter((segment) => segment.type === "Match").reduce((total, segment) => total + segment.durationMinutes, 0);
  const storyMinutes = Math.max(0, runtime.validMinutes - matchMinutes);
  const matchRuntimePercent = runtime.validMinutes > 0 ? Math.round((matchMinutes / runtime.validMinutes) * 100) : 0;
  const storyRuntimePercent = runtime.validMinutes > 0 ? Math.max(0, 100 - matchRuntimePercent) : 0;

  return (
    <BookingPanel
      badge={model.balance.balanceLabel}
      className="booking-status-strip"
      kicker="Show Status"
      title={
        <>
          Production Summary
          <span className="booking-status-cost">
            <span>Planned Cost</span>
            <b>{model.production.totalCostLabel}</b>
            <em>Segment production {model.production.bookedFinishCost ? `+ booked finishes` : "only"}</em>
          </span>
        </>
      }
    >
      <section className="booking-status-totals">
        <strong>
          Runtime {runtime.validMinutes} / {runtime.targetMinMinutes} min
        </strong>
        <div className="booking-balance-bars">
          <div className="booking-balance-row booking-runtime-share-row">
            <span className="booking-runtime-share-label is-match">Match {matchRuntimePercent}% / {matchMinutes}m</span>
            <div className="booking-balance-track booking-runtime-share-track">
              <span className="is-match-time" style={{ width: `${matchRuntimePercent}%` }} />
              <span className="is-story-time" style={{ width: `${storyRuntimePercent}%` }} />
            </div>
            <span className="booking-runtime-share-label is-story">Promo {storyRuntimePercent}% / {storyMinutes}m</span>
          </div>
          <div className="booking-balance-row booking-off-card-row">
            <span>Roster Off Card</span>
            <div className="booking-balance-track off-card">
              <span style={{ width: `${model.rosterUsage.offCardPercent}%` }} />
            </div>
            <em>
              {model.rosterUsage.offCardCount}/{model.rosterUsage.totalCount}
            </em>
          </div>
        </div>
      </section>

      <section className="booking-status-actions-column">
        <button className="booking-btn booking-btn-secondary" onClick={() => onNavigate("dashboard")} type="button">
          Back To HQ
        </button>
      </section>
    </BookingPanel>
  );
}
