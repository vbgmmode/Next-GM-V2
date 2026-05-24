import {
  getDefaultCatalogOption,
  getSegmentCatalogOption,
  getSegmentParticipantRange,
  type SegmentCatalogOption,
} from "../game/matchFormatCatalog";
import { getStipulationById, getStipulationsForSegment, type StipulationCatalogOption } from "../game/stipulationCatalog";
import { getWrestlerDivisionGroup, hasIntergenderMatchParticipants, isValidSegment } from "../game/scoring";
import { getChampionshipDivisionGroup, wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type { Championship, GameState, Rivalry, RivalryStructure, Segment, SegmentResult, SegmentType, Wrestler } from "../game/types";

export const showRuntimeTargetMinutes = 120;
export const showRuntimeMinMinutes = 90;
export const showRuntimeOvertimeMinutes = 135;
export const tvRuntimeWarningMinutes = 150;
export const maxBookingSegments = 24;

export type ShowReadiness = ReturnType<typeof getShowReadiness>;
export type BookingRuntimeHeatTone = "yellow" | "green" | "red";

export function getBookingRuntimeHeat(validMinutes: number) {
  const scaleMaxMinutes = tvRuntimeWarningMinutes;

  if (validMinutes < showRuntimeMinMinutes) {
    return {
      tone: "yellow" as BookingRuntimeHeatTone,
      label: "Underbuilt Window",
      detail: `${showRuntimeMinMinutes - validMinutes} min to broadcast window`,
      fillPercent: Math.max(6, Math.round((validMinutes / showRuntimeMinMinutes) * 100)),
      scaleMaxMinutes,
    };
  }

  if (validMinutes <= showRuntimeOvertimeMinutes) {
    return {
      tone: "green" as BookingRuntimeHeatTone,
      label: "Broadcast Window",
      detail: `${validMinutes} min in live block`,
      fillPercent: Math.max(8, Math.round((validMinutes / scaleMaxMinutes) * 100)),
      scaleMaxMinutes,
    };
  }

  return {
    tone: "red" as BookingRuntimeHeatTone,
    label: "Overrun Risk",
    detail: `${validMinutes - showRuntimeOvertimeMinutes} min past target block`,
    fillPercent: Math.min(100, Math.round((validMinutes / scaleMaxMinutes) * 100)),
    scaleMaxMinutes,
  };
}

export function getRivalryHeatTone(heat: number): BookingRuntimeHeatTone {
  if (heat < 50) {
    return "yellow";
  }
  if (heat <= 84) {
    return "green";
  }
  return "red";
}

export function formatWeekCount(weeks: number) {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

export function getSegmentDurationMinutes(segment: Segment) {
  return segment.durationMinutes ?? getSegmentCatalogOption(segment)?.defaultDurationMinutes ?? 8;
}

export function getStipulationsForSegmentId(segment: Segment): StipulationCatalogOption[] {
  return getStipulationsForSegment(segment);
}

export function getSegmentStipulationLabel(segment: Pick<Segment, "stipulationId" | "type" | "segmentCatalogId">) {
  const stipulation = getStipulationById(segment.stipulationId);
  return stipulation ? stipulation.label : "No stipulation";
}

export function getResolvedSegmentStipulationLabel(segment: Pick<SegmentResult, "stipulationId" | "type" | "segmentCatalogId">) {
  const stipulation = getStipulationById(segment.stipulationId);
  return stipulation ? stipulation.label : undefined;
}

export function sanitizeSegmentStipulation(segment: Segment) {
  if (!segment.stipulationId) {
    return segment;
  }

  if (!getStipulationsForSegmentId(segment).some((option) => option.id === segment.stipulationId)) {
    return { ...segment, stipulationId: undefined };
  }

  return segment;
}

export function getSegmentRuntime(segment: Segment) {
  return `${getSegmentDurationMinutes(segment)} min TV time`;
}

export function formatRuntimeVariance(variance = 0) {
  if (variance === 0) {
    return "on time";
  }

  return variance > 0 ? `+${variance} min` : `${variance} min`;
}

export function getParticipantRequirementLabel(option: SegmentCatalogOption) {
  if (option.minParticipants === option.maxParticipants) {
    return `${option.minParticipants} ${option.minParticipants === 1 ? "person" : "people"} required`;
  }

  return `${option.minParticipants}-${option.maxParticipants} people allowed`;
}

export function getSegmentIdentityBadges(segment: Segment) {
  const option = getSegmentCatalogOption(segment);
  const badges = [option.group, getParticipantRequirementLabel(option), option.championshipAllowed ? "Title context" : "No title change"];

  if (option.winnerRequired) {
    badges.push("Winner resolved");
  }

  if (option.rivalryRelevant) {
    badges.push("Rivalry friendly");
  }

  return badges;
}

export function getSegmentRequirement(type: SegmentType) {
  const option = getDefaultCatalogOption(type);

  if (option?.minParticipants === option?.maxParticipants) {
    const label = type === "Open Challenge" ? "issuer" : "wrestler";
    return `Needs exactly ${option.minParticipants} ${label}${option.minParticipants === 1 ? "" : "s"}`;
  }

  if (option) {
    return `Needs ${option.minParticipants} to ${option.maxParticipants} wrestlers`;
  }

  if (type === "Promo") {
    return "Needs 1 to 3 wrestlers";
  }

  if (type === "Backstage Angle") {
    return "Needs 2 to 4 wrestlers";
  }

  if (type === "Contract Signing") {
    return "Needs exactly 2 wrestlers";
  }

  return "Needs exactly 1 issuer";
}

export function getSegmentRequirementForSegment(segment: Segment) {
  const range = getSegmentParticipantRange(segment);
  const label = segment.type === "Open Challenge" ? "issuer" : "wrestler";

  if (range.min === range.max) {
    return `Needs exactly ${range.min} ${label}${range.min === 1 ? "" : "s"}`;
  }

  return `Needs ${range.min} to ${range.max} wrestlers`;
}

export function getSegmentDescription(type: SegmentType) {
  return getDefaultCatalogOption(type)?.note ?? "Build the segment structure without exposing hidden outcomes.";
}

export function getSegmentPickerLabel(type: SegmentType) {
  return type === "Open Challenge" ? "Issuer" : "Participants";
}

export function getSegmentParticipants(segment: Segment, wrestlers: Wrestler[]) {
  return segment.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

export function getSegmentParticipantsLabel(segment: Segment, wrestlers: Wrestler[]) {
  const participants = getSegmentParticipants(segment, wrestlers);

  if (!participants.length) {
    return "No participants selected";
  }

  if (segment.segmentCatalogId === "M020" && segment.participantIds.length === 4) {
    const teamA = participants
      .slice(0, 2)
      .map((wrestler) => wrestler.name)
      .join(" / ");
    const teamB = participants
      .slice(2)
      .map((wrestler) => wrestler.name)
      .join(" / ");
    return `Team A (${teamA || "TBD"}) vs Team B (${teamB || "TBD"})`;
  }

  return participants.map((wrestler) => wrestler.name).join(" / ");
}

export function getSegmentRailParticipantLines(segment: Segment, wrestlers: Wrestler[], valid: boolean, validationWarning: string) {
  if (!valid) {
    return {
      line2: validationWarning,
      line3: "",
    };
  }

  const names = segment.participantIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "TBD");

  if (!names.length) {
    return {
      line2: "Open Slot",
      line3: "",
    };
  }

  if (segment.type === "Open Challenge") {
    return {
      line2: names[0] ?? "Issuer TBD",
      line3: "???",
    };
  }

  if (names.length > 5) {
    return {
      line2: "MULTI",
      line3: "WRESTLER",
    };
  }

  if (segment.segmentCatalogId === "M020" && names.length === 4) {
    return {
      line2: names.slice(0, 2).join(" / ") || "Team A TBD",
      line3: names.slice(2, 4).join(" / ") || "Team B TBD",
    };
  }

  if (names.length === 1) {
    return {
      line2: names[0],
      line3: "",
    };
  }

  if (names.length === 2) {
    return {
      line2: names[0],
      line3: names[1],
    };
  }

  if (names.length === 3) {
    return {
      line2: names.slice(0, 2).join(" / "),
      line3: names[2],
    };
  }

  if (names.length === 4) {
    return {
      line2: names.slice(0, 2).join(" / "),
      line3: names.slice(2, 4).join(" / "),
    };
  }

  return {
    line2: names.slice(0, 2).join(" / "),
    line3: names.slice(2, 5).join(" / "),
  };
}

export function getSegmentResultParticipantsLabel(segment: SegmentResult, wrestlers: Wrestler[]) {
  if (!segment.participantIds.length) {
    return "No participants";
  }

  if (segment.segmentCatalogId === "M020" && segment.participantIds.length === 4) {
    const teamA = segment.participantIds
      .slice(0, 2)
      .map((id: string) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown")
      .join(" / ");
    const teamB = segment.participantIds
      .slice(2)
      .map((id: string) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown")
      .join(" / ");
    const winnerLabel = getTagMatchResultWinnerLabel(segment, wrestlers);
    return `${winnerLabel ? `${winnerLabel} · ` : ""}Team A (${teamA || "TBD"}) vs Team B (${teamB || "TBD"})`;
  }

  return segment.participantNames.join(" / ");
}

export function getTagMatchResultWinnerLabel(segment: SegmentResult, wrestlers: Wrestler[]) {
  if (segment.type !== "Match" || segment.segmentCatalogId !== "M020" || !segment.winnerId) {
    return undefined;
  }

  const winner = wrestlers.find((wrestler) => wrestler.id === segment.winnerId);
  if (!winner) {
    return undefined;
  }

  const teamAIds = segment.participantIds.slice(0, 2);
  const winningSide = teamAIds.includes(segment.winnerId) ? "Team A" : "Team B";
  return `${winningSide} winner: ${winner.name}`;
}

export function getSegmentValidationWarning(segment: Segment, wrestlers: Wrestler[] = []) {
  if (isValidSegment(segment, wrestlers)) {
    return "";
  }

  const uniqueParticipantCount = new Set(segment.participantIds).size;
  if (segment.participantIds.length !== uniqueParticipantCount) {
    return "Each wrestler can only appear once in a segment.";
  }

  const unavailable = getSegmentParticipants(segment, wrestlers).find((wrestler) => wrestler.injuryStatus === "major");
  if (unavailable) {
    return `${unavailable.name} is unavailable with a major injury.`;
  }

  if (hasIntergenderMatchParticipants(segment, wrestlers)) {
    return "Intergender matches are not allowed. Choose competitors from the same division.";
  }

  const range = getSegmentParticipantRange(segment);
  const label = segment.type === "Open Challenge" ? "issuer" : "wrestler";
  const option = getSegmentCatalogOption(segment);
  const segmentName = segment.segmentDisplayName ?? option.label ?? segment.type;

  if (range.min === range.max) {
    return `${segmentName} needs exactly ${range.min} ${label}${range.min === 1 ? "" : "s"} before it can hold a TV slot.`;
  }

  if (segment.participantIds.length < range.min) {
    return `${segmentName} needs ${range.min - segment.participantIds.length} more ${label}${range.min - segment.participantIds.length === 1 ? "" : "s"} for this format.`;
  }

  return `${segmentName} is over format capacity. Keep it to ${range.max} ${label}${range.max === 1 ? "" : "s"}.`;
}

export function getShowReadiness(validSegments: number, invalidSegments: number, runtimeMinutes: number) {
  if (invalidSegments > 0) {
    return {
      canRun: false,
      status: "Fix The Rundown",
      tone: "blocked",
      note: `${invalidSegments} segment${invalidSegments === 1 ? "" : "s"} need talent or availability fixes before production can roll.`,
    };
  }

  if (validSegments < 2) {
    return {
      canRun: false,
      status: "Underbuilt Show",
      tone: "underbuilt",
      note: "Book at least 2 valid TV segments so the broadcast has more than one beat.",
    };
  }

  if (runtimeMinutes < showRuntimeMinMinutes) {
    return {
      canRun: false,
      status: "Underbuilt Show",
      tone: "underbuilt",
      note: `${showRuntimeMinMinutes - runtimeMinutes} more TV minutes needed to reach the live broadcast window.`,
    };
  }

  if (runtimeMinutes > tvRuntimeWarningMinutes) {
    return {
      canRun: false,
      status: "Overloaded Show",
      tone: "overloaded",
      note: `Cut ${runtimeMinutes - tvRuntimeWarningMinutes} TV minutes to fit the production block.`,
    };
  }

  if (runtimeMinutes > showRuntimeOvertimeMinutes) {
    return {
      canRun: true,
      status: "Overtime Window",
      tone: "warning",
      note: "This card can run, but the broadcast is packed. Trim time if you want a cleaner TV shape.",
    };
  }

  return {
    canRun: true,
    status: "Broadcast-Ready Window",
    tone: "ready",
    note: "The show has enough valid TV time and fits the production block.",
  };
}

export function getBroadcastRuntimeRisk(runtimeMinutes: number) {
  if (runtimeMinutes > showRuntimeOvertimeMinutes) {
    return {
      tone: "strong",
      title: "Packed Broadcast Risk",
      note: "This card is packed. If live timing drifts, the final slot could feel rushed.",
    };
  }

  if (runtimeMinutes > showRuntimeTargetMinutes) {
    return {
      tone: "warning",
      title: "Broadcast Risk",
      note: "The final block may lose breathing room if earlier segments run long.",
    };
  }

  if (runtimeMinutes >= showRuntimeTargetMinutes - 5) {
    return {
      tone: "soft",
      title: "Tight Timing Window",
      note: "This rundown leaves little room for live overrun.",
    };
  }

  return undefined;
}

export function getBookingCardStatus(segmentCount: number, invalidSegments: number, readiness: ShowReadiness) {
  if (segmentCount === 0) {
    return { label: "Empty Card", tone: "empty" };
  }

  if (readiness.canRun) {
    return { label: "Ready To Run", tone: "ready" };
  }

  if (invalidSegments > 0 || readiness.tone === "blocked" || readiness.tone === "overloaded") {
    return { label: "Needs Attention", tone: "blocked" };
  }

  return { label: "In Production", tone: "building" };
}

export function getBookingSegmentBoardFlags(segment: Segment, game: GameState) {
  const flags: string[] = [];
  const championship = segment.championshipId ? game.championships.find((title) => title.id === segment.championshipId) : undefined;
  const rivalry = segment.rivalryId ? game.rivalries.find((item) => item.id === segment.rivalryId) : undefined;
  const majorStars = getSegmentParticipants(segment, game.wrestlers).filter(isMajorEventStar);

  if (championship) {
    flags.push(canSegmentContestChampionship(segment, championship, game.wrestlers) ? "Title" : "Title Context");
  }

  if (rivalry) {
    flags.push("Rivalry");
  }

  if (majorStars.length) {
    flags.push("Star");
  }

  if (segment.type === "Open Challenge") {
    flags.push("Open Challenge");
  }

  if (!isValidSegment(segment, game.wrestlers)) {
    flags.push("Needs Fix");
  }

  return flags.length ? flags : [getSegmentRuntime(segment)];
}

export function getBookingWrestlerRiskReads(wrestler: Wrestler, bookedCount: number) {
  const reads: string[] = [];

  if (wrestler.injuryStatus === "major") {
    reads.push("major injury unavailable");
  } else if (wrestler.injuryStatus === "minor") {
    reads.push("minor injury");
  }

  if (wrestler.fatigue >= 75) {
    reads.push(`high fatigue ${wrestler.fatigue}`);
  } else if (wrestler.fatigue >= 60) {
    reads.push(`fatigue ${wrestler.fatigue}`);
  }

  if ((wrestler.consecutiveWeeksBooked ?? 0) >= 3) {
    reads.push(`${wrestler.consecutiveWeeksBooked} week booking streak`);
  }

  if (wrestler.morale <= 45) {
    reads.push(`morale ${wrestler.morale}`);
  }

  if (bookedCount > 1) {
    reads.push(`${bookedCount} segments tonight`);
  }

  return reads;
}

export function getBookingProducerNote({
  missingMajorStars,
  readiness,
  riskCount,
  segmentCount,
  titleContextCount,
  rivalrySegmentCount,
}: {
  missingMajorStars: Wrestler[];
  readiness: ShowReadiness;
  riskCount: number;
  segmentCount: number;
  titleContextCount: number;
  rivalrySegmentCount: number;
}) {
  if (segmentCount === 0) {
    return "Production has no card slots filled yet. Add segments first; the existing validation path still controls when the show can run.";
  }

  if (!readiness.canRun) {
    return readiness.note;
  }

  const coverageReads = [
    titleContextCount ? "title context is on the board" : "no title context is attached",
    rivalrySegmentCount ? "rivalry beats are represented" : "no rivalry beat is attached",
  ];
  const riskRead = riskCount ? `${riskCount} current workload flag${riskCount === 1 ? "" : "s"} ${riskCount === 1 ? "needs" : "need"} a producer look` : "no current-card workload flags are surfacing";
  const missingRead = missingMajorStars.length ? `Top acts off card: ${missingMajorStars.slice(0, 3).map((wrestler) => wrestler.name).join(" / ")}.` : "";

  return `Ready state comes from existing validation: ${coverageReads.join(", ")} and ${riskRead}. ${missingRead}`.trim();
}

export function isMajorEventStar(wrestler: Wrestler) {
  return wrestler.popularity >= 90 || wrestler.momentum >= 90 || wrestler.roleTier?.toLowerCase() === "mainevent";
}

export function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}

export function isSinglesTitleChampionship(championship: Championship) {
  return championship.eligibleMatchScope !== "tag_team" && championship.division !== "Tag Team";
}

export function isSinglesChampionship(championship: Championship) {
  return isSinglesTitleChampionship(championship) && championship.championIds.length === 1;
}

export function isVacantSinglesChampionship(championship: Championship) {
  return isSinglesTitleChampionship(championship) && championship.championIds.length === 0;
}

function canSegmentContestVacantSinglesChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[] = []) {
  return (
    segment.type === "Match" &&
    isValidSegment(segment, wrestlers) &&
    isSinglesTitleContestShape(segment) &&
    isVacantSinglesChampionship(championship) &&
    doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
  );
}

export function isTagChampionship(championship: Championship) {
  return championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team";
}

export function doSegmentParticipantsFitChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[]) {
  const titleDivision = getChampionshipDivisionGroup(championship);

  if (!titleDivision) {
    return true;
  }

  return segment.participantIds.every((id) => wrestlerFitsChampionshipDivision(wrestlers.find((wrestler) => wrestler.id === id), championship));
}

export function getTagTitleSides(segment: Segment, championship: Championship) {
  if (segment.type !== "Match" || segment.segmentCatalogId !== "M020" || segment.participantIds.length !== 4 || championship.championIds.length !== 2) {
    return undefined;
  }

  const teamAIds = segment.participantIds.slice(0, 2);
  const teamBIds = segment.participantIds.slice(2, 4);
  const championIds = new Set(championship.championIds);
  const teamAHasChampions = teamAIds.every((id) => championIds.has(id));
  const teamBHasChampions = teamBIds.every((id) => championIds.has(id));

  if (teamAHasChampions === teamBHasChampions) {
    return undefined;
  }

  return {
    championSideIds: teamAHasChampions ? teamAIds : teamBIds,
    challengerSideIds: teamAHasChampions ? teamBIds : teamAIds,
  };
}

function isSinglesTitleContestShape(segment: Segment) {
  if (segment.segmentCatalogId === "M002") {
    return segment.participantIds.length === 3;
  }

  if (segment.segmentCatalogId === "M003") {
    return segment.participantIds.length === 4;
  }

  return segment.participantIds.length === 2;
}

export function trimParticipantsForCatalogOption(
  segment: Segment,
  option: SegmentCatalogOption,
  championships: Championship[] = [],
) {
  const participantIds = segment.participantIds;

  if (participantIds.length <= option.maxParticipants) {
    return participantIds;
  }

  if (option.id === "M020" && option.maxParticipants === 4) {
    return participantIds.slice(0, 4);
  }

  if (option.maxParticipants === 2 && segment.type === "Match") {
    const attachedTitle = segment.championshipId
      ? championships.find((championship) => championship.id === segment.championshipId)
      : undefined;
    const championTitle =
      attachedTitle ??
      championships.find(
        (championship) =>
          !isTagChampionship(championship) &&
          championship.championIds.length === 1 &&
          participantIds.includes(championship.championIds[0]),
      );

    if (championTitle?.championIds.length === 1) {
      const championId = championTitle.championIds[0];
      const challengerId = participantIds.find((id) => id !== championId);

      if (participantIds.includes(championId) && challengerId) {
        return [championId, challengerId];
      }
    }
  }

  return participantIds.slice(0, option.maxParticipants);
}

export function canSegmentContestChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[] = []) {
  if (isTagChampionship(championship)) {
    return Boolean(isValidSegment(segment, wrestlers) && getTagTitleSides(segment, championship));
  }

  if (canSegmentContestVacantSinglesChampionship(segment, championship, wrestlers)) {
    return true;
  }

  return (
    segment.type === "Match" &&
    isValidSegment(segment, wrestlers) &&
    isSinglesTitleContestShape(segment) &&
    isSinglesChampionship(championship) &&
    segment.participantIds.includes(championship.championIds[0]) &&
    doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
  );
}

