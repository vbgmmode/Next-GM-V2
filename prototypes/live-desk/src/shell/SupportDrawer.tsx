import type { ReactNode } from "react";

type SupportDrawerProps = {
  label: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function SupportDrawer({ label, summary, open, onToggle, children }: SupportDrawerProps) {
  return (
    <section className={`ld-support-drawer ld-panel--secondary${open ? " is-open" : ""}`}>
      <button type="button" className="ld-support-drawer__toggle ld-secondary" onClick={onToggle}>
        {open ? `Hide ${label}` : `Show ${label}`}
      </button>
      {summary && !open ? <p className="ld-support-drawer__summary">{summary}</p> : null}
      {open ? <div className="ld-support-drawer__body">{children}</div> : null}
    </section>
  );
}
