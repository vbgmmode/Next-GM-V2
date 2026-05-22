import type { Morale } from "../data/mockDashboard";

type Props = {
  morale: Morale;
};

const emoji: Record<Morale, string> = {
  happy: "😊",
  neutral: "😐",
  angry: "😠",
};

export function MoraleEmoji({ morale }: Props) {
  return (
    <span className={`morale-emoji morale-emoji--${morale}`} aria-label={`Morale ${morale}`}>
      {emoji[morale]}
    </span>
  );
}
