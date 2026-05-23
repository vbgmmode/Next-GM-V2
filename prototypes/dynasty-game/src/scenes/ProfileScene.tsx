import type { GameScreen } from "@game/migration";
import type { GameState, Wrestler } from "@game/types";
import { DynastyMetricGrid, DynastyPanel } from "../components/DynastyPanel";
import { DynastyPortrait } from "../components/DynastyPortrait";

type Props = {
  game: GameState;
  wrestler: Wrestler;
  onNavigate: (screen: GameScreen) => void;
  onBack: () => void;
};

export function ProfileScene({ game, wrestler, onNavigate, onBack }: Props) {
  const titles = game.championships.filter((title) => title.championIds.includes(wrestler.id));

  return (
    <section className="dynasty-profile-grid dynasty-page-grid">
      <article className="panel dynasty-profile-hero">
        <DynastyPortrait wrestler={wrestler} size="lg" />
        <h2>{wrestler.name}</h2>
        <p>
          {wrestler.roleTier} · {wrestler.wrestlingStyle ?? wrestler.archetype}
        </p>
        <DynastyMetricGrid
          items={[
            { label: "Popularity", value: String(wrestler.popularity) },
            { label: "Momentum", value: String(wrestler.momentum) },
            { label: "Ring Skill", value: String(wrestler.ringSkill) },
            { label: "Promo Skill", value: String(wrestler.promoSkill) },
          ]}
        />
        <button type="button" onClick={onBack}>
          Back
        </button>
      </article>

      <DynastyPanel kicker="Championships" title="Gold Ledger" badge={String(titles.length)}>
        {titles.length ? (
          titles.map((title) => (
            <div className="champion-row" key={title.id}>
              <strong>{title.name}</strong>
            </div>
          ))
        ) : (
          <p className="dynasty-empty-copy">No championships held.</p>
        )}
      </DynastyPanel>

      <DynastyPanel kicker="Locker Room" title="Office Read" badge={`Fatigue ${wrestler.fatigue}`}>
        <p className="dynasty-copy">
          Morale {wrestler.morale} · Injury {wrestler.injuryStatus} · Source {wrestler.sourceBrand ?? "—"}
        </p>
        <button type="button" onClick={() => onNavigate("booking")}>
          Book on Tonight&apos;s Card
        </button>
      </DynastyPanel>
    </section>
  );
}
