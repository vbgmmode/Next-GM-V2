import { Suspense, lazy, useMemo, useState } from "react";
import {
  MAX_SAVE_SLOTS,
  deleteSaveRecord,
  loadSaveSummaries,
  renameSaveRecord,
  type StoredSaveSummary,
} from "./gameStorage";
import type { AppBootRequest } from "./appBoot";
import type { GameScreen } from "./game/migration";

const GameApp = lazy(() => import("./GameApp"));

type TitleMode = "home" | "load";

type CareerPreview = {
  brandName: string;
  gmName: string;
  money: number;
  screen: GameScreen;
  seasonNumber: number;
  week: number;
};

type CareerSave = {
  id: string;
  name: string;
  createdAt: string;
  lastPlayedAt: string;
  preview: CareerPreview;
};

function isGameScreenPreview(value: string): value is GameScreen {
  return (
    value === "dashboard" ||
    value === "booking" ||
    value === "roster" ||
    value === "market" ||
    value === "profile" ||
    value === "championships" ||
    value === "rivalries" ||
    value === "calendar" ||
    value === "social" ||
    value === "finance" ||
    value === "results" ||
    value === "weekReview" ||
    value === "seasonReview" ||
    value === "offseasonDraft"
  );
}

function normalizeCareerSummary(summary: StoredSaveSummary): CareerSave {
  return {
    id: summary.id,
    name: summary.name,
    createdAt: summary.createdAt,
    lastPlayedAt: summary.lastPlayedAt,
    preview: {
      brandName: summary.preview.brandName,
      gmName: summary.preview.gmName,
      money: summary.preview.money,
      screen: isGameScreenPreview(summary.preview.screen) ? summary.preview.screen : "dashboard",
      seasonNumber: summary.preview.seasonNumber,
      week: summary.preview.week,
    },
  };
}

