import type { ReactNode } from "react";
import type { ProfilePanelId } from "./rosterTypes";

export function RosterProfilePanel({
  children,
  className,
  expanded,
  eyebrow,
  id,
  onToggle,
  summary,
  title,
}: {
  children: ReactNode;
  className?: string;
  expanded: boolean;
  eyebrow: string;
  id: ProfilePanelId;
  onToggle: (id: ProfilePanelId) => void;
  summary: string;
  title: string;
}) {
  const contentId = `profile-panel-${id}`;

  return (
    <section className={`roster-profile-panel roster-profile-expandable ${expanded ? "expanded" : "collapsed"} ${className ?? ""}`} aria-label={eyebrow}>
      <button className="roster-profile-expandable-head" type="button" aria-controls={contentId} aria-expanded={expanded} onClick={() => onToggle(id)}>
        <span>
          <em>{eyebrow}</em>
          <strong>{title}</strong>
        </span>
        <b>{expanded ? "Collapse" : "Expand"}</b>
      </button>
      <p className="roster-profile-panel-summary">{summary}</p>
      {expanded ? (
        <div className="roster-profile-panel-body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
