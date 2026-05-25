export type Screen =
  | "title"
  | "setup"
  | "dashboard"
  | "booking"
  | "roster"
  | "market"
  | "profile"
  | "championships"
  | "rivalries"
  | "calendar"
  | "social"
  | "finance"
  | "results"
  | "weekReview"
  | "seasonReview"
  | "offseasonDraft";

export type SegmentType = "Match" | "Promo" | "Backstage Angle" | "Contract Signing" | "Open Challenge";

export type ShowType = "tv" | "ple";

export type GameDifficulty = "Easy" | "Medium" | "Hard" | "Legendary";

export type StartingBudgetTier = "$1M" | "$2M" | "$4M" | "Unlimited";

export type DraftMode = "snake" | "linear" | "random" | "lottery";

export type PrototypeBrand = "Raw" | "SmackDown" | "NXT" | "AEW";

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
  | PrototypeBrand
  | "Prime Time Sports Entertainment"
  | "Underground Fight Club"
  | "Workrate Showcase"
  | "Reality Era Chaos";

export type BrandOwnerType = "player" | "cpu";

export type BrandIdentity = {
  id: string;
  ownerType: BrandOwnerType;
  brandKey?: PrototypeBrand;
  name: string;
  style: BrandStyle;
};

export type RivalGMAssignment = {
  brand: PrototypeBrand;
  gmName: string;
  gmStyle: GMStyle;
};

export type RivalBrandActivity = {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  label: string;
  note: string;
};

export type RivalBrandTrend = "unranked" | "surging" | "steady" | "slipping";

export type CpuRosterAcquisitionSource = "draft" | "free_agent" | "trade";

export type MarketOwnerType = "player" | "rival" | "free_agent";

export type MarketAcquisitionSource = "draft" | "free_agent" | "trade" | "renewal" | "release";

export type MarketContractStatus = "active" | "expiring" | "expired" | "released";

export type MarketTransactionType = "signing" | "release" | "trade" | "renewal" | "expiry";

export type OfficeMandateStatus = "stable" | "watch" | "critical" | "surging";

export type MarketPaymentModel = "weekly" | "prepaid";

export type WeeklyMarketBoardEntryStatus = "available" | "rival_signed" | "player_signed";

export type MarketContract = {
  id: string;
  wrestlerId: string;
  ownerType: MarketOwnerType;
  ownerBrandId?: string;
  contractWeeksRemaining: number;
  weeklySalary: number;
  releasePenalty: number;
  acquisitionSource: MarketAcquisitionSource;
  contractStatus: MarketContractStatus;
  renewalRisk: number;
  paymentModel?: MarketPaymentModel;
  upfrontCostPaid?: number;
};

export type MarketTransaction = {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  type: MarketTransactionType;
  wrestlerIds: string[];
  wrestlerNames: string[];
  fromBrandId?: string;
  fromBrandName?: string;
  toBrandId?: string;
  toBrandName?: string;
  amount: number;
  accepted?: boolean;
  note: string;
};

export type MarketCooldown = {
  wrestlerId: string;
  availableWeek: number;
  releasedByBrandId?: string;
};

export type OfficeMandateEvent = {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  status: OfficeMandateStatus;
  ownerTrustDelta: number;
  brandReputationDelta: number;
  moneyDelta: number;
  note: string;
};

export type OfficeMandateState = {
  ownerTrust: number;
  brandReputation: number;
  mandateStatus: OfficeMandateStatus;
  mandateHistory: OfficeMandateEvent[];
};

export type WeeklyMarketBoardEntry = {
  wrestlerId: string;
  status: WeeklyMarketBoardEntryStatus;
  weeklyAsk: number;
  rivalBrandId?: string;
  rivalBrandName?: string;
  transactionId?: string;
};

export type WeeklyMarketBoard = {
  seasonNumber: number;
  weekNumber: number;
  entries: WeeklyMarketBoardEntry[];
};

export type MarketState = {
  playerContracts: MarketContract[];
  transactions: MarketTransaction[];
  cooldowns: MarketCooldown[];
  officeMandate: OfficeMandateState;
  weeklyBoard?: WeeklyMarketBoard;
};

