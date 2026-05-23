import { useState } from "react";
import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import type { GameState } from "../game/types";
import {
  formatPulseWeekLabel,
  getBackstageNotes,
  getLockerRoomInjuryReport,
  getMoraleTrendDelta,
} from "./lockerRoomPulseReads";
import {
  getAverageRosterMoraleLabel,
  getMoraleChartYLabelTopPercent,
  getMoraleEmoji,
  getMoraleTrendPlotCoordinate,
  getMoraleTrendSvgPoints,
  getMoralePlotY,
  getRosterMoraleTrend,
  getSeasonWeekCount,
  MORALE_CHART_Y_TICKS,
} from "./rosterReads";

function getMoraleChartXLabels(
  points: { label: string; weekIndex: number }[],
  seasonWeekCount: number,
  progressWeekIndex: number,
) {
  const labels: { anchor: "start" | "center" | "end"; label: string; left: number; muted?: boolean }[] = [];
  const minGap = 14;

  if (points.some((point) => point.weekIndex === 0)) {
    labels.push({ label: "START", left: 0, anchor: "start" });
  }

  points
    .filter((point) => point.weekIndex > 0)
    .forEach((point) => {
      const left = (point.weekIndex / seasonWeekCount) * 100;
      if (labels.every((entry) => Math.abs(entry.left - left) >= minGap)) {
        labels.push({ label: formatPulseWeekLabel(point.label), left, anchor: "center" });
      }
    });

  if (progressWeekIndex < seasonWeekCount) {
    labels.push({ label: `WK${seasonWeekCount}`, left: 100, anchor: "end", muted: true });
  }

  return labels;
}

function PulseTrendIcon({ tone }: { tone: "up" | "watch" | "down" }) {
  if (tone === "up") {
    return <span aria-hidden="true" className="locker-room-pulse-note-icon is-up">▲</span>;
  }

  if (tone === "down") {
    return <span aria-hidden="true" className="locker-room-pulse-note-icon is-down">▼</span>;
  }

  return <span aria-hidden="true" className="locker-room-pulse-note-icon is-watch">▬</span>;
}

