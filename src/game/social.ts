import type { GameState, SegmentResult, ShowResult, SocialCategory, SocialPost, SocialTone, Wrestler } from "./types";
import { getRatingsBattleSnapshot } from "./cpuRivalLoop";
import { getRivalMarketEvents } from "./market";

type SocialPostDraft = Omit<SocialPost, "id" | "weekNumber" | "seasonNumber" | "showName"> & {
  priority: number;
};

function findWrestlerByName(name: string, wrestlers: Wrestler[]) {
  return wrestlers.find((wrestler) => wrestler.name === name);
}

function getWeakestSegment(result: ShowResult) {
  if (result.segmentResults.length < 2) {
    return undefined;
  }

  return result.segmentResults.reduce((weakest, segment) => (segment.score < weakest.score ? segment : weakest), result.segmentResults[0]);
}

function getRelatedChampionshipIds(segment?: SegmentResult) {
  return segment?.championshipId ? [segment.championshipId] : [];
}

function getRelatedRivalryIds(segment?: SegmentResult) {
  return segment?.rivalryId ? [segment.rivalryId] : [];
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function pickLine(seed: string, lines: string[]) {
  return lines[hashString(seed) % lines.length];
}

function getScoreRead(result: ShowResult) {
  if (result.showType === "ple" && result.totalScore >= 85) {
    return "major-event receipt";
  }

  if (result.totalScore >= 90) {
    return "premium";
  }

  if (result.totalScore >= 78) {
    return "strong";
  }

  if (result.totalScore >= 65) {
    return "mixed";
  }

  return "cold";
}

function getSegmentHeatRead(segment: SegmentResult) {
  if (segment.score >= 95) {
    return "timeline-dominating";
  }

  if (segment.score >= 88) {
    return "hot";
  }

  if (segment.score >= 75) {
    return "solid";
  }

  if (segment.score >= 60) {
    return "uneven";
  }

  return "cold";
}

function isTitleChangeNote(note: string | undefined) {
  return Boolean(note && (note.includes(" to win ") || note.includes("defeated") || note.includes("changed hands")));
}

function isCoolingRivalryNote(note: string | undefined) {
  return Boolean(
    note &&
      (note.includes("stale") ||
        note.includes("cooled") ||
        note.includes("lost the room") ||
        note.includes("running on fumes") ||
        note.includes("overexposed") ||
        note.includes("thin")),
  );
}

function getDramaticScoreLabel(result: ShowResult) {
  if (result.totalScore >= 90) {
    return "the kind of grade people screenshot before they start yelling about agendas";
  }

  if (result.totalScore >= 78) {
    return "good enough to start a civil war in the replies";
  }

  if (result.totalScore >= 65) {
    return "mid enough for everyone to pretend they saw the disaster coming";
  }

  return "the kind of number that gets a booker cooked by midnight";
}

function getPostPriority(post: SocialPostDraft, index: number) {
  const categoryPriority: Record<SocialCategory, number> = {
    title_scene: 95,
    rivalry_heat: 92,
    ple_reaction: 90,
    viral_moment: 82,
    fatigue_concern: 76,
    fan_praise: 72,
    push_complaint: 68,
    analyst_take: 62,
    dirt_sheet: 58,
  };
  const toneBonus: Record<SocialTone, number> = {
    chaotic: 8,
    excited: 6,
    impressed: 5,
    angry: 4,
    skeptical: 3,
    analytical: 0,
  };

  return post.priority + categoryPriority[post.category] + toneBonus[post.tone] - index / 100;
}

function makePost(
  result: ShowResult,
  index: number,
  category: SocialCategory,
  author: string,
  tone: SocialTone,
  text: string,
  relatedWrestlerIds: string[],
  relatedRivalryIds: string[] = [],
  relatedChampionshipIds: string[] = [],
): SocialPost {
  return {
    id: `${result.id}-social-${index}`,
    weekNumber: result.week,
    seasonNumber: result.seasonNumber,
    showName: result.showName,
    category,
    author,
    text,
    tone,
    relatedWrestlerIds,
    relatedRivalryIds,
    relatedChampionshipIds,
  };
}

export function generateSocialPosts(result: ShowResult, game: GameState): SocialPost[] {
  const bestSegment = result.segmentResults.reduce((best, segment) => (segment.score > best.score ? segment : best), result.segmentResults[0]);
  const weakestSegment = getWeakestSegment(result);
  const momentumWrestler = findWrestlerByName(result.biggestMomentumGain.name, game.wrestlers);
  const fatigueWrestler = findWrestlerByName(result.biggestFatigueIncrease.name, game.wrestlers);
  const bestNames = bestSegment.participantNames.join(" / ");
  const weakestNames = weakestSegment?.participantNames.join(" / ");
  const scoreRead = getScoreRead(result);
  const titleChangeSegments = result.segmentResults.filter((segment) => isTitleChangeNote(segment.titleNote));
  const titleDefenseSegments = result.segmentResults.filter((segment) => segment.titleNote && !isTitleChangeNote(segment.titleNote));
  const rivalrySegments = result.segmentResults.filter((segment) => segment.rivalryNote);
  const posts: SocialPostDraft[] = [];
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const latestMarketMove = [...game.marketState.transactions, ...getRivalMarketEvents(game)].filter((transaction) => transaction.seasonNumber === game.seasonNumber).at(-1);

  posts.push({
    category: "fan_praise",
    author: "@FrontRowFaithful",
    tone: "excited",
    priority: bestSegment.score >= 90 ? 20 : 8,
    text: pickLine(`${result.id}-fan-${bestSegment.segmentId}`, [
      `${bestNames} had the room shaking. A ${bestSegment.score} ${bestSegment.type.toLowerCase()} and now half the timeline is acting like they booked it themselves.`,
      `${bestNames} gave the night its signature noise. That ${bestSegment.score} was a ${getSegmentHeatRead(bestSegment)} turning point and the discourse is already unbearable.`,
      `${bestNames} owned the loudest minutes of the card. The ${bestSegment.type.toLowerCase()} hit ${bestSegment.score}, so prepare for people to call it a masterclass for a week.`,
    ]),
    relatedWrestlerIds: bestSegment.participantIds,
    relatedRivalryIds: getRelatedRivalryIds(bestSegment),
    relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
  });

  if (ratingsBattle && ratingsBattle.entries.some((entry) => !entry.isPlayer && entry.latestScore !== undefined)) {
    const playerEntry = ratingsBattle.entries.find((entry) => entry.isPlayer);
    const nearestRival = ratingsBattle.entries.find((entry) => !entry.isPlayer);
    const playerRankRead = playerEntry ? `#${playerEntry.rank}` : "unranked";

    posts.push({
      category: "analyst_take",
      author: "Ratings Desk Live",
      tone: ratingsBattle.playerRank === 1 ? "impressed" : ratingsBattle.playerRank >= ratingsBattle.entries.length ? "skeptical" : "analytical",
      priority: 12,
      text: nearestRival
        ? `${game.brandName} sits ${playerRankRead} in the ratings race after ${result.showName}. ${nearestRival.brandName} is the rival desk everyone is measuring against now, and the office mandate is watching.`
        : `${game.brandName} sits ${playerRankRead} in the ratings race after ${result.showName}. The CPU desks are active pressure, not a hidden fail state.`,
      relatedWrestlerIds: bestSegment.participantIds,
    });
  }

  if (latestMarketMove) {
    posts.push({
      category: "dirt_sheet",
      author: "Market Wire",
      tone: latestMarketMove.type === "release" ? "skeptical" : latestMarketMove.type === "trade" && latestMarketMove.accepted === false ? "chaotic" : "analytical",
      priority: 10,
      text: `${latestMarketMove.note} The market race is now part of the office pressure, but the show still moves only after the GM advances the week.`,
      relatedWrestlerIds: latestMarketMove.wrestlerIds,
    });
  }

  posts.push({
    category: "analyst_take",
    author: "Gorilla Position Analytics",
    tone: "analytical",
    priority: 2,
    text: pickLine(`${result.id}-analyst-${scoreRead}`, [
      `${result.showName} graded out as ${scoreRead} at ${result.totalScore}: ${getDramaticScoreLabel(result)}.`,
      `${result.showName} closed at ${result.totalScore}. The peak landed, and the soft spots are exactly where the thread wars are going to live.`,
      `${result.totalScore} for ${result.showName}. Good luck getting anyone to talk about the whole show when the discourse already picked its evidence.`,
    ]),
    relatedWrestlerIds: bestSegment.participantIds,
    relatedRivalryIds: getRelatedRivalryIds(bestSegment),
    relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
  });

  if (momentumWrestler && result.biggestMomentumGain.amount > 0) {
    posts.push({
      category: "viral_moment",
      author: "@ClipMachine",
      tone: "impressed",
      priority: result.biggestMomentumGain.amount >= 8 ? 18 : 6,
      text: pickLine(`${result.id}-momentum-${momentumWrestler.id}`, [
        `${momentumWrestler.name} is the one everyone is clipping tonight. +${result.biggestMomentumGain.amount} momentum and suddenly everyone swears they were day-one believers.`,
        `${momentumWrestler.name} came out with +${result.biggestMomentumGain.amount} momentum and the replies are already fantasy-booking a rocket launch.`,
        `The timeline found ${momentumWrestler.name}. +${result.biggestMomentumGain.amount} momentum after the cameras cut is how fan campaigns start getting annoying.`,
      ]),
      relatedWrestlerIds: [momentumWrestler.id],
    });
  }

  if (fatigueWrestler && result.biggestFatigueIncrease.amount > 0) {
    posts.push({
      category: "fatigue_concern",
      author: "Tape Traders Weekly",
      tone: "skeptical",
      priority: result.biggestFatigueIncrease.amount >= 12 ? 18 : 5,
      text: pickLine(`${result.id}-fatigue-${fatigueWrestler.id}`, [
        `${fatigueWrestler.name} took the biggest physical hit tonight. +${result.biggestFatigueIncrease.amount} fatigue and people are already yelling about the GM running them into the ground.`,
        `${fatigueWrestler.name}'s workload lit up the post-show board: +${result.biggestFatigueIncrease.amount} fatigue, which means the protection discourse is going to be miserable.`,
        `Good night or not, ${fatigueWrestler.name} paid for it physically. +${result.biggestFatigueIncrease.amount} fatigue is the kind of number fans turn into a conspiracy thread.`,
      ]),
      relatedWrestlerIds: [fatigueWrestler.id],
    });
  }

  if (weakestSegment) {
    posts.push({
      category: "push_complaint",
      author: "@BookerBrain",
      tone: "angry",
      priority: weakestSegment.score < 60 ? 16 : 1,
      text: pickLine(`${result.id}-weak-${weakestSegment.segmentId}`, [
        `${weakestNames} only hit ${weakestSegment.score}. That spot is getting clipped with the caption 'what was the plan here?' by sunrise.`,
        `${weakestNames} was the soft spot at ${weakestSegment.score}. The production board cannot hide behind 'pacing' when the internet has pause buttons.`,
        `${weakestNames} did not get all the way there. ${weakestSegment.score} is a creative bruise and the replies are going to poke it.`,
      ]),
      relatedWrestlerIds: weakestSegment.participantIds,
      relatedRivalryIds: getRelatedRivalryIds(weakestSegment),
      relatedChampionshipIds: getRelatedChampionshipIds(weakestSegment),
    });
  }

  if (result.broadcastOverrunNotes?.length) {
    posts.push({
      category: "analyst_take",
      author: "Gorilla Position Analytics",
      tone: result.broadcastOverrunLevel === "major" ? "angry" : "skeptical",
      priority: result.broadcastOverrunLevel === "major" ? 22 : 10,
      text: result.broadcastOverrunNotes[result.broadcastOverrunNotes.length - 1],
      relatedWrestlerIds: result.segmentResults.find((segment) => segment.overrunAffected)?.participantIds ?? [],
    });
  }

  [...titleChangeSegments, ...titleDefenseSegments]
    .slice(0, 2)
    .forEach((segment) => {
      const isChange = isTitleChangeNote(segment.titleNote);

      posts.push({
        category: "title_scene",
        author: isChange ? "Title Scene Emergency Wire" : "Title Scene Report",
        tone: isChange ? "chaotic" : segment.score >= 88 ? "impressed" : "analytical",
        priority: isChange ? 42 : 24,
        text: pickLine(`${result.id}-title-${segment.segmentId}`, [
          segment.titleNote ?? "",
          `${segment.participantNames.join(" / ")} made the title scene the loudest argument of the night. Nobody is being normal about this. ${segment.titleNote ?? ""}`,
          `${result.showName} gave the belt a receipt and now every title-scene take sounds like a court filing. ${segment.titleNote ?? ""}`,
        ]),
        relatedWrestlerIds: segment.participantIds,
        relatedChampionshipIds: getRelatedChampionshipIds(segment),
      });
    });

  rivalrySegments
    .slice(0, 2)
    .forEach((segment) => {
      const cooling = isCoolingRivalryNote(segment.rivalryNote);

      posts.push({
        category: "rivalry_heat",
        author: cooling ? "@AngleWatch" : "IWC Story Desk",
        tone: cooling ? "skeptical" : segment.score >= 90 ? "chaotic" : "excited",
        priority: cooling ? 30 : segment.score >= 90 ? 38 : 26,
        text: pickLine(`${result.id}-rivalry-${segment.segmentId}`, [
          segment.rivalryNote ?? "",
          `${segment.participantNames.join(" / ")} have the timeline picking sides like it is a legal case now. ${segment.rivalryNote ?? ""}`,
          `${result.showName} moved the story argument, so expect everyone to pretend their favorite side was obviously right all along. ${segment.rivalryNote ?? ""}`,
        ]),
        relatedWrestlerIds: segment.participantIds,
        relatedRivalryIds: getRelatedRivalryIds(segment),
      });
    });

  if (result.showType === "ple") {
    posts.push({
      category: "ple_reaction",
      author: "IWC Event Desk",
      tone: "chaotic",
      priority: 36,
      text: pickLine(`${result.id}-ple`, [
        `${result.showName} felt like a major checkpoint for the brand. A ${result.totalScore} score is enough for fans to act like the entire season was decided tonight.`,
        `${result.showName} had that major-event pressure in the walls. ${result.totalScore} is the number everyone will weaponize until the next TV opens.`,
        `The PLE gave the brand a hard receipt: ${result.totalScore}, loud moments, and enough fallout for the internet to overbook the next month by itself.`,
      ]),
      relatedWrestlerIds: bestSegment.participantIds,
      relatedRivalryIds: getRelatedRivalryIds(bestSegment),
      relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
    });
  }

  posts.push({
    category: "dirt_sheet",
    author: "Backstage Wire",
    tone: "skeptical",
    priority: 4,
    text: pickLine(`${result.id}-wire`, [
      `The rumor-board read after ${result.showName}: ${result.biggestMomentumGain.name} has support, but ${result.biggestFatigueIncrease.name}'s workload has people acting like detectives.`,
      `Backstage read, if you believe the noise: ${result.biggestMomentumGain.name} left with heat, while ${result.biggestFatigueIncrease.name}'s workload drew loud side-eye.`,
      `${result.showName} moved the room. ${result.biggestMomentumGain.name} gained allies, and ${result.biggestFatigueIncrease.name} became the protection argument nobody will shut up about.`,
    ]),
    relatedWrestlerIds: [momentumWrestler?.id, fatigueWrestler?.id].filter((id): id is string => Boolean(id)),
  });

  return posts
    .map((post, index) => ({ post, score: getPostPriority(post, index) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, result.showType === "ple" ? 8 : 7)
    .map(({ post }, index) =>
    makePost(
      result,
      index + 1,
      post.category,
      post.author,
      post.tone,
      post.text,
      post.relatedWrestlerIds,
      post.relatedRivalryIds,
      post.relatedChampionshipIds,
    ),
    );
}
