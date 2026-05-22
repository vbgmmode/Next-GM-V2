import { useState } from "react";
import { HeroDecisionPanel, StatusBadge } from "@components/broadcast";
import { getLivingWorldPressureSnapshot, getWeeklyDecisionPressureSnapshot } from "@game/gameContextReads";
import type { GameState, ShowResult } from "@game/types";
import { getCurrentCalendarWeek, isValidSegment } from "@game/scoring";
import { SupportDrawer } from "../shell/SupportDrawer";

type BrandHQSceneProps = {
  game: GameState;
  result?: ShowResult;
  onOpenRundown: () => void;
};

export function BrandHQScene({ game, result, onOpenRundown }: BrandHQSceneProps) {
  const [pulseOpen, setPulseOpen] = useState(false);
  const livingWorld = getLivingWorldPressureSnapshot(game, result);
  const weeklyPressure = getWeeklyDecisionPressureSnapshot(game, result);
  const currentShow = getCurrentCalendarWeek(game);
  const validCount = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers)).length;
  const pulseSummary = livingWorld.items.slice(0, 2).map((item) => `${item.voice}: ${item.value}`).join(" · ");

  return (
    <div className="ld-brand-hq ld-brand-hq--calm">
      <section className="ld-hero-stage">
        <HeroDecisionPanel
          className="ld-panel--primary"
          eyebrow={currentShow.showType === "ple" ? "Major Event Night" : currentShow.isGoHome ? "Go-Home Broadcast" : "Tonight's Broadcast"}
          title={currentShow.showName}
          summary={livingWorld.nextAction}
          actions={
            <button type="button" className="ld-primary" onClick={onOpenRundown}>
              Open Production Rundown
            </button>
          }
        >
          <StatusBadge tone={validCount >= 2 ? "positive" : "warning"}>
            {validCount >= 2 ? "Card ready when you are" : `${validCount}/2 valid segments booked`}
          </StatusBadge>
        </HeroDecisionPanel>
      </section>

      <SupportDrawer
        label="Office Pulse"
        summary={pulseSummary || livingWorld.weekRead}
        open={pulseOpen}
        onToggle={() => setPulseOpen((open) => !open)}
      >
        <p className="ld-lead-copy">{livingWorld.headline}</p>
        <p className="ld-support-copy">{livingWorld.weekRead}</p>
        <div className="ld-pressure-list">
          {livingWorld.items.map((item) => (
            <article className="ld-pressure-item" data-tone={item.tone} key={item.id}>
              <span>{item.voice}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="ld-pressure-list ld-pressure-list--compact">
          {weeklyPressure.items.map((item) => (
            <article className="ld-pressure-item" data-tone={item.tone} key={item.id}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </SupportDrawer>
    </div>
  );
}
