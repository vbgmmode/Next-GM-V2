import type { ReactNode } from "react";
import { getBroadcastThemeClassName } from "@components/broadcast";
import type { BrandStyle } from "@game/types";
import { mapBrandSkin } from "../fixtures/shared";

type BroadcastShellProps = {
  brandStyle: BrandStyle;
  weekPhase?: "normal" | "go-home" | "ple";
  prototypeControls: ReactNode;
  nav: ReactNode;
  hud: ReactNode;
  ticker?: ReactNode;
  lowerThird: ReactNode;
  children: ReactNode;
};

export function BroadcastShell({
  brandStyle,
  weekPhase = "normal",
  prototypeControls,
  nav,
  hud,
  ticker,
  lowerThird,
  children,
}: BroadcastShellProps) {
  const themeClass = getBroadcastThemeClassName(
    mapBrandSkin(brandStyle) === "blue"
      ? "blue"
      : mapBrandSkin(brandStyle) === "gold"
        ? "gold"
        : mapBrandSkin(brandStyle) === "fight-gold"
          ? "fight"
          : "red",
  );

  return (
    <main
      className={`ld-shell bc-game-shell ${themeClass}`}
      data-brand-skin={mapBrandSkin(brandStyle)}
      data-week-phase={weekPhase}
    >
      <div className="ld-prototype-bar ld-panel--quiet">
        {prototypeControls}
        <span className="ld-prototype-note">Visual calm pass · fixtures only</span>
      </div>
      {nav}
      {hud}
      {ticker}
      <div className="ld-stage">{children}</div>
      {lowerThird}
    </main>
  );
}
