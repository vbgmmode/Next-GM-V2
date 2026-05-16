import { useMemo, useState } from "react";
import { clearGameState, loadGameState, saveGameState } from "./gameStorage";
import { advanceGameWeek } from "./game/advanceWeek";
import { createDefaultChampionships, createNewGame } from "./game/seed";
import { getBestSegment, getResultChange, getShowGrade, isValidSegment, runShow } from "./game/scoring";
import type { Championship, GameState, Screen, Segment, SegmentType, ShowResult, Wrestler } from "./game/types";

type SavedGameState = {
  game: GameState;
  screen: Exclude<Screen, "title">;
};

type RosterSort = "popularity" | "momentum" | "fatigue" | "morale";
type RosterFilter = "All" | "Hot" | "Tired" | "Frustrated";

function getSegmentRuntime(type: SegmentType) {
  return type === "Match" ? "12 min TV time" : "6 min TV time";
}

function getSegmentRequirement(type: SegmentType) {
  return type === "Match" ? "Needs exactly 2 wrestlers" : "Needs 1 to 3 wrestlers";
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

function buildBroadcastRecap(result: ShowResult) {
  const bestSegment = getBestSegment(result);
  const bestNames = bestSegment.participantNames.join(" / ");
  const titleFallout = result.titleNotes?.length ? ` Title fallout: ${result.titleNotes.join(" ")}` : "";

  return `${result.brandName} posted a ${result.totalScore} (${getShowGrade(result.totalScore)}) in Week ${result.week}, with ${bestNames} delivering the strongest ${bestSegment.type.toLowerCase()} of the night at ${bestSegment.score}. ${result.biggestMomentumGain.name} gained the most momentum, while ${result.biggestFatigueIncrease.name} took the biggest fatigue hit.${titleFallout}`;
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

    const newGame = createNewGame();
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

  function navigateTo(nextScreen: Exclude<Screen, "title">) {
    if (!game) {
      return;
    }

    saveSnapshot(game, nextScreen);
    setSavedGame({ game, screen: nextScreen });
    setScreen(nextScreen);
  }

  function addSegment(type: SegmentType) {
    setGame((current) => {
      if (!current || current.currentShow.length >= 4) {
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

          const updatedSegment = { ...segment, participantIds };
          const championship = updatedSegment.championshipId
            ? current.championships.find((title) => title.id === updatedSegment.championshipId)
            : undefined;

          if (championship && !canSegmentContestChampionship(updatedSegment, championship)) {
            return { ...updatedSegment, championshipId: undefined };
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

      saveSnapshot(updatedGame, "dashboard");
      setSavedGame({ game: updatedGame, screen: "dashboard" });
      return updatedGame;
    });
    setScreen("dashboard");
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

  if (screen === "results" && latestResult) {
    return <ResultsScreen game={game} result={latestResult} onAdvanceWeek={advanceWeek} onNavigate={navigateTo} />;
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

function DashboardScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: Exclude<Screen, "title">) => void;
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

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="dashboard" hasResults={Boolean(latestResult)} onNavigate={onNavigate} />
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Week {game.currentWeek} Dashboard</p>
          <h2>{game.brandName}</h2>
          <p className="lede">The truck is live, the locker room is waiting, and tonight needs a card.</p>
        </div>
        <button className="primary-action" onClick={() => onNavigate("booking")}>
          Book Show
        </button>
      </section>

      <section className="command-grid">
        <article className="command-panel show-panel">
          <div className="section-heading">
            <p className="eyebrow">This Week's Show</p>
            <h3>Week {game.currentWeek} Broadcast Card</h3>
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
        <Metric label="Money" value={`$${game.money.toLocaleString()}`} />
        <Metric label="Last Show" value={lastShow ? `${lastShow.totalScore} (${getShowGrade(lastShow.totalScore)})` : "No Result"} />
        <Metric label="Avg Fatigue" value={`${averageFatigue}`} detail={averageFatigue >= 45 ? "Roster needs rest" : "Manageable load"} />
        <Metric label="Top Momentum" value={`${topMomentumTalent.momentum}`} detail={topMomentumTalent.name} />
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
  onToggleParticipant,
}: {
  game: GameState;
  onAddSegment: (type: SegmentType) => void;
  onBack: () => void;
  onNavigate: (screen: Exclude<Screen, "title">) => void;
  onRemoveSegment: (id: string) => void;
  onRunShow: () => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onToggleParticipant: (segmentId: string, wrestlerId: string) => void;
}) {
  const validSegments = game.currentShow.filter(isValidSegment).length;
  const canRunShow = validSegments >= 2;
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
      <section className="booking-top">
        <button className="secondary-action" onClick={onBack}>
          Dashboard
        </button>
        <div>
          <p className="eyebrow">Week {game.currentWeek}</p>
          <h2>Book Show</h2>
        </div>
        <button className="primary-action" disabled={!canRunShow} onClick={onRunShow}>
          Run Show
        </button>
      </section>

      <section className="booking-controls" aria-label="Booking controls">
        <button disabled={game.currentShow.length >= 4} onClick={() => onAddSegment("Match")}>
          Add Match
        </button>
        <button disabled={game.currentShow.length >= 4} onClick={() => onAddSegment("Promo")}>
          Add Promo
        </button>
        <button className="secondary-action" onClick={() => onNavigate("roster")}>
          View Roster
        </button>
        <span>{validSegments} valid segments</span>
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
  onNavigate: (screen: Exclude<Screen, "title">) => void;
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
  onNavigate: (screen: Exclude<Screen, "title">) => void;
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

function ResultsScreen({
  game,
  result,
  onAdvanceWeek,
  onNavigate,
}: {
  game: GameState;
  result: ShowResult;
  onAdvanceWeek: () => void;
  onNavigate: (screen: Exclude<Screen, "title">) => void;
}) {
  const bestSegment = getBestSegment(result);

  return (
    <main className="app-shell">
      <Header game={game} />
      <GameNav currentScreen="results" hasResults onNavigate={onNavigate} />
      <section className="results-hero">
        <div>
          <p className="eyebrow">Week {result.week} Results</p>
          <h2>
            {result.totalScore} <span>{getShowGrade(result.totalScore)}</span>
          </h2>
          <p className="lede">{buildBroadcastRecap(result)}</p>
        </div>
        <button className="primary-action" onClick={onAdvanceWeek}>
          Advance Week
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
            </div>
            <strong>{segment.score}</strong>
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

function GameNav({
  currentScreen,
  hasResults,
  onNavigate,
}: {
  currentScreen: Exclude<Screen, "title">;
  hasResults: boolean;
  onNavigate: (screen: Exclude<Screen, "title">) => void;
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
      <span>{game.brandName}</span>
      <span>Week {game.currentWeek}</span>
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
