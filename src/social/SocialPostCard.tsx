import type { ReactNode } from "react";
import { SuperstarPortrait } from "../components/SuperstarPortrait";
import type { GameState, SocialPost, Wrestler } from "../game/types";
import {
  formatEngagementCount,
  formatFanFeedLabel,
  getRelatedWrestlerNames,
  getSocialAuthorInitials,
  getSocialAuthorMeta,
  getSocialPostEngagement,
  getWrestlerFeedHandle,
} from "./socialReads";
import type { WrestlerJabItem } from "./socialTypes";

function SocialActionIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span aria-hidden="true" className="social-timeline-action-icon">
      {children}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function SocialPostCard({ game, post }: { game: GameState; post: SocialPost }) {
  const { displayName, handle } = getSocialAuthorMeta(post.author);
  const initials = getSocialAuthorInitials(post.author);
  const engagement = getSocialPostEngagement(post.id);
  const relatedNames = getRelatedWrestlerNames(post, game.wrestlers);

  return (
    <article className={`social-timeline-post tone-${post.tone}`}>
      <div aria-hidden="true" className="social-timeline-avatar">
        <span>{initials}</span>
      </div>

      <div className="social-timeline-post-body">
        <header className="social-timeline-post-head">
          <div className="social-timeline-author-line">
            <strong className="social-timeline-display-name">{displayName}</strong>
            <span className="social-timeline-handle">{handle}</span>
            <span aria-hidden="true" className="social-timeline-dot">
              ·
            </span>
            <span className="social-timeline-time">
              S{post.seasonNumber} W{post.weekNumber}
            </span>
          </div>
          <span className={`social-timeline-category tone-${post.tone}`}>{formatFanFeedLabel(post.category)}</span>
        </header>

        <p className="social-timeline-text">{post.text}</p>

        <div className="social-timeline-meta">
          <span>{post.showName}</span>
          {relatedNames ? <span>{relatedNames}</span> : null}
        </div>

        <footer className="social-timeline-actions" aria-label="Post engagement">
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Replies">
              <svg viewBox="0 0 24 24">
                <path d="M1.751 10c0-4.42 3.58-8 8-8h4.5c4.42 0 8 3.58 8 8v1.5c0 4.42-3.58 8-8 8h-1.1l-3.2 2.4v-2.4H9.75c-4.42 0-8-3.58-8-8V10Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.replies)}</span>
          </button>
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Reposts">
              <svg viewBox="0 0 24 24">
                <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2h4v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88Zm15 16.24-4.432-4.14 1.364-1.46L18.5 16.45V8c0-1.1-.896-2-2-2h-4V4h4.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.reposts)}</span>
          </button>
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Likes">
              <svg viewBox="0 0 24 24">
                <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.109 6.83 3.86-2.56 6.043-4.86 7.117-6.83 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91Zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.likes)}</span>
          </button>
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Views">
              <svg viewBox="0 0 24 24">
                <path d="M8.75 21V3h2v18h-2ZM18 21V8.5h2V21h-2ZM4 21v-9h2v9H4Zm12.25 0v-5h2v5h-2Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.views)}</span>
          </button>
        </footer>
      </div>
    </article>
  );
}

export function WrestlerFeedCard({
  item,
  weekLabel,
  wrestler,
}: {
  item: WrestlerJabItem;
  weekLabel: string;
  wrestler?: Wrestler;
}) {
  const engagement = getSocialPostEngagement(item.id);
  const handle = getWrestlerFeedHandle(item.authorName);

  return (
    <article className={`social-timeline-post tone-${item.tone} is-superstar-post`}>
      {wrestler ? (
        <SuperstarPortrait className="social-timeline-portrait" wrestler={wrestler} />
      ) : (
        <div aria-hidden="true" className="social-timeline-avatar">
          <span>{item.authorName.slice(0, 2).toUpperCase()}</span>
        </div>
      )}

      <div className="social-timeline-post-body">
        <header className="social-timeline-post-head">
          <div className="social-timeline-author-line">
            <strong className="social-timeline-display-name">{item.authorName}</strong>
            <span className="social-timeline-handle">{handle}</span>
            <span aria-hidden="true" className="social-timeline-dot">
              ·
            </span>
            <span className="social-timeline-time">{weekLabel}</span>
          </div>
          <span className={`social-timeline-category tone-${item.tone}`}>{item.intentLabel}</span>
        </header>

        <p className="social-timeline-text">{item.jab}</p>

        <div className="social-timeline-meta">
          <span>@{item.targetName}</span>
          <span>Rivalry bait</span>
        </div>

        <footer className="social-timeline-actions" aria-label="Post engagement">
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Replies">
              <svg viewBox="0 0 24 24">
                <path d="M1.751 10c0-4.42 3.58-8 8-8h4.5c4.42 0 8 3.58 8 8v1.5c0 4.42-3.58 8-8 8h-1.1l-3.2 2.4v-2.4H9.75c-4.42 0-8-3.58-8-8V10Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.replies)}</span>
          </button>
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Reposts">
              <svg viewBox="0 0 24 24">
                <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2h4v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88Zm15 16.24-4.432-4.14 1.364-1.46L18.5 16.45V8c0-1.1-.896-2-2-2h-4V4h4.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.reposts)}</span>
          </button>
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Likes">
              <svg viewBox="0 0 24 24">
                <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.109 6.83 3.86-2.56 6.043-4.86 7.117-6.83 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91Zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.likes)}</span>
          </button>
          <button className="social-timeline-action" disabled type="button">
            <SocialActionIcon label="Views">
              <svg viewBox="0 0 24 24">
                <path d="M8.75 21V3h2v18h-2ZM18 21V8.5h2V21h-2ZM4 21v-9h2v9H4Zm12.25 0v-5h2v5h-2Z" />
              </svg>
            </SocialActionIcon>
            <span>{formatEngagementCount(engagement.views)}</span>
          </button>
        </footer>
      </div>
    </article>
  );
}
