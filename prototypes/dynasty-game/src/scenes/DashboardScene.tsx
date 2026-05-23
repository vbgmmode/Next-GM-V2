import type { GameScreen } from "@game/migration";
import type { GameState, ShowResult, Wrestler } from "@game/types";
import { AlertIcon } from "@dynasty/components/AlertIcon";
import { IntensityMeter } from "@dynasty/components/IntensityMeter";
import { MoraleEmoji } from "@dynasty/components/MoraleEmoji";
import { ProgressBar } from "@dynasty/components/ProgressBar";
import { RoleIcon } from "@dynasty/components/RoleIcon";
import { StaminaBar } from "@dynasty/components/StaminaBar";
import { buildDashboardModel } from "../adapters/buildDashboardModel";
import { DynastyPortrait } from "../components/DynastyPortrait";
import { ShowScoreChart } from "../components/ShowScoreChart";

type Props = {
  game: GameState;
  result?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
};

function findWrestler(game: GameState, id: string): Wrestler | undefined {
  return game.wrestlers.find((wrestler) => wrestler.id === id);
}

function wrestlerOrPlaceholder(game: GameState, id: string, fallbackName: string): Pick<Wrestler, "id" | "name"> {
  const wrestler = findWrestler(game, id);
  return wrestler ?? { id, name: fallbackName };
}

