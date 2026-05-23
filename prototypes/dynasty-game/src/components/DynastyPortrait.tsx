import { SuperstarPortrait } from "@components/SuperstarPortrait";
import type { Wrestler } from "@game/types";

type PortraitSize = "sm" | "md" | "lg";

const sizeClass: Record<PortraitSize, string> = {
  sm: "dynasty-portrait--sm",
  md: "dynasty-portrait--md",
  lg: "dynasty-portrait--lg",
};

type Props = {
  wrestler: Pick<Wrestler, "id" | "name">;
  size?: PortraitSize;
};

export function DynastyPortrait({ wrestler, size = "md" }: Props) {
  return <SuperstarPortrait className={sizeClass[size]} wrestler={wrestler} />;
}
