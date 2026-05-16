type RosterMember = {
  rank: number;
  name: string;
  role: string;
  style: string;
  pop: number;
  stamina: number;
  morale: "UP" | "MID" | "LOW";
  overall: number;
  contract: string;
  cost: string;
  selected?: boolean;
};

type Champion = {
  title: string;
  name: string;
  initials: string;
};

type Goal = {
  label: string;
  progress: string;
  complete?: boolean;
};

type Rivalry = {
  left: string;
  right: string;
  intensity: number;
};

const roster: RosterMember[] = [
  { rank: 1, name: "Mara Vale", role: "Ace", style: "Technician", pop: 93, stamina: 84, morale: "UP", overall: 94, contract: "22W", cost: "$128K", selected: true },
  { rank: 2, name: "Atlas Kane", role: "Main", style: "Powerhouse", pop: 91, stamina: 72, morale: "MID", overall: 92, contract: "18W", cost: "$122K" },
  { rank: 3, name: "Vera Saint", role: "Main", style: "Striker", pop: 89, stamina: 79, morale: "UP", overall: 91, contract: "16W", cost: "$118K" },
  { rank: 4, name: "Jett Bishop", role: "Upper", style: "Showman", pop: 86, stamina: 66, morale: "MID", overall: 88, contract: "9W", cost: "$96K" },
  { rank: 5, name: "Dante Knox", role: "Upper", style: "Bruiser", pop: 84, stamina: 58, morale: "LOW", overall: 87, contract: "7W", cost: "$92K" },
  { rank: 6, name: "Roxie Riot", role: "Upper", style: "Cruiser", pop: 82, stamina: 88, morale: "UP", overall: 86, contract: "14W", cost: "$84K" },
  { rank: 7, name: "Silas Creed", role: "Mid", style: "Brawler", pop: 79, stamina: 61, morale: "MID", overall: 83, contract: "11W", cost: "$76K" },
  { rank: 8, name: "Nova Pierce", role: "Mid", style: "Specialist", pop: 77, stamina: 74, morale: "UP", overall: 82, contract: "20W", cost: "$72K" },
  { rank: 9, name: "King Sable", role: "Mid", style: "Giant", pop: 75, stamina: 49, morale: "LOW", overall: 80, contract: "5W", cost: "$68K" },
  { rank: 10, name: "Ivy Wren", role: "Prospect", style: "High Flyer", pop: 70, stamina: 91, morale: "UP", overall: 78, contract: "26W", cost: "$54K" },
];

const champions: Champion[] = [
  { title: "World Champion", name: "Mara Vale", initials: "MV" },
  { title: "World Women's Champion", name: "Vera Saint", initials: "VS" },
  { title: "Tag Team Champions", name: "Iron Parliament", initials: "IP" },
  { title: "National Champion", name: "Atlas Kane", initials: "AK" },
  { title: "Intercontinental Champion", name: "Jett Bishop", initials: "JB" },
];

const goals: Goal[] = [
  { label: "Book 4 or more 4-star matches", progress: "3/4" },
  { label: "Sign 2 top-tier free agents", progress: "1/2" },
  { label: "Raise show reach above 2.0M", progress: "Done", complete: true },
  { label: "Win 2 more rivalry finales", progress: "1/2" },
];

const rivalries: Rivalry[] = [
  { left: "Vale", right: "Kane", intensity: 90 },
  { left: "Bishop", right: "Knox", intensity: 75 },
  { left: "Saint", right: "Riot", intensity: 80 },
];

const showCard = [
  ["Mara Vale vs Atlas Kane", "World Championship"],
  ["Vera Saint vs Roxie Riot", "Singles Match"],
  ["Jett Bishop vs Dante Knox", "Steel Cage Match"],
  ["Nova Pierce vs Silas Creed", "Singles Match"],
  ["Iron Parliament vs Neon Dynasty", "Tag Team Match"],
  ["Ivy Wren vs King Sable", "Open Challenge"],
];

const freeAgents = [
  ["Milo Graves", "Specialist"],
  ["Alex Sol", "Cruiser"],
  ["Jordyn Frost", "Powerhouse"],
  ["Dante Valeo", "High Flyer"],
  ["Joe Mercury", "Bruiser"],
];

function IntensityMeter({ value }: { value: number }) {
  const activeBlocks = Math.round(value / 10);

  return (
    <div className="led-meter" aria-label={`Intensity ${value}`}>
      {Array.from({ length: 10 }, (_, index) => (
        <span className={index < activeBlocks ? "is-hot" : ""} key={index} />
      ))}
    </div>
  );
}