export function DashboardScene({ game, result, onNavigate }: Props) {
  const model = buildDashboardModel(game, result);
  const chartRangeLabel =
    model.metrics.chartPoints.length > 1
      ? `${model.metrics.chartPoints[0]?.label}-${model.metrics.chartPoints[model.metrics.chartPoints.length - 1]?.label}`
      : model.metrics.chartPoints[0]?.label ?? "—";

  return (
    <section className="dashboard-main-grid dynasty-page-grid">
      <aside className="dashboard-column left-column">
        <article className="panel brand-status-panel">
          <div className="panel-kicker">Brand Status</div>
          <div className="dynasty-brand-plate" aria-hidden="true">
            {model.brandInitials}
          </div>
          <div className="brand-rating">
            <span>Show Rating</span>
            <strong>{model.brandStatus.ratingLabel}</strong>
          </div>
          <div className="mini-stat-grid">
            <div>
              <span>Fans</span>
              <strong>{model.brandStatus.fansLabel}</strong>
            </div>
            <div>
              <span>Budget</span>
              <strong>{model.brandStatus.budgetLabel}</strong>
            </div>
            <div>
              <span>Weekly Profit</span>
              <strong className={model.brandStatus.profitPositive ? "positive" : "negative"}>
                {model.brandStatus.profitLabel}
              </strong>
            </div>
          </div>
        </article>

        <article className="panel champions-panel">
          <div className="section-heading">
            <span>Champions</span>
            <b>Gold Ledger</b>
          </div>
          <div className="champion-list">
            {model.champions.map((champion, index) => {
              const holder = champion.holderId ? findWrestler(game, champion.holderId) : undefined;
              return (
                <div className="champion-row" key={champion.id}>
                  <span className="slot">{String(index + 1).padStart(2, "0")}</span>
                  {holder ? (
                    <DynastyPortrait wrestler={holder} size="md" />
                  ) : (
                    <span className="dynasty-portrait-vacant dynasty-portrait--md" aria-hidden="true">
                      —
                    </span>
                  )}
                  <span className="champion-copy">
                    <strong>{champion.title}</strong>
                    <em>{champion.name}</em>
                  </span>
                  <span className="belt-icon" aria-hidden="true">
                    ★
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel goals-panel">
          <div className="section-heading">
            <span>GM Goals</span>
            <b>{model.goals.length} Active</b>
          </div>
          {model.goals.map((goal) => (
            <div className={goal.complete ? "goal-row is-complete" : "goal-row"} key={goal.id}>
              <div className="goal-row-top">
                <span>{goal.complete ? "✓" : "·"}</span>
                <strong title={goal.label}>{goal.label}</strong>
                <em>{goal.complete ? "Done" : goal.detail}</em>
              </div>
              <ProgressBar current={Math.round(goal.progress * 100)} total={100} complete={goal.complete} />
            </div>
          ))}
        </article>
      </aside>

      <section className="dashboard-column center-column">
        <article className="panel roster-panel">
          <div className="roster-topline">
            <div className="section-heading">
              <span>Roster Overview</span>
              <b>Top Stars</b>
            </div>
          </div>
          <div className="roster-table" role="table" aria-label="Roster overview">
            <div className="roster-row roster-head" role="row">
              <span>#</span>
              <span>Superstar</span>
              <span>Role</span>
              <span>Style</span>
              <span>Pop</span>
              <span>Sta</span>
              <span>Mor</span>
              <span className="ovr-head">OVR</span>
              <span>Contract</span>
              <span>Cost</span>
            </div>
            <div className="roster-scroll">
              {model.roster.map((member) => {
                const wrestler = findWrestler(game, member.id);
                return (
                  <div className={member.selected ? "roster-row is-selected" : "roster-row"} role="row" key={member.id}>
                    <span>{member.rank}</span>
                    <div className="superstar-cell">
                      {wrestler ? <DynastyPortrait wrestler={wrestler} size="sm" /> : null}
                      <strong title={member.name}>{member.name}</strong>
                    </div>
                    <RoleIcon role={member.role} />
                    <span>{member.style}</span>
                    <span>{member.pop}</span>
                    <span>
                      <StaminaBar value={member.stamina} />
                    </span>
                    <span>
                      <MoraleEmoji morale={member.morale} />
                    </span>
                    <span className="overall-box">{member.overall}</span>
                    <span>{member.contract}</span>
                    <span>{member.cost}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="style-legend dynasty-roster-footer">
            <span className="roster-size-tag">{model.rosterSizeLabel}</span>
          </div>
        </article>

        <section className="center-bottom-grid">
          <article className="panel promo-panel">
            <div className="promo-backdrop dynasty-promo-backdrop">
              <span className="lower-third">Next Show: {model.promo.showName}</span>
              <div className="dynasty-promo-matchup">
                <DynastyPortrait wrestler={wrestlerOrPlaceholder(game, model.promo.leftId, model.promo.leftName)} size="lg" />
                <span>VS</span>
                <DynastyPortrait wrestler={wrestlerOrPlaceholder(game, model.promo.rightId, model.promo.rightName)} size="lg" />
              </div>
              <div className="main-event-copy">
                <span>{model.promo.stipulation}</span>
                <strong>{model.promo.headline}</strong>
                <em>
                  {model.promo.leftName} vs {model.promo.rightName}
                </em>
              </div>
            </div>
          </article>

          <article className="panel show-card-panel">
            <div className="section-heading">
              <span>Current Show Card</span>
              <b>{model.showCard.length} Segments</b>
            </div>
            <div className="show-card-list">
              {model.showCard.map((entry) => (
                <div className={entry.valid ? "show-card-row" : "show-card-row is-invalid"} key={entry.id}>
                  <span>{entry.index}</span>
                  <strong title={entry.match}>{entry.match}</strong>
                  <em>{entry.stipulation}</em>
                </div>
              ))}
            </div>
            <div className="action-row">
              {model.secondaryActions.map((action) => (
                <button key={action.label} type="button" onClick={() => onNavigate(action.screen)}>
                  {action.label}
                </button>
              ))}
              <button className="primary-action" type="button" onClick={() => onNavigate(model.primaryAction.screen)}>
                {model.primaryAction.label}
              </button>
            </div>
          </article>
        </section>
      </section>

      <aside className="dashboard-column right-column">
        <article className="panel rivalries-panel">
          <div className="section-heading">
            <span>Rivalries</span>
            <b>Intensity Feed</b>
          </div>
          {model.rivalries.length ? (
            model.rivalries.map((rivalry) => (
              <div className="rivalry-row" key={rivalry.id}>
                <div className="rivalry-matchup">
                  <DynastyPortrait wrestler={wrestlerOrPlaceholder(game, rivalry.leftId, rivalry.leftName)} size="sm" />
                  <strong>
                    {rivalry.leftName} vs {rivalry.rightName}
                  </strong>
                  <DynastyPortrait wrestler={wrestlerOrPlaceholder(game, rivalry.rightId, rivalry.rightName)} size="sm" />
                </div>
                <div className="rivalry-meter-line">
                  <em>Intensity</em>
                  <IntensityMeter value={rivalry.intensity} />
                  <b>{rivalry.intensity}</b>
                </div>
              </div>
            ))
          ) : (
            <p className="dynasty-empty-copy">No active rivalries in this fixture.</p>
          )}
        </article>

        <article className="panel metrics-panel">
          <div className="section-heading">
            <span>Show Metrics ({game.brandName})</span>
            <b>{chartRangeLabel}</b>
          </div>
          <div className="metric-grid">
            <div>
              <span>Viewership</span>
              <strong>
                {model.metrics.viewershipLabel}
                {model.metrics.viewershipDelta ? <em>{model.metrics.viewershipDelta}</em> : null}
              </strong>
            </div>
            <div>
              <span>Show Quality</span>
              <strong>{model.metrics.showQualityLabel}</strong>
            </div>
            <div>
              <span>Match Quality</span>
              <strong>{model.metrics.matchQualityLabel}</strong>
            </div>
            <div>
              <span>Fan Satisfaction</span>
              <strong>{model.metrics.fanSatisfactionLabel}</strong>
            </div>
          </div>
          <ShowScoreChart points={model.metrics.chartPoints} />
        </article>

        <article className="panel alerts-panel">
          <div className="section-heading">
            <span>GM Alerts</span>
            <b>Live Desk</b>
          </div>
          {model.alerts.map((alert) => (
            <AlertIcon alert={alert} key={alert.id} />
          ))}
        </article>

        <article className="panel draft-panel">
          <div className="section-heading">
            <span>Draft Pool</span>
            <b>Top 5</b>
          </div>
          <div className="draft-list">
            {model.draftPool.map((entry) => (
              <div className="draft-row" key={entry.name}>
                <strong>{entry.name}</strong>
                <span>{entry.style}</span>
              </div>
            ))}
          </div>
          <button className="gold-action" type="button" onClick={() => onNavigate("market")}>
            View Full Draft Class
          </button>
        </article>
      </aside>
    </section>
  );
}
