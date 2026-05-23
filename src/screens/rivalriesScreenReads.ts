import { canWrestlersShareMatch } from "../booking/bookingUtils";
import { getRosterAffiliations } from "../game/affiliationCatalog";
import { deriveRivalryStage, getRivalryGMRead, getRivalryStoryline } from "../game/rivalryCatalog";
import { getCurrentCalendarWeek } from "../game/scoring";
import { formatRivalryStatus, getRivalryHistory, hasPlePayoff } from "../game/storyContextReads";
import { isSinglesChampionship } from "../booking/bookingUtils";
import { wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type {
  CalendarWeek,
  Championship,
  GameState,
  Rivalry,
  RivalryHistoryEvent,
  RivalryStakes,
  RivalryStructure,
  Wrestler,
} from "../game/types";

type RivalryTimingTone = "hot" | "steady" | "watch" | "build";

type RivalryTimingDiagnostic = {
  id: string;
  label: string;
  detail: string;
  tone: RivalryTimingTone;
};

export type RivalryTimingSnapshot = {
  primary: RivalryTimingDiagnostic;
  diagnostics: RivalryTimingDiagnostic[];
  timingRead: string;
  producerRead: string;
  weeksSinceAdvanced: number;
  weeksUntilPle: number;
  currentCardBeats: number;
  currentCardParticipants: number;
  recentlyPaidOff: boolean;
};

function formatWeekCount(weeks: number) {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

function getNextPle(calendar: CalendarWeek[], currentWeek: number) {
  return calendar.find((week) => week.showType === "ple" && week.weekNumber >= currentWeek && !week.completed);
}

function getWeeksUntilPle(nextPle: CalendarWeek | undefined, currentWeek: number) {
  if (!nextPle) {
    return 0;
  }

  return Math.max(0, nextPle.weekNumber - currentWeek);
}

function getRivalryTimingRank(tone: RivalryTimingTone) {
  if (tone === "watch") {
    return 4;
  }

  if (tone === "build") {
    return 3;
  }

  if (tone === "hot") {
    return 2;
  }

  return 1;
}

export function getRivalryTimingSnapshot(rivalry: Rivalry, game: GameState): RivalryTimingSnapshot {
  const calendarWeek = getCurrentCalendarWeek(game);
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const history = getRivalryHistory(game, rivalry.id, 20);
  const latestPlePayoff = history.find((event) => event.eventType === "ple_payoff");
  const latestHistory = history[0];
  const latestPayoffAge = latestPlePayoff ? Math.max(0, game.currentWeek - latestPlePayoff.weekNumber) : Infinity;
  const recentlyPaidOff = latestPayoffAge <= 2;
  const weeksSinceAdvanced = rivalry.lastAdvancedWeek ? Math.max(0, game.currentWeek - rivalry.lastAdvancedWeek) : Math.max(0, game.currentWeek - 1);
  const currentCardSegments = game.currentShow.filter((segment) => segment.rivalryId === rivalry.id);
  const currentCardParticipants = new Set(
    game.currentShow.flatMap((segment) => segment.participantIds).filter((id) => rivalry.participantIds.includes(id)),
  );
  const diagnostics: RivalryTimingDiagnostic[] = [];

  if (recentlyPaidOff) {
    diagnostics.push({
      id: "recently-paid-off",
      label: "Recently Paid Off",
      detail: `${rivalry.name} hit a PLE checkpoint ${formatWeekCount(latestPayoffAge)} ago.`,
      tone: "steady",
    });
  }

  if (rivalry.pendingEndWeek === game.currentWeek) {
    diagnostics.unshift({
      id: "finale-week",
      label: "Finale Week",
      detail: rivalry.pendingEndReason
        ? `Finale scheduled: ${rivalry.pendingEndReason}. Book the final beat this week — program clears next week.`
        : "Finale scheduled. Book the final beat this week — program clears next week.",
      tone: "watch",
    });
  }

  if (!recentlyPaidOff && rivalry.heat >= 78 && rivalry.weeksActive >= 5 && weeksSinceAdvanced >= 2) {
    diagnostics.push({
      id: "payoff-overdue",
      label: "Payoff Overdue",
      detail: `High heat, ${formatWeekCount(rivalry.weeksActive)} active, and ${formatWeekCount(weeksSinceAdvanced)} since the last recorded beat.`,
      tone: "watch",
    });
  }

  if (!recentlyPaidOff && (calendarWeek.showType === "ple" || weeksUntilPle <= 1) && rivalry.heat >= 65 && rivalry.weeksActive >= 3 && rivalry.freshness >= 40) {
    diagnostics.push({
      id: "ple-ready",
      label: "PLE-Ready",
      detail: `${nextPle?.showName ?? calendarWeek.showName} is close, and this feud has enough heat and time on the board for a major payoff if you choose it.`,
      tone: "hot",
    });
  }

  if (rivalry.status === "stale" || rivalry.status === "cooling" || rivalry.freshness <= 35 || rivalry.heat < 45) {
    diagnostics.push({
      id: "cooling-off",
      label: "Cooling Off",
      detail: `Heat ${rivalry.heat}, freshness ${rivalry.freshness}, and ${formatRivalryStatus(rivalry.status)} status say the room is losing the thread.`,
      tone: "build",
    });
  }

  if (!recentlyPaidOff && currentCardSegments.length === 0 && (weeksSinceAdvanced >= 2 || rivalry.lastAdvancedWeek === 0)) {
    diagnostics.push({
      id: "needs-tv",
      label: "Needs TV",
      detail: rivalry.lastAdvancedWeek
        ? `${formatWeekCount(weeksSinceAdvanced)} since the last recorded beat, and no current rundown segment is attached.`
        : "No recorded TV beat yet, and no current rundown segment is attached.",
      tone: "watch",
    });
  }

  if (rivalry.heat >= 75 && rivalry.freshness >= 50 && !recentlyPaidOff) {
    diagnostics.push({
      id: "hot-program",
      label: "Hot Program",
      detail: `Heat ${rivalry.heat} with ${rivalry.freshness} freshness gives creative a strong live wire.`,
      tone: "hot",
    });
  }

  if (rivalry.weeksActive <= 1 && latestHistory?.eventType === "started") {
    diagnostics.push({
      id: "just-sparked",
      label: "Just Sparked",
      detail: "The premise is fresh. A clean TV beat can make the audience understand why it matters.",
      tone: "build",
    });
  } else if (rivalry.heat >= 55 && rivalry.weeksActive <= 4 && rivalry.freshness >= 45) {
    diagnostics.push({
      id: "building-heat",
      label: "Building Heat",
      detail: `${formatWeekCount(rivalry.weeksActive)} active with enough freshness to keep layering TV beats.`,
      tone: "steady",
    });
  }

  if (currentCardSegments.length) {
    diagnostics.push({
      id: "on-card",
      label: "On Tonight's Board",
      detail: `${currentCardSegments.length} current segment${currentCardSegments.length === 1 ? "" : "s"} attached, with ${currentCardParticipants.size} participant${currentCardParticipants.size === 1 ? "" : "s"} visible.`,
      tone: "steady",
    });
  }

  if (!diagnostics.length) {
    diagnostics.push({
      id: "steady-program",
      label: "Steady Program",
      detail: "The feud has readable state and no urgent timing pressure from the current board.",
      tone: "steady",
    });
  }

  const primary =
    diagnostics.find((item) => item.id === "payoff-overdue") ??
    diagnostics.find((item) => item.id === "ple-ready") ??
    diagnostics.find((item) => item.id === "cooling-off") ??
    diagnostics.find((item) => item.id === "needs-tv") ??
    diagnostics.find((item) => item.id === "hot-program") ??
    diagnostics[0];
  const timingRead = `${formatWeekCount(rivalry.weeksActive)} active · ${rivalry.lastAdvancedWeek ? `${formatWeekCount(weeksSinceAdvanced)} since beat` : "no TV beat yet"} · ${weeksUntilPle === 0 ? "PLE week" : `${formatWeekCount(weeksUntilPle)} to PLE`}`;
  const producerRead =
    primary.id === "payoff-overdue"
      ? "Creative room reads this as high-pressure. Payoff is available, not forced."
      : primary.id === "ple-ready"
        ? "Major-event window is open. The final call stays with the GM."
        : primary.id === "cooling-off"
          ? "This needs a distinct beat or a deliberate exit plan soon."
          : primary.id === "needs-tv"
            ? "The feud needs visibility before the audience loses the thread."
            : primary.id === "hot-program"
              ? "Strong program. Feature it, protect it, or let anticipation breathe."
              : "The feud can keep building at TV pace.";

  return {
    primary,
    diagnostics: diagnostics.slice(0, 4),
    timingRead,
    producerRead,
    weeksSinceAdvanced,
    weeksUntilPle,
    currentCardBeats: currentCardSegments.length,
    currentCardParticipants: currentCardParticipants.size,
    recentlyPaidOff,
  };
}

export function getRivalryTimingSnapshots(game: GameState) {
  return game.rivalries
    .map((rivalry) => ({
      rivalry,
      snapshot: getRivalryTimingSnapshot(rivalry, game),
    }))
    .sort(
      (a, b) =>
        getRivalryTimingRank(b.snapshot.primary.tone) - getRivalryTimingRank(a.snapshot.primary.tone) ||
        b.rivalry.heat - a.rivalry.heat ||
        a.rivalry.name.localeCompare(b.rivalry.name),
    );
}

export function isRivalryOnClock(rivalry: Rivalry, snapshot: RivalryTimingSnapshot) {
  if (rivalry.status === "stale" || rivalry.status === "cooling") {
    return true;
  }

  if (snapshot.primary.tone === "watch" || snapshot.primary.tone === "build") {
    return true;
  }

  if (snapshot.currentCardBeats === 0 && !snapshot.recentlyPaidOff && snapshot.weeksSinceAdvanced >= 1) {
    return true;
  }

  return false;
}

export function getRivalryStageContext(game: GameState, rivalry: Rivalry) {
  const calendarWeek = getCurrentCalendarWeek(game);

  return deriveRivalryStage(rivalry, {
    hasPlePayoff: hasPlePayoff(game, rivalry.id),
    isGoHome: calendarWeek.isGoHome,
    isPle: calendarWeek.showType === "ple",
  });
}

export function getRivalryParticipants(rivalry: Rivalry, wrestlers: Wrestler[]) {
  return rivalry.participantIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));
}

