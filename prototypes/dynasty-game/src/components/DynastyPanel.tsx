import type { ReactNode } from "react";

export function DynastyPanel({
  kicker,
  title,
  badge,
  children,
  className = "",
}: {
  kicker?: string;
  title?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`panel ${className}`.trim()}>
      {kicker ? <div className="panel-kicker">{kicker}</div> : null}
      {title || badge ? <DynastySectionHeading title={title ?? ""} badge={badge} /> : null}
      {children}
    </article>
  );
}

export function DynastySectionHeading({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="section-heading">
      <span>{title}</span>
      {badge ? <b>{badge}</b> : null}
    </div>
  );
}

export function DynastyMetricGrid({ items }: { items: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <div className="metric-grid dynasty-metric-grid">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>
            {item.value}
            {item.detail ? <em>{item.detail}</em> : null}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function DynastyPrimaryAction({
  actions,
}: {
  actions: Array<{ label: string; primary?: boolean; onClick?: () => void }>;
}) {
  return (
    <div className="action-row dynasty-action-row">
      {actions.map((action) => (
        <button
          className={action.primary ? "primary-action" : undefined}
          key={action.label}
          type="button"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function DynastyScrollList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dynasty-scroll-list ${className}`.trim()}>{children}</div>;
}
