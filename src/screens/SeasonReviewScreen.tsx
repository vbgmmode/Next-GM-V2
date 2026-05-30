import { Header, Metric } from "../components/gameShell";
import { SEASON_WEEK_COUNT } from "../game/constants";
import {
  getCpuResultsFeedSnapshot,
  getRatingsBattleSnapshot,
  type CpuResultsFeedSnapshot,
  type RatingsBattleSnapshot,
} from "../game/cpuRivalLoop";
import { formatMoney } from "../game/formatters";
import { getMarketSnapshot, getRivalMarketEvents } from "../game/market";
import { getShowGrade } from "../game/scoring";
import { draftPool } from "../game/seed";
import { formatRivalryStatus } from "../game/storyContextReads";
import type { GameState, RivalBrandState } from "../game/types";
import {
  getBestRevenueReport,
  getFinanceGrossRevenue,
  getSeasonFinanceReports,
  getWorstProfitReport,
} from "./financeScreenReads";
import {
  formatHistoryStamp,
  getBestShow,
  getBiggestTitleChange,
  getChampionshipEventPairLine,
  getHottestRivalry,
  getHottestRivalryStory,
  getMostDefendedChampionship,
  getMostEventfulRivalry,
  getNotablePlePayoff,
  getReignLength,
  getShowTypeLabel,
  getWrestlerNames,
} from "../game/seasonArchiveReads";