function loadCareerSaves() {
  return loadSaveSummaries().map(normalizeCareerSummary);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
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

function formatLocationLabel(screen: GameScreen) {
  const labels: Record<GameScreen, string> = {
    booking: "Booking Desk",
    calendar: "Calendar",
    championships: "Title Office",
    dashboard: "Brand HQ",
    finance: "Finance & Pressure",
    market: "Market Desk",
    profile: "Talent Profile",
    results: "Show Recap",
    rivalries: "Rivalry Desk",
    roster: "Locker Room",
    seasonReview: "Season Review",
    offseasonDraft: "Offseason Draft",
    social: "IWC Pulse",
    weekReview: "Week Review",
  };

  return labels[screen];
}

function getMostRecentCareer(careerSaves: CareerSave[]) {
  return careerSaves[0] ?? null;
}

function isDevMatchSimulationLabRequested() {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

  if (!env?.DEV) {
    return false;
  }

  return new URLSearchParams(window.location.search).get("dev") === "match-simulation-lab";
}

function isGameQaHarnessRequested() {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

  if (!env?.DEV) {
    return false;
  }

  const mode = new URLSearchParams(window.location.search).get("qa");
  return mode === "runtime" || mode === "legacy-runtime" || mode === "title-defense-runtime" || mode === "title-change-runtime";
}

function LoadingGameShell() {
  return (
    <main className="title-screen">
      <div className="title-shell">
        <section className="title-copy" aria-label="Loading Next GM">
          <p className="eyebrow">Offline GM Command Center</p>
          <h1>Next GM</h1>
          <p className="lede">Loading the brand desk.</p>
        </section>
      </div>
    </main>
  );
}

function CareerSaveSummary({ careerSave }: { careerSave: CareerSave }) {
  const preview = careerSave.preview;

  return (
    <div className="save-summary-grid">
      <Metric label="Brand" value={preview.brandName} />
      <Metric label="GM" value={preview.gmName} />
      <Metric label="Season / Week" value={`S${preview.seasonNumber} / W${preview.week}`} />
      <Metric label="Money" value={formatMoney(preview.money)} />
      <Metric label="Location" value={formatLocationLabel(preview.screen)} />
      <Metric label="Last Played" value={formatDateTime(careerSave.lastPlayedAt)} />
    </div>
  );
}

function CareerSaveCard({
  careerSave,
  onDeleteCareer,
  onLoadCareer,
  onRenameCareer,
}: {
  careerSave: CareerSave;
  onDeleteCareer: (careerSave: CareerSave) => void;
  onLoadCareer: (careerSave: CareerSave) => void;
  onRenameCareer: (careerSave: CareerSave) => void;
}) {
  return (
    <article className="save-card">
      <div className="save-card-top">
        <div>
          <p className="eyebrow">{formatLocationLabel(careerSave.preview.screen)}</p>
          <h3>{careerSave.name}</h3>
        </div>
        <span>W{careerSave.preview.week}</span>
      </div>
      <CareerSaveSummary careerSave={careerSave} />
      <div className="save-card-actions">
        <button className="primary-action" onClick={() => onLoadCareer(careerSave)}>
          Load
        </button>
        <button className="secondary-action" onClick={() => onRenameCareer(careerSave)}>
          Rename
        </button>
        <button className="danger-action" onClick={() => onDeleteCareer(careerSave)}>
          Delete
        </button>
      </div>
    </article>
  );
}

function TitleScreen({
  careerSaves,
  recentCareer,
  titleMode,
  onContinue,
  onDeleteCareer,
  onLoadCareer,
  onRenameCareer,
  onSetTitleMode,
  onStart,
}: {
  careerSaves: CareerSave[];
  recentCareer: CareerSave | null;
  titleMode: TitleMode;
  onContinue: () => void;
  onDeleteCareer: (careerSave: CareerSave) => void;
  onLoadCareer: (careerSave: CareerSave) => void;
  onRenameCareer: (careerSave: CareerSave) => void;
  onSetTitleMode: (mode: TitleMode) => void;
  onStart: () => void;
}) {
  const hasSaves = careerSaves.length > 0;
  const isAtSaveLimit = careerSaves.length >= MAX_SAVE_SLOTS;

  return (
    <main className="title-screen">
      <div className="title-shell">
        <section className="title-copy" aria-label="Next GM command center">
          <p className="eyebrow">Offline GM Command Center</p>
          <h1>Next GM</h1>
          <p className="lede">Enter the brand headquarters, book the card, run the show, and carry the locker room fallout into next week.</p>
          <div className="title-command-strip" aria-label="Career save status">
            <span>{careerSaves.length}/{MAX_SAVE_SLOTS} Careers</span>
            <span>Offline Career Mode</span>
            <span>Local Save Deck</span>
          </div>
          <div className="title-actions">
            {hasSaves ? (
              <button className="primary-action" onClick={onContinue}>
                Continue Career
              </button>
            ) : null}
            <button className="primary-action" disabled={isAtSaveLimit} onClick={onStart}>
              New Career
            </button>
            {hasSaves ? (
              <button className="secondary-action" onClick={() => onSetTitleMode(titleMode === "load" ? "home" : "load")}>
                {titleMode === "load" ? "Close Careers" : "Load Careers"}
              </button>
            ) : null}
          </div>
          {isAtSaveLimit ? <p className="title-limit-note">Save deck full. Delete a career from Load Careers before starting another.</p> : null}
        </section>

        <aside className="title-career-panel" aria-label={titleMode === "load" ? "Career saves" : "Recent career"}>
          {titleMode === "load" ? (
            <>
              <div className="panel-kicker">
                <p className="eyebrow">Career Deck</p>
                <h2>Load Careers</h2>
              </div>
              <div className="save-card-list">
                {careerSaves.map((careerSave) => (
                  <CareerSaveCard
                    careerSave={careerSave}
                    key={careerSave.id}
                    onDeleteCareer={onDeleteCareer}
                    onLoadCareer={onLoadCareer}
                    onRenameCareer={onRenameCareer}
                  />
                ))}
              </div>
            </>
          ) : recentCareer ? (
            <>
              <div className="panel-kicker">
                <p className="eyebrow">Most Recent Career</p>
                <h2>{recentCareer.name}</h2>
              </div>
              <CareerSaveSummary careerSave={recentCareer} />
              <button className="primary-action full-width-action" onClick={onContinue}>
                Resume {recentCareer.preview.brandName}
              </button>
            </>
          ) : (
            <>
              <div className="panel-kicker">
                <p className="eyebrow">Awaiting Contract</p>
                <h2>No Career Active</h2>
              </div>
              <p className="muted-copy">Start a new career to sign the contract, build a roster, and open Week 1 from Brand HQ.</p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function App() {
  const [careerSaves, setCareerSaves] = useState<CareerSave[]>(loadCareerSaves);
  const [titleMode, setTitleMode] = useState<TitleMode>("home");
  const [bootRequest, setBootRequest] = useState<AppBootRequest | null>(() =>
    isDevMatchSimulationLabRequested() || isGameQaHarnessRequested() ? { type: "title" } : null,
  );
  const recentCareer = useMemo(() => getMostRecentCareer(careerSaves), [careerSaves]);

  function refreshCareerSaves() {
    setCareerSaves(loadCareerSaves());
  }

  function startNewGame() {
    if (careerSaves.length >= MAX_SAVE_SLOTS) {
      window.alert(`You already have ${MAX_SAVE_SLOTS} careers. Delete a career from Load Careers before starting a new one.`);
      return;
    }

    setBootRequest({ type: "new-career" });
  }

  function loadCareer(careerSave: CareerSave) {
    setBootRequest({ type: "load-career", saveId: careerSave.id });
  }

  function continueGame() {
    if (recentCareer) {
      loadCareer(recentCareer);
    }
  }

  function renameCareer(careerSave: CareerSave) {
    const nextName = window.prompt("Rename career save", careerSave.name);

    if (nextName === null) {
      return;
    }

    const renamedRecord = renameSaveRecord(careerSave.id, nextName);

    if (renamedRecord) {
      refreshCareerSaves();
    }
  }

  function deleteCareer(careerSave: CareerSave) {
    if (!window.confirm(`Delete "${careerSave.name}"? This cannot be undone.`)) {
      return;
    }

    deleteSaveRecord(careerSave.id);
    refreshCareerSaves();

    if (careerSaves.length <= 1) {
      setTitleMode("home");
    }
  }

  if (bootRequest) {
    return (
      <Suspense fallback={<LoadingGameShell />}>
        <GameApp bootRequest={bootRequest} />
      </Suspense>
    );
  }

  return (
    <TitleScreen
      careerSaves={careerSaves}
      recentCareer={recentCareer}
      titleMode={titleMode}
      onContinue={continueGame}
      onDeleteCareer={deleteCareer}
      onLoadCareer={loadCareer}
      onRenameCareer={renameCareer}
      onSetTitleMode={setTitleMode}
      onStart={startNewGame}
    />
  );
}

export default App;
