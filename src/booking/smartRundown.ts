import { getCatalogOptionById, getDefaultCatalogOption } from "../game/matchFormatCatalog";
import { getStipulationsForSegment } from "../game/stipulationCatalog";
import { deriveRivalryStage } from "../game/rivalryCatalog";
import { getCurrentCalendarWeek, isValidSegment } from "../game/scoring";
import { getSegmentPrestigeWeight, isSeasonFinalePleWeek } from "../game/championshipPrestigeReads";
import { getProtectedRestWrestlerIds } from "../game/socialInboxActions";
import { createUniqueDomainId } from "../game/domainIds";
import { wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type { Championship, GameState, Rivalry, Segment, SocialInboxRequest, Wrestler } from "../game/types";
import {
  canSegmentAttachRivalry,
  canSegmentAttachChampionship,
  canWrestlersShareMatch,
  getSegmentDurationMinutes,
  getShowReadiness,
  getRivalryStructure,
  maxBookingSegments,
  showRuntimeMinMinutes,
  showRuntimeOvertimeMinutes,
} from "./bookingUtils";

export type SmartRundownResult = {
  error?: string;
  notes: string[];
  segments: Segment[];
};

function isSmartRundownAvailable(wrestler: Wrestler) {
  return wrestler.injuryStatus !== "major";
}

function getSmartWeeksOff(wrestler: Wrestler, currentWeek: number) {
  return wrestler.lastBookedWeek ? Math.max(0, currentWeek - wrestler.lastBookedWeek) : currentWeek;
}

function getSmartUsagePenalty(wrestler: Wrestler, usage: Record<string, number>) {
  return (usage[wrestler.id] ?? 0) * 26;
}

function getSmartHash(value: string) {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 997, 17);
}

function getSmartVariantJitter(wrestler: Wrestler, variantSeed: number, role: "match" | "promo" | "story") {
  const roleOffset = role === "match" ? 11 : role === "promo" ? 29 : 47;
  return ((getSmartHash(wrestler.id) + variantSeed * roleOffset) % 25) - 12;
}

