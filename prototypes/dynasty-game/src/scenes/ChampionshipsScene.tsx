import type { GameState } from "@game/types";
import { DynastyPanel, DynastyScrollList } from "../components/DynastyPanel";
import { DynastyPortrait } from "../components/DynastyPortrait";

type Props = { game: GameState };

export function ChampionshipsScene({ game }: Props) {
  return (
    <section className="dynasty-championships-grid dynasty-page-grid">
      {game.championships.map((title) => {
        const holder = title.championIds[0] ? game.wrestlers.find((w) => w.id === title.championIds[0]) : undefined;
        return (
          <DynastyPanel key={title.id} kicker="Championship" title={title.name} badge={holder?.name ?? "Vacant"}>
            {holder ? <DynastyPortrait wrestler={holder} size="md" /> : <span className="dynasty-portrait-vacant dynasty-portrait--md">—</span>}
            <DynastyScrollList>
              {game.wrestlers.slice(0, 4).map((wrestler) => (
                <div className="dynasty-draft-row" key={wrestler.id}>
                  <strong>{wrestler.name}</strong>
                  <em>Contender lane</em>
                </div>
              ))}
            </DynastyScrollList>
            <button className="gold-action" type="button">
              Book Title Scene
            </button>
          </DynastyPanel>
        );
      })}
    </section>
  );
}
