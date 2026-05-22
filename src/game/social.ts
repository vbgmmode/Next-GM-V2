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
  const scoreRead =
    result.totalScore >= 85 ? "premium" : result.totalScore >= 70 ? "solid" : result.totalScore >= 55 ? "uneven" : "cold";
  const posts: Omit<SocialPost, "id" | "weekNumber" | "seasonNumber" | "showName">[] = [];

  posts.push({
    category: "fan_praise",
    author: "@FrontRowFaithful",
    tone: "excited",
    text: pickLine(`${result.id}-fan-${bestSegment.segmentId}`, [
      `${bestNames} had the room shaking. A ${bestSegment.score} ${bestSegment.type.toLowerCase()} is the clip people remember.`,
      `${bestNames} gave the night its signature noise. That ${bestSegment.score} felt like the broadcast turning point.`,
      `${bestNames} owned the loudest minutes of the card. The ${bestSegment.type.toLowerCase()} hit ${bestSegment.score} and changed the temperature.`,
    ]),
    relatedWrestlerIds: bestSegment.participantIds,
    relatedRivalryIds: getRelatedRivalryIds(bestSegment),
    relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
  });

  posts.push({
    category: "analyst_take",
    author: "Gorilla Position Analytics",
    tone: "analytical",
    text: pickLine(`${result.id}-analyst-${scoreRead}`, [
      `${result.showName} graded out as ${scoreRead} at ${result.totalScore}. The strongest segment gave the card its identity.`,
      `${result.showName} closed at ${result.totalScore}. The peak landed, and the weak spots explain the ceiling.`,
      `${result.totalScore} for ${result.showName}. The broadcast had a clear high point and the pressure marks are easy to trace.`,
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
      text: pickLine(`${result.id}-momentum-${momentumWrestler.id}`, [
        `${momentumWrestler.name} is the one everyone is clipping tonight. Momentum jumped +${result.biggestMomentumGain.amount}, and it reads like a push with oxygen.`,
        `${momentumWrestler.name} came out of the show with the cleanest signal boost: +${result.biggestMomentumGain.amount} momentum and a louder lane next week.`,
        `The timeline found ${momentumWrestler.name}. +${result.biggestMomentumGain.amount} momentum after the cameras cut is not background noise.`,
      ]),
      relatedWrestlerIds: [momentumWrestler.id],
    });
  }

  if (fatigueWrestler && result.biggestFatigueIncrease.amount > 0) {
    posts.push({
      category: "fatigue_concern",
      author: "Tape Traders Weekly",
      tone: "skeptical",
      text: pickLine(`${result.id}-fatigue-${fatigueWrestler.id}`, [
        `${fatigueWrestler.name} took the biggest physical hit tonight. +${result.biggestFatigueIncrease.amount} fatigue is a bill the room can see.`,
        `${fatigueWrestler.name}'s workload lit up the post-show board: +${result.biggestFatigueIncrease.amount} fatigue and real protection questions.`,
        `Good night or not, ${fatigueWrestler.name} paid for it physically. +${result.biggestFatigueIncrease.amount} fatigue changes the next booking conversation.`,
      ]),
      relatedWrestlerIds: [fatigueWrestler.id],
    });
  }

  if (weakestSegment) {
    posts.push({
      category: "push_complaint",
      author: "@BookerBrain",
      tone: "angry",
      text: pickLine(`${result.id}-weak-${weakestSegment.segmentId}`, [
        `${weakestNames} only hit ${weakestSegment.score}. That spot needed more protection before it hit the air.`,
        `${weakestNames} was the soft spot at ${weakestSegment.score}. The production board cannot pretend it was just pacing.`,
        `${weakestNames} did not get all the way there. ${weakestSegment.score} leaves a creative bruise for next week.`,
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
      text: result.broadcastOverrunNotes[result.broadcastOverrunNotes.length - 1],
      relatedWrestlerIds: result.segmentResults.find((segment) => segment.overrunAffected)?.participantIds ?? [],
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
      text: pickLine(`${result.id}-ple`, [
        `${result.showName} felt like a major checkpoint for the brand. A ${result.totalScore} score gives the road out of the PLE a real argument.`,
        `${result.showName} had that major-event pressure in the walls. ${result.totalScore} is the number everyone will use to judge the fallout.`,
        `The PLE gave the brand a hard receipt: ${result.totalScore}, loud moments, and consequences waiting on TV.`,
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
    text: pickLine(`${result.id}-wire`, [
      `The talk after ${result.showName}: ${result.biggestMomentumGain.name} has support, but ${result.biggestFatigueIncrease.name}'s workload is now a booking argument.`,
      `Backstage read: ${result.biggestMomentumGain.name} left with heat, while ${result.biggestFatigueIncrease.name}'s workload drew real side-eye.`,
      `${result.showName} moved the room. ${result.biggestMomentumGain.name} gained allies, and ${result.biggestFatigueIncrease.name} became the protection question.`,
    ]),
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
