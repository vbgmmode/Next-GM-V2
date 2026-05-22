import { useState } from "react";
import { ActionBar, CommandPanel } from "@components/broadcast";
import { buildBroadcastFalloutSnapshot, buildPostShowCauseLedger } from "@game/gameContextReads";
import type { GameState, ShowResult } from "@game/types";
import { getShowGrade } from "@game/scoring";
import { SupportDrawer } from "../shell/SupportDrawer";

type BroadcastRecapSceneProps = {
  game: GameState;
  result: ShowResult;
  onContinueWeekReview: () => void;
};

export function BroadcastRecapScene({ game, result, onContinueWeekReview }: BroadcastRecapSceneProps) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [moreFalloutOpen, setMoreFalloutOpen] = useState(false);
  const fallout = buildBroadcastFalloutSnapshot(result);
  const causeLedger = buildPostShowCauseLedger(game, result);
  const visibleFallout = fallout.items.slice(0, 3);
  const hiddenFallout = fallout.items.slice(3);

  return (
    <div className="ld-recap ld-recap--stinger ld-recap--calm">
      <section className="ld-score-bug ld-panel--primary" aria-label="Broadcast score bug">
        <div>
          <span className="ld-kicker ld-kicker--quiet">{result.showName}</span>
          <strong className="ld-score-value">{result.totalScore}</strong>
          <em className="ld-grade-plate">{getShowGrade(result.totalScore)}</em>
        </div>
        <p className="ld-support-copy">{fallout.detail}</p>
      </section>

      <section className="ld-fallout-cascade" aria-label="Broadcast fallout cascade">
        {visibleFallout.map((item) => (
          <article className="ld-fallout-card ld-panel--secondary" data-tone={item.tone} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      {hiddenFallout.length ? (
        <SupportDrawer
          label="More Fallout"
          summary={`${hiddenFallout.length} additional resolved beat${hiddenFallout.length === 1 ? "" : "s"}`}
          open={moreFalloutOpen}
          onToggle={() => setMoreFalloutOpen((open) => !open)}
        >
          <div className="ld-fallout-cascade ld-fallout-cascade--stacked">
            {hiddenFallout.map((item) => (
              <article className="ld-fallout-card ld-panel--secondary" data-tone={item.tone} key={item.id}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </SupportDrawer>
      ) : null}

      <section className="ld-directors-cut">
        <button type="button" className="ld-secondary" onClick={() => setLedgerOpen((open) => !open)}>
          {ledgerOpen ? "Collapse Cause Ledger" : "Expand Cause Ledger"}
        </button>
        <button type="button" className="ld-secondary" onClick={() => setBreakdownOpen((open) => !open)}>
          {breakdownOpen ? "Collapse Broadcast Breakdown" : "Expand Broadcast Breakdown"}
        </button>

        {ledgerOpen ? (
          <CommandPanel className="ld-scroll-panel ld-panel--secondary" title="Resolved Causes" tone="neutral">
            {causeLedger.map((section) => (
              <div className="ld-ledger-section" key={section.id}>
                <h3>{section.label}</h3>
                {section.items.map((item) => (
                  <article key={item.id} data-tone={item.tone}>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            ))}
          </CommandPanel>
        ) : null}

        {breakdownOpen ? (
          <CommandPanel className="ld-scroll-panel ld-panel--secondary" title="Segment Scores" tone="neutral">
            {result.segmentResults.map((segment) => (
              <article className="ld-segment-breakdown" key={segment.segmentId}>
                <div>
                  <strong>{segment.type}</strong>
                  <span>{segment.participantNames.join(" vs ") || "Segment"}</span>
                </div>
                <em>{segment.score}</em>
                <p>{segment.recapNote ?? segment.titleNote ?? segment.rivalryNote ?? "Resolved segment."}</p>
              </article>
            ))}
          </CommandPanel>
        ) : null}
      </section>

      <ActionBar>
        <button type="button" className="ld-primary" onClick={onContinueWeekReview}>
          Continue To Week Review
        </button>
      </ActionBar>
    </div>
  );
}
