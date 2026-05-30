import type { GameScreen } from "../game/migration";
import type { GameState } from "../game/types";

export function GameNav({
  currentScreen,
  hasResults,
  onNavigate,
}: {
  currentScreen: GameScreen;
  hasResults: boolean;
  onNavigate: (screen: GameScreen) => void;
}) {
  return (
    <nav className="game-nav" aria-label="Game navigation">
      <button className={currentScreen === "dashboard" ? "active-filter" : ""} onClick={() => onNavigate("dashboard")}>
        Brand HQ
      </button>
      <button className={currentScreen === "booking" ? "active-filter" : ""} onClick={() => onNavigate("booking")}>
        Booking Desk
      </button>
      <button className={currentScreen === "roster" ? "active-filter" : ""} onClick={() => onNavigate("roster")}>
        Locker Room
      </button>
      <button className={currentScreen === "market" ? "active-filter" : ""} onClick={() => onNavigate("market")}>
        Market Desk
      </button>
      <button className={currentScreen === "championships" ? "active-filter" : ""} onClick={() => onNavigate("championships")}>
        Title Office
      </button>
      <button className={currentScreen === "rivalries" ? "active-filter" : ""} onClick={() => onNavigate("rivalries")}>
        Rivalry Desk
      </button>
      <button className={currentScreen === "calendar" ? "active-filter" : ""} onClick={() => onNavigate("calendar")}>
        Calendar
      </button>
      <button className={currentScreen === "social" ? "active-filter" : ""} onClick={() => onNavigate("social")}>
        IWC Pulse
      </button>
      <button className={currentScreen === "finance" ? "active-filter" : ""} onClick={() => onNavigate("finance")}>
        Finance Desk
      </button>
      {hasResults ? (
        <button className={currentScreen === "results" ? "active-filter" : ""} onClick={() => onNavigate("results")}>
          Show Recap
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
