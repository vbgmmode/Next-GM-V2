import type { GameState, ShowResult, SocialCategory, SocialPost, SocialTone } from "./types";
import { getSegmentCatalogOption } from "./matchFormatCatalog";
import { getRosterPressureTags, getWeeksSinceLastBooked, type RosterPressureTag } from "./rosterContextReads";
import { getRivalryRelationship, getRivalryStoryline } from "./rivalryCatalog";
import { getStipulationById, getStipulationCostForShow } from "./stipulationCatalog";

type AiCommentaryPostInput = {
  author?: unknown;
  category?: unknown;
  tone?: unknown;
  text?: unknown;
  relatedWrestlerNames?: unknown;
};

type AiCommentaryResponse = {
  posts?: unknown;
  commentary?: unknown;
  output_text?: unknown;
  text?: unknown;
};

const AI_COMMENTARY_TIMEOUT_MS = 10000;
const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
const SOCIAL_CATEGORIES: SocialCategory[] = [
  "fan_praise",
  "push_complaint",
  "title_scene",
  "rivalry_heat",
  "viral_moment",
  "dirt_sheet",
  "analyst_take",
  "fatigue_concern",
  "ple_reaction",
];
const SOCIAL_TONES: SocialTone[] = ["excited", "angry", "skeptical", "impressed", "chaotic", "analytical"];

function getAiCommentaryEndpoint() {
  return import.meta.env.VITE_AI_COMMENTARY_ENDPOINT?.trim();
}

function getDeepSeekApiKey() {
  return import.meta.env.VITE_DEEPSEEK_API_KEY?.trim();
}

function getDeepSeekBaseUrl() {
  return (import.meta.env.VITE_DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL).replace(/\/$/, "");
}

function getDeepSeekModel() {
  return import.meta.env.VITE_DEEPSEEK_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL;
}

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 420) : fallback;
}

function normalizeCategory(value: unknown): SocialCategory {
  return typeof value === "string" && SOCIAL_CATEGORIES.includes(value as SocialCategory) ? (value as SocialCategory) : "dirt_sheet";
}

function normalizeTone(value: unknown): SocialTone {
  return typeof value === "string" && SOCIAL_TONES.includes(value as SocialTone) ? (value as SocialTone) : "skeptical";
}

function parseJsonFromText(value: string) {
  try {
    return JSON.parse(value) as AiCommentaryResponse;
  } catch {
    const jsonMatch = value.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { commentary: [value] };
    }

    try {
      return JSON.parse(jsonMatch[0]) as AiCommentaryResponse;
    } catch {
      return { commentary: [value] };
    }
  }
}

function normalizeAiResponse(value: unknown): AiCommentaryResponse {
  if (typeof value === "string") {
    return parseJsonFromText(value);
  }

  if (value && typeof value === "object") {
    const response = value as AiCommentaryResponse;

    if (typeof response.output_text === "string") {
      return parseJsonFromText(response.output_text);
    }

    if (typeof response.text === "string") {
      return parseJsonFromText(response.text);
    }

    return response;
  }

  return {};
}

function getPostInputs(response: AiCommentaryResponse): AiCommentaryPostInput[] {
  if (Array.isArray(response.posts)) {
    return response.posts.filter((item): item is AiCommentaryPostInput => Boolean(item && typeof item === "object"));
  }

  if (Array.isArray(response.commentary)) {
    return response.commentary.map((text) => ({ text, category: "dirt_sheet", tone: "skeptical", author: "IWC AI Desk" }));
  }

  return [];
}

function getRelatedWrestlerIds(names: unknown, game: GameState) {
  if (!Array.isArray(names)) {
    return [];
  }

  return names
    .map((name) => (typeof name === "string" ? name.trim().toLowerCase() : ""))
    .map((name) => game.wrestlers.find((wrestler) => wrestler.name.toLowerCase() === name)?.id)
    .filter((id): id is string => Boolean(id));
}

function getAiWrestlerSnapshot(wrestlerId: string, game: GameState) {
  const wrestler = game.wrestlers.find((item) => item.id === wrestlerId);

  if (!wrestler) {
    return undefined;
  }

  return {
    id: wrestler.id,
    name: wrestler.name,
    roleTier: wrestler.roleTier,
    alignment: wrestler.alignment,
    archetype: wrestler.archetype,
    wrestlingStyle: wrestler.wrestlingStyle,
    promoStyle: wrestler.promoStyle,
    presentationHook: wrestler.presentationHook,
    division: wrestler.division,
    popularity: wrestler.popularity,
    momentum: wrestler.momentum,
    fatigue: wrestler.fatigue,
    morale: wrestler.morale,
    injuryStatus: wrestler.injuryStatus,
    injuryDescription: wrestler.injuryDescription,
    appearancesThisSeason: wrestler.appearancesThisSeason,
    consecutiveWeeksBooked: wrestler.consecutiveWeeksBooked,
  };
}

function getAiRivalryContext(rivalryId: string | undefined, game: GameState) {
  const rivalry = rivalryId ? game.rivalries.find((item) => item.id === rivalryId) : undefined;

  if (!rivalry) {
    return undefined;
  }

  const storyline = getRivalryStoryline(rivalry);
  const relationship = getRivalryRelationship(rivalry);

  return {
    id: rivalry.id,
    name: rivalry.name,
    heat: rivalry.heat,
    freshness: rivalry.freshness,
    status: rivalry.status,
    stakes: rivalry.stakes,
    structure: rivalry.structure ?? "singles",
    weeksActive: rivalry.weeksActive,
    storyline: {
      id: storyline.id,
      name: storyline.name,
      description: storyline.description,
      commonBeats: storyline.commonBeats,
      recommendedBlowoffMatches: storyline.recommendedBlowoffMatches,
      bookingNotes: storyline.bookingNotes,
    },
    relationship: {
      tag: relationship.tag,
      name: relationship.name,
      description: relationship.description,
    },
  };
}

function getAiChampionshipContext(championshipId: string | undefined, game: GameState) {
  const championship = championshipId ? game.championships.find((item) => item.id === championshipId) : undefined;

  if (!championship) {
    return undefined;
  }

  return {
    id: championship.id,
    name: championship.name,
    division: championship.division,
    prestige: championship.prestige,
    championNames: championship.championIds
      .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name)
      .filter(Boolean),
    defenses: championship.defenses,
    titleLevel: championship.titleLevel,
    titleType: championship.titleType,
    prestigeTier: championship.prestigeTier,
  };
}

function getAiStipulationContext(stipulationId: string | undefined, showType: ShowResult["showType"]) {
  const stipulation = getStipulationById(stipulationId);

  if (!stipulation) {
    return undefined;
  }

  return {
    id: stipulation.id,
    label: stipulation.label,
    description: stipulation.description,
    riskContext: stipulation.riskContext,
    presentationalContext: stipulation.presentationalContext,
    rivalryTone: stipulation.rivalryTone,
    specialtyProductionCost: getStipulationCostForShow(stipulation.id, showType),
  };
}

function getAiFinanceContext(result: ShowResult, game: GameState) {
  const report = game.financeReports.find((item) => item.seasonNumber === result.seasonNumber && item.weekNumber === result.week);

  if (!report) {
    return undefined;
  }

  return {
    profitLoss: report.profitLoss,
    endingMoney: report.endingMoney,
    grossRevenue: report.grossRevenue,
    totalExpenses: report.totalExpenses,
    productionCost: report.productionCost,
    segmentProductionCost: report.segmentProductionCost,
    stipulationProductionCost: report.stipulationProductionCost,
    bookedFinishCost: report.bookedFinishCost,
    overrunCost: report.overrunCost,
    notes: report.notes.slice(0, 5),
    expenseBreakdown: report.expenseBreakdown,
    revenueBreakdown: report.revenueBreakdown,
  };
}

function getAiRosterPressureContext(result: ShowResult, game: GameState) {
  const bookedIds = new Set(result.segmentResults.flatMap((segment) => segment.participantIds));
  const toRosterRead = (wrestlerId: string) => {
    const wrestler = game.wrestlers.find((item) => item.id === wrestlerId);

    if (!wrestler) {
      return undefined;
    }

    return {
      name: wrestler.name,
      roleTier: wrestler.roleTier,
      alignment: wrestler.alignment,
      division: wrestler.division,
      popularity: wrestler.popularity,
      momentum: wrestler.momentum,
      fatigue: wrestler.fatigue,
      morale: wrestler.morale,
      injuryStatus: wrestler.injuryStatus,
      weeksSinceLastBooked: getWeeksSinceLastBooked(wrestler, game.currentWeek),
      consecutiveWeeksBooked: wrestler.consecutiveWeeksBooked ?? 0,
      wasOnResolvedCard: bookedIds.has(wrestler.id),
      pressureTags: getRosterPressureTags(wrestler, game.currentWeek),
    };
  };
  const byTag = (tag: RosterPressureTag) =>
    game.wrestlers
      .filter((wrestler) => getRosterPressureTags(wrestler, game.currentWeek).includes(tag))
      .sort((left, right) => {
        if (tag === "Underused") {
          return (
            getWeeksSinceLastBooked(right, game.currentWeek) * 10 +
            right.popularity +
            right.momentum -
            (getWeeksSinceLastBooked(left, game.currentWeek) * 10 + left.popularity + left.momentum)
          );
        }

        return right.fatigue + (right.consecutiveWeeksBooked ?? 0) * 8 + right.popularity - (left.fatigue + (left.consecutiveWeeksBooked ?? 0) * 8 + left.popularity);
      })
      .slice(0, 5)
      .map((wrestler) => toRosterRead(wrestler.id))
      .filter(Boolean);
  const offCardNotables = game.wrestlers
    .filter((wrestler) => !bookedIds.has(wrestler.id) && (wrestler.popularity >= 70 || wrestler.momentum >= 65 || getWeeksSinceLastBooked(wrestler, game.currentWeek) >= 2))
    .sort(
      (left, right) =>
        getWeeksSinceLastBooked(right, game.currentWeek) * 10 +
        right.popularity +
        right.momentum -
        (getWeeksSinceLastBooked(left, game.currentWeek) * 10 + left.popularity + left.momentum),
    )
    .slice(0, 6)
    .map((wrestler) => toRosterRead(wrestler.id))
    .filter(Boolean);

  return {
    note: "These are resolved post-show roster reads. Use them as fan discourse material, not as predictions or hidden booking instructions.",
    bookedNames: [...bookedIds]
      .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name)
      .filter(Boolean),
    offCardNotables,
    overused: byTag("Overused"),
    underused: byTag("Underused"),
    protectedStars: byTag("Protected Star"),
    moraleRisks: byTag("Morale Risk"),
    injuryRisks: byTag("Injury Risk"),
  };
}

export function buildAiPromptPayload(result: ShowResult, game: GameState) {
  const sameWeekSocialPosts = game.socialPosts.filter((post) => post.seasonNumber === result.seasonNumber && post.weekNumber === result.week);

  return {
    task: "next-gm-social-commentary-v2",
    instructions:
      "Generate fictional in-universe Social/IWC commentary for a wrestling GM game. Use only the resolved facts in this payload. Keep it retrospective. Do not predict future outcomes, reveal hidden mechanics, mention real AI, or add new gameplay facts. Use enriched segment, stipulation, rivalry, title, finance, roster-pressure, and existing-feed context to find sharp angles, but do not repeat the existing deterministic posts verbatim. Stipulation costs are visible production costs, not secret penalties. Roster pressure can include who was off the card, who has not been booked recently, who looks overpushed or overused, morale risk, injury risk, and protected stars. Make the posts sound like exaggerated wrestling internet discourse: hot takes, tribal arguments, overreactions, rumor-board energy, armchair booking complaints, dramatic praise, and fans over-indexing on receipts. Be sharper and less corporate than a recap, but do not use slurs, protected-class insults, real-world harassment, sexual content, or threats. Rumors must be framed as fan speculation about resolved facts, not new canon. Return JSON only: {\"posts\":[{\"author\":\"...\",\"category\":\"dirt_sheet|analyst_take|fan_praise|push_complaint|title_scene|rivalry_heat|viral_moment|fatigue_concern|ple_reaction\",\"tone\":\"excited|angry|skeptical|impressed|chaotic|analytical\",\"text\":\"...\",\"relatedWrestlerNames\":[\"...\"]}]} with 2 to 4 posts.",
    show: {
      brandName: result.brandName,
      showName: result.showName,
      showType: result.showType,
      seasonNumber: result.seasonNumber,
      weekNumber: result.week,
      score: result.totalScore,
      plannedRuntimeMinutes: result.plannedRuntimeMinutes,
      actualRuntimeMinutes: result.actualRuntimeMinutes,
      broadcastOverrunNotes: result.broadcastOverrunNotes ?? [],
    },
    resolvedFacts: {
      bestMomentumGain: result.biggestMomentumGain,
      biggestFatigueIncrease: result.biggestFatigueIncrease,
      titleNotes: result.titleNotes,
      rivalryNotes: result.rivalryNotes,
      lockerRoomFallout: result.lockerRoomFallout,
      injuryRecoveryNotes: game.injuryRecoveryNotes.slice(-4),
      finance: getAiFinanceContext(result, game),
      rosterPressure: getAiRosterPressureContext(result, game),
      existingSocialFeed: sameWeekSocialPosts.slice(0, 8).map((post) => ({
        author: post.author,
        category: post.category,
        tone: post.tone,
        text: post.text,
        relatedWrestlerNames: post.relatedWrestlerIds
          .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name)
          .filter(Boolean),
      })),
    },
    segments: result.segmentResults.map((segment, index) => ({
      slot: index + 1,
      type: segment.type,
      format: segment.segmentCatalogId ? getSegmentCatalogOption(segment)?.label : undefined,
      score: segment.score,
      participants: segment.participantNames,
      participantSnapshots: segment.participantIds
        .map((id) => getAiWrestlerSnapshot(id, game))
        .filter(Boolean),
      winnerName: segment.winnerId ? game.wrestlers.find((wrestler) => wrestler.id === segment.winnerId)?.name : undefined,
      momentumChanges: segment.momentumChanges,
      fatigueChanges: segment.fatigueChanges,
      stipulation: getAiStipulationContext(segment.stipulationId, result.showType),
      championship: getAiChampionshipContext(segment.championshipId, game),
      rivalry: getAiRivalryContext(segment.rivalryId, game),
      titleNote: segment.titleNote,
      rivalryNote: segment.rivalryNote,
      recapNote: segment.recapNote,
      resolvedOpponentName: segment.resolvedOpponentName,
      isNoContest: segment.isNoContest,
    })),
  };
}

function buildDeepSeekRequestBody(result: ShowResult, game: GameState) {
  const payload = buildAiPromptPayload(result, game);

  return {
    model: getDeepSeekModel(),
    messages: [
      {
        role: "system",
        content:
          "You are the Social/IWC commentary desk for Next GM, a fictional wrestling GM game. Return JSON only. Use only resolved facts provided by the user. Write like exaggerated wrestling internet discourse: hot takes, overreactions, rumor-board speculation, armchair booking complaints, dramatic praise, and fans arguing like the show personally attacked them. Use enriched resolved context for specificity, especially stipulations, rivalry premises, title stakes, fatigue, finance receipts, underused talent, off-card notable names, overused or overpushed wrestlers, and locker-room pressure. Do not predict outcomes, invent injuries, invent title changes, mention real AI, reveal hidden mechanics, quote existing feed posts verbatim, or add hidden offscreen events. Do not use slurs, protected-class insults, real-world harassment, sexual content, or threats.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
    max_tokens: 650,
    stream: false,
  };
}

async function fetchAiCommentaryPayload(result: ShowResult, game: GameState, controller: AbortController) {
  const endpoint = getAiCommentaryEndpoint();

  if (endpoint) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildAiPromptPayload(result, game)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI commentary endpoint returned ${response.status}`);
    }

    return response.json() as Promise<unknown>;
  }

  const deepSeekApiKey = getDeepSeekApiKey();

  if (!deepSeekApiKey) {
    return undefined;
  }

  const response = await fetch(`${getDeepSeekBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deepSeekApiKey}`,
    },
    body: JSON.stringify(buildDeepSeekRequestBody(result, game)),
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`DeepSeek commentary returned ${response.status}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;

  return typeof content === "string" ? content : completion;
}

export async function generateExternalAiSocialCommentary(result: ShowResult, game: GameState) {
  if (!getAiCommentaryEndpoint() && !getDeepSeekApiKey()) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AI_COMMENTARY_TIMEOUT_MS);

  try {
    const payload = await fetchAiCommentaryPayload(result, game, controller);
    const rawResponse = normalizeAiResponse(payload);
    const posts = getPostInputs(rawResponse)
      .map((post, index): SocialPost | undefined => {
        const text = sanitizeText(post.text);

        if (!text) {
          return undefined;
        }

        return {
          id: `${result.id}-ai-social-${index + 1}`,
          weekNumber: result.week,
          seasonNumber: result.seasonNumber,
          showName: result.showName,
          category: normalizeCategory(post.category),
          author: sanitizeText(post.author, "IWC AI Desk").slice(0, 80),
          text,
          tone: normalizeTone(post.tone),
          relatedWrestlerIds: getRelatedWrestlerIds(post.relatedWrestlerNames, game),
          relatedRivalryIds: [],
          relatedChampionshipIds: [],
        };
      })
      .filter((post): post is SocialPost => Boolean(post));

    return posts.slice(0, 4);
  } catch (error) {
    console.warn("AI commentary unavailable.", error);
    return [];
  } finally {
    window.clearTimeout(timeoutId);
  }
}
