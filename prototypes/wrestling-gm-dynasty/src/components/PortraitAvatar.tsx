import type { WrestlerPortrait } from "../data/mockDashboard";

type PortraitSize = "sm" | "md" | "lg";

type Props = {
  portrait: WrestlerPortrait;
  size?: PortraitSize;
  className?: string;
};

const sizeMap: Record<PortraitSize, number> = {
  sm: 22,
  md: 32,
  lg: 48,
};

export function PortraitAvatar({ portrait, size = "md", className = "" }: Props) {
  const px = sizeMap[size];

  return (
    <span
      className={`portrait-avatar portrait-avatar--${size} ${className}`.trim()}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" width={px} height={px}>
        <rect width="40" height="40" fill={portrait.gear} opacity="0.35" />
        <ellipse cx="20" cy="22" rx="12" ry="14" fill={portrait.skin} />
        <path
          d="M8 14c4-10 20-10 24 0l-4 8c-6-6-18-6-20 0z"
          fill={portrait.hair}
        />
        <rect x="10" y="32" width="20" height="8" fill={portrait.gear} />
      </svg>
    </span>
  );
}
