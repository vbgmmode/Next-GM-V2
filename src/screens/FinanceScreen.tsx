import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { formatMoney } from "../game/formatters";
import { getFinancePressureLabel } from "../game/finance";
import type { GameScreen } from "../game/migration";
import type { FinanceReport, GameState, ShowResult } from "../game/types";
import "./FinanceScreen.css";
import {
  getFinanceExpenseBreakdown,
  getFinanceGrossRevenue,
  getFinanceRevenueBreakdown,
  getFinanceTotalExpenses,
  getLatestFinanceReport,
  getSeasonFinanceReports,
  getShowTypeLabel,
} from "./financeScreenReads";

function signedMoneyClass(amount: number) {
  if (amount > 0) {
    return "is-positive";
  }

  if (amount < 0) {
    return "is-negative";
  }

  return "is-neutral";
}

function getMoneyOutLines(report: FinanceReport) {
  const breakdown = getFinanceExpenseBreakdown(report);
  const topLevel = breakdown.filter((item) => item.id === "talentCost" || item.id === "productionCost");

  if (topLevel.length) {
    return topLevel;
  }

  return breakdown;
}

function LedgerColumn({
  items,
  title,
  total,
  tone,
}: {
  items: { id: string; label: string; amount: number }[];
  title: string;
  total: number;
  tone: "in" | "out";
}) {
  const visibleItems = items.filter((item) => item.amount !== 0);

  return (
    <article className={`finance-ledger-column tone-${tone}`}>
      <header>
        <span>{title}</span>
        <strong className={tone === "in" ? "is-positive" : "is-negative"}>{formatMoney(total)}</strong>
      </header>
      <div className="finance-ledger-lines">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div className="finance-ledger-line" key={item.id}>
              <span>{item.label}</span>
              <em className={tone === "in" ? "is-positive" : "is-negative"}>{formatMoney(item.amount)}</em>
            </div>
          ))
        ) : (
          <p className="finance-ledger-empty">No line items logged.</p>
        )}
      </div>
    </article>
  );
}

function ClosedBookRow({ report }: { report: FinanceReport }) {
  const revenue = getFinanceGrossRevenue(report);
  const costs = getFinanceTotalExpenses(report);

  return (
    <article className="finance-closed-row">
      <div className="finance-closed-row-label">
        <span>
          W{report.weekNumber} · {getShowTypeLabel(report.showType)}
        </span>
        <strong>{report.showName}</strong>
      </div>
      <div className="finance-closed-row-ledger">
        <span className="is-positive">In {formatMoney(revenue)}</span>
        <span className="is-negative">Out {formatMoney(costs)}</span>
        <em className={signedMoneyClass(report.profitLoss)}>{formatMoney(report.profitLoss)}</em>
      </div>
    </article>
  );
}

export function FinanceScreen({
  game,
  latestResult,
  onNavigate,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const latestReport = getLatestFinanceReport(game);
  const seasonReports = getSeasonFinanceReports(game);
  const totalProfitLoss = seasonReports.reduce((sum, report) => sum + report.profitLoss, 0);
  const pressureLabel = getFinancePressureLabel(game.money, latestReport?.profitLoss ?? 0);
  const hasCurrentPostShow = latestResult?.week === game.currentWeek;

  const financeCta: DynastyManagementCta = hasCurrentPostShow
    ? {
        eyebrow: "Recap Waiting",
        label: "Show Recap",
        onClick: () => onNavigate("results"),
        tone: "warning",
      }
    : {
        eyebrow: "Next Action",
        label: "Book Show",
        onClick: () => onNavigate("booking"),
        tone: "brand",
      };

  return (
    <DynastyManagementShell className="finance-command-shell" currentScreen="finance" cta={financeCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <div className="finance-desk-body">
        <section className={`finance-hero-scoreboard pressure-${pressureLabel.toLowerCase()}`} aria-label="Finance balance">
          <div className="finance-hero-balance">
            <span>Current Balance</span>
            <strong className={signedMoneyClass(game.money)}>{formatMoney(game.money)}</strong>
          </div>
          <div className="finance-hero-pressure">
            <span>Pressure</span>
            <strong>{pressureLabel}</strong>
          </div>
          <div className="finance-hero-season">
            <span>Season P/L</span>
            <strong className={signedMoneyClass(totalProfitLoss)}>{formatMoney(totalProfitLoss)}</strong>
          </div>
        </section>

        {latestReport ? (
          <section className="finance-ledger-board" aria-label="Latest closed books">
            <header className="finance-ledger-head">
              <div>
                <p className="eyebrow">
                  Last Close · Week {latestReport.weekNumber} · {getShowTypeLabel(latestReport.showType)}
                </p>
                <h2>{latestReport.showName}</h2>
              </div>
            </header>

            <div className="finance-ledger-columns">
              <LedgerColumn
                items={getFinanceRevenueBreakdown(latestReport)}
                title="Money In"
                total={getFinanceGrossRevenue(latestReport)}
                tone="in"
              />
              <LedgerColumn
                items={getMoneyOutLines(latestReport)}
                title="Money Out"
                total={getFinanceTotalExpenses(latestReport)}
                tone="out"
              />
            </div>

            <footer className="finance-ledger-footer">
              <div>
                <span>Net P/L</span>
                <strong className={signedMoneyClass(latestReport.profitLoss)}>{formatMoney(latestReport.profitLoss)}</strong>
              </div>
              <div>
                <span>Ending Balance</span>
                <strong className={signedMoneyClass(latestReport.endingMoney)}>{formatMoney(latestReport.endingMoney)}</strong>
              </div>
            </footer>
          </section>
        ) : (
          <section className="finance-empty-state">No closed books yet. Run a show to log money in and money out.</section>
        )}

        {game.financeReports.length ? (
          <section className="finance-closed-books" aria-label="Closed books history">
            <header>
              <p className="eyebrow">Closed Books</p>
              <strong>{game.financeReports.length} Week{game.financeReports.length === 1 ? "" : "s"}</strong>
            </header>
            <div className="finance-closed-list">
              {[...game.financeReports].reverse().map((report) => (
                <ClosedBookRow key={report.id} report={report} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </DynastyManagementShell>
  );
}
