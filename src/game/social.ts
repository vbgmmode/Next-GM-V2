import type {
  GameState,
  SegmentResult,
  ShowResult,
  SocialCategory,
  SocialPost,
  SocialReactionPersona,
  SocialReactionSentiment,
  SocialReactionTarget,
  SocialReactionTriggerType,
  SocialTone,
  Wrestler,
} from "./types";
import { getRatingsBattleSnapshot } from "./cpuRivalLoop";
import { getRivalMarketEvents } from "./market";
import { buildStipulationSocialPostDraft } from "./socialFeedPolicy";

type SocialPostDraft = Omit<SocialPost, "id" | "weekNumber" | "seasonNumber" | "showName"> & {
  priority: number;
};

type SocialReactionMeta = {
  persona: SocialReactionPersona;
  sentiment: SocialReactionSentiment;
  intensity: 1 | 2 | 3 | 4 | 5;
  triggerType: SocialReactionTriggerType;
  target: SocialReactionTarget;
  tags: string[];
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

function getWrestlerName(id: string, game: GameState) {
  return game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown";
}

function getPrimaryWrestlerTarget(wrestlerId: string, game: GameState): SocialReactionTarget {
  return {
    type: "wrestler",
    id: wrestlerId,
    name: getWrestlerName(wrestlerId, game),
  };
}

function getSegmentTarget(segment: SegmentResult, game: GameState): SocialReactionTarget {
  if (segment.championshipId) {
    const championship = game.championships.find((item) => item.id === segment.championshipId);

    if (championship) {
      return { type: "title", id: championship.id, name: championship.name };
    }
  }

  if (segment.rivalryId) {
    const rivalry = game.rivalries.find((item) => item.id === segment.rivalryId);

    if (rivalry) {
      return { type: "rivalry", id: rivalry.id, name: rivalry.name };
    }
  }

  if (segment.participantIds.length === 1) {
    return getPrimaryWrestlerTarget(segment.participantIds[0], game);
  }

  return {
    type: "team",
    ids: segment.participantIds,
    name: segment.participantNames.join(" / "),
  };
}

function getShowTarget(result: ShowResult): SocialReactionTarget {
  return { type: "show", id: result.id, name: result.showName };
}

function withReactionMeta(draft: Omit<SocialPostDraft, keyof SocialReactionMeta>, meta: SocialReactionMeta): SocialPostDraft {
  return {
    ...draft,
    ...meta,
    sourceResultId: draft.resultId,
  };
}

function getMatchLoserIds(segment: SegmentResult) {
  if (!segment.winnerId || segment.isNoContest || segment.type !== "Match") {
    return [];
  }

  return segment.participantIds.filter((id) => id !== segment.winnerId);
}

function getBestMatchSegment(result: ShowResult) {
  return result.segmentResults
    .filter((segment) => segment.type === "Match")
    .sort((left, right) => right.score - left.score || left.segmentId.localeCompare(right.segmentId))[0];
}

function getFirstCleanLossSegment(result: ShowResult) {
  return result.segmentResults.find((segment) => getMatchLoserIds(segment).length > 0);
}

function getRivalryForSegment(segment: SegmentResult, game: GameState) {
  return segment.rivalryId ? game.rivalries.find((rivalry) => rivalry.id === segment.rivalryId) : undefined;
}

function getLongTermRivalrySegment(result: ShowResult, game: GameState) {
  return result.segmentResults.find((segment) => {
    const rivalry = getRivalryForSegment(segment, game);
    return Boolean(rivalry && rivalry.weeksActive >= 4 && segment.rivalryNote && !isCoolingRivalryNote(segment.rivalryNote));
  });
}

function getFallbackReactionMeta(post: SocialPostDraft, result: ShowResult, game: GameState, bestSegment: SegmentResult): SocialReactionMeta {
  if (post.persona && post.sentiment && post.intensity && post.triggerType && post.target && post.tags) {
    return {
      persona: post.persona,
      sentiment: post.sentiment,
      intensity: post.intensity,
      triggerType: post.triggerType,
      target: post.target,
      tags: post.tags,
    };
  }

  const target = post.segmentId
    ? getSegmentTarget(result.segmentResults.find((segment) => segment.segmentId === post.segmentId) ?? bestSegment, game)
    : post.relatedWrestlerIds[0]
      ? getPrimaryWrestlerTarget(post.relatedWrestlerIds[0], game)
      : getShowTarget(result);

  if (post.category === "title_scene") {
    return { persona: "agenda_pusher", sentiment: post.tone === "angry" ? "negative" : "chaotic", intensity: 5, triggerType: "title_change", target, tags: ["title-scene", "agenda"] };
  }

  if (post.category === "rivalry_heat") {
    return {
      persona: post.tone === "skeptical" ? "let_it_play_out_skeptic" : "continuity_nerd",
      sentiment: post.tone === "skeptical" ? "negative" : "positive",
      intensity: post.tone === "chaotic" ? 5 : 4,
      triggerType: post.tone === "skeptical" ? "rivalry_stagnation" : "rivalry_advancement",
      target,
      tags: ["rivalry", post.tone === "skeptical" ? "stagnation" : "cinema"],
    };
  }

  if (post.category === "fatigue_concern") {
    return { persona: "doomposter", sentiment: "negative", intensity: 4, triggerType: "injury_fatigue_concern", target, tags: ["workload", "protection"] };
  }

  if (post.category === "push_complaint") {
    return { persona: "burial_cop", sentiment: "negative", intensity: 4, triggerType: "low_rated_match", target, tags: ["burial", "booking-choice"] };
  }

  if (post.category === "viral_moment") {
    return { persona: "agenda_pusher", sentiment: "positive", intensity: 4, triggerType: "fan_momentum_swing", target, tags: ["push", "agenda"] };
  }

  if (post.category === "analyst_take") {
    return { persona: "workrate_nerd", sentiment: post.tone === "skeptical" ? "mixed" : "positive", intensity: 3, triggerType: "show_rating_swing", target, tags: ["workrate", "show-quality"] };
  }

  if (post.category === "dirt_sheet") {
    return { persona: "dirt_sheet", sentiment: "mixed", intensity: 3, triggerType: "market_move", target, tags: ["rumor", "plans-changed"] };
  }

  if (post.category === "ple_reaction") {
    return { persona: "meme_account", sentiment: "chaotic", intensity: 5, triggerType: "hot_crowd", target, tags: ["meme", "ple", "cinema"] };
  }

  return { persona: "aura_poster", sentiment: "positive", intensity: 3, triggerType: "hot_crowd", target, tags: ["aura", "crowd-reaction"] };
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
    return "the kind of night people clip with the caption 'this is why my agenda never dies'";
  }

  if (result.totalScore >= 78) {
    return "solid enough that both sides of the timeline are somehow claiming victory";
  }

  if (result.totalScore >= 65) {
    return "messy enough for every armchair booker to act like they had the fix in five minutes";
  }

  return "the kind of show that gets clipped out of context before the credits finish";
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
  eventId: string | undefined,
  index: number,
  category: SocialCategory,
  author: string,
  tone: SocialTone,
  text: string,
  relatedWrestlerIds: string[],
  relatedRivalryIds: string[] = [],
  relatedChampionshipIds: string[] = [],
  segmentId?: string,
  reactionMeta?: Partial<Pick<SocialPost, "persona" | "sentiment" | "intensity" | "triggerType" | "target" | "tags">>,
): SocialPost {
  return {
    id: `${result.id}-social-${index}`,
    weekNumber: result.week,
    seasonNumber: result.seasonNumber,
    showName: result.showName,
    resultId: result.id,
    eventId,
    segmentId,
    category,
    author,
    text,
    tone,
    relatedWrestlerIds,
    relatedRivalryIds,
    relatedChampionshipIds,
    sourceEventId: eventId,
    sourceResultId: result.id,
    ...reactionMeta,
  };
}