export function getRivalryStructure(rivalry: Rivalry): RivalryStructure {
  return rivalry.structure ?? "singles";
}

export function formatRivalryStructure(structure: RivalryStructure) {
  switch (structure) {
    case "tag_team":
      return "Tag 2v2";
    case "multi_person":
      return "Triple";
    default:
      return "Singles";
  }
}

export function getRivalryStructureMark(structure: RivalryStructure) {
  switch (structure) {
    case "tag_team":
      return "2v2";
    case "multi_person":
      return "Triple";
    default:
      return "1v1";
  }
}

export function getRivalryStructureParticipantRange(structure: RivalryStructure) {
  if (structure === "tag_team") {
    return { min: 4, max: 4 };
  }

  if (structure === "multi_person") {
    return { min: 3, max: 3 };
  }

  return { min: 2, max: 2 };
}

export function formatRivalryStakes(stakes: RivalryStakes) {
  return stakes.charAt(0).toUpperCase() + stakes.slice(1);
}

export function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(" / ");
}

export function getDefaultRivalryComposerParticipantIds(wrestlers: Wrestler[]) {
  const compatibleGroup = wrestlers.find((wrestler, index) => wrestlers.slice(index + 1).some((candidate) => canWrestlersShareMatch([wrestler, candidate])));
  const compatiblePeers = compatibleGroup ? wrestlers.filter((wrestler) => canWrestlersShareMatch([compatibleGroup, wrestler])) : wrestlers;
  const selected = compatiblePeers.slice(0, 4).map((wrestler) => wrestler.id);

  return [...selected, "", "", "", ""].slice(0, 4);
}

