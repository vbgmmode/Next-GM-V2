import type { GameScreen } from "@game/migration";
import type { GameState, ShowResult } from "@game/types";
import { GameNav } from "@components/gameShell";
import { getBroadcastThemeClass } from "@components/broadcast";
import { buildDashboardModel } from "../adapters/buildDashboardModel";

type Props = {
  game: GameState;
  result?: ShowResult;
  currentScreen: GameScreen;
  hasResults?: boolean;
  hasWeekReview?: boolean;
  onNavigate: (screen: GameScreen) => void;
  children: React.ReactNode;
  contentClassName?: string;
};

export function DynastyShell({
  game,
  result,
  currentScreen,
  hasResults,
  hasWeekReview,
  onNavigate,
  children,
  contentClassName = "dynasty-page-content",
}: Props) {
  const model = buildDashboardModel(game, result);
  const themeClass = getBroadcastThemeClass(game.brandStyle);

  return (
    <main className={`game-dashboard-shell dynasty-hq-shell dynasty-game-shell ${themeClass}`}>
      <header className="broadcast-header">
        <section className="logo-lockup dynasty-brand-lockup">
          <span className="logo-line-1">Next GM</span>
          <span className="logo-line-2 dynasty-brand-name">{game.brandName}</span>
        </section>
        <section className="header-module calendar-module">
          <span>{model.seasonWeekLabel}</span>
          <strong>{model.dateLabel}</strong>
        </section>
        <section className="header-module">
          <span>Budget</span>
          <strong className="gold">{model.budgetLabel}</strong>
        </section>
        <section className="header-module">
          <span>Fans</span>
          <strong>{model.fansLabel}</strong>
        </section>
        <section className="header-module ranking-module">
          <span>Ranking</span>
          <strong className="ranking-value">{model.rankingLabel}</strong>
        </section>
        <section className="next-show-module">
          <span>Next Show</span>
          <strong className="next-show-name">{model.nextShowName}</strong>
          <em>{model.nextShowMeta}</em>
        </section>
        <section className="crest-slot dynasty-crest-slot" aria-label="GM crest">
          <span className="dynasty-crest-label">{model.gmCrestLabel}</span>
        </section>
      </header>

      <div className="dynasty-nav-bridge">
        <GameNav
          currentScreen={currentScreen}
          hasResults={hasResults ?? model.hasResults}
          hasWeekReview={hasWeekReview ?? model.hasWeekReview}
          onNavigate={onNavigate}
        />
      </div>

      <section className={contentClassName}>{children}</section>
    </main>
  );
}
