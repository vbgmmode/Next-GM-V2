import type { Screen } from "@game/types";
import type { GameState, ShowResult } from "@game/types";
import { weekPressureFixture } from "./weekPressure";
import { postShowFalloutFixture } from "./postShowFallout";
import { goHomePleFixture } from "./goHomePle";
import type { LiveDeskFixtureId } from "./shared";
import { liveDeskFixtures } from "./index";

export type { LiveDeskFixtureId, LiveDeskFixture } from "./shared";
export { weekPressureFixture, goHomePleFixture, postShowFalloutFixture, liveDeskFixtures };

export type PlaythroughPhase = "title" | "setup" | "week1-hq" | "booking" | "results" | "weekReview" | "free";

export type PlaythroughPhaseMeta = {
  id: PlaythroughPhase;
  label: string;
  description: string;
  defaultScreen: Screen;
};

export const playthroughPhases: PlaythroughPhaseMeta[] = [
  {
    id: "title",
    label: "1 · Title Screen",
    description: "Career deck — New Career or Continue.",
    defaultScreen: "title",
  },
  {
    id: "setup",
    label: "2 · New Career Setup",
    description: "Contract → GM → Brand → Rules → Draft.",
    defaultScreen: "setup",
  },
  {
    id: "week1-hq",
    label: "3 · Brand HQ",
    description: "Week-pressure dashboard — incomplete card, rivalry heat.",
    defaultScreen: "dashboard",
  },
  {
    id: "booking",
    label: "4 · Booking Desk",
    description: "Production rundown and card builder.",
    defaultScreen: "booking",
  },
  {
    id: "results",
    label: "5 · Show Results",
    description: "Post-show broadcast recap and segment ledger.",
    defaultScreen: "results",
  },
  {
    id: "weekReview",
    label: "6 · Week Review",
    description: "GM office after-action and calendar handoff.",
    defaultScreen: "weekReview",
  },
  {
    id: "free",
    label: "Free Roam",
    description: "Jump any GameNav tab with selected fixture data.",
    defaultScreen: "dashboard",
  },
];

export type PlaythroughContext = {
  game: GameState;
  result?: ShowResult;
  hasWeekReview: boolean;
  hasResults: boolean;
  freeFixtureId: LiveDeskFixtureId;
};

export function getPlaythroughContext(phase: PlaythroughPhase, freeFixtureId: LiveDeskFixtureId = "week-pressure"): PlaythroughContext {
  switch (phase) {
    case "week1-hq":
    case "booking":
      return {
        game: weekPressureFixture.game,
        hasWeekReview: false,
        hasResults: weekPressureFixture.game.showHistory.length > 0,
        freeFixtureId,
      };
    case "results":
    case "weekReview":
      return {
        game: postShowFalloutFixture.game,
        result: postShowFalloutFixture.result,
        hasWeekReview: true,
        hasResults: true,
        freeFixtureId,
      };
    case "free": {
      const fixture = liveDeskFixtures.find((item) => item.id === freeFixtureId) ?? weekPressureFixture;
      return {
        game: fixture.game,
        result: fixture.result,
        hasWeekReview: Boolean(fixture.result && fixture.result.week === fixture.game.currentWeek),
        hasResults: fixture.game.showHistory.length > 0,
        freeFixtureId,
      };
    }
    default:
      return {
        game: weekPressureFixture.game,
        hasWeekReview: false,
        hasResults: false,
        freeFixtureId,
      };
  }
}

export function getNextPhase(phase: PlaythroughPhase): PlaythroughPhase {
  const index = playthroughPhases.findIndex((item) => item.id === phase);
  if (index < 0 || index >= playthroughPhases.length - 1) {
    return phase;
  }
  return playthroughPhases[index + 1].id;
}

export const mockCareerSaves = [
  { id: "save-1", gmName: "Alex Mercer", brandName: "Raw", week: 4, season: 1 },
  { id: "save-2", gmName: "Jordan Hale", brandName: "SmackDown", week: 8, season: 1 },
];
