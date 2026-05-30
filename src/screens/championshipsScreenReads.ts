import { isTagChampionship } from "../booking/bookingUtils";
import { getRosterAffiliations } from "../game/affiliationCatalog";
import { getTitleDivisionScene, getTitleScenePressureSnapshot, getTitleSceneTalentScore, type TitleScenePressureDiagnostic, type TitleScenePressureSnapshot, type TitleScenePressureTone } from "../game/gameContextReads";
import { getRosterPressureTags, getWeeksSinceLastBooked } from "../game/rosterContextReads";
import { getCurrentCalendarWeek, getWrestlerDivisionGroup } from "../game/scoring";
import { formatChampionshipEventType, getChampionshipHistory, getChampionshipHistoryAgeWeeks } from "../game/storyContextReads";
import { wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type { CalendarWeek, Championship, ChampionshipHistoryEvent, GameState, Rivalry, RivalryHistoryEvent, ShowType, Wrestler } from "../game/types";
import { getWrestlerIdentityContext } from "../game/wrestlerIdentityContext";

export type TitleSceneTalentRead = {
  wrestler: Wrestler;
  labels: string[];
  detail: string;
};

export type ChampionshipSceneDeskRead = {
  headline: string;
  detail: string;
  championReads: TitleSceneTalentRead[];
  contenderReads: TitleSceneTalentRead[];
  recentActivityRead: string;
  pleWindowRead: string;
};

export type TitleSceneIdentityRead = {
  headline: string;
  championIdentity: string;
  divisionRead: string;
  healthLabel: string;
  healthDetail: string;
  heatLabel: string;
  heatDetail: string;
  depthLabel: string;
  depthDetail: string;
  tone: TitleScenePressureTone;
};

export type ChampionshipsOfficeRead = {
  headline: string;
  detail: string;
  anchorTitle: string;
  anchorDetail: string;
  attentionTitle: string;
  attentionDetail: string;
  prestigeTitle: string;
  prestigeDetail: string;
  tone: TitleScenePressureTone;
};

function canWrestlersShareMatch(wrestlers: Wrestler[]) {
  const divisions = [...new Set(wrestlers.map((wrestler) => getWrestlerDivisionGroup(wrestler)).filter((division): division is "mens" | "womens" => Boolean(division)))];
  return divisions.length <= 1;
}

export function getChampionshipAcronym(championshipName: string) {
  const words = championshipName.match(/[A-Za-z]+/g) ?? [];
  const acronym = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  return acronym || championshipName;
}

export function getWrestlerNames(ids: string[], wrestlers: Wrestler[]) {
  return ids.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown").join(" / ");
}

export function getReignLength(championship: Championship, currentWeek: number) {
  return Math.max(1, currentWeek - championship.reignStartWeek + 1);
}

function formatWeekCount(weeks: number) {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

function getShowTypeLabel(showType: ShowType) {
  return showType === "ple" ? "PLE" : "TV";
}

export function formatHistoryStamp(
  event: Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "seasonNumber" | "weekNumber"> &
    Partial<Pick<ChampionshipHistoryEvent | RivalryHistoryEvent, "showName" | "showType">>,
) {
  const showLabel = event.showName ? ` · ${event.showName}${event.showType ? ` (${getShowTypeLabel(event.showType)})` : ""}` : "";
  return `S${event.seasonNumber} W${event.weekNumber}${showLabel}`;
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

export function getTagDivisionHealthDiagnostics(championship: Championship, game: GameState): TitleScenePressureDiagnostic[] {
  if (!isTagChampionship(championship)) {
    return [];
  }

  const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
  const diagnostics: TitleScenePressureDiagnostic[] = [];
  const challengers = scene.eligibleRoster;
  const champions = scene.champions;
  const championPairActive =
    champions.length === 2 &&
    champions.every(
      (wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) <= 2 && !getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
    );
  const restedChallengers = challengers.filter((wrestler) => getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2);
  const challengerInjuryRisk = challengers.some(
    (wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );

  const hasFreshMatchup = restedChallengers.length >= 2;
  const hasHotPair = (() => {
    for (let index = 0; index < challengers.length; index += 1) {
      const first = challengers[index];
      for (let next = index + 1; next < challengers.length; next += 1) {
        const second = challengers[next];
        if (
          (first.momentum >= 75 && second.momentum >= 75) ||
          (first.popularity >= 78 && second.popularity >= 78)
        ) {
          return true;
        }
      }
    }

    return false;
  })();

  const championInjuryRisk = champions.some(
    (wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"),
  );
  const recentHistory = getChampionshipHistory(game, championship.id, 1);
  const latestTitleEvent = recentHistory[0];
  const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
  const reignLength = getReignLength(championship, game.currentWeek);
  const weeksSinceLastTitleEvent = latestTitleEvent
    ? getChampionshipHistoryAgeWeeks(game, latestTitleEvent)
    : Math.max(0, reignLength - 1);

  diagnostics.push({
    id: "tag-champion-pair-active",
    label: scene.champions.length >= 2 ? "Champion Pair Active" : "Champion Pair Needed",
    detail:
      scene.champions.length >= 2
        ? championPairActive
          ? `The champions, ${getWrestlerNames(championship.championIds, game.wrestlers)}, are active enough to make a credible defense.`
          : "One or both champions are currently quiet, so momentum checks are advisory only."
        : "No champion pair is assigned yet, so the tag title needs a GM assignment before it can be defended.",
    tone: scene.champions.length >= 2 ? (championPairActive ? "steady" : "watch") : "build",
  });

  if (challengers.length < 2) {
    diagnostics.push({
      id: "tag-needs-challengers",
      label: "Needs Challengers",
      detail: "Two eligible non-champion wrestlers are required to safely build another tag title defense lane.",
      tone: "build",
    });
  } else if (challengers.length < 4) {
    diagnostics.push({
      id: "tag-underrepresented",
      label: "Tag Title Underrepresented",
      detail: "The challenger pool is thin for repeated title-defenses while keeping rotation variety.",
      tone: "watch",
    });
  }

  if (hasFreshMatchup) {
    diagnostics.push({
      id: "tag-fresh-matchup",
      label: "Fresh Matchup Available",
      detail: "There are rested challengers available for a fresh 2v2 defense booking.",
      tone: "hot",
    });
  }

  if (hasHotPair) {
    diagnostics.push({
      id: "tag-hot-pair",
      label: "Hot Pair Available",
      detail: "At least one eligible pair is showing strong momentum/popularity for immediate tag title challenge framing.",
      tone: "hot",
    });
  }

  if (championInjuryRisk || challengerInjuryRisk) {
    diagnostics.push({
      id: "tag-injury-risk",
      label: "Injury Risk Around Champions",
      detail: "Injury flags around champions/challengers should be checked before deciding the defense lane.",
      tone: "watch",
    });
  }

  if (latestTitleEvent?.eventType === "successful_defense" && weeksSinceLastTitleEvent <= 1) {
    diagnostics.push({
      id: "tag-recent-defense",
      label: "Recently Defended",
      detail: "The title was actively defended in the latest resolvable title event.",
      tone: "steady",
    });
  }

  if (reignLength >= defenseWindow && championship.defenses === 0) {
    diagnostics.push({
      id: "tag-stale-reign",
      label: "Stale Reign",
      detail: `${Math.max(weeksSinceLastTitleEvent, defenseWindow)} weeks since last title event. A fresh defense is advisable.`,
      tone: "build",
    });
  }

  return diagnostics;
}

export function getTitleSceneRead(championship: Championship, wrestlers: Wrestler[], currentWeek: number, rivalries: Rivalry[] = []) {
  const scene = getTitleDivisionScene(championship, wrestlers, rivalries, currentWeek);
  const contenders = scene.eligibleRoster;
  const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
  const reignLength = getReignLength(championship, currentWeek);

  if (championship.eligibleMatchScope === "tag_team") {
    return {
      label: contenders.length >= 2 ? "Tag Lane Ready" : "Needs Challengers",
      detail:
        contenders.length >= 2
          ? "The champions have enough roster depth for a 2v2 M020 title defense."
          : "The tag title needs two available challengers outside the champion pair.",
    };
  }

  if (contenders.length < 2) {
    return {
      label: "Needs Contenders",
      detail: "The roster needs more same-division contenders around this championship.",
    };
  }

  if (contenders.length < 4) {
    return {
      label: "Thin Scene",
      detail: "There is a title lane, but the challenger pool is narrow.",
    };
  }

  if (reignLength >= defenseWindow && championship.defenses === 0) {
    return {
      label: "Needs Attention",
      detail: `No defense recorded across a ${reignLength}-week reign.`,
    };
  }

  if (contenders.length > 7) {
    return {
      label: "Crowded Scene",
      detail: "Plenty of eligible talent can credibly circle this title.",
    };
  }

  if (!contenders.some((wrestler) => wrestler.momentum >= 75)) {
    return {
      label: "Cold Scene",
      detail: "The division has bodies, but nobody is carrying hot momentum yet.",
    };
  }

  return {
    label: "Strong Scene",
    detail: `${contenders.length} same-division contender${contenders.length === 1 ? "" : "s"} fit the title picture.`,
  };
}

function getTitleRivalries(championship: Championship, wrestlers: Wrestler[], rivalries: Rivalry[]) {
  const championIds = new Set(championship.championIds);

  return rivalries.filter((rivalry) => {
    if (rivalry.status === "stale" || rivalry.stakes !== "title") {
      return false;
    }

    const hasChampion = rivalry.participantIds.some((id) => championIds.has(id));
    const hasEligibleChallenger = rivalry.participantIds.some((id) => {
      const wrestler = wrestlers.find((talent) => talent.id === id);
      return Boolean(wrestler && !championIds.has(id) && wrestlerFitsChampionshipDivision(wrestler, championship, wrestlers));
    });

    return hasChampion && hasEligibleChallenger;
  });
}

export function getTitleSceneTalentRead(wrestler: Wrestler, game: GameState, currentChampionshipId: string): TitleSceneTalentRead {
  const identity = getWrestlerIdentityContext(wrestler);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const otherTitleLabels = getOtherChampionshipHolderLabels(wrestler, game.championships, currentChampionshipId);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const labels = [
    wrestler.momentum >= 70 ? "Hot" : null,
    wrestler.momentum < 45 ? "Cold" : null,
    wrestler.injuryStatus === "major" ? "Unavailable" : null,
    wrestler.injuryStatus === "minor" ? "Working Hurt" : null,
    pressureTags.includes("Overused") ? "Overused" : null,
    pressureTags.includes("Underused") ? "Underused" : null,
    weeksSinceLastBooked >= 2 ? "Missing TV" : null,
    ...otherTitleLabels,
  ].filter((label): label is string => Boolean(label));
  const detail =
    wrestler.injuryStatus === "major"
      ? `${wrestler.name} is blocked by a major injury.`
      : pressureTags.includes("Overused")
        ? `${wrestler.name} carries ${wrestler.fatigue} fatigue and ${wrestler.consecutiveWeeksBooked ?? 0} straight week${(wrestler.consecutiveWeeksBooked ?? 0) === 1 ? "" : "s"} booked.`
        : pressureTags.includes("Underused")
          ? `${wrestler.name} has been off TV for ${formatWeekCount(weeksSinceLastBooked)}.`
          : otherTitleLabels.length
            ? `${wrestler.name} also carries ${otherTitleLabels.join(" / ")} context.`
            : `${identity.role} · ${identity.wrestlingStyle} · ${identity.promoStyle}.`;

  return {
    wrestler,
    labels: [...new Set(labels)].slice(0, 4),
    detail,
  };
}

export function getChampionshipSceneDeskRead(
  championship: Championship,
  game: GameState,
  scene: ReturnType<typeof getTitleDivisionScene>,
  pressureSnapshot: TitleScenePressureSnapshot,
): ChampionshipSceneDeskRead {
  const latestTitleEvent = getChampionshipHistory(game, championship.id, 1)[0];
  const nextPle = getNextPle(game.calendar, game.currentWeek);
  const weeksUntilPle = getWeeksUntilPle(nextPle, game.currentWeek);
  const championReads = scene.champions.map((wrestler) => getTitleSceneTalentRead(wrestler, game, championship.id));
  const contenderReads = scene.topContenders.slice(0, isTagChampionship(championship) ? 4 : 3).map((wrestler) => getTitleSceneTalentRead(wrestler, game, championship.id));
  const championRivalries = game.rivalries.filter(
    (rivalry) => rivalry.status !== "stale" && rivalry.participantIds.some((id) => championship.championIds.includes(id)),
  );
  const recentActivityRead = latestTitleEvent
    ? `${formatChampionshipEventType(latestTitleEvent.eventType)} at ${formatHistoryStamp(latestTitleEvent)}.`
    : `No resolved title event yet; title clock reads ${formatWeekCount(pressureSnapshot.weeksSinceLastTitleEvent)}.`;
  const pleWindowRead =
    weeksUntilPle === 0
      ? `${getCurrentCalendarWeek(game).showName} is a PLE week. Title defense pressure is visible, not automatic.`
      : nextPle && weeksUntilPle <= 2
        ? `${nextPle.showName} is ${formatWeekCount(weeksUntilPle)} away, so major-defense context is close if the scene supports it.`
        : nextPle
          ? `${nextPle.showName} is ${formatWeekCount(weeksUntilPle)} away; TV can keep the title scene warm.`
          : "No remaining PLE window this season.";
  const championContext = championRivalries.length
    ? `${championRivalries[0].name} gives the champion active story context.`
    : championReads.length
      ? `${championReads.map((read) => read.wrestler.name).join(" / ")} currently anchors the scene without a title-specific active rivalry.`
      : "No champion resolves from the current roster data.";
  const contenderPressure = contenderReads.length
    ? `${contenderReads.length} front-line contender${contenderReads.length === 1 ? "" : "s"} are visible: ${contenderReads.map((read) => read.wrestler.name).join(" / ")}.`
    : "No front-line contender read is available for this title.";
  const headline = `${pressureSnapshot.primary.label} · ${pressureSnapshot.divisionHealth}`;
  const detail = `${championContext} ${contenderPressure} ${pressureSnapshot.producerRead}`;

  return {
    headline,
    detail,
    championReads,
    contenderReads,
    recentActivityRead,
    pleWindowRead,
  };
}

function getChampionIdentityRead(championship: Championship, scene: ReturnType<typeof getTitleDivisionScene>, game: GameState) {
  if (!scene.champions.length) {
    return "No champion resolves from the current roster data.";
  }

  const championNames = formatTitleSceneNames(scene.champions, "No champion assigned");
  const titleRivalries = getTitleRivalries(championship, game.wrestlers, game.rivalries);
  const championMomentum = Math.round(scene.champions.reduce((sum, wrestler) => sum + wrestler.momentum, 0) / Math.max(1, scene.champions.length));
  const championPopularity = Math.round(scene.champions.reduce((sum, wrestler) => sum + wrestler.popularity, 0) / Math.max(1, scene.champions.length));
  const championRisk = scene.champions.some((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"));

  if (championRisk) {
    return `${championNames} anchors the belt, but medical/fatigue pressure is visible around the reign.`;
  }

  if (titleRivalries.length) {
    return `${championNames} carries active title-story context through ${titleRivalries[0].name}.`;
  }

  if (championMomentum >= 75 || championPopularity >= 78) {
    return `${championNames} reads like a prestige centerpiece at ${championMomentum} momentum and ${championPopularity} popularity.`;
  }

  return `${championNames} gives the division a steady champion identity without forcing a defense.`;
}

export function getTitleSceneIdentityRead(
  championship: Championship,
  game: GameState,
  scene: ReturnType<typeof getTitleDivisionScene>,
  pressureSnapshot: TitleScenePressureSnapshot,
): TitleSceneIdentityRead {
  const titleRivalries = getTitleRivalries(championship, game.wrestlers, game.rivalries);
  const hotContenders = scene.eligibleRoster.filter((wrestler) => wrestler.momentum >= 75);
  const championRisk = scene.champions.some((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"));
  const contenderDepth = scene.eligibleRoster.length;
  const isTagTitleScene = isTagChampionship(championship);
  const latestHistory = getChampionshipHistory(game, championship.id, 1)[0];
  const recentActivity = latestHistory
    ? `${formatChampionshipEventType(latestHistory.eventType)} at ${formatHistoryStamp(latestHistory)}.`
    : `No resolved title event yet; the title clock reads ${formatWeekCount(pressureSnapshot.weeksSinceLastTitleEvent)}.`;
  const healthLabel =
    pressureSnapshot.primary.tone === "build"
      ? "Needs Attention"
      : pressureSnapshot.primary.tone === "watch"
        ? "Office Watch"
        : pressureSnapshot.primary.tone === "hot"
          ? "Hot Scene"
          : "Stable Scene";
  const heatLabel = titleRivalries.length ? "Story Heat" : hotContenders.length ? "Contender Heat" : "Quiet Heat";
  const depthLabel =
    isTagTitleScene
      ? contenderDepth >= 4
        ? "Pair Depth"
        : contenderDepth >= 2
          ? "Playable Tag Lane"
          : "Thin Tag Lane"
      : contenderDepth >= 7
        ? "Deep Division"
        : contenderDepth >= 3
          ? "Credible Chase"
          : "Thin Division";
  const headline =
    isTagTitleScene
      ? contenderDepth >= 2
        ? "Tag Division Identity"
        : "Tag Division Needs Shape"
      : titleRivalries.length
        ? "Title Story Centerpiece"
        : championRisk
          ? "Protected Champion Scene"
          : hotContenders.length >= 2
            ? "Hot Contender Room"
            : contenderDepth < 3
              ? "Thin Title Lane"
              : "Prestige Division Lane";
  const divisionRead =
    titleRivalries.length
      ? `${titleRivalries[0].name} gives this belt an active story lane.`
      : hotContenders.length
        ? `${hotContenders.slice(0, 2).map((wrestler) => wrestler.name).join(" / ")} are carrying visible momentum near the title.`
        : contenderDepth
          ? `${formatTitleSceneNames(scene.topContenders, "The contender room")} keeps the belt readable without a forced title beat.`
          : "No eligible contender room is visible from the current roster.";

  return {
    headline,
    championIdentity: getChampionIdentityRead(championship, scene, game),
    divisionRead,
    healthLabel,
    healthDetail: `${pressureSnapshot.primary.detail} ${recentActivity}`,
    heatLabel,
    heatDetail: titleRivalries.length
      ? `Active title-story heat: ${titleRivalries.map((rivalry) => rivalry.name).slice(0, 2).join(" / ")}.`
      : hotContenders.length
        ? `${hotContenders.length} hot contender${hotContenders.length === 1 ? "" : "s"} in the current eligible pool.`
        : "No active title rivalry or hot contender is currently carrying the scene.",
    depthLabel,
    depthDetail: `${contenderDepth} eligible challenger${contenderDepth === 1 ? "" : "s"} outside the champion slot; ${scene.risingContenders.length} rising lane${scene.risingContenders.length === 1 ? "" : "s"} visible.`,
    tone: pressureSnapshot.primary.tone,
  };
}

function getTitleOfficeRank(tone: TitleScenePressureTone) {
  if (tone === "hot") {
    return 4;
  }

  if (tone === "steady") {
    return 3;
  }

  if (tone === "watch") {
    return 2;
  }

  return 1;
}

export function getChampionshipOfficeRead(game: GameState): ChampionshipsOfficeRead {
  const snapshots = game.championships.map((championship) => {
    const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
    const pressureSnapshot = getTitleScenePressureSnapshot(championship, game);
    const identity = getTitleSceneIdentityRead(championship, game, scene, pressureSnapshot);
    const championRisk = scene.champions.some((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"));
    const titleRivalryCount = getTitleRivalries(championship, game.wrestlers, game.rivalries).length;
    const heatScore = championship.prestige + getTitleOfficeRank(identity.tone) * 18 + titleRivalryCount * 16 + scene.topContenders.filter((wrestler) => wrestler.momentum >= 75).length * 8;
    const attentionScore =
      (identity.tone === "build" ? 70 : identity.tone === "watch" ? 45 : 0) +
      (scene.eligibleRoster.length < (isTagChampionship(championship) ? 2 : 3) ? 35 : 0) +
      (championRisk ? 25 : 0) +
      pressureSnapshot.weeksSinceLastTitleEvent * 2;

    return {
      attentionScore,
      championship,
      heatScore,
      identity,
      pressureSnapshot,
      scene,
    };
  });
  const anchor = [...snapshots].sort((a, b) => b.heatScore - a.heatScore || b.championship.prestige - a.championship.prestige)[0];
  const attention = [...snapshots].sort((a, b) => b.attentionScore - a.attentionScore || b.championship.prestige - a.championship.prestige)[0];
  const prestige = [...snapshots].sort((a, b) => b.championship.prestige - a.championship.prestige)[0];
  const watchCount = snapshots.filter((snapshot) => snapshot.identity.tone === "watch" || snapshot.identity.tone === "build").length;

  return {
    headline: watchCount ? "Title Committee Has Active Decisions" : "Title Committee Has Stable Prestige",
    detail: "Read-only championship office context from current champions, contender rooms, active title stories, and resolved title history. No rankings or title mechanics are added here.",
    anchorTitle: anchor?.championship.name ?? "No championship",
    anchorDetail: anchor ? `${anchor.identity.headline}. ${anchor.identity.divisionRead}` : "No championship data is available.",
    attentionTitle: attention?.championship.name ?? "No championship",
    attentionDetail: attention ? `${attention.identity.healthLabel}. ${attention.identity.healthDetail}` : "No title scene needs attention.",
    prestigeTitle: prestige?.championship.name ?? "No championship",
    prestigeDetail: prestige ? `Prestige ${prestige.championship.prestige} with ${formatTitleSceneNames(prestige.scene.champions, "no champion assigned")}.` : "No prestige read is available.",
    tone: watchCount ? "watch" : anchor?.identity.tone ?? "steady",
  };
}

export function getTitleSceneGMRead(championship: Championship, scene: ReturnType<typeof getTitleDivisionScene>) {
  if (championship.eligibleMatchScope === "tag_team") {
    return "Tag title defenses are available only as 2v2 M020 matches with the champion pair together on one side.";
  }

  if (scene.eligibleRoster.length < 2) {
    return "Division is thin. This belt needs more eligible wrestlers before the title scene can breathe.";
  }

  const [first, second] = scene.topContenders;

  if (first && second && getTitleSceneTalentScore(first, championship) - getTitleSceneTalentScore(second, championship) >= 20) {
    return `Clear challenger emerging: ${first.name} is separating from the pack.`;
  }

  if (scene.eligibleRoster.length > 7) {
    return "Crowded contender field. This belt can support eliminators, contender promos, or a multi-person spotlight.";
  }

  if (scene.risingContenders.length) {
    return `${scene.risingContenders[0].name} is rising behind the front line.`;
  }

  return "Stable title lane. The champion has enough credible challengers for weekly TV.";
}

function formatTitleSceneNames(wrestlers: Wrestler[], fallback: string) {
  return wrestlers.length ? wrestlers.map((wrestler) => wrestler.name).join(" / ") : fallback;
}

function getOtherChampionshipHolderLabels(wrestler: Wrestler, championships: Championship[], currentChampionshipId?: string) {
  return championships
    .filter((championship) => championship.id !== currentChampionshipId)
    .filter((championship) => championship.championIds.includes(wrestler.id))
    .map((championship) => `${championship.name} holder`);
}

function getPreferredTagPartnerId(wrestlerId: string, wrestlers: Wrestler[], excludedIds: string[]) {
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

export function buildTagTeamChallengerRows(
  contenderRows: Array<{ index: number; wrestler: Wrestler }>,
  wrestlers: Wrestler[],
  excludedIds: string[],
  limit = 3,
) {
  const usedIds = new Set(excludedIds);
  const rows: Array<{ rank: number; wrestlers: [Wrestler, Wrestler] }> = [];

  for (const { wrestler } of contenderRows) {
    if (rows.length >= limit || usedIds.has(wrestler.id)) {
      continue;
    }

    const partnerId = getPreferredTagPartnerId(wrestler.id, wrestlers, [...usedIds]);
    const partner =
      (partnerId ? wrestlers.find((talent) => talent.id === partnerId) : undefined) ??
      contenderRows
        .map((row) => row.wrestler)
        .find((candidate) => candidate.id !== wrestler.id && !usedIds.has(candidate.id) && canWrestlersShareMatch([wrestler, candidate]));

    if (!partner) {
      continue;
    }

    rows.push({ rank: rows.length + 1, wrestlers: [wrestler, partner] });
    usedIds.add(wrestler.id);
    usedIds.add(partner.id);
  }

  return rows;
}

export { isTagChampionship };
