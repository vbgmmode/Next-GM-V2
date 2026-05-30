import { DashboardDynastyPortrait } from "../components/dashboardDynasty";
import type { GameState } from "../game/types";
import { BookingPanel } from "./BookingPanel";
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

function BroadcastHeatGauge({ runtime }: { runtime: BookingViewModel["runtime"] }) {
  const heatPercent = Math.max(0, Math.min(1, runtime.validMinutes / runtime.heatScaleMaxMinutes));
  const needleAngle = -88 + heatPercent * 176;
  const ticks = Array.from({ length: 33 }, (_, index) => {
    const tickPercent = index / 32;
    const tickAngle = -90 + tickPercent * 180;
    const tickMinutes = tickPercent * runtime.heatScaleMaxMinutes;
    const tone = tickMinutes < runtime.targetMinMinutes ? "green" : tickMinutes <= runtime.targetMaxMinutes ? "yellow" : "red";

    return <line className={`booking-heat-gauge-tick is-${tone}`} key={index} transform={`rotate(${tickAngle} 110 110)`} x1="110" x2="110" y1="16" y2="34" />;
  });

  return (
    <section aria-label={`Broadcast heat ${runtime.validMinutes} minutes. ${runtime.heatLabel}. ${runtime.heatDetail}`} className="booking-context-heat-gauge">
      <svg aria-hidden="true" className="booking-heat-gauge" viewBox="0 0 220 132">
        <path className="booking-heat-gauge-arc" d="M28 110 A82 82 0 0 1 192 110" />
        {ticks}
        <line className={`booking-heat-gauge-needle is-${runtime.heatTone}`} transform={`rotate(${needleAngle} 110 104)`} x1="110" x2="110" y1="104" y2="38" />
        <circle className="booking-heat-gauge-hub" cx="110" cy="104" r="9" />
      </svg>
      <div className="booking-heat-gauge-scale" aria-hidden="true">
        <span>0 mins</span>
        <span>{runtime.penaltyMinMinutes} mins</span>
      </div>
      <div className="booking-context-heat-readout">
        <strong>{runtime.validMinutes} min</strong>
        <span className={`booking-runtime-heat-status is-${runtime.heatTone}`}>{runtime.heatLabel}</span>
        <em>{runtime.heatDetail}</em>
      </div>
    </section>
  );
}

function getLastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function getMatchupNameSizeClass(name: string) {
  if (name.length > 24) {
    return "is-compressed";
  }
  if (name.length > 18) {
    return "is-tight";
  }
  return "is-roomy";
}

export function BookingContextRail({ model, game }: Props) {
  const onCardCount = model.rivalryCoverage.filter((rivalry) => rivalry.onCard).length;
  const { runtime } = model;
  const visibleRivalries = model.rivalryCoverage.slice(0, 5);

  return (
    <aside className="booking-desk-column booking-context-column" aria-label="Booking context">
      <BookingPanel badge={runtime.heatLabel} className="booking-context-panel booking-broadcast-heat-panel" kicker="Broadcast" title="Heat Gauge">
        <BroadcastHeatGauge runtime={runtime} />
      </BookingPanel>

      <BookingPanel
        badge={model.rivalryCoverage.length ? `${onCardCount}/${model.rivalryCoverage.length} On Card` : "Clear"}
        className="booking-context-panel booking-coverage-panel"
        kicker="Story Pressure"
        title="Rivalry Coverage"
      >
        {model.rivalryCoverage.length ? (
          <div className="booking-coverage-list">
            {visibleRivalries.map((rivalry) => {
              const left = game.wrestlers.find((wrestler) => wrestler.id === rivalry.leftId);
              const right = game.wrestlers.find((wrestler) => wrestler.id === rivalry.rightId);
              const heatTone = getRivalryHeatTone(rivalry.intensity);
              const matchupName = left && right ? `${getLastName(left.name)} vs ${getLastName(right.name)}` : rivalry.name;
              const matchupSizeClass = getMatchupNameSizeClass(matchupName);

              return (
                <article className={rivalry.onCard ? "booking-coverage-row is-on-card" : "booking-coverage-row is-off-card"} key={rivalry.id}>
                  <div className="booking-coverage-row-top">
                    <span className="booking-coverage-pip">{rivalry.onCard ? "ON" : "OFF"}</span>
                    <strong className={matchupSizeClass} title={rivalry.name}>
                      {matchupName}
                    </strong>
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
