import { getBestSegment, getShowGrade } from "../game/scoring";
import type { GameState, SocialCategory, SocialPost, Wrestler } from "../game/types";
import type { IwcMoodSummary, IwcMoodTone, SocialFilter, SocialPostEngagement } from "./socialTypes";

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

export function formatSocialCategory(category: SocialCategory) {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatSocialTone(tone: SocialPost["tone"]) {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

export function getSocialFilterCategory(filter: SocialFilter): SocialCategory[] | null {
  if (filter === "Fan Reaction") {
    return ["fan_praise", "push_complaint", "viral_moment", "ple_reaction", "fatigue_concern"];
  }

  if (filter === "Dirt Sheets") {
    return ["dirt_sheet"];
  }

  if (filter === "Analyst Takes") {
    return ["analyst_take"];
  }

  if (filter === "Title Scene") {
    return ["title_scene"];
  }

  if (filter === "Rivalries") {
    return ["rivalry_heat"];
  }

  return null;
}

export function getSocialFilterLabel(filter: SocialFilter) {
  if (filter === "Fan Reaction") {
    return "Buzz";
  }

  if (filter === "Dirt Sheets") {
    return "Sheets";
  }

  if (filter === "Analyst Takes") {
    return "Tape";
  }

  if (filter === "Title Scene") {
    return "Titles";
  }

  if (filter === "Rivalries") {
    return "Feuds";
  }

  return "All";
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
    ? `${result.showName} closed at ${result.totalScore} (${getShowGrade(result.totalScore)}), with ${bestSegment?.participantNames.join(" / ") ?? "the card"} as the strongest resolved beat.`
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
        value: result ? `${result.totalScore} ${getShowGrade(result.totalScore)}` : "Posts Only",
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

export function getTrendingTopics(game: GameState, limit = 4) {
  const latestPost = game.socialPosts[game.socialPosts.length - 1];

  if (!latestPost) {
    return [];
  }

  const weekPosts = game.socialPosts.filter((post) => post.seasonNumber === latestPost.seasonNumber && post.weekNumber === latestPost.weekNumber);
  const categoryCounts = weekPosts.reduce<Map<SocialCategory, number>>((map, post) => {
    map.set(post.category, (map.get(post.category) ?? 0) + 1);
    return map;
  }, new Map<SocialCategory, number>());

  return [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([category, count], index) => ({
      id: category,
      rank: index + 1,
      label: formatSocialCategory(category),
      count,
    }));
}