export function LockerRoomPulsePanel({ game }: { game: GameState }) {
  const [showAllNotes, setShowAllNotes] = useState(false);
  const moraleTrend = getRosterMoraleTrend(game);
  const seasonWeekCount = getSeasonWeekCount(game);
  const moraleTrendLine = getMoraleTrendSvgPoints(moraleTrend, seasonWeekCount);
  const latestTrendPoint = moraleTrend[moraleTrend.length - 1];
  const progressWeekIndex = latestTrendPoint?.weekIndex ?? 0;
  const progressX = seasonWeekCount > 0 ? (progressWeekIndex / seasonWeekCount) * 100 : 0;
  const averageMorale = latestTrendPoint?.value ?? getAverageRosterMoraleLabel(game.wrestlers);
  const moraleDelta = getMoraleTrendDelta(moraleTrend);
  const chartXLabels = getMoraleChartXLabels(moraleTrend, seasonWeekCount, progressWeekIndex);
  const injuryReport = getLockerRoomInjuryReport(game);
  const backstageNotes = getBackstageNotes(game);
  const visibleNotes = showAllNotes ? backstageNotes : backstageNotes.slice(0, 4);

  return (
    <section className="locker-room-pulse-panel" aria-label="Locker room pulse">
      <header className="locker-room-pulse-title">
        <h3>Locker Room Pulse</h3>
      </header>

      <section className="locker-room-pulse-block" aria-label="Morale trend">
        <div className="locker-room-pulse-metric-head">
          <span aria-hidden="true" className="locker-room-pulse-icon">
            🏅
          </span>
          <strong>Morale</strong>
          <span aria-hidden="true" className="locker-room-pulse-emoji">
            {getMoraleEmoji(averageMorale)}
          </span>
          <b>{averageMorale}%</b>
          <em className={moraleDelta >= 0 ? "is-up" : "is-down"}>
            {moraleDelta >= 0 ? "+" : ""}
            {moraleDelta}%
          </em>
        </div>
        <div className="locker-room-pulse-chart">
          <div aria-hidden="true" className="locker-room-pulse-chart-y locker-room-pulse-chart-y-scaled">
            {MORALE_CHART_Y_TICKS.map((tick) => (
              <span key={tick} style={{ top: `${getMoraleChartYLabelTopPercent(tick)}%` }}>
                {tick}
              </span>
            ))}
          </div>
          <div className="locker-room-pulse-chart-main">
            <svg className="locker-room-pulse-plot" role="img" viewBox="0 0 100 36" aria-label={`Average morale trend ending at ${averageMorale}% through week ${progressWeekIndex} of ${seasonWeekCount}`}>
              {MORALE_CHART_Y_TICKS.map((tick) => (
                <line className="locker-room-pulse-grid-line" key={tick} x1="0" x2="100" y1={getMoralePlotY(tick)} y2={getMoralePlotY(tick)} />
              ))}
              {progressX < 100 ? (
                <rect className="locker-room-pulse-future-band" height="36" width={100 - progressX} x={progressX} y="0" />
              ) : null}
              {progressX > 0 && progressX < 100 ? (
                <line className="locker-room-pulse-progress-line" x1={progressX} x2={progressX} y1="0" y2="36" />
              ) : null}
              {moraleTrendLine ? <polyline points={moraleTrendLine} /> : null}
              {moraleTrend.map((point, index) => {
                const { x, y } = getMoraleTrendPlotCoordinate(point, seasonWeekCount);
                return <circle cx={x} cy={y} key={`${point.label}-${index}`} r="1.8" />;
              })}
            </svg>
            <div aria-hidden="true" className="locker-room-pulse-chart-x locker-room-pulse-chart-x-season">
              {chartXLabels.map((entry) => (
                <span
                  className={`${entry.anchor === "start" ? "is-start" : ""} ${entry.anchor === "end" ? "is-season-end" : ""} ${entry.muted ? "is-muted" : ""}`.trim()}
                  key={`${entry.label}-${entry.left}`}
                  style={{ left: `${entry.left}%` }}
                >
                  {entry.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="locker-room-pulse-block" aria-label="Injury report">
        <div className="locker-room-pulse-metric-head">
          <span aria-hidden="true" className="locker-room-pulse-icon">
            ✚
          </span>
          <strong>Injury Report</strong>
          <span aria-hidden="true" className="locker-room-pulse-emoji">
            {injuryReport.total ? "😟" : "🙂"}
          </span>
          <b>{injuryReport.total}</b>
          {injuryReport.criticalCount ? <em className="is-critical">{injuryReport.criticalCount} CRITICAL</em> : null}
        </div>
        <div className="locker-room-pulse-injury-list">
          {injuryReport.entries.length ? (
            injuryReport.entries.map((entry) => (
              <article className={`locker-room-pulse-injury-row ${entry.isCritical ? "is-critical" : ""}`} key={entry.wrestler.id}>
                <div className="locker-room-pulse-injury-name">
                  <WrestlerPortrait className="locker-room-pulse-injury-portrait" wrestler={entry.wrestler} />
                  <strong>{entry.wrestler.name}</strong>
                </div>
                <span>{entry.injuryLabel}</span>
                <small>{entry.weeksLabel}</small>
              </article>
            ))
          ) : (
            <p className="locker-room-pulse-copy">No active injuries on the roster board.</p>
          )}
        </div>
      </section>

      <section className="locker-room-pulse-block locker-room-pulse-notes-block" aria-label="Backstage notes">
        <div className="locker-room-pulse-notes-head">
          <strong>Backstage Notes</strong>
          {backstageNotes.length > 4 ? (
            <button className="locker-room-pulse-view-all" onClick={() => setShowAllNotes((value) => !value)} type="button">
              {showAllNotes ? "Show Less" : "View All >"}
            </button>
          ) : null}
        </div>
        <ul className="locker-room-pulse-notes">
          {visibleNotes.length ? (
            visibleNotes.map((note) => (
              <li className={`locker-room-pulse-note tone-${note.tone}`} key={note.id}>
                <PulseTrendIcon tone={note.tone} />
                <p>
                  {note.wrestlerNames.map((name, index) => (
                    <span key={`${note.id}-${name}`}>
                      {index > 0 ? (index === note.wrestlerNames.length - 1 ? " and " : ", ") : null}
                      <strong>{name}</strong>
                    </span>
                  ))}
                  {note.wrestlerNames.length ? " " : null}
                  {note.text}
                </p>
              </li>
            ))
          ) : (
            <li className="locker-room-pulse-note tone-watch">
              <PulseTrendIcon tone="watch" />
              <p>The locker room is steady with no urgent backstage read leading the board.</p>
            </li>
          )}
        </ul>
      </section>
    </section>
  );
}