function rotateSmartList<T>(items: T[], variantSeed: number) {
  if (items.length < 2) {
    return items;
  }

  const offset = Math.abs(variantSeed) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function getSmartTalentScore(
  wrestler: Wrestler,
  game: GameState,
  usage: Record<string, number>,
  role: "match" | "promo" | "story" = "match",
  variantSeed = 0,
) {
  const championBonus = game.championships.some((championship) => championship.championIds.includes(wrestler.id)) ? 10 : 0;
  const rivalryBonus = game.rivalries.some((rivalry) => rivalry.participantIds.includes(wrestler.id)) ? 8 : 0;
  const underuseBonus = Math.min(18, getSmartWeeksOff(wrestler, game.currentWeek) * 4);
  const conditionBonus = Math.max(0, 35 - wrestler.fatigue) * 0.35;
  const roleSkill = role === "promo" ? wrestler.promoSkill * 0.18 : role === "story" ? wrestler.momentum * 0.2 : wrestler.ringSkill * 0.18;

  return (
    wrestler.popularity * 0.28 +
    wrestler.momentum * 0.24 +
    wrestler.morale * 0.08 +
    roleSkill +
    championBonus +
    rivalryBonus +
    underuseBonus +
    conditionBonus -
    wrestler.fatigue * 0.22 -
    getSmartUsagePenalty(wrestler, usage) +
    getSmartVariantJitter(wrestler, variantSeed, role)
  );
}

function sortSmartTalent(
  wrestlers: Wrestler[],
  game: GameState,
  usage: Record<string, number>,
  role: "match" | "promo" | "story" = "match",
  variantSeed = 0,
) {
  return [...wrestlers].sort(
    (a, b) =>
      getSmartTalentScore(b, game, usage, role, variantSeed) - getSmartTalentScore(a, game, usage, role, variantSeed) ||
      b.popularity - a.popularity ||
      b.momentum - a.momentum ||
      a.fatigue - b.fatigue ||
      a.name.localeCompare(b.name),
  );
}

function getSmartPairKey(ids: string[]) {
  return [...ids].sort().join("|");
}

function hasSmartPairOnCard(participantIds: string[], usedPairs: Set<string>) {
  return participantIds.length === 2 && usedPairs.has(getSmartPairKey(participantIds));
}

function getSmartRivalries(game: GameState, available: Wrestler[], variantSeed = 0) {
  const availableIds = new Set(available.map((wrestler) => wrestler.id));

  const sorted = [...game.rivalries]
    .filter((rivalry) => rivalry.participantIds.length >= 2 && rivalry.participantIds.every((id) => availableIds.has(id)))
    .sort((a, b) => b.heat + b.freshness - (a.heat + a.freshness) || a.name.localeCompare(b.name));

  return rotateSmartList(sorted.slice(0, 4), variantSeed);
}

function chooseSmartTalent(
  game: GameState,
  available: Wrestler[],
  usage: Record<string, number>,
  role: "match" | "promo" | "story",
  variantSeed = 0,
  excludeIds: string[] = [],
  maxUsagePerWrestler = 2,
) {
  const excluded = new Set(excludeIds);
  return sortSmartTalent(
    available.filter((wrestler) => !excluded.has(wrestler.id) && (usage[wrestler.id] ?? 0) < maxUsagePerWrestler),
    game,
    usage,
    role,
    variantSeed,
  )[0];
}

function chooseSmartPair(
  game: GameState,
  available: Wrestler[],
  usage: Record<string, number>,
  usedPairs: Set<string>,
  variantSeed = 0,
  maxUsagePerWrestler = 2,
) {
  const sorted = sortSmartTalent(available, game, usage, "match", variantSeed).filter(
    (wrestler) => (usage[wrestler.id] ?? 0) < maxUsagePerWrestler,
  );

  for (const first of rotateSmartList(sorted, variantSeed)) {
    const second = rotateSmartList(sorted, variantSeed + getSmartHash(first.id)).find(
      (candidate) =>
        candidate.id !== first.id &&
        !usedPairs.has(getSmartPairKey([first.id, candidate.id])) &&
        canWrestlersShareMatch([first, candidate]),
    );
    if (second) {
      return [first, second];
    }
  }

  return [];
}

function getSmartCardShape(game: GameState, available: Wrestler[], variantSeed: number) {
  const rivalryCount = getSmartRivalries(game, available, variantSeed).length;
  const baseMatchCounts = available.length >= 10 ? [2, 3, 4] : available.length >= 6 ? [2, 3] : [2];
  const targetMatchCount = baseMatchCounts[Math.abs(variantSeed) % baseMatchCounts.length];

  return {
    targetMatchCount,
    targetRivalryBeats: Math.min(Math.max(1, rivalryCount), targetMatchCount + 1),
  };
}

function getSmartRivalryMatchOptionId(rivalry: Rivalry) {
  const structure = getRivalryStructure(rivalry);

  if (structure === "tag_team") {
    return "M020";
  }

  if (structure === "multi_person") {
    return rivalry.participantIds.length >= 4 ? "M003" : "M002";
  }

  return "M001";
}

function getSmartRivalryStipulationId(game: GameState, rivalry: Rivalry) {
  if (getRivalryStructure(rivalry) !== "singles") {
    return undefined;
  }

  const calendarWeek = getCurrentCalendarWeek(game);
  const stage = deriveRivalryStage(rivalry, {
    isGoHome: calendarWeek.isGoHome,
    isPle: calendarWeek.showType === "ple",
  });

  if (calendarWeek.showType === "ple" && rivalry.heat >= 78) {
    return rivalry.heat >= 88 ? "tlc_match" : "ladder_match";
  }

  if (stage.id === "blowoff" || rivalry.heat >= 82) {
    return rivalry.heat >= 88 ? "last_man_standing" : "steel_cage";
  }

  if ((stage.id === "go_home" || rivalry.heat >= 75) && rivalry.stakes === "respect") {
    return "iron_man";
  }

  if (rivalry.heat >= 75) {
    return "steel_cage";
  }

  if (rivalry.heat >= 65) {
    return rivalry.stakes === "respect" ? "submission_match" : "street_fight";
  }

  return undefined;
}

function getSmartStoryOptionId(rivalry: Rivalry | undefined, variantSeed: number) {
  if (!rivalry) {
    return variantSeed % 2 === 0 ? "A001" : "P002";
  }

  const options = getRivalryStructure(rivalry) === "singles" ? ["P003", "A046", "P008"] : ["A046", "P003"];
  return options[Math.abs(variantSeed) % options.length];
}

function canUseRivalryMatch(game: GameState, rivalry: Rivalry, participantIds: string[]) {
  const optionId = getSmartRivalryMatchOptionId(rivalry);
  const segment = buildSmartSegment(game, optionId, participantIds, 24, 0, rivalry.id);
  const protectedRestIds = getProtectedRestWrestlerIds(game);

  return canSegmentAttachRivalry(segment, rivalry, game.wrestlers) && isValidSegment(segment, game.wrestlers, protectedRestIds);
}

function buildSmartSegment(
  game: GameState,
  optionId: string,
  participantIds: string[],
  durationMinutes: number,
  index: number,
  rivalryId?: string,
  championshipId?: string,
) {
  const option = getCatalogOptionById(optionId) ?? getDefaultCatalogOption("Match")!;
  let segment: Segment = {
    id: createUniqueDomainId("smart-segment", [game.seasonNumber, game.currentWeek, index + 1, option.id, ...participantIds], game.currentShow.map((item) => item.id)),
    type: option.family,
    participantIds,
    segmentCatalogId: option.id,
    segmentDisplayName: option.label,
    durationMinutes,
    participantMin: option.minParticipants,
    participantMax: option.maxParticipants,
    rivalryId,
  };

  if (option.championshipAllowed && championshipId) {
    const championship = game.championships.find((title) => title.id === championshipId);
    if (championship && canSegmentAttachChampionship(segment, championship, game.wrestlers)) {
      segment = { ...segment, championshipId: championship.id };
    }
  }

  if (rivalryId) {
    const rivalry = game.rivalries.find((item) => item.id === rivalryId);

    if (rivalry) {
      const stipulationId = getSmartRivalryStipulationId(game, rivalry);

      if (stipulationId && getStipulationsForSegment(segment).some((stipulation) => stipulation.id === stipulationId)) {
        segment = {
          ...segment,
          stipulationId,
          durationMinutes: Math.max(durationMinutes, 13),
        };
      }
    }
  }

  return segment;
}

function getActiveSmartInboxRequests(game: GameState) {
  const priority: Record<string, number> = {
    title_shot: 4,
    story_spot: 3,
    tv_time: 2,
    rest: 1,
  };

  return game.socialInbox.requests
    .filter((request) => request.status === "accepted" && request.actionType !== "rest")
    .sort((a, b) => (priority[b.actionType] ?? 0) - (priority[a.actionType] ?? 0) || a.createdWeekNumber - b.createdWeekNumber);
}

function getTitleForSmartRequest(game: GameState, requester: Wrestler) {
  return game.championships
    .filter(
      (championship) =>
        championship.eligibleMatchScope !== "tag_team" &&
        championship.division !== "Tag Team" &&
        championship.championIds.length === 1 &&
        wrestlerFitsChampionshipDivision(requester, championship),
    )
    .sort((a, b) => {
      const aContender = (a.contenderIds ?? []).includes(requester.id) ? 1 : 0;
      const bContender = (b.contenderIds ?? []).includes(requester.id) ? 1 : 0;
      return bContender - aContender || b.prestige - a.prestige || a.name.localeCompare(b.name);
    })[0];
}

function chooseSmartTitleOpponent(
  game: GameState,
  title: Championship,
  requester: Wrestler,
  available: Wrestler[],
  usage: Record<string, number>,
  maxUsagePerWrestler: number,
  variantSeed: number,
) {
  const championId = title.championIds[0];

  if (requester.id !== championId) {
    return available.find((wrestler) => wrestler.id === championId && (usage[wrestler.id] ?? 0) < maxUsagePerWrestler);
  }

  const contenderIds = new Set(title.contenderIds ?? []);
  return sortSmartTalent(
    available.filter(
      (wrestler) =>
        wrestler.id !== requester.id &&
        (usage[wrestler.id] ?? 0) < maxUsagePerWrestler &&
        wrestlerFitsChampionshipDivision(wrestler, title) &&
        canWrestlersShareMatch([requester, wrestler]),
    ),
    game,
    usage,
    "match",
    variantSeed,
  ).sort((a, b) => Number(contenderIds.has(b.id)) - Number(contenderIds.has(a.id)))[0];
}

function buildSmartPromiseSegment(
  game: GameState,
  request: SocialInboxRequest,
  available: Wrestler[],
  usage: Record<string, number>,
  usedPairs: Set<string>,
  index: number,
  maxUsagePerWrestler: number,
  variantSeed: number,
) {
  const requester = available.find((wrestler) => wrestler.id === request.wrestlerId && (usage[wrestler.id] ?? 0) < maxUsagePerWrestler);

  if (!requester) {
    return undefined;
  }

  if (request.actionType === "title_shot") {
    const title = getTitleForSmartRequest(game, requester);
    if (!title) {
      return undefined;
    }

    const opponent = chooseSmartTitleOpponent(game, title, requester, available, usage, maxUsagePerWrestler, variantSeed);
    if (!opponent || opponent.id === requester.id || !canWrestlersShareMatch([requester, opponent])) {
      return undefined;
    }

    const participantIds = title.championIds.includes(requester.id) ? [requester.id, opponent.id] : [opponent.id, requester.id];
    if (hasSmartPairOnCard(participantIds, usedPairs)) {
      return undefined;
    }

    return {
      note: `Accounted for ${request.wrestlerName}'s title-scene promise with a ${title.name} match.`,
      segment: buildSmartSegment(game, "M001", participantIds, 28, index, undefined, title.id),
    };
  }

  if (request.actionType === "story_spot") {
    const rivalry = game.rivalries.find((item) => item.participantIds.includes(request.wrestlerId) && item.status !== "stale");
    const participantIds = rivalry
      ? rivalry.participantIds.filter((id) => available.some((wrestler) => wrestler.id === id) && (usage[id] ?? 0) < maxUsagePerWrestler)
      : [requester.id];
    const optionId = rivalry ? getSmartStoryOptionId(rivalry, variantSeed) : "P002";
    const option = getCatalogOptionById(optionId);

    return {
      note: `Accounted for ${request.wrestlerName}'s story promise on the generated card.`,
      segment: buildSmartSegment(game, optionId, participantIds.slice(0, option?.maxParticipants ?? participantIds.length), rivalry ? 14 : 12, index, rivalry?.id),
    };
  }

  return {
    note: `Accounted for ${request.wrestlerName}'s TV-time promise on the generated card.`,
    segment: buildSmartSegment(game, "P001", [requester.id], 14, index),
  };
}

function getSmartReadiness(game: GameState, segments: Segment[]) {
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const validSegments = segments.filter((segment) => isValidSegment(segment, game.wrestlers, protectedRestIds));
  const runtime = validSegments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);

  return getShowReadiness(validSegments.length, segments.length - validSegments.length, runtime);
}

