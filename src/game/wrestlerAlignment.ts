export type WrestlerAlignment = "Face" | "Heel" | "Tweener";

export const WRESTLER_ALIGNMENT_OPTIONS: WrestlerAlignment[] = ["Face", "Heel", "Tweener"];

export function isKnownWrestlerAlignment(alignment?: string) {
  const normalized = alignment?.trim().toLowerCase();

  if (!normalized || normalized === "unknown") {
    return false;
  }

  return normalized === "face" || normalized === "babyface" || normalized === "heel" || normalized === "tweener" || normalized === "neutral";
}

export function getDefaultWrestlerAlignment(wrestlerId: string): WrestlerAlignment {
  const hash = [...wrestlerId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const options: WrestlerAlignment[] = ["Face", "Heel", "Tweener"];

  return options[hash % options.length];
}

export function resolveWrestlerAlignment(alignment: string | undefined, wrestlerId: string): WrestlerAlignment {
  const normalized = alignment?.trim().toLowerCase();

  if (normalized === "face" || normalized === "babyface") {
    return "Face";
  }

  if (normalized === "heel") {
    return "Heel";
  }

  if (normalized === "tweener" || normalized === "neutral") {
    return "Tweener";
  }

  return getDefaultWrestlerAlignment(wrestlerId);
}

export function formatWrestlerAlignmentLabel(alignment: WrestlerAlignment) {
  return alignment;
}
