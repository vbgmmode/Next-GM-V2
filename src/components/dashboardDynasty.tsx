import { SuperstarPortrait } from "./SuperstarPortrait";
import type { DashboardAlert, DashboardAlignmentLevel, DashboardMoraleLevel } from "../game/dashboardViewModel";
import type { Wrestler } from "../game/types";

type PortraitSize = "sm" | "md" | "lg";

const portraitSizeClass: Record<PortraitSize, string> = {
  lg: "dashboard-dynasty-portrait--lg",
  md: "dashboard-dynasty-portrait--md",
  sm: "dashboard-dynasty-portrait--sm",
};

const alertLabels: Record<DashboardAlert["icon"], string> = {
  contract: "$",
  injury: "!",
  power: "TV",
  scout: "FA",
};

const moraleLabels: Record<DashboardMoraleLevel, string> = {
  angry: "LOW",
  happy: "UP",
  neutral: "OK",
};

const alignmentLabels: Record<DashboardAlignmentLevel, string> = {
  face: "Face",
  heel: "Heel",
  neutral: "Tweener",
  unknown: "Unknown",
};

const alignmentMarks: Record<DashboardAlignmentLevel, string> = {
  face: "😇",
  heel: "😈",
  neutral: "😐",
  unknown: "❔",
};

export function DashboardDynastyAlert({ alert }: { alert: DashboardAlert }) {
  return (
    <div className={`dashboard-dynasty-alert dashboard-dynasty-alert--${alert.tone}`}>
      <span aria-hidden="true">{alertLabels[alert.icon]}</span>
      <strong title={alert.message}>{alert.message}</strong>
    </div>
  );
}

export function DashboardDynastyIntensityMeter({ value }: { value: number }) {
  const activeBlocks = Math.max(0, Math.min(10, Math.round(value / 10)));

  return (
    <div className="dashboard-dynasty-led-meter" aria-label={`Intensity ${value}`}>
      {Array.from({ length: 10 }, (_, index) => (
        <span className={index < activeBlocks ? "is-hot" : ""} key={index} />
      ))}
    </div>
  );
}

export function DashboardDynastyMorale({ morale }: { morale: DashboardMoraleLevel }) {
  return (
    <span className={`dashboard-dynasty-morale dashboard-dynasty-morale--${morale}`} aria-label={`Morale ${morale}`}>
      {moraleLabels[morale]}
    </span>
  );
}

export function DashboardDynastyPortrait({ wrestler, size = "md" }: { wrestler: Pick<Wrestler, "id" | "name">; size?: PortraitSize }) {
  return <SuperstarPortrait className={portraitSizeClass[size]} wrestler={wrestler} />;
}

export function DashboardDynastyProgress({ complete, progress }: { complete: boolean; progress: number }) {
  const pct = complete ? 100 : Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div className="dashboard-dynasty-progress" aria-hidden="true">
      <span className={complete ? "is-complete" : ""} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DashboardDynastyAlignment({ alignment }: { alignment: DashboardAlignmentLevel }) {
  return (
    <span
      className={`dashboard-dynasty-alignment dashboard-dynasty-alignment--${alignment}`}
      aria-label={alignmentLabels[alignment]}
      title={alignmentLabels[alignment]}
    >
      {alignmentMarks[alignment]}
    </span>
  );
}

export function DashboardDynastyStatValue({
  delta,
  label,
  value,
}: {
  delta?: number;
  label: string;
  value: number;
}) {
  const deltaLabel = delta === undefined ? null : `${delta > 0 ? "+" : ""}${delta}`;
  const ariaLabel =
    delta === undefined ? `${label} ${value}` : `${label} ${value}, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} last week`;

  return (
    <span className="dashboard-dynasty-stat-value" aria-label={ariaLabel}>
      <strong>{value}</strong>
      {deltaLabel && delta !== undefined ? <em className={delta > 0 ? "is-up" : "is-down"}>{deltaLabel}</em> : null}
    </span>
  );
}

export function DashboardDynastyStamina({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="dashboard-dynasty-stamina" aria-label={`Stamina ${pct}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DashboardDynastyShowScoreChart({ points }: { points: Array<{ label: string; value: number }> }) {
  if (!points.length) {
    return (
      <div className="dashboard-dynasty-chart-shell">
        <svg className="dashboard-dynasty-chart dashboard-dynasty-chart--empty" preserveAspectRatio="xMidYMid meet" viewBox="0 0 280 92" role="img" aria-label="No show history yet">
          <text className="dashboard-dynasty-chart-label" x="140" y="48" textAnchor="middle">
            No resolved shows
          </text>
        </svg>
      </div>
    );
  }

  const width = 280;
  const height = 92;
  const padX = 16;
  const padTop = 18;
  const padBottom = 18;
  const plotHeight = height - padTop - padBottom;
  const plotRight = width - 12;
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const range = Math.max(maxValue - minValue, 1);
  const coords = points.map((point, index) => {
    const x = padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const y = padTop + (1 - (point.value - minValue) / range) * plotHeight;

    return { label: point.label, x, y };
  });
  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

  return (
    <div className="dashboard-dynasty-chart-shell">
      <svg className="dashboard-dynasty-chart" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent show score trend">
        <defs>
          <linearGradient id="dashboardDynastyChartGlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--dashboard-dynasty-accent)" />
            <stop offset="100%" stopColor="var(--dashboard-dynasty-hot)" />
          </linearGradient>
        </defs>
        <path className="dashboard-dynasty-chart-grid" d={`M12 18H${plotRight}M12 46H${plotRight}M12 74H${plotRight}`} />
        <path className="dashboard-dynasty-chart-shadow" d={linePath} />
        <path className="dashboard-dynasty-chart-line" d={linePath} />
        {coords.map((point) => (
          <circle className="dashboard-dynasty-chart-node" cx={point.x} cy={point.y} r="3.8" key={point.label} />
        ))}
        {coords.map((point) => (
          <text className="dashboard-dynasty-chart-label" x={point.x} y="89" key={`${point.label}-label`} textAnchor="middle">
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
