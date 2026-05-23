import type { ReactNode } from "react";
import { buildDashboardViewModel } from "../game/dashboardViewModel";
import { getBroadcastTheme } from "./broadcast";
import { GameNav } from "./gameShell";
import type { GameScreen } from "../game/migration";
import type { GameState, ShowResult } from "../game/types";

type DynastyCtaTone = "brand" | "danger" | "neutral" | "positive" | "warning";

export type DynastyManagementCta = {
  disabled?: boolean;
  eyebrow: string;
  label: string;
  onClick?: () => void;
  tone?: DynastyCtaTone;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatLocationLabel(screen: GameScreen) {
  const labels: Record<GameScreen, string> = {
    booking: "Booking Desk",
    calendar: "Calendar",
    championships: "Title Office",
    dashboard: "Brand HQ",
    finance: "Finance Desk",
    market: "Market Desk",
    profile: "Talent Profile",
    results: "Show Recap",
    rivalries: "Rivalry Desk",
    roster: "Locker Room",
    seasonReview: "Season Review",
    social: "IWC Pulse",
    weekReview: "Week Review",
  };

  return labels[screen];
}

export function DynastyManagementShell({
  children,
  className,
  cta,
  currentScreen,
  game,
  latestResult,
  onNavigate,
}: {
  children: ReactNode;
  className?: string;
  cta?: DynastyManagementCta;
  currentScreen: GameScreen;
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const model = buildDashboardViewModel(game, latestResult);
  const theme = getBroadcastTheme(game.brandStyle);
  const ctaTone = cta?.tone ?? "brand";
  const ctaDisabled = Boolean(cta?.disabled);

  return (
    <main className={cx("dashboard-dynasty-shell dynasty-management-shell", `broadcast-theme-${theme}`, className)} data-broadcast-theme={theme}>
      <header className="dashboard-dynasty-header dynasty-management-header">
        <section className="dashboard-dynasty-logo-lockup">
          <span>Next GM</span>
          <strong>{game.brandName}</strong>
        </section>
        <section className="dashboard-dynasty-header-module">
          <span>{model.seasonWeekLabel}</span>
          <strong>{model.dateLabel}</strong>
        </section>
        <section className="dashboard-dynasty-header-module">
          <span>Budget</span>
          <strong className="dashboard-dynasty-gold">{model.budgetLabel}</strong>
        </section>
        <section className="dashboard-dynasty-header-module">
          <span>Fans</span>
          <strong>{model.fansLabel}</strong>
        </section>
        <section className="dashboard-dynasty-header-module dashboard-dynasty-ranking-module">
          <span>Ranking</span>
          <strong>{model.rankingLabel}</strong>
        </section>
        <section className={`dashboard-dynasty-next-show dynasty-management-cta dynasty-management-cta--${ctaTone} ${ctaDisabled ? "is-disabled" : ""}`}>
          <span>{cta?.eyebrow ?? formatLocationLabel(currentScreen)}</span>
          {cta?.onClick ? (
            <button className="run-show-action dynasty-management-cta-button" disabled={ctaDisabled} onClick={cta.onClick} type="button">
              {cta.label}
            </button>
          ) : (
            <strong>{cta?.label ?? "No Action"}</strong>
          )}
        </section>
      </header>

      <div className="dashboard-dynasty-nav-bridge dynasty-management-nav-bridge">
        <GameNav currentScreen={currentScreen} hasResults={model.hasResults} hasWeekReview={model.hasWeekReview} onNavigate={onNavigate} />
      </div>

      {children}
    </main>
  );
}
