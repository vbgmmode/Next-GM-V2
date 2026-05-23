import type { GameState, ShowResult, SocialCategory, SocialPost, SocialTone } from "./types";

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

function buildAiPromptPayload(result: ShowResult, game: GameState) {
  return {
    task: "next-gm-social-commentary-v1",
    instructions:
      "Generate fictional in-universe Social/IWC commentary for a wrestling GM game. Use only the resolved facts in this payload. Keep it retrospective. Do not predict future outcomes, reveal hidden mechanics, mention real AI, or add new gameplay facts. Make the posts sound like exaggerated wrestling internet discourse: hot takes, tribal arguments, overreactions, rumor-board energy, armchair booking complaints, and dramatic praise. Be sharper and less corporate than a recap, but do not use slurs, protected-class insults, real-world harassment, sexual content, or threats. Rumors must be framed as fan speculation about resolved facts, not new canon. Return JSON only: {\"posts\":[{\"author\":\"...\",\"category\":\"dirt_sheet|analyst_take|fan_praise|push_complaint|title_scene|rivalry_heat|viral_moment|fatigue_concern|ple_reaction\",\"tone\":\"excited|angry|skeptical|impressed|chaotic|analytical\",\"text\":\"...\",\"relatedWrestlerNames\":[\"...\"]}]} with 2 to 4 posts.",
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
      finance: game.financeReports.find((report) => report.seasonNumber === result.seasonNumber && report.weekNumber === result.week),
    },
    segments: result.segmentResults.map((segment, index) => ({
      slot: index + 1,
      type: segment.type,
      score: segment.score,
      participants: segment.participantNames,
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
          "You are the Social/IWC commentary desk for Next GM, a fictional wrestling GM game. Return JSON only. Use only resolved facts provided by the user. Write like exaggerated wrestling internet discourse: hot takes, overreactions, rumor-board speculation, armchair booking complaints, dramatic praise, and fans arguing like the show personally attacked them. Do not predict outcomes, invent injuries, invent title changes, mention real AI, or add hidden offscreen events. Do not use slurs, protected-class insults, real-world harassment, sexual content, or threats.",
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
