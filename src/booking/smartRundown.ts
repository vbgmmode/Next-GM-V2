import { getCatalogOptionById, getDefaultCatalogOption } from "../game/matchFormatCatalog";
import { isValidSegment } from "../game/scoring";
import type { GameState, Rivalry, Segment, Wrestler } from "../game/types";
import {
  canSegmentAttachChampionship,
  canWrestlersShareMatch,
  getSegmentDurationMinutes,
  getShowReadiness,
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

function getSmartTalentScore(
  wrestler: Wrestler,
  game: GameState,
  usage: Record<string, number>,
  role: "match" | "promo" | "story" = "match",
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
    getSmartUsagePenalty(wrestler, usage)
  );
}

function sortSmartTalent(
  wrestlers: Wrestler[],
  game: GameState,
  usage: Record<string, number>,
  role: "match" | "promo" | "story" = "match",
) {
  return [...wrestlers].sort(
    (a, b) =>
      getSmartTalentScore(b, game, usage, role) - getSmartTalentScore(a, game, usage, role) ||
      b.popularity - a.popularity ||
      b.momentum - a.momentum ||
      a.fatigue - b.fatigue ||
      a.name.localeCompare(b.name),
  );
}

function getSmartPairKey(ids: string[]) {
  return [...ids].sort().join("|");
}

function getSmartRivalry(game: GameState, available: Wrestler[]) {
  const availableIds = new Set(available.map((wrestler) => wrestler.id));

  return [...game.rivalries]
    .filter((rivalry) => rivalry.participantIds.length === 2 && rivalry.participantIds.every((id) => availableIds.has(id)))
    .sort((a, b) => b.heat + b.freshness - (a.heat + a.freshness) || a.name.localeCompare(b.name))[0];
}

function chooseSmartTalent(
  game: GameState,
  available: Wrestler[],
  usage: Record<string, number>,
  role: "match" | "promo" | "story",
  excludeIds: string[] = [],
) {
  const excluded = new Set(excludeIds);
  return sortSmartTalent(
    available.filter((wrestler) => !excluded.has(wrestler.id) && (usage[wrestler.id] ?? 0) < 2),
    game,
    usage,
    role,
  )[0];
}

