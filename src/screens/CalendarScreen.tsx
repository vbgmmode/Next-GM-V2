import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { Metric } from "../components/gameShell";
import {
  getCpuResultsFeedSnapshot,
  getRatingsBattleSnapshot,
  type CpuResultsFeedSnapshot,
  type RatingsBattleSnapshot,
} from "../game/cpuRivalLoop";
import { getPleBuildPressureSnapshot, type PleBuildPressureSnapshot } from "../game/gameContextReads";
import type { GameScreen } from "../game/migration";
import { getCurrentCalendarWeek } from "../game/scoring";
import type { GameState, RivalBrandTrend, ShowResult } from "../game/types";
import "./CalendarScreen.css";
import {
  buildCalendarRecapStrip,
  getCalendarWeekStatus,
  getCalendarWeekStatusLabel,
  getShowTypeLabel,
  getWeekResult,
  getWeekResultRead,
  hasCpuRaceForWeek,
} from "./calendarScreenReads";

function formatRivalTrend(trend: RivalBrandTrend) {
  switch (trend) {
    case "surging":
      return "Surging";
    case "slipping":
      return "Slipping";
    case "steady":
      return "Steady";
    default:
      return "Unranked";
  }
}

function PleBuildPressurePanel({ snapshot }: { snapshot: PleBuildPressureSnapshot }) {
  return (
    <section className="ple-build-panel compact" aria-label="PLE build pressure">
      <div className="ple-build-head">
        <div>
          <p className="eyebrow">PLE Build Pressure</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>{snapshot.phaseLabel}</strong>
      </div>
      <p className="ple-build-copy">{snapshot.detail}</p>
      <div className="ple-build-grid">
        {snapshot.items.map((item) => (
          <article className={`ple-build-item item-${item.tone}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RatingsBattlePanel({ snapshot }: { snapshot: RatingsBattleSnapshot }) {
  const playerEntry = snapshot.entries.find((entry) => entry.isPlayer);
  const visibleEntries = snapshot.entries.slice(0, 4);

  return (
    <section className="ratings-battle-panel compact" aria-label="Ratings battle standings">
      <div className="ratings-battle-head">
        <div>
          <p className="eyebrow">Ratings Battle</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>{snapshot.latestWeekLabel}</strong>
      </div>
      <p className="ratings-battle-copy">{snapshot.detail}</p>
      <div className="ratings-battle-summary">
        <Metric label="Your Rank" value={`#${snapshot.playerRank}`} detail={playerEntry ? `Average ${playerEntry.seasonAverage}` : "No player average"} />
        <Metric label="Leader" value={snapshot.leaderName} detail="Season average race" />
        <Metric label="Vs Nearest CPU" value={`${snapshot.playerDelta >= 0 ? "+" : ""}${snapshot.playerDelta}`} detail="Average score margin" />
      </div>
      <div className="ratings-battle-table">
        {visibleEntries.map((entry) => (
          <article className={`ratings-battle-row ${entry.isPlayer ? "is-player" : ""} trend-${entry.trend}`} key={entry.id}>
            <span>#{entry.rank}</span>
            <div>
              <strong>{entry.brandName}</strong>
              <small>{entry.isPlayer ? `GM ${entry.gmName}` : `${entry.gmName} · ${formatRivalTrend(entry.trend)}`}</small>
            </div>
            <div>
              <strong>{entry.latestScore ?? "No Show"}</strong>
              <small>Avg {entry.seasonAverage || "n/a"}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CpuResultsFeedPanel({ snapshot }: { snapshot: CpuResultsFeedSnapshot }) {
  const visibleItems = snapshot.items.slice(0, 3);

  return (
    <section className="cpu-results-feed compact" aria-label="CPU results feed">
      <div className="cpu-results-head">
        <div>
          <p className="eyebrow">CPU Results Feed</p>
          <h3>{snapshot.headline}</h3>
        </div>
        <strong>{visibleItems.filter((item) => item.score !== undefined).length} Live Desks</strong>
      </div>
      <p className="cpu-results-copy">{snapshot.detail}</p>
      <div className="cpu-results-list">
        {visibleItems.map((item) => (
          <article className={`cpu-results-card tone-${item.tone}`} key={item.id}>
            <div className="cpu-results-card-head">
              <div>
                <span>{item.brandName}</span>
                <strong>{item.headline}</strong>
              </div>
              <b>{item.score ?? "Hidden"}</b>
            </div>
            <p>{item.detail}</p>
            {item.notes.length ? (
              <div className="cpu-results-notes">
                {item.notes.slice(0, 2).map((note, index) => (
                  <small key={`${item.id}-note-${index}`}>{note}</small>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

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
  const pleBuildPressure = getPleBuildPressureSnapshot(game);
  const ratingsBattle = getRatingsBattleSnapshot(game, latestResult);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, latestResult);
  const completedCount = game.calendar.filter((week) => week.completed).length;

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
          <article className="calendar-timeline-panel calendar-panel" aria-label="Season timeline">
            <div className="calendar-panel-head">
              <div>
                <p className="eyebrow">Season Timeline</p>
                <h2>12-Week Broadcast Grid</h2>
              </div>
              <strong>{completedCount}/12 Logged</strong>
            </div>

            <div className="calendar-timeline-scroll">
              {game.calendar.map((week) => {
                const result = getWeekResult(game, week);
                const status = getCalendarWeekStatus(week, game.currentWeek);
                const resultRead = getWeekResultRead(result, week);

                return (
                  <article
                    className={`calendar-week-row is-${status} ${week.showType === "ple" ? "is-ple" : ""} ${week.isGoHome ? "is-go-home" : ""}`.trim()}
                    key={week.weekNumber}
                  >
                    <div className="calendar-week-index">
                      <strong>W{week.weekNumber}</strong>
                      <span>{getCalendarWeekStatusLabel(status)}</span>
                    </div>

                    <div className="calendar-week-copy">
                      <h3>{week.showName}</h3>
                      <div className="calendar-week-tags">
                        <span className={week.showType === "ple" ? "is-ple-tag" : ""}>{getShowTypeLabel(week.showType)}</span>
                        {week.isGoHome ? <span className="is-go-home-tag">Go-Home</span> : null}
                        {week.weekNumber === 12 ? <span className="is-finale-tag">Season Finale</span> : null}
                      </div>
                    </div>

                    <div className="calendar-week-result">
                      <strong>{resultRead.primary}</strong>
                      <span>{resultRead.secondary}</span>
                      {result && hasCpuRaceForWeek(game, result) ? <small>CPU Race Logged</small> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <aside className="calendar-intel-rail calendar-panel" aria-label="Calendar intel">
            <div className="calendar-panel-head">
              <div>
                <p className="eyebrow">Broadcast Intel</p>
                <h2>PLE + Rival Desk</h2>
              </div>
              <strong>{recap.lede}</strong>
            </div>

            <div className="calendar-intel-scroll">
              <PleBuildPressurePanel snapshot={pleBuildPressure} />
              {ratingsBattle ? <RatingsBattlePanel snapshot={ratingsBattle} /> : null}
              {cpuResultsFeed ? <CpuResultsFeedPanel snapshot={cpuResultsFeed} /> : null}
            </div>
          </aside>
        </section>
      </div>
    </DynastyManagementShell>
  );
}
