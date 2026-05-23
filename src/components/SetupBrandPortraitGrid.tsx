import type { BrandChair } from "../game/brandChairs";
import type { BrandStyle } from "../game/types";

export function SetupBrandPortraitGrid({
  chairs,
  onSelect,
  selectedStyle,
}: {
  chairs: BrandChair[];
  onSelect: (chair: BrandChair) => void;
  selectedStyle: BrandStyle;
}) {
  return (
    <div className="setup-brand-portrait-grid" role="listbox" aria-label="Choose brand">
      {chairs.map((chair) => {
        const isSelected = selectedStyle === chair.style;

        return (
          <button
            aria-selected={isSelected}
            className={isSelected ? "is-selected" : ""}
            key={chair.style}
            onClick={() => onSelect(chair)}
            role="option"
            type="button"
          >
            <img alt={chair.style} className="setup-brand-portrait-image" src={chair.portraitSrc} />
          </button>
        );
      })}
    </div>
  );
}