export type CpuRosterMemberState = {
  wrestlerId: string;
  contractId?: string;
  acquisitionSource: CpuRosterAcquisitionSource;
  acquiredSeasonNumber: number;
  acquiredWeekNumber: number;
  momentum: number;
  morale: number;
  fatigue: number;
  appearancesThisSeason: number;
  lastBookedWeek: number;
  consecutiveWeeksBooked: number;
  injuryStatus: InjuryStatus;
  injuryDescription?: string;
  injuryWeeksRemaining: number;
};

export type CpuChampionshipState = {
  id: string;
  name: string;
  division: string;
  championIds: string[];
  prestige: number;
  defenses: number;
  reignStartWeek: number;
};

export type CpuRivalryState = {
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

export type CpuFinanceReport = {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  showName: string;
  revenue: number;
  expenses: number;
  profitLoss: number;
  endingMoney: number;
  note: string;
};

export type CpuFreeAgentClaim = {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  wrestlerId: string;
  wrestlerName: string;
  brandName: string;
  note: string;
};

export type CpuSeasonObjective = {
  id: string;
  label: string;
  target: number;
  current: number;
  status: "on_track" | "at_risk" | "missed" | "complete";
  note: string;
};

export type CpuSegmentResult = {
  id: string;
  type: SegmentType;
  participantIds: string[];
  participantNames: string[];
  score: number;
  winnerId?: string;
  titleId?: string;
  rivalryId?: string;
  note: string;
};

export type RivalBrandWeeklyResult = {
  id: string;
  seasonNumber: number;
  weekNumber: number;
  showName: string;
  showType: ShowType;
  score: number;
  grade: string;
  rank: number;
  playerScoreDelta: number;
  mainEvent: string;
  keyAngle: string;
  rosterFocusWrestlerIds: string[];
  segments: CpuSegmentResult[];
  titleNotes: string[];
  rivalryNotes: string[];
  injuryNotes: string[];
  financeReport?: CpuFinanceReport;
  freeAgentClaims: CpuFreeAgentClaim[];
  objectiveNotes: string[];
  note: string;
  trend: RivalBrandTrend;
};

export type RivalBrandState = {
  id: string;
  brandIdentity: BrandIdentity;
  brandKey: PrototypeBrand;
  brandName: string;
  assignedGMId?: string;
  assignedGMName: string;
  assignedGMStyle: GMStyle;
  roleLabel: string;
  statusLabel: string;
  rosterWrestlerIds: string[];
  rosterState: CpuRosterMemberState[];
  championships: CpuChampionshipState[];
  rivalries: CpuRivalryState[];
  financeReports: CpuFinanceReport[];
  freeAgentClaims: CpuFreeAgentClaim[];
  contracts: MarketContract[];
  marketTransactions: MarketTransaction[];
  budget: number;
  seasonObjectives: CpuSeasonObjective[];
  activityHistory: RivalBrandActivity[];
  weeklyResults: RivalBrandWeeklyResult[];
  seasonAverageScore: number;
  seasonRank: number;
  seasonTrend: RivalBrandTrend;
};

export type AffiliationKind = "tag_team" | "faction" | "affiliation";

export type WrestlerAffiliation = {
  id: string;
  name: string;
  kind: AffiliationKind;
  memberWrestlerIds: string[];
  status: string;
  sourceLabel?: string;
  notes?: string;
};

export type RivalryStatus = "rising" | "steady" | "cooling" | "stale";

export type RivalryStakes = "personal" | "title" | "respect" | "revenge";

export type RivalryStructure = "singles" | "tag_team" | "multi_person";

export type ChampionshipHistoryEventType = "title_change" | "successful_defense" | "revoked" | "assigned";

export type RivalryHistoryEventType =
  | "started"
  | "advanced"
  | "heated_up"
  | "cooled"
  | "became_stale"
  | "end_scheduled"
  | "end_cancelled"
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

export type MatchRatings = {
  technical: number;
  submission: number;
  power: number;
  aerial: number;
  brawling: number;
  hardcore: number;
  stamina: number;
  resilience: number;
  psychology: number;
  selling: number;
  timing: number;
  explosiveness: number;
  clutch: number;
};

export type WrestlerMatchRecordLine = {
  wins: number;
  losses: number;
  draws?: number;
  tagWins: number;
  tagLosses: number;
  tagDraws?: number;
};

export type WrestlerMatchRecord = {
  season: WrestlerMatchRecordLine;
  career: WrestlerMatchRecordLine;
};

export type Wrestler = {
  id: string;
  name: string;
  draftRank?: number;
  sourceBrand?: string;
  sourceAvailability?: string;
  roleTier?: string;
  role?: string;
  alignment?: string;
  archetype?: string;
  wrestlingStyle?: string;
  promoStyle?: string;
  presentationHook?: string;
  careerStageLabel?: string;
  division?: string;
  popularity: number;
  momentum: number;
  audienceHeat?: number;
  fatigue: number;
  morale: number;
  trust?: number;
  ringSkill: number;
  promoSkill: number;
  matchRatings?: MatchRatings;
  record?: WrestlerMatchRecord;
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
  winnerId?: string;
  championshipId?: string;
  rivalryId?: string;
  stipulationId?: string;
  segmentCatalogId?: string;
  segmentDisplayName?: string;
  durationMinutes?: number;
  participantMin?: number;
  participantMax?: number;
};

export type Championship = {
  id: string;
  name: string;
  division: string;
  catalogId?: string;
  canonicalTitleId?: string;
  brand?: PrototypeBrand;
  titleLevel?: string;
  titleType?: string;
  prestigeTier?: string;
  eligibleMatchScope?: "singles" | "tag_team";
  minimumDefenseFrequencyWeeks?: number;
  titleSceneCopy?: string;
  prestige: number;
  championIds: string[];
  contenderIds?: string[];
  reignStartWeek: number;
  defenses: number;
};

export type ChampionshipHistoryEvent = {
  id: string;
  resultId?: string;
  eventId?: string;
  championshipId: string;
  championshipName: string;
  eventType: ChampionshipHistoryEventType;
  championIds: string[];
  previousChampionIds?: string[];
  winningPairIds?: string[];
  losingPairIds?: string[];
  winningPairLabel?: string;
  losingPairLabel?: string;
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
  structure?: RivalryStructure;
  storylineId?: string;
  relationshipTag?: string;
  stageId?: string;
  heat: number;
  freshness: number;
  weeksActive: number;
  lastAdvancedWeek: number;
  status: RivalryStatus;
  stakes: RivalryStakes;
  pendingEndWeek?: number;
  pendingEndReason?: string;
};

export type RivalryHistoryEvent = {
  id: string;
  resultId?: string;
  eventId?: string;
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
  resultId?: string;
  eventId?: string;
  segmentId?: string;
  category: SocialCategory;
  author: string;
  text: string;
  tone: SocialTone;
  relatedWrestlerIds: string[];
  relatedRivalryIds?: string[];
  relatedChampionshipIds?: string[];
};

export type FinanceReportBreakdownItem = {
  id: string;
  label: string;
  amount: number;
  note?: string;
};

export type FinanceReport = {
  id: string;
  resultId?: string;
  eventId?: string;
  seasonNumber: number;
  weekNumber: number;
  showName: string;
  showType: ShowType;
  showScore: number;
  attendance: number;
  ticketRevenue: number;
  merchRevenue: number;
  mediaRevenue: number;
  /** Legacy v1/v2 report field. Show Production Finance v3 does not emit weekly talent expense. */
  talentCost?: number;
  productionCost: number;
  profitLoss: number;
  endingMoney: number;
  notes: string[];
  modelVersion?: string;
  grossRevenue?: number;
  totalExpenses?: number;
  baseShowProductionCost?: number;
  segmentProductionCost?: number;
  stipulationProductionCost?: number;
  bookedFinishCost?: number;
  overrunCost?: number;
  revenueBreakdown?: FinanceReportBreakdownItem[];
  expenseBreakdown?: FinanceReportBreakdownItem[];
};

export type SeasonArchiveChampionSnapshot = {
  championshipName: string;
  champions: string;
};

export type SeasonArchiveSummary = {
  seasonNumber: number;
  seasonStartingMoney: number;
  seasonDelta: number;
  finalMoney: number;
  bestShow?: {
    name: string;
    week: number;
    score: number;
    type?: ShowType;
  };
  topMomentumStar?: {
    name: string;
    value: number;
  };
  mostDefendedTitle?: {
    championshipName: string;
    defenses: number;
  };
  biggestTitleChange?: {
    championshipName: string;
    note: string;
    showName: string;
    week: number;
  };
  hottestRivalry?: {
    name: string;
    heat: number;
  };
  plePayoffHighlight?: {
    rivalryName: string;
    showName: string;
    type?: ShowType;
    week: number;
  };
  championsSnapshot: SeasonArchiveChampionSnapshot[];
};

export type SegmentResult = {
  segmentId: string;
  type: SegmentType;
  participantNames: string[];
  participantIds: string[];
  score: number;
  plannedDurationMinutes?: number;
  actualDurationMinutes?: number;
  durationVarianceMinutes?: number;
  overrunAffected?: boolean;
  momentumChanges: Record<string, number>;
  fatigueChanges: Record<string, number>;
  championshipId?: string;
  rivalryId?: string;
  segmentCatalogId?: string;
  stipulationId?: string;
  winnerId?: string;
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

export type SocialInboxActionType = "rest" | "tv_time";

export type SocialInboxRequestStatus = "accepted" | "fulfilled" | "broken";

export type SocialInboxRequest = {
  id: string;
  mailId: string;
  wrestlerId: string;
  wrestlerName: string;
  actionType: SocialInboxActionType;
  askLabel: string;
  createdSeasonNumber: number;
  createdWeekNumber: number;
  deadlineSeasonNumber: number;
  deadlineWeekNumber: number;
  status: SocialInboxRequestStatus;
  segmentId?: string;
  resolvedSeasonNumber?: number;
  resolvedWeekNumber?: number;
  note?: string;
};

export type SocialInboxState = {
  requests: SocialInboxRequest[];
};

export type TitleStatFalloutNote = {
  wrestlerId: string;
  wrestlerName: string;
  momentumChange: number;
  popularityChange: number;
  note: string;
};

export type LockerRoomFallout = {
  moraleDrops: LockerRoomFalloutItem[];
  moraleBoosts: LockerRoomFalloutItem[];
  overuseWarnings: LockerRoomFalloutItem[];
  underuseWarnings: LockerRoomFalloutItem[];
  injuryNotes: InjuryFalloutItem[];
  titleStatNotes?: TitleStatFalloutNote[];
};

export type ShowResult = {
  id: string;
  seasonNumber: number;
  week: number;
  brandName: string;
  showName: string;
  showType: ShowType;
  plannedRuntimeMinutes?: number;
  actualRuntimeMinutes?: number;
  broadcastOverrunMinutes?: number;
  broadcastOverrunLevel?: "minor" | "moderate" | "major";
  broadcastOverrunNotes?: string[];
  overrunAffectedSegmentId?: string;
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

export type DurableGameEventType = "show_resolved";

export type DurableGameEvent = {
  id: string;
  type: DurableGameEventType;
  seasonNumber: number;
  weekNumber: number;
  source: "run_show";
  summary: string;
  relatedIds: {
    showResultId: string;
    segmentIds: string[];
    titleHistoryEventIds: string[];
    rivalryHistoryEventIds: string[];
  };
  payload: {
    showName: string;
    showType: ShowType;
    totalScore: number;
    segmentCount: number;
    titleEventCount: number;
    rivalryEventCount: number;
  };
};

export type GameState = {
  seasonNumber: number;
  seasonStartingMoney: number;
  currentWeek: number;
  gmName: string;
  gmStyle: GMStyle;
  playerBrand: BrandIdentity;
  brandName: string;
  brandStyle: BrandStyle;
  difficulty: GameDifficulty;
  startingBudgetTier: StartingBudgetTier;
  draftMode: DraftMode;
  rivalGMAssignments: RivalGMAssignment[];
  rivalBrands: RivalBrandState[];
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
  marketState: MarketState;
  seasonArchives: SeasonArchiveSummary[];
  injuryRecoveryNotes: InjuryRecoveryNote[];
  socialInbox: SocialInboxState;
  eventLedger: DurableGameEvent[];
  currentShow: Segment[];
  showHistory: ShowResult[];
};