function StaminaBar({ value }: { value: number }) {
  return (
    <div className="stamina-track" aria-label={`Stamina ${value}`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function MoraleIcon({ morale }: { morale: RosterMember["morale"] }) {
  return <span className={`morale morale-${morale.toLowerCase()}`}>{morale}</span>;
}

function PerformanceChart() {
  return (
    <svg className="metrics-chart" viewBox="0 0 280 92" role="img" aria-label="Weekly viewership trend from week 20 to week 24">
      <defs>
        <linearGradient id="chartGlow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#701015" />
          <stop offset="100%" stopColor="#ff2b2b" />
        </linearGradient>
      </defs>
      <path className="chart-grid" d="M12 18H270M12 46H270M12 74H270" />
      <path className="chart-line-shadow" d="M16 68L78 57L140 61L202 35L264 24" />
      <path className="chart-line" d="M16 68L78 57L140 61L202 35L264 24" />
      {[16, 78, 140, 202, 264].map((x, index) => (
        <circle className="chart-node" cx={x} cy={[68, 57, 61, 35, 24][index]} r="3.8" key={x} />
      ))}
      {["W20", "W21", "W22", "W23", "W24"].map((label, index) => (
        <text className="chart-label" x={[16, 78, 140, 202, 264][index]} y="89" key={label}>
          {label}
        </text>
      ))}
    </svg>
  );
}

function App() {
  return (
    <main className="game-dashboard-shell">
      <header className="broadcast-header">
        <section className="logo-lockup">
          <strong>Next GM</strong>
          <span>Dynasty Control</span>
        </section>
        <section className="header-module calendar-module">
          <span>Season 2 | Week 24</span>
          <strong>Monday, June 9, 2025</strong>
        </section>
        <section className="header-module">
          <span>Budget</span>
          <strong className="gold">$3,842,750</strong>
        </section>
        <section className="header-module">
          <span>Fans</span>
          <strong>2,154,300</strong>
        </section>
        <section className="header-module ranking-module">
          <span>Ranking</span>
          <strong><b>◆</b> #1 Worldwide</strong>
        </section>
        <section className="next-show-module">
          <span>Next Show</span>
          <strong>Warpath</strong>
          <em>New Orleans, LA</em>
        </section>
      </header>

      <nav className="nav-strip" aria-label="Prototype dashboard sections">
        <span className="controller-chip">LB</span>
        {["Home", "Book Show", "Show Logistics", "Manage Roster", "Power Cards", "Season", "Finances", "GM Office", "Options"].map((tab) => (
          <button className={tab === "Home" ? "nav-tab is-active" : "nav-tab"} key={tab}>
            {tab}
          </button>
        ))}
        <span className="controller-chip">RB</span>
      </nav>

      <section className="dashboard-main-grid">
        <aside className="dashboard-column left-column">
          <article className="panel brand-status-panel">
            <div className="panel-kicker">Brand Status</div>
            <div className="brand-mark">WP</div>
            <div className="brand-rating">
              <span>Show Rating</span>
              <strong>92</strong>
            </div>
            <div className="mini-stat-grid">
              <div><span>Fans</span><strong>1,127,800</strong></div>
              <div><span>Budget</span><strong>$2,117,500</strong></div>
              <div><span>Weekly Profit</span><strong className="positive">+$246,000</strong></div>
            </div>
          </article>

          <article className="panel champions-panel">
            <div className="section-heading"><span>Champions</span><b>Gold Ledger</b></div>
            <div className="champion-list">
              {champions.map((champion, index) => (
                <div className="champion-row" key={champion.title}>
                  <span className="slot">{String(index + 1).padStart(2, "0")}</span>
                  <span className="portrait">{champion.initials}</span>
                  <span className="champion-copy">
                    <strong>{champion.title}</strong>
                    <em>{champion.name}</em>
                  </span>
                  <span className="belt">▰</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel goals-panel">
            <div className="section-heading"><span>GM Goals</span><b>4 Active</b></div>
            {goals.map((goal) => (
              <div className={goal.complete ? "goal-row is-complete" : "goal-row"} key={goal.label}>
                <span>{goal.complete ? "✓" : "·"}</span>
                <strong>{goal.label}</strong>
                <em>{goal.progress}</em>
              </div>
            ))}
          </article>
        </aside>

        <section className="dashboard-column center-column">
          <article className="panel roster-panel">
            <div className="roster-topline">
              <div className="section-heading"><span>Roster Overview</span><b>Roster Size 48 / 60</b></div>
              <div className="roster-controls">
                {["All", "Men", "Women", "Favorites"].map((filter) => (
                  <button className={filter === "All" ? "filter-chip is-active" : "filter-chip"} key={filter}>{filter}</button>
                ))}
                <span className="sort-control">Sort By: Overall</span>
              </div>
            </div>
            <div className="roster-table" role="table" aria-label="Roster overview">
              <div className="roster-row roster-head" role="row">
                <span>#</span><span>Superstar</span><span>Role</span><span>Style</span><span>Pop</span><span>Sta</span><span>Mor</span><span className="ovr-head">OVR</span><span>Contract</span><span>Cost</span>
              </div>
              <div className="roster-scroll">
                {roster.map((member) => (
                  <div className={member.selected ? "roster-row is-selected" : "roster-row"} role="row" key={member.name}>
                    <span>{member.rank}</span>
                    <strong>{member.name}</strong>
                    <span>{member.role}</span>
                    <span>{member.style}</span>
                    <span>{member.pop}</span>
                    <span><StaminaBar value={member.stamina} /></span>
                    <span><MoraleIcon morale={member.morale} /></span>
                    <span className="overall-box">{member.overall}</span>
                    <span>{member.contract}</span>
                    <span>{member.cost}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <section className="center-bottom-grid">
            <article className="panel promo-panel">
              <div className="promo-backdrop">
                <span className="lower-third">Next Show: Warpath</span>
                <div className="match-graphic">
                  <div className="fighter-card"><b>MV</b><span>Mara Vale</span></div>
                  <strong>VS</strong>
                  <div className="fighter-card"><b>AK</b><span>Atlas Kane</span></div>
                </div>
                <div className="main-event-copy">
                  <span>World Championship</span>
                  <strong>Main Event</strong>
                </div>
              </div>
            </article>

            <article className="panel show-card-panel">
              <div className="section-heading"><span>Current Show Card</span><b>6 Segments</b></div>
              <div className="show-card-list">
                {showCard.map(([match, stip], index) => (
                  <div className="show-card-row" key={match}>
                    <span>{index + 1}</span>
                    <strong>{match}</strong>
                    <em>{stip}</em>
                  </div>
                ))}
              </div>
              <div className="action-row">
                <button>+ Edit Card</button>
                <button className="primary-action">Simulate Show</button>
                <button>View Logistics</button>
              </div>
            </article>
          </section>
        </section>

        <aside className="dashboard-column right-column">
          <article className="panel rivalries-panel">
            <div className="section-heading"><span>Rivalries</span><b>Intensity Feed</b></div>
            {rivalries.map((rivalry) => (
              <div className="rivalry-row" key={`${rivalry.left}-${rivalry.right}`}>
                <div className="rivalry-matchup">
                  <span>{rivalry.left.slice(0, 2).toUpperCase()}</span>
                  <strong>{rivalry.left} vs {rivalry.right}</strong>
                  <span>{rivalry.right.slice(0, 2).toUpperCase()}</span>
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
            <div className="section-heading"><span>Show Metrics</span><b>W20-W24</b></div>
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
            {[
              ["red", "3 stars are injured"],
              ["amber", "Contract expiring soon"],
              ["gold", "Scouting report available"],
              ["gold", "Power card available"],
            ].map(([tone, alert]) => (
              <div className={`alert-row alert-${tone}`} key={alert}>
                <span>!</span>
                <strong>{alert}</strong>
              </div>
            ))}
          </article>

          <article className="panel free-agent-panel">
            <div className="section-heading"><span>Draft Pool</span><b>Top 5</b></div>
            <div className="free-agent-list">
              {freeAgents.map(([name, style]) => (
                <div className="free-agent-row" key={name}>
                  <strong>{name}</strong>
                  <span>{style}</span>
                </div>
              ))}
            </div>
            <button className="gold-action">View Full Draft Class</button>
          </article>
        </aside>
      </section>

      <footer className="controller-footer">
        <section className="prompt-bank">
          <span className="prompt-a">A</span><b>Select</b>
          <span className="prompt-b">B</span><b>Back</b>
          <span>R-Stick</span><b>GM Assistant</b>
        </section>
        <section className="ticker">
          <span className="dot green" /> Vera Saint's morale has increased
          <span className="dot red" /> Injury update: King Sable, 2 weeks
          <span className="dot gold" /> Warpath roster morale +3% this week
        </section>
        <section className="network-status"><strong>NGM</strong><span>● Online</span></section>
      </footer>
    </main>
  );
}

export default App;
