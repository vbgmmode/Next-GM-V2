import type { GameScreen } from "../game/migration";
import type { WrestlerAlignment } from "../game/wrestlerAlignment";
import type { GameState, ShowResult, Wrestler } from "../game/types";
import type { ProfileReturnScreen } from "../game/migration";

export type RosterSort = "popularity" | "momentum" | "fatigue" | "morale";
export type RosterFilter = "all" | "mens" | "womens" | "champions" | "injured" | "hot" | "tired" | "morale" | "underused";
export type RosterStatus = "Hot" | "Tired" | "Frustrated" | "Steady";
export type ProfilePanelId = "stats" | "gmRead" | "contractValue" | "affiliations" | "showHistory" | "championships" | "rivalries" | "social";

export type GMRead = {
  usefulness: string;
  risk: string;
  need: string;
};

export type LockerRoomTone = "hot" | "steady" | "watch";

export type WrestlerLockerRoomRead = {
  headline: string;
  detail: string;
  note: string;
  tone: LockerRoomTone;
};

export type WrestlerIdentitySnapshot = {
  labels: string[];
  roleRead: string;
  usageRead: string;
  bookingUseRead: string;
};

export type WrestlerValueProfile = {
  contextMode: "active" | "missing";
  valueTierLabel: string;
  draftValueLabel: string;
  weeklyValueLabel: string;
  dossierRead: string;
  costRead: string;
};

export type WrestlerAppearance = {
  id: string;
  week: number;
  showName: string;
  type: import("../game/types").SegmentType;
  score: number;
  note?: string;
};

export type RosterScreenProps = {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
  onOpenProfile: (wrestlerId: string) => void;
};

export type WrestlerProfileScreenProps = {
  game: GameState;
  latestResult?: ShowResult;
  onBackToBooking: () => void;
  onBackToDashboard: () => void;
  onBackToRoster: () => void;
  onNavigate: (screen: GameScreen) => void;
  onSetAlignment: (wrestlerId: string, alignment: WrestlerAlignment) => void;
  returnScreen: ProfileReturnScreen;
  wrestler: Wrestler;
};
