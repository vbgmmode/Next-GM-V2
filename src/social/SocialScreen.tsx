import { useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SocialPostCard } from "./SocialPostCard";
import { SocialTrendsPanel } from "./SocialTrendsPanel";
import { getSocialFilterCategory, getSocialFilterLabel } from "./socialReads";
import type { SocialFilter, SocialScreenProps } from "./socialTypes";

const FILTER_OPTIONS: SocialFilter[] = ["All", "Fan Reaction", "Dirt Sheets", "Analyst Takes", "Title Scene", "Rivalries"];

export function SocialScreen({ game, latestResult, onNavigate }: SocialScreenProps) {
  const [filter, setFilter] = useState<SocialFilter>("All");
  const categories = getSocialFilterCategory(filter);
  const visiblePosts = useMemo(
    () =>
      [...game.socialPosts]
        .reverse()
        .filter((post) => !categories || categories.includes(post.category)),
    [categories, game.socialPosts],
  );
  const socialCta: DynastyManagementCta = {
    eyebrow: "Next Action",
    label: "Book Show",
    onClick: () => onNavigate("booking"),
    tone: "brand",
  };

  return (
    <DynastyManagementShell className="social-dynasty-shell" currentScreen="social" cta={socialCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <section className="social-dynasty-desk" aria-label="IWC timeline desk">
        <div className="social-dynasty-layout">
          <section className="social-timeline-shell" aria-label="IWC timeline">
            <header className="social-timeline-header">
              <div>
                <p className="social-timeline-kicker">Post-Show Pulse</p>
                <h2>IWC Pulse</h2>
              </div>
              <span className="social-timeline-count">{game.socialPosts.length} posts</span>
            </header>

            <div className="social-timeline-tabs" aria-label="Timeline filters" role="tablist">
              {FILTER_OPTIONS.map((option) => (
                <button
                  aria-selected={filter === option}
                  className={`social-timeline-tab ${filter === option ? "is-active" : ""}`}
                  key={option}
                  onClick={() => setFilter(option)}
                  role="tab"
                  type="button"
                >
                  {getSocialFilterLabel(option)}
                </button>
              ))}
            </div>

            <div className="social-timeline-feed" aria-label="Social posts">
              {visiblePosts.length ? (
                visiblePosts.map((post) => <SocialPostCard game={game} key={post.id} post={post} />)
              ) : (
                <div className="social-timeline-empty">
                  <strong>{game.socialPosts.length ? "No posts match this filter." : "The timeline is quiet."}</strong>
                  <p>
                    {game.socialPosts.length
                      ? "Try another lane or clear the filter to see the full post-show reaction feed."
                      : "Run a show and the IWC will react after the results land."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <SocialTrendsPanel game={game} latestResult={latestResult} />
        </div>
      </section>
    </DynastyManagementShell>
  );
}
