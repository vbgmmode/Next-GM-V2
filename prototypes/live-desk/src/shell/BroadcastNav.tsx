import type { LiveDeskScene } from "../fixtures";

type NavItem = {
  id: LiveDeskScene | "results";
  label: string;
  disabled?: boolean;
  attention?: boolean;
};

type BroadcastNavProps = {
  activeScene: LiveDeskScene;
  hasResults: boolean;
  cardNeedsAttention: boolean;
  onNavigate: (scene: LiveDeskScene) => void;
  brandInitials: string;
};

export function BroadcastNav({ activeScene, hasResults, cardNeedsAttention, onNavigate, brandInitials }: BroadcastNavProps) {
  const items: NavItem[] = [
    { id: "brand-hq", label: "Brand HQ" },
    { id: "rundown", label: "Book Show", attention: cardNeedsAttention },
    { id: "recap", label: "Results", disabled: !hasResults },
    { id: "week-review", label: "Week Review", disabled: !hasResults },
  ];

  return (
    <nav className="ld-nav" aria-label="Live desk navigation">
      <div className="ld-nav-bumper">{brandInitials}</div>
      <div className="ld-nav-tabs">
        {items.map((item) => {
          const isActive = item.id === "results" ? activeScene === "recap" : activeScene === item.id;
          const isDisabled = item.disabled;
          return (
            <button
              key={item.id}
              type="button"
              className={`ld-nav-tab${isActive ? " is-active" : ""}${isDisabled ? " is-disabled" : ""}`}
              disabled={isDisabled}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (!isDisabled && item.id !== "results") {
                  onNavigate(item.id as LiveDeskScene);
                } else if (!isDisabled && item.id === "results") {
                  onNavigate("recap");
                }
              }}
            >
              {item.label}
              {item.attention ? <span className="ld-nav-attention" aria-label="Needs attention" /> : null}
            </button>
          );
        })}
      </div>
      <div className="ld-nav-bumper">GM</div>
    </nav>
  );
}
