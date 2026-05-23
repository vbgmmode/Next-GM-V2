import type { GMStyle } from "./types";

export type GmPersona = {
  description: string;
  name: string;
  portraitSrc: string;
  style: GMStyle;
};

export const gmPersonas: GmPersona[] = [
  {
    name: "Mara Voss",
    style: "Creative Visionary",
    description: "Story-first leader built for long arcs, character turns, and patient payoffs.",
    portraitSrc: "/gm-portraits/gm-creative-visionary.png",
  },
  {
    name: "Darius Cole",
    style: "Talent Developer",
    description: "Locker-room builder who protects prospects and turns overlooked wrestlers into stars.",
    portraitSrc: "/gm-portraits/gm-talent-developer.png",
  },
  {
    name: "Vivian Cross",
    style: "Ruthless Executive",
    description: "Business-first operator who makes cold calls when the pressure hits.",
    portraitSrc: "/gm-portraits/gm-ruthless-executive.png",
  },
  {
    name: "Jett Mercer",
    style: "Ratings Chaser",
    description: "Spectacle-first GM chasing headlines, big swings, and must-watch TV.",
    portraitSrc: "/gm-portraits/gm-ratings-chaser.png",
  },
  {
    name: "Tanya Briggs",
    style: "Locker Room General",
    description: "Morale-first leader who keeps egos aligned and the room bought in.",
    portraitSrc: "/gm-portraits/gm-locker-room-general.png",
  },
  {
    name: "Malik Saint",
    style: "Star Maker",
    description: "Obsessed with finding the next face of the company before everyone else sees it.",
    portraitSrc: "/gm-portraits/gm-star-maker.png",
  },
  {
    name: "Roxy Vale",
    style: "Chaos Booker",
    description: "Thrives on swerves, shocks, controversy, and wild live-TV energy.",
    portraitSrc: "/gm-portraits/gm-chaos-booker.png",
  },
  {
    name: "Grant Keller",
    style: "Sports Realist",
    description: "Treats the brand like a fight league where rankings, stakes, and credibility matter.",
    portraitSrc: "/gm-portraits/gm-sports-realist.png",
  },
  {
    name: "Selene Drake",
    style: "Brand Architect",
    description: "Builds a clear identity, sharp presentation, and a long-term audience promise.",
    portraitSrc: "/gm-portraits/gm-brand-architect.png",
  },
  {
    name: "Hank Calloway",
    style: "Veteran Operator",
    description: "Steady, political, experienced, and hard to rattle when the office gets loud.",
    portraitSrc: "/gm-portraits/gm-veteran-operator.png",
  },
  {
    name: "Indigo Knox",
    style: "Cult Favorite",
    description: "Internet-savvy and fan-trust driven, with room for unconventional acts.",
    portraitSrc: "/gm-portraits/gm-cult-favorite.png",
  },
  {
    name: "Victor Sterling",
    style: "Big Money Promoter",
    description: "Sells premium attractions, business spectacle, and the biggest room possible.",
    portraitSrc: "/gm-portraits/gm-big-money-promoter.png",
  },
];

export function getGmPersonaByStyle(style: GMStyle) {
  return gmPersonas.find((persona) => persona.style === style) ?? gmPersonas[0];
}
