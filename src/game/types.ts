export type Screen =
  | "title"
  | "dashboard"
  | "booking"
  | "roster"
  | "championships"
  | "rivalries"
  | "calendar"
  | "social"
  | "results"
  | "seasonReview";

export type SegmentType = "Match" | "Promo";

export type ShowType = "tv" | "ple";

export type RivalryStatus = "rising" | "steady" | "cooling" | "stale";

export type RivalryStakes = "personal" | "title" | "respect" | "revenge";

export type SocialCategory =
  | "fan_praise"
  | "push_complaint"
  | "title_scene"
  | "rivalry_heat"
  | "viral_moment"
  | "dirt_sheet"
  | "analyst_take"
  | "fatigue_concern"
  | "ple_reaction";

export type SocialTone = "excited" | "angry" | "skeptical" | "impressed" | "chaotic" | "analytical";

export type Wrestler = {
  id: string;
  name: string;
  popularity: number;
  momentum: number;
  fatigue: number;
  morale: number;
  ringSkill: number;
  promoSkill: number;
};

export type Segment = {
  id: string;
  type: SegmentType;
  participantIds: string[];
  championshipId?: string;
  rivalryId?: string;
};

export type Championship = {
  id: string;
  name: string;
  division: string;
  prestige: number;
  championIds: string[];
  reignStartWeek: number;
  defenses: number;
};

export type Rivalry = {
  id: string;
  name: string;
  participantIds: string[];
  heat: number;
  freshness: number;
  weeksActive: number;
  lastAdvancedWeek: number;
  status: RivalryStatus;
  stakes: RivalryStakes;
};

export type CalendarWeek = {
  weekNumber: number;
  showName: string;
  showType: ShowType;
  isGoHome: boolean;
  completed: boolean;
  resultId?: string;
};

export type SocialPost = {
  id: string;
  weekNumber: number;
  seasonNumber: number;
  showName: string;
  category: SocialCategory;
  author: string;
  text: string;
  tone: SocialTone;
  relatedWrestlerIds: string[];
  relatedRivalryIds?: string[];
  relatedChampionshipIds?: string[];
};

export type SegmentResult = {
  segmentId: string;
  type: SegmentType;
  participantNames: string[];
  participantIds: string[];
  score: number;
  momentumChanges: Record<string, number>;
  fatigueChanges: Record<string, number>;
  championshipId?: string;
  rivalryId?: string;
  titleNote?: string;
  rivalryNote?: string;
};

export type ShowResult = {
  id: string;
  seasonNumber: number;
  week: number;
  brandName: string;
  showName: string;
  showType: ShowType;
  totalScore: number;
  segmentResults: SegmentResult[];
  biggestMomentumGain: {
    name: string;
    amount: number;
  };
  biggestFatigueIncrease: {
    name: string;
    amount: number;
  };
  titleNotes: string[];
  rivalryNotes: string[];
};

export type GameState = {
  seasonNumber: number;
  currentWeek: number;
  brandName: string;
  money: number;
  wrestlers: Wrestler[];
  championships: Championship[];
  rivalries: Rivalry[];
  calendar: CalendarWeek[];
  socialPosts: SocialPost[];
  currentShow: Segment[];
  showHistory: ShowResult[];
};
