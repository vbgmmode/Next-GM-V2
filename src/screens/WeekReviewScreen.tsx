import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { formatMoney } from "../game/formatters";
import type { GameScreen } from "../game/migration";
import type { GameState, ShowResult } from "../game/types";
import { buildWeekReviewViewModel } from "./weekReviewScreenReads";
import "./WeekReviewScreen.css";

function WrMetric({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <div className="wr-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function WrHandoffCard({ detail, label, tone, value }: { detail: string; label: string; tone: string; value: string }) {
  return (
    <article className={`wr-handoff-card tone-${tone}`}>
      <div className="wr-handoff-card-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <p>{detail}</p>
    </article>
  );
}

function WrRosterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="wr-roster-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function WeekReviewScreen({
  game,
  onAdvanceWeek,
  onNavigate,
  result,
}: {
  game: GameState;
  onAdvanceWeek: () => void;
  onNavigate: (screen: GameScreen) => void;
  result: ShowResult;
}) {
  const model = buildWeekReviewViewModel(game, result);
  const visibleRatings = model.ratingsBattle?.entries.slice(0, 4) ?? [];
  const rosterRows = model.rosterFalloutGroups.flatMap((group) =>
    group.lines.map((line, index) => ({
      id: `${group.id}-${index}`,
      label: group.label,
      value: line,
    })),
  ).slice(0, 6);

  const weekReviewCta: DynastyManagementCta = {
    eyebrow: "Calendar Action",
    label: model.advanceLabel,
    onClick: onAdvanceWeek,
    tone: model.advanceLabel === "Season Review" ? "brand" : "positive",
  };

  return (
    <DynastyManagementShell
      className="gameplay-command-shell week-review-command-shell"
      currentScreen="weekReview"
      cta={weekReviewCta}
      game={game}
      latestResult={result}
      onNavigate={onNavigate}
    >
      <div className="wr-desk-body">
        <section className={`wr-strip${model.isPleResult ? " is-ple" : ""}`} aria-label="Week closeout">
          <div className="wr-score-plate">
            <span>
              S{model.seasonNumber} W{model.week} · {model.showTypeLabel}
            </span>
            <div className="wr-score-line">
              <h2>{model.totalScore}</h2>
              <strong>{model.grade}</strong>
            </div>
            <em>{model.showName}</em>
          </div>
          <div className="wr-strip-metrics">
            <WrMetric
              label="Net P/L"
              value={model.financeReport ? formatMoney(model.financeReport.profitLoss) : "—"}
              detail={model.financeReport ? formatMoney(model.financeReport.endingMoney) : undefined}
            />
            <WrMetric label="Next Show" value={model.nextWeekName} detail={model.nextWeekTypeLabel} />
            <WrMetric label="Next PLE" value={model.nextPleName} detail={model.nextPleDetail} />
            <WrMetric label="Peak Segment" value={`${model.bestSegmentScore}`} detail={model.bestSegmentDetail} />
          </div>
        </section>

        <div className="wr-dashboard">
          <section className="wr-panel tone-handoff" aria-label="GM handoff">
            <header className="wr-panel-head">
              <div>
                <p className="eyebrow">GM Handoff</p>
                <h3>{model.handoff.headline}</h3>
              </div>
            </header>
            <div className="wr-handoff-list">
              {model.handoff.items.map((item) => (
                <WrHandoffCard detail={item.detail} key={item.id} label={item.label} tone={item.tone} value={item.value} />
              ))}
            </div>
          </section>

          <section className="wr-panel tone-roster" aria-label="Roster fallout">
            <header className="wr-panel-head">
              <div>
                <p className="eyebrow">Roster Fallout</p>
                <h3>Locker Room</h3>
              </div>
            </header>
            <div className="wr-roster-list">
              {rosterRows.length ? (
                rosterRows.map((row) => <WrRosterRow key={row.id} label={row.label} value={row.value} />)
              ) : (
                <WrRosterRow label="Status" value="Steady" />
              )}
            </div>
          </section>

          {model.ratingsBattle ? (
            <section className="wr-panel tone-ratings" aria-label="Ratings battle">
              <header className="wr-panel-head">
                <div>
                  <p className="eyebrow">Ratings</p>
                  <h3>{model.ratingsBattle.headline}</h3>
                </div>
                <b>{model.ratingsBattle.latestWeekLabel}</b>
              </header>
              <div className="wr-ratings-list">
                {visibleRatings.map((entry) => (
                  <article className={entry.isPlayer ? "wr-ratings-row is-player" : "wr-ratings-row"} key={entry.id}>
                    <span className="wr-ratings-rank">#{entry.rank}</span>
                    <strong className="wr-ratings-brand">{entry.brandName}</strong>
                    <span className="wr-ratings-avg">Avg {entry.seasonAverage || "n/a"}</span>
                    <strong className="wr-ratings-score">{entry.latestScore ?? "—"}</strong>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </DynastyManagementShell>
  );
}
