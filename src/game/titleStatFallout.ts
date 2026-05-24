import type {
  Championship,
  ChampionshipHistoryEvent,
  GameState,
  SegmentResult,
  ShowType,
  Wrestler,
} from "./types";

export const TITLE_STAT_FALLOUT = {
  titleWinMomentum: 8,
  titleWinPopularity: 4,
  titleLossMomentum: -4,
  titleLossPopularity: -2,
  defenseMomentum: 3,
  defensePopularity: 1,
  challengerLossMomentum: -1,
  pleMultiplier: 1.25,
  eliteScoreBonusMomentum: 2,
  eliteScoreBonusPopularity: 1,
  strongScoreBonusMomentum: 1,
  newChampionCarryMomentum: 2,
  newChampionCarryPopularity: 1,
  recentDefenseCarryMomentum: 1,
  recentDefenseCarryPopularity: 1,
  staleReignCarryMomentum: -1,
  staleReignCarryPopularity: -1,
  recentDefenseLookbackWeeks: 3,
};

export type TitleStatFalloutNote = {
  wrestlerId: string;
  wrestlerName: string;
  momentumChange: number;
  popularityChange: number;
  note: string;
};

type StatDelta = {
  momentum: number;
  popularity: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function getPrestigeMultiplier(prestige: number) {
  return clamp(0.85 + (prestige - 76) * (0.3 / 16), 0.85, 1.15);
}

function getScoreBonuses(score: number): StatDelta {
  if (score >= 90) {
    return { momentum: TITLE_STAT_FALLOUT.eliteScoreBonusMomentum, popularity: TITLE_STAT_FALLOUT.eliteScoreBonusPopularity };
  }

  if (score >= 85) {
    return { momentum: TITLE_STAT_FALLOUT.strongScoreBonusMomentum, popularity: 0 };
  }

  return { momentum: 0, popularity: 0 };
}

function scaleStatDelta(base: StatDelta, score: number, showType: ShowType, prestige: number): StatDelta {
  const multiplier = (showType === "ple" ? TITLE_STAT_FALLOUT.pleMultiplier : 1) * getPrestigeMultiplier(prestige);
  const scoreBonuses = getScoreBonuses(score);

  return {
    momentum: Math.round(base.momentum * multiplier + scoreBonuses.momentum),
    popularity: Math.round(base.popularity * multiplier + scoreBonuses.popularity),
  };
}

export function computeTitleWinSpikeDelta(score: number, showType: ShowType, prestige: number): StatDelta {
  return scaleStatDelta({ momentum: TITLE_STAT_FALLOUT.titleWinMomentum, popularity: TITLE_STAT_FALLOUT.titleWinPopularity }, score, showType, prestige);
}

export function computeTitleDefenseDelta(score: number, showType: ShowType, prestige: number): StatDelta {
  return scaleStatDelta({ momentum: TITLE_STAT_FALLOUT.defenseMomentum, popularity: TITLE_STAT_FALLOUT.defensePopularity }, score, showType, prestige);
}

export function computeTitleLossDelta(): StatDelta {
  return {
    momentum: TITLE_STAT_FALLOUT.titleLossMomentum,
    popularity: TITLE_STAT_FALLOUT.titleLossPopularity,
  };
}

function findWrestler(wrestlers: Wrestler[], wrestlerId: string) {
  return wrestlers.find((wrestler) => wrestler.id === wrestlerId);
}

function getChampionshipById(championships: Championship[], championshipId: string) {
  return championships.find((championship) => championship.id === championshipId);
}

function getSegmentForEvent(segmentResults: SegmentResult[], event: ChampionshipHistoryEvent) {
  if (!event.segmentId) {
    return undefined;
  }

  return segmentResults.find((segment) => segment.segmentId === event.segmentId);
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

function applyDeltaToWrestler(
  wrestlers: Wrestler[],
  wrestlerId: string,
  delta: StatDelta,
  note: string,
  notes: TitleStatFalloutNote[],
) {
  const wrestler = findWrestler(wrestlers, wrestlerId);

  if (!wrestler) {
    return;
  }

  const previousMomentum = wrestler.momentum;
  const previousPopularity = wrestler.popularity;
  wrestler.momentum = clamp(wrestler.momentum + delta.momentum);
  wrestler.popularity = clamp(wrestler.popularity + delta.popularity);

  const momentumChange = wrestler.momentum - previousMomentum;
  const popularityChange = wrestler.popularity - previousPopularity;

  if (momentumChange === 0 && popularityChange === 0) {
    return;
  }

  notes.push({
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    momentumChange,
    popularityChange,
    note,
  });
}

function getWinnerIds(event: ChampionshipHistoryEvent) {
  if (event.winningPairIds?.length) {
    return event.winningPairIds;
  }

  return event.championIds;
}

function getLoserIds(event: ChampionshipHistoryEvent) {
  if (event.losingPairIds?.length) {
    return event.losingPairIds;
  }

  return event.previousChampionIds ?? [];
}

export function applyTitleWinSpike(
  wrestlers: Wrestler[],
  event: ChampionshipHistoryEvent,
  segment: SegmentResult | undefined,
  championships: Championship[],
  notes: TitleStatFalloutNote[],
) {
  const championship = getChampionshipById(championships, event.championshipId);
  const score = segment?.score ?? 75;
  const showType = event.showType;
  const prestige = championship?.prestige ?? 82;
  const winDelta = computeTitleWinSpikeDelta(score, showType, prestige);
  const lossDelta = computeTitleLossDelta();

  uniqueIds(getWinnerIds(event)).forEach((wrestlerId) => {
    applyDeltaToWrestler(
      wrestlers,
      wrestlerId,
      winDelta,
      `${findWrestler(wrestlers, wrestlerId)?.name ?? "The new champion"} captured ${event.championshipName} and left the night with a championship win spike on momentum and popularity.`,
      notes,
    );
  });

  uniqueIds(getLoserIds(event)).forEach((wrestlerId) => {
    applyDeltaToWrestler(
      wrestlers,
      wrestlerId,
      lossDelta,
      `${findWrestler(wrestlers, wrestlerId)?.name ?? "The dethroned champion"} lost ${event.championshipName} and took a post-show hit to momentum and popularity.`,
      notes,
    );
  });
}

export function applyTitleDefenseFallout(
  wrestlers: Wrestler[],
  event: ChampionshipHistoryEvent,
  segment: SegmentResult | undefined,
  championships: Championship[],
  notes: TitleStatFalloutNote[],
) {
  const championship = getChampionshipById(championships, event.championshipId);
  const score = segment?.score ?? 75;
  const showType = event.showType;
  const prestige = championship?.prestige ?? 82;
  const defenseDelta = computeTitleDefenseDelta(score, showType, prestige);
  const championIds = new Set(event.championIds);

  uniqueIds(event.championIds).forEach((wrestlerId) => {
    applyDeltaToWrestler(
      wrestlers,
      wrestlerId,
      defenseDelta,
      `${findWrestler(wrestlers, wrestlerId)?.name ?? "The champion"} retained ${event.championshipName} and picked up a smaller championship defense bump.`,
      notes,
    );
  });

  if (!segment) {
    return;
  }

  segment.participantIds
    .filter((wrestlerId) => !championIds.has(wrestlerId))
    .forEach((wrestlerId) => {
      applyDeltaToWrestler(
        wrestlers,
        wrestlerId,
        { momentum: TITLE_STAT_FALLOUT.challengerLossMomentum, popularity: 0 },
        `${findWrestler(wrestlers, wrestlerId)?.name ?? "The challenger"} came up short in ${event.championshipName} and lost a little momentum on the receipt.`,
        notes,
      );
    });
}

export function applyTitleEventStatFallout(
  wrestlers: Wrestler[],
  titleHistoryEvents: ChampionshipHistoryEvent[],
  segmentResults: SegmentResult[],
  championships: Championship[],
): { wrestlers: Wrestler[]; notes: TitleStatFalloutNote[] } {
  const nextWrestlers = wrestlers.map((wrestler) => ({ ...wrestler }));
  const notes: TitleStatFalloutNote[] = [];

  titleHistoryEvents.forEach((event) => {
    const segment = getSegmentForEvent(segmentResults, event);

    if (event.eventType === "title_change") {
      applyTitleWinSpike(nextWrestlers, event, segment, championships, notes);
      return;
    }

    if (event.eventType === "successful_defense") {
      applyTitleDefenseFallout(nextWrestlers, event, segment, championships, notes);
    }
  });

  return { wrestlers: nextWrestlers, notes };
}

function isReigningChampion(wrestlerId: string, championship: Championship) {
  return championship.championIds.includes(wrestlerId);
}

export function applyTitleSceneStatFallout(
  wrestlers: Wrestler[],
  segmentResults: SegmentResult[],
  championships: Championship[],
): { wrestlers: Wrestler[]; notes: TitleStatFalloutNote[] } {
  const nextWrestlers = wrestlers.map((wrestler) => ({ ...wrestler }));
  const notes: TitleStatFalloutNote[] = [];
  const nudgedIds = new Set<string>();

  segmentResults
    .filter((segment) => segment.championshipId && segment.type !== "Match")
    .forEach((segment) => {
      const championship = getChampionshipById(championships, segment.championshipId!);

      segment.participantIds.forEach((wrestlerId) => {
        if (nudgedIds.has(wrestlerId)) {
          return;
        }

        const wrestler = findWrestler(nextWrestlers, wrestlerId);

        if (!wrestler) {
          return;
        }

        const isChampion = championship ? isReigningChampion(wrestlerId, championship) : false;
        let delta: StatDelta | undefined;

        if (isChampion) {
          if (segment.score >= 85) {
            delta = { momentum: 2, popularity: 2 };
          } else if (segment.score >= 70) {
            delta = { momentum: 1, popularity: 1 };
          }
        } else if (segment.score >= 75) {
          delta = { momentum: 1, popularity: 0 };
        }

        if (!delta) {
          return;
        }

        nudgedIds.add(wrestlerId);
        applyDeltaToWrestler(
          nextWrestlers,
          wrestlerId,
          delta,
          isChampion
            ? `${wrestler.name} kept ${championship?.name ?? "the title"} visible in a strong non-match title scene.`
            : `${wrestler.name} gained a small momentum bump from a strong title-scene beat.`,
          notes,
        );
      });
    });

  return { wrestlers: nextWrestlers, notes };
}

function getChampionshipsForWrestler(wrestlerId: string, championships: Championship[]) {
  return championships.filter((championship) => championship.championIds.includes(wrestlerId));
}

function defendedRecently(wrestlerId: string, game: GameState, currentWeek: number) {
  const earliestWeek = currentWeek - (TITLE_STAT_FALLOUT.recentDefenseLookbackWeeks - 1);

  return (game.championshipHistory ?? []).some(
    (event) =>
      event.seasonNumber === game.seasonNumber &&
      event.weekNumber >= earliestWeek &&
      event.weekNumber <= currentWeek &&
      event.eventType === "successful_defense" &&
      event.championIds.includes(wrestlerId),
  );
}

export function getChampionPassiveCarryDelta(wrestler: Wrestler, game: GameState): StatDelta {
  if (wrestler.injuryStatus === "major") {
    return { momentum: 0, popularity: 0 };
  }

  const heldTitles = getChampionshipsForWrestler(wrestler.id, game.championships);

  if (!heldTitles.length) {
    return { momentum: 0, popularity: 0 };
  }

  let momentum = 0;
  let popularity = 0;

  heldTitles.forEach((championship) => {
    if (championship.reignStartWeek === game.currentWeek) {
      momentum += TITLE_STAT_FALLOUT.newChampionCarryMomentum;
      popularity += TITLE_STAT_FALLOUT.newChampionCarryPopularity;
      return;
    }

    const defenseWindow = championship.minimumDefenseFrequencyWeeks ?? 6;
    const reignLength = Math.max(1, game.currentWeek - championship.reignStartWeek + 1);

    if (defendedRecently(wrestler.id, game, game.currentWeek)) {
      momentum += TITLE_STAT_FALLOUT.recentDefenseCarryMomentum;
      popularity += TITLE_STAT_FALLOUT.recentDefenseCarryPopularity;
      return;
    }

    if (reignLength >= defenseWindow && championship.defenses === 0) {
      momentum += TITLE_STAT_FALLOUT.staleReignCarryMomentum;
      popularity += TITLE_STAT_FALLOUT.staleReignCarryPopularity;
    }
  });

  return { momentum, popularity };
}

export function applyChampionPassiveCarry(wrestler: Wrestler, game: GameState): Wrestler {
  const delta = getChampionPassiveCarryDelta(wrestler, game);

  return {
    ...wrestler,
    momentum: clamp(wrestler.momentum + delta.momentum),
    popularity: clamp(wrestler.popularity + delta.popularity),
  };
}
