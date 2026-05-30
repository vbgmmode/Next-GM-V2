import { useMemo, useState } from "react";
import {
  matchRatingKeys,
  ensureMatchRatings,
} from "../game/matchRatings";
import {
  matchSimulationLabStructures,
  runMatchSimulationLab,
  type MatchSimulationLabCurrentStateOverride,
  type MatchSimulationLabDistributionRow,
  type MatchSimulationLabStructure,
} from "../game/matchSimulationLab";
import { stipulationCatalog } from "../game/stipulationCatalog";
import type { GameState, MatchOutcomeModel, MatchRatingsProgressionMode, Wrestler } from "../game/types";
import "./MatchSimulationLabScreen.css";

type MatchSimulationLabScreenProps = {
  game: GameState;
};

const structureLabels: Record<MatchSimulationLabStructure, string> = {
  singles: "Singles",
  tag_2v2: "2v2 Tag",
  three_way: "3-Way",
  four_way: "4-Way",
};

const structureParticipantCount: Record<MatchSimulationLabStructure, number> = {
  singles: 2,
  tag_2v2: 4,
  three_way: 3,
  four_way: 4,
};

type LabTierFilter = "all" | "top" | "mid" | "lower" | "specialists";
type LabStyleFilter =
  | "all"
  | "technical"
  | "submission"
  | "power"
  | "aerial"
  | "brawling"
  | "hardcore"
  | "stamina"
  | "popularity"
  | "skill";
type LabSort = "rank" | "overall" | "name";
type LabStateField = "momentum" | "morale" | "fatigue";
type MatchSimulationLabRunConfig = {
  participantIds: string[];
  matchStructure: MatchSimulationLabStructure;
  stipulationId?: string;
  iterations: number;
  baseSeed: string;
  model: MatchOutcomeModel;
  progression: MatchRatingsProgressionMode;
  currentStateOverrides: MatchSimulationLabCurrentStateOverride[];
};

function formatPercent(value?: number) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function formatNumber(value?: number) {
  return typeof value === "number" ? value.toFixed(2) : "n/a";
}

function getAverageRating(wrestler: Wrestler) {
  const ratings = ensureMatchRatings(wrestler);
  return matchRatingKeys.reduce((sum, key) => sum + ratings[key], 0) / matchRatingKeys.length;
}

function getTierGroup(wrestler: Wrestler): Exclude<LabTierFilter, "all" | "specialists"> {
  if (wrestler.roleTier === "MainEvent" || wrestler.roleTier === "UpperCard" || (wrestler.draftRank ?? 999) <= 40) {
    return "top";
  }

  if (wrestler.roleTier === "Prospect" || wrestler.roleTier === "Enhancement" || (wrestler.draftRank ?? 0) > 100) {
    return "lower";
  }

  return "mid";
}

function hasSpecialistShape(wrestler: Wrestler) {
  const ratings = ensureMatchRatings(wrestler);
  const average = getAverageRating(wrestler);
  return matchRatingKeys.some((key) => ratings[key] - average >= 8);
}

function styleMatches(wrestler: Wrestler, style: LabStyleFilter) {
  if (style === "all") {
    return true;
  }

  const ratings = ensureMatchRatings(wrestler);

  if (style === "popularity") {
    return wrestler.popularity - wrestler.ringSkill >= 10;
  }

  if (style === "skill") {
    return wrestler.ringSkill - wrestler.popularity >= 10;
  }

  if (style === "stamina") {
    return ratings.stamina >= 72 || ratings.resilience >= 72;
  }

  return ratings[style] >= Math.max(68, getAverageRating(wrestler) + 5);
}

function getDefaultParticipantIds(roster: GameState["wrestlers"]) {
  const mens = roster.filter((wrestler) => wrestler.division === "Mens").slice(0, 4);
  const womens = roster.filter((wrestler) => wrestler.division === "Womens").slice(0, 4);
  const defaultGroup = mens.length >= 4 ? mens : womens.length >= 4 ? womens : roster.slice(0, 4);

  return defaultGroup.map((wrestler) => wrestler.id);
}

