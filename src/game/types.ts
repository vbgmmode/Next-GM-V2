export type Screen =
  | "title"
  | "setup"
  | "dashboard"
  | "booking"
  | "roster"
  | "profile"
  | "championships"
  | "rivalries"
  | "calendar"
  | "social"
  | "finance"
  | "results"
  | "weekReview"
  | "seasonReview";

export type SegmentType = "Match" | "Promo" | "Backstage Angle" | "Contract Signing" | "Open Challenge";

export type ShowType = "tv" | "ple";

export type GMStyle =
  | "Creative Visionary"
  | "Talent Developer"
  | "Ruthless Executive"
  | "Ratings Chaser"
  | "Locker Room General"
  | "Star Maker"
  | "Chaos Booker"
  | "Sports Realist"
  | "Brand Architect"
  | "Veteran Operator"
  | "Cult Favorite"
  | "Big Money Promoter";

export type BrandStyle =
  | "Prime Time Sports Entertainment"
  | "Underground Fight Club"
  | "Workrate Showcase"
  | "Reality Era Chaos";

export type RivalryStatus = "rising" | "steady" | "cooling" | "stale";

export type RivalryStakes = "personal" | "title" | "respect" | "revenge";

export type ChampionshipHistoryEventType = "title_change" | "successful_defense";

export type RivalryHistoryEventType =
  | "started"
  | "advanced"
  | "heated_up"
  | "cooled"
  | "became_stale"
  | "ended"
  | "ple_payoff";

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

export type PressureLabel = "Stable" | "Tight" | "Critical" | "Surging";

export type InjuryStatus = "healthy" | "minor" | "major";

export type Wrestler = {
  id: string;
  name: string;
  popularity: number;
  momentum: number;
  fatigue: number;
  morale: number;
  ringSkill: number;
  promoSkill: number;
  appearancesThisSeason?: number;
  lastBookedWeek?: number;
  consecutiveWeeksBooked?: number;
  injuryStatus: InjuryStatus;
  injuryDescription?: string;
  injuryWeeksRemaining: number;
  injuryOccurredWeek?: number;
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

export type ChampionshipHistoryEvent = {
  id: string;
  championshipId: string;
  championshipName: string;
  eventType: ChampionshipHistoryEventType;
  championIds: string[];
  previousChampionIds?: string[];
  weekNumber: number;
  seasonNumber: number;
  showName: string;
  showType: ShowType;
  segmentId?: string;
  defenseNumber?: number;
  note: string;
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

export type RivalryHistoryEvent = {
  id: string;
  rivalryId: string;
  rivalryName: string;
  participantIds: string[];
  weekNumber: number;
  seasonNumber: number;
  showName?: string;
  showType?: ShowType;
  eventType: RivalryHistoryEventType;
  note: string;
  heat?: number;
  freshness?: number;
  status?: RivalryStatus;
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

export type FinanceReport = {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  showName: string;
  showType: ShowType;
  showScore: number;
  attendance: number;
  ticketRevenue: number;
  merchRevenue: number;
  mediaRevenue: number;
  talentCost: number;
  productionCost: number;
  profitLoss: number;
  endingMoney: number;
  notes: string[];
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
  recapNote?: string;
  resolvedOpponentId?: string;
  resolvedOpponentName?: string;
  isNoContest?: boolean;
};

export type LockerRoomFalloutItem = {
  wrestlerId: string;
  wrestlerName: string;
  note: string;
  moraleChange?: number;
};

export type InjuryFalloutItem = {
  wrestlerId: string;
  wrestlerName: string;
  status: Exclude<InjuryStatus, "healthy">;
  description: string;
  weeksRemaining: number;
  note: string;
};

export type InjuryRecoveryNote = {
  wrestlerId: string;
  wrestlerName: string;
  weekNumber: number;
  note: string;
};

export type LockerRoomFallout = {
  moraleDrops: LockerRoomFalloutItem[];
  moraleBoosts: LockerRoomFalloutItem[];
  overuseWarnings: LockerRoomFalloutItem[];
  underuseWarnings: LockerRoomFalloutItem[];
  injuryNotes: InjuryFalloutItem[];
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
  titleHistoryEvents: ChampionshipHistoryEvent[];
  rivalryHistoryEvents: RivalryHistoryEvent[];
  lockerRoomFallout?: LockerRoomFallout;
};

export type GameState = {
  seasonNumber: number;
  seasonStartingMoney: number;
  currentWeek: number;
  gmName: string;
  gmStyle: GMStyle;
  brandName: string;
  brandStyle: BrandStyle;
  createdAt: string;
  money: number;
  wrestlers: Wrestler[];
  championships: Championship[];
  rivalries: Rivalry[];
  championshipHistory: ChampionshipHistoryEvent[];
  rivalryHistory: RivalryHistoryEvent[];
  calendar: CalendarWeek[];
  socialPosts: SocialPost[];
  financeReports: FinanceReport[];
  injuryRecoveryNotes: InjuryRecoveryNote[];
  currentShow: Segment[];
  showHistory: ShowResult[];
};
