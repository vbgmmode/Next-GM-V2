import type { GameState } from "@game/types";
import { DynastyMetricGrid, DynastyPanel } from "../components/DynastyPanel";

type Props = { game: GameState; onStartNextSeason: () => void };

export function SeasonReviewScene({ game, onStartNextSeason }: Props) {
  const avgScore =
    game.showHistory.length > 0
      ? Math.round(game.showHistory.reduce((sum, show) => sum + show.totalScore, 0) / game.showHistory.length)
      : 0;

  return (
    <section className="dynasty-season-grid dynasty-page-grid">
      <article className="panel dynasty-results-hero">
        <div className="panel-kicker">Season Review</div>
        <h2>Season {game.seasonNumber} Complete</h2>
        <DynastyMetricGrid
          items={[
            { label: "Shows Run", value: String(game.showHistory.length) },
            { label: "Avg Score", value: String(avgScore) },
            { label: "Budget", value: `$${game.money.toLocaleString()}` },
            { label: "Roster", value: String(game.wrestlers.length) },
          ]}
        />
        <button className="primary-action" type="button" onClick={onStartNextSeason}>
          Start Next Season
        </button>
      </article>

      <DynastyPanel kicker="Archive" title="Season Highlights" badge="Summary">
        <p className="dynasty-copy">End-of-season review stub — visual placeholder for season archive cards.</p>
      </DynastyPanel>
    </section>
  );
}
