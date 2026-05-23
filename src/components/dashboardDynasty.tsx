import { SuperstarPortrait } from "./SuperstarPortrait";
import type { DashboardAlert, DashboardMoraleLevel, DashboardRoleLevel } from "../game/dashboardViewModel";
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

const roleLabels: Record<DashboardRoleLevel, string> = {
  ace: "Ace",
  main: "Main",
  mid: "Mid",
  prospect: "Prospect",
  tag: "Tag",
  upper: "Upper",
};

const roleMarks: Record<DashboardRoleLevel, string> = {
  ace: "A",
  main: "M",
  mid: "C",
  prospect: "P",
  tag: "T",
  upper: "U",
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

export function DashboardDynastyRole({ role }: { role: DashboardRoleLevel }) {
  return (
    <span className={`dashboard-dynasty-role dashboard-dynasty-role--${role}`} aria-label={roleLabels[role]} title={roleLabels[role]}>
      {roleMarks[role]}
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
      <svg className="dashboard-dynasty-chart dashboard-dynasty-chart--empty" viewBox="0 0 280 92" role="img" aria-label="No show history yet">
        <text className="dashboard-dynasty-chart-label" x="140" y="48" textAnchor="middle">
          No resolved shows
        </text>
      </svg>
    );
  }

  const width = 280;
  const height = 92;
  const padX = 16;
  const padTop = 18;
  const padBottom = 18;
  const plotHeight = height - padTop - padBottom;
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
    <svg className="dashboard-dynasty-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent show score trend">
      <defs>
        <linearGradient id="dashboardDynastyChartGlow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--dashboard-dynasty-accent)" />
          <stop offset="100%" stopColor="var(--dashboard-dynasty-hot)" />
        </linearGradient>
      </defs>
      <path className="dashboard-dynasty-chart-grid" d="M12 18H270M12 46H270M12 74H270" />
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
  );
}
