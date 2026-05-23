import type { GameState } from "@game/types";
import { IntensityMeter } from "@dynasty/components/IntensityMeter";
import { DynastyPanel } from "../components/DynastyPanel";
import { DynastyPortrait } from "../components/DynastyPortrait";

type Props = { game: GameState };

export function RivalriesScene({ game }: Props) {
  return (
    <section className="dynasty-rivalries-grid dynasty-page-grid">
      <DynastyPanel kicker="Story Room" title="Active Rivalries" badge={String(game.rivalries.length)}>
        {game.rivalries.map((rivalry) => {
          const [leftId, rightId] = rivalry.participantIds;
          const left = game.wrestlers.find((w) => w.id === leftId);
          const right = game.wrestlers.find((w) => w.id === rightId);
          return (
            <div className="rivalry-row" key={rivalry.id}>
              <div className="rivalry-matchup">
                {left ? <DynastyPortrait wrestler={left} size="sm" /> : null}
                <strong>{rivalry.name}</strong>
                {right ? <DynastyPortrait wrestler={right} size="sm" /> : null}
              </div>
              <div className="rivalry-meter-line">
                <em>Heat {rivalry.heat}</em>
                <IntensityMeter value={rivalry.heat} />
              </div>
              <button type="button">Book Rivalry Beat</button>
            </div>
          );
        })}
      </DynastyPanel>

      <DynastyPanel kicker="Create Rivalry" title="New Program" badge="Desk Open">
        <p className="dynasty-copy">Select two roster members to start a new rivalry program.</p>
        <button className="primary-action" type="button">
          Create Rivalry
        </button>
      </DynastyPanel>
    </section>
  );
}
