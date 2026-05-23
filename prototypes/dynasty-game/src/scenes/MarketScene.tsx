import type { GameScreen } from "@game/migration";
import type { GameState } from "@game/types";
import { getMarketSnapshot } from "@game/market";
import { draftPool } from "@game/seed";
import { formatMoney } from "@game/formatters";
import { DynastyMetricGrid, DynastyPanel, DynastyScrollList } from "../components/DynastyPanel";
import { DynastyPortrait } from "../components/DynastyPortrait";

type Props = {
  game: GameState;
  onNavigate: (screen: GameScreen) => void;
};

export function MarketScene({ game, onNavigate }: Props) {
  const snapshot = getMarketSnapshot(game, draftPool);
  const focus = snapshot.freeAgents[0];

  return (
    <section className="dynasty-market-grid dynasty-page-grid">
      <DynastyPanel kicker="Free Agent Desk" title="Available Talent" badge={`${snapshot.freeAgents.length} Listed`}>
        <DynastyScrollList>
          {snapshot.freeAgents.slice(0, 8).map((wrestler) => (
            <div className="dynasty-draft-row" key={wrestler.id}>
              <DynastyPortrait wrestler={wrestler} size="sm" />
              <strong>{wrestler.name}</strong>
              <em>{wrestler.archetype ?? wrestler.wrestlingStyle}</em>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>

      <DynastyPanel kicker="Focus Prospect" title={focus?.name ?? "—"} badge="Scout Report">
        {focus ? <DynastyPortrait wrestler={focus} size="lg" /> : null}
        <DynastyMetricGrid
          items={[
            { label: "Pop", value: String(focus?.popularity ?? "—") },
            { label: "Payroll", value: formatMoney(snapshot.payroll) },
            { label: "Budget", value: formatMoney(game.money) },
            { label: "Mandate", value: game.marketState.officeMandate.mandateStatus },
          ]}
        />
        <button className="primary-action" type="button">
          Sign Free Agent
        </button>
      </DynastyPanel>

      <DynastyPanel kicker="Trade Desk" title="Rival Targets" badge="CPU Market">
        <DynastyScrollList>
          {snapshot.rivalTradeTargets.slice(0, 4).map((target) => (
            <div className="dynasty-draft-row" key={target.wrestler.id}>
              <strong>{target.wrestler.name}</strong>
              <em>{target.brand.brandName}</em>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>

      <DynastyPanel kicker="Transaction Log" title="Recent Moves" badge="Desk Feed">
        <DynastyScrollList>
          {game.marketState.transactions.slice(0, 6).map((tx) => (
            <div className="alert-row alert-gold" key={tx.id}>
              <span>$</span>
              <strong>{tx.note ?? tx.type}</strong>
            </div>
          ))}
        </DynastyScrollList>
        <button type="button" onClick={() => onNavigate("finance")}>
          Open Finance Desk
        </button>
      </DynastyPanel>
    </section>
  );
}
