import type { GameScreen } from "../game/migration";
import type { GameState, ShowResult, SocialInboxActionType, SocialPost } from "../game/types";

export type SuperstarMailDecision = "accept" | "decline";

export type SocialTimelineTab = "all" | "iwc" | "superstars";

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

export type SuperstarMailTone = "urgent" | "firm" | "hopeful" | "neutral";

export type SuperstarMailItem = {
  id: string;
  wrestlerId: string;
  wrestlerName: string;
  subject: string;
  preview: string;
  body: string;
  askLabel: string;
  tone: SuperstarMailTone;
  action?: {
    type: SocialInboxActionType;
    label: string;
    detail: string;
  };
};

export type SuperstarMailSnapshot = {
  weekLabel: string;
  detail: string;
  unreadCount: number;
  items: SuperstarMailItem[];
};

export type IwcTrendingTopic = {
  id: string;
  rank: number;
  brandName: string;
  label: string;
  volumeLabel: string;
};

export type IwcTrendingTopicsSnapshot = {
  weekLabel: string;
  detail: string;
  topics: IwcTrendingTopic[];
};

export type WrestlerJabTone = "heated" | "petty" | "challenge" | "title" | "mood" | "pressure";

export type WrestlerJabItem = {
  id: string;
  authorId: string;
  authorName: string;
  targetId?: string;
  targetName?: string;
  contextLabel?: string;
  jab: string;
  intentLabel: string;
  tone: WrestlerJabTone;
};

export type WrestlerJabFeedSnapshot = {
  weekLabel: string;
  detail: string;
  items: WrestlerJabItem[];
};

export type SocialScreenProps = {
  game: GameState;
  latestResult?: ShowResult;
  onSuperstarMailAction?: (item: SuperstarMailItem, decision: SuperstarMailDecision) => void;
  onNavigate: (screen: GameScreen) => void;
};

export type SocialPostEngagement = {
  replies: number;
  reposts: number;
  likes: number;
  views: number;
};
