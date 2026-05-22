import { MetricTile } from "@components/broadcast";
import type { GameState, ShowResult } from "@game/types";
import { getCurrentCalendarWeek, isValidSegment } from "@game/scoring";
import { brandInitials, formatMoney } from "../fixtures/shared";
import { getNextPle, getWeeksUntilPle } from "../utils/calendar";

type BroadcastHudProps = {
  game: GameState;
  urgentStatus: string;
  cardValidCount: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  result?: ShowResult;
  rosterHealthRead?: string;
  titleSceneRead?: string;
};

export function BroadcastHud({
  game,
  urgentStatus,
  cardValidCount,
  expanded = false,
  onToggleExpand,
  result,
  rosterHealthRead,
  titleSceneRead,
}: BroadcastHudProps) {
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const lastShow = result ?? game.showHistory[game.showHistory.length - 1];

  return (
    <header className="ld-hud ld-panel--quiet" aria-label="Brand scoreboard">
      <section className="ld-hud-row ld-hud-row--primary">
        <div className="ld-hud-brand">
          <div className="ld-brand-plate" aria-hidden="true">
            <span>{brandInitials(game.brandName)}</span>
          </div>
          <div>
            <span className="ld-kicker ld-kicker--quiet">Brand HQ</span>
            <strong className="ld-brand-name">{game.brandName}</strong>
            <small>
              S{game.seasonNumber} · W{game.currentWeek} · GM {game.gmName}
            </small>
          </div>
        </div>

        <section className="ld-hud-marquee" aria-label="Next show">
          <span className="ld-kicker ld-kicker--quiet">Next Show</span>
          <strong>{currentShow.showName}</strong>
          <small>
            {currentShow.isGoHome ? "Go-Home" : currentShow.showType === "ple" ? "PLE Night" : "Weekly TV"}
            {nextPle && currentShow.showType !== "ple" ? ` · ${weeksUntilPle}w to ${nextPle.showName}` : ""}
          </small>
        </section>
      </section>

      <section className="ld-hud-row ld-hud-row--metrics" aria-label="Desk readout">
        <MetricTile label="Money" value={formatMoney(game.money)} tone="neutral" />
        <MetricTile
          label="Desk Status"
          value={urgentStatus}
          detail={`${cardValidCount}/2 valid segments`}
          tone={cardValidCount >= 2 ? "positive" : "warning"}
        />
        {onToggleExpand ? (
          <button type="button" className="ld-hud-expand ld-secondary" onClick={onToggleExpand}>
            {expanded ? "Hide Desk Detail" : "Desk Detail"}
          </button>
        ) : null}
      </section>

      {expanded && (lastShow || rosterHealthRead || titleSceneRead) ? (
        <section className="ld-hud-row ld-hud-row--expanded" aria-label="Expanded desk detail">
          {lastShow ? (
            <MetricTile label="Last Show" value={`${lastShow.totalScore}`} detail={lastShow.showName} tone="neutral" />
          ) : null}
          {rosterHealthRead ? <MetricTile label="Roster" value={rosterHealthRead} tone="neutral" /> : null}
          {titleSceneRead ? <MetricTile label="Title Scene" value={titleSceneRead} tone="neutral" /> : null}
        </section>
      ) : null}
    </header>
  );
}
