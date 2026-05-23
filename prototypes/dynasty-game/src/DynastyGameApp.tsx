import { useMemo, useState } from "react";
import type { GameScreen } from "@game/migration";
import type { Screen } from "@game/types";
import { PlaythroughBar } from "./shell/PlaythroughBar";
import { DynastyShell } from "./shell/DynastyShell";
import {
  getNextPhase,
  getPlaythroughContext,
  playthroughPhases,
  type PlaythroughPhase,
} from "./fixtures/playthrough";
import type { LiveDeskFixtureId } from "./fixtures";
import { liveDeskFixtures } from "./fixtures";
import { TitleScene } from "./scenes/TitleScene";
import { SetupScene } from "./scenes/SetupScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { BookingScene } from "./scenes/BookingScene";
import { ResultsScene } from "./scenes/ResultsScene";
import { WeekReviewScene } from "./scenes/WeekReviewScene";
import { RosterScene } from "./scenes/RosterScene";
import { MarketScene } from "./scenes/MarketScene";
import { ProfileScene } from "./scenes/ProfileScene";
import { ChampionshipsScene } from "./scenes/ChampionshipsScene";
import { RivalriesScene } from "./scenes/RivalriesScene";
import { CalendarScene } from "./scenes/CalendarScene";
import { SocialScene } from "./scenes/SocialScene";
import { FinanceScene } from "./scenes/FinanceScene";
import { SeasonReviewScene } from "./scenes/SeasonReviewScene";

export function DynastyGameApp() {
  const [phase, setPhase] = useState<PlaythroughPhase>("title");
  const [screen, setScreen] = useState<Screen>("title");
  const [freeFixtureId, setFreeFixtureId] = useState<LiveDeskFixtureId>("week-pressure");
  const [profileWrestlerId, setProfileWrestlerId] = useState<string | undefined>();
  const [profileReturnScreen, setProfileReturnScreen] = useState<GameScreen>("roster");
  const [toast, setToast] = useState<string | null>(null);

  const context = useMemo(() => getPlaythroughContext(phase, freeFixtureId), [phase, freeFixtureId]);
  const { game, result, hasWeekReview, hasResults } = context;

  function handlePhaseChange(nextPhase: PlaythroughPhase) {
    setPhase(nextPhase);
    setToast(null);
    const meta = playthroughPhases.find((item) => item.id === nextPhase);
    if (meta) {
      setScreen(meta.defaultScreen);
    }
  }

  function handleNextStep() {
    const next = getNextPhase(phase);
    if (next === phase) {
      setToast("Playthrough complete — use GameNav to explore every tab.");
      return;
    }
    handlePhaseChange(next);
  }

  function handleNavigate(nextScreen: GameScreen) {
    setScreen(nextScreen);
    setToast(null);
    if (phase !== "free" && !["title", "setup"].includes(screen)) {
      // allow free exploration after spine without changing phase
    }
  }

  function openProfile(wrestlerId: string, returnScreen: GameScreen = "roster") {
    setProfileWrestlerId(wrestlerId);
    setProfileReturnScreen(returnScreen);
    setScreen("profile");
  }

  function handleRunShow() {
    handlePhaseChange("results");
    setScreen("results");
  }

  function renderGameScreen() {
    if (screen === "profile") {
      const wrestler = game.wrestlers.find((item) => item.id === profileWrestlerId) ?? game.wrestlers[0];
      if (!wrestler) {
        return null;
      }
      return (
        <ProfileScene
          game={game}
          wrestler={wrestler}
          onNavigate={handleNavigate}
          onBack={() => setScreen(profileReturnScreen)}
        />
      );
    }

    switch (screen) {
      case "dashboard":
        return <DashboardScene game={game} result={result} onNavigate={handleNavigate} />;
      case "booking":
        return (
          <BookingScene
            game={game}
            onNavigate={handleNavigate}
            onRunShow={handleRunShow}
            onOpenProfile={(id) => openProfile(id, "booking")}
          />
        );
      case "roster":
        return (
          <RosterScene
            game={game}
            selectedId={profileWrestlerId}
            onNavigate={handleNavigate}
            onOpenProfile={(id) => openProfile(id, "roster")}
          />
        );
      case "market":
        return <MarketScene game={game} onNavigate={handleNavigate} />;
      case "championships":
        return <ChampionshipsScene game={game} />;
      case "rivalries":
        return <RivalriesScene game={game} />;
      case "calendar":
        return <CalendarScene game={game} />;
      case "social":
        return <SocialScene game={game} />;
      case "finance":
        return <FinanceScene game={game} />;
      case "results":
        if (!result) {
          return <DashboardScene game={game} onNavigate={handleNavigate} />;
        }
        return (
          <ResultsScene
            game={game}
            result={result}
            onNavigate={handleNavigate}
            onContinueWeekReview={() => {
              handlePhaseChange("weekReview");
              setScreen("weekReview");
            }}
          />
        );
      case "weekReview":
        if (!result) {
          return <DashboardScene game={game} onNavigate={handleNavigate} />;
        }
        return (
          <WeekReviewScene
            game={game}
            result={result}
            onNavigate={handleNavigate}
            onAdvanceWeek={() => {
              setToast("Playthrough complete — use GameNav to explore other tabs or switch fixture in Free Roam.");
              handlePhaseChange("free");
              setScreen("dashboard");
            }}
          />
        );
      case "seasonReview":
        return (
          <SeasonReviewScene
            game={game}
            onStartNextSeason={() => setToast("Season advance is a visual stub in this prototype.")}
          />
        );
      default:
        return <DashboardScene game={game} result={result} onNavigate={handleNavigate} />;
    }
  }

  return (
    <div className="dynasty-hq-app dynasty-game-app">
      <PlaythroughBar phase={phase} onPhaseChange={handlePhaseChange} onNextStep={handleNextStep} toast={toast} />

      {phase === "free" ? (
        <header className="dynasty-free-fixture-bar">
          <label>
            Fixture
            <select value={freeFixtureId} onChange={(event) => setFreeFixtureId(event.target.value as LiveDeskFixtureId)}>
              {liveDeskFixtures.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </header>
      ) : null}

      {screen === "title" ? (
        <TitleScene
          onContinue={() => {
            handlePhaseChange("week1-hq");
            setScreen("dashboard");
          }}
          onNewCareer={() => {
            handlePhaseChange("setup");
            setScreen("setup");
          }}
        />
      ) : null}

      {screen === "setup" ? (
        <SetupScene
          onCancel={() => {
            handlePhaseChange("title");
            setScreen("title");
          }}
          onComplete={() => {
            handlePhaseChange("week1-hq");
            setScreen("dashboard");
          }}
        />
      ) : null}

      {screen !== "title" && screen !== "setup" ? (
        <DynastyShell
          game={game}
          result={result}
          currentScreen={screen as GameScreen}
          hasResults={hasResults}
          hasWeekReview={hasWeekReview}
          onNavigate={handleNavigate}
        >
          {renderGameScreen()}
        </DynastyShell>
      ) : null}
    </div>
  );
}
