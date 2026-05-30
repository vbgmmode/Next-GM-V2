import { getRatingsBattleSnapshot } from "../game/cpuRivalLoop";
import { getRosterPressureTags, getWeeksSinceLastBooked } from "../game/rosterContextReads";
import { getBestSegment } from "../game/scoring";
import { getSuperstarMailAction } from "../game/socialInboxActions";
import { wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type { GameState, RivalBrandWeeklyResult, Rivalry, SegmentResult, ShowResult, SocialCategory, SocialPost, Wrestler } from "../game/types";
import type {
  IwcMoodSummary,
  IwcMoodTone,
  IwcTrendingTopicsSnapshot,
  SocialPostEngagement,
  SuperstarMailItem,
  SuperstarMailSnapshot,
  SuperstarMailTone,
  WrestlerJabFeedSnapshot,
  WrestlerJabItem,
  WrestlerJabTone,
} from "./socialTypes";

function getShowCrowdRead(totalScore: number) {
  if (totalScore >= 90) {
    return "Electric";
  }

  if (totalScore >= 78) {
    return "Strong";
  }

  if (totalScore >= 65) {
    return "Mixed";
  }

  return "Cold";
}

function getDominantEntry<T extends string>(values: T[]) {
  const counts = values.reduce<Map<T, number>>((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>());
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

const SOCIAL_AVATAR_COUNT = 100;
const SOCIAL_AVATAR_BASE_PATH = "/social-avatars";
const SOCIAL_AUTHOR_AVATAR_INDEX: Record<string, number> = {
  "@anglewatch": 22,
  "@bookerbrain": 39,
  "@clipmachine": 10,
  "@frontrowfaithful": 41,
  "@iwceventdesk": 4,
  "@iwcstorydesk": 9,
  "@marketwire": 32,
  "@ratingsdesklive": 58,
  "@tapetradersweekly": 27,
  "@titlesceneemergencywire": 13,
  "@titlescenereport": 12,
  "@backstagewire": 3,
  "@gorillapositionanalytics": 54,
};

function formatSocialAvatarSrc(index: number) {
  const paddedIndex = String(index).padStart(3, "0");
  return `${SOCIAL_AVATAR_BASE_PATH}/social-avatar-${paddedIndex}.png`;
}

export function formatSocialCategory(category: SocialCategory) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatSocialTone(tone: SocialPost["tone"]) {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

export function formatFanFeedLabel(category: SocialCategory) {
  if (category === "dirt_sheet") {
    return "Rumors";
  }

  if (category === "push_complaint" || category === "fatigue_concern") {
    return "Criticism";
  }

  if (category === "rivalry_heat" || category === "title_scene" || category === "ple_reaction") {
    return "Speculation";
  }

  return "Drama";
}

export function getFanFeedPosts(game: GameState) {
  return [...game.socialPosts].reverse().filter((post) => post.category !== "analyst_take");
}

export function getWrestlerFeedHandle(name: string) {
  const handle = name
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .join("");
  return `@${handle || "Superstar"}`;
}

function getIwcMoodHeadline(tone: IwcMoodTone, primaryCategory?: SocialCategory) {
  if (tone === "chaotic") {
    return "Timeline Is Chaotic";
  }

  if (tone === "angry") {
    return "Fans Are Heated";
  }

  if (tone === "skeptical") {
    return "Timeline Is Skeptical";
  }

  if (tone === "impressed" || tone === "excited") {
    return primaryCategory === "title_scene" ? "Title Scene Has Buzz" : "Fans Are Buying In";
  }

  return "Discourse Is In The Tape Room";
}

function getIwcArgumentLabel(category?: SocialCategory) {
  if (category === "title_scene") {
    return "Title Scene";
  }

  if (category === "rivalry_heat") {
    return "Rivalry Heat";
  }

  if (category === "fatigue_concern") {
    return "Workload";
  }

  if (category === "push_complaint") {
    return "Booking Choice";
  }

  if (category === "viral_moment") {
    return "Breakout Clip";
  }

  if (category === "ple_reaction") {
    return "PLE Fallout";
  }

  if (category === "analyst_take") {
    return "Match Quality";
  }

  if (category === "dirt_sheet") {
    return "Backstage Read";
  }

  if (category === "fan_praise") {
    return "Fan Praise";
  }

  return "No Argument";
}

export function getIwcMoodSummary(game: GameState): IwcMoodSummary | undefined {
  if (!game.socialPosts.length) {
    return undefined;
  }

  const latestPost = game.socialPosts[game.socialPosts.length - 1];
  const weekPosts = game.socialPosts.filter((post) => post.seasonNumber === latestPost.seasonNumber && post.weekNumber === latestPost.weekNumber);
  const result = game.showHistory.find((show) => show.seasonNumber === latestPost.seasonNumber && show.week === latestPost.weekNumber);
  const dominantTone = getDominantEntry(weekPosts.map((post) => post.tone));
  const dominantCategory = getDominantEntry(weekPosts.map((post) => post.category));
  const wrestlerCounts = new Map<string, number>();
  const rivalryCounts = new Map<string, number>();
  const championshipCounts = new Map<string, number>();

  weekPosts.forEach((post) => {
    post.relatedWrestlerIds.forEach((id) => wrestlerCounts.set(id, (wrestlerCounts.get(id) ?? 0) + 1));
    post.relatedRivalryIds?.forEach((id) => rivalryCounts.set(id, (rivalryCounts.get(id) ?? 0) + 1));
    post.relatedChampionshipIds?.forEach((id) => championshipCounts.set(id, (championshipCounts.get(id) ?? 0) + 1));
  });

  const topWrestlerId = [...wrestlerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topRivalryId = [...rivalryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topChampionshipId = [...championshipCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topWrestler = game.wrestlers.find((wrestler) => wrestler.id === topWrestlerId);
  const topRivalry = game.rivalries.find((rivalry) => rivalry.id === topRivalryId);
  const topChampionship = game.championships.find((championship) => championship.id === topChampionshipId);
  const tone = dominantTone?.[0] ?? "analytical";
  const category = dominantCategory?.[0];
  const toneLabel = formatSocialTone(tone);
  const bestSegment = result ? getBestSegment(result) : undefined;
  const argumentLabel = getIwcArgumentLabel(category);
  const focusValue = topChampionship?.name ?? topRivalry?.name ?? topWrestler?.name ?? bestSegment?.participantNames.join(" / ") ?? latestPost.showName;
  const focusDetail = topChampionship
    ? `${topChampionship.name} is the belt showing up most in the resolved posts.`
    : topRivalry
      ? `${topRivalry.name} is the story thread fans keep circling.`
      : topWrestler
        ? `${topWrestler.name} is drawing the loudest individual attention.`
        : bestSegment
          ? `${bestSegment.participantNames.join(" / ")} gave the feed its cleanest reference point.`
          : "The feed is talking about the show more than one person.";
  const showDetail = result
    ? `${result.showName} landed with ${getShowCrowdRead(result.totalScore).toLowerCase()} crowd energy, with ${bestSegment?.participantNames.join(" / ") ?? "the card"} as the strongest resolved beat.`
    : `${latestPost.showName} has resolved posts, but no matching show result was found in history.`;

  return {
    headline: getIwcMoodHeadline(tone, category),
    detail: `Resolved Week ${latestPost.weekNumber} posts only. This summarizes what the audience is arguing about after the show, not what will happen next.`,
    weekLabel: `Season ${latestPost.seasonNumber} · Week ${latestPost.weekNumber} · ${latestPost.showName}`,
    tone,
    items: [
      {
        id: "argument",
        label: "Main Argument",
        value: argumentLabel,
        detail: category
          ? `${dominantCategory?.[1] ?? 0} post${dominantCategory?.[1] === 1 ? " is" : "s are"} centered on ${formatSocialCategory(category).toLowerCase()}.`
          : "No dominant topic yet.",
      },
      {
        id: "focus",
        label: "Who/What Has The Feed",
        value: focusValue,
        detail: focusDetail,
      },
      {
        id: "mood",
        label: "Mood",
        value: toneLabel,
        detail: `${dominantTone?.[1] ?? 0} post${dominantTone?.[1] === 1 ? "" : "s"} carry ${toneLabel.toLowerCase()} energy.`,
      },
      {
        id: "receipt",
        label: "Resolved Receipt",
        value: result ? getShowCrowdRead(result.totalScore) : "Posts Only",
        detail: showDetail,
      },
    ],
  };
}

export function getRelatedWrestlerNames(post: SocialPost, wrestlers: Wrestler[]) {
  return post.relatedWrestlerIds.map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name).filter(Boolean).join(" / ");
}

export function getSocialAuthorMeta(author: string) {
  const trimmed = author.trim();
  const handle = trimmed.startsWith("@") ? trimmed : `@${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
  const displayName = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

  return { displayName, handle };
}

export function getSocialAuthorAvatarSrc(author: string) {
  const { handle } = getSocialAuthorMeta(author);
  const normalizedHandle = handle.toLowerCase();
  const mappedIndex = SOCIAL_AUTHOR_AVATAR_INDEX[normalizedHandle];

  if (mappedIndex) {
    return formatSocialAvatarSrc(mappedIndex);
  }

  return formatSocialAvatarSrc((hashString(normalizedHandle) % SOCIAL_AVATAR_COUNT) + 1);
}

export function getSocialAuthorInitials(author: string) {
  const { displayName } = getSocialAuthorMeta(author);
  const parts = displayName.replace(/([a-z])([A-Z])/g, "$1 $2").split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return displayName.slice(0, 2).toUpperCase();
}

export function getSocialPostEngagement(postId: string): SocialPostEngagement {
  const hash = hashString(postId);

  return {
    replies: (hash % 820) + 18,
    reposts: (hash % 360) + 6,
    likes: (hash % 4800) + 64,
    views: (hash % 48000) + 1400,
  };
}

export function formatEngagementCount(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `${value}`;
}

function pickLine(seed: string, lines: string[]) {
  return lines[hashString(seed) % lines.length];
}

function buildMailBody(seed: string, preview: string, extensions: string[]) {
  return `${preview} ${pickLine(`${seed}-body`, extensions)}`;
}

function finalizeSuperstarMail(
  item: Omit<SuperstarMailCandidate, "body">,
  bodyExtensions: string[],
): SuperstarMailCandidate {
  return {
    ...item,
    action: getSuperstarMailAction(item.askLabel),
    body: buildMailBody(item.id, item.preview, bodyExtensions),
  };
}

function clampTopicLabel(label: string, max = 92) {
  const trimmed = label.trim();

  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max - 1).replace(/\s+\S*$/, "").trim()}…`;
}

function formatTopicVolume(count: number) {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}M mentions`;
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k mentions`;
  }

  return `${count} mentions`;
}

function getBrandTag(brandName: string) {
  if (brandName === "Universe") {
    return "#WrestlingTwitter";
  }

  return `#${brandName.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function getMatchupShort(text: string) {
  const cleaned = text.trim();
  const versus = cleaned.split(/\svs\.?\s/i);

  if (versus.length >= 2) {
    return `${versus[0].trim()} vs ${versus[1].split(/[,.]/)[0]?.trim() ?? versus[1].trim()}`;
  }

  return cleaned.split(/[,.]/)[0]?.trim() ?? cleaned;
}

function getPlayerTopicHeadline(post: SocialPost, names: string, brandName: string) {
  const tag = getBrandTag(brandName);
  const templates: Record<SocialCategory, string[]> = {
    fan_praise: [
      `${names} got the TL doing backflips ${tag}`,
      `okay ${names} was actually insane tonight ${tag}`,
      `crowd pop twitter is undefeated for ${names} ${tag}`,
    ],
    analyst_take: [
      `tape twitter is at war over ${post.showName} ${tag}`,
      `analysts fighting in the quotes again ${tag}`,
      `${post.showName} got graded and the mentions turned feral ${tag}`,
    ],
    push_complaint: [
      `why was ${names} in THAT spot?? ${tag}`,
      `booking twitter wants blood after ${names} ${tag}`,
      `${names} getting misused is trending for a reason ${tag}`,
    ],
    viral_moment: [
      `${names} clip farming on the TL rn ${tag}`,
      `everyone reposting ${names} like rent is due ${tag}`,
      `${names} went viral and the replies are nasty ${tag}`,
    ],
    fatigue_concern: [
      `${names} workload discourse is back ${tag}`,
      `protect ${names} or stop tweeting about them ${tag}`,
      `${names} fatigue talk eating the timeline ${tag}`,
    ],
    title_scene: [
      `title scene twitter is not okay after ${names} ${tag}`,
      `${names} + the belt = timeline meltdown ${tag}`,
      `belt discourse got unhinged fast ${tag}`,
    ],
    rivalry_heat: [
      `${names} feud has the IWC picking sides ${tag}`,
      `${names} trending because this feud is real ${tag}`,
      `story twitter won't shut up about ${names} ${tag}`,
    ],
    ple_reaction: [
      `${post.showName} PLE hangover hits different ${tag}`,
      `major event twitter still going at 2am ${tag}`,
      `PLE receipts have the TL in shambles ${tag}`,
    ],
    dirt_sheet: [
      `dirt sheet twitter whispering about ${brandName} ${tag}`,
      `backstage rumor mill cooking ${brandName} ${tag}`,
      `sheet accounts won't stop posting ${tag}`,
    ],
  };

  return pickLine(`topic-headline-${post.id}`, templates[post.category] ?? [`${brandName} is trending for chaos ${tag}`]);
}

function buildRivalMainTopic(brandName: string, result: RivalBrandWeeklyResult, seed: string) {
  const tag = getBrandTag(brandName);
  const matchup = getMatchupShort(result.mainEvent);

  return pickLine(seed, [
    `did ${brandName} really just run ${matchup} and call it a W? ${tag}`,
    `${matchup} has ${brandName} trending for the wrong reasons ${tag}`,
    `${brandName} twitter thinks it won the week again ${tag}`,
    `${result.showName} got the quote tweets going to war ${tag}`,
  ]);
}

function buildRivalAngleTopic(brandName: string, angle: string, seed: string) {
  const tag = getBrandTag(brandName);
  const short = getMatchupShort(angle);

  return pickLine(seed, [
    `${short} had wrestling twitter in a chokehold ${tag}`,
    `that ${brandName} angle was either cinema or a crime ${tag}`,
    `${short} is all over my feed and none of it's polite ${tag}`,
    `${brandName} creative choice got ratio'd instantly ${tag}`,
  ]);
}

function buildRivalNoteTopic(brandName: string, note: string, seed: string, kind: "rivalry" | "title") {
  const tag = getBrandTag(brandName);
  const short = getMatchupShort(note);

  if (kind === "title") {
    return pickLine(seed, [
      `title twitter won't stop yelling about ${short} ${tag}`,
      `${short} belt discourse is eating the timeline ${tag}`,
      `${brandName} title scene got the IWC feral ${tag}`,
    ]);
  }

  return pickLine(seed, [
    `${short} feud talk is trending ugly ${tag}`,
    `story twitter is loud about ${short} ${tag}`,
    `${brandName} rivalry mentions are out of control ${tag}`,
  ]);
}

function buildRivalDeskTopic(brandName: string, result: RivalBrandWeeklyResult, seed: string) {
  const tag = getBrandTag(brandName);

  return pickLine(seed, [
    `${brandName} show twitter is still coping in the quotes ${tag}`,
    `${result.showName} receipt got cooked in the mentions ${tag}`,
    `${brandName} thinks it won the week again ${tag}`,
  ]);
}

function getCategoryHeat(category: SocialCategory) {
  const weights: Record<SocialCategory, number> = {
    title_scene: 34,
    rivalry_heat: 32,
    ple_reaction: 30,
    viral_moment: 24,
    fatigue_concern: 20,
    fan_praise: 18,
    push_complaint: 16,
    analyst_take: 14,
    dirt_sheet: 12,
  };

  return weights[category];
}

function buildPlayerPostTopics(game: GameState, weekPosts: SocialPost[]) {
  return weekPosts.map((post) => {
    const names =
      post.relatedWrestlerIds
        .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name)
        .filter(Boolean)
        .join(" / ") || game.brandName;
    const hash = hashString(post.id);
    const postVolume = (hash % 14000) + 900 + weekPosts.filter((entry) => entry.category === post.category).length * 320;

    return {
      id: `player-${post.id}`,
      brandName: game.brandName,
      label: clampTopicLabel(getPlayerTopicHeadline(post, names, game.brandName)),
      heat: getCategoryHeat(post.category) + postVolume / 180 + (post.tone === "chaotic" ? 12 : post.tone === "excited" ? 8 : 0),
      postVolume,
    };
  });
}

function buildRivalBrandTopics(brandName: string, brandId: string, result: RivalBrandWeeklyResult) {
  const baseHeat = result.score * 1.15 + (5 - result.rank) * 9;
  const hash = hashString(`${brandId}-${result.seasonNumber}-${result.weekNumber}`);
  const candidates = [
    {
      id: `${brandId}-main`,
      brandName,
      label: clampTopicLabel(buildRivalMainTopic(brandName, result, `rival-main-${brandId}-${result.weekNumber}`)),
      heat: baseHeat + 22,
      postVolume: (hash % 18000) + 1400,
    },
    {
      id: `${brandId}-angle`,
      brandName,
      label: clampTopicLabel(buildRivalAngleTopic(brandName, result.keyAngle, `rival-angle-${brandId}-${result.weekNumber}`)),
      heat: baseHeat + 16,
      postVolume: (hash % 11000) + 900,
    },
    ...result.rivalryNotes.slice(0, 1).map((note, index) => ({
      id: `${brandId}-rivalry-${index}`,
      brandName,
      label: clampTopicLabel(buildRivalNoteTopic(brandName, note, `rival-rivalry-${brandId}-${index}`, "rivalry")),
      heat: baseHeat + 18,
      postVolume: (hash % 9500) + 1100,
    })),
    ...result.titleNotes.slice(0, 1).map((note, index) => ({
      id: `${brandId}-title-${index}`,
      brandName,
      label: clampTopicLabel(buildRivalNoteTopic(brandName, note, `rival-title-${brandId}-${index}`, "title")),
      heat: baseHeat + 20,
      postVolume: (hash % 10200) + 1200,
    })),
    {
      id: `${brandId}-desk`,
      brandName,
      label: clampTopicLabel(buildRivalDeskTopic(brandName, result, `rival-desk-${brandId}-${result.weekNumber}`)),
      heat: baseHeat + 12,
      postVolume: (hash % 8000) + 700,
    },
  ];

  return candidates.filter((candidate) => candidate.label.length > 0);
}

function buildCrossBrandTopics(game: GameState, result?: ShowResult) {
  const ratingsBattle = getRatingsBattleSnapshot(game, result);
  const candidates = [];

  if (ratingsBattle) {
    const leader = ratingsBattle.entries.find((entry) => entry.rank === 1);
    candidates.push({
      id: "cross-ratings",
      brandName: "IWC",
      label: clampTopicLabel(
        pickLine(`cross-ratings-${game.seasonNumber}-${game.currentWeek}`, [
          `#RatingsWars ${leader?.brandName ?? ratingsBattle.leaderName} at #1 and the mentions are feral`,
          `brand war twitter says ${ratingsBattle.leaderName} is cooking everyone`,
          `who had ${leader?.brandName ?? ratingsBattle.leaderName} running the desk this week?? #RatingsWars`,
        ]),
      ),
      heat: 88,
      postVolume: 22000,
    });
  }

  if (result) {
    const bestSegment = getBestSegment(result);
    const bestNames = bestSegment.participantNames.join(" / ");
    candidates.push({
      id: "cross-universe",
      brandName: "IWC",
      label: clampTopicLabel(
        pickLine(`cross-universe-${result.id}`, [
          `${bestNames} trending like they paid for bots #WrestlingTwitter`,
          `week ${result.week} receipt has the quotes looking nasty`,
          `every brand thinks it won the week lol #WrestlingTwitter`,
        ]),
      ),
      heat: 72,
      postVolume: 16000,
    });
  }

  return candidates;
}

function dedupeTopicCandidates<T extends { brandName: string; label: string }>(candidates: T[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.brandName}:${candidate.label.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getWeeklyIwcTrendingTopics(game: GameState, limit = 10): IwcTrendingTopicsSnapshot | undefined {
  const latestPost = game.socialPosts.at(-1);
  const seasonNumber = latestPost?.seasonNumber ?? game.seasonNumber;
  const weekNumber = latestPost?.weekNumber ?? Math.max(1, game.currentWeek - 1);
  const weekPosts = game.socialPosts.filter((post) => post.seasonNumber === seasonNumber && post.weekNumber === weekNumber);
  const result = game.showHistory.find((show) => show.seasonNumber === seasonNumber && show.week === weekNumber);

  if (!weekPosts.length && !game.rivalBrands.some((brand) => brand.weeklyResults.some((entry) => entry.seasonNumber === seasonNumber && entry.weekNumber === weekNumber))) {
    return undefined;
  }

  const candidates = dedupeTopicCandidates([
    ...buildPlayerPostTopics(game, weekPosts),
    ...game.rivalBrands.flatMap((brand) => {
      const weeklyResult = brand.weeklyResults.find((entry) => entry.seasonNumber === seasonNumber && entry.weekNumber === weekNumber);
      return weeklyResult ? buildRivalBrandTopics(brand.brandName, brand.id, weeklyResult) : [];
    }),
    ...buildCrossBrandTopics(game, result),
  ]);

  const topics = candidates
    .sort((a, b) => b.heat - a.heat || a.brandName.localeCompare(b.brandName) || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((candidate, index) => ({
      id: candidate.id,
      rank: index + 1,
      brandName: candidate.brandName,
      label: candidate.label,
      volumeLabel: formatTopicVolume(candidate.postVolume),
    }));

  return {
    weekLabel: `Season ${seasonNumber} · Week ${weekNumber}`,
    detail: "Timeline noise from every major brand. Hashtag recap only — not a booking forecast.",
    topics,
  };
}

export function getTrendingTopics(game: GameState, limit = 10) {
  return getWeeklyIwcTrendingTopics(game, limit)?.topics ?? [];
}

type WrestlerJabCandidate = WrestlerJabItem & {
  priority: number;
};

function getResolvedSocialWeek(game: GameState) {
  const latestPost = game.socialPosts.at(-1);
  const seasonNumber = latestPost?.seasonNumber ?? game.seasonNumber;
  const weekNumber = latestPost?.weekNumber ?? Math.max(1, game.currentWeek - 1);

  return { seasonNumber, weekNumber };
}

function findRosterWrestler(game: GameState, wrestlerId: string) {
  return game.wrestlers.find((wrestler) => wrestler.id === wrestlerId);
}

function pairHasActiveRivalry(game: GameState, firstId: string, secondId: string) {
  return game.rivalries.some(
    (rivalry) =>
      rivalry.status !== "stale" && rivalry.participantIds.includes(firstId) && rivalry.participantIds.includes(secondId),
  );
}

function buildRivalryJabs(game: GameState, rivalry: Rivalry): WrestlerJabCandidate[] {
  const participants = rivalry.participantIds
    .map((id) => findRosterWrestler(game, id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
    .slice(0, 2);

  if (participants.length < 2) {
    return [];
  }

  const [author, target] = participants;
  const tone: WrestlerJabTone = rivalry.stakes === "title" ? "title" : rivalry.heat >= 70 ? "heated" : "challenge";
  const intentLabel = rivalry.heat >= 75 ? "FEUD SHOT" : "HEAT REPLY";
  const priority = 88 + Math.min(rivalry.heat, 12) + (rivalry.status === "rising" ? 8 : 0);

  const authorJab = pickLine(`jab-rivalry-${rivalry.id}-${author.id}`, [
    `${target.name} really thought last week closed this. cute.`,
    `hey ${target.name} — still waiting on that follow-up you promised the camera.`,
    `${target.name} wants smoke? fine. stop posting and walk to the ring.`,
    rivalry.stakes === "title"
      ? `${target.name} holding that belt like rent is due tomorrow.`
      : `${target.name} keeps talking like the receipt wasn't public.`,
  ]);

  const replyJab = pickLine(`jab-rivalry-reply-${rivalry.id}-${target.id}`, [
    `${author.name} tweeting through it again instead of showing up.`,
    `${author.name} wants a rivalry push off one segment. respectfully, no.`,
    `if ${author.name} needs social media to stay relevant, that tells you everything.`,
    rivalry.stakes === "title"
      ? `${author.name} can tweet all week — the belt still isn't yours.`
      : `${author.name} still mad about a loss that wasn't even close.`,
  ]);

  return [
    {
      id: `jab-rivalry-${rivalry.id}-${author.id}`,
      authorId: author.id,
      authorName: author.name,
      targetId: target.id,
      targetName: target.name,
      jab: authorJab,
      intentLabel,
      tone,
      priority,
    },
    {
      id: `jab-rivalry-reply-${rivalry.id}-${target.id}`,
      authorId: target.id,
      authorName: target.name,
      targetId: author.id,
      targetName: author.name,
      jab: replyJab,
      intentLabel: "HEAT REPLY",
      tone: tone === "title" ? "title" : "petty",
      priority: priority - 4,
    },
  ];
}

function buildShowSegmentJabs(game: GameState, segment: SegmentResult, result: ShowResult): WrestlerJabCandidate[] {
  const participants = segment.participantIds
    .map((id) => findRosterWrestler(game, id))
    .filter((wrestler): wrestler is Wrestler => Boolean(wrestler))
    .slice(0, 2);

  if (participants.length < 2) {
    return [];
  }

  const [first, second] = participants;

  if (pairHasActiveRivalry(game, first.id, second.id)) {
    return [];
  }

  const winnerId = segment.momentumChanges
    ? Object.entries(segment.momentumChanges).sort((left, right) => right[1] - left[1])[0]?.[0]
    : undefined;
  const winner = participants.find((wrestler) => wrestler.id === winnerId) ?? first;
  const loser = participants.find((wrestler) => wrestler.id !== winner.id) ?? second;
  const priority = 72 + Math.min(segment.score, 18) + (segment.type === "Match" ? 6 : 0);

  const winnerJab = pickLine(`jab-show-win-${result.id}-${segment.segmentId}-${winner.id}`, [
    `${loser.name} got a TV slot and still couldn't keep up. run it back.`,
    `nice moment for ${loser.name}. still wouldn't last five with me.`,
    `${result.showName} gave ${loser.name} a lane and the timeline is being generous.`,
    `${loser.name} wants relevance off one segment? say less.`,
  ]);

  const loserJab = pickLine(`jab-show-loss-${result.id}-${segment.segmentId}-${loser.id}`, [
    `${winner.name} got the pop and the easy booking. rematch me without the protection.`,
    `enjoy the mentions, ${winner.name}. that angle didn't settle anything.`,
    `${winner.name} talking like one segment made them the face of this brand.`,
    `cool win for ${winner.name}. still see you in the hallway every week.`,
  ]);

  return [
    {
      id: `jab-show-win-${segment.segmentId}-${winner.id}`,
      authorId: winner.id,
      authorName: winner.name,
      targetId: loser.id,
      targetName: loser.name,
      jab: winnerJab,
      intentLabel: "POST-SHOW SHOT",
      tone: "challenge",
      priority,
    },
    {
      id: `jab-show-loss-${segment.segmentId}-${loser.id}`,
      authorId: loser.id,
      authorName: loser.name,
      targetId: winner.id,
      targetName: winner.name,
      jab: loserJab,
      intentLabel: "RIVALRY BAIT",
      tone: "heated",
      priority: priority - 2,
    },
  ];
}

function buildChampionJabs(game: GameState): WrestlerJabCandidate[] {
  const candidates: WrestlerJabCandidate[] = [];

  for (const championship of game.championships) {
    const championId = championship.championIds[0];
    const champion = championId ? findRosterWrestler(game, championId) : undefined;

    if (!champion) {
      continue;
    }

    const challengers = game.wrestlers
      .filter((wrestler) => wrestler.id !== champion.id && wrestler.injuryStatus !== "major")
      .sort((left, right) => right.momentum - left.momentum || right.popularity - left.popularity)
      .slice(0, 2);

    for (const challenger of challengers) {
      if (pairHasActiveRivalry(game, champion.id, challenger.id)) {
        continue;
      }

      candidates.push({
        id: `jab-title-${championship.id}-${challenger.id}`,
        authorId: challenger.id,
        authorName: challenger.name,
        targetId: champion.id,
        targetName: champion.name,
        jab: pickLine(`jab-title-${championship.id}-${challenger.id}`, [
          `${champion.name} holding ${championship.name} like nobody else is on the roster.`,
          `title scene getting boring. ${champion.name}, pick a real challenger.`,
          `${champion.name} keeps ducking fresh matchups and calling it reign.`,
          `everyone wants ${championship.name}. ${champion.name} just posts through it.`,
        ]),
        intentLabel: "TITLE BAIT",
        tone: "title",
        priority: 78 + Math.min(challenger.momentum, 10),
      });
    }
  }

  return candidates;
}

function buildRosterTensionJabs(game: GameState, seasonNumber: number, weekNumber: number): WrestlerJabCandidate[] {
  const candidates: WrestlerJabCandidate[] = [];
  const roster = game.wrestlers.filter((wrestler) => wrestler.injuryStatus !== "major");

  if (roster.length < 2) {
    return candidates;
  }

  const underused = roster
    .filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Underused"))
    .sort((left, right) => getWeeksSinceLastBooked(right, game.currentWeek) - getWeeksSinceLastBooked(left, game.currentWeek))[0];
  const spotlight = roster
    .filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes("Overused") || wrestler.momentum >= 70)
    .sort((left, right) => right.momentum - left.momentum)[0];

  if (underused && spotlight && underused.id !== spotlight.id && !pairHasActiveRivalry(game, underused.id, spotlight.id)) {
    candidates.push({
      id: `jab-tv-${underused.id}-${spotlight.id}`,
      authorId: underused.id,
      authorName: underused.name,
      targetId: spotlight.id,
      targetName: spotlight.name,
      jab: pickLine(`jab-tv-${underused.id}-${spotlight.id}`, [
        `${spotlight.name} gets every week and still tweets like they're hungry.`,
        `creative finds time for ${spotlight.name} every show. funny how that works.`,
        `${spotlight.name} wants the whole card? come get my spot then.`,
        `been off TV while ${spotlight.name} collects reps. say that part out loud.`,
      ]),
      intentLabel: "RIVALRY BAIT",
      tone: "petty",
      priority: 64 + Math.min(getWeeksSinceLastBooked(underused, game.currentWeek), 8),
    });
  }

  const sorted = [...roster].sort((left, right) => right.momentum - left.momentum || right.popularity - left.popularity);
  const hot = sorted[0];
  const cold = sorted.at(-1);

  if (hot && cold && hot.id !== cold.id && !pairHasActiveRivalry(game, hot.id, cold.id)) {
    candidates.push({
      id: `jab-momentum-${seasonNumber}-${weekNumber}-${hot.id}-${cold.id}`,
      authorId: hot.id,
      authorName: hot.name,
      targetId: cold.id,
      targetName: cold.name,
      jab: pickLine(`jab-momentum-${hot.id}-${cold.id}`, [
        `${cold.name} tweeting like momentum is a group project.`,
        `${cold.name} wants a push off vibes. i want a reason to answer.`,
        `timeline sleeping on ${cold.name}? not my problem, but the room hears it.`,
        `${cold.name} keeps asking for heat without earning the shot.`,
      ]),
      intentLabel: "CALL OUT",
      tone: "petty",
      priority: 58 + Math.min(hot.momentum - cold.momentum, 12),
    });
  }

  return candidates;
}

function dedupeJabCandidates(candidates: WrestlerJabCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.authorId}->${candidate.targetId}:${candidate.jab.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getWrestlerJabFeed(game: GameState, limit = 8): WrestlerJabFeedSnapshot | undefined {
  if (game.wrestlers.length < 2) {
    return undefined;
  }

  const { seasonNumber, weekNumber } = getResolvedSocialWeek(game);
  const result = game.showHistory.find((show) => show.seasonNumber === seasonNumber && show.week === weekNumber);
  const candidates = dedupeJabCandidates([
    ...game.rivalries.flatMap((rivalry) => buildRivalryJabs(game, rivalry)),
    ...(result?.segmentResults.flatMap((segment) => buildShowSegmentJabs(game, segment, result)) ?? []),
    ...buildChampionJabs(game),
    ...buildRosterTensionJabs(game, seasonNumber, weekNumber),
  ]);

  const items = candidates
    .sort((left, right) => right.priority - left.priority || left.authorName.localeCompare(right.authorName))
    .slice(0, limit);

  if (!items.length) {
    return undefined;
  }

  return {
    weekLabel: `Season ${seasonNumber} · Week ${weekNumber}`,
    detail: "Roster callouts trying to spark heat. Social shots only — not a booking forecast.",
    items: items.map(({ priority: _priority, ...item }) => item),
  };
}

type SuperstarMailCandidate = SuperstarMailItem & {
  priority: number;
};

function getRecentSocialResults(game: GameState, weeks = 2) {
  const latestWeek = game.showHistory.at(-1)?.week ?? Math.max(1, game.currentWeek - 1);
  return game.showHistory.filter(
    (result) => result.seasonNumber === game.seasonNumber && result.week >= Math.max(1, latestWeek - weeks + 1),
  );
}

function wasWrestlerBookedInResults(wrestlerId: string, game: GameState, weeks = 2) {
  return getRecentSocialResults(game, weeks).some((result) =>
    result.segmentResults.some((segment) => segment.participantIds.includes(wrestlerId)),
  );
}

function wasChampionshipRepresentedRecently(championshipId: string, game: GameState, weeks = 2) {
  return getRecentSocialResults(game, weeks).some((result) =>
    result.segmentResults.some((segment) => segment.championshipId === championshipId),
  );
}

function wasRivalryRepresentedRecently(rivalryId: string, game: GameState, weeks = 1) {
  return getRecentSocialResults(game, weeks).some((result) =>
    result.segmentResults.some((segment) => segment.rivalryId === rivalryId),
  );
}

function getRecentMomentumDelta(wrestlerId: string, game: GameState, weeks = 2) {
  return getRecentSocialResults(game, weeks).reduce((total, result) => {
    return (
      total +
      result.segmentResults.reduce((segmentTotal, segment) => {
        return segmentTotal + (segment.momentumChanges?.[wrestlerId] ?? 0);
      }, 0)
    );
  }, 0);
}

function hasWinningSeasonCase(wrestler: Wrestler) {
  const record = wrestler.record?.season;
  return Boolean(record && record.wins + record.tagWins > record.losses + record.tagLosses);
}

function isHighValueMailTalent(wrestler: Wrestler, game: GameState) {
  const tier = wrestler.roleTier?.toLowerCase() ?? "";
  return (
    tier.includes("main") ||
    tier.includes("star") ||
    wrestler.popularity >= 72 ||
    wrestler.momentum >= 70 ||
    game.championships.some((championship) => championship.championIds.includes(wrestler.id) || (championship.contenderIds ?? []).includes(wrestler.id)) ||
    game.rivalries.some((rivalry) => rivalry.participantIds.includes(wrestler.id) && rivalry.heat >= 68 && rivalry.status !== "stale")
  );
}

function getStaleChampionTitle(wrestler: Wrestler, game: GameState) {
  return game.championships.find((championship) => {
    if (!championship.championIds.includes(wrestler.id)) {
      return false;
    }

    const weeksAsChampion = Math.max(0, game.currentWeek - championship.reignStartWeek);
    return (
      championship.defenses === 0 ||
      weeksAsChampion >= (championship.minimumDefenseFrequencyWeeks ?? 4) ||
      (!wasChampionshipRepresentedRecently(championship.id, game, 2) && !wasWrestlerBookedInResults(wrestler.id, game, 2))
    );
  });
}

function getTitleShotCase(wrestler: Wrestler, game: GameState) {
  return game.championships.find((championship) => {
    if (championship.eligibleMatchScope === "tag_team" || championship.division === "Tag Team" || championship.championIds.includes(wrestler.id)) {
      return false;
    }

    const listedContender = (championship.contenderIds ?? []).includes(wrestler.id);
    const statsCase =
      (wrestler.momentum >= 76 && wrestler.popularity >= 70) ||
      (wrestler.momentum >= 70 && wrestler.popularity >= 76);
    const hasCurrentCase = listedContender || hasWinningSeasonCase(wrestler) || getRecentMomentumDelta(wrestler.id, game, 2) >= 4;
    const recentlyGotTitleMatch = getRecentSocialResults(game, 3).some((result) =>
      result.segmentResults.some((segment) => segment.championshipId === championship.id && segment.participantIds.includes(wrestler.id)),
    );

    return (
      championship.championIds.length === 1 &&
      wrestlerFitsChampionshipDivision(wrestler, championship) &&
      !recentlyGotTitleMatch &&
      hasCurrentCase &&
      (listedContender || statsCase)
    );
  });
}

function getRivalryMailForWrestler(wrestler: Wrestler, game: GameState) {
  const eligibleRivalries = game.rivalries.filter(
    (rivalry) =>
      rivalry.participantIds.includes(wrestler.id) &&
      rivalry.status !== "stale" &&
      rivalry.heat >= 72 &&
      !wasRivalryRepresentedRecently(rivalry.id, game, 1),
  );

  return eligibleRivalries.find((rivalry) => {
    const voice = [...rivalry.participantIds]
      .map((id) => game.wrestlers.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is Wrestler => Boolean(candidate))
      .sort(
        (a, b) =>
          b.momentum + b.popularity + getRecentMomentumDelta(b.id, game, 2) * 3 -
            (a.momentum + a.popularity + getRecentMomentumDelta(a.id, game, 2) * 3) ||
          a.name.localeCompare(b.name),
      )[0];

    return voice?.id === wrestler.id;
  });
}

function buildSuperstarMailCandidate(wrestler: Wrestler, game: GameState): SuperstarMailCandidate | undefined {
  if (wrestler.injuryStatus === "major") {
    return undefined;
  }

  const tags = getRosterPressureTags(wrestler, game.currentWeek);
  const weeksSinceBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const activeRivalry = getRivalryMailForWrestler(wrestler, game);
  const staleChampionTitle = getStaleChampionTitle(wrestler, game);
  const titleShotCase = getTitleShotCase(wrestler, game);
  const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= game.currentWeek && !week.completed);

  if (wrestler.injuryStatus === "minor") {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-injury`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "MEDICAL REST ASK",
        preview: pickLine(`mail-${wrestler.id}-minor`, [
          "I'm banged up. Give me a light week before you put me back in harm's way.",
          "The injury is manageable, but I shouldn't be asked to carry another heavy spot yet.",
          "I can fight through it, but I need protection before the room starts treating me as disposable.",
        ]),
        askLabel: "Rest",
        tone: "urgent",
        priority: 92,
      },
      [
        "I'm not asking to disappear — I need one week where the card doesn't treat the injury like background noise.",
        "Book me lighter and I'll be ready when the next important beat actually needs me.",
        "One protected week now keeps me from becoming a liability when the office needs a bigger spot.",
      ],
    );
  }

  if (tags.includes("Underused") && weeksSinceBooked >= 3 && isHighValueMailTalent(wrestler, game)) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-tv`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "NEED TV TIME",
        preview: pickLine(`mail-${wrestler.id}-underused`, [
          `I've been off TV for ${weeksSinceBooked} weeks. Put me on the card before the locker room reads this as a demotion.`,
          "Creative has gone quiet on me. I need a spot next week with actual purpose.",
          "I'm not asking for a push, I'm asking for visibility before momentum disappears.",
        ]),
        askLabel: "TV Time",
        tone: weeksSinceBooked >= 4 ? "urgent" : "firm",
        priority: 88 + Math.min(weeksSinceBooked, 4),
      },
      [
        "Even a defined mid-card role beats sitting invisible while everyone else builds heat.",
        "Give me one segment with a point and I'll stop the room from reading this as a freeze-out.",
        "Visibility next week keeps morale from becoming the next problem on your desk.",
      ],
    );
  }

  if (tags.includes("Overused") && wrestler.fatigue >= 75) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-protection`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "PROTECTION REQUEST",
        preview: pickLine(`mail-${wrestler.id}-overused-heavy`, [
          `Fatigue is at ${wrestler.fatigue}. I can go again, but not as another heavy usage week without rest.`,
          "I'm not refusing work. I'm telling you another hard week is how you burn trust and stamina at the same time.",
          "Book me lighter next week or the room will think protection only applies to the people you already favor.",
        ]),
        askLabel: "Protection",
        tone: "urgent",
        priority: 90,
      },
      [
        "Use me in a lighter role or keep me off one beat — just don't ask me to carry another full load while I'm running this hot.",
        "The locker room notices when stars get protected and workhorses get run into the ground.",
        "One smart usage week now is cheaper than losing me to fatigue or morale later.",
      ],
    );
  }

  if (tags.includes("Overused")) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-usage`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "LIGHTER WEEK ASK",
        preview: pickLine(`mail-${wrestler.id}-overused`, [
          "I've been on too many consecutive cards. Give me a lighter week before the usage becomes a morale problem.",
          "The streak is showing. I need a breather before the next angle asks me to carry the whole block.",
          "Use me smart next week, not just often.",
        ]),
        askLabel: "Usage",
        tone: "firm",
        priority: 78,
      },
      [
        "I'm not asking to vanish from the card — I need one week where I'm not carrying another heavy beat before fatigue and morale both slide.",
        "Book me with intent instead of volume and I'll stay ready for the next story that actually matters.",
        "A lighter week now keeps me from becoming the next usage warning on your desk.",
      ],
    );
  }

  if (tags.includes("Morale Risk")) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-morale`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "CREATIVE MEETING REQUEST",
        preview: pickLine(`mail-${wrestler.id}-morale`, [
          "Morale is sliding and I need a clear plan before frustration goes public.",
          "I'm not happy with where my role is heading. Put me in the next booking conversation.",
          "Give me something to believe in next week or the locker room will hear about it.",
        ]),
        askLabel: "Morale",
        tone: "urgent",
        priority: 74,
      },
      [
        "Tell me where I fit on the next card before the room starts filling in the blanks for me.",
        "One clear direction next week is enough to keep this from turning into a public problem.",
        "I'm still willing to work — I just need the office to show me the plan instead of guessing.",
      ],
    );
  }

  if (activeRivalry) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-rivalry`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "PAYOFF SEGMENT REQUEST",
        preview: pickLine(`mail-${wrestler.id}-rivalry`, [
          `${activeRivalry.name} has real heat. Don't waste it on a throwaway angle next week.`,
          "The feud is hot enough to main-event a segment. Use it before the room cools off.",
          "I want the next beat in this story to matter, not just fill time.",
        ]),
        askLabel: "Story",
        tone: activeRivalry.heat >= 80 ? "urgent" : "firm",
        priority: 70 + Math.min(activeRivalry.heat / 10, 8),
      },
      [
        "Book the next segment like the crowd already cares, because they do.",
        "If this story gets a real payoff beat next week, the whole card feels bigger.",
        "Don't let this feud cool off on a filler angle when the heat is already there.",
      ],
    );
  }

  if (staleChampionTitle) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-title`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "TITLE DEFENSE BOOKING",
        preview: pickLine(`mail-${wrestler.id}-champion`, [
          "The belt needs visibility. Book a defense before the division goes quiet.",
          "Champions don't stay champions on the bench. Put the title back on the card.",
          "I'll defend it anywhere, but I need the office to actually book the scene.",
        ]),
        askLabel: "Title",
        tone: "firm",
        priority: 68,
      },
      [
        "A visible defense next week keeps the division from looking stalled while I'm holding the title.",
        "Put the championship back on the card and I'll make the scene feel worth the spotlight.",
        "The belt loses prestige every week it stays off TV — book the defense before that happens.",
      ],
    );
  }

  if (titleShotCase) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-title-shot`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "TITLE SHOT CASE",
        preview: pickLine(`mail-${wrestler.id}-title-shot`, [
          "The numbers say I belong in the title scene. Put me in that lane.",
          "I'm carrying enough heat to chase the belt. Give me the match that proves it.",
          "If the division is serious, my name should be across from the champion.",
        ]),
        askLabel: "Title Shot",
        tone: wrestler.momentum >= 82 || wrestler.popularity >= 82 ? "urgent" : "firm",
        priority: 76 + Math.min(12, Math.floor((wrestler.momentum + wrestler.popularity) / 18)),
      },
      [
        "I'm not asking for a random favor — the stats say I'm in the title conversation.",
        "Put me across from the champion or the right contender and let the card prove where I stand.",
        "If the division has a lane open, I should be fighting for it now.",
      ],
    );
  }

  if (wrestler.momentum >= 78 && wrestler.popularity >= 72 && getRecentMomentumDelta(wrestler.id, game, 2) >= 4) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-push`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "MAIN EVENT PUSH",
        preview: pickLine(`mail-${wrestler.id}-push`, [
          "The momentum is there. Use me in a headline spot before it flattens out.",
          "I'm running hot and the brand should capitalize next week, not stall.",
          "Give me the spot that matches the buzz I'm carrying.",
        ]),
        askLabel: "Push",
        tone: wrestler.momentum >= 86 || wrestler.popularity >= 82 ? "urgent" : "firm",
        priority: 62 + Math.min(Math.floor(wrestler.momentum / 10), 6),
      },
      [
        "The room can feel when someone's rising — give me a spot that matches that energy.",
        "Use the momentum now and the brand gets a main-event feel without forcing it later.",
        "I'm ready for a headline role if the card has one worth putting me in.",
      ],
    );
  }

  if (
    nextPle &&
    nextPle.weekNumber - game.currentWeek <= 2 &&
    wrestler.momentum >= 78 &&
    wrestler.popularity >= 70 &&
    (activeRivalry || titleShotCase || isHighValueMailTalent(wrestler, game) || getRecentMomentumDelta(wrestler.id, game, 2) >= 4)
  ) {
    return finalizeSuperstarMail(
      {
        id: `mail-${wrestler.id}-ple`,
        wrestlerId: wrestler.id,
        wrestlerName: wrestler.name,
        subject: "PLE SPOT REQUEST",
        preview: pickLine(`mail-${wrestler.id}-ple`, [
          `${nextPle.showName} is close. I want a meaningful role on that card.`,
          "If there's a PLE lane opening, put my name in the conversation now.",
          "Don't leave me off the major-event board when the timing is this tight.",
        ]),
        askLabel: "PLE Spot",
        tone: "firm",
        priority: 68,
      },
      [
        "Major events are where careers move — I want a lane on that card if the story supports it.",
        "Put me in the PLE conversation now so the build actually has time to matter.",
        "If there's a spot worth fighting for on that show, I want my name in the room.",
      ],
    );
  }

  return undefined;
}

function getSuperstarMailLimit(candidates: SuperstarMailCandidate[], hardLimit: number) {
  const urgentCount = candidates.filter((item) => item.tone === "urgent").length;
  const topPriority = candidates[0]?.priority ?? 0;

  if (!candidates.length) {
    return 0;
  }

  if (urgentCount >= 2 || topPriority >= 90) {
    return Math.min(3, hardLimit);
  }

  if (urgentCount === 1 || topPriority >= 78) {
    return Math.min(2, hardLimit);
  }

  return 1;
}

function selectSuperstarMailItems(candidates: SuperstarMailCandidate[], hardLimit: number) {
  const limit = getSuperstarMailLimit(candidates, hardLimit);
  const selected: SuperstarMailCandidate[] = [];
  const selectedLabels = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }

    if (selectedLabels.has(candidate.askLabel) && candidates.some((item) => !selected.includes(item) && !selectedLabels.has(item.askLabel))) {
      continue;
    }

    selected.push(candidate);
    selectedLabels.add(candidate.askLabel);
  }

  if (selected.length < limit) {
    for (const candidate of candidates) {
      if (selected.length >= limit) {
        break;
      }

      if (!selected.includes(candidate)) {
        selected.push(candidate);
      }
    }
  }

  return selected;
}

export function getSuperstarMailSnapshot(game: GameState, limit = 3): SuperstarMailSnapshot | undefined {
  if (!game.wrestlers.length) {
    return undefined;
  }

  const latestResult = game.showHistory.at(-1);
  const weekNumber = latestResult?.week ?? Math.max(1, game.currentWeek - 1);
  const seasonNumber = latestResult?.seasonNumber ?? game.seasonNumber;
  const prioritized = game.wrestlers
    .map((wrestler) => buildSuperstarMailCandidate(wrestler, game))
    .filter((candidate): candidate is SuperstarMailCandidate => Boolean(candidate))
    .sort((a, b) => b.priority - a.priority || a.wrestlerName.localeCompare(b.wrestlerName));

  const items = selectSuperstarMailItems(prioritized, limit);

  return {
    weekLabel: `Season ${seasonNumber} · Week ${weekNumber} · Inbox`,
    detail: items.length
      ? "Direct asks from firm or urgent roster pressure. Accepting tracks a promise — nothing is booked for you."
      : "No active asks. The room is quiet enough that no one needs the GM desk this week.",
    unreadCount: items.length,
    items: items.map(({ priority: _priority, ...item }) => item),
  };
}
