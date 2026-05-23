import { DashboardDynastyPortrait } from "../components/dashboardDynasty";
import type { GameState } from "../game/types";
import { BookingMetricGrid, BookingPanel } from "./BookingPanel";
import type { BookingViewModel } from "./buildBookingModel";
import { getRivalryHeatTone } from "./bookingUtils";

type Props = {
  game: GameState;
  model: BookingViewModel;
};

function RivalryHeatBar({ tone, value }: { tone: ReturnType<typeof getRivalryHeatTone>; value: number }) {
  const fillPercent = Math.max(4, Math.min(100, Math.round(value)));

  return (
    <div aria-valuemax={100} aria-valuemin={0} aria-valuenow={value} className="booking-runtime-heat-track booking-coverage-heat-track" role="meter">
      <span className={`booking-runtime-heat-fill is-${tone}`} style={{ width: `${fillPercent}%` }} />
    </div>
  );
}

export function BookingContextRail({ model, game }: Props) {
  const onCardCount = model.rivalryCoverage.filter((rivalry) => rivalry.onCard).length;

  return (
    <aside className="booking-desk-column booking-context-column" aria-label="Booking context">
      <BookingPanel badge={model.readiness.status} className="booking-context-panel booking-readiness-panel" kicker="Readiness" title="Card Status">
        <BookingMetricGrid items={model.metrics} />
      </BookingPanel>

      <BookingPanel
        badge={model.rivalryCoverage.length ? `${onCardCount}/${model.rivalryCoverage.length} On Card` : "Clear"}
        className="booking-context-panel booking-coverage-panel"
        kicker="Story Pressure"
        title="Rivalry Coverage"
      >
        {model.rivalryCoverage.length ? (
          <div className="booking-coverage-list">
            {model.rivalryCoverage.map((rivalry) => {
              const left = game.wrestlers.find((wrestler) => wrestler.id === rivalry.leftId);
              const right = game.wrestlers.find((wrestler) => wrestler.id === rivalry.rightId);
              const heatTone = getRivalryHeatTone(rivalry.intensity);

              return (
                <article className={rivalry.onCard ? "booking-coverage-row is-on-card" : "booking-coverage-row is-off-card"} key={rivalry.id}>
                  <div className="booking-coverage-row-top">
                    <span className="booking-coverage-pip">{rivalry.onCard ? "ON" : "OFF"}</span>
                    <strong title={rivalry.name}>{rivalry.name}</strong>
                    <em className={rivalry.onCard ? "is-on-card" : "is-off-card"}>{rivalry.onCard ? "On Card" : "Off Card"}</em>
                  </div>
                  <div className="booking-coverage-row-meta">
                    <div className="booking-coverage-portraits">
                      {left ? <DashboardDynastyPortrait size="sm" wrestler={left} /> : null}
                      {right ? <DashboardDynastyPortrait size="sm" wrestler={right} /> : null}
                    </div>
                    <div className="booking-coverage-heat-line">
                      <em>Heat</em>
                      <RivalryHeatBar tone={heatTone} value={rivalry.intensity} />
                      <b className={`is-${heatTone}`}>{rivalry.intensity}</b>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="booking-empty-copy">No active rivalries on the board.</p>
        )}
      </BookingPanel>

      {model.riskRows.length ? (
        <BookingPanel badge={`${model.riskRows.length} Flagged`} className="booking-context-panel booking-risk-panel" kicker="Roster Risk" title="Workload Board">
          <div className="booking-risk-list">
            {model.riskRows.slice(0, 2).map((row) => (
              <article key={row.wrestlerId}>
                <strong>{row.name}</strong>
                <span>{row.read}</span>
              </article>
            ))}
          </div>
        </BookingPanel>
      ) : null}
    </aside>
  );
}
