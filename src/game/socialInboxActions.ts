import { getDefaultCatalogOption } from "./matchFormatCatalog";
import { SEASON_WEEK_COUNT } from "./constants";
import type { GameState, Segment, ShowResult, SocialInboxActionType, SocialInboxRequest, SocialInboxState, Wrestler } from "./types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const tvRequestWindowWeeks = 1;

export type SocialInboxActionMeta = {
  type: SocialInboxActionType;
  label: string;
  detail: string;
};

type MailActionInput = {
  id: string;
  wrestlerId: string;
  wrestlerName: string;
  askLabel: string;
};

export function createDefaultSocialInboxState(): SocialInboxState {
  return { requests: [] };
}

export function normalizeSocialInboxState(value: unknown, wrestlers: Wrestler[] = []): SocialInboxState {
  const wrestlerIds = new Set(wrestlers.map((wrestler) => wrestler.id));
  const candidate = value as Partial<SocialInboxState>;

  if (!value || typeof value !== "object" || !Array.isArray(candidate.requests)) {
    return createDefaultSocialInboxState();
  }

  return {
    requests: candidate.requests
      .map((request): SocialInboxRequest | undefined => {
        const item = request as Partial<SocialInboxRequest>;

        if (
          typeof item.id !== "string" ||
          typeof item.mailId !== "string" ||
          typeof item.wrestlerId !== "string" ||
          (wrestlerIds.size > 0 && !wrestlerIds.has(item.wrestlerId)) ||
          (item.actionType !== "rest" && item.actionType !== "tv_time") ||
          (item.status !== "accepted" && item.status !== "fulfilled" && item.status !== "broken")
        ) {
          return undefined;
        }

        return {
          id: item.id,
          mailId: item.mailId,
          wrestlerId: item.wrestlerId,
          wrestlerName: item.wrestlerName ?? wrestlers.find((wrestler) => wrestler.id === item.wrestlerId)?.name ?? "Unknown",
          actionType: item.actionType,
          askLabel: item.askLabel ?? "",
          createdSeasonNumber: item.createdSeasonNumber ?? 1,
          createdWeekNumber: item.createdWeekNumber ?? 1,
          deadlineSeasonNumber: item.deadlineSeasonNumber ?? item.createdSeasonNumber ?? 1,
          deadlineWeekNumber: item.deadlineWeekNumber ?? item.createdWeekNumber ?? 1,
          status: item.status,
          segmentId: item.segmentId,
          resolvedSeasonNumber: item.resolvedSeasonNumber,
          resolvedWeekNumber: item.resolvedWeekNumber,
          note: item.note,
        };
      })
      .filter((request): request is SocialInboxRequest => Boolean(request)),
  };
}

export function getSuperstarMailAction(askLabel: string): SocialInboxActionMeta | undefined {
  if (askLabel === "Rest" || askLabel === "Protection" || askLabel === "Usage") {
    return {
      type: "rest",
      label: "Give Week Off",
      detail: "Removes them from the current card and protects the week as approved rest.",
    };
  }

  if (askLabel === "TV Time" || askLabel === "Role" || askLabel === "Morale" || askLabel === "Push") {
    return {
      type: "tv_time",
      label: "Give TV Time",
      detail: "Creates a solo promo on the current card and moves the desk to Booking.",
    };
  }

  return undefined;
}

export function getActiveSocialInboxRequest(game: GameState, mailId: string, wrestlerId: string) {
  return game.socialInbox.requests.find(
    (request) => request.mailId === mailId && request.wrestlerId === wrestlerId && request.status === "accepted",
  );
}

export function getProtectedRestWrestlerIds(game: GameState) {
  return new Set(
    game.socialInbox.requests
      .filter(
        (request) =>
          request.actionType === "rest" &&
          request.status === "accepted" &&
          request.createdSeasonNumber === game.seasonNumber &&
          request.createdWeekNumber === game.currentWeek,
      )
      .map((request) => request.wrestlerId),
  );
}

export function isWrestlerProtectedRest(game: GameState, wrestlerId: string) {
  return getProtectedRestWrestlerIds(game).has(wrestlerId);
}

export function hasProtectedRestParticipant(game: GameState, segment: Segment) {
  const protectedIds = getProtectedRestWrestlerIds(game);
  return segment.participantIds.some((id) => protectedIds.has(id));
}

function buildRequestId(game: GameState, item: MailActionInput, actionType: SocialInboxActionType) {
  return `social-inbox-${actionType}-s${game.seasonNumber}-w${game.currentWeek}-${item.wrestlerId}-${item.id}`;
}

function getRequestDeadline(game: GameState, actionType: SocialInboxActionType) {
  if (actionType === "rest") {
    return { deadlineSeasonNumber: game.seasonNumber, deadlineWeekNumber: game.currentWeek };
  }

  return {
    deadlineSeasonNumber: game.seasonNumber,
    deadlineWeekNumber: Math.min(game.calendar.length || SEASON_WEEK_COUNT, game.currentWeek + tvRequestWindowWeeks),
  };
}

function upsertAcceptedRequest(game: GameState, item: MailActionInput, actionType: SocialInboxActionType, segmentId?: string): SocialInboxRequest {
  const deadline = getRequestDeadline(game, actionType);

  return {
    id: buildRequestId(game, item, actionType),
    mailId: item.id,
    wrestlerId: item.wrestlerId,
    wrestlerName: item.wrestlerName,
    actionType,
    askLabel: item.askLabel,
    createdSeasonNumber: game.seasonNumber,
    createdWeekNumber: game.currentWeek,
    status: "accepted",
    segmentId,
    ...deadline,
  };
}

