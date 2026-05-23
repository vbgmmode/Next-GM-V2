import type { GameState } from "@game/types";
import { DynastyPanel, DynastyScrollList } from "../components/DynastyPanel";

type Props = { game: GameState };

export function SocialScene({ game }: Props) {
  const posts = [...game.socialPosts].reverse().slice(0, 12);

  return (
    <section className="dynasty-social-grid dynasty-page-grid">
      <DynastyPanel kicker="IWC Pulse" title="Social Feed" badge={`${posts.length} Posts`}>
        <div className="dynasty-chip-row">
          {["All", "Buzz", "Backlash", "Praise"].map((filter, index) => (
            <span className={index === 0 ? "filter-chip is-active" : "filter-chip"} key={filter}>
              {filter}
            </span>
          ))}
        </div>
        <DynastyScrollList>
          {posts.map((post) => (
            <div className="dynasty-social-row" key={post.id}>
              <strong>{post.author}</strong>
              <span>{post.category}</span>
              <p>{post.text}</p>
            </div>
          ))}
        </DynastyScrollList>
      </DynastyPanel>
    </section>
  );
}
