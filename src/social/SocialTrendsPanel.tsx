import { getCpuResultsFeedSnapshot, getRatingsBattleSnapshot } from "../game/cpuRivalLoop";
import type { ReactNode } from "react";
import type { RivalBrandTrend } from "../game/types";
import type { GameState, ShowResult } from "../game/types";
import { getIwcMoodSummary, getTrendingTopics } from "./socialReads";
import type { IwcMoodSummary } from "./socialTypes";

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

function getCpuDeskStatus(item: { grade?: string; score?: number }) {
  if (item.score !== undefined) {
    return item.grade ?? "Live";
  }

  return "Locked";
}

function SocialTrendCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="social-trends-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function MoodTrendCard({ moodSummary }: { moodSummary: IwcMoodSummary }) {
  return (
    <SocialTrendCard title="What's happening">
      <div className={`social-trends-mood tone-${moodSummary.tone}`}>
        <strong>{moodSummary.headline}</strong>
        <span>{moodSummary.weekLabel}</span>
        <p>{moodSummary.detail}</p>
      </div>
      <div className="social-trends-list">
        {moodSummary.items.map((item) => (
          <article className="social-trends-item" key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </SocialTrendCard>
  );
}

export function SocialTrendsPanel({ game, latestResult }: { game: GameState; latestResult?: ShowResult }) {
  const moodSummary = getIwcMoodSummary(game);
  const trendingTopics = getTrendingTopics(game);
  const ratingsBattle = getRatingsBattleSnapshot(game, latestResult);
  const cpuResultsFeed = getCpuResultsFeedSnapshot(game, latestResult);

  return (
    <aside className="social-trends-rail" aria-label="IWC trends and desk pressure">
      {moodSummary ? <MoodTrendCard moodSummary={moodSummary} /> : null}

      {trendingTopics.length ? (
        <SocialTrendCard title="Trending in IWC">
          <div className="social-trends-list">
            {trendingTopics.map((topic) => (
              <article className="social-trends-topic" key={topic.id}>
                <span>#{topic.rank} · {topic.count} posts</span>
                <strong>{topic.label}</strong>
              </article>
            ))}
          </div>
        </SocialTrendCard>
      ) : null}

      {ratingsBattle ? (
        <section className="social-trends-card social-desk-card social-desk-card--ratings" aria-label="Ratings battle">
          <header className="social-desk-head">
            <div className="social-desk-head-copy">
              <p className="social-desk-kicker">War Room // Ratings</p>
              <h3>Ratings Battle</h3>
              <strong>{ratingsBattle.headline}</strong>
              <p>{ratingsBattle.detail}</p>
            </div>
            <div className="social-desk-badges">
              <article className="social-desk-badge">
                <span>Rank</span>
                <strong>#{ratingsBattle.playerRank}</strong>
              </article>
              <article className="social-desk-badge social-desk-badge--gold">
                <span>Leader</span>
                <strong>{ratingsBattle.leaderName}</strong>
              </article>
            </div>
          </header>

          <div className="social-desk-table social-desk-table--ratings" role="list" aria-label="Ratings standings">
            <div className="social-desk-table-head" role="presentation">
              <span>#</span>
              <span>Brand</span>
              <span>Latest</span>
            </div>
            {ratingsBattle.entries.slice(0, 4).map((entry) => (
              <article
                className={`social-desk-table-row trend-${entry.trend} ${entry.isPlayer ? "is-player" : ""}`}
                key={entry.id}
                role="listitem"
              >
                <span className="social-desk-rank">#{entry.rank}</span>
                <div className="social-desk-brand">
                  <strong>{entry.brandName}</strong>
                  <small>{entry.isPlayer ? `GM ${entry.gmName}` : `${entry.gmName} · ${formatRivalTrend(entry.trend)}`}</small>
                </div>
                <strong className="social-desk-score">{entry.latestScore ?? "No Show"}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {cpuResultsFeed ? (
        <section className="social-trends-card social-desk-card social-desk-card--cpu" aria-label="CPU desks live">
          <header className="social-desk-head">
            <div className="social-desk-head-copy">
              <p className="social-desk-kicker">War Room // CPU</p>
              <h3>CPU Desks Live</h3>
              <strong>{cpuResultsFeed.headline}</strong>
              <p>{cpuResultsFeed.detail}</p>
            </div>
          </header>

          <div className="social-desk-table social-desk-table--cpu" role="list" aria-label="CPU desk feed">
            <div className="social-desk-table-head" role="presentation">
              <span>Brand</span>
              <span>Desk</span>
              <span>Score</span>
            </div>
            {cpuResultsFeed.items.slice(0, 4).map((item) => (
              <article className={`social-desk-table-row tone-${item.tone}`} key={item.id} role="listitem">
                <strong className="social-desk-brand-name">{item.brandName}</strong>
                <span className="social-desk-status">{getCpuDeskStatus(item)}</span>
                <strong className="social-desk-score">{item.score ?? "--"}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