export function buildSmartRundown(game: GameState, variantSeed = 0): SmartRundownResult {
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const available = game.wrestlers.filter((wrestler) => isSmartRundownAvailable(wrestler) && !protectedRestIds.has(wrestler.id));
  const notes = new Set<string>();
  const segments: Segment[] = [];
  const usage: Record<string, number> = {};
  const usedPairs = new Set<string>();
  const usedRivalryIds = new Set<string>();
  const usedChampionshipIds = new Set<string>();
  const maxUsagePerWrestler = 1;
  const addSegmentObject = (segment: Segment) => {
    if (hasSmartPairOnCard(segment.participantIds, usedPairs)) {
      return false;
    }

    if (segment.championshipId && usedChampionshipIds.has(segment.championshipId)) {
      return false;
    }

    if (segment.rivalryId && usedRivalryIds.has(segment.rivalryId)) {
      return false;
    }

    if (!isValidSegment(segment, game.wrestlers, protectedRestIds)) {
      return false;
    }

    segments.push(segment);
    segment.participantIds.forEach((id) => {
      usage[id] = (usage[id] ?? 0) + 1;
    });

    if (segment.participantIds.length === 2) {
      usedPairs.add(getSmartPairKey(segment.participantIds));
    }

    if (segment.rivalryId) {
      usedRivalryIds.add(segment.rivalryId);
    }

    if (segment.championshipId) {
      usedChampionshipIds.add(segment.championshipId);
    }

    return true;
  };
  const addSegment = (optionId: string, participantIds: string[], durationMinutes: number, rivalryId?: string) => {
    if (hasSmartPairOnCard(participantIds, usedPairs)) {
      return false;
    }

    if (rivalryId && usedRivalryIds.has(rivalryId)) {
      return false;
    }

    const segment = buildSmartSegment(game, optionId, participantIds, durationMinutes, segments.length, rivalryId);
    if (!isValidSegment(segment, game.wrestlers, protectedRestIds)) {
      return false;
    }

    segments.push(segment);
    participantIds.forEach((id) => {
      usage[id] = (usage[id] ?? 0) + 1;
    });

    if (participantIds.length === 2) {
      usedPairs.add(getSmartPairKey(participantIds));
    }

    if (rivalryId) {
      usedRivalryIds.add(rivalryId);
    }

    if (segment.championshipId) {
      usedChampionshipIds.add(segment.championshipId);
    }

    return true;
  };

  if (available.length < 4) {
    return {
      error: "Production needs at least 4 available wrestlers to draft a varied TV card.",
      notes: [],
      segments: [],
    };
  }

  const shape = getSmartCardShape(game, available, variantSeed);
  const rivalryPool = getSmartRivalries(game, available, variantSeed);

  getActiveSmartInboxRequests(game).forEach((request, index) => {
    if (segments.length >= maxBookingSegments) {
      return;
    }

    const promiseSegment = buildSmartPromiseSegment(game, request, available, usage, usedPairs, segments.length, maxUsagePerWrestler, variantSeed + index);
    if (promiseSegment && addSegmentObject(promiseSegment.segment)) {
      notes.add(promiseSegment.note);
    } else {
      notes.add(`Left ${request.wrestlerName}'s accepted ${request.askLabel} ask pending; the current roster, title, or segment rules blocked a clean generated slot.`);
    }
  });

  rivalryPool.slice(0, shape.targetRivalryBeats).forEach((rivalry, index) => {
    if (usedRivalryIds.has(rivalry.id)) {
      return;
    }

    const participantIds = rivalry.participantIds.filter((id) => (usage[id] ?? 0) < maxUsagePerWrestler);

    if (participantIds.length < 2 || hasSmartPairOnCard(participantIds, usedPairs)) {
      return;
    }

    const canBookMatch =
      segments.filter((segment) => segment.type === "Match").length < shape.targetMatchCount &&
      canUseRivalryMatch(game, rivalry, participantIds);

    if (canBookMatch) {
      const optionId = getSmartRivalryMatchOptionId(rivalry);
      if (addSegment(optionId, participantIds, index === 0 ? 30 : 24, rivalry.id)) {
        notes.add(`Featured active rivalry: ${rivalry.name}.`);
        return;
      }
    }

    const storyOptionId = getSmartStoryOptionId(rivalry, variantSeed + index);
    const option = getCatalogOptionById(storyOptionId);
    const storyParticipantIds = participantIds.slice(0, option?.maxParticipants ?? participantIds.length);

    if (addSegment(storyOptionId, storyParticipantIds, index === 0 ? 14 : 10, rivalry.id)) {
      notes.add(`Gave active rivalry TV time: ${rivalry.name}.`);
    } else {
      notes.add(`Skipped ${rivalry.name} because the current segment rules would not accept a clean TV beat.`);
    }
  });

  if (!segments.some((segment) => segment.type === "Match")) {
    const pair = chooseSmartPair(game, available, usage, usedPairs, variantSeed, maxUsagePerWrestler);
    if (pair.length === 2) {
      addSegment("M001", pair.map((wrestler) => wrestler.id), 28);
      notes.add("Built a match around visible popularity, momentum, and manageable fatigue.");
    }
  }

  while (segments.filter((segment) => segment.type === "Match").length < shape.targetMatchCount) {
    const pair = chooseSmartPair(game, available, usage, usedPairs, variantSeed + segments.length, maxUsagePerWrestler);
    if (pair.length !== 2) {
      break;
    }

    addSegment("M001", pair.map((wrestler) => wrestler.id), segments.length <= 2 ? 24 : 20);
    notes.add("Added a match beat so the card shape changes from one smart draft to the next.");
  }

  if (!segments.some((segment) => segment.type === "Promo" || segment.type === "Contract Signing")) {
    const promoTalent = chooseSmartTalent(game, available, usage, "promo", variantSeed, [], maxUsagePerWrestler);
    if (promoTalent) {
      addSegment("P001", [promoTalent.id], 16);
      notes.add("Showcased a strong talker with visible popularity or momentum.");
    }
  }

  if (!segments.some((segment) => segment.type === "Backstage Angle" || segment.type === "Contract Signing" || segment.type === "Open Challenge")) {
    const storyTalent = chooseSmartTalent(game, available, usage, "story", variantSeed, [], maxUsagePerWrestler);
    const storyRivalry = rivalryPool.find((rivalry) => {
      if (usedRivalryIds.has(rivalry.id)) {
        return false;
      }

      const rivalryParticipantIds = rivalry.participantIds.filter((id) => (usage[id] ?? 0) < maxUsagePerWrestler);

      return rivalryParticipantIds.length >= 2 && !hasSmartPairOnCard(rivalryParticipantIds, usedPairs);
    });
    const rivalryParticipants = storyRivalry?.participantIds.filter((id) => (usage[id] ?? 0) < maxUsagePerWrestler) ?? [];

    if (storyRivalry && rivalryParticipants.length >= 2) {
      addSegment("A046", rivalryParticipants.slice(0, 4), 14, storyRivalry.id);
      notes.add("Added backstage texture so the rivalry has more than one TV surface.");
    } else if (storyTalent) {
      addSegment("A001", [storyTalent.id], 14);
      notes.add("Added backstage texture so the card is not only bell-to-bell segments.");
    }
  }

  while (segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0) < showRuntimeMinMinutes && segments.length < 8) {
    const currentRuntime = segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
    const remaining = showRuntimeMinMinutes - currentRuntime;
    const matchCount = segments.filter((segment) => segment.type === "Match").length;
    const pair = chooseSmartPair(game, available, usage, usedPairs, variantSeed + segments.length, maxUsagePerWrestler);

    if (remaining >= 20 && pair.length === 2 && matchCount < shape.targetMatchCount + 1) {
      addSegment("M001", pair.map((wrestler) => wrestler.id), Math.min(26, Math.max(20, remaining)));
      notes.add("Added another match to bring the card into the broadcast window.");
      continue;
    }

    const talker = chooseSmartTalent(game, available, usage, "promo", variantSeed + segments.length, [], maxUsagePerWrestler);
    if (talker && addSegment("P002", [talker.id], Math.min(14, Math.max(10, remaining)))) {
      notes.add("Used short hype time to fill the TV block without forcing another match.");
      continue;
    }

    break;
  }

  const calendarWeek = getCurrentCalendarWeek(game);
  const seasonFinalePle = isSeasonFinalePleWeek(calendarWeek.weekNumber, calendarWeek.showType);

  const mainEventCandidate = segments
    .map((segment, index) => ({
      index,
      segment,
      score:
        segment.participantIds.reduce((sum, id) => {
          const wrestler = game.wrestlers.find((talent) => talent.id === id);
          return sum + (wrestler ? wrestler.popularity + wrestler.momentum - wrestler.fatigue * 0.2 : 0);
        }, 0) +
        (segment.rivalryId ? 40 : 0) +
        (segment.type === "Match" ? 20 : 0) +
        (seasonFinalePle ? getSegmentPrestigeWeight(segment, game) : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (mainEventCandidate && mainEventCandidate.index !== segments.length - 1) {
    const [mainEvent] = segments.splice(mainEventCandidate.index, 1);
    segments.push(mainEvent);
    notes.add(
      seasonFinalePle
        ? "Moved the highest-prestige title match into the closing slot for the season finale."
        : "Moved the strongest visible rivalry/star-power segment into the closing slot.",
    );
  }

  const runtime = segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const readiness = getShowReadiness(segments.length, segments.filter((segment) => !isValidSegment(segment, game.wrestlers, protectedRestIds)).length, runtime);

  if (!readiness.canRun) {
    return {
      error: `Production could not safely draft a ready card: ${readiness.note}`,
      notes: [...notes],
      segments: [],
    };
  }

  const protectedNames = available
    .filter((wrestler) => wrestler.fatigue >= 60 && !(usage[wrestler.id] > 0))
    .slice(0, 2)
    .map((wrestler) => wrestler.name);
  const underusedNames = available
    .filter((wrestler) => (usage[wrestler.id] ?? 0) > 0 && getSmartWeeksOff(wrestler, game.currentWeek) >= 2)
    .slice(0, 2)
    .map((wrestler) => wrestler.name);

  if (protectedNames.length) {
    notes.add(`Protected tired talent: ${protectedNames.join(" / ")} stayed off the draft card.`);
  }

  if (underusedNames.length) {
    notes.add(`Gave underused talent TV time: ${underusedNames.join(" / ")}.`);
  }

  notes.add(`Kept the rough draft inside the ${showRuntimeMinMinutes}-${showRuntimeOvertimeMinutes} minute broadcast-ready window and away from an overrun-heavy layout.`);
  notes.add(`Rotated this smart draft toward a ${shape.targetMatchCount}-match card shape.`);

  return {
    notes: [...notes],
    segments,
  };
}

export function buildSmartSingleSegment(game: GameState, currentShow: Segment[] = game.currentShow, variantSeed = 0): SmartRundownResult {
  const protectedRestIds = getProtectedRestWrestlerIds(game);
  const available = game.wrestlers.filter((wrestler) => isSmartRundownAvailable(wrestler) && !protectedRestIds.has(wrestler.id));
  const usage: Record<string, number> = {};
  const usedPairs = new Set<string>();

  currentShow.forEach((segment) => {
    segment.participantIds.forEach((id) => {
      usage[id] = (usage[id] ?? 0) + 1;
    });

    if (segment.participantIds.length === 2) {
      usedPairs.add(getSmartPairKey(segment.participantIds));
    }
  });

  if (currentShow.length >= maxBookingSegments) {
    return {
      error: "The rundown is full. Remove a segment before autogenerating another.",
      notes: [],
      segments: [],
    };
  }

  if (available.length < 2) {
    return {
      error: "Production needs at least 2 available wrestlers to draft a segment.",
      notes: [],
      segments: [],
    };
  }

  const promise = getActiveSmartInboxRequests(game).find(
    (request) =>
      !currentShow.some((segment) => {
        if (!segment.participantIds.includes(request.wrestlerId)) {
          return false;
        }

        if (request.actionType === "title_shot") {
          return Boolean(segment.championshipId);
        }

        if (request.actionType === "story_spot") {
          return Boolean(segment.rivalryId) || segment.type === "Backstage Angle" || segment.type === "Contract Signing" || segment.type === "Promo";
        }

        return true;
      }),
  );

  if (promise) {
    const promiseMaxUsage = promise.actionType === "title_shot" ? 1 : 2;
    const promiseSegment = buildSmartPromiseSegment(game, promise, available, usage, usedPairs, currentShow.length, promiseMaxUsage, variantSeed);

    if (promiseSegment && isValidSegment(promiseSegment.segment, game.wrestlers, protectedRestIds)) {
      return {
        notes: [promiseSegment.note],
        segments: [promiseSegment.segment],
      };
    }
  }

  const cardHasRivalry = (rivalryId: string) => currentShow.some((segment) => segment.rivalryId === rivalryId);
  const rivalry = getSmartRivalries(
    game,
    available.filter((wrestler) => (usage[wrestler.id] ?? 0) < 2),
    variantSeed,
  )[0];

  if (rivalry && !cardHasRivalry(rivalry.id)) {
    const rivalryParticipantIds = rivalry.participantIds.filter((id) => (usage[id] ?? 0) < 1);

    if (rivalryParticipantIds.length >= 2 && !hasSmartPairOnCard(rivalryParticipantIds, usedPairs)) {
      if (canUseRivalryMatch(game, rivalry, rivalryParticipantIds) && !usedPairs.has(getSmartPairKey(rivalryParticipantIds))) {
        const segment = buildSmartSegment(game, getSmartRivalryMatchOptionId(rivalry), rivalryParticipantIds, 28, currentShow.length, rivalry.id);

        return {
          notes: [`Featured active rivalry: ${rivalry.name}.`],
          segments: [segment],
        };
      }

      const storyOptionId = getSmartStoryOptionId(rivalry, variantSeed);
      const option = getCatalogOptionById(storyOptionId);
      const storyParticipantIds = rivalryParticipantIds.slice(0, option?.maxParticipants ?? rivalryParticipantIds.length);
      const promoSegment = buildSmartSegment(game, storyOptionId, storyParticipantIds, 14, currentShow.length, rivalry.id);

      if (isValidSegment(promoSegment, game.wrestlers, protectedRestIds)) {
        return {
          notes: [`Featured ${rivalry.name} in a talk segment.`],
          segments: [promoSegment],
        };
      }
    }
  }

  if (!currentShow.some((segment) => segment.type === "Match")) {
    const pair = chooseSmartPair(game, available, usage, usedPairs, variantSeed, 1);

    if (pair.length === 2) {
      const segment = buildSmartSegment(game, "M001", pair.map((wrestler) => wrestler.id), 28, currentShow.length);

      if (isValidSegment(segment, game.wrestlers, protectedRestIds)) {
        return {
          notes: ["Built a match around popularity, momentum, and manageable fatigue."],
          segments: [segment],
        };
      }
    }
  }

  if (!currentShow.some((segment) => segment.type === "Promo")) {
    const promoTalent = chooseSmartTalent(game, available, usage, "promo", variantSeed);

    if (promoTalent) {
      const segment = buildSmartSegment(game, "P001", [promoTalent.id], 16, currentShow.length);

      if (isValidSegment(segment, game.wrestlers, protectedRestIds)) {
        return {
          notes: ["Showcased a strong talker with visible popularity or momentum."],
          segments: [segment],
        };
      }
    }
  }

  if (!currentShow.some((segment) => segment.type === "Backstage Angle" || segment.type === "Contract Signing" || segment.type === "Open Challenge")) {
    const storyTalent = chooseSmartTalent(game, available, usage, "story", variantSeed);
    const rivalryParticipants = rivalry?.participantIds.filter((id) => (usage[id] ?? 0) < 2) ?? [];

    if (rivalry && rivalryParticipants.length >= 2 && !hasSmartPairOnCard(rivalryParticipants, usedPairs)) {
      const segment = buildSmartSegment(game, "A046", rivalryParticipants.slice(0, 4), 14, currentShow.length, rivalry.id);

      if (isValidSegment(segment, game.wrestlers, protectedRestIds)) {
        return {
          notes: ["Added backstage texture for the active rivalry."],
          segments: [segment],
        };
      }
    }

    if (storyTalent) {
      const segment = buildSmartSegment(game, "A001", [storyTalent.id], 14, currentShow.length);

      if (isValidSegment(segment, game.wrestlers, protectedRestIds)) {
        return {
          notes: ["Added backstage texture to break up the card."],
          segments: [segment],
        };
      }
    }
  }

  const pair = chooseSmartPair(game, available, usage, usedPairs, variantSeed, 1);

  if (pair.length === 2) {
    const segment = buildSmartSegment(game, "M001", pair.map((wrestler) => wrestler.id), 24, currentShow.length);

    if (isValidSegment(segment, game.wrestlers, protectedRestIds)) {
      return {
        notes: ["Added another match beat to the rundown."],
        segments: [segment],
      };
    }
  }

  const fallbackPair = chooseSmartPair(game, available, usage, usedPairs, variantSeed, 2);

  if (fallbackPair.length === 2) {
    const segment = buildSmartSegment(game, "M001", fallbackPair.map((wrestler) => wrestler.id), 24, currentShow.length);

    if (isValidSegment(segment, game.wrestlers, protectedRestIds)) {
      return {
        notes: ["Added a fallback match beat to get the rundown closer to ready."],
        segments: [segment],
      };
    }
  }

  const talker = chooseSmartTalent(game, available, usage, "promo", variantSeed);

  if (talker) {
    const segment = buildSmartSegment(game, "P002", [talker.id], 12, currentShow.length);

    if (isValidSegment(segment, game.wrestlers, protectedRestIds)) {
      return {
        notes: ["Used short hype time to add one more TV beat."],
        segments: [segment],
      };
    }
  }

  return {
    error: "Production could not safely draft a ready segment from the current roster.",
    notes: [],
    segments: [],
  };
}

export function buildSmartFillGaps(game: GameState, currentShow: Segment[] = game.currentShow, variantSeed = 0): SmartRundownResult {
  if (currentShow.length >= maxBookingSegments) {
    return {
      error: "The rundown is full. Remove a segment before autogenerating another.",
      notes: [],
      segments: [],
    };
  }

  const notes = new Set<string>();
  const additions: Segment[] = [];
  let draftShow = [...currentShow];
  let readiness = getSmartReadiness(game, draftShow);

  while (!readiness.canRun && draftShow.length < maxBookingSegments) {
    const result = buildSmartSingleSegment(game, draftShow, variantSeed + additions.length);

    if (result.error || !result.segments[0]) {
      return {
        error: result.error ?? `Production could not safely fill the remaining card: ${readiness.note}`,
        notes: [...notes],
        segments: additions,
      };
    }

    const [segment] = result.segments;
    additions.push(segment);
    result.notes.forEach((note) => notes.add(note));
    draftShow = [...draftShow, segment];
    readiness = getSmartReadiness(game, draftShow);
  }

  if (!readiness.canRun) {
    return {
      error: `Production added what it could, but the card still is not ready: ${readiness.note}`,
      notes: [...notes],
      segments: additions,
    };
  }

  return {
    notes: [...notes],
    segments: additions,
  };
}
