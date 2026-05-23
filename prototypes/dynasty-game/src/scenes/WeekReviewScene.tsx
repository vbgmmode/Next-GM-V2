import type { GameScreen } from "@game/migration";
import type { GameState, ShowResult } from "@game/types";
import { getShowGrade } from "@game/scoring";
import { getWeekReviewHandoffSnapshot, getWeekReviewOfficeSnapshot } from "@game/gameContextReads";
import { DynastyMetricGrid, DynastyPanel, DynastyPrimaryAction, DynastyScrollList } from "../components/DynastyPanel";

type Props = {
  game: GameState;
  result: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onAdvanceWeek: () => void;
};

export function WeekReviewScene({ game, result, onNavigate, onAdvanceWeek }: Props) {
  const financeReport = game.financeReports.find(
    (report) => report.seasonNumber === result.seasonNumber && report.weekNumber === result.week,
  );
  const office = getWeekReviewOfficeSnapshot(game, result, financeReport);
  const handoff = getWeekReviewHandoffSnapshot(game, result, financeReport);

  return (
    <section className="dynasty-week-review-grid dynasty-page-grid">
      <article className="panel dynasty-results-hero">
        <div className="panel-kicker">Week Aftermath</div>
        <div className="dynasty-score-line">
          <h2>{result.totalScore}</h2>
          <strong>{getShowGrade(result.totalScore)}</strong>
        </div>
        <p>{result.showName}</p>
        <DynastyMetricGrid
          items={[
            { label: "Finance P/L", value: financeReport ? `$${financeReport.profitLoss.toLocaleString()}` : "—" },
            { label: "Attendance", value: financeReport ? financeReport.attendance.toLocaleString() : "—" },
            { label: "Title Events", value: String(result.titleHistoryEvents?.length ?? 0) },
            { label: "Injury Watch", value: String(game.wrestlers.filter((w) => w.injuryStatus !== "healthy").length) },
          ]}
        />
        <DynastyPrimaryAction
          actions={[
            { label: "Review Results", onClick: () => onNavigate("results") },
            { label: "Advance Week", primary: true, onClick: onAdvanceWeek },
          ]}
        />
      </article>

      <DynastyPanel kicker="GM Office" title={office.headline} badge="After-Action">
        <p className="dynasty-copy">{office.detail}</p>
        <DynastyScrollList className="dynasty-office-items">
          {office.items.slice(0, 4).map((item) => (
            <div className="goal-row" key={item.id}>
              <div className="goal-row-top">
                <span>·</span>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </div>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>

      <DynastyPanel kicker="Calendar Handoff" title={handoff.headline} badge="Next Week">
        <p className="dynasty-copy">{handoff.detail}</p>
        <DynastyScrollList>
          {handoff.items.slice(0, 4).map((item) => (
            <div className="alert-row alert-gold" key={item.id}>
              <span>→</span>
              <strong>
                {item.label}: {item.value}
              </strong>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>
    </section>
  );
}