function replaceActiveRequest(requests: SocialInboxRequest[], nextRequest: SocialInboxRequest) {
  return [
    ...requests.filter(
      (request) =>
        !(
          request.status === "accepted" &&
          request.wrestlerId === nextRequest.wrestlerId &&
          request.actionType === nextRequest.actionType &&
          request.createdSeasonNumber === nextRequest.createdSeasonNumber &&
          request.createdWeekNumber === nextRequest.createdWeekNumber
        ),
    ),
    nextRequest,
  ];
}

export function acceptSocialInboxRest(game: GameState, item: MailActionInput): GameState {
  const request = upsertAcceptedRequest(game, item, "rest");
  const currentShow = game.currentShow.map((segment) => {
    const participantIds = segment.participantIds.filter((id) => id !== item.wrestlerId);
    return {
      ...segment,
      participantIds,
      winnerId: segment.winnerId === item.wrestlerId ? undefined : segment.winnerId,
    };
  });

  return {
    ...game,
    socialInbox: {
      requests: replaceActiveRequest(game.socialInbox.requests, request),
    },
    currentShow,
  };
}

export function acceptSocialInboxTvTime(game: GameState, item: MailActionInput): { game: GameState; segmentId: string } {
  const option = getDefaultCatalogOption("Promo");
  const segmentId = `social-tv-segment-${Date.now()}-${game.currentShow.length}`;
  const segment: Segment = {
    id: segmentId,
    type: "Promo",
    participantIds: [item.wrestlerId],
    segmentCatalogId: option?.id,
    segmentDisplayName: option?.label,
    durationMinutes: option?.defaultDurationMinutes,
    participantMin: option?.minParticipants,
    participantMax: option?.maxParticipants,
  };
  const request = upsertAcceptedRequest(game, item, "tv_time", segmentId);

  return {
    segmentId,
    game: {
      ...game,
      socialInbox: {
        requests: replaceActiveRequest(game.socialInbox.requests, request),
      },
      currentShow: [...game.currentShow, segment],
    },
  };
}

function isAfterDeadline(game: GameState, request: SocialInboxRequest) {
  return game.seasonNumber > request.deadlineSeasonNumber || (game.seasonNumber === request.deadlineSeasonNumber && game.currentWeek >= request.deadlineWeekNumber);
}

function resolveRequestNote(request: SocialInboxRequest, status: "fulfilled" | "broken") {
  if (request.actionType === "rest") {
    return `${request.wrestlerName} got the protected week off they asked for.`;
  }

  return status === "fulfilled"
    ? `${request.wrestlerName} got the TV time they asked the office for.`
    : `${request.wrestlerName} did not get the promised TV time before the window closed.`;
}

export function resolveSocialInboxRequestsAfterShow(game: GameState, result: ShowResult): GameState {
  const acceptedRequests = game.socialInbox.requests.filter((request) => request.status === "accepted");

  if (!acceptedRequests.length) {
    return game;
  }

  const bookedIds = new Set(result.segmentResults.flatMap((segment) => segment.participantIds));
  const moraleChanges = new Map<string, number>();
  const nextRequests = game.socialInbox.requests.map((request) => {
    if (request.status !== "accepted") {
      return request;
    }

    const fulfilled =
      request.actionType === "rest"
        ? request.createdSeasonNumber === result.seasonNumber && request.createdWeekNumber === result.week && !bookedIds.has(request.wrestlerId)
        : bookedIds.has(request.wrestlerId);
    const broken = !fulfilled && request.actionType !== "rest" && isAfterDeadline(game, request);

    if (!fulfilled && !broken) {
      return request;
    }

    const status = fulfilled ? ("fulfilled" as const) : ("broken" as const);
    const moraleDelta = fulfilled ? (request.actionType === "rest" ? 0 : 3) : -4;
    if (moraleDelta !== 0) {
      moraleChanges.set(request.wrestlerId, (moraleChanges.get(request.wrestlerId) ?? 0) + moraleDelta);
    }

    return {
      ...request,
      status,
      resolvedSeasonNumber: result.seasonNumber,
      resolvedWeekNumber: result.week,
      note: resolveRequestNote(request, status),
    };
  });

  if (!moraleChanges.size) {
    return {
      ...game,
      socialInbox: { requests: nextRequests },
    };
  }

  const resolvedRequests = nextRequests.filter(
    (request) => request.resolvedSeasonNumber === result.seasonNumber && request.resolvedWeekNumber === result.week && request.note,
  );
  const nextWrestlers = game.wrestlers.map((wrestler) => {
    const moraleChange = moraleChanges.get(wrestler.id);
    return moraleChange ? { ...wrestler, morale: clamp(wrestler.morale + moraleChange) } : wrestler;
  });

  resolvedRequests.forEach((request) => {
    const moraleChange = moraleChanges.get(request.wrestlerId) ?? 0;
    const item = {
      wrestlerId: request.wrestlerId,
      wrestlerName: request.wrestlerName,
      moraleChange,
      note: request.note ?? resolveRequestNote(request, request.status === "broken" ? "broken" : "fulfilled"),
    };

    if (moraleChange >= 0) {
      result.lockerRoomFallout?.moraleBoosts.push(item);
    } else {
      result.lockerRoomFallout?.moraleDrops.push(item);
    }
  });

  return {
    ...game,
    wrestlers: nextWrestlers,
    socialInbox: { requests: nextRequests },
  };
}
