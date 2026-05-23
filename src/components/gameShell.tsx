import type { GameScreen } from "../game/migration";
import type { GameState } from "../game/types";

export function GameNav({
  currentScreen,
  hasResults,
  hasWeekReview,
  onNavigate,
}: {
  currentScreen: GameScreen;
  hasResults: boolean;
  hasWeekReview?: boolean;
  onNavigate: (screen: GameScreen) => void;
}) {
  const showWeekReview = hasWeekReview ?? hasResults;

  return (
    <nav className="game-nav" aria-label="Game navigation">
      <button className={currentScreen === "dashboard" ? "active-filter" : ""} onClick={() => onNavigate("dashboard")}>
        Dashboard
      </button>
      <button className={currentScreen === "booking" ? "active-filter" : ""} onClick={() => onNavigate("booking")}>
        Booking
      </button>
      <button className={currentScreen === "roster" ? "active-filter" : ""} onClick={() => onNavigate("roster")}>
        Roster
      </button>
      <button className={currentScreen === "market" ? "active-filter" : ""} onClick={() => onNavigate("market")}>
        Market
      </button>
      <button className={currentScreen === "championships" ? "active-filter" : ""} onClick={() => onNavigate("championships")}>
        Championships
      </button>
      <button className={currentScreen === "rivalries" ? "active-filter" : ""} onClick={() => onNavigate("rivalries")}>
        Rivalries
      </button>
      <button className={currentScreen === "calendar" ? "active-filter" : ""} onClick={() => onNavigate("calendar")}>
        Calendar
      </button>
      <button className={currentScreen === "social" ? "active-filter" : ""} onClick={() => onNavigate("social")}>
        Social
      </button>
      <button className={currentScreen === "finance" ? "active-filter" : ""} onClick={() => onNavigate("finance")}>
        Finance
      </button>
      {hasResults ? (
        <button className={currentScreen === "results" ? "active-filter" : ""} onClick={() => onNavigate("results")}>
          Results
        </button>
      ) : null}
      {showWeekReview ? (
        <button className={currentScreen === "weekReview" ? "active-filter" : ""} onClick={() => onNavigate("weekReview")}>
          Week Review
        </button>
      ) : null}
    </nav>
  );
}

export function Header({ game }: { game: GameState }) {
  return (
    <header className="top-bar">
      <strong>Next GM</strong>
      <span>
        {game.brandName} · GM {game.gmName}
      </span>
      <span>
        Season {game.seasonNumber} · Week {game.currentWeek}
      </span>
    </header>
  );
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