export function generateSocialPosts(result: ShowResult, game: GameState): SocialPost[] {
  const eventId = game.eventLedger.find((event) => event.relatedIds.showResultId === result.id)?.id;
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
  const bestMatchSegment = getBestMatchSegment(result);
  const cleanLossSegment = getFirstCleanLossSegment(result);
  const longTermRivalrySegment = getLongTermRivalrySegment(result, game);
  const posts: SocialPostDraft[] = [];
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const latestMarketMove = [...game.marketState.transactions, ...getRivalMarketEvents(game)].filter((transaction) => transaction.seasonNumber === game.seasonNumber).at(-1);

  posts.push({
    category: "fan_praise",
    author: "@FrontRowFaithful",
    tone: "excited",
    priority: bestSegment.score >= 90 ? 20 : 8,
    text: pickLine(`${result.id}-fan-${bestSegment.segmentId}`, [
      `${bestNames} just gave the timeline a new personality. By morning, half these people will swear they were calling this exact moment for weeks.`,
      `${bestNames} had the building making that noise. A ${getSegmentHeatRead(bestSegment)} swing, and now the discourse is going to be completely unserious.`,
      `${bestNames} owned the loudest minutes of the card. I can already see the "actually this was cinema" threads loading.`,
    ]),
    relatedWrestlerIds: bestSegment.participantIds,
    relatedRivalryIds: getRelatedRivalryIds(bestSegment),
    relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
    segmentId: bestSegment.segmentId,
  });

  if (bestSegment.score >= 82) {
    const auraWrestlerId = [...bestSegment.participantIds].sort((left, right) => {
      const leftWrestler = game.wrestlers.find((wrestler) => wrestler.id === left);
      const rightWrestler = game.wrestlers.find((wrestler) => wrestler.id === right);
      return (rightWrestler?.popularity ?? 0) + (rightWrestler?.momentum ?? 0) - ((leftWrestler?.popularity ?? 0) + (leftWrestler?.momentum ?? 0));
    })[0];
    const auraName = auraWrestlerId ? getWrestlerName(auraWrestlerId, game) : bestNames;

    posts.push(
      withReactionMeta(
        {
          category: "fan_praise",
          author: "Aura Merchant",
          tone: "impressed",
          priority: 24,
          text: pickLine(`${result.id}-aura-${bestSegment.segmentId}`, [
            `${auraName} had the room reacting before the segment even settled. That is aura. You either have it or you are doing entrance cosplay.`,
            `${auraName} felt like a star tonight and I am not debating it with people who watch wrestling through spreadsheets.`,
            `The pop for ${auraName} told the whole story. Sometimes the crowd makes the booking argument for you.`,
          ]),
          relatedWrestlerIds: auraWrestlerId ? [auraWrestlerId] : bestSegment.participantIds,
          relatedRivalryIds: getRelatedRivalryIds(bestSegment),
          relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
          segmentId: bestSegment.segmentId,
        },
        {
          persona: "aura_poster",
          sentiment: "positive",
          intensity: bestSegment.score >= 90 ? 5 : 4,
          triggerType: "hot_crowd",
          target: auraWrestlerId ? getPrimaryWrestlerTarget(auraWrestlerId, game) : getSegmentTarget(bestSegment, game),
          tags: ["aura", "crowd-reaction", "presentation"],
        },
      ),
    );
  }

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
        ? `${game.brandName} is ${playerRankRead} after ${result.showName}, and ${nearestRival.brandName} fans are already acting like one Tuesday proves the whole war. Please be serious.`
        : `${game.brandName} is ${playerRankRead} after ${result.showName}, so of course the timeline is treating one ratings table like a courtroom exhibit.`,
      relatedWrestlerIds: bestSegment.participantIds,
      segmentId: bestSegment.segmentId,
    });
  }

  if (latestMarketMove) {
    posts.push({
      category: "dirt_sheet",
      author: "Market Wire",
      tone: latestMarketMove.type === "release" ? "skeptical" : latestMarketMove.type === "trade" && latestMarketMove.accepted === false ? "chaotic" : "analytical",
      priority: 10,
      text: `${latestMarketMove.note} The market sickos are already doing fake cap sheets in the replies like this is a court case.`,
      relatedWrestlerIds: latestMarketMove.wrestlerIds,
    });
  }

  posts.push({
    category: "analyst_take",
    author: "Gorilla Position Analytics",
    tone: "analytical",
    priority: 2,
    text: pickLine(`${result.id}-analyst-${scoreRead}`, [
      `${result.showName} landed ${scoreRead}, which means ${getDramaticScoreLabel(result)}.`,
      `${result.showName} had enough juice for the agenda accounts and enough weirdness for the hate-watchers. That is a dangerous cocktail.`,
      `${result.showName} left the timeline arguing receipts. Nobody is discussing the whole show; everyone picked one screenshot and went to war.`,
    ]),
    relatedWrestlerIds: bestSegment.participantIds,
    relatedRivalryIds: getRelatedRivalryIds(bestSegment),
    relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
    segmentId: bestSegment.segmentId,
  });

  if (bestMatchSegment && bestMatchSegment.score >= 85) {
    const matchNames = bestMatchSegment.participantNames.join(" / ");

    posts.push(
      withReactionMeta(
        {
          category: "analyst_take",
          author: "Workrate Court",
          tone: bestMatchSegment.score >= 92 ? "impressed" : "analytical",
          priority: 34,
          text: pickLine(`${result.id}-workrate-${bestMatchSegment.segmentId}`, [
            `${matchNames} gave the workrate crowd a finishing stretch to rewind. People can argue pushes all night; the bell-to-bell case is right there.`,
            `${matchNames} had actual chemistry, not just two names standing near each other. This is the kind of match people pretend they only appreciated later.`,
            `Star-rating discourse is going to be toxic after ${matchNames}, because the match cooked and nobody wants their agenda to admit it.`,
          ]),
          relatedWrestlerIds: bestMatchSegment.participantIds,
          relatedRivalryIds: getRelatedRivalryIds(bestMatchSegment),
          relatedChampionshipIds: getRelatedChampionshipIds(bestMatchSegment),
          segmentId: bestMatchSegment.segmentId,
        },
        {
          persona: "workrate_nerd",
          sentiment: "positive",
          intensity: bestMatchSegment.score >= 92 ? 5 : 4,
          triggerType: "high_rated_match",
          target: getSegmentTarget(bestMatchSegment, game),
          tags: ["workrate", "star-rating", "match-quality"],
        },
      ),
    );
  }

  if (cleanLossSegment) {
    const loserId = getMatchLoserIds(cleanLossSegment)[0];
    const winnerName = cleanLossSegment.winnerId ? getWrestlerName(cleanLossSegment.winnerId, game) : "the winner";
    const loserName = loserId ? getWrestlerName(loserId, game) : cleanLossSegment.participantNames.find((name) => name !== winnerName) ?? "the loser";

    posts.push(
      withReactionMeta(
        {
          category: "push_complaint",
          author: "Burial Watch",
          tone: cleanLossSegment.score >= 78 ? "skeptical" : "angry",
          priority: 30,
          text: pickLine(`${result.id}-clean-loss-${cleanLossSegment.segmentId}-${loserId}`, [
            `${loserName} eating a clean loss to ${winnerName} and people are calling it "protected"? Be serious. That is how you cool someone off in plain sight.`,
            `Clean loss discourse starts now: if ${loserName} matters, the follow-up has to be loud. You cannot just hand-wave this as character work.`,
            `${winnerName} got the moment, cool. But ${loserName} taking that loss clean is exactly the kind of booking people call a burial three weeks later.`,
          ]),
          relatedWrestlerIds: cleanLossSegment.participantIds,
          relatedRivalryIds: getRelatedRivalryIds(cleanLossSegment),
          relatedChampionshipIds: getRelatedChampionshipIds(cleanLossSegment),
          segmentId: cleanLossSegment.segmentId,
        },
        {
          persona: "burial_cop",
          sentiment: "negative",
          intensity: cleanLossSegment.score < 70 ? 5 : 4,
          triggerType: "clean_loss",
          target: loserId ? getPrimaryWrestlerTarget(loserId, game) : getSegmentTarget(cleanLossSegment, game),
          tags: ["burial", "clean-loss", "protected-in-defeat"],
        },
      ),
    );
  }

  if (momentumWrestler && result.biggestMomentumGain.amount > 0) {
    posts.push({
      category: "viral_moment",
      author: "@ClipMachine",
      tone: "impressed",
      priority: result.biggestMomentumGain.amount >= 8 ? 18 : 6,
      text: pickLine(`${result.id}-momentum-${momentumWrestler.id}`, [
        `${momentumWrestler.name} got one loud post-show moment and now the timeline is building a five-year title reign in their heads.`,
        `${momentumWrestler.name} came out of ${result.showName} with clip energy. The agenda accounts are about to become insufferable.`,
        `The timeline found ${momentumWrestler.name}. This is exactly how a normal pop turns into a "strap the rocket" campaign by breakfast.`,
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
        `${fatigueWrestler.name} looked like they paid for every second of that spotlight. The "protect your stars" crowd is about to be unbearable.`,
        `${fatigueWrestler.name}'s usage has the workload police posting like they just found a smoking gun.`,
        `Good night or not, ${fatigueWrestler.name} looked spent. Give the internet one tired walk to the back and suddenly everyone has a medical degree.`,
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
        `${weakestNames} did not land, and you already know the quote-tweets are going to be "what was the vision here?" with 900 likes.`,
        `${weakestNames} was the soft spot on the card. You cannot hide behind pacing when the internet has pause buttons and zero mercy.`,
        `${weakestNames} did not get all the way there. That is the kind of creative bruise people pretend ruined their whole week.`,
      ]),
      relatedWrestlerIds: weakestSegment.participantIds,
      relatedRivalryIds: getRelatedRivalryIds(weakestSegment),
      relatedChampionshipIds: getRelatedChampionshipIds(weakestSegment),
      segmentId: weakestSegment.segmentId,
    });
  }

  if (result.broadcastOverrunNotes?.length) {
    const overrunSegment = result.segmentResults.find((segment) => segment.overrunAffected);

    posts.push({
      category: "analyst_take",
      author: "Gorilla Position Analytics",
      tone: result.broadcastOverrunLevel === "major" ? "angry" : "skeptical",
      priority: result.broadcastOverrunLevel === "major" ? 22 : 10,
      text: result.broadcastOverrunNotes[result.broadcastOverrunNotes.length - 1],
      relatedWrestlerIds: overrunSegment?.participantIds ?? [],
      segmentId: overrunSegment?.segmentId,
    });
  }

  result.segmentResults
    .filter((segment) => segment.stipulationId)
    .sort((left, right) => right.score - left.score || left.segmentId.localeCompare(right.segmentId))
    .slice(0, 1)
    .forEach((segment) => {
      const stipulationDraft = buildStipulationSocialPostDraft(result, segment);

      if (stipulationDraft) {
        posts.push(stipulationDraft);
      }
    });

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
          `${segment.titleNote ?? ""} Title-scene accounts are already typing like the belt personally betrayed them.`,
          `${segment.participantNames.join(" / ")} made the title scene the loudest argument of the night. Nobody is being normal about this. ${segment.titleNote ?? ""}`,
          `${result.showName} gave the belt a receipt and now every title-scene take sounds like evidence in a trial. ${segment.titleNote ?? ""}`,
        ]),
        relatedWrestlerIds: segment.participantIds,
        relatedChampionshipIds: getRelatedChampionshipIds(segment),
        segmentId: segment.segmentId,
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
          `${segment.rivalryNote ?? ""} The feud timeline is either calling it cinema or malpractice. There is no middle setting.`,
          `${segment.participantNames.join(" / ")} have the timeline picking sides like jury duty now. ${segment.rivalryNote ?? ""}`,
          `${result.showName} moved the story argument, so expect everyone to pretend their favorite side was obviously right all along. ${segment.rivalryNote ?? ""}`,
        ]),
        relatedWrestlerIds: segment.participantIds,
        relatedRivalryIds: getRelatedRivalryIds(segment),
        segmentId: segment.segmentId,
      });
    });

  if (longTermRivalrySegment) {
    const rivalry = getRivalryForSegment(longTermRivalrySegment, game);
    const rivalryName = rivalry?.name ?? longTermRivalrySegment.participantNames.join(" vs ");

    posts.push(
      withReactionMeta(
        {
          category: "rivalry_heat",
          author: "Continuity Sicko",
          tone: "impressed",
          priority: 32,
          text: pickLine(`${result.id}-continuity-${longTermRivalrySegment.segmentId}`, [
            `${rivalryName} is finally paying off the weeks of side-eye and little receipts. This is what "let it breathe" is supposed to look like.`,
            `The callback in ${rivalryName} is why I keep receipts. Everybody who called it filler owes the timeline an apology.`,
            `${rivalryName} got a real continuity beat instead of random noise. Cinema merchants, we are so back.`,
          ]),
          relatedWrestlerIds: longTermRivalrySegment.participantIds,
          relatedRivalryIds: getRelatedRivalryIds(longTermRivalrySegment),
          relatedChampionshipIds: getRelatedChampionshipIds(longTermRivalrySegment),
          segmentId: longTermRivalrySegment.segmentId,
        },
        {
          persona: "continuity_nerd",
          sentiment: "positive",
          intensity: 4,
          triggerType: "long_term_callback",
          target: rivalry ? { type: "rivalry", id: rivalry.id, name: rivalry.name } : getSegmentTarget(longTermRivalrySegment, game),
          tags: ["continuity", "cinema", "long-term-storytelling"],
        },
      ),
    );
  }

  if (result.showType === "ple") {
    posts.push({
      category: "ple_reaction",
      author: "IWC Event Desk",
      tone: "chaotic",
      priority: 36,
      text: pickLine(`${result.id}-ple`, [
        `${result.showName} felt like one of those nights where everyone logs on with a thesis and zero intention of listening.`,
        `${result.showName} had major-event pressure in the walls. The receipt is loud enough that people will weaponize it until the next TV opens.`,
        `The PLE gave the brand loud moments, real fallout, and enough discourse for the internet to overbook the next month by itself.`,
      ]),
      relatedWrestlerIds: bestSegment.participantIds,
      relatedRivalryIds: getRelatedRivalryIds(bestSegment),
      relatedChampionshipIds: getRelatedChampionshipIds(bestSegment),
      segmentId: bestSegment.segmentId,
    });
  }

  posts.push({
    category: "dirt_sheet",
    author: "Backstage Wire",
    tone: "skeptical",
    priority: 4,
    text: pickLine(`${result.id}-wire`, [
      `Rumor-board read after ${result.showName}: ${result.biggestMomentumGain.name} has new believers, and ${result.biggestFatigueIncrease.name}'s workload has people doing Zapruder-level analysis.`,
      `Backstage read, if you believe the noise: ${result.biggestMomentumGain.name} left with heat, while ${result.biggestFatigueIncrease.name}'s workload has the replies side-eyeing the whole operation.`,
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
        eventId,
        index + 1,
        post.category,
        post.author,
        post.tone,
        post.text,
        post.relatedWrestlerIds,
        post.relatedRivalryIds,
        post.relatedChampionshipIds,
        post.segmentId,
        getFallbackReactionMeta(post, result, game, bestSegment),
      ),
    );
}
