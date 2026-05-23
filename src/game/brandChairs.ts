import type { BrandStyle } from "./types";

export type BrandChair = {
  description: string;
  portraitSrc: string;
  style: BrandStyle;
};

export const brandChairs: BrandChair[] = [
  {
    style: "Raw",
    description: "Flagship spectacle with big personalities, weekly pressure, and mainstream sports-entertainment energy.",
    portraitSrc: "/brand-portraits/brand-raw.png",
  },
  {
    style: "SmackDown",
    description: "Sharp blue-brand identity with star power, athletic confidence, and prime-time polish.",
    portraitSrc: "/brand-portraits/brand-smackdown.png",
  },
  {
    style: "NXT",
    description: "Hungry prospects, breakout performances, developmental pressure, and future-stars atmosphere.",
    portraitSrc: "/brand-portraits/brand-nxt.png",
  },
  {
    style: "AEW",
    description: "Alternative wrestling identity with workrate credibility, fan-driven buzz, and unpredictable edge.",
    portraitSrc: "/brand-portraits/brand-aew.png",
  },
];

export function getBrandChairByStyle(style: BrandStyle) {
  return brandChairs.find((chair) => chair.style === style) ?? brandChairs[0];
}
