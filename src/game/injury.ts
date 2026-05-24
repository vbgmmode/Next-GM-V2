import { getDifficultyRules } from "./difficultyRules";
import { INJURY_COMPOUND_RISK_BY_DIFFICULTY } from "./constants";
import type { GameDifficulty, SegmentResult, SegmentType, ShowType, Wrestler } from "./types";

const INJURY_BALANCE = {
  highFatigue: 70,
  severeFatigue: 85,
  pleStageLoad: 2,
};

export function getSharedInjuryRiskScore({
  wrestler,
  preShowWrestler,
  segmentTypes,
  segmentResults = [],
  showType,
  difficulty,
}: {
  wrestler: Wrestler;
  preShowWrestler?: Wrestler;
  segmentTypes: SegmentType[];
  segmentResults?: Pick<SegmentResult, "type" | "actualDurationMinutes" | "plannedDurationMinutes">[];
  showType: ShowType;
  difficulty: GameDifficulty;
}) {
  const physicalSegments = segmentTypes.filter((type) => type === "Match" || type === "Open Challenge").length;
  const preShowFatigue = preShowWrestler?.fatigue ?? wrestler.fatigue;
  const highestFatigue = Math.max(preShowFatigue, wrestler.fatigue);
  const consecutiveWeeks = Math.max(preShowWrestler?.consecutiveWeeksBooked ?? 0, wrestler.consecutiveWeeksBooked ?? 0);
  const minorInjuryLoad = preShowWrestler?.injuryStatus === "minor" || wrestler.injuryStatus === "minor" ? 12 : 0;
  const physicalLoad = physicalSegments * 12;
  const stackedPhysicalLoad = physicalSegments >= 2 ? 14 : 0;
  const repeatLoad = consecutiveWeeks >= 2 ? (consecutiveWeeks - 1) * INJURY_COMPOUND_RISK_BY_DIFFICULTY[difficulty] : 0;
  const durationLoad = segmentResults
    .filter((segment) => segment.type === "Match" || segment.type === "Open Challenge")
    .reduce((sum, segment) => sum + Math.max(0, (segment.actualDurationMinutes ?? 0) - (segment.plannedDurationMinutes ?? 0)) * 0.8, 0);
  const fatigueLoad = highestFatigue * 0.7 + (highestFatigue >= INJURY_BALANCE.severeFatigue ? 8 : highestFatigue >= INJURY_BALANCE.highFatigue ? 4 : 0);
  const stageLoad = showType === "ple" ? INJURY_BALANCE.pleStageLoad : 0;

  return fatigueLoad + repeatLoad + durationLoad + physicalLoad + stackedPhysicalLoad + minorInjuryLoad + stageLoad + getDifficultyRules(difficulty).playerPressure.injuryRiskModifier;
}

