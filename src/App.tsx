import { useMemo, useState } from "react";
import { clearGameState, loadGameState, saveGameState } from "./gameStorage";
import { advanceGameWeek, startNextSeason } from "./game/advanceWeek";
import { getFinancePressureLabel } from "./game/finance";
import { createDefaultChampionships, createDefaultRivalries, createNewGame, createSeasonCalendar, defaultCareer } from "./game/seed";
import {
  getBestSegment,
  getCurrentCalendarWeek,
  getResultChange,
  getRivalryStatus,
  getShowGrade,
  isValidSegment,
  runShow,
} from "./game/scoring";
import type {
  CalendarWeek,
  BrandStyle,
  Championship,
  FinanceReport,
  GameState,
  GMStyle,
  PressureLabel,
  Rivalry,
  RivalryStakes,
  Screen,
  Segment,
  SegmentType,
  ShowResult,
  SocialCategory,
  SocialPost,
  ShowType,
  Wrestler,
} from "./game/types";

type GameScreen = Exclude<Screen, "title" | "setup">;

type SavedGameState = {
  game: GameState;
  screen: GameScreen;
};

type RosterSort = "popularity" | "momentum" | "fatigue" | "morale";
type RosterFilter = "All" | "Hot" | "Tired" | "Frustrated";
type SocialFilter = "All" | "Fan Reaction" | "Dirt Sheets" | "Analyst Takes" | "Title Scene" | "Rivalries";
type SetupStep = "contract" | "gm" | "brand" | "preview";

const gmStyles: GMStyle[] = ["Creative Visionary", "Talent Developer", "Ruthless Executive", "Ratings Chaser"];
const brandStyles: BrandStyle[] = [
  "Prime Time Sports Entertainment",
  "Underground Fight Club",
  "Workrate Showcase",
  "Reality Era Chaos",
];

