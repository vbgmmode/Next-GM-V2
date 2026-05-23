import type { GMStyle } from "../game/types";
import type { GmPersona } from "../game/gmPersonas";

export function SetupGmPortraitGrid({
  onSelect,
  personas,
  selectedStyle,
}: {
  onSelect: (persona: GmPersona) => void;
  personas: GmPersona[];
  selectedStyle: GMStyle;
}) {
  return (
    <div className="setup-gm-portrait-grid" role="listbox" aria-label="Choose GM">
      {personas.map((persona) => {
        const isSelected = selectedStyle === persona.style;

        return (
          <button
            aria-selected={isSelected}
            className={isSelected ? "is-selected" : ""}
            key={persona.style}
            onClick={() => onSelect(persona)}
            role="option"
            type="button"
          >
            <img alt="" className="setup-gm-portrait-image" src={persona.portraitSrc} />
            <span className="setup-gm-portrait-copy">
              <strong>{persona.name}</strong>
              <small>{persona.style}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
