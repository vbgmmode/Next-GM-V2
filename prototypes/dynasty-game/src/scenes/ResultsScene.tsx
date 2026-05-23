import type { GameScreen } from "@game/migration";
import type { GameState, ShowResult } from "@game/types";
import { getShowGrade } from "@game/scoring";
import { DynastyMetricGrid, DynastyPanel, DynastyPrimaryAction, DynastyScrollList } from "../components/DynastyPanel";

type Props = {
  game: GameState;
  result: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onContinueWeekReview: () => void;
};

export function ResultsScene({ game, result, onNavigate, onContinueWeekReview }: Props) {
  return (
    <section className="dynasty-results-grid dynasty-page-grid">
      <article className="panel dynasty-results-hero">
        <div className="panel-kicker">Broadcast Recap</div>
        <p className="dynasty-eyebrow">
          Season {result.seasonNumber} · Week {result.week}
        </p>
        <div className="dynasty-score-line">
          <h2>{result.totalScore}</h2>
          <strong>{getShowGrade(result.totalScore)}</strong>
        </div>
        <p>{result.showName}</p>
        <DynastyMetricGrid
          items={[
            { label: "Best Segment", value: String(result.segmentResults[0]?.score ?? "—") },
            { label: "Segments", value: String(result.segmentResults.length) },
            { label: "Title Notes", value: String(result.titleNotes.length) },
            { label: "Rivalry Notes", value: String(result.rivalryNotes.length) },
          ]}
        />
        <DynastyPrimaryAction
          actions={[
            { label: "Back to HQ", onClick: () => onNavigate("dashboard") },
            { label: "Continue Week Review", primary: true, onClick: onContinueWeekReview },
          ]}
        />
      </article>

      <DynastyPanel kicker="Segment Ledger" title="Show Breakdown" badge={`${result.segmentResults.length} Segments`}>
        <DynastyScrollList className="dynasty-segment-ledger">
          {result.segmentResults.map((segment, index) => (
            <div className="dynasty-ledger-row" key={segment.segmentId}>
              <span>{index + 1}</span>
              <strong>{segment.type}</strong>
              <em>{segment.score}</em>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>

      <DynastyPanel kicker="Cause Ledger" title="Title & Rivalry Drivers" badge="Post-Show">
        <DynastyScrollList>
          {result.titleNotes.map((note) => (
            <div className="alert-row alert-gold" key={note}>
              <span>★</span>
              <strong>{note}</strong>
            </div>
          ))}
          {result.rivalryNotes.map((note) => (
            <div className="alert-row alert-red" key={note}>
              <span>!</span>
              <strong>{note}</strong>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>

      <DynastyPanel kicker="Ratings Room" title={game.brandName} badge="Resolved">
        <p className="dynasty-copy">CPU rival brands logged as competitive context only — no pre-show forecasts.</p>
        <DynastyMetricGrid
          items={[
            { label: "Brand", value: game.brandName },
            { label: "Week", value: `W${result.week}` },
            { label: "Grade", value: getShowGrade(result.totalScore) },
            { label: "Momentum", value: result.biggestMomentumGain.name.split(" ").pop() ?? "—" },
          ]}
        />
      </DynastyPanel>
    </section>
  );
}
