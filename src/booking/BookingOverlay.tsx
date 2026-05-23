import type { ReactNode } from "react";

type Props = {
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
};

export function BookingOverlay({ ariaLabel, children, footer, onClose, title, wide }: Props) {
  return (
    <div className="booking-overlay-root" role="presentation">
      <button aria-label="Close overlay" className="booking-overlay-scrim" onClick={onClose} type="button" />
      <section
        aria-label={ariaLabel}
        className={`booking-overlay-panel ${wide ? "is-wide" : ""} ${footer ? "has-footer" : ""}`.trim()}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="booking-overlay-head">
          <h3>{title}</h3>
          <button aria-label="Close" className="booking-btn booking-btn-ghost booking-btn-icon" onClick={onClose} type="button">
            ✕
          </button>
        </header>
        <div className="booking-overlay-body">{children}</div>
        {footer ? <footer className="booking-overlay-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
