export type Screen =
  | "title"
  | "dashboard"
  | "booking"
  | "roster"
  | "championships"
  | "rivalries"
  | "calendar"
  | "results"
  | "seasonReview";

export type SegmentType = "Match" | "Promo";

export type ShowType = "tv" | "ple";

export type RivalryStatus = "rising" | "steady" | "cooling" | "stale";

export type RivalryStakes = "personal" | "title" | "respect" | "revenge";

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

export type SegmentResult = {
  segmentId: string;
  type: SegmentType;
  participantNames: string[];
  score: number;
  momentumChanges: Record<string, number>;
  fatigueChanges: Record<string, number>;
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
  currentShow: Segment[];
  showHistory: ShowResult[];
};