function formatRivalTrend(trend: RivalBrandState["seasonTrend"]) {
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

function RatingsBattlePanel({ compact = false, snapshot }: { compact?: boolean; snapshot: RatingsBattleSnapshot }) {
  const playerEntry = snapshot.entries.find((entry) => entry.isPlayer);
  const visibleEntries = compact ? snapshot.entries.slice(0, 4) : snapshot.entries;

  return (
    <section className={`ratings-battle-panel${compact ? " compact" : ""}`} aria-label="Ratings battle standings">
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

function CpuResultsFeedPanel({ compact = false, snapshot }: { compact?: boolean; snapshot: CpuResultsFeedSnapshot }) {
  const visibleItems = compact ? snapshot.items.slice(0, 3) : snapshot.items;

  return (
    <section className={`cpu-results-feed${compact ? " compact" : ""}`} aria-label="CPU results feed">
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
            {!compact && item.segments.length ? (
              <div className="cpu-segment-strip">
                {item.segments.slice(0, 4).map((segment) => (
                  <span key={segment.id}>
                    {segment.type} {segment.score}
                  </span>
                ))}
              </div>
            ) : null}
            {item.notes.length ? (
              <div className="cpu-results-notes">
                {item.notes.slice(0, compact ? 2 : 5).map((note, index) => (
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

function RivalIntelligencePanel({ compact = false, game }: { compact?: boolean; game: GameState }) {
  const snapshot = getMarketSnapshot(game, draftPool);
  const office = game.marketState.officeMandate;
  const rivalEvents = getRivalMarketEvents(game).slice(0, compact ? 2 : 5);
  const latestMove = snapshot.latestTransaction?.note ?? "No market move has resolved yet.";

  return (
    <section className={`rival-intel-panel mandate-${office.mandateStatus}${compact ? " compact" : ""}`} aria-label="Rival intelligence">
      <div className="rival-intel-head">
        <div>
          <p className="eyebrow">Rival Intelligence</p>
          <h3>{office.mandateStatus === "critical" ? "Office Heat Rising" : office.mandateStatus === "surging" ? "Office Backing Strong" : "Market Race Active"}</h3>
        </div>
        <strong>{office.mandateStatus.toUpperCase()}</strong>
      </div>
      <p>{latestMove}</p>
      <div className="rival-intel-grid">
        <Metric label="Owner Trust" value={`${office.ownerTrust}`} />
        <Metric label="Reputation" value={`${office.brandReputation}`} />
        <Metric label="Roster Recurrence" value={formatMoney(snapshot.payroll)} detail="Contracts are prepaid" />
        <Metric label="Open Market" value={`${snapshot.freeAgents.length}`} />
      </div>
      {!compact && rivalEvents.length ? (
        <div className="rival-intel-feed">
          {rivalEvents.map((event) => (
            <article key={event.id}>
              <span>
                S{event.seasonNumber} W{event.weekNumber} · {event.type}
              </span>
              <strong>{event.wrestlerNames.join(" / ")}</strong>
              <p>{event.note}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function SeasonReviewScreen({
  game,
  onStartNextSeason,
}: {
  game: GameState;
  onStartNextSeason: () => void;
}) {
  const bestShow = getBestShow(game.showHistory, game.seasonNumber);
  const sortedByMomentum = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum);
  const sortedByFatigue = [...game.wrestlers].sort((a, b) => b.fatigue - a.fatigue);
  const topMomentum = sortedByMomentum[0];
  const mostFatigued = sortedByFatigue[0];
  const hottestRivalry = getHottestRivalry(game.rivalries);
  const seasonReports = getSeasonFinanceReports(game);
  const seasonProfitLoss = game.money - game.seasonStartingMoney;
  const bestRevenueReport = getBestRevenueReport(seasonReports);
  const worstProfitReport = getWorstProfitReport(seasonReports);
  const biggestTitleChange = getBiggestTitleChange(game);
  const mostDefendedChampionship = getMostDefendedChampionship(game);
  const hottestRivalryStory = getHottestRivalryStory(game);
  const mostEventfulRivalry = getMostEventfulRivalry(game);
  const notablePlePayoff = getNotablePlePayoff(game);
  const topChampions = game.championships.filter((championship) => championship.championIds.length > 0);
  const strongestChampionshipName = biggestTitleChange?.championshipName ?? mostDefendedChampionship?.championship.name ?? "No title movement";
  const legacyProfitDeltaLabel = seasonProfitLoss >= 0 ? "Positive" : "Negative";
  const legacyFinancialRead =
    seasonReports.length > 0
      ? `Season finance held at ${seasonReports.length} closed shows with a ${legacyProfitDeltaLabel} cash movement of ${formatMoney(seasonProfitLoss)}.`
      : "No full-season finance ledger was captured yet.";
  const archivedSeasons = [...game.seasonArchives].reverse();
  const ratingsBattle = getRatingsBattleSnapshot(game, bestShow);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, bestShow);

  return (
    <main className="app-shell">
      <Header game={game} />
      <section className="results-hero season-review-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} Review</p>
          <h2>Final Bell</h2>
          <p className="lede">{`The ${SEASON_WEEK_COUNT}-week road is complete. The ledger, locker room, titles, and grudges move into the offseason draft.`}</p>
        </div>
        <button className="primary-action" onClick={onStartNextSeason}>
          Enter Offseason Draft
        </button>
      </section>

      <section className="command-panel season-legacy-snapshot" aria-label="Legacy snapshot">
        <div className="section-heading">
          <p className="eyebrow">Legacy Snapshot</p>
          <h3>Season Memory Card</h3>
        </div>
        <p className="lede legacy-snapshot-copy">No mechanics attached. This is a read-only GM ledger of what defined the year.</p>
        <div className="spotlight-grid">
          <Metric label="Best Show" value={bestShow ? bestShow.showName : "No show data"} detail={bestShow ? `${bestShow.totalScore} (${getShowGrade(bestShow.totalScore)})` : "Run a full season to lock first place"} />
          <Metric label="Final Money" value={formatMoney(game.money)} detail={legacyFinancialRead} />
          <Metric label="Season Delta" value={formatMoney(seasonProfitLoss)} detail={`From ${formatMoney(game.seasonStartingMoney)}`} />
          <Metric
            label="Top Momentum"
            value={topMomentum ? topMomentum.name : "No momentum profile"}
            detail={topMomentum ? `${topMomentum.momentum} momentum` : "No readable momentum snapshots for this save"}
          />
          <Metric
            label="Most Defended Title"
            value={mostDefendedChampionship ? mostDefendedChampionship.championship.name : "No title defenses"}
            detail={mostDefendedChampionship ? `${mostDefendedChampionship.count} this season` : "No successful defenses recorded"}
          />
          <Metric
            label="Biggest Title Change"
            value={strongestChampionshipName}
            detail={biggestTitleChange ? formatHistoryStamp(biggestTitleChange) : "No title changes recorded"}
          />
        </div>
        <div className="spotlight-grid">
          <Metric
            label="Rivalry Highlight"
            value={hottestRivalryStory ? hottestRivalryStory.name : hottestRivalry ? hottestRivalry.name : "No rivalry events"}
            detail={hottestRivalryStory ? `${hottestRivalryStory.note}` : hottestRivalry ? `Heat ${hottestRivalry.heat}` : "No rivalry movement this season"}
          />
          <Metric
            label="PLE Payoff"
            value={notablePlePayoff ? notablePlePayoff.rivalryName : "None"}
            detail={
              notablePlePayoff
                ? `${notablePlePayoff.showName}${notablePlePayoff.showType ? ` · ${getShowTypeLabel(notablePlePayoff.showType)}` : ""}`
                : "No PLE payoff recorded"
            }
          />
          <Metric
            label="Champion Snapshot"
            value={topChampions.length ? topChampions.length.toString() : "0"}
            detail={topChampions.length ? `Active title holders: ${topChampions.map((championship) => `${championship.name} (${getWrestlerNames(championship.championIds, game.wrestlers)})`).join(" · ")}` : "No current title holders listed"}
          />
        </div>
      </section>

      <section className="command-panel season-archive-panel" aria-label="Archived seasons">
        <div className="section-heading">
          <p className="eyebrow">Season Archive</p>
          <h3>Carried Legacy Log</h3>
        </div>
        {archivedSeasons.length === 0 ? (
          <p className="lede">No completed seasons are archived yet. This will capture this season when you advance.</p>
        ) : (
          <div className="spotlight-grid">
            {archivedSeasons.map((archive) => (
              <article key={`archive-${archive.seasonNumber}`} className="card">
                <p className="eyebrow">Season {archive.seasonNumber}</p>
                <h4>Closed at Week {SEASON_WEEK_COUNT}</h4>
                <div className="archive-metrics">
                  <Metric label="Final Money" value={formatMoney(archive.finalMoney)} detail={`Started at ${formatMoney(archive.seasonStartingMoney)}`} />
                  <Metric label="Season Delta" value={formatMoney(archive.seasonDelta)} detail="Read-only season summary" />
                  <Metric label="Best Show" value={archive.bestShow?.name ?? "No show data"} detail={archive.bestShow ? `${archive.bestShow.score} in week ${archive.bestShow.week}` : "No show closed this season"} />
                  <Metric
                    label="Top Momentum"
                    value={archive.topMomentumStar?.name ?? "No momentum signal"}
                    detail={archive.topMomentumStar ? `${archive.topMomentumStar.value} momentum` : "No complete momentum snapshots"}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="status-grid" aria-label="Season review">
        <Metric label="Starting Money" value={formatMoney(game.seasonStartingMoney)} />
        <Metric label="Final Money" value={formatMoney(game.money)} />
        <Metric label="Season P/L" value={formatMoney(seasonProfitLoss)} />
        <Metric label="Best Show" value={bestShow ? bestShow.showName : "No Shows"} detail={bestShow ? `${bestShow.totalScore} (${getShowGrade(bestShow.totalScore)})` : undefined} />
      </section>

      <RivalIntelligencePanel game={game} />
      {ratingsBattle ? <RatingsBattlePanel snapshot={ratingsBattle} /> : null}
      {cpuResultsFeed ? <CpuResultsFeedPanel snapshot={cpuResultsFeed} /> : null}

      <section className="status-grid" aria-label="Season roster review">
        <Metric label="Top Momentum" value={topMomentum ? topMomentum.name : "No Momentum Data"} detail={topMomentum ? `${topMomentum.momentum}` : "No momentum snapshots available"} />
        <Metric label="Most Fatigued" value={mostFatigued ? mostFatigued.name : "No Fatigue Data"} detail={mostFatigued ? `${mostFatigued.fatigue}` : "No fatigue snapshots available"} />
        <Metric
          label="Best Revenue"
          value={bestRevenueReport ? bestRevenueReport.showName : "No Report"}
          detail={bestRevenueReport ? formatMoney(getFinanceGrossRevenue(bestRevenueReport)) : undefined}
        />
        <Metric label="Worst P/L" value={worstProfitReport ? worstProfitReport.showName : "No Report"} detail={worstProfitReport ? formatMoney(worstProfitReport.profitLoss) : undefined} />
      </section>

      <section className="command-panel rivalry-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Hottest Rivalry</p>
          <h3>{hottestRivalryStory ? hottestRivalryStory.name : hottestRivalry ? hottestRivalry.name : "No Rivalry History"}</h3>
        </div>
        {hottestRivalryStory ? (
          <div className="spotlight-grid">
            <Metric label="Peak Heat" value={`${hottestRivalryStory.heat}`} />
            <Metric label="Most Eventful" value={mostEventfulRivalry ? mostEventfulRivalry.name : "No Events"} detail={mostEventfulRivalry ? `${mostEventfulRivalry.count} events` : undefined} />
            <Metric label="PLE Payoff" value={notablePlePayoff ? notablePlePayoff.rivalryName : "None"} detail={notablePlePayoff ? notablePlePayoff.showName : undefined} />
          </div>
        ) : hottestRivalry ? (
          <div className="spotlight-grid">
            <Metric label="Heat" value={`${hottestRivalry.heat}`} />
            <Metric label="Freshness" value={`${hottestRivalry.freshness}`} />
            <Metric label="Status" value={formatRivalryStatus(hottestRivalry.status)} />
          </div>
        ) : null}
      </section>

      <section className="championship-grid" aria-label="Current champions">
        <article className="championship-card">
          <div className="championship-head">
            <div>
              <p className="eyebrow">Season Title Story</p>
              <h3>{biggestTitleChange ? biggestTitleChange.championshipName : "No Title Changes"}</h3>
            </div>
            <strong>{mostDefendedChampionship ? `${mostDefendedChampionship.count} Defenses` : "No Defenses"}</strong>
          </div>
          <div className="history-list">
            {biggestTitleChange ? (
              <article className="history-event">
                <span>Biggest Title Change · {formatHistoryStamp(biggestTitleChange)}</span>
                {getChampionshipEventPairLine(biggestTitleChange) ? <strong>{getChampionshipEventPairLine(biggestTitleChange)}</strong> : null}
                <p>{biggestTitleChange.note}</p>
              </article>
            ) : (
              <p className="muted-copy">No championship changed hands this season.</p>
            )}
            {mostDefendedChampionship ? (
              <article className="history-event">
                <span>Most Defended Championship</span>
                <p>
                  {mostDefendedChampionship.championship.name} survived {mostDefendedChampionship.count} defense
                  {mostDefendedChampionship.count === 1 ? "" : "s"} this season.
                </p>
              </article>
            ) : (
              <p className="muted-copy">No successful title defenses were recorded this season.</p>
            )}
          </div>
        </article>
        {game.championships.map((championship) => (
          <article className="championship-card" key={championship.id}>
            <div className="championship-head">
              <div>
                <p className="eyebrow">{championship.division}</p>
                <h3>{championship.name}</h3>
              </div>
              <strong>{getWrestlerNames(championship.championIds, game.wrestlers)}</strong>
            </div>
            <div className="spotlight-grid">
              <Metric label="Prestige" value={`${championship.prestige}`} />
              <Metric label="Defenses" value={`${championship.defenses}`} />
              <Metric label="Reign" value={`${getReignLength(championship, game.currentWeek)} Week${getReignLength(championship, game.currentWeek) === 1 ? "" : "s"}`} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
