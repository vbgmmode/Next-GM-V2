import type { GameState } from "@game/types";
import { formatMoney } from "@game/formatters";
import { getFinancePressureLabel } from "@game/finance";
import { DynastyMetricGrid, DynastyPanel, DynastyScrollList } from "../components/DynastyPanel";

type Props = { game: GameState };

export function FinanceScene({ game }: Props) {
  const latest = game.financeReports[game.financeReports.length - 1];
  const pressure = getFinancePressureLabel(game.money, latest?.profitLoss ?? 0);

  return (
    <section className="dynasty-finance-grid dynasty-page-grid">
      <article className="panel dynasty-finance-hero">
        <div className="panel-kicker">Finance Desk</div>
        <div className="dynasty-score-line">
          <h2>{formatMoney(game.money)}</h2>
          <strong>{pressure}</strong>
        </div>
        <DynastyMetricGrid
          items={[
            { label: "Latest P/L", value: latest ? formatMoney(latest.profitLoss) : "—" },
            { label: "Attendance", value: latest ? latest.attendance.toLocaleString() : "—" },
            { label: "Reports", value: String(game.financeReports.length) },
            { label: "Week", value: `W${game.currentWeek}` },
          ]}
        />
      </article>

      <DynastyPanel kicker="Ledger" title="Recent Reports" badge="Season Log">
        <DynastyScrollList>
          {game.financeReports.slice(-8).reverse().map((report) => (
            <div className="dynasty-ledger-row" key={report.id}>
              <span>W{report.weekNumber}</span>
              <strong>{formatMoney(report.profitLoss)}</strong>
              <em>{report.attendance.toLocaleString()} doors</em>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>
    </section>
  );
}
