import { useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SocialPostCard, WrestlerFeedCard } from "./SocialPostCard";
import { SocialTrendsPanel } from "./SocialTrendsPanel";
import { getFanFeedPosts, getWrestlerJabFeed } from "./socialReads";
import type { SocialScreenProps, SocialTimelineTab } from "./socialTypes";

const TAB_OPTIONS: { id: SocialTimelineTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "iwc", label: "IWC" },
  { id: "superstars", label: "Superstars" },
];

export function SocialScreen({ game, latestResult, onNavigate, onSuperstarMailAction }: SocialScreenProps) {
  const [tab, setTab] = useState<SocialTimelineTab>("all");
  const fanPosts = useMemo(() => getFanFeedPosts(game), [game.socialPosts]);
  const jabFeed = useMemo(() => getWrestlerJabFeed(game, 10), [game]);
  const hasFanPosts = fanPosts.length > 0;
  const hasSuperstarPosts = Boolean(jabFeed?.items.length);
  const showAllFeed = tab === "all" && (hasFanPosts || hasSuperstarPosts);
  const showIwcFeed = tab === "iwc" && hasFanPosts;
  const showSuperstarFeed = tab === "superstars" && hasSuperstarPosts;

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
              <h2>IWC</h2>
            </header>

            <div className="social-timeline-tabs" aria-label="Timeline filters" role="tablist">
              {TAB_OPTIONS.map((option) => (
                <button
                  aria-selected={tab === option.id}
                  className={`social-timeline-tab ${tab === option.id ? "is-active" : ""}`}
                  key={option.id}
                  onClick={() => setTab(option.id)}
                  role="tab"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="social-timeline-feed" aria-label="Social posts">
              {showAllFeed ? (
                <>
                  {jabFeed?.items.map((item) => (
                    <WrestlerFeedCard
                      item={item}
                      key={item.id}
                      weekLabel={jabFeed.weekLabel}
                      wrestler={game.wrestlers.find((wrestler) => wrestler.id === item.authorId)}
                    />
                  ))}
                  {fanPosts.map((post) => (
                    <SocialPostCard game={game} key={post.id} post={post} />
                  ))}
                </>
              ) : null}

              {showIwcFeed
                ? fanPosts.map((post) => <SocialPostCard game={game} key={post.id} post={post} />)
                : null}

              {showSuperstarFeed
                ? jabFeed?.items.map((item) => (
                    <WrestlerFeedCard
                      item={item}
                      key={item.id}
                      weekLabel={jabFeed.weekLabel}
                      wrestler={game.wrestlers.find((wrestler) => wrestler.id === item.authorId)}
                    />
                  ))
                : null}

              {!showAllFeed && !showIwcFeed && !showSuperstarFeed ? (
                <div className="social-timeline-empty">
                  <strong>
                    {tab === "superstars"
                      ? "No superstar callouts yet."
                      : game.socialPosts.length
                        ? "No fan posts in this lane yet."
                        : "The timeline is quiet."}
                  </strong>
                  <p>
                    {tab === "superstars"
                      ? "Run a show and roster heat will start showing up as direct callouts."
                      : game.socialPosts.length
                        ? "Try another tab to see the rest of the feed."
                        : "Run a show and the IWC will react after the results land."}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <SocialTrendsPanel game={game} onSuperstarMailAction={onSuperstarMailAction} />
        </div>
      </section>
    </DynastyManagementShell>
  );
}