export function canSegmentAttachChampionship(segment: Segment, championship: Championship, wrestlers: Wrestler[] = []) {
  if (canSegmentContestChampionship(segment, championship, wrestlers)) {
    return true;
  }

  if (segment.type === "Contract Signing") {
    return (
      isValidSegment(segment, wrestlers) &&
      isSinglesChampionship(championship) &&
      segment.participantIds.includes(championship.championIds[0]) &&
      doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
    );
  }

  if (segment.type === "Open Challenge") {
    return (
      isValidSegment(segment, wrestlers) &&
      isSinglesChampionship(championship) &&
      championship.championIds.includes(segment.participantIds[0]) &&
      doSegmentParticipantsFitChampionship(segment, championship, wrestlers)
    );
  }

  return false;
}

export function canWrestlersShareMatch(wrestlers: Wrestler[]) {
  const divisions = [...new Set(wrestlers.map((wrestler) => getWrestlerDivisionGroup(wrestler)).filter((division): division is "mens" | "womens" => Boolean(division)))];
  return divisions.length <= 1;
}

export function wouldCreateIntergenderMatch(segment: Segment, wrestler: Wrestler, wrestlers: Wrestler[]) {
  if (segment.type !== "Match" || segment.participantIds.includes(wrestler.id)) {
    return false;
  }

  return !canWrestlersShareMatch([...getSegmentParticipants(segment, wrestlers), wrestler]);
}

