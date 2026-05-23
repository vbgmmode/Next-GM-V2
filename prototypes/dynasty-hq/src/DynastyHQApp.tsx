import { useMemo, useState } from "react";
import type { GameScreen } from "@game/migration";
import type { LiveDeskFixtureId } from "./fixtures";
import { getFixture, liveDeskFixtures } from "./fixtures";
import { DynastyDashboardScene } from "./scenes/DynastyDashboardScene";

export function DynastyHQApp() {
  const [fixtureId, setFixtureId] = useState<LiveDeskFixtureId>("week-pressure");
  const [toast, setToast] = useState<string | null>(null);
  const fixture = useMemo(() => getFixture(fixtureId), [fixtureId]);

  function handleFixtureChange(nextId: LiveDeskFixtureId) {
    setFixtureId(nextId);
    setToast(null);
  }

  function handleNavigateStub(screen: GameScreen) {
    setToast(`Navigation stub — "${screen}" lives in the main app at localhost:5174`);
  }

  return (
    <div className="dynasty-hq-app">
      <header className="dynasty-prototype-bar">
        <span className="dynasty-prototype-label">Dynasty HQ Prototype</span>
        <label>
          Fixture
          <select value={fixtureId} onChange={(event) => handleFixtureChange(event.target.value as LiveDeskFixtureId)}>
            {liveDeskFixtures.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p>{fixture.description}</p>
        <small>Compare with Brand HQ at localhost:5174 using the same fixture mindset.</small>
      </header>

      {toast ? (
        <div className="dynasty-prototype-toast" role="status">
          {toast}
        </div>
      ) : null}

      <DynastyDashboardScene game={fixture.game} result={fixture.result} onNavigateStub={handleNavigateStub} />
    </div>
  );
}