function formatMoney(amount: number) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString()}`;
}

function formatPressureLabel(label: PressureLabel) {
  return label;
}

function getSegmentRuntime(type: SegmentType) {
  return type === "Match" ? "12 min TV time" : "6 min TV time";
}

function getSegmentRequirement(type: SegmentType) {
  return type === "Match" ? "Needs exactly 2 wrestlers" : "Needs 1 to 3 wrestlers";
}

function getShowSegmentLimit(game: GameState) {
  return getCurrentCalendarWeek(game).showType === "ple" ? 6 : 4;
}

function getSegmentParticipants(segment: Segment, wrestlers: Wrestler[]) {
  return segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function getWrestlerStatus(wrestler: Wrestler): Exclude<RosterFilter, "All"> | "Steady" {
  if (wrestler.fatigue >= 60) {
    return "Tired";
  }

  if (wrestler.morale <= 45) {
    return "Frustrated";
  }

  if (wrestler.momentum >= 65) {
    return "Hot";
  }

  return "Steady";
}

function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}

function isSinglesChampionship(championship: Championship) {
  return championship.division !== "Tag Team" && championship.championIds.length === 1;
}

function canSegmentContestChampionship(segment: Segment, championship: Championship) {
  return (
    segment.type === "Match" &&
    isValidSegment(segment) &&
    isSinglesChampionship(championship) &&
    segment.participantIds.includes(championship.championIds[0])
  );
}

function getTopContenders(championship: Championship, wrestlers: Wrestler[], limit = 3) {
  return [...wrestlers]
    .filter((wrestler) => !championship.championIds.includes(wrestler.id))
    .sort((a, b) => b.popularity + b.momentum - (a.popularity + a.momentum))
    .slice(0, limit);
}

function getReignLength(championship: Championship, currentWeek: number) {
  return Math.max(1, currentWeek - championship.reignStartWeek + 1);
}

function canSegmentAttachRivalry(segment: Segment, rivalry: Rivalry) {
  return segment.participantIds.some((id) => rivalry.participantIds.includes(id));
}

function getRivalryParticipants(rivalry: Rivalry, wrestlers: Wrestler[]) {
  return rivalry.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

function getHottestRivalry(rivalries: Rivalry[]) {
  return [...rivalries].sort((a, b) => b.heat - a.heat)[0];
}

function getCoolingRivalry(rivalries: Rivalry[]) {
  return rivalries.find((rivalry) => rivalry.status === "stale") ?? rivalries.find((rivalry) => rivalry.status === "cooling");
}

function hasDuplicateRivalry(rivalries: Rivalry[], wrestlerAId: string, wrestlerBId: string) {
  const pair = [wrestlerAId, wrestlerBId].sort().join("|");
  return rivalries.some((rivalry) => [...rivalry.participantIds].sort().join("|") === pair);
}

function formatRivalryStatus(status: Rivalry["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRivalryStakes(stakes: RivalryStakes) {
  return stakes.charAt(0).toUpperCase() + stakes.slice(1);
}

function getInitialRivalryHeat(wrestlerA: Wrestler, wrestlerB: Wrestler) {
  return Math.round((wrestlerA.popularity + wrestlerB.popularity + wrestlerA.momentum + wrestlerB.momentum) / 4);
}

function getShowTypeLabel(showType: ShowType) {
  return showType === "ple" ? "PLE" : "TV";
}

function getNextPle(calendar: CalendarWeek[], currentWeek: number) {
  return calendar.find((week) => week.showType === "ple" && week.weekNumber >= currentWeek && !week.completed);
}

function getWeeksUntilPle(nextPle: CalendarWeek | undefined, currentWeek: number) {
  if (!nextPle) {
    return 0;
  }

  return Math.max(0, nextPle.weekNumber - currentWeek);
}

function getBestShow(showHistory: ShowResult[], seasonNumber?: number) {
  const results = seasonNumber ? showHistory.filter((result) => result.seasonNumber === seasonNumber) : showHistory;
  return results.reduce<ShowResult | undefined>((best, result) => (!best || result.totalScore > best.totalScore ? result : best), undefined);
}

function getLatestFinanceReport(game: GameState) {
  return game.financeReports[game.financeReports.length - 1];
}

function getFinanceReportForResult(game: GameState, result: ShowResult) {
  return game.financeReports.find((report) => report.id === `${result.id}-finance`);
}

function getSeasonFinanceReports(game: GameState) {
  return game.financeReports.filter((report) => report.seasonNumber === game.seasonNumber);
}

function getBestRevenueReport(reports: FinanceReport[]) {
  return reports.reduce<FinanceReport | undefined>((best, report) => {
    const revenue = report.ticketRevenue + report.merchRevenue + report.mediaRevenue;
    const bestRevenue = best ? best.ticketRevenue + best.merchRevenue + best.mediaRevenue : -Infinity;
    return revenue > bestRevenue ? report : best;
  }, undefined);
}

function getWorstProfitReport(reports: FinanceReport[]) {
  return reports.reduce<FinanceReport | undefined>((worst, report) => (!worst || report.profitLoss < worst.profitLoss ? report : worst), undefined);
}

function formatSocialCategory(category: SocialCategory) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSocialTone(tone: SocialPost["tone"]) {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

function getSocialFilterCategory(filter: SocialFilter): SocialCategory[] | null {
  if (filter === "Fan Reaction") {
    return ["fan_praise", "push_complaint", "viral_moment", "ple_reaction", "fatigue_concern"];
  }

  if (filter === "Dirt Sheets") {
    return ["dirt_sheet"];
  }

  if (filter === "Analyst Takes") {
    return ["analyst_take"];
  }

  if (filter === "Title Scene") {
    return ["title_scene"];
  }

  if (filter === "Rivalries") {
    return ["rivalry_heat"];
  }

  return null;
}

function getRelatedWrestlerNames(post: SocialPost, wrestlers: Wrestler[]) {
  return post.relatedWrestlerIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name).filter(Boolean).join(" / ");
}

function buildBroadcastRecap(result: ShowResult) {
  const bestSegment = getBestSegment(result);
  const bestNames = bestSegment.participantNames.join(" / ");
  const titleFallout = result.titleNotes?.length ? ` Title fallout: ${result.titleNotes.join(" ")}` : "";
  const rivalryFallout = result.rivalryNotes?.length ? ` Story movement: ${result.rivalryNotes[0]}` : "";
  const showFrame =
    result.showType === "ple"
      ? `${result.showName} was a major event for ${result.brandName}`
      : `${result.brandName} posted a ${result.totalScore} (${getShowGrade(result.totalScore)})`;

  return `${showFrame} in Week ${result.week}, with ${bestNames} delivering the strongest ${bestSegment.type.toLowerCase()} of the night at ${bestSegment.score}. ${result.biggestMomentumGain.name} gained the most momentum, while ${result.biggestFatigueIncrease.name} took the biggest fatigue hit.${titleFallout}${rivalryFallout}`;
}

function saveSnapshot(game: GameState, screen: SavedGameState["screen"]) {
  saveGameState({ game, screen });
}

function isSavedGameState(value: unknown): value is SavedGameState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const saved = value as Partial<SavedGameState>;
  const game = saved.game as Partial<GameState> | undefined;

  return (
    (saved.screen === "dashboard" ||
      saved.screen === "booking" ||
      saved.screen === "roster" ||
      saved.screen === "championships" ||
      saved.screen === "rivalries" ||
      saved.screen === "calendar" ||
      saved.screen === "social" ||
      saved.screen === "finance" ||
      saved.screen === "seasonReview" ||
      saved.screen === "results") &&
    Boolean(game) &&
    typeof game?.currentWeek === "number" &&
    typeof game.brandName === "string" &&
    typeof game.money === "number" &&
    Array.isArray(game.wrestlers) &&
    Array.isArray(game.currentShow) &&
    Array.isArray(game.showHistory)
  );
}

function loadSavedGame() {
  const savedState = loadGameState<SavedGameState>();

  if (!savedState) {
    return null;
  }

  if (!isSavedGameState(savedState)) {
    console.warn("Saved game state is invalid.");
    return null;
  }

  return {
    ...savedState,
    game: {
      ...savedState.game,
      championships:
        Array.isArray(savedState.game.championships) && savedState.game.championships.length
          ? savedState.game.championships
          : createDefaultChampionships(),
      rivalries:
        Array.isArray(savedState.game.rivalries) && savedState.game.rivalries.length
          ? savedState.game.rivalries
          : createDefaultRivalries(),
      seasonNumber: savedState.game.seasonNumber ?? 1,
      calendar:
        Array.isArray(savedState.game.calendar) && savedState.game.calendar.length
          ? savedState.game.calendar
          : createSeasonCalendar(),
      socialPosts: Array.isArray(savedState.game.socialPosts) ? savedState.game.socialPosts : [],
      financeReports: Array.isArray(savedState.game.financeReports) ? savedState.game.financeReports : [],
      seasonStartingMoney: savedState.game.seasonStartingMoney ?? savedState.game.money,
      gmName: savedState.game.gmName ?? defaultCareer.gmName,
      gmStyle: savedState.game.gmStyle ?? defaultCareer.gmStyle,
      brandStyle: savedState.game.brandStyle ?? defaultCareer.brandStyle,
      createdAt: savedState.game.createdAt ?? new Date().toISOString(),
    },
  };
}

function App() {
  const [savedGame, setSavedGame] = useState<SavedGameState | null>(() => loadSavedGame());
  const [screen, setScreen] = useState<Screen>("title");
  const [game, setGame] = useState<GameState | null>(null);
  const latestResult = game?.showHistory[game.showHistory.length - 1];

  function startNewGame() {
    if (savedGame && !window.confirm("Start a new game and overwrite the existing save?")) {
      return;
    }

    setGame(null);
    setScreen("setup");
  }

  function startCareer(career: {
    gmName: string;
    gmStyle: GMStyle;
    brandName: string;
    brandStyle: BrandStyle;
  }) {
    const newGame = createNewGame(career);
    saveSnapshot(newGame, "dashboard");
    setSavedGame({ game: newGame, screen: "dashboard" });
    setGame(newGame);
    setScreen("dashboard");
  }

  function continueGame() {
    if (!savedGame) {
      return;
    }

    setGame(savedGame.game);
    setScreen(savedGame.screen);
  }

  function resetSave() {
    if (!window.confirm("Delete the saved game?")) {
      return;
    }

    clearGameState();
    setSavedGame(null);
    setGame(null);
    setScreen("title");
  }

  function navigateTo(nextScreen: GameScreen) {
    if (!game) {
      return;
    }

    saveSnapshot(game, nextScreen);
    setSavedGame({ game, screen: nextScreen });
    setScreen(nextScreen);
  }

  function addSegment(type: SegmentType) {
    setGame((current) => {
      if (!current || current.currentShow.length >= getShowSegmentLimit(current)) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: [
          ...current.currentShow,
          {
            id: `segment-${Date.now()}-${current.currentShow.length}`,
            type,
            participantIds: [],
          },
        ],
      };

      saveSnapshot(updatedGame, "booking");
      setSavedGame({ game: updatedGame, screen: "booking" });
      return updatedGame;
    });
  }

  function setSegmentChampionship(segmentId: string, championshipId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          const championship = current.championships.find((title) => title.id === championshipId);

          if (!championshipId || !championship || !canSegmentContestChampionship(segment, championship)) {
            return { ...segment, championshipId: undefined };
          }

          return { ...segment, championshipId };
        }),
      };

      saveSnapshot(updatedGame, "booking");
      setSavedGame({ game: updatedGame, screen: "booking" });
      return updatedGame;
    });
  }

  function setSegmentRivalry(segmentId: string, rivalryId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          const rivalry = current.rivalries.find((activeRivalry) => activeRivalry.id === rivalryId);

          if (!rivalryId || !rivalry || !canSegmentAttachRivalry(segment, rivalry)) {
            return { ...segment, rivalryId: undefined };
          }

          return { ...segment, rivalryId };
        }),
      };

      saveSnapshot(updatedGame, "booking");
      setSavedGame({ game: updatedGame, screen: "booking" });
      return updatedGame;
    });
  }

  function removeSegment(id: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = { ...current, currentShow: current.currentShow.filter((segment) => segment.id !== id) };
      saveSnapshot(updatedGame, "booking");
      setSavedGame({ game: updatedGame, screen: "booking" });
      return updatedGame;
    });
  }

  function toggleParticipant(segmentId: string, wrestlerId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        currentShow: current.currentShow.map((segment) => {
          if (segment.id !== segmentId) {
            return segment;
          }

          const isSelected = segment.participantIds.includes(wrestlerId);
          const participantLimit = segment.type === "Match" ? 2 : 3;
          const participantIds = isSelected
            ? segment.participantIds.filter((id) => id !== wrestlerId)
            : segment.participantIds.length < participantLimit
              ? [...segment.participantIds, wrestlerId]
              : segment.participantIds;

          let updatedSegment = { ...segment, participantIds };
          const championship = updatedSegment.championshipId
            ? current.championships.find((title) => title.id === updatedSegment.championshipId)
            : undefined;

          if (championship && !canSegmentContestChampionship(updatedSegment, championship)) {
            updatedSegment = { ...updatedSegment, championshipId: undefined };
          }

          const rivalry = updatedSegment.rivalryId
            ? current.rivalries.find((activeRivalry) => activeRivalry.id === updatedSegment.rivalryId)
            : undefined;

          if (rivalry && !canSegmentAttachRivalry(updatedSegment, rivalry)) {
            updatedSegment = { ...updatedSegment, rivalryId: undefined };
          }

          return updatedSegment;
        }),
      };

      saveSnapshot(updatedGame, "booking");
      setSavedGame({ game: updatedGame, screen: "booking" });
      return updatedGame;
    });
  }

  function handleRunShow() {
    if (!game) {
      return;
    }

    const resolvedShow = runShow(game);
    saveSnapshot(resolvedShow.game, "results");
    setSavedGame({ game: resolvedShow.game, screen: "results" });
    setGame(resolvedShow.game);
    setScreen("results");
  }

  function advanceWeek() {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = advanceGameWeek(current);
      const nextScreen = current.currentWeek >= 12 ? "seasonReview" : "dashboard";

      saveSnapshot(updatedGame, nextScreen);
      setSavedGame({ game: updatedGame, screen: nextScreen });
      return updatedGame;
    });
    setScreen(game?.currentWeek === 12 ? "seasonReview" : "dashboard");
  }

  function handleStartNextSeason() {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = startNextSeason(current);
      saveSnapshot(updatedGame, "dashboard");
      setSavedGame({ game: updatedGame, screen: "dashboard" });
      return updatedGame;
    });
    setScreen("dashboard");
  }

  function createRivalry(wrestlerAId: string, wrestlerBId: string, stakes: RivalryStakes) {
    setGame((current) => {
      if (!current || wrestlerAId === wrestlerBId || hasDuplicateRivalry(current.rivalries, wrestlerAId, wrestlerBId)) {
        return current;
      }

      const wrestlerA = current.wrestlers.find((wrestler) => wrestler.id === wrestlerAId);
      const wrestlerB = current.wrestlers.find((wrestler) => wrestler.id === wrestlerBId);

      if (!wrestlerA || !wrestlerB) {
        return current;
      }

      const heat = getInitialRivalryHeat(wrestlerA, wrestlerB);
      const updatedGame = {
        ...current,
        rivalries: [
          ...current.rivalries,
          {
            id: `rivalry-${Date.now()}`,
            name: `${wrestlerA.name} vs ${wrestlerB.name}`,
            participantIds: [wrestlerAId, wrestlerBId],
            heat,
            freshness: 80,
            weeksActive: 1,
            lastAdvancedWeek: 0,
            status: getRivalryStatus(heat, 80),
            stakes,
          },
        ],
      };

      saveSnapshot(updatedGame, "rivalries");
      setSavedGame({ game: updatedGame, screen: "rivalries" });
      return updatedGame;
    });
  }

  function endRivalry(rivalryId: string) {
    setGame((current) => {
      if (!current) {
        return current;
      }

      const updatedGame = {
        ...current,
        rivalries: current.rivalries.filter((rivalry) => rivalry.id !== rivalryId),
        currentShow: current.currentShow.map((segment) =>
          segment.rivalryId === rivalryId ? { ...segment, rivalryId: undefined } : segment,
        ),
      };

      saveSnapshot(updatedGame, "rivalries");
      setSavedGame({ game: updatedGame, screen: "rivalries" });
      return updatedGame;
    });
  }

  if (screen === "setup") {
    return <NewGameSetupScreen onCancel={() => setScreen("title")} onStartCareer={startCareer} />;
  }

  if (screen === "title" || !game) {
    return <TitleScreen hasSave={Boolean(savedGame)} onContinue={continueGame} onResetSave={resetSave} onStart={startNewGame} />;
  }

  if (screen === "booking") {
    return (
      <BookingScreen
        game={game}
        onAddSegment={addSegment}
        onBack={() => navigateTo("dashboard")}
        onNavigate={navigateTo}
        onRemoveSegment={removeSegment}
        onRunShow={handleRunShow}
        onSetSegmentChampionship={setSegmentChampionship}
        onSetSegmentRivalry={setSegmentRivalry}
        onToggleParticipant={toggleParticipant}
      />
    );
  }

  if (screen === "roster") {
    return <RosterScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "championships") {
    return <ChampionshipsScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "rivalries") {
    return (
      <RivalriesScreen
        game={game}
        latestResult={latestResult}
        onCreateRivalry={createRivalry}
        onEndRivalry={endRivalry}
        onNavigate={navigateTo}
      />
    );
  }

  if (screen === "calendar") {
    return <CalendarScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "social") {
    return <SocialScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "finance") {
    return <FinanceScreen game={game} latestResult={latestResult} onNavigate={navigateTo} />;
  }

  if (screen === "results" && latestResult) {
    return <ResultsScreen game={game} result={latestResult} onAdvanceWeek={advanceWeek} onNavigate={navigateTo} />;
  }

  if (screen === "seasonReview") {
    return <SeasonReviewScreen game={game} onStartNextSeason={handleStartNextSeason} />;
  }

  return (
    <DashboardScreen
      game={game}
      latestResult={latestResult}
      onNavigate={navigateTo}
    />
  );
}

function TitleScreen({
  hasSave,
  onContinue,
  onResetSave,
  onStart,
}: {
  hasSave: boolean;
  onContinue: () => void;
  onResetSave: () => void;
  onStart: () => void;
}) {
  return (
    <main className="title-screen">
      <div className="title-copy">
        <p className="eyebrow">Offline GM Command</p>
        <h1>Next GM</h1>
        <p className="lede">Book the card, run the show, read the fallout, and carry the roster into next week.</p>
        <div className="title-actions">
          {hasSave ? (
            <button className="primary-action" onClick={onContinue}>
              Continue
            </button>
          ) : null}
          <button className="primary-action" onClick={onStart}>
            New Game
          </button>
          {hasSave ? (
            <button className="secondary-action" onClick={onResetSave}>
              Reset Save
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function NewGameSetupScreen({
  onCancel,
  onStartCareer,
}: {
  onCancel: () => void;
  onStartCareer: (career: { gmName: string; gmStyle: GMStyle; brandName: string; brandStyle: BrandStyle }) => void;
}) {
  const [step, setStep] = useState<SetupStep>("contract");
  const [gmName, setGmName] = useState(defaultCareer.gmName);
  const [gmStyle, setGmStyle] = useState<GMStyle>(defaultCareer.gmStyle);
  const [brandName, setBrandName] = useState(defaultCareer.brandName);
  const [brandStyle, setBrandStyle] = useState<BrandStyle>(defaultCareer.brandStyle);
  const canPreview = gmName.trim().length > 0 && brandName.trim().length > 0;

  function startCareer() {
    if (!canPreview) {
      return;
    }

    onStartCareer({
      gmName: gmName.trim(),
      gmStyle,
      brandName: brandName.trim(),
      brandStyle,
    });
  }

  return (
    <main className="setup-screen">
      <section className="setup-shell">
        <div className="setup-progress" aria-label="Setup progress">
          {["contract", "gm", "brand", "preview"].map((item, index) => (
            <span className={step === item ? "active-step" : ""} key={item}>
              {index + 1}
            </span>
          ))}
        </div>

        {step === "contract" ? (
          <div className="setup-panel">
            <p className="eyebrow">Sign The Contract</p>
            <h1>You're Hired</h1>
            <p className="lede">
              A national broadcast window is open, the roster is restless, and ownership wants a 12-week road that feels like appointment TV.
            </p>
            <div className="title-actions">
              <button className="primary-action" onClick={() => setStep("gm")}>
                Accept The Job
              </button>
              <button className="secondary-action" onClick={onCancel}>
                Back
              </button>
            </div>
          </div>
        ) : null}

        {step === "gm" ? (
          <div className="setup-panel">
            <p className="eyebrow">Choose GM Identity</p>
            <h2>Who Runs The Room?</h2>
            <label className="setup-field">
              GM Name
              <input value={gmName} onChange={(event) => setGmName(event.target.value)} />
            </label>
            <ChoiceGrid
              choices={gmStyles}
              selected={gmStyle}
              onSelect={(choice) => setGmStyle(choice as GMStyle)}
            />
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("contract")}>
                Back
              </button>
              <button className="primary-action" disabled={!gmName.trim()} onClick={() => setStep("brand")}>
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "brand" ? (
          <div className="setup-panel">
            <p className="eyebrow">Choose Brand Fantasy</p>
            <h2>What Does TV Feel Like?</h2>
            <label className="setup-field">
              Brand Name
              <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
            </label>
            <ChoiceGrid
              choices={brandStyles}
              selected={brandStyle}
              onSelect={(choice) => setBrandStyle(choice as BrandStyle)}
            />
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("gm")}>
                Back
              </button>
              <button className="primary-action" disabled={!canPreview} onClick={() => setStep("preview")}>
                Preview Career
              </button>
            </div>
          </div>
        ) : null}

        {step === "preview" ? (
          <div className="setup-panel">
            <p className="eyebrow">Career Preview</p>
            <h2>{brandName.trim() || defaultCareer.brandName}</h2>
            <div className="status-grid setup-summary">
              <Metric label="GM" value={gmName.trim() || defaultCareer.gmName} detail={gmStyle} />
              <Metric label="Brand Style" value={brandStyle} />
              <Metric label="Starting Money" value={formatMoney(250000)} />
              <Metric label="Season" value="12 Weeks" detail="PLEs in Weeks 4, 8, and 12" />
            </div>
            <p className="lede">
              Week 1 opens on TV. The first PLE is Collision Course in Week 4, and ownership expects momentum before the road reaches Final Bell.
            </p>
            <div className="title-actions">
              <button className="secondary-action" onClick={() => setStep("brand")}>
                Back
              </button>
              <button className="primary-action" onClick={startCareer}>
                Start Career
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ChoiceGrid({
  choices,
  selected,
  onSelect,
}: {
  choices: string[];
  selected: string;
  onSelect: (choice: string) => void;
}) {
  return (
    <div className="choice-grid">
      {choices.map((choice) => (
        <button className={selected === choice ? "active-filter" : ""} key={choice} onClick={() => onSelect(choice)}>
          {choice}
        </button>
      ))}
    </div>
  );
}

function DashboardScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const hotTalent = useMemo(
    () => [...game.wrestlers].sort((a, b) => b.momentum + b.popularity - (a.momentum + a.popularity)).slice(0, 3),
    [game.wrestlers],
  );
  const atRisk = useMemo(
    () => [...game.wrestlers].sort((a, b) => b.fatigue + (100 - b.morale) - (a.fatigue + (100 - a.morale))).slice(0, 3),
    [game.wrestlers],
  );
  const topMomentumTalent = useMemo(
    () => [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0],
    [game.wrestlers],
  );
  const lastShow = game.showHistory[game.showHistory.length - 1];
  const validSegments = game.currentShow.filter(isValidSegment).length;
  const averageFatigue = Math.round(game.wrestlers.reduce((sum, wrestler) => sum + wrestler.fatigue, 0) / game.wrestlers.length);
  const nextAction = validSegments >= 2 ? "Run the show when the card feels right." : "Book at least 2 valid segments for this week's broadcast.";
  const topChampionship = [...game.championships].sort((a, b) => b.prestige - a.prestige)[0];
  const topTitleContenders = getTopContenders(topChampionship, game.wrestlers, 2);
  const hottestRivalry = getHottestRivalry(game.rivalries);
  const coolingRivalry = getCoolingRivalry(game.rivalries);
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const latestSocialPost = game.socialPosts[game.socialPosts.length - 1];
  const latestFinanceReport = getLatestFinanceReport(game);
  const pressureLabel = getFinancePressureLabel(game.money, latestFinanceReport?.profitLoss ?? 0);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="dashboard" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} · Week {game.currentWeek} Dashboard</p>
          <h2>{game.brandName}</h2>
          <div className="identity-strip">
            <span>GM {game.gmName}</span>
            <span>{game.gmStyle}</span>
            <span>{game.brandStyle}</span>
          </div>
          <p className="lede">
            {currentShow.showName} is a {getShowTypeLabel(currentShow.showType)} stop
            {currentShow.isGoHome ? " and the final broadcast before the next PLE." : " on the road to the next major event."}
          </p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="command-grid">
        <article className="command-panel show-panel">
          <div className="section-heading">
            <p className="eyebrow">This Week's Show</p>
            <h3>{currentShow.showName}</h3>
          </div>
          <div className="show-strip">
            <span>{getShowTypeLabel(currentShow.showType)}</span>
            {currentShow.isGoHome ? <span>Go-Home</span> : null}
            {nextPle ? <span>{weeksUntilPle === 0 ? "PLE Week" : `${weeksUntilPle} Week${weeksUntilPle === 1 ? "" : "s"} To ${nextPle.showName}`}</span> : null}
          </div>
          {game.currentShow.length ? (
            <div className="mini-card-list">
              {game.currentShow.map((segment, index) => (
                <div className="mini-card" key={segment.id}>
                  <span>
                    Segment {index + 1} · {segment.type}
                  </span>
                  <strong>
                    {getSegmentParticipants(segment, game.wrestlers)
                      .map((wrestler) => wrestler.name)
                      .join(" / ") || "No participants selected"}
                  </strong>
                  <small>{isValidSegment(segment) ? "Ready for TV" : getSegmentRequirement(segment.type)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">No card booked yet. The production board is blank.</div>
          )}
        </article>

        <article className="command-panel next-action-panel">
          <div className="section-heading">
            <p className="eyebrow">Next Action</p>
            <h3>{validSegments >= 2 ? "Card Is Runnable" : "Book The Show"}</h3>
          </div>
          <p>{nextAction}</p>
          <div className="panel-actions">
            <button className="primary-action" onClick={() => onNavigate("booking")}>
              {validSegments >= 2 ? "Review Card" : "Book Show"}
            </button>
            <button className="secondary-action" onClick={() => onNavigate("roster")}>
              View Roster
            </button>
          </div>
        </article>
      </section>

      <section className="status-grid" aria-label="Brand pulse">
        <Metric label="Money" value={formatMoney(game.money)} />
        <Metric label="Last Show" value={lastShow ? `${lastShow.totalScore} (${getShowGrade(lastShow.totalScore)})` : "No Result"} />
        <Metric label="Avg Fatigue" value={`${averageFatigue}`} detail={averageFatigue >= 45 ? "Roster needs rest" : "Manageable load"} />
        <Metric label="Top Momentum" value={`${topMomentumTalent.momentum}`} detail={topMomentumTalent.name} />
      </section>

      <section className={`command-panel finance-spotlight pressure-${pressureLabel.toLowerCase()}`}>
        <div className="section-heading">
          <p className="eyebrow">Brand Pressure</p>
          <h3>{formatPressureLabel(pressureLabel)}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Current Money" value={formatMoney(game.money)} />
          <Metric label="Latest P/L" value={latestFinanceReport ? formatMoney(latestFinanceReport.profitLoss) : "No Report"} />
          <Metric label="Latest Gate" value={latestFinanceReport ? latestFinanceReport.attendance.toLocaleString() : "No Show"} detail={latestFinanceReport?.showName} />
        </div>
        <button className="secondary-action" onClick={() => onNavigate("finance")}>
          View Finance
        </button>
      </section>

      <section className={`command-panel calendar-spotlight ${currentShow.showType === "ple" ? "ple-panel" : ""}`}>
        <div className="section-heading">
          <p className="eyebrow">Road To PLE</p>
          <h3>{nextPle ? nextPle.showName : "Season Complete"}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Current Show" value={currentShow.showName} detail={getShowTypeLabel(currentShow.showType)} />
          <Metric
            label="Next PLE"
            value={nextPle ? nextPle.showName : "None"}
            detail={nextPle ? `${weeksUntilPle} week${weeksUntilPle === 1 ? "" : "s"} away` : "Finish season review"}
          />
          <Metric label="Go-Home" value={currentShow.isGoHome ? "Tonight" : "No"} detail={currentShow.isGoHome ? "Final push before PLE" : "Build the road"} />
        </div>
        <button className="secondary-action" onClick={() => onNavigate("calendar")}>
          View Calendar
        </button>
      </section>

      <section className="command-panel championship-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Championship Spotlight</p>
          <h3>{topChampionship.name}</h3>
        </div>
        <div className="spotlight-grid">
          <Metric label="Champion" value={getWrestlerNames(topChampionship.championIds, game.wrestlers)} />
          <Metric label="Prestige" value={`${topChampionship.prestige}`} />
          <Metric label="Likely Contenders" value={topTitleContenders.map((wrestler) => wrestler.name).join(" / ")} />
        </div>
        <button className="secondary-action" onClick={() => onNavigate("championships")}>
          View Championships
        </button>
      </section>

      <section className="command-panel rivalry-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Rivalry Spotlight</p>
          <h3>{hottestRivalry ? hottestRivalry.name : "No Active Rivalries"}</h3>
        </div>
        {hottestRivalry ? (
          <div className="spotlight-grid">
            <Metric label="Heat" value={`${hottestRivalry.heat}`} detail={formatRivalryStatus(hottestRivalry.status)} />
            <Metric label="Stakes" value={formatRivalryStakes(hottestRivalry.stakes)} />
            <Metric
              label="Warning"
              value={coolingRivalry ? coolingRivalry.name : "Stories Holding"}
              detail={coolingRivalry ? formatRivalryStatus(coolingRivalry.status) : "No cooling angles"}
            />
          </div>
        ) : (
          <div className="empty-state compact">No rivalries are active. Start one to give weekly TV more story context.</div>
        )}
        <button className="secondary-action" onClick={() => onNavigate("rivalries")}>
          View Rivalries
        </button>
      </section>

      {latestSocialPost ? (
        <section className="command-panel social-spotlight">
          <div className="section-heading">
            <p className="eyebrow">IWC Buzz</p>
            <h3>{formatSocialCategory(latestSocialPost.category)}</h3>
          </div>
          <p className="social-preview-text">{latestSocialPost.text}</p>
          <div className="show-strip">
            <span>{latestSocialPost.author}</span>
            <span>{formatSocialTone(latestSocialPost.tone)}</span>
          </div>
          <button className="secondary-action" onClick={() => onNavigate("social")}>
            View Social
          </button>
        </section>
      ) : null}

      <section className="command-grid">
        <article className="command-panel">
          <div className="section-heading">
            <p className="eyebrow">Hot Talent</p>
            <h3>Who Feels Hot</h3>
          </div>
          <div className="talent-list">
            {hotTalent.map((wrestler) => (
              <div className="talent-row" key={wrestler.id}>
                <strong>{wrestler.name}</strong>
                <span>
                  Momentum {wrestler.momentum} · Popularity {wrestler.popularity}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="command-panel">
          <div className="section-heading">
            <p className="eyebrow">At Risk</p>
            <h3>Who Needs Protection</h3>
          </div>
          <div className="talent-list">
            {atRisk.map((wrestler) => (
              <div className="talent-row warning-row" key={wrestler.id}>
                <strong>{wrestler.name}</strong>
                <span>
                  Fatigue {wrestler.fatigue} · Morale {wrestler.morale}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="roster-table">
        <div className="section-heading">
          <p className="eyebrow">Brand Pulse</p>
          <h3>Locker Room Board</h3>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Pop</span>
            <span>Mom</span>
            <span>Fat</span>
            <span>Morale</span>
            <span>Ring</span>
            <span>Promo</span>
          </div>
          {game.wrestlers.map((wrestler) => (
            <div className="table-row" key={wrestler.id}>
              <strong>{wrestler.name}</strong>
              <span>{wrestler.popularity}</span>
              <span>{wrestler.momentum}</span>
              <span>{wrestler.fatigue}</span>
              <span>{wrestler.morale}</span>
              <span>{wrestler.ringSkill}</span>
              <span>{wrestler.promoSkill}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function BookingScreen({
  game,
  onAddSegment,
  onBack,
  onNavigate,
  onRemoveSegment,
  onRunShow,
  onSetSegmentChampionship,
  onSetSegmentRivalry,
  onToggleParticipant,
}: {
  game: GameState;
  onAddSegment: (type: SegmentType) => void;
  onBack: () => void;
  onNavigate: (screen: GameScreen) => void;
  onRemoveSegment: (id: string) => void;
  onRunShow: () => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentRivalry: (segmentId: string, rivalryId: string) => void;
  onToggleParticipant: (segmentId: string, wrestlerId: string) => void;
}) {
  const validSegments = game.currentShow.filter(isValidSegment).length;
  const canRunShow = validSegments >= 2;
  const calendarWeek = getCurrentCalendarWeek(game);
  const segmentLimit = getShowSegmentLimit(game);
  const bookedCounts = game.currentShow.reduce<Record<string, number>>((counts, segment) => {
    segment.participantIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, {});

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="booking" hasResults={Boolean(game.showHistory.length)} onNavigate={onNavigate} />
      <section className={`booking-top ${calendarWeek.showType === "ple" ? "ple-panel" : ""}`}>
        <button className="secondary-action" onClick={onBack}>
          Dashboard
        </button>
        <div>
          <p className="eyebrow">
            Season {game.seasonNumber} · Week {game.currentWeek} · {getShowTypeLabel(calendarWeek.showType)}
          </p>
          <h2>{calendarWeek.showName}</h2>
          <p className="lede">
            {calendarWeek.showType === "ple"
              ? "Major-event card. Six segments are available, and every title or rivalry beat lands louder."
              : calendarWeek.isGoHome
                ? "Go-home broadcast. Set the final tone before the next PLE."
                : "TV production card. Build stories and protect the locker room."}
          </p>
        </div>
        <button className="primary-action" disabled={!canRunShow} onClick={onRunShow}>
          Run Show
        </button>
      </section>

      <section className="booking-controls" aria-label="Booking controls">
        <button disabled={game.currentShow.length >= segmentLimit} onClick={() => onAddSegment("Match")}>
          Add Match
        </button>
        <button disabled={game.currentShow.length >= segmentLimit} onClick={() => onAddSegment("Promo")}>
          Add Promo
        </button>
        <button className="secondary-action" onClick={() => onNavigate("roster")}>
          View Roster
        </button>
        <button className="secondary-action" onClick={() => onNavigate("rivalries")}>
          View Rivalries
        </button>
        <span>
          {validSegments} valid · {game.currentShow.length}/{segmentLimit} segments
        </span>
      </section>

      <section className="segment-list" aria-label="Current show segments">
        {game.currentShow.length === 0 ? (
          <div className="empty-state">The rundown is empty. Add a match or promo to start building tonight's TV card.</div>
        ) : (
          game.currentShow.map((segment, index) => (
            <article className={`segment ${isValidSegment(segment) ? "valid" : ""}`} key={segment.id}>
              <div className="segment-header">
                <div>
                  <p className="eyebrow">Segment {index + 1}</p>
                  <h3>
                    {segment.type} <span>{getSegmentRuntime(segment.type)}</span>
                  </h3>
                  <p>{getSegmentRequirement(segment.type)}</p>
                </div>
                <button className="danger-action" onClick={() => onRemoveSegment(segment.id)}>
                  Remove
                </button>
              </div>

              <SegmentContext segment={segment} wrestlers={game.wrestlers} bookedCounts={bookedCounts} />
              <TitleMatchControl
                championships={game.championships}
                onSetSegmentChampionship={onSetSegmentChampionship}
                segment={segment}
                wrestlers={game.wrestlers}
              />
              <RivalryControl
                onSetSegmentRivalry={onSetSegmentRivalry}
                rivalries={game.rivalries}
                segment={segment}
              />

              <div className="participant-grid">
                {game.wrestlers.map((wrestler) => {
                  const checked = segment.participantIds.includes(wrestler.id);
                  const limit = segment.type === "Match" ? 2 : 3;
                  const disabled = !checked && segment.participantIds.length >= limit;

                  return (
                    <label className="participant-pick" key={wrestler.id}>
                      <input
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onToggleParticipant(segment.id, wrestler.id)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{wrestler.name}</strong>
                        <small>
                          Mom {wrestler.momentum} · Fat {wrestler.fatigue}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function RosterScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const [sortBy, setSortBy] = useState<RosterSort>("momentum");
  const [filter, setFilter] = useState<RosterFilter>("All");
  const visibleWrestlers = useMemo(() => {
    return [...game.wrestlers]
      .filter((wrestler) => filter === "All" || getWrestlerStatus(wrestler) === filter)
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [filter, game.wrestlers, sortBy]);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="roster" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Locker Room Report</p>
          <h2>Roster</h2>
          <p className="lede">Read the room before you commit TV time. Momentum, fatigue, and morale tell you who is ready for the push.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="roster-controls" aria-label="Roster controls">
        <div>
          <span>Sort</span>
          {(["popularity", "momentum", "fatigue", "morale"] as RosterSort[]).map((option) => (
            <button className={sortBy === option ? "active-filter" : ""} key={option} onClick={() => setSortBy(option)}>
              {option}
            </button>
          ))}
        </div>
        <div>
          <span>Filter</span>
          {(["All", "Hot", "Tired", "Frustrated"] as RosterFilter[]).map((option) => (
            <button className={filter === option ? "active-filter" : ""} key={option} onClick={() => setFilter(option)}>
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="roster-grid" aria-label="Roster list">
        {visibleWrestlers.length ? (
          visibleWrestlers.map((wrestler) => <WrestlerCard key={wrestler.id} wrestler={wrestler} />)
        ) : (
          <div className="empty-state">No wrestlers match this filter.</div>
        )}
      </section>
    </main>
  );
}

function ChampionshipsScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="championships" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Title Office</p>
          <h2>Championships</h2>
          <p className="lede">Prestige lives here. Champions anchor the brand, contenders circle, and title matches create stakes once the bell rings.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="championship-grid" aria-label="Championships">
        {game.championships.map((championship) => {
          const contenders = getTopContenders(championship, game.wrestlers);

          return (
            <article className="championship-card" key={championship.id}>
              <div className="championship-head">
                <div>
                  <p className="eyebrow">{championship.division}</p>
                  <h3>{championship.name}</h3>
                </div>
                <strong>Prestige {championship.prestige}</strong>
              </div>
              <div className="spotlight-grid">
                <Metric label="Champion" value={getWrestlerNames(championship.championIds, game.wrestlers)} />
                <Metric label="Reign" value={`${getReignLength(championship, game.currentWeek)} Week${getReignLength(championship, game.currentWeek) === 1 ? "" : "s"}`} />
                <Metric label="Defenses" value={`${championship.defenses}`} />
              </div>
              <div className="contender-strip">
                <span>Top Contenders</span>
                <strong>{contenders.map((wrestler) => wrestler.name).join(" / ")}</strong>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function RivalriesScreen({
  game,
  latestResult,
  onCreateRivalry,
  onEndRivalry,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onCreateRivalry: (wrestlerAId: string, wrestlerBId: string, stakes: RivalryStakes) => void;
  onEndRivalry: (rivalryId: string) => void;
  onNavigate: (screen: GameScreen) => void;
}) {
  const [wrestlerAId, setWrestlerAId] = useState(game.wrestlers[0]?.id ?? "");
  const [wrestlerBId, setWrestlerBId] = useState(game.wrestlers[1]?.id ?? "");
  const [stakes, setStakes] = useState<RivalryStakes>("personal");
  const isDuplicate = hasDuplicateRivalry(game.rivalries, wrestlerAId, wrestlerBId);
  const canCreate = wrestlerAId && wrestlerBId && wrestlerAId !== wrestlerBId && !isDuplicate;

  function handleCreateRivalry() {
    if (!canCreate) {
      return;
    }

    onCreateRivalry(wrestlerAId, wrestlerBId, stakes);
  }

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="rivalries" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Story Room</p>
          <h2>Rivalries</h2>
          <p className="lede">Track the stories giving TV some bite. Hot angles deserve time, cooling angles need care, and stale ones need a clean exit.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="rivalry-form" aria-label="Create rivalry">
        <div className="section-heading">
          <p className="eyebrow">Start Rivalry</p>
          <h3>Book The Spark</h3>
        </div>
        <label>
          Wrestler A
          <select value={wrestlerAId} onChange={(event) => setWrestlerAId(event.target.value)}>
            {game.wrestlers.map((wrestler) => (
              <option key={wrestler.id} value={wrestler.id}>
                {wrestler.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Wrestler B
          <select value={wrestlerBId} onChange={(event) => setWrestlerBId(event.target.value)}>
            {game.wrestlers.map((wrestler) => (
              <option key={wrestler.id} value={wrestler.id}>
                {wrestler.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stakes
          <select value={stakes} onChange={(event) => setStakes(event.target.value as RivalryStakes)}>
            {(["personal", "title", "respect", "revenge"] as RivalryStakes[]).map((option) => (
              <option key={option} value={option}>
                {formatRivalryStakes(option)}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action" disabled={!canCreate} onClick={handleCreateRivalry}>
          Create Rivalry
        </button>
        {isDuplicate ? <p className="form-warning">Duplicate active rivalry already exists.</p> : null}
      </section>

      <section className="rivalry-grid" aria-label="Active rivalries">
        {game.rivalries.length ? (
          game.rivalries.map((rivalry) => (
            <article className={`rivalry-card status-${rivalry.status}`} key={rivalry.id}>
              <div className="rivalry-head">
                <div>
                  <p className="eyebrow">{formatRivalryStakes(rivalry.stakes)} Stakes</p>
                  <h3>{rivalry.name}</h3>
                </div>
                <strong>{formatRivalryStatus(rivalry.status)}</strong>
              </div>
              <div className="spotlight-grid">
                <Metric label="Participants" value={getRivalryParticipants(rivalry, game.wrestlers).map((wrestler) => wrestler.name).join(" / ")} />
                <Metric label="Heat" value={`${rivalry.heat}`} />
                <Metric label="Freshness" value={`${rivalry.freshness}`} />
                <Metric label="Weeks Active" value={`${rivalry.weeksActive}`} />
                <Metric label="Last Advanced" value={rivalry.lastAdvancedWeek ? `Week ${rivalry.lastAdvancedWeek}` : "Not On TV Yet"} />
                <Metric label="Stakes" value={formatRivalryStakes(rivalry.stakes)} />
              </div>
              <button className="danger-action" onClick={() => onEndRivalry(rivalry.id)}>
                End Rivalry
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">No rivalries are active. Start a two-wrestler story to give the next broadcast more context.</div>
        )}
      </section>
    </main>
  );
}

function CalendarScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const currentShow = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);

  function getWeekResult(week: CalendarWeek) {
    return game.showHistory.find(
      (result) =>
        result.id === week.resultId ||
        (result.seasonNumber === game.seasonNumber && result.week === week.weekNumber && result.showName === week.showName),
    );
  }

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="calendar" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} Calendar</p>
          <h2>Road To PLE</h2>
          <p className="lede">
            Week {game.currentWeek} is {currentShow.showName}.{" "}
            {nextPle
              ? `${nextPle.showName} is ${weeksUntilPle === 0 ? "tonight" : `${weeksUntilPle} week${weeksUntilPle === 1 ? "" : "s"} away`}.`
              : "The season calendar is complete."}
          </p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="calendar-list" aria-label="Season calendar">
        {game.calendar.map((week) => {
          const result = getWeekResult(week);
          const isCurrent = week.weekNumber === game.currentWeek && !week.completed;
          const status = week.completed ? "Completed" : isCurrent ? "Current" : "Upcoming";

          return (
            <article className={`calendar-week ${week.showType} ${isCurrent ? "current" : ""} ${week.completed ? "completed" : ""}`} key={week.weekNumber}>
              <div>
                <p className="eyebrow">
                  Week {week.weekNumber} · {status}
                </p>
                <h3>{week.showName}</h3>
                <div className="show-strip">
                  <span>{getShowTypeLabel(week.showType)}</span>
                  {week.isGoHome ? <span>Go-Home</span> : null}
                  {week.weekNumber === 12 ? <span>Season Finale</span> : null}
                </div>
              </div>
              <div className="calendar-result">
                {result ? (
                  <>
                    <strong>{result.totalScore}</strong>
                    <span>Grade {getShowGrade(result.totalScore)}</span>
                  </>
                ) : (
                  <>
                    <strong>{week.completed ? "No Result" : "On Deck"}</strong>
                    <span>{week.showType === "ple" ? "Major event" : "Weekly TV"}</span>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function SocialScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const [filter, setFilter] = useState<SocialFilter>("All");
  const categories = getSocialFilterCategory(filter);
  const visiblePosts = [...game.socialPosts]
    .reverse()
    .filter((post) => !categories || categories.includes(post.category));

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="social" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Post-Show Pulse</p>
          <h2>Social / IWC</h2>
          <p className="lede">The feed only reacts to shows that actually happened: scores, title fallout, rivalry movement, fatigue, and major-event moments.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="roster-controls" aria-label="Social filters">
        <div>
          <span>Filter</span>
          {(["All", "Fan Reaction", "Dirt Sheets", "Analyst Takes", "Title Scene", "Rivalries"] as SocialFilter[]).map((option) => (
            <button className={filter === option ? "active-filter" : ""} key={option} onClick={() => setFilter(option)}>
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="social-feed" aria-label="Social posts">
        {visiblePosts.length ? (
          visiblePosts.map((post) => (
            <article className={`social-post tone-${post.tone}`} key={post.id}>
              <div className="social-post-head">
                <div>
                  <p className="eyebrow">
                    Season {post.seasonNumber} · Week {post.weekNumber} · {post.showName}
                  </p>
                  <h3>{post.author}</h3>
                </div>
                <div className="show-strip">
                  <span>{formatSocialCategory(post.category)}</span>
                  <span>{formatSocialTone(post.tone)}</span>
                </div>
              </div>
              <p>{post.text}</p>
              {post.relatedWrestlerIds.length ? (
                <small>Related: {getRelatedWrestlerNames(post, game.wrestlers)}</small>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            {game.socialPosts.length ? "No posts match this filter." : "The internet has nothing to react to yet. Run a show and the buzz will arrive after the results."}
          </div>
        )}
      </section>
    </main>
  );
}

function FinanceScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const latestReport = getLatestFinanceReport(game);
  const seasonReports = getSeasonFinanceReports(game);
  const totalProfitLoss = seasonReports.reduce((sum, report) => sum + report.profitLoss, 0);
  const bestRevenueReport = getBestRevenueReport(seasonReports);
  const worstProfitReport = getWorstProfitReport(seasonReports);
  const pressureLabel = getFinancePressureLabel(game.money, latestReport?.profitLoss ?? 0);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="finance" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Brand Office</p>
          <h2>Finance</h2>
          <p className="lede">Cash pressure, weekly business, and show fallout. No forecasts here, just what the last broadcast actually did.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="status-grid" aria-label="Finance summary">
        <Metric label="Current Money" value={formatMoney(game.money)} />
        <Metric label="Pressure" value={pressureLabel} />
        <Metric label="Season P/L" value={formatMoney(totalProfitLoss)} />
        <Metric label="Reports" value={`${game.financeReports.length}`} />
      </section>

      {latestReport ? (
        <section className="finance-report-card">
          <div className="section-heading">
            <p className="eyebrow">
              Latest Report · {getShowTypeLabel(latestReport.showType)}
            </p>
            <h3>{latestReport.showName}</h3>
          </div>
          <div className="spotlight-grid">
            <Metric label="Attendance" value={latestReport.attendance.toLocaleString()} />
            <Metric label="Revenue" value={formatMoney(latestReport.ticketRevenue + latestReport.merchRevenue + latestReport.mediaRevenue)} />
            <Metric label="Costs" value={formatMoney(latestReport.talentCost + latestReport.productionCost)} />
            <Metric label="Profit/Loss" value={formatMoney(latestReport.profitLoss)} />
            <Metric label="Ending Money" value={formatMoney(latestReport.endingMoney)} />
            <Metric label="Show Score" value={`${latestReport.showScore}`} />
          </div>
          <div className="finance-notes">
            {latestReport.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </section>
      ) : (
        <div className="empty-state">No finance reports yet. Run a show and the brand office will close the books after results.</div>
      )}

      {seasonReports.length ? (
        <section className="command-grid">
          <article className="command-panel">
            <div className="section-heading">
              <p className="eyebrow">Best Revenue Week</p>
              <h3>{bestRevenueReport?.showName ?? "None"}</h3>
            </div>
            <p className="social-preview-text">
              {bestRevenueReport
                ? `${formatMoney(bestRevenueReport.ticketRevenue + bestRevenueReport.merchRevenue + bestRevenueReport.mediaRevenue)} revenue in Week ${bestRevenueReport.weekNumber}.`
                : "No revenue booked yet."}
            </p>
          </article>
          <article className="command-panel">
            <div className="section-heading">
              <p className="eyebrow">Worst Profit/Loss</p>
              <h3>{worstProfitReport?.showName ?? "None"}</h3>
            </div>
            <p className="social-preview-text">
              {worstProfitReport ? `${formatMoney(worstProfitReport.profitLoss)} in Week ${worstProfitReport.weekNumber}.` : "No report yet."}
            </p>
          </article>
        </section>
      ) : null}

      <section className="finance-history" aria-label="Finance history">
        {game.financeReports.length ? (
          [...game.financeReports].reverse().map((report) => (
            <article className="finance-history-row" key={report.id}>
              <div>
                <p className="eyebrow">
                  Season {report.seasonNumber} · Week {report.weekNumber} · {getShowTypeLabel(report.showType)}
                </p>
                <h3>{report.showName}</h3>
              </div>
              <div className="finance-row-numbers">
                <span>Attendance {report.attendance.toLocaleString()}</span>
                <strong>{formatMoney(report.profitLoss)}</strong>
              </div>
            </article>
          ))
        ) : null}
      </section>
    </main>
  );
}

function ResultsScreen({
  game,
  result,
  onAdvanceWeek,
  onNavigate,
}: {
  game: GameState;
  result: ShowResult;
  onAdvanceWeek: () => void;
  onNavigate: (screen: GameScreen) => void;
}) {
  const bestSegment = getBestSegment(result);
  const buzzPreview = game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week).slice(-3).reverse();
  const financeReport = getFinanceReportForResult(game, result);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="results" hasResults onNavigate={onNavigate} />
      <section className="results-hero">
        <div>
          <p className="eyebrow">
            Season {result.seasonNumber} · Week {result.week} · {getShowTypeLabel(result.showType)}
          </p>
          <h2>
            {result.totalScore} <span>{getShowGrade(result.totalScore)}</span>
          </h2>
          <p className="lede">{buildBroadcastRecap(result)}</p>
        </div>
        <button className="primary-action" onClick={onAdvanceWeek}>
          {result.week >= 12 ? "Season Review" : "Advance Week"}
        </button>
      </section>

      <section className="status-grid" aria-label="Show highlights">
        <Metric label="Show Score" value={`${result.totalScore}`} detail={`Grade ${getShowGrade(result.totalScore)}`} />
        <Metric label="Best Segment" value={`${bestSegment.score}`} detail={bestSegment.participantNames.join(" / ")} />
        <Metric label="Momentum Gain" value={result.biggestMomentumGain.name} detail={`+${result.biggestMomentumGain.amount}`} />
        <Metric label="Fatigue Hit" value={result.biggestFatigueIncrease.name} detail={`+${result.biggestFatigueIncrease.amount}`} />
      </section>

      {result.titleNotes?.length ? (
        <section className="title-fallout" aria-label="Title fallout">
          <div className="section-heading">
            <p className="eyebrow">Title Fallout</p>
            <h3>Championship Stakes</h3>
          </div>
          {result.titleNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      ) : null}

      {result.rivalryNotes?.length ? (
        <section className="story-fallout" aria-label="Rivalry fallout">
          <div className="section-heading">
            <p className="eyebrow">Story Fallout</p>
            <h3>Rivalry Movement</h3>
          </div>
          {result.rivalryNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      ) : null}

      {buzzPreview.length ? (
        <section className="social-buzz" aria-label="IWC buzz preview">
          <div className="section-heading">
            <p className="eyebrow">IWC Buzz</p>
            <h3>Post-Show Reaction</h3>
          </div>
          <div className="social-preview-grid">
            {buzzPreview.map((post) => (
              <article className="social-preview" key={post.id}>
                <span>{formatSocialCategory(post.category)}</span>
                <strong>{post.author}</strong>
                <p>{post.text}</p>
              </article>
            ))}
          </div>
          <button className="secondary-action" onClick={() => onNavigate("social")}>
            View Social
          </button>
        </section>
      ) : null}

      {financeReport ? (
        <section className="finance-fallout" aria-label="Financial fallout">
          <div className="section-heading">
            <p className="eyebrow">Financial Fallout</p>
            <h3>Brand Office Close</h3>
          </div>
          <div className="spotlight-grid">
            <Metric label="Attendance" value={financeReport.attendance.toLocaleString()} />
            <Metric label="Revenue" value={formatMoney(financeReport.ticketRevenue + financeReport.merchRevenue + financeReport.mediaRevenue)} />
            <Metric label="Costs" value={formatMoney(financeReport.talentCost + financeReport.productionCost)} />
            <Metric label="Profit/Loss" value={formatMoney(financeReport.profitLoss)} />
            <Metric label="Ending Money" value={formatMoney(financeReport.endingMoney)} />
            <Metric label="Pressure" value={getFinancePressureLabel(financeReport.endingMoney, financeReport.profitLoss)} />
          </div>
        </section>
      ) : null}

      <section className="results-list" aria-label="Segment results">
        <div className="section-heading">
          <p className="eyebrow">Broadcast Breakdown</p>
          <h3>Segment By Segment</h3>
        </div>
        {result.segmentResults.map((segment, index) => (
          <article className="result-row" key={segment.segmentId}>
            <div>
              <p className="eyebrow">
                Segment {index + 1} · {segment.type}
              </p>
              <h3>{segment.participantNames.join(" / ")}</h3>
              <p>
                Momentum +{getResultChange(segment.momentumChanges)} · Fatigue +{getResultChange(segment.fatigueChanges)}
              </p>
              {segment.titleNote ? <p className="title-note">{segment.titleNote}</p> : null}
              {segment.rivalryNote ? <p className="rivalry-note">{segment.rivalryNote}</p> : null}
            </div>
            <strong>{segment.score}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}

function SeasonReviewScreen({
  game,
  onStartNextSeason,
}: {
  game: GameState;
  onStartNextSeason: () => void;
}) {
  const bestShow = getBestShow(game.showHistory, game.seasonNumber);
  const topMomentum = [...game.wrestlers].sort((a, b) => b.momentum - a.momentum)[0];
  const mostFatigued = [...game.wrestlers].sort((a, b) => b.fatigue - a.fatigue)[0];
  const hottestRivalry = getHottestRivalry(game.rivalries);
  const seasonReports = getSeasonFinanceReports(game);
  const seasonProfitLoss = game.money - game.seasonStartingMoney;
  const bestRevenueReport = getBestRevenueReport(seasonReports);
  const worstProfitReport = getWorstProfitReport(seasonReports);

  return (
    <main className="app-shell">
      <Header game={game} />
      <section className="results-hero season-review-hero">
        <div>
          <p className="eyebrow">Season {game.seasonNumber} Review</p>
          <h2>Final Bell</h2>
          <p className="lede">The 12-week road is complete. The roster, titles, rivalries, money, and histories carry forward into the next season.</p>
        </div>
        <button className="primary-action" onClick={onStartNextSeason}>
          Start Next Season
        </button>
      </section>

      <section className="status-grid" aria-label="Season review">
        <Metric label="Starting Money" value={formatMoney(game.seasonStartingMoney)} />
        <Metric label="Final Money" value={formatMoney(game.money)} />
        <Metric label="Season P/L" value={formatMoney(seasonProfitLoss)} />
        <Metric label="Best Show" value={bestShow ? bestShow.showName : "No Shows"} detail={bestShow ? `${bestShow.totalScore} (${getShowGrade(bestShow.totalScore)})` : undefined} />
      </section>

      <section className="status-grid" aria-label="Season roster review">
        <Metric label="Top Momentum" value={topMomentum.name} detail={`${topMomentum.momentum}`} />
        <Metric label="Most Fatigued" value={mostFatigued.name} detail={`${mostFatigued.fatigue}`} />
        <Metric
          label="Best Revenue"
          value={bestRevenueReport ? bestRevenueReport.showName : "No Report"}
          detail={bestRevenueReport ? formatMoney(bestRevenueReport.ticketRevenue + bestRevenueReport.merchRevenue + bestRevenueReport.mediaRevenue) : undefined}
        />
        <Metric label="Worst P/L" value={worstProfitReport ? worstProfitReport.showName : "No Report"} detail={worstProfitReport ? formatMoney(worstProfitReport.profitLoss) : undefined} />
      </section>

      <section className="command-panel rivalry-spotlight">
        <div className="section-heading">
          <p className="eyebrow">Hottest Rivalry</p>
          <h3>{hottestRivalry ? hottestRivalry.name : "No Active Rivalries"}</h3>
        </div>
        {hottestRivalry ? (
          <div className="spotlight-grid">
            <Metric label="Heat" value={`${hottestRivalry.heat}`} />
            <Metric label="Freshness" value={`${hottestRivalry.freshness}`} />
            <Metric label="Status" value={formatRivalryStatus(hottestRivalry.status)} />
          </div>
        ) : null}
      </section>

      <section className="championship-grid" aria-label="Current champions">
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

function WrestlerCard({ wrestler }: { wrestler: Wrestler }) {
  const status = getWrestlerStatus(wrestler);

  return (
    <article className={`wrestler-card status-${status.toLowerCase()}`}>
      <div className="wrestler-card-head">
        <div>
          <p className="eyebrow">Talent File</p>
          <h3>{wrestler.name}</h3>
        </div>
        <strong>{status}</strong>
      </div>
      <div className="wrestler-stats">
        <Metric label="Popularity" value={`${wrestler.popularity}`} />
        <Metric label="Momentum" value={`${wrestler.momentum}`} />
        <Metric label="Fatigue" value={`${wrestler.fatigue}`} />
        <Metric label="Morale" value={`${wrestler.morale}`} />
        <Metric label="Ring" value={`${wrestler.ringSkill}`} />
        <Metric label="Promo" value={`${wrestler.promoSkill}`} />
      </div>
    </article>
  );
}

function TitleMatchControl({
  championships,
  onSetSegmentChampionship,
  segment,
  wrestlers,
}: {
  championships: Championship[];
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  if (segment.type !== "Match") {
    return null;
  }

  const eligibleChampionships = championships.filter((championship) => canSegmentContestChampionship(segment, championship));
  const selectedChampionship = championships.find((championship) => championship.id === segment.championshipId);

  return (
    <div className="title-match-control">
      <div>
        <span>Title Context</span>
        <strong>
          {selectedChampionship
            ? `${selectedChampionship.name} at stake. Champion: ${getWrestlerNames(selectedChampionship.championIds, wrestlers)}.`
            : eligibleChampionships.length
              ? "This match can be sanctioned for a singles championship."
              : "Singles title option opens when a match includes a current singles champion."}
        </strong>
      </div>
      {eligibleChampionships.length ? (
        <div className="title-buttons">
          <button className={!segment.championshipId ? "active-filter" : ""} onClick={() => onSetSegmentChampionship(segment.id, "")}>
            Non-Title
          </button>
          {eligibleChampionships.map((championship) => (
            <button
              className={segment.championshipId === championship.id ? "active-filter" : ""}
              key={championship.id}
              onClick={() => onSetSegmentChampionship(segment.id, championship.id)}
            >
              {championship.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RivalryControl({
  onSetSegmentRivalry,
  rivalries,
  segment,
}: {
  onSetSegmentRivalry: (segmentId: string, rivalryId: string) => void;
  rivalries: Rivalry[];
  segment: Segment;
}) {
  const eligibleRivalries = rivalries.filter((rivalry) => canSegmentAttachRivalry(segment, rivalry));
  const selectedRivalry = rivalries.find((rivalry) => rivalry.id === segment.rivalryId);

  return (
    <div className="rivalry-control">
      <div>
        <span>Rivalry Context</span>
        <strong>
          {selectedRivalry
            ? `${selectedRivalry.name} attached. Heat ${selectedRivalry.heat}, ${formatRivalryStatus(selectedRivalry.status)}.`
            : eligibleRivalries.length
              ? "Attach an active rivalry when this segment advances a story."
              : "Select a rivalry participant to attach story context."}
        </strong>
      </div>
      {eligibleRivalries.length ? (
        <div className="title-buttons">
          <button className={!segment.rivalryId ? "active-filter" : ""} onClick={() => onSetSegmentRivalry(segment.id, "")}>
            No Rivalry
          </button>
          {eligibleRivalries.map((rivalry) => (
            <button
              className={segment.rivalryId === rivalry.id ? "active-filter" : ""}
              key={rivalry.id}
              onClick={() => onSetSegmentRivalry(segment.id, rivalry.id)}
            >
              {rivalry.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GameNav({
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
        Dashboard
      </button>
      <button className={currentScreen === "booking" ? "active-filter" : ""} onClick={() => onNavigate("booking")}>
        Booking
      </button>
      <button className={currentScreen === "roster" ? "active-filter" : ""} onClick={() => onNavigate("roster")}>
        Roster
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
    </nav>
  );
}

function SegmentContext({
  bookedCounts,
  segment,
  wrestlers,
}: {
  bookedCounts: Record<string, number>;
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  const participants = getSegmentParticipants(segment, wrestlers);
  const warnings = participants.flatMap((wrestler) => {
    const wrestlerWarnings: string[] = [];

    if (wrestler.fatigue >= 60) {
      wrestlerWarnings.push(`${wrestler.name} is carrying heavy fatigue.`);
    }

    if (wrestler.morale <= 45) {
      wrestlerWarnings.push(`${wrestler.name} has low morale.`);
    }

    if ((bookedCounts[wrestler.id] ?? 0) > 1) {
      wrestlerWarnings.push(`${wrestler.name} is already booked elsewhere on this card.`);
    }

    return wrestlerWarnings;
  });

  if (!isValidSegment(segment)) {
    warnings.unshift("Segment is incomplete.");
  }

  return (
    <div className="segment-context">
      <div>
        <span>Selected</span>
        <strong>{participants.map((wrestler) => wrestler.name).join(" / ") || "No participants selected"}</strong>
      </div>
      <div>
        <span>Production Note</span>
        <strong>{warnings.length ? warnings[0] : "Ready for the rundown."}</strong>
      </div>
      {warnings.length > 1 ? (
        <ul>
          {warnings.slice(1).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Header({ game }: { game: GameState }) {
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

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export default App;
