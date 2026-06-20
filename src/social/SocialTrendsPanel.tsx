import { SuperstarPortrait } from "../components/SuperstarPortrait";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { GameState, Wrestler } from "../game/types";
import { getCurrentSocialInboxRequest } from "../game/socialInboxActions";
import { getSuperstarMailSnapshot } from "./socialReads";
import type { SuperstarMailDecision, SuperstarMailItem } from "./socialTypes";

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

function isRequestRepresentedOnCard(game: GameState, item: SuperstarMailItem) {
  return game.currentShow.some((segment) => {
    if (!segment.participantIds.includes(item.wrestlerId)) {
      return false;
    }

    if (item.action?.type === "title_shot") {
      return Boolean(segment.championshipId);
    }

    if (item.action?.type === "story_spot") {
      return Boolean(segment.rivalryId) || segment.type === "Promo" || segment.type === "Backstage Angle" || segment.type === "Contract Signing";
    }

    return item.action?.type === "tv_time";
  });
}

function getDecisionImpactText(decision: SuperstarMailDecision) {
  return decision === "accept" ? "Immediate reaction: morale +1, trust +2." : "Immediate reaction: morale -3, trust -2.";
}

function getRequestDeadlineText(game: GameState, item: SuperstarMailItem) {
  const request = getCurrentSocialInboxRequest(game, item.id, item.wrestlerId);

  if (!request || request.status !== "accepted") {
    return undefined;
  }

  if (request.actionType === "rest") {
    return "Must do: keep them off this week's card.";
  }

  return `Must do by Week ${request.deadlineWeekNumber}: ${request.note ?? "represent this ask on the card."}`;
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
  game,
  item,
  onSelect,
  onSuperstarMailAction,
  read,
  wrestler,
}: {
  game: GameState;
  expanded: boolean;
  item: SuperstarMailItem;
  onSelect: () => void;
  onSuperstarMailAction?: (item: SuperstarMailItem, decision: SuperstarMailDecision) => void;
  read: boolean;
  wrestler?: Wrestler;
}) {
  const mailDetail = getSuperstarMailDetail(wrestler);
  const currentRequest = getCurrentSocialInboxRequest(game, item.id, item.wrestlerId);
  const actionDisabled = Boolean(currentRequest);
  const accepted = currentRequest?.status === "accepted";
  const declined = currentRequest?.status === "declined";
  const decisionStatus = accepted
    ? isRequestRepresentedOnCard(game, item)
      ? "Accepted. Represented on current card."
      : "Accepted. Still pending on current card."
    : declined
      ? "Declined. Request closed for this week."
      : item.action?.detail;
  const deadlineText = getRequestDeadlineText(game, item);
  const impactText = currentRequest ? getDecisionImpactText(currentRequest.status === "accepted" ? "accept" : "decline") : undefined;

  return (
    <article
      className={`social-mail-row tone-${item.tone}${expanded ? " is-expanded" : ""}${read ? " is-read" : " is-unread"}`}
    >
      <button aria-expanded={expanded} className="social-mail-row-trigger" onClick={onSelect} type="button">
        {wrestler ? <SuperstarPortrait className="social-mail-portrait" wrestler={wrestler} /> : null}
        <span className="social-mail-copy">
          <span className="social-mail-head">
            <strong>{item.wrestlerName}</strong>
            <span>{read ? "Read" : "Unread"}</span>
          </span>
          <span className="social-mail-subject">
            <em>{item.subject}</em>
            <b>{item.askLabel}</b>
          </span>
          {expanded ? (
            <>
              <span className="social-mail-body">{item.body}</span>
              <span className="social-mail-meta">
                <span>{mailDetail.stats}</span>
                <span>{mailDetail.disclaimer}</span>
              </span>
            </>
          ) : (
            <span className="social-mail-preview">{item.preview}</span>
          )}
        </span>
      </button>
      {expanded && item.action ? (
        <div className="social-mail-action-row">
          <button className="social-mail-action" disabled={actionDisabled} onClick={() => onSuperstarMailAction?.(item, "accept")} type="button">
            {accepted ? "Accepted" : declined ? "Accept Closed" : item.action.label}
          </button>
          <button className="social-mail-action social-mail-action-decline" disabled={actionDisabled} onClick={() => onSuperstarMailAction?.(item, "decline")} type="button">
            {declined ? "Declined" : accepted ? "Decline Closed" : "Decline"}
          </button>
          <small>
            {decisionStatus}
            {impactText ? ` ${impactText}` : ""}
            {deadlineText ? ` ${deadlineText}` : ""}
          </small>
        </div>
      ) : null}
    </article>
  );
}

export function SocialTrendsPanel({
  game,
  onSuperstarMailAction,
}: {
  game: GameState;
  onSuperstarMailAction?: (item: SuperstarMailItem, decision: SuperstarMailDecision) => void;
}) {
  const mailSnapshot = useMemo(() => getSuperstarMailSnapshot(game, 3), [game]);
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
            {mailSnapshot.items.length ? (
              mailSnapshot.items.map((item) => (
                <SuperstarMailRow
                  game={game}
                  expanded={expandedMailId === item.id}
                  item={item}
                  key={item.id}
                  onSelect={() => handleMailSelect(item.id)}
                  onSuperstarMailAction={onSuperstarMailAction}
                  read={readMailIds.has(item.id)}
                  wrestler={game.wrestlers.find((wrestler) => wrestler.id === item.wrestlerId)}
                />
              ))
            ) : (
              <div className="social-mail-empty">
                <strong>No active asks</strong>
                <span>Nothing needs a direct promise from the GM desk this week.</span>
              </div>
            )}
          </div>
        </SocialTrendCard>
      ) : null}
    </aside>
  );
}
