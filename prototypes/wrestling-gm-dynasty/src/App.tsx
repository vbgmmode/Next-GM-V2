import rawWordmark from "./assets/raw-wordmark.svg";
import goldCrest from "./assets/gold-crest.svg";
import goldLaurel from "./assets/gold-laurel.svg";
import beltBadge from "./assets/belt-badge.svg";
import promoArt from "./assets/promo-main-event.svg";
import federationMark from "./assets/federation-mark.svg";
import { AlertIcon } from "./components/AlertIcon";
import { IntensityMeter } from "./components/IntensityMeter";
import { MoraleEmoji } from "./components/MoraleEmoji";
import { PerformanceChart } from "./components/PerformanceChart";
import { PortraitAvatar } from "./components/PortraitAvatar";
import { ProgressBar } from "./components/ProgressBar";
import { RoleIcon } from "./components/RoleIcon";
import { StaminaBar } from "./components/StaminaBar";
import { StyleLegend } from "./components/StyleLegend";
import {
  alerts,
  brandStatus,
  champions,
  draftPool,
  goals,
  headerStats,
  navTabs,
  rivalries,
  roster,
  showCard,
  tickerItems,
  wrestlerPortraits,
} from "./data/mockDashboard";

function App() {
  return (
    <main className="game-dashboard-shell">
      <header className="broadcast-header">
        <section className="logo-lockup">
          <span className="logo-line-1">Wrestling GM</span>
          <span className="logo-line-2">Dynasty</span>
        </section>
        <section className="header-module calendar-module">
          <span>Season {headerStats.season} | Week {headerStats.week}</span>
          <strong>{headerStats.date}</strong>
        </section>
        <section className="header-module">
          <span>Budget</span>
          <strong className="gold">{headerStats.budget}</strong>
        </section>
        <section className="header-module">
          <span>Fans</span>
          <strong>{headerStats.fans}</strong>
        </section>
        <section className="header-module ranking-module">
          <span>Ranking</span>
          <strong className="ranking-value">
            <img className="laurel-icon" src={goldLaurel} alt="" />
            {headerStats.ranking}
          </strong>
        </section>
        <section className="next-show-module">
          <span>Next Show</span>
          <img className="raw-mark" src={rawWordmark} alt="RAW" />
          <em>{headerStats.location}</em>
        </section>
        <section className="crest-slot" aria-label="GM crest">
          <img src={goldCrest} alt="" />
        </section>
      </header>

      <nav className="nav-strip" aria-label="Dashboard sections">
        <span className="controller-chip">LB</span>
        {navTabs.map((tab) => (
          <button className={tab === "Home" ? "nav-tab is-active" : "nav-tab"} key={tab} type="button">
            {tab}
          </button>
        ))}
        <span className="controller-chip">RB</span>
      </nav>

      <section className="dashboard-main-grid">
        <aside className="dashboard-column left-column">
          <article className="panel brand-status-panel">
            <div className="panel-kicker">Brand Status</div>
            <img className="raw-brand-mark" src={rawWordmark} alt="RAW" />
            <div className="brand-rating">
              <span>Show Rating</span>
              <strong>{brandStatus.rating}</strong>
            </div>
            <div className="mini-stat-grid">
              <div><span>Fans</span><strong>{brandStatus.fans}</strong></div>
              <div><span>Budget</span><strong>{brandStatus.budget}</strong></div>
              <div><span>Weekly Profit</span><strong className="positive">{brandStatus.weeklyProfit}</strong></div>
            </div>
          </article>

          <article className="panel champions-panel">
            <div className="section-heading"><span>Champions</span><b>Gold Ledger</b></div>
            <div className="champion-list">
              {champions.map((champion, index) => (
                <div className="champion-row" key={champion.title}>
                  <span className="slot">{String(index + 1).padStart(2, "0")}</span>
                  <PortraitAvatar portrait={champion.portrait} size="md" />
                  <span className="champion-copy">
                    <strong>{champion.title}</strong>
                    <em>{champion.name}</em>
                  </span>
                  <img className="belt-icon" src={beltBadge} alt="" />
                </div>
              ))}
            </div>
          </article>

          <article className="panel goals-panel">
            <div className="section-heading"><span>GM Goals</span><b>4 Active</b></div>
            {goals.map((goal) => (
              <div className={goal.complete ? "goal-row is-complete" : "goal-row"} key={goal.label}>
                <div className="goal-row-top">
                  <span>{goal.complete ? "✓" : "·"}</span>
                  <strong>{goal.label}</strong>
                  <em>{goal.complete ? "Done" : `${goal.current}/${goal.total}`}</em>
                </div>
                <ProgressBar current={goal.current} total={goal.total} complete={goal.complete} />
              </div>
            ))}
          </article>
        </aside>

        <section className="dashboard-column center-column">
          <article className="panel roster-panel">
            <div className="roster-topline">
              <div className="section-heading"><span>Roster Overview</span><b>Top Stars</b></div>
              <div className="roster-controls">
                {["All", "Men", "Women", "★"].map((filter) => (
                  <button className={filter === "All" ? "filter-chip is-active" : "filter-chip"} key={filter} type="button">{filter}</button>
                ))}
                <span className="sort-control">Sort By: Overall</span>
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
                {roster.map((member) => (
                  <div className={member.selected ? "roster-row is-selected" : "roster-row"} role="row" key={member.id}>
                    <span>{member.rank}</span>
                    <div className="superstar-cell">
                      <PortraitAvatar portrait={member.portrait} size="sm" />
                      <strong>{member.name}</strong>
                    </div>
                    <RoleIcon role={member.role} />
                    <span>{member.style}</span>
                    <span>{member.pop}</span>
                    <span><StaminaBar value={member.stamina} /></span>
                    <span><MoraleEmoji morale={member.morale} /></span>
                    <span className="overall-box">{member.overall}</span>
                    <span>{member.contract}</span>
                    <span>{member.cost}</span>
                  </div>
                ))}
              </div>
            </div>
            <StyleLegend />
          </article>

          <section className="center-bottom-grid">
            <article className="panel promo-panel">
              <div className="promo-backdrop">
                <span className="lower-third">Next Show: RAW</span>
                <img className="promo-art" src={promoArt} alt="Cody Rhodes vs Roman Reigns World Championship main event" />
                <div className="main-event-copy">
                  <span>World Championship</span>
                  <strong>Main Event</strong>
                </div>
              </div>
            </article>

            <article className="panel show-card-panel">
              <div className="section-heading"><span>Current Show Card</span><b>6 Segments</b></div>
              <div className="show-card-list">
                {showCard.map((entry, index) => (
                  <div className="show-card-row" key={entry.match}>
                    <span>{index + 1}</span>
                    <strong>{entry.match}</strong>
                    <em>{entry.stipulation}</em>
                  </div>
                ))}
              </div>
              <div className="action-row">
                <button type="button">Edit Card</button>
                <button className="primary-action" type="button">Simulate Show</button>
                <button type="button">View Show Logistics</button>
              </div>
            </article>
          </section>
        </section>

        <aside className="dashboard-column right-column">
          <article className="panel rivalries-panel">
            <div className="section-heading"><span>Rivalries</span><b>Intensity Feed</b></div>
            {rivalries.map((rivalry) => (
              <div className="rivalry-row" key={`${rivalry.leftId}-${rivalry.rightId}`}>
                <div className="rivalry-matchup">
                  <PortraitAvatar portrait={wrestlerPortraits[rivalry.leftId]} size="sm" />
                  <strong>{rivalry.leftName} vs {rivalry.rightName}</strong>
                  <PortraitAvatar portrait={wrestlerPortraits[rivalry.rightId]} size="sm" />
                </div>
                <div className="rivalry-meter-line">
                  <em>Intensity</em>
                  <IntensityMeter value={rivalry.intensity} />
                  <b>{rivalry.intensity}</b>
                </div>
              </div>
            ))}
          </article>

          <article className="panel metrics-panel">
            <div className="section-heading"><span>Show Metrics (RAW)</span><b>W20-W24</b></div>
            <div className="metric-grid">
              <div><span>Viewership</span><strong>1,842,000 <em>▲ 12%</em></strong></div>
              <div><span>Show Quality</span><strong>4.2 / 5</strong></div>
              <div><span>Match Quality</span><strong>3.9 / 5</strong></div>
              <div><span>Fan Satisfaction</span><strong>88%</strong></div>
            </div>
            <PerformanceChart />
          </article>

          <article className="panel alerts-panel">
            <div className="section-heading"><span>GM Alerts</span><b>Live Desk</b></div>
            {alerts.map((alert) => (
              <AlertIcon alert={alert} key={alert.message} />
            ))}
          </article>

          <article className="panel draft-panel">
            <div className="section-heading"><span>Draft Pool</span><b>Top 5</b></div>
            <div className="draft-list">
              {draftPool.map((entry) => (
                <div className="draft-row" key={entry.name}>
                  <strong>{entry.name}</strong>
                  <span>{entry.style}</span>
                </div>
              ))}
            </div>
            <button className="gold-action" type="button">View Full Draft Class</button>
          </article>
        </aside>
      </section>

      <footer className="controller-footer">
        <section className="prompt-bank">
          <span className="prompt-a">A</span><b>Select</b>
          <span className="prompt-b">B</span><b>Back</b>
          <span>?</span><b>GM Assistant</b>
        </section>
        <section className="ticker">
          {tickerItems.map((item) => (
            <span key={item.text}>
              <span className={`dot ${item.tone}`} /> {item.text}
            </span>
          ))}
        </section>
        <section className="network-status">
          <img className="fed-mark" src={federationMark} alt="" />
          <span>● Online</span>
        </section>
      </footer>
    </main>
  );
}

export default App;
