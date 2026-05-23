import type { GameScreen } from "@game/migration";
import type { GameState } from "@game/types";
import { MoraleEmoji } from "@dynasty/components/MoraleEmoji";
import { RoleIcon } from "@dynasty/components/RoleIcon";
import { StaminaBar } from "@dynasty/components/StaminaBar";
import { DynastyPanel, DynastyScrollList } from "../components/DynastyPanel";
import { DynastyPortrait } from "../components/DynastyPortrait";

type Props = {
  game: GameState;
  onNavigate: (screen: GameScreen) => void;
  onOpenProfile: (wrestlerId: string) => void;
  selectedId?: string;
};

export function RosterScene({ game, onNavigate, onOpenProfile, selectedId }: Props) {
  const sorted = [...game.wrestlers].sort((a, b) => b.popularity - a.popularity);
  const selected = sorted.find((w) => w.id === selectedId) ?? sorted[0];

  return (
    <section className="dynasty-roster-grid dynasty-page-grid">
      <DynastyPanel kicker="Roster Desk" title="Full Roster" badge={`${game.wrestlers.length} Active`}>
        <div className="roster-table">
          <div className="roster-row roster-head">
            <span>Superstar</span>
            <span>Pop</span>
            <span>Sta</span>
            <span>Mor</span>
          </div>
          <DynastyScrollList className="roster-scroll">
            {sorted.map((wrestler) => (
              <button
                className={wrestler.id === selected?.id ? "roster-row is-selected dynasty-roster-select" : "roster-row dynasty-roster-select"}
                key={wrestler.id}
                type="button"
                onClick={() => onOpenProfile(wrestler.id)}
              >
                <div className="superstar-cell">
                  <DynastyPortrait wrestler={wrestler} size="sm" />
                  <strong>{wrestler.name}</strong>
                </div>
                <span>{wrestler.popularity}</span>
                <span>
                  <StaminaBar value={Math.max(0, 100 - wrestler.fatigue)} />
                </span>
                <span>
                  <MoraleEmoji morale={wrestler.morale >= 65 ? "happy" : wrestler.morale >= 45 ? "neutral" : "angry"} />
                </span>
              </button>
            ))}
          </DynastyScrollList>
        </div>
      </DynastyPanel>

      {selected ? (
        <DynastyPanel kicker="Selected Superstar" title={selected.name} badge={selected.roleTier ?? "Roster"}>
          <DynastyPortrait wrestler={selected} size="lg" />
          <div className="mini-stat-grid">
            <div>
              <span>Pop</span>
              <strong>{selected.popularity}</strong>
            </div>
            <div>
              <span>Ring</span>
              <strong>{selected.ringSkill}</strong>
            </div>
            <div>
              <span>Mic</span>
              <strong>{selected.promoSkill}</strong>
            </div>
          </div>
          <RoleIcon role="main" />
          <button className="gold-action" type="button" onClick={() => onOpenProfile(selected.id)}>
            Open Profile
          </button>
        </DynastyPanel>
      ) : null}

      <DynastyPanel kicker="Affiliations" title="Locker Room Tags" badge="Stable">
        <p className="dynasty-copy">Roster health and usage tags mirror the main app roster desk.</p>
        <button type="button" onClick={() => onNavigate("dashboard")}>
          Back to Brand HQ
        </button>
      </DynastyPanel>
    </section>
  );
}