export function getPreferredTagPartnerId(wrestlerId: string, wrestlers: Wrestler[], excludedIds: string[]) {
  const wrestler = wrestlers.find((talent) => talent.id === wrestlerId);

  if (!wrestler) {
    return "";
  }

  const excluded = new Set(excludedIds.filter((id) => id && id !== wrestlerId));
  const affiliations = getRosterAffiliations(wrestlers)
    .filter((affiliation) => affiliation.memberWrestlerIds.includes(wrestlerId))
    .sort((a, b) => {
      const aRank = a.kind === "tag_team" ? 0 : a.kind === "faction" ? 1 : 2;
      const bRank = b.kind === "tag_team" ? 0 : b.kind === "faction" ? 1 : 2;
      return aRank - bRank || a.name.localeCompare(b.name);
    });

  for (const affiliation of affiliations) {
    const partner = affiliation.memberWrestlerIds
      .map((id) => wrestlers.find((talent) => talent.id === id))
      .filter((talent): talent is Wrestler => Boolean(talent))
      .find((candidate) => candidate.id !== wrestlerId && !excluded.has(candidate.id) && canWrestlersShareMatch([wrestler, candidate]));

    if (partner) {
      return partner.id;
    }
  }

  return "";
}

function getRivalryStructureKey(structure: RivalryStructure, participantIds: string[]) {
  if (structure === "tag_team" && participantIds.length === 4) {
    const firstSide = participantIds.slice(0, 2).sort().join("+");
    const secondSide = participantIds.slice(2, 4).sort().join("+");
    return [firstSide, secondSide].sort().join("|");
  }

  return [...participantIds].sort().join("|");
}

