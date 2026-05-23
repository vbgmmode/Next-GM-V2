import { createNewGame, createRivalGMAssignments, draftPool, defaultCareer, type NewCareerOptions } from "@game/seed";
import type { BrandStyle, GameState, Segment, ShowResult } from "@game/types";

export const DRAFT_PICK_COUNT = 12;

export type LiveDeskFixtureId = "week-pressure" | "go-home-ple" | "post-show-fallout";

export type LiveDeskScene = "brand-hq" | "rundown" | "recap" | "week-review";

export type LiveDeskFixture = {
  id: LiveDeskFixtureId;
  label: string;
  description: string;
  defaultScene: LiveDeskScene;
  game: GameState;
  result?: ShowResult;
};

export function createFixtureBase(options: NewCareerOptions = {}) {
  const draftedWrestlers = draftPool.slice(0, DRAFT_PICK_COUNT);
  return createNewGame({
    ...defaultCareer,
    draftedWrestlers,
    rivalGMAssignments: createRivalGMAssignments(options.brandStyle ?? defaultCareer.brandStyle),
    ...options,
  });
}

export function createSegment(
  id: string,
  type: Segment["type"],
  participantIds: string[],
  extras: Partial<Segment> = {},
): Segment {
  return { id, type, participantIds, ...extras };
}

export function wrestlerIds(game: GameState, count: number) {
  return game.wrestlers.slice(0, count).map((wrestler) => wrestler.id);
}

export function withGamePatch(game: GameState, patch: Partial<GameState>): GameState {
  return { ...game, ...patch };
}

export function formatMoney(amount: number) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString()}`;
}

export function brandInitials(brandName: string) {
  return brandName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function wrestlerInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function mapBrandSkin(brandStyle: BrandStyle) {
  const normalized = brandStyle.toLowerCase();
  if (normalized.includes("smackdown") || normalized.includes("blue")) return "blue";
  if (normalized.includes("nxt") || normalized.includes("gold")) return "gold";
  if (normalized.includes("aew") || normalized.includes("fight")) return "fight-gold";
  return "red";
}
