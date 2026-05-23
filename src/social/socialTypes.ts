import type { GameScreen } from "../game/migration";
import type { GameState, ShowResult, SocialPost } from "../game/types";

export type SocialFilter = "All" | "Fan Reaction" | "Dirt Sheets" | "Analyst Takes" | "Title Scene" | "Rivalries";

export type IwcMoodTone = SocialPost["tone"];

export type IwcMoodItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type IwcMoodSummary = {
  headline: string;
  detail: string;
  weekLabel: string;
  tone: IwcMoodTone;
  items: IwcMoodItem[];
};

export type SocialScreenProps = {
  game: GameState;
  latestResult?: ShowResult;
  onNavigate: (screen: GameScreen) => void;
};

export type SocialPostEngagement = {
  replies: number;
  reposts: number;
  likes: number;
  views: number;
};