function clampStateValue(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function distributionRows(rows: MatchSimulationLabDistributionRow[]) {
  if (!rows.length) {
    return <p className="match-sim-lab-empty">No resolved distribution for this run.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Entity</th>
          <th>Count</th>
          <th>Actual</th>
          <th>Expected</th>
          <th>Delta</th>
          <th>Power</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.label}</td>
            <td>{row.count}</td>
            <td>{formatPercent(row.actualProbability)}</td>
            <td>{formatPercent(row.expectedProbability)}</td>
            <td>{formatPercent(row.deltaFromExpected)}</td>
            <td>{formatNumber(row.averageEffectivePower)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MatchSimulationLabScreen({ game }: MatchSimulationLabScreenProps) {
  const roster = useMemo(() => game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "major"), [game.wrestlers]);
  const [matchStructure, setMatchStructure] = useState<MatchSimulationLabStructure>("singles");
  const [participantIds, setParticipantIds] = useState<string[]>(() => getDefaultParticipantIds(roster));
  const [stipulationId, setStipulationId] = useState("");
  const [iterations, setIterations] = useState(1000);
  const [model, setModel] = useState<MatchOutcomeModel>("deepRatings");
  const [progression, setProgression] = useState<MatchRatingsProgressionMode>("disabled");
  const [baseSeed, setBaseSeed] = useState("dev-lab");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<LabTierFilter>("all");
  const [styleFilter, setStyleFilter] = useState<LabStyleFilter>("all");
  const [sortMode, setSortMode] = useState<LabSort>("rank");
  const [currentStateOverrides, setCurrentStateOverrides] = useState<Record<string, Omit<MatchSimulationLabCurrentStateOverride, "wrestlerId">>>({});
  const [runConfig, setRunConfig] = useState<MatchSimulationLabRunConfig>(() => ({
    participantIds: getDefaultParticipantIds(roster).slice(0, structureParticipantCount.singles),
    matchStructure: "singles",
    stipulationId: undefined,
    iterations: 1000,
    baseSeed: "dev-lab",
    model: "deepRatings",
    progression: "disabled",
    currentStateOverrides: [],
  }));
  const requiredParticipantCount = structureParticipantCount[matchStructure];
  const selectedParticipantIds = participantIds.slice(0, requiredParticipantCount);
  const selectedWrestlers = useMemo(
    () => selectedParticipantIds.map((id) => roster.find((wrestler) => wrestler.id === id)).filter((wrestler): wrestler is Wrestler => Boolean(wrestler)),
    [roster, selectedParticipantIds],
  );
  const visibleRoster = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return roster
      .filter((wrestler) => {
        const searchable = [wrestler.name, wrestler.roleTier, wrestler.archetype, wrestler.wrestlingStyle, wrestler.sourceBrand]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const tierMatches =
          tierFilter === "all" ||
          (tierFilter === "specialists" ? hasSpecialistShape(wrestler) : getTierGroup(wrestler) === tierFilter);
        return (!normalizedSearch || searchable.includes(normalizedSearch)) && tierMatches && styleMatches(wrestler, styleFilter);
      })
      .sort((left, right) => {
        if (sortMode === "overall") {
          return getAverageRating(right) - getAverageRating(left) || left.name.localeCompare(right.name);
        }

        if (sortMode === "name") {
          return left.name.localeCompare(right.name);
        }

        return (left.draftRank ?? 999) - (right.draftRank ?? 999) || left.name.localeCompare(right.name);
      });
  }, [roster, search, sortMode, styleFilter, tierFilter]);
  const selectableRoster = useMemo(() => {
    const byId = new Map(visibleRoster.map((wrestler) => [wrestler.id, wrestler]));
    selectedParticipantIds.forEach((id) => {
      const selected = roster.find((wrestler) => wrestler.id === id);
      if (selected && !byId.has(id)) {
        byId.set(id, selected);
      }
    });
    return [...byId.values()];
  }, [roster, selectedParticipantIds, visibleRoster]);
  const pendingCurrentStateOverrides = useMemo(
    () =>
      selectedParticipantIds
        .map((id) => ({ wrestlerId: id, ...currentStateOverrides[id] }))
        .filter((override) => currentStateOverrides[override.wrestlerId]),
    [currentStateOverrides, selectedParticipantIds],
  );
  const pendingRunConfig = useMemo<MatchSimulationLabRunConfig>(
    () => ({
      participantIds: selectedParticipantIds,
      matchStructure,
      stipulationId: stipulationId || undefined,
      iterations,
      baseSeed,
      model,
      progression,
      currentStateOverrides: pendingCurrentStateOverrides,
    }),
    [baseSeed, iterations, matchStructure, model, pendingCurrentStateOverrides, progression, selectedParticipantIds, stipulationId],
  );
  const result = useMemo(
    () =>
      runMatchSimulationLab({
        game,
        ...runConfig,
      }),
    [game, runConfig],
  );

  function updateParticipant(index: number, wrestlerId: string) {
    setParticipantIds((current) => {
      const next = [...current];
      next[index] = wrestlerId;
      return next;
    });
  }

  function updateStructure(nextStructure: MatchSimulationLabStructure) {
    setMatchStructure(nextStructure);
    setParticipantIds((current) => {
      const next = [...current];
      getDefaultParticipantIds(roster).forEach((id, index) => {
        next[index] = next[index] ?? id;
      });
      return next;
    });
  }

  function stateValue(wrestler: Wrestler, field: LabStateField) {
    return currentStateOverrides[wrestler.id]?.[field] ?? wrestler[field];
  }

  function updateCurrentState(wrestlerId: string, field: LabStateField, value: number) {
    setCurrentStateOverrides((current) => ({
      ...current,
      [wrestlerId]: {
        ...current[wrestlerId],
        [field]: clampStateValue(value),
      },
    }));
  }

  function updateInjuryStatus(wrestlerId: string, injuryStatus: "healthy" | "minor") {
    setCurrentStateOverrides((current) => ({
      ...current,
      [wrestlerId]: {
        ...current[wrestlerId],
        injuryStatus,
      },
    }));
  }

  function resetCurrentState(wrestlerId: string) {
    setCurrentStateOverrides((current) => {
      const next = { ...current };
      delete next[wrestlerId];
      return next;
    });
  }

  function analyzePendingSetup() {
    setRunConfig(pendingRunConfig);
  }

  return (
    <main className="match-sim-lab">
      <header className="match-sim-lab-header">
        <div>
          <p>Dev only</p>
          <h1>Match Simulation Lab</h1>
        </div>
        <div className="match-sim-lab-run-meta">
          <span>{result.successfulIterations}/{result.iterations} resolved</span>
          <span>{result.fallbackCounts.total} fallbacks</span>
          <span>{formatPercent(result.upsetRate)} upsets</span>
        </div>
      </header>

      <section className="match-sim-lab-controls" aria-label="Simulation controls">
        <label>
          Structure
          <select value={matchStructure} onChange={(event) => updateStructure(event.target.value as MatchSimulationLabStructure)}>
            {matchSimulationLabStructures.map((structure) => (
              <option key={structure} value={structure}>
                {structureLabels[structure]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Stipulation
          <select value={stipulationId} onChange={(event) => setStipulationId(event.target.value)}>
            <option value="">Standard</option>
            {stipulationCatalog.map((stipulation) => (
              <option key={stipulation.id} value={stipulation.id}>
                {stipulation.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Iterations
          <input min={1} max={5000} type="number" value={iterations} onChange={(event) => setIterations(Number(event.target.value))} />
        </label>

        <label>
          Model
          <select value={model} onChange={(event) => setModel(event.target.value as MatchOutcomeModel)}>
            <option value="deepRatings">Deep Ratings</option>
            <option value="legacy">Legacy</option>
          </select>
        </label>

        <label>
          Progression
          <select value={progression} onChange={(event) => setProgression(event.target.value as MatchRatingsProgressionMode)}>
            <option value="disabled">Disabled</option>
            <option value="enabled">Enabled in cloned runs</option>
          </select>
        </label>

        <label>
          Base seed
          <input value={baseSeed} onChange={(event) => setBaseSeed(event.target.value)} />
        </label>

        <div className="match-sim-lab-analyze">
          <button type="button" onClick={analyzePendingSetup}>
            Analyze
          </button>
          <span>{runConfig.iterations} iteration snapshot</span>
        </div>
      </section>

      <section className="match-sim-lab-controls" aria-label="Roster filters">
        <label>
          Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, style, brand" />
        </label>

        <label>
          Tier
          <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value as LabTierFilter)}>
            <option value="all">All tiers</option>
            <option value="top">Top / upper</option>
            <option value="mid">Mid-card</option>
            <option value="lower">Lower / prospects</option>
            <option value="specialists">Specialists</option>
          </select>
        </label>

        <label>
          Style
          <select value={styleFilter} onChange={(event) => setStyleFilter(event.target.value as LabStyleFilter)}>
            <option value="all">All styles</option>
            <option value="technical">Technical</option>
            <option value="submission">Submission</option>
            <option value="power">Power</option>
            <option value="aerial">Aerial</option>
            <option value="brawling">Brawling</option>
            <option value="hardcore">Hardcore</option>
            <option value="stamina">Stamina</option>
            <option value="popularity">Popularity-heavy</option>
            <option value="skill">Low-pop / high-skill</option>
          </select>
        </label>

        <label>
          Sort
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as LabSort)}>
            <option value="rank">Draft rank</option>
            <option value="overall">Overall rating</option>
            <option value="name">Name</option>
          </select>
        </label>

        <div className="match-sim-lab-roster-count" aria-label="Visible lab roster count">
          <strong>{visibleRoster.length}</strong>
          <span>shown of {roster.length} lab wrestlers</span>
        </div>
      </section>

      <section className="match-sim-lab-participants" aria-label="Participant controls">
        {Array.from({ length: requiredParticipantCount }, (_, index) => (
          <label key={`${matchStructure}-${index}`}>
            {matchStructure === "tag_2v2" ? `Slot ${index + 1}${index < 2 ? " Team A" : " Team B"}` : `Participant ${index + 1}`}
            <select value={selectedParticipantIds[index] ?? ""} onChange={(event) => updateParticipant(index, event.target.value)}>
              {selectableRoster.map((wrestler) => (
                <option key={wrestler.id} value={wrestler.id}>
                  {wrestler.name} · {wrestler.roleTier ?? "Tier n/a"} · {getAverageRating(wrestler).toFixed(0)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>

      <section className="match-sim-lab-state-editor" aria-label="Current state overrides">
        {selectedWrestlers.map((wrestler, index) => (
          <article key={`${wrestler.id}-${index}`} className="match-sim-lab-state-card">
            <header>
              <div>
                <h2>{wrestler.name}</h2>
                <p>{wrestler.roleTier ?? "Tier n/a"} · {getAverageRating(wrestler).toFixed(0)} avg</p>
              </div>
              <button type="button" onClick={() => resetCurrentState(wrestler.id)}>
                Reset
              </button>
            </header>
            <div className="match-sim-lab-state-grid">
              {(["momentum", "morale", "fatigue"] as LabStateField[]).map((field) => (
                <label key={field}>
                  {field}
                  <input
                    min={0}
                    max={100}
                    type="number"
                    value={stateValue(wrestler, field)}
                    onChange={(event) => updateCurrentState(wrestler.id, field, Number(event.target.value))}
                  />
                </label>
              ))}
              <label>
                Injury
                <select
                  value={currentStateOverrides[wrestler.id]?.injuryStatus ?? wrestler.injuryStatus}
                  onChange={(event) => updateInjuryStatus(wrestler.id, event.target.value as "healthy" | "minor")}
                >
                  <option value="healthy">Healthy</option>
                  <option value="minor">Minor</option>
                </select>
              </label>
            </div>
          </article>
        ))}
      </section>

      <section className="match-sim-lab-grid">
        <article>
          <h2>Winner Distribution</h2>
          {distributionRows(result.winnerDistribution)}
        </article>

        <article>
          <h2>Fall Takers</h2>
          {distributionRows(result.fallTakerDistribution)}
        </article>

        <article>
          <h2>Protected Participants</h2>
          {distributionRows(result.protectedParticipantDistribution)}
        </article>

        <article>
          <h2>Effective Power</h2>
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Participants</th>
                <th>Power</th>
                <th>Expected</th>
              </tr>
            </thead>
            <tbody>
              {result.teamBreakdown.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.label}</td>
                  <td>{entry.participantIds.map((id) => roster.find((wrestler) => wrestler.id === id)?.name ?? id).join(" / ")}</td>
                  <td>{formatNumber(entry.averageEffectivePower)}</td>
                  <td>{formatPercent(entry.expectedProbability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article>
          <h2>Warnings</h2>
          {result.warnings.length ? (
            <ul>
              {result.warnings.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          ) : (
            <p className="match-sim-lab-empty">No tuning warnings for this run.</p>
          )}
        </article>

        <article>
          <h2>Fallback Reasons</h2>
          {Object.keys(result.fallbackCounts.reasons).length ? (
            <table>
              <tbody>
                {Object.entries(result.fallbackCounts.reasons).map(([reason, count]) => (
                  <tr key={reason}>
                    <td>{reason}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="match-sim-lab-empty">No fallbacks recorded.</p>
          )}
        </article>
      </section>
    </main>
  );
}
