import { useEffect, useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { Metric } from "../components/gameShell";
import type { GameScreen } from "../game/migration";
import { getCurrentCalendarWeek } from "../game/scoring";
import type { GameState, ShowResult } from "../game/types";
import "./CalendarScreen.css";
import { PLE_COUNT } from "../game/constants";
import {
  buildCalendarRecapStrip,
  buildCalendarWeekSpotlight,
  getCalendarCycleColumnLabels,
  getCalendarTileColumnLabel,
  getCalendarTileShowName,
  getCalendarWeekStatus,
  getCalendarWeekStatusLabel,
  getSeasonCalendarBlocks,
  getWeekResult,
  getWeekResultRead,
  hasCpuRaceForWeek,
} from "./calendarScreenReads";

export function CalendarScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const currentShow = getCurrentCalendarWeek(game);
  const recap = buildCalendarRecapStrip(game, currentShow);
  const completedCount = game.calendar.filter((week) => week.completed).length;
  const calendarBlocks = useMemo(() => getSeasonCalendarBlocks(game.calendar), [game.calendar]);
  const cycleColumnLabels = useMemo(() => getCalendarCycleColumnLabels(), []);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(game.currentWeek);

  useEffect(() => {
    if (!game.calendar.some((week) => week.weekNumber === selectedWeekNumber)) {
      setSelectedWeekNumber(game.currentWeek);
    }
  }, [game.calendar, game.currentWeek, selectedWeekNumber]);

  const selectedWeek = game.calendar.find((week) => week.weekNumber === selectedWeekNumber) ?? currentShow;
  const spotlight = useMemo(() => buildCalendarWeekSpotlight(game, selectedWeek), [game, selectedWeek]);

  const calendarCta: DynastyManagementCta = {
    eyebrow: "Current Week",
    label: "Book Show",
    onClick: () => onNavigate("booking"),
    tone: "brand",
  };

  return (
    <DynastyManagementShell className="calendar-command-shell" currentScreen="calendar" cta={calendarCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <div className="calendar-desk-body">
        <section className="calendar-recap-strip" aria-label="Season clock">
          <p className="eyebrow">Road To PLE</p>
          <strong>{recap.headline}</strong>
          <span>{recap.detail}</span>
        </section>

        <section className="calendar-command-board" aria-label="Season calendar desk">
          <article className="calendar-timeline-panel calendar-panel" aria-label="Season calendar">
            <div className="calendar-panel-head">
              <div>
                <p className="eyebrow">Season Calendar</p>
                <h2>{PLE_COUNT}-Cycle Broadcast Grid</h2>
              </div>
              <strong>{completedCount}/{PLE_COUNT} Logged</strong>
            </div>

            <div className="calendar-grid-board">
              {calendarBlocks.map((block) => (
                <section className="calendar-cycle-block" aria-label={`${block.pleShowName} cycle`} key={block.id}>
                  <header className="calendar-cycle-head">
                    <p className="eyebrow">Build {block.cycleNumber}</p>
                    <h3 className="calendar-cycle-ple-name">{block.pleShowName}</h3>
                  </header>

                  <div className="calendar-cycle-columns" aria-hidden="true">
                    {cycleColumnLabels.map((label, columnIndex) => (
                      <span key={`${block.id}-col-${columnIndex}`}>{label}</span>
                    ))}
                  </div>

                  <div className="calendar-cycle-grid">
                    {block.weeks.map((week) => {
                      const result = getWeekResult(game, week);
                      const status = getCalendarWeekStatus(week, game.currentWeek);
                      const resultRead = getWeekResultRead(result, week);
                      const isSelected = week.weekNumber === selectedWeekNumber;

                      return (
                        <button
                          className={`calendar-day-tile is-${status} ${week.showType === "ple" ? "is-ple" : ""} ${week.isGoHome ? "is-go-home" : ""} ${isSelected ? "is-selected" : ""}`.trim()}
                          key={week.weekNumber}
                          onClick={() => setSelectedWeekNumber(week.weekNumber)}
                          type="button"
                        >
                          <div className="calendar-day-tile-head">
                            <strong>W{week.weekNumber}</strong>
                            <span>{getCalendarTileColumnLabel(week)}</span>
                          </div>
                          <h3>{getCalendarTileShowName(week.showName)}</h3>
                          <p className="calendar-day-tile-status">{getCalendarWeekStatusLabel(status)}</p>
                          <div className="calendar-day-tile-foot">
                            <b>{resultRead.primary}</b>
                            <small>{resultRead.secondary}</small>
                          </div>
                          {result && hasCpuRaceForWeek(game, result) ? <em>CPU Race</em> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <aside className="calendar-week-spotlight" aria-label="Selected week show stats">
            <div className="calendar-spotlight-head">
              <div>
                <p className="eyebrow">Week {spotlight.weekNumber} Show File</p>
                <h2>{spotlight.showName}</h2>
              </div>
              <span className={`calendar-spotlight-status status-${spotlight.status}`}>{spotlight.statusLabel}</span>
            </div>

            <div className="calendar-spotlight-tags">
              {spotlight.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>

            <div className={`calendar-spotlight-hero ${spotlight.score !== undefined ? "has-score" : ""}`.trim()}>
              {spotlight.score !== undefined ? (
                <>
                  <strong>{spotlight.score}</strong>
                  <span>{spotlight.grade}</span>
                </>
              ) : (
                <>
                  <strong>{spotlight.headline}</strong>
                  <span>{spotlight.status === "current" ? "Awaiting Run Show" : "No Stats Yet"}</span>
                </>
              )}
              <p>{spotlight.detail}</p>
            </div>

            <div className="calendar-spotlight-metrics">
              {spotlight.metrics.map((metric) => (
                <Metric detail={metric.detail} key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </div>

            {spotlight.segmentRows.length ? (
              <section className="calendar-spotlight-section" aria-label="Segment log">
                <div className="calendar-spotlight-section-head">
                  <p className="eyebrow">{spotlight.score !== undefined ? "Segment Log" : "Current Card"}</p>
                  <strong>{spotlight.segmentRows.length} Listed</strong>
                </div>
                <div className="calendar-segment-table">
                  {spotlight.segmentRows.map((segment) => (
                    <article className={segment.isTitleMatch ? "calendar-segment-row is-title-match" : "calendar-segment-row"} key={segment.id}>
                      <div className="calendar-segment-row-copy">
                        <span>{segment.label}</span>
                        <strong className={segment.outcome ? "is-outcome" : undefined}>{segment.outcome ?? segment.participants}</strong>
                      </div>
                      <div className="calendar-segment-row-score">
                        <span>Score</span>
                        <b>{spotlight.score !== undefined ? segment.score : "—"}</b>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {spotlight.cpuRace.length ? (
              <section className="calendar-spotlight-section" aria-label="Ratings race for week">
                <div className="calendar-spotlight-section-head">
                  <p className="eyebrow">Week Ratings Race</p>
                  <strong>{spotlight.cpuRace.length} Desks</strong>
                </div>
                <div className="calendar-cpu-race-table">
                  {spotlight.cpuRace.map((entry) => (
                    <article className={`calendar-cpu-race-row ${entry.isPlayer ? "is-player" : ""}`} key={`${entry.brandName}-${entry.score}`}>
                      <strong>{entry.brandName}</strong>
                      <span>{entry.grade}</span>
                      <b>{entry.score}</b>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {spotlight.notes.length ? (
              <section className="calendar-spotlight-section" aria-label="Title and rivalry notes">
                <div className="calendar-spotlight-section-head">
                  <p className="eyebrow">Show Notes</p>
                  <strong>{spotlight.notes.length} Logged</strong>
                </div>
                <div className="calendar-note-stack">
                  {spotlight.notes.map((note, index) => (
                    <p key={`${spotlight.weekNumber}-note-${index}`}>{note}</p>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </DynastyManagementShell>
  );
}
