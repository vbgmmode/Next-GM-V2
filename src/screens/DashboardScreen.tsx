import { useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import {
  DashboardDynastyAlert,
  DashboardDynastyAlignment,
  DashboardDynastyIntensityMeter,
  DashboardDynastyMorale,
  DashboardDynastyPortrait,
  DashboardDynastyProgress,
  DashboardDynastyShowScoreChart,
  DashboardDynastyStatValue,
  getRivalryHeatTier,
} from "../components/dashboardDynasty";
import {
  getDefaultDashboardRosterSortDirection,
  sortDashboardRosterRows,
  type DashboardRosterSortColumn,
  type DashboardRosterSortDirection,
} from "../game/dashboardRosterSort";
import { buildDashboardViewModel } from "../game/dashboardViewModel";
import type { GameScreen } from "../game/migration";
import type { GameState, ShowResult, Wrestler } from "../game/types";

export function DashboardScreen({
  game,
  latestResult,
  onNavigate,
  onOpenProfile,
  onOpenRivalry,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onOpenProfile: (wrestlerId: string) => void;
  onOpenRivalry: (rivalryId: string) => void;
}) {
  const model = buildDashboardViewModel(game, latestResult);
  const [rosterSortColumn, setRosterSortColumn] = useState<DashboardRosterSortColumn>("rank");
  const [rosterSortDirection, setRosterSortDirection] = useState<DashboardRosterSortDirection>("asc");
  const topStarId = model.roster[0]?.id;
  const displayRoster = useMemo(
    () => sortDashboardRosterRows(model.roster, rosterSortColumn, rosterSortDirection),
    [model.roster, rosterSortColumn, rosterSortDirection],
  );

  function toggleRosterSort(column: DashboardRosterSortColumn) {
    if (rosterSortColumn === column) {
      setRosterSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setRosterSortColumn(column);
    setRosterSortDirection(getDefaultDashboardRosterSortDirection(column));
  }

  function renderRosterHeadButton(label: string, column: DashboardRosterSortColumn) {
    const isActive = rosterSortColumn === column;

    return (
      <button
        type="button"
        aria-label={`Sort by ${label}${isActive ? `, ${rosterSortDirection === "asc" ? "ascending" : "descending"}` : ""}`}
        aria-sort={isActive ? (rosterSortDirection === "asc" ? "ascending" : "descending") : "none"}
        className={`dashboard-dynasty-roster-head-btn${isActive ? ` is-active is-${rosterSortDirection}` : ""}`}
        onClick={() => toggleRosterSort(column)}
      >
        {label}
      </button>
    );
  }

  const chartRangeLabel =
    model.metrics.chartPoints.length > 1
      ? model.metrics.chartPoints[0]?.label + "-" + model.metrics.chartPoints[model.metrics.chartPoints.length - 1]?.label
      : model.metrics.chartPoints[0]?.label ?? "No history";

  const findWrestler = (id: string) => game.wrestlers.find((wrestler) => wrestler.id === id);
  const wrestlerOrPlaceholder = (id: string, fallbackName: string): Pick<Wrestler, "id" | "name"> =>
    findWrestler(id) ?? { id: id || fallbackName, name: fallbackName };
  const dashboardCta: DynastyManagementCta = {
    eyebrow: model.hasWeekReview ? "Office Waiting" : "Next Action",
    label: model.primaryAction.label,
    onClick: () => onNavigate(model.primaryAction.screen),
    tone: model.hasWeekReview ? "warning" : "brand",
  };

  return (
    <DynastyManagementShell currentScreen="dashboard" cta={dashboardCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <section className="dashboard-dynasty-grid" aria-label="Brand HQ dashboard">
        <aside className="dashboard-dynasty-column dashboard-dynasty-left-column">
          <article className="dashboard-dynasty-panel dashboard-dynasty-brand-status">
            <div className="dashboard-dynasty-kicker">Brand Status</div>
            <div className="dashboard-dynasty-brand-plate" aria-label={model.brandPlateLabel}>
              <img alt="" className="dashboard-dynasty-brand-mark" draggable={false} src={model.brandPortraitSrc} />
            </div>
            <div className="dashboard-dynasty-brand-rating">
              <span>Show Rating</span>
              <strong>{model.brandStatus.ratingLabel}</strong>
            </div>
            <div className="dashboard-dynasty-mini-stat-grid">
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
                <strong className={model.brandStatus.profitPositive ? "dashboard-dynasty-positive" : "dashboard-dynasty-negative"}>{model.brandStatus.profitLabel}</strong>
              </div>
            </div>
          </article>

          <article className="dashboard-dynasty-panel dashboard-dynasty-champions">
            <div className="dashboard-dynasty-section-heading">
              <span>Champions</span>
              <b>Prestige</b>
            </div>
            <div className="dashboard-dynasty-champion-list">
              {model.champions.map((champion, index) => (
                <div className={`dashboard-dynasty-champion-row${champion.isTagTeam && champion.holderIds.length === 2 ? " is-tag-team" : ""}`} key={champion.id}>
                  <span className="dashboard-dynasty-slot">{String(index + 1).padStart(2, "0")}</span>
                  {champion.holderIds.length ? (
                    <div className="dashboard-dynasty-champion-portraits">
                      {champion.holderIds.map((holderId) => {
                        const holder = findWrestler(holderId);

                        return holder ? (
                          <DashboardDynastyPortrait key={holderId} wrestler={holder} size="md" />
                        ) : (
                          <span aria-hidden="true" className="dashboard-dynasty-portrait-vacant dashboard-dynasty-portrait--md" key={holderId}>
                            -
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="dashboard-dynasty-portrait-vacant dashboard-dynasty-portrait--md" aria-hidden="true">
                      -
                    </span>
                  )}
                  <span className="dashboard-dynasty-champion-copy">
                    <strong title={champion.title}>{champion.title}</strong>
                    <em title={champion.name}>{champion.name}</em>
                  </span>
                  <span className="dashboard-dynasty-prestige" title={`Prestige ${champion.prestige}`}>
                    {champion.prestige}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-dynasty-panel dashboard-dynasty-goals">
            <div className="dashboard-dynasty-section-heading">
              <span>GM Goals</span>
              <b>{model.goals.length} Active</b>
            </div>
            <div className="dashboard-dynasty-goal-list">
              {model.goals.map((goal) => (
                <div className={goal.complete ? "dashboard-dynasty-goal-row is-complete" : "dashboard-dynasty-goal-row"} key={goal.id}>
                  <div className="dashboard-dynasty-goal-top">
                    <span>{goal.complete ? "OK" : "ON"}</span>
                    <strong title={goal.label}>{goal.label}</strong>
                    <em title={goal.detail}>{goal.complete ? "Done" : goal.detail}</em>
                  </div>
                  <DashboardDynastyProgress complete={goal.complete} progress={goal.progress} />
                </div>
              ))}
            </div>
          </article>
        </aside>

        <section className="dashboard-dynasty-column dashboard-dynasty-center-column">
          <article className="dashboard-dynasty-panel dashboard-dynasty-fallout">
            <div className="dashboard-dynasty-section-heading">
              <span>Fallout From Last Week</span>
              <b>{model.falloutFromLastWeek?.weekLabel ?? "No history"}</b>
            </div>
            {model.falloutFromLastWeek ? (
              <>
                <div className="dashboard-dynasty-fallout-lead">
                  <strong>{model.falloutFromLastWeek.headline}</strong>
                  <p>{model.falloutFromLastWeek.detail}</p>
                </div>
                <div className="dashboard-dynasty-fallout-grid">
                  {model.falloutFromLastWeek.items.map((item) => (
                    <div className={`dashboard-dynasty-fallout-item tone-${item.tone}`} key={item.id}>
                      <span>{item.label}</span>
                      <strong title={item.value}>{item.value}</strong>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="dashboard-dynasty-fallout-lead is-empty">
                <strong>Nothing to show yet</strong>
                <p>Run the first show to generate roster, story, social, finance, and rival fallout for this desk.</p>
              </div>
            )}
          </article>

          <article className="dashboard-dynasty-panel dashboard-dynasty-roster-panel">
            <div className="dashboard-dynasty-roster-topline">
              <div className="dashboard-dynasty-section-heading">
                <span>Roster Overview</span>
                <b>Top Stars</b>
              </div>
            </div>
            <div className="dashboard-dynasty-roster-table" role="table" aria-label="Roster overview">
              <div className="dashboard-dynasty-roster-row dashboard-dynasty-roster-head" role="row">
                {renderRosterHeadButton("#", "rank")}
                {renderRosterHeadButton("Superstar", "name")}
                {renderRosterHeadButton("Side", "side")}
                {renderRosterHeadButton("Pop", "pop")}
                {renderRosterHeadButton("Sta", "stamina")}
                {renderRosterHeadButton("Mor", "morale")}
                {renderRosterHeadButton("OVR", "overall")}
                {renderRosterHeadButton("Contract", "contract")}
                {renderRosterHeadButton("Cost", "cost")}
              </div>
              <div className="dashboard-dynasty-roster-scroll">
                {displayRoster.map((member, index) => {
                  const wrestler = findWrestler(member.id);

                  function openProfile() {
                    onOpenProfile(member.id);
                  }

                  return (
                    <button
                      aria-label={`Open ${member.name} profile`}
                      className={member.id === topStarId ? "dashboard-dynasty-roster-row is-selected is-clickable" : "dashboard-dynasty-roster-row is-clickable"}
                      key={member.id}
                      onClick={openProfile}
                      type="button"
                    >
                      <span>{index + 1}</span>
                      <div className="dashboard-dynasty-superstar-cell">
                        {wrestler ? <DashboardDynastyPortrait wrestler={wrestler} size="sm" /> : null}
                        <strong title={member.name}>{member.name}</strong>
                      </div>
                      <DashboardDynastyAlignment alignment={member.alignment} />
                      <DashboardDynastyStatValue delta={member.popDelta} label="Popularity" value={member.pop} />
                      <DashboardDynastyStatValue delta={member.staminaDelta} label="Stamina" value={member.stamina} />
                      <span>
                        <DashboardDynastyMorale morale={member.morale} />
                      </span>
                      <span className="dashboard-dynasty-overall">
                        <DashboardDynastyStatValue delta={member.overallDelta} label="Overall" value={member.overall} />
                      </span>
                      <span>{member.contract}</span>
                      <span>{member.cost}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="dashboard-dynasty-roster-footer">
              <span>{model.rosterSizeLabel}</span>
            </div>
          </article>

          <article className="dashboard-dynasty-panel dashboard-dynasty-metrics">
            <div className="dashboard-dynasty-section-heading">
              <span>Show Metrics ({game.brandName})</span>
              <b>{chartRangeLabel}</b>
            </div>
            <div className="dashboard-dynasty-metric-grid">
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
            <DashboardDynastyShowScoreChart points={model.metrics.chartPoints} />
          </article>

        </section>

        <aside className="dashboard-dynasty-column dashboard-dynasty-right-column">
          <article className="dashboard-dynasty-panel dashboard-dynasty-rivalries">
            <div className="dashboard-dynasty-section-heading">
              <span>Rivalries</span>
              <b>Intensity Feed</b>
            </div>
            <div className="dashboard-dynasty-rivalry-list">
              {model.rivalries.length ? (
                model.rivalries.map((rivalry) => {
                  function openRivalry() {
                    onOpenRivalry(rivalry.id);
                  }

                  return (
                    <button
                      aria-label={`Open ${rivalry.label} in Rivalry Desk`}
                      className={`dashboard-dynasty-rivalry-row is-clickable heat-${getRivalryHeatTier(rivalry.intensity)}${rivalry.structure === "tag_team" ? " is-tag-team" : ""}`}
                      key={rivalry.id}
                      onClick={openRivalry}
                      type="button"
                    >
                      <div className={`dashboard-dynasty-rivalry-matchup${rivalry.structure === "tag_team" ? " is-tag-team" : ""}`}>
                        <div className="dashboard-dynasty-rivalry-side">
                          {rivalry.leftPortraitIds.map((portraitId) => (
                            <DashboardDynastyPortrait key={portraitId} wrestler={wrestlerOrPlaceholder(portraitId, portraitId)} size="sm" />
                          ))}
                        </div>
                        <strong title={rivalry.label}>{rivalry.label}</strong>
                        <div className="dashboard-dynasty-rivalry-side">
                          {rivalry.rightPortraitIds.map((portraitId) => (
                            <DashboardDynastyPortrait key={portraitId} wrestler={wrestlerOrPlaceholder(portraitId, portraitId)} size="sm" />
                          ))}
                        </div>
                      </div>
                      <div className="dashboard-dynasty-rivalry-meter-line">
                        <em>Heat</em>
                        <DashboardDynastyIntensityMeter value={rivalry.intensity} />
                        <b>{Math.max(0, Math.min(100, Math.round(rivalry.intensity)))}</b>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="dashboard-dynasty-empty">No active rivalries. Create a program when the story room needs heat.</p>
              )}
            </div>
          </article>

          <article className="dashboard-dynasty-panel dashboard-dynasty-alerts">
            <div className="dashboard-dynasty-section-heading">
              <span>GM Alerts</span>
              <b>Live Desk</b>
            </div>
            <div className="dashboard-dynasty-alert-list">
              {model.alerts.map((alert) => (
                <DashboardDynastyAlert alert={alert} key={alert.id} />
              ))}
            </div>
          </article>

        </aside>
      </section>
    </DynastyManagementShell>
  );
}
