import { useMemo } from "react";
import { loadSaveRecords, loadSaveSummaries } from "../gameStorage";
import {
  analyzeSaveRecords,
  analyzeSplitSaveMetadata,
  buildSaveLatencyProjection,
  buildSaveLatencyProjections,
  buildHotSaveMetadataFromRecords,
  formatBytes,
  getRecentSaveStorageOperations,
  type SaveLatencyProjection,
  type SaveStateContributor,
  type SaveStorageOperationSample,
} from "../game/savePerformance";
import { buildFullSaveSlotLatencyFixture, buildSaveLatencyTimeline } from "./saveLatencyFixtures";

const qaParam = "qa";
const saveLatencyMode = "save-latency";

export function isSaveLatencyReportEnabled() {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

  if (!env?.DEV || typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get(qaParam) === saveLatencyMode;
}

function formatMs(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(2)} ms` : "-";
}

function riskLabel(projection: SaveLatencyProjection) {
  return `${projection.risk.toUpperCase()} · ${formatMs(projection.estimatedMs)}`;
}

function deltaLabel(before: SaveLatencyProjection, after: SaveLatencyProjection) {
  const delta = before.estimatedMs - after.estimatedMs;
  return delta > 0 ? `-${formatMs(delta)}` : formatMs(delta);
}

function ContributorTable({ contributors }: { contributors: SaveStateContributor[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Path</th>
          <th>Bytes</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        {contributors.slice(0, 8).map((contributor) => (
          <tr key={contributor.path}>
            <td>{contributor.path}</td>
            <td>{formatBytes(contributor.bytes)}</td>
            <td>{Math.round(contributor.percentOfState * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OperationTable({ operations }: { operations: SaveStorageOperationSample[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Operation</th>
          <th>Bytes</th>
          <th>Total</th>
          <th>Get</th>
          <th>Parse</th>
          <th>Normalize</th>
          <th>Stringify</th>
          <th>Set</th>
        </tr>
      </thead>
      <tbody>
        {operations.slice(0, 8).map((operation, index) => (
          <tr key={`${operation.kind}-${operation.timestamp}-${index}`}>
            <td>{operation.kind}</td>
            <td>{formatBytes(operation.bytes)}</td>
            <td>{formatMs(operation.totalMs)}</td>
            <td>{formatMs(operation.getItemMs)}</td>
            <td>{formatMs(operation.parseMs)}</td>
            <td>{formatMs(operation.normalizeMs)}</td>
            <td>{formatMs(operation.stringifyMs)}</td>
            <td>{formatMs(operation.setItemMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SaveLatencyReport() {
  const report = useMemo(() => {
    const summaries = loadSaveSummaries();
    const summaryMetadata = summaries.map((summary) => ({
      id: summary.id,
      name: summary.name,
      stateKey: summary.stateKey ?? "",
      stateBytes: summary.stateBytes ?? 0,
    }));
    const currentDeckFootprint = analyzeSplitSaveMetadata(summaryMetadata);
    const records = loadSaveRecords();
    const currentFootprint = analyzeSaveRecords(records);
    const currentSplitFootprint = analyzeSplitSaveMetadata(buildHotSaveMetadataFromRecords(records));
    const timeline = buildSaveLatencyTimeline();
    const fixtureRecords = buildFullSaveSlotLatencyFixture();
    const fixtureFootprint = analyzeSaveRecords(fixtureRecords);
    const fixtureSplitFootprint = analyzeSplitSaveMetadata(buildHotSaveMetadataFromRecords(fixtureRecords));
    const projectionEntries = [
      { label: "Current save deck", bytes: currentFootprint.totalIndexBytes },
      ...timeline.map((snapshot) => ({
        label: snapshot.label,
        bytes: analyzeSaveRecords([{ id: snapshot.label, name: snapshot.label, state: snapshot.savedGame }]).totalIndexBytes,
      })),
      { label: "Five filled save slots", bytes: fixtureFootprint.totalIndexBytes },
    ];
    const splitProjectionEntries = [
      { label: "Current save deck", bytes: currentSplitFootprint.activeWriteBytes },
      ...timeline.map((snapshot) => {
        const record = { id: snapshot.label, name: snapshot.label, state: snapshot.savedGame };
        const splitFootprint = analyzeSplitSaveMetadata(buildHotSaveMetadataFromRecords([record]), record.id);

        return {
          label: snapshot.label,
          bytes: splitFootprint.activeWriteBytes,
        };
      }),
      { label: "Five filled save slots", bytes: fixtureSplitFootprint.activeWriteBytes },
    ];
    const projections = buildSaveLatencyProjections(projectionEntries);
    const splitProjections = buildSaveLatencyProjections(splitProjectionEntries);
    const kpis = projections.map((before, index) => ({
      before,
      after: splitProjections[index] ?? buildSaveLatencyProjection(before.label, before.bytes),
    }));
    const pathKpis = [
      buildSaveLatencyProjection("Deck refresh", currentDeckFootprint.indexBytes),
      buildSaveLatencyProjection("Hot active write", currentSplitFootprint.activeWriteBytes),
      buildSaveLatencyProjection("Selected save hydration", currentDeckFootprint.largestPayloadBytes),
      buildSaveLatencyProjection("Five-slot deck refresh", fixtureSplitFootprint.indexBytes),
    ];

    return {
      currentFootprint,
      currentSplitFootprint,
      currentDeckFootprint,
      projections,
      kpis,
      pathKpis,
      operations: getRecentSaveStorageOperations(),
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", padding: "32px", background: "#08090d", color: "#f7f1df", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        .latency-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
        .latency-panel { border: 1px solid rgba(247,241,223,.18); background: rgba(255,255,255,.045); padding: 18px; border-radius: 8px; }
        .latency-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
        .latency-kpi { border: 1px solid rgba(247,241,223,.14); padding: 12px; }
        .latency-kpi strong { display: block; font-size: 1.35rem; }
        table { width: 100%; border-collapse: collapse; font-size: .9rem; }
        th, td { text-align: left; border-bottom: 1px solid rgba(247,241,223,.12); padding: 8px 6px; vertical-align: top; }
        th { color: #cdbb7a; font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; }
        h1, h2 { margin: 0 0 12px; }
        p { color: rgba(247,241,223,.72); max-width: 900px; }
      `}</style>
      <p>QA Diagnostics</p>
      <h1>Save Latency Forecast</h1>
      <p>
        Dev-only readout from the localStorage save boundary. It measures current save-footprint shape and projects synchronous
        serialization risk as career history grows.
      </p>

      <section className="latency-kpis">
        <div className="latency-kpi">
          <span>Save slots</span>
          <strong>{report.currentFootprint.saveCount}</strong>
        </div>
        <div className="latency-kpi">
          <span>Total index</span>
          <strong>{formatBytes(report.currentDeckFootprint.indexBytes)}</strong>
        </div>
        <div className="latency-kpi">
          <span>Deck refresh</span>
          <strong>{formatBytes(report.currentDeckFootprint.indexBytes)}</strong>
        </div>
        <div className="latency-kpi">
          <span>Hot active write</span>
          <strong>{formatBytes(report.currentSplitFootprint.activeWriteBytes)}</strong>
        </div>
        <div className="latency-kpi">
          <span>Largest save</span>
          <strong>{formatBytes(report.currentFootprint.largestSaveBytes)}</strong>
        </div>
        <div className="latency-kpi">
          <span>Largest save name</span>
          <strong>{report.currentFootprint.largestSaveName ?? "None"}</strong>
        </div>
      </section>

      <section className="latency-grid" style={{ marginTop: "18px" }}>
        <article className="latency-panel">
          <h2>Before / After Forecast</h2>
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Before</th>
                <th>After Revamp</th>
                <th>Delta</th>
              </tr>
            </thead>
            <tbody>
              {report.kpis.map(({ before, after }) => (
                <tr key={before.label}>
                  <td>{before.label}</td>
                  <td>
                    {formatBytes(before.bytes)}
                    <br />
                    {riskLabel(before)}
                  </td>
                  <td>
                    {formatBytes(after.bytes)}
                    <br />
                    {riskLabel(after)}
                  </td>
                  <td>{deltaLabel(before, after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="latency-panel">
          <h2>Path KPIs</h2>
          <table>
            <thead>
              <tr>
                <th>Path</th>
                <th>Bytes</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {report.pathKpis.map((projection) => (
                <tr key={projection.label}>
                  <td>{projection.label}</td>
                  <td>{formatBytes(projection.bytes)}</td>
                  <td>{riskLabel(projection)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="latency-panel">
          <h2>Growth Contributors</h2>
          <ContributorTable contributors={report.currentFootprint.aggregateContributors} />
        </article>

        <article className="latency-panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Recent Storage Operations</h2>
          <OperationTable operations={report.operations} />
        </article>
      </section>
    </main>
  );
}
