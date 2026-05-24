import type { GameScreen } from "../game/migration";
import { BookingPanel } from "./BookingPanel";
import type { BookingViewModel } from "./buildBookingModel";

type Props = {
  model: BookingViewModel;
  onNavigate: (screen: GameScreen) => void;
};

export function BookingStatusStrip({ model, onNavigate }: Props) {
  const { runtime } = model;
  const fillPercent = Math.max(4, Math.min(100, Math.round((runtime.validMinutes / runtime.heatScaleMaxMinutes) * 100)));
  const minMarkerPercent = Math.max(0, Math.min(100, Math.round((runtime.targetMinMinutes / runtime.heatScaleMaxMinutes) * 100)));

  return (
    <BookingPanel className="booking-status-strip" kicker="Show Status" title="Production Summary" badge={model.balance.balanceLabel}>
      <section className="booking-status-totals">
        <strong>
          Runtime {runtime.validMinutes} / {runtime.targetMinMinutes} min
        </strong>
        <div className="booking-status-cost">
          <span>Planned Segment Cost</span>
          <b>{model.production.totalCostLabel}</b>
          <em>
            Segment production {model.production.bookedFinishCost ? `+ booked finishes` : "only"}
          </em>
        </div>
        <div className="booking-balance-bars">
          <div className="booking-balance-row">
            <span>Fights</span>
            <div className="booking-balance-track">
              <span style={{ width: `${model.balance.matchPercent}%` }} />
            </div>
            <em>{model.balance.matchCount}</em>
          </div>
          <div className="booking-balance-row">
            <span>Promos</span>
            <div className="booking-balance-track promo">
              <span style={{ width: `${model.balance.promoPercent}%` }} />
            </div>
            <em>{model.balance.promoCount}</em>
          </div>
        </div>
      </section>

      <section
        aria-label={`Broadcast heat ${runtime.validMinutes} minutes. ${runtime.heatLabel}. ${runtime.heatDetail}`}
        className="booking-status-runtime-heat"
      >
        <div className="booking-runtime-heat-top">
          <span className={`booking-runtime-heat-pip is-${runtime.heatTone}`}>{runtime.heatTone === "green" ? "OK" : "GO"}</span>
          <div className="booking-runtime-heat-copy">
            <strong>Broadcast Heat</strong>
            <em>
              {runtime.validMinutes} min · {runtime.heatDetail}
            </em>
          </div>
          <b className={`booking-runtime-heat-status is-${runtime.heatTone}`}>{runtime.heatLabel}</b>
        </div>
        <div className="booking-runtime-heat-track-wrap">
          <div
            aria-valuemax={runtime.heatScaleMaxMinutes}
            aria-valuemin={0}
            aria-valuenow={runtime.validMinutes}
            className="booking-runtime-heat-track"
            role="meter"
          >
            <span className={`booking-runtime-heat-fill is-${runtime.heatTone}`} style={{ width: `${fillPercent}%` }} />
          </div>
          <span
            aria-hidden="true"
            className="booking-runtime-heat-marker"
            style={{ left: `${minMarkerPercent}%` }}
            title={`${runtime.targetMinMinutes} min broadcast window`}
          />
          <span className="booking-runtime-heat-marker-label" style={{ left: `${minMarkerPercent}%` }}>
            {runtime.targetMinMinutes}
          </span>
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
