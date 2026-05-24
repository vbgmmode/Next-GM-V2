import { SuperstarPortrait } from "../components/SuperstarPortrait";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { ReactNode } from "react";
import type { GameState, Wrestler } from "../game/types";
import { getSuperstarMailSnapshot } from "./socialReads";
import type { SuperstarMailItem } from "./socialTypes";

function getSuperstarMailDetail(wrestler?: Wrestler) {
  if (!wrestler) {
    return {
      stats: "No current roster read attached.",
      disclaimer: "This request came through without live talent context.",
    };
  }

  return {
    stats: `Fatigue ${wrestler.fatigue} · Morale ${wrestler.morale} · Momentum ${wrestler.momentum}`,
    disclaimer: "Booking still runs through your card — this is a direct ask, not an auto-book.",
  };
}

function SocialTrendCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="social-trends-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function SuperstarMailRow({
  expanded,
  item,
  onSelect,
  read,
  wrestler,
}: {
  expanded: boolean;
  item: SuperstarMailItem;
  onSelect: () => void;
  read: boolean;
  wrestler?: Wrestler;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const mailDetail = getSuperstarMailDetail(wrestler);

  return (
    <article
      aria-expanded={expanded}
      className={`social-mail-row tone-${item.tone}${expanded ? " is-expanded" : ""}${read ? " is-read" : " is-unread"}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {wrestler ? <SuperstarPortrait className="social-mail-portrait" wrestler={wrestler} /> : null}
      <div className="social-mail-copy">
        <div className="social-mail-head">
          <strong>{item.wrestlerName}</strong>
          <span>{read ? "Read" : "Unread"}</span>
        </div>
        <div className="social-mail-subject">
          <em>{item.subject}</em>
          <b>{item.askLabel}</b>
        </div>
        {expanded ? (
          <>
            <p className="social-mail-body">{item.body}</p>
            <div className="social-mail-meta">
              <span>{mailDetail.stats}</span>
              <p>{mailDetail.disclaimer}</p>
            </div>
          </>
        ) : (
          <p className="social-mail-preview">{item.preview}</p>
        )}
      </div>
    </article>
  );
}

export function SocialTrendsPanel({ game }: { game: GameState }) {
  const mailSnapshot = getSuperstarMailSnapshot(game, 6);
  const mailIds = useMemo(() => mailSnapshot?.items.map((item) => item.id) ?? [], [mailSnapshot]);
  const [expandedMailId, setExpandedMailId] = useState<string | null>(null);
  const [readMailIds, setReadMailIds] = useState<Set<string>>(() => new Set());

  const unreadCount = mailSnapshot?.items.filter((item) => !readMailIds.has(item.id)).length ?? 0;

  useEffect(() => {
    setExpandedMailId(null);
    setReadMailIds(new Set());
  }, [mailIds.join("|")]);

  const handleMailSelect = (mailId: string) => {
    setExpandedMailId(mailId);
    setReadMailIds((current) => {
      const next = new Set(current);
      next.add(mailId);
      return next;
    });
  };

  useEffect(() => {
    if (!mailSnapshot?.items.length) {
      return;
    }

    setExpandedMailId((current) => current ?? mailSnapshot.items[0]?.id ?? null);
  }, [mailSnapshot]);

  return (
    <aside className="social-trends-rail social-mail-rail" aria-label="Superstar mail">
      {mailSnapshot ? (
        <SocialTrendCard title="Superstar Mail">
          <div className="social-mail-scan">
            <span>{mailSnapshot.weekLabel}</span>
            <p>{mailSnapshot.detail}</p>
            <b>{unreadCount} Unread</b>
          </div>
          <div className="social-mail-list" aria-label="Superstar inbox">
            {mailSnapshot.items.map((item) => (
              <SuperstarMailRow
                expanded={expandedMailId === item.id}
                item={item}
                key={item.id}
                onSelect={() => handleMailSelect(item.id)}
                read={readMailIds.has(item.id)}
                wrestler={game.wrestlers.find((wrestler) => wrestler.id === item.wrestlerId)}
              />
            ))}
          </div>
        </SocialTrendCard>
      ) : null}
    </aside>
  );
}
