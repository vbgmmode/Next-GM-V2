import type { GameState } from "@game/types";
import { DynastyPanel } from "../components/DynastyPanel";

type Props = { game: GameState };

export function CalendarScene({ game }: Props) {
  return (
    <section className="dynasty-calendar-grid dynasty-page-grid">
      <DynastyPanel kicker="Season Calendar" title={`Season ${game.seasonNumber}`} badge={`Week ${game.currentWeek}`}>
        <div className="dynasty-calendar-board">
          {game.calendar.map((week) => (
            <div className={week.weekNumber === game.currentWeek ? "dynasty-calendar-week is-current" : "dynasty-calendar-week"} key={week.weekNumber}>
              <span>W{week.weekNumber}</span>
              <strong>{week.showName}</strong>
              <em>{week.showType === "ple" ? "PLE" : week.showType.toUpperCase()}</em>
            </div>
          ))}
        </div>
      </DynastyPanel>
    </section>
  );
}
