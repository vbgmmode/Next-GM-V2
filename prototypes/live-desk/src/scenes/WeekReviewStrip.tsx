import { useState } from "react";
import { ActionBar, CommandPanel, MetricTile } from "@components/broadcast";
import { getWeekReviewHandoffSnapshot, getWeekReviewOfficeSnapshot } from "@game/gameContextReads";
import type { GameState, ShowResult } from "@game/types";
import { getShowGrade } from "@game/scoring";
import { SupportDrawer } from "../shell/SupportDrawer";

type WeekReviewStripProps = {
  game: GameState;
  result: ShowResult;
  onReturnToBrandHQ: () => void;
};

export function WeekReviewStrip({ game, result, onReturnToBrandHQ }: WeekReviewStripProps) {
  const [officeOpen, setOfficeOpen] = useState(false);
  const handoff = getWeekReviewHandoffSnapshot(game, result);
  const office = getWeekReviewOfficeSnapshot(game, result);

  return (
    <div className="ld-week-review ld-week-review--calm">
      <section className="ld-week-review-hero ld-panel--primary">
        <div>
          <span className="ld-kicker ld-kicker--quiet">GM Office Handoff</span>
          <strong>{handoff.headline}</strong>
          <p>{handoff.detail}</p>
        </div>
        <MetricTile label="Show Closed" value={`${result.totalScore} ${getShowGrade(result.totalScore)}`} tone="prestige" />
      </section>

      <CommandPanel className="ld-panel--secondary" title="Week Fallout" tone="neutral">
        <div className="ld-handoff-list">
          {handoff.items.slice(0, 3).map((item) => (
            <article key={item.id} data-tone={item.tone}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </CommandPanel>

      <SupportDrawer
        label="GM Office Readout"
        summary={office.headline}
        open={officeOpen}
        onToggle={() => setOfficeOpen((open) => !open)}
      >
        <p className="ld-support-copy">{office.detail}</p>
        <div className="ld-handoff-list">
          {office.items.map((item) => (
            <article key={item.id} data-tone={item.tone}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </SupportDrawer>

      <ActionBar>
        <button type="button" className="ld-primary" onClick={onReturnToBrandHQ}>
          Return To Brand HQ
        </button>
      </ActionBar>
    </div>
  );
}