export function getInjuryDetail(wrestler: Wrestler) {
  if (wrestler.injuryStatus === "healthy") {
    return "Available";
  }

  const weeks = wrestler.injuryWeeksRemaining;
  return `${weeks} week${weeks === 1 ? "" : "s"} remaining${wrestler.injuryDescription ? ` · ${wrestler.injuryDescription}` : ""}`;
}

export function getRivalryParticipants(rivalry: Rivalry, wrestlers: Wrestler[]) {
  return rivalry.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

export function getRivalryStructure(rivalry: Rivalry): RivalryStructure {
  return rivalry.structure ?? "singles";
}

export function isRivalryIntergenderBlocked(rivalry: Rivalry, wrestlers: Wrestler[]) {
  const participants = getRivalryParticipants(rivalry, wrestlers);
  return participants.length > 1 && !canWrestlersShareMatch(participants);
}

export function canSegmentAttachRivalry(segment: Segment, rivalry: Rivalry, wrestlers: Wrestler[] = []) {
  if (segment.type === "Open Challenge" || isRivalryIntergenderBlocked(rivalry, wrestlers)) {
    return false;
  }

  const structure = getRivalryStructure(rivalry);
  const range = getSegmentParticipantRange(segment);
  const hasOverlap = !segment.participantIds.length || segment.participantIds.some((id) => rivalry.participantIds.includes(id));

  if (!hasOverlap) {
    return false;
  }

  if (structure === "singles") {
    return range.max >= 2;
  }

  if (structure === "tag_team") {
    return (segment.type === "Match" && segment.segmentCatalogId === "M020") || (segment.type !== "Match" && range.max >= 4);
  }

  const option = getSegmentCatalogOption(segment);
  return range.max >= 3 && (segment.type !== "Contract Signing" || Boolean(option?.rivalryRelevant));
}
