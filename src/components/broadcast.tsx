import { useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";

export type BroadcastTheme = "fallback" | "red" | "blue" | "gold" | "fight";

export type BroadcastTone = "neutral" | "brand" | "prestige" | "danger" | "warning" | "positive" | "info";

type BroadcastBrandInput = string | null | undefined;

const themeClassByTheme: Record<BroadcastTheme, string> = {
  fallback: "broadcast-theme-fallback",
  red: "broadcast-theme-red",
  blue: "broadcast-theme-blue",
  gold: "broadcast-theme-gold",
  fight: "broadcast-theme-fight",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getBroadcastTheme(brandStyle: BroadcastBrandInput): BroadcastTheme {
  const normalized = String(brandStyle ?? "").trim().toLowerCase();

  if (normalized.includes("raw") || normalized.includes("red")) {
    return "red";
  }

  if (normalized.includes("smackdown") || normalized.includes("blue")) {
    return "blue";
  }

  if (normalized.includes("nxt") || normalized.includes("gold") || normalized.includes("prestige")) {
    return "gold";
  }

  if (
    normalized.includes("aew") ||
    normalized.includes("fight") ||
    normalized.includes("underground") ||
    normalized.includes("black")
  ) {
    return "fight";
  }

  return "fallback";
}

export function getBroadcastThemeClass(brandStyle: BroadcastBrandInput) {
  return themeClassByTheme[getBroadcastTheme(brandStyle)];
}

export function getBroadcastThemeClassName(theme: BroadcastTheme = "fallback") {
  return themeClassByTheme[theme];
}

type GameShellProps = HTMLAttributes<HTMLElement> & {
  brandStyle?: BroadcastBrandInput;
  theme?: BroadcastTheme;
};

export function GameShell({ brandStyle, theme, className, children, ...props }: GameShellProps) {
  const resolvedTheme = theme ?? getBroadcastTheme(brandStyle);

  return (
    <main className={cx("bc-game-shell", getBroadcastThemeClassName(resolvedTheme), className)} {...props}>
      {children}
    </main>
  );
}

type BroadcastHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
};

export function BroadcastHeader({ actions, className, eyebrow, meta, status, title, ...props }: BroadcastHeaderProps) {
  return (
    <header className={cx("bc-header", className)} {...props}>
      <div className="bc-header__identity">
        {eyebrow ? <p className="bc-eyebrow">{eyebrow}</p> : null}
        <div className="bc-header__title-row">
          <h1>{title}</h1>
          {status ? <div className="bc-header__status">{status}</div> : null}
        </div>
        {meta ? <div className="bc-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="bc-header__actions">{actions}</div> : null}
    </header>
  );
}

type CommandPanelProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
  tone?: BroadcastTone;
};

export function CommandPanel({ actions, children, className, eyebrow, footer, title, tone = "neutral", ...props }: CommandPanelProps) {
  const titleId = useId();

  return (
    <section
      className={cx("bc-command-panel", className)}
      data-tone={tone}
      aria-labelledby={title ? titleId : undefined}
      {...props}
    >
      {title || eyebrow || actions ? (
        <div className="bc-command-panel__head">
          <div>
            {eyebrow ? <p className="bc-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 id={titleId}>{title}</h2> : null}
          </div>
          {actions ? <div className="bc-command-panel__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="bc-command-panel__body">{children}</div>
      {footer ? <div className="bc-command-panel__footer">{footer}</div> : null}
    </section>
  );
}

type HeroDecisionPanelProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  children?: ReactNode;
  eyebrow?: ReactNode;
  metrics?: ReactNode;
  summary?: ReactNode;
  title: ReactNode;
};

export function HeroDecisionPanel({
  actions,
  children,
  className,
  eyebrow,
  metrics,
  summary,
  title,
  ...props
}: HeroDecisionPanelProps) {
  const titleId = useId();

  return (
    <section className={cx("bc-hero-decision", className)} aria-labelledby={titleId} {...props}>
      <div className="bc-hero-decision__copy">
        {eyebrow ? <p className="bc-eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId}>{title}</h1>
        {summary ? <p className="bc-hero-decision__summary">{summary}</p> : null}
        {children ? <div className="bc-hero-decision__body">{children}</div> : null}
      </div>
      {metrics ? <div className="bc-hero-decision__metrics">{metrics}</div> : null}
      {actions ? <div className="bc-hero-decision__actions">{actions}</div> : null}
    </section>
  );
}

type MetricTileProps = HTMLAttributes<HTMLDivElement> & {
  detail?: ReactNode;
  label: ReactNode;
  tone?: BroadcastTone;
  value: ReactNode;
};

export function MetricTile({ className, detail, label, tone = "neutral", value, ...props }: MetricTileProps) {
  return (
    <div className={cx("bc-metric-tile", className)} data-tone={tone} {...props}>
      <span className="bc-metric-tile__label">{label}</span>
      <strong className="bc-metric-tile__value">{value}</strong>
      {detail ? <small className="bc-metric-tile__detail">{detail}</small> : null}
    </div>
  );
}

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BroadcastTone;
};

export function StatusBadge({ children, className, tone = "neutral", ...props }: StatusBadgeProps) {
  return (
    <span className={cx("bc-status-badge", className)} data-tone={tone} {...props}>
      <span className="bc-status-badge__dot" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

type MeterBarProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  max?: number;
  min?: number;
  tone?: BroadcastTone;
  value: number;
  valueLabel?: ReactNode;
};

export function MeterBar({ className, label, max = 100, min = 0, tone = "brand", value, valueLabel, ...props }: MeterBarProps) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 100;
  const safeValue = Number.isFinite(value) ? Math.min(safeMax, Math.max(safeMin, value)) : safeMin;
  const percentage = ((safeValue - safeMin) / (safeMax - safeMin)) * 100;
  const displayValue = valueLabel ?? `${Math.round(percentage)}%`;

  return (
    <div className={cx("bc-meter", className)} data-tone={tone} {...props}>
      <div className="bc-meter__head">
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </div>
      <div
        className="bc-meter__track"
        role="progressbar"
        aria-label={typeof label === "string" ? label : undefined}
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
      >
        <span className="bc-meter__fill" style={{ inlineSize: `${percentage}%` }} />
      </div>
    </div>
  );
}

type TickerBarProps = HTMLAttributes<HTMLDivElement> & {
  items?: ReactNode[];
  label?: ReactNode;
};

export function TickerBar({ children, className, items, label = "Command Feed", ...props }: TickerBarProps) {
  const tickerItems = items?.length ? items : children ? [children] : [];

  return (
    <div className={cx("bc-ticker", className)} role="status" {...props}>
      <span className="bc-ticker__label">{label}</span>
      <div className="bc-ticker__items">
        {tickerItems.map((item, index) => (
          <span key={index} className="bc-ticker__item">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

type ActionBarProps = HTMLAttributes<HTMLElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ActionBar({ children, className, leading, trailing, ...props }: ActionBarProps) {
  return (
    <footer className={cx("bc-action-bar", className)} {...props}>
      {leading ? <div className="bc-action-bar__leading">{leading}</div> : null}
      <div className="bc-action-bar__actions">{children}</div>
      {trailing ? <div className="bc-action-bar__trailing">{trailing}</div> : null}
    </footer>
  );
}
