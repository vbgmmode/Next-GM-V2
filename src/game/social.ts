import type { GameState, SegmentResult, ShowResult, SocialCategory, SocialPost, SocialTone, Wrestler } from "./types";

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
  const posts: Omit<SocialPost, "id" | "weekNumber" | "seasonNumber" | "showName">[] = [];

  posts.push({
    category: "fan_praise",
    author: "@FrontRowFaithful",
    tone: "excited",
    text: `${bestSegment.participantNames.join(" / ")} had the room shaking. ${bestSegment.score} for that ${bestSegment.type.toLowerCase()} feels earned.`,
    relatedWrestlerIds: bestSegment.participantIds,
    relatedRivalryIds: getRelatedRivalryIds(bestSegment),
    relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
  });

  posts.push({
    category: "analyst_take",
    author: "Gorilla Position Analytics",
    tone: "analytical",
    text: `${result.showName} landed at ${result.totalScore}. Best segment carried the broadcast, but the card still has clear pressure points.`,
    relatedWrestlerIds: bestSegment.participantIds,
    relatedRivalryIds: getRelatedRivalryIds(bestSegment),
    relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
  });

  if (momentumWrestler && result.biggestMomentumGain.amount > 0) {
    posts.push({
      category: "viral_moment",
      author: "@ClipMachine",
      tone: "impressed",
      text: `${momentumWrestler.name} is the one everyone is clipping tonight. Momentum jumped +${result.biggestMomentumGain.amount}.`,
      relatedWrestlerIds: [momentumWrestler.id],
    });
  }

  if (fatigueWrestler && result.biggestFatigueIncrease.amount > 0) {
    posts.push({
      category: "fatigue_concern",
      author: "Tape Traders Weekly",
      tone: "skeptical",
      text: `${fatigueWrestler.name} took the biggest physical hit tonight. +${result.biggestFatigueIncrease.amount} fatigue is not nothing.`,
      relatedWrestlerIds: [fatigueWrestler.id],
    });
  }

  if (weakestSegment) {
    posts.push({
      category: "push_complaint",
      author: "@BookerBrain",
      tone: "angry",
      text: `${weakestSegment.participantNames.join(" / ")} only hit ${weakestSegment.score}. That spot needed more protection or a cleaner setup.`,
      relatedWrestlerIds: weakestSegment.participantIds,
      relatedRivalryIds: getRelatedRivalryIds(weakestSegment),
      relatedChampionshipIds: getRelatedChampionshipIds(weakestSegment),
    });
  }

  result.segmentResults
    .filter((segment) => segment.titleNote)
    .slice(0, 2)
    .forEach((segment) => {
      posts.push({
        category: "title_scene",
        author: "Title Scene Report",
        tone: segment.titleNote?.includes("win the") ? "chaotic" : "impressed",
        text: segment.titleNote ?? "",
        relatedWrestlerIds: segment.participantIds,
        relatedChampionshipIds: getRelatedChampionshipIds(segment),
      });
    });

  result.segmentResults
    .filter((segment) => segment.rivalryNote)
    .slice(0, 2)
    .forEach((segment) => {
      posts.push({
        category: "rivalry_heat",
        author: "@AngleWatch",
        tone: segment.rivalryNote?.includes("stale") || segment.rivalryNote?.includes("cooled") ? "skeptical" : "excited",
        text: segment.rivalryNote ?? "",
        relatedWrestlerIds: segment.participantIds,
        relatedRivalryIds: getRelatedRivalryIds(segment),
      });
    });

  if (result.showType === "ple") {
    posts.push({
      category: "ple_reaction",
      author: "IWC Event Desk",
      tone: "chaotic",
      text: `${result.showName} felt like a major checkpoint for the brand. A ${result.totalScore} score gives the road out of the PLE plenty to argue about.`,
      relatedWrestlerIds: bestSegment.participantIds,
      relatedRivalryIds: getRelatedRivalryIds(bestSegment),
      relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
    });
  }

  posts.push({
    category: "dirt_sheet",
    author: "Backstage Wire",
    tone: "skeptical",
    text: `The talk after ${result.showName}: ${result.biggestMomentumGain.name} has support, but ${result.biggestFatigueIncrease.name}'s workload is being watched.`,
    relatedWrestlerIds: [momentumWrestler?.id, fatigueWrestler?.id].filter((id): id is string => Boolean(id)),
  });

  return posts.slice(0, result.showType === "ple" ? 8 : 7).map((post, index) =>
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