export function isRivalryIntergenderBlocked(rivalry: Rivalry, wrestlers: Wrestler[]) {
  const participants = getRivalryParticipants(rivalry, wrestlers);

  return participants.length > 1 && !canWrestlersShareMatch(participants);
}

export function getRivalryCreationBlockReason(structure: RivalryStructure, participantIds: string[], wrestlers: Wrestler[]) {
  const selectedIds = participantIds.filter(Boolean);
  const range = getRivalryStructureParticipantRange(structure);

  if (selectedIds.length < range.min) {
    return "";
  }

  if (selectedIds.length > range.max) {
    return `${formatRivalryStructure(structure)} rivalries can use at most ${range.max} wrestlers.`;
  }

  if (new Set(selectedIds).size !== selectedIds.length) {
    return "Each wrestler can only appear once in a rivalry.";
  }

  if (structure === "tag_team" && selectedIds.length !== 4) {
    return "Tag rivalries need exactly two wrestlers on each side.";
  }

  if (structure === "singles" && selectedIds.length !== 2) {
    return "Singles rivalries need exactly two wrestlers.";
  }

  if (structure === "multi_person" && selectedIds.length !== 3) {
    return "Triple rivalries need exactly three wrestlers.";
  }

  const participants = selectedIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler));

  if (participants.length !== selectedIds.length) {
    return "";
  }

  if (!canWrestlersShareMatch(participants)) {
    return "Rivalry blocked: this build follows the same no-intergender boundary as match booking. Choose wrestlers from the same division.";
  }

  return "";
}

export function hasDuplicateRivalry(rivalries: Rivalry[], structure: RivalryStructure, participantIds: string[]) {
  const key = getRivalryStructureKey(structure, participantIds);
  return rivalries.some((rivalry) => getRivalryStructureKey(getRivalryStructure(rivalry), rivalry.participantIds) === key);
}

export function getRivalryShortLabel(name: string, maxLength = 24) {
  if (name.length <= maxLength) {
    return name;
  }

  return `${name.slice(0, maxLength - 1)}…`;
}

export function formatHistoryStamp(event: Pick<RivalryHistoryEvent, "seasonNumber" | "weekNumber" | "showName" | "showType">) {
  const showLabel = event.showName ? ` · ${event.showName}${event.showType ? ` (${event.showType === "ple" ? "PLE" : "TV"})` : ""}` : "";
  return `S${event.seasonNumber} W${event.weekNumber}${showLabel}`;
}

export function getRivalryTitleRelevance(rivalry: Rivalry, championships: Championship[], wrestlers: Wrestler[]) {
  const storyline = getRivalryStoryline(rivalry);
  const participantIds = new Set(rivalry.participantIds);

  for (const championship of championships.filter(isSinglesChampionship)) {
    const championId = championship.championIds[0];
    const hasChampion = participantIds.has(championId);
    const eligibleChallengers = rivalry.participantIds
      .filter((id) => id !== championId)
      .map((id) => wrestlers.find((wrestler) => wrestler.id === id))
      .filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
      .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, championship));

    if (hasChampion && eligibleChallengers.length) {
      return {
        label: storyline.titleFit === "Title" || rivalry.stakes === "title" ? "Title Rivalry" : "Title-Relevant",
        detail: `${championship.name}: ${getWrestlerNames([championId], wrestlers)} vs ${eligibleChallengers.map((wrestler) => wrestler.name).join(" / ")}`,
      };
    }
  }

  if (storyline.titleFit.includes("Title") || storyline.titleFit.includes("title")) {
    return {
      label: "Title-Friendly Story",
      detail: `${storyline.name} can connect to a title scene when champion and contender fit the same division.`,
    };
  }

  return undefined;
}

export function buildRivalryGmRead(game: GameState, rivalry: Rivalry, isGoHome: boolean, isPle: boolean) {
  const titleRelevance = getRivalryTitleRelevance(rivalry, game.championships, game.wrestlers);

  return getRivalryGMRead(rivalry, {
    hasPlePayoff: hasPlePayoff(game, rivalry.id),
    isGoHome,
    isPle,
    titleRelevant: Boolean(titleRelevance && titleRelevance.label !== "Title-Friendly Story"),
  });
}