function chooseSmartPair(game: GameState, available: Wrestler[], usage: Record<string, number>, usedPairs: Set<string>) {
  const sorted = sortSmartTalent(available, game, usage, "match").filter((wrestler) => (usage[wrestler.id] ?? 0) < 2);

  for (const first of sorted) {
    const second = sorted.find(
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

function buildSmartSegment(
  game: GameState,
  optionId: string,
  participantIds: string[],
  durationMinutes: number,
  index: number,
  rivalryId?: string,
) {
  const option = getCatalogOptionById(optionId) ?? getDefaultCatalogOption("Match")!;
  let segment: Segment = {
    id: `smart-${Date.now()}-${index}`,
    type: option.family,
    participantIds,
    segmentCatalogId: option.id,
    segmentDisplayName: option.label,
    durationMinutes,
    participantMin: option.minParticipants,
    participantMax: option.maxParticipants,
    rivalryId,
  };

  if (option.championshipAllowed) {
    const championship = game.championships.find((title) => canSegmentAttachChampionship(segment, title, game.wrestlers));
    if (championship) {
      segment = { ...segment, championshipId: championship.id };
    }
  }

  return segment;
}

export function buildSmartRundown(game: GameState): SmartRundownResult {
  const available = game.wrestlers.filter(isSmartRundownAvailable);
  const notes = new Set<string>();
  const segments: Segment[] = [];
  const usage: Record<string, number> = {};
  const usedPairs = new Set<string>();
  const addSegment = (optionId: string, participantIds: string[], durationMinutes: number, rivalryId?: string) => {
    const segment = buildSmartSegment(game, optionId, participantIds, durationMinutes, segments.length, rivalryId);
    if (!isValidSegment(segment, game.wrestlers)) {
      return false;
    }

    segments.push(segment);
    participantIds.forEach((id) => {
      usage[id] = (usage[id] ?? 0) + 1;
    });

    if (participantIds.length === 2) {
      usedPairs.add(getSmartPairKey(participantIds));
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

  const rivalry: Rivalry | undefined = getSmartRivalry(game, available);

  if (rivalry) {
    const [firstId, secondId] = rivalry.participantIds;
    const first = available.find((wrestler) => wrestler.id === firstId);
    const second = available.find((wrestler) => wrestler.id === secondId);

    if (first && second) {
      addSegment("P003", [first.id], 14, rivalry.id);
      if (canWrestlersShareMatch([first, second])) {
        addSegment(rivalry.heat >= 65 ? "M019" : "M001", [first.id, second.id], 30, rivalry.id);
        notes.add(`Featured active rivalry: ${rivalry.name}.`);
      } else {
        notes.add(`Featured ${rivalry.name} in a talk segment because current match rules need same-division competitors.`);
      }
    }
  }

  if (!segments.some((segment) => segment.type === "Match")) {
    const pair = chooseSmartPair(game, available, usage, usedPairs);
    if (pair.length === 2) {
      addSegment("M001", pair.map((wrestler) => wrestler.id), 28);
      notes.add("Built a match around visible popularity, momentum, and manageable fatigue.");
    }
  }

  if (!segments.some((segment) => segment.type === "Promo")) {
    const promoTalent = chooseSmartTalent(game, available, usage, "promo");
    if (promoTalent) {
      addSegment("P001", [promoTalent.id], 16);
      notes.add("Showcased a strong talker with visible popularity or momentum.");
    }
  }

  if (!segments.some((segment) => segment.type === "Backstage Angle" || segment.type === "Contract Signing" || segment.type === "Open Challenge")) {
    const storyTalent = chooseSmartTalent(game, available, usage, "story");
    const rivalryParticipants = rivalry?.participantIds.filter((id) => (usage[id] ?? 0) < 2) ?? [];

    if (rivalry && rivalryParticipants.length === 2) {
      addSegment("A046", rivalryParticipants, 14, rivalry.id);
      notes.add("Added backstage texture so the rivalry has more than one TV surface.");
    } else if (storyTalent) {
      addSegment("A001", [storyTalent.id], 14);
      notes.add("Added backstage texture so the card is not only bell-to-bell segments.");
    }
  }

  while (segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0) < showRuntimeMinMinutes && segments.length < 8) {
    const currentRuntime = segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
    const remaining = showRuntimeMinMinutes - currentRuntime;
    const pair = chooseSmartPair(game, available, usage, usedPairs);

    if (remaining >= 20 && pair.length === 2) {
      addSegment("M001", pair.map((wrestler) => wrestler.id), Math.min(26, Math.max(20, remaining)));
      notes.add("Added another match to bring the card into the broadcast window.");
      continue;
    }

    const talker = chooseSmartTalent(game, available, usage, "promo");
    if (talker && addSegment("P002", [talker.id], Math.min(14, Math.max(10, remaining)))) {
      notes.add("Used short hype time to fill the TV block without forcing another match.");
      continue;
    }

    break;
  }

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
        (segment.type === "Match" ? 20 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (mainEventCandidate && mainEventCandidate.index !== segments.length - 1) {
    const [mainEvent] = segments.splice(mainEventCandidate.index, 1);
    segments.push(mainEvent);
    notes.add("Moved the strongest visible rivalry/star-power segment into the closing slot.");
  }

  const runtime = segments.reduce((total, segment) => total + getSegmentDurationMinutes(segment), 0);
  const readiness = getShowReadiness(segments.length, segments.filter((segment) => !isValidSegment(segment, game.wrestlers)).length, runtime);

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

  return {
    notes: [...notes],
    segments,
  };
}

export function buildSmartSingleSegment(game: GameState, currentShow: Segment[] = game.currentShow): SmartRundownResult {
  const available = game.wrestlers.filter(isSmartRundownAvailable);
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

  const cardHasRivalry = (rivalryId: string) => currentShow.some((segment) => segment.rivalryId === rivalryId);
  const rivalry = getSmartRivalry(
    game,
    available.filter((wrestler) => (usage[wrestler.id] ?? 0) < 2),
  );

  if (rivalry && !cardHasRivalry(rivalry.id)) {
    const [firstId, secondId] = rivalry.participantIds;
    const first = available.find((wrestler) => wrestler.id === firstId);
    const second = available.find((wrestler) => wrestler.id === secondId);

    if (first && second && (usage[first.id] ?? 0) < 2 && (usage[second.id] ?? 0) < 2) {
      if (canWrestlersShareMatch([first, second]) && !usedPairs.has(getSmartPairKey([first.id, second.id]))) {
        const segment = buildSmartSegment(
          game,
          rivalry.heat >= 65 ? "M019" : "M001",
          [first.id, second.id],
          28,
          currentShow.length,
          rivalry.id,
        );

        if (isValidSegment(segment, game.wrestlers)) {
          return {
            notes: [`Featured active rivalry: ${rivalry.name}.`],
            segments: [segment],
          };
        }
      }

      const promoSegment = buildSmartSegment(game, "P003", [first.id], 14, currentShow.length, rivalry.id);

      if (isValidSegment(promoSegment, game.wrestlers)) {
        return {
          notes: [`Featured ${rivalry.name} in a talk segment.`],
          segments: [promoSegment],
        };
      }
    }
  }

  if (!currentShow.some((segment) => segment.type === "Match")) {
    const pair = chooseSmartPair(game, available, usage, usedPairs);

    if (pair.length === 2) {
      const segment = buildSmartSegment(game, "M001", pair.map((wrestler) => wrestler.id), 28, currentShow.length);

      if (isValidSegment(segment, game.wrestlers)) {
        return {
          notes: ["Built a match around popularity, momentum, and manageable fatigue."],
          segments: [segment],
        };
      }
    }
  }

  if (!currentShow.some((segment) => segment.type === "Promo")) {
    const promoTalent = chooseSmartTalent(game, available, usage, "promo");

    if (promoTalent) {
      const segment = buildSmartSegment(game, "P001", [promoTalent.id], 16, currentShow.length);

      if (isValidSegment(segment, game.wrestlers)) {
        return {
          notes: ["Showcased a strong talker with visible popularity or momentum."],
          segments: [segment],
        };
      }
    }
  }

  if (!currentShow.some((segment) => segment.type === "Backstage Angle" || segment.type === "Contract Signing" || segment.type === "Open Challenge")) {
    const storyTalent = chooseSmartTalent(game, available, usage, "story");
    const rivalryParticipants = rivalry?.participantIds.filter((id) => (usage[id] ?? 0) < 2) ?? [];

    if (rivalry && rivalryParticipants.length === 2) {
      const segment = buildSmartSegment(game, "A046", rivalryParticipants, 14, currentShow.length, rivalry.id);

      if (isValidSegment(segment, game.wrestlers)) {
        return {
          notes: ["Added backstage texture for the active rivalry."],
          segments: [segment],
        };
      }
    }

    if (storyTalent) {
      const segment = buildSmartSegment(game, "A001", [storyTalent.id], 14, currentShow.length);

      if (isValidSegment(segment, game.wrestlers)) {
        return {
          notes: ["Added backstage texture to break up the card."],
          segments: [segment],
        };
      }
    }
  }

  const pair = chooseSmartPair(game, available, usage, usedPairs);

  if (pair.length === 2) {
    const segment = buildSmartSegment(game, "M001", pair.map((wrestler) => wrestler.id), 24, currentShow.length);

    if (isValidSegment(segment, game.wrestlers)) {
      return {
        notes: ["Added another match beat to the rundown."],
        segments: [segment],
      };
    }
  }

  const talker = chooseSmartTalent(game, available, usage, "promo");

  if (talker) {
    const segment = buildSmartSegment(game, "P002", [talker.id], 12, currentShow.length);

    if (isValidSegment(segment, game.wrestlers)) {
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