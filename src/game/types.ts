export type Screen = "title" | "dashboard" | "booking" | "roster" | "championships" | "rivalries" | "results";

export type SegmentType = "Match" | "Promo";

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
  week: number;
  brandName: string;
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
  currentWeek: number;
  brandName: string;
  money: number;
  wrestlers: Wrestler[];
  championships: Championship[];
  rivalries: Rivalry[];
  currentShow: Segment[];
  showHistory: ShowResult[];
};
