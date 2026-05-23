import type { ReactNode } from "react";

export function BookingPanel({
  badge,
  children,
  className = "",
  kicker,
  title,
}: {
  badge?: string;
  children: ReactNode;
  className?: string;
  kicker?: string;
  title?: string;
}) {
  return (
    <article className={`booking-panel ${className}`.trim()}>
      {kicker ? <div className="booking-panel-kicker">{kicker}</div> : null}
      {title || badge ? (
        <div className="booking-panel-heading">
          <span>{title}</span>
          {badge ? <b>{badge}</b> : null}
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function BookingMetricGrid({ items }: { items: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <div className="booking-metric-grid">
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