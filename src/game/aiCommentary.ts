import type {
  GameState,
  ShowResult,
  SocialCategory,
  SocialPost,
  SocialReactionPersona,
  SocialReactionSentiment,
  SocialReactionTriggerType,
  SocialTone,
  WrestlerSocialPost,
  SegmentAiRecap,
  WrestlerSocialPostTone,
} from "./types";
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

type AiWrestlerPostInput = {
  wrestlerName?: unknown;
  contextLabel?: unknown;
  intentLabel?: unknown;
  tone?: unknown;
  text?: unknown;
  targetName?: unknown;
};

type AiSegmentRecapInput = {
  slot?: unknown;
  text?: unknown;
};

type AiCommentaryResponse = {
  posts?: unknown;
  wrestlerPosts?: unknown;
  segmentRecaps?: unknown;
  commentary?: unknown;
  output_text?: unknown;
  text?: unknown;
};

export type ExternalAiSocialContent = {
  fanPosts: SocialPost[];
  wrestlerPosts: WrestlerSocialPost[];
  segmentRecaps: SegmentAiRecap[];
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
const WRESTLER_SOCIAL_TONES: WrestlerSocialPostTone[] = ["heated", "petty", "challenge", "title", "mood", "pressure"];

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

function normalizeWrestlerTone(value: unknown): WrestlerSocialPostTone {
  return typeof value === "string" && WRESTLER_SOCIAL_TONES.includes(value as WrestlerSocialPostTone)
    ? (value as WrestlerSocialPostTone)
    : "mood";
}

function getWrestlerPostInputs(response: AiCommentaryResponse): AiWrestlerPostInput[] {
  if (!Array.isArray(response.wrestlerPosts)) {
    return [];
  }

  return response.wrestlerPosts.filter((item): item is AiWrestlerPostInput => Boolean(item && typeof item === "object"));
}

function findWrestlerByName(name: unknown, game: GameState) {
  if (typeof name !== "string") {
    return undefined;
  }

  const normalized = name.trim().toLowerCase();
  return game.wrestlers.find((wrestler) => wrestler.name.toLowerCase() === normalized);
}

function normalizeWrestlerIntentLabel(contextLabel: string, intentLabel: unknown) {
  const normalizedIntent = sanitizeText(intentLabel, "").toUpperCase();

  if (normalizedIntent) {
    return normalizedIntent.slice(0, 40);
  }

  return contextLabel ? `${contextLabel.toUpperCase()} READ`.slice(0, 40) : "STATUS READ";
}

function getAiReactionPersona(category: SocialCategory, tone: SocialTone): SocialReactionPersona {
  if (category === "push_complaint") return "burial_cop";
  if (category === "title_scene") return "agenda_pusher";
  if (category === "rivalry_heat") return tone === "skeptical" || tone === "angry" ? "let_it_play_out_skeptic" : "continuity_nerd";
  if (category === "viral_moment") return "agenda_pusher";
  if (category === "fatigue_concern") return "doomposter";
  if (category === "dirt_sheet") return "dirt_sheet";
  if (category === "analyst_take") return "workrate_nerd";
  if (category === "ple_reaction") return "meme_account";
  return "aura_poster";
}

function getAiReactionSentiment(tone: SocialTone): SocialReactionSentiment {
  if (tone === "angry" || tone === "skeptical") return "negative";
  if (tone === "chaotic") return "chaotic";
  if (tone === "analytical") return "mixed";
  return "positive";
}

function getAiReactionTrigger(category: SocialCategory): SocialReactionTriggerType {
  if (category === "title_scene") return "title_change";
  if (category === "rivalry_heat") return "rivalry_advancement";
  if (category === "viral_moment") return "fan_momentum_swing";
  if (category === "fatigue_concern") return "injury_fatigue_concern";
  if (category === "push_complaint") return "low_rated_match";
  if (category === "analyst_take") return "high_rated_match";
  if (category === "ple_reaction") return "hot_crowd";
  if (category === "dirt_sheet") return "market_move";
  return "hot_crowd";
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

function sanitizeRecapText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 220) : fallback;
}

function getSegmentRecapInputs(response: AiCommentaryResponse): AiSegmentRecapInput[] {
  if (!Array.isArray(response.segmentRecaps)) {
    return [];
  }

  return response.segmentRecaps.filter((item): item is AiSegmentRecapInput => Boolean(item && typeof item === "object"));
}

function buildSegmentAiRecaps(response: AiCommentaryResponse, result: ShowResult): SegmentAiRecap[] {
  return getSegmentRecapInputs(response)
    .map((item, index): SegmentAiRecap | undefined => {
      const slot = typeof item.slot === "number" && Number.isFinite(item.slot) ? Math.round(item.slot) : index + 1;
      const segment = result.segmentResults[slot - 1];
      const text = sanitizeRecapText(item.text);

      if (!segment || !text) {
        return undefined;
      }

      return {
        id: `${result.id}-ai-segment-recap-${segment.segmentId}`,
        weekNumber: result.week,
        seasonNumber: result.seasonNumber,
        showName: result.showName,
        resultId: result.id,
        segmentId: segment.segmentId,
        text,
      };
    })
    .filter((item): item is SegmentAiRecap => Boolean(item))
    .slice(0, result.segmentResults.length);
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
    task: "next-gm-social-commentary-v3",
    instructions:
      "Generate fictional in-universe Social/IWC commentary and broadcast segment recaps for a wrestling GM game. Use only the resolved facts in this payload. Keep it retrospective. Do not predict future outcomes, reveal hidden mechanics, mention real AI, or add new gameplay facts. Use enriched segment, stipulation, rivalry, title, finance, roster-pressure, and existing-feed context to find sharp angles, but do not repeat the existing deterministic posts verbatim. Stipulation costs are visible production costs, not secret penalties. Roster pressure can include who was off the card, who has not been booked recently, who looks overpushed or overused, morale risk, injury risk, and protected stars. Write fan posts like messy wrestling internet discourse, not a recap: first-person reactions, quote-tweet energy, agenda posting, dramatic overreactions, suspicion, jokes, tribal arguments, and fans acting like one segment changed the industry. Use contractions, fragments, rhetorical questions, and specific names. Be sharper, pettier, and more emotional than corporate analysis, while staying safe: no slurs, protected-class insults, real-world harassment, sexual content, or threats. Avoid robotic phrases like 'the office better have a plan', 'the discourse is heating up', 'roster depth is insane', or clean summary sentences. Do not cite numeric segment scores, show scores, momentum deltas, fatigue values, letter grades, or other hidden sim stats in post text. Fans react to what they saw on TV, not spreadsheet numbers. Rumors must be framed as fan speculation about resolved facts, not new canon. Also generate superstar posts in first person from booked wrestlers, champions, rivalry participants, and roster-pressure cases. Superstar posts should read like public mood/status posts, not fan discourse and not direct @ callouts. Also generate segmentRecaps: one broadcast-desk recap sentence per segment slot using resolved participants, segment type, stipulation, title, rivalry, winner, and open-challenge context when present. Segment recaps should sound like a premium TV recap line, not fan posts and not wrestler first-person voice. Return JSON only: {\"posts\":[{\"author\":\"...\",\"category\":\"dirt_sheet|analyst_take|fan_praise|push_complaint|title_scene|rivalry_heat|viral_moment|fatigue_concern|ple_reaction\",\"tone\":\"excited|angry|skeptical|impressed|chaotic|analytical\",\"text\":\"...\",\"relatedWrestlerNames\":[\"...\"]}],\"wrestlerPosts\":[{\"wrestlerName\":\"...\",\"contextLabel\":\"Rivalry mood|Title pressure|Momentum mood|TV-time pressure|Post-show receipt\",\"intentLabel\":\"MOMENTUM READ\",\"tone\":\"heated|petty|challenge|title|mood|pressure\",\"text\":\"...\",\"targetName\":\"optional rivalry/title context name\"}],\"segmentRecaps\":[{\"slot\":1,\"text\":\"...\"}]} with 2 to 4 fan posts, 3 to 6 wrestler posts, and exactly one segmentRecap per segment slot.",
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
          "You are the Social/IWC commentary desk for Next GM, a fictional wrestling GM game. Return JSON only. Use only resolved facts provided by the user. Write fan posts like messy wrestling internet discourse, not a recap: hot takes, agenda posting, quote-tweet energy, rumor-board suspicion, armchair booking complaints, dramatic praise, fandom tribalism, and people acting like the show personally attacked them. Write wrestlerPosts in first person from the named wrestler's voice as public mood/status posts about resolved fallout, rivalry mood, title pressure, momentum, TV-time pressure, or post-show receipts. Write segmentRecaps as one-sentence broadcast recap lines for each segment slot, using resolved participant names and segment context. Segment recaps must sound like premium TV desk copy, not fan posts and not wrestler first-person posts. Wrestler posts must not read like fan accounts, must not mention real AI, and should avoid direct @ callouts. Use first-person reactions, contractions, fragments, rhetorical questions, and specific names where grounded. Avoid corporate/robotic recap phrasing such as 'the office better have a plan', 'the discourse is heating up', 'roster depth is insane', or clean neutral summaries. Use enriched resolved context for specificity, especially stipulations, rivalry premises, title stakes, fatigue, finance receipts, underused talent, off-card notable names, overused or overpushed wrestlers, and locker-room pressure. Do not predict outcomes, invent injuries, invent title changes, mention real AI, reveal hidden mechanics, quote existing feed posts verbatim, or add hidden offscreen events. Do not cite numeric segment scores, show scores, momentum deltas, fatigue values, letter grades, or other hidden sim stats in post text. Do not use slurs, protected-class insults, real-world harassment, sexual content, or threats.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
    max_tokens: 1600,
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

export async function generateExternalAiSocialContent(result: ShowResult, game: GameState): Promise<ExternalAiSocialContent> {
  if (!getAiCommentaryEndpoint() && !getDeepSeekApiKey()) {
    return { fanPosts: [], wrestlerPosts: [], segmentRecaps: [] };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AI_COMMENTARY_TIMEOUT_MS);

  try {
    const payload = await fetchAiCommentaryPayload(result, game, controller);
    const rawResponse = normalizeAiResponse(payload);
    const fanPosts = getPostInputs(rawResponse)
      .map((post, index): SocialPost | undefined => {
        const text = sanitizeText(post.text);

        if (!text) {
          return undefined;
        }

        const category = normalizeCategory(post.category);
        const tone = normalizeTone(post.tone);
        const relatedWrestlerIds = getRelatedWrestlerIds(post.relatedWrestlerNames, game);

        return {
          id: `${result.id}-ai-social-${index + 1}`,
          weekNumber: result.week,
          seasonNumber: result.seasonNumber,
          showName: result.showName,
          resultId: result.id,
          sourceResultId: result.id,
          category,
          author: sanitizeText(post.author, "IWC AI Desk").slice(0, 80),
          text,
          tone,
          relatedWrestlerIds,
          relatedRivalryIds: [],
          relatedChampionshipIds: [],
          persona: getAiReactionPersona(category, tone),
          sentiment: getAiReactionSentiment(tone),
          intensity: tone === "chaotic" || tone === "angry" ? 4 : 3,
          triggerType: getAiReactionTrigger(category),
          target: relatedWrestlerIds[0]
            ? {
                type: "wrestler",
                id: relatedWrestlerIds[0],
                name: game.wrestlers.find((wrestler) => wrestler.id === relatedWrestlerIds[0])?.name ?? "Unknown",
              }
            : { type: "show", id: result.id, name: result.showName },
          tags: [category.replace("_", "-"), getAiReactionPersona(category, tone).replaceAll("_", "-")],
        };
      })
      .filter((post): post is SocialPost => Boolean(post))
      .slice(0, 4);
    const wrestlerPosts = getWrestlerPostInputs(rawResponse)
      .map((post, index): WrestlerSocialPost | undefined => {
        const author = findWrestlerByName(post.wrestlerName, game);
        const text = sanitizeText(post.text);

        if (!author || !text) {
          return undefined;
        }

        const contextLabel = sanitizeText(post.contextLabel, "Post-show receipt").slice(0, 48);
        const target = findWrestlerByName(post.targetName, game);

        return {
          id: `${result.id}-ai-wrestler-${index + 1}`,
          weekNumber: result.week,
          seasonNumber: result.seasonNumber,
          showName: result.showName,
          resultId: result.id,
          authorId: author.id,
          authorName: author.name,
          targetId: target?.id,
          targetName: target?.name,
          contextLabel,
          jab: text,
          intentLabel: normalizeWrestlerIntentLabel(contextLabel, post.intentLabel),
          tone: normalizeWrestlerTone(post.tone),
        };
      })
      .filter((post): post is WrestlerSocialPost => Boolean(post))
      .slice(0, 6);
    const segmentRecaps = buildSegmentAiRecaps(rawResponse, result);

    return { fanPosts, wrestlerPosts, segmentRecaps };
  } catch (error) {
    console.warn("AI commentary unavailable.", error);
    return { fanPosts: [], wrestlerPosts: [], segmentRecaps: [] };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function generateExternalAiSocialCommentary(result: ShowResult, game: GameState) {
  const content = await generateExternalAiSocialContent(result, game);
  return content.fanPosts;
}

export function getSegmentAiRecapNote(game: GameState, resultId: string, segmentId: string) {
  return game.segmentAiRecaps.find((recap) => recap.resultId === resultId && recap.segmentId === segmentId)?.text;
}
