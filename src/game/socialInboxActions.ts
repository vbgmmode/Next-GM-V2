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
          (item.actionType !== "rest" &&
            item.actionType !== "tv_time" &&
            item.actionType !== "title_shot" &&
            item.actionType !== "story_spot") ||
          (item.status !== "accepted" && item.status !== "declined" && item.status !== "fulfilled" && item.status !== "broken")
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
      label: "Accept Rest Ask",
      detail: "Creates a protected rest promise. Booking still runs through the card.",
    };
  }

  if (askLabel === "Title Shot" || askLabel === "Title") {
    return {
      type: "title_shot",
      label: "Accept Title Ask",
      detail: "Creates a title-scene promise for Generate Matches and your manual card.",
    };
  }

  if (askLabel === "Story") {
    return {
      type: "story_spot",
      label: "Accept Story Ask",
      detail: "Creates a rivalry/story promise. Generate Matches will try to account for it.",
    };
  }

  if (askLabel === "TV Time" || askLabel === "Morale" || askLabel === "Push") {
    return {
      type: "tv_time",
      label: "Accept Ask",
      detail: "Creates a booking promise. Generate Matches will try to account for it.",
    };
  }

  return undefined;
}

export function getActiveSocialInboxRequest(game: GameState, mailId: string, wrestlerId: string) {
  return game.socialInbox.requests.find(
    (request) => request.mailId === mailId && request.wrestlerId === wrestlerId && request.status === "accepted",
  );
}

export function getCurrentSocialInboxRequest(game: GameState, mailId: string, wrestlerId: string) {
  return game.socialInbox.requests.find(
    (request) =>
      request.mailId === mailId &&
      request.wrestlerId === wrestlerId &&
      request.createdSeasonNumber === game.seasonNumber &&
      request.createdWeekNumber === game.currentWeek &&
      (request.status === "accepted" || request.status === "declined"),
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

  if (actionType === "title_shot" || actionType === "story_spot") {
    const nextPle = game.calendar.find((week) => week.showType === "ple" && week.weekNumber >= game.currentWeek && !week.completed);
    if (nextPle && nextPle.weekNumber - game.currentWeek <= 3) {
      return { deadlineSeasonNumber: game.seasonNumber, deadlineWeekNumber: nextPle.weekNumber };
    }
  }

  return {
    deadlineSeasonNumber: game.seasonNumber,
    deadlineWeekNumber: Math.min(game.calendar.length || SEASON_WEEK_COUNT, game.currentWeek + (actionType === "tv_time" ? 2 : tvRequestWindowWeeks)),
  };
}

function buildRequest(game: GameState, item: MailActionInput, actionType: SocialInboxActionType, status: "accepted" | "declined", segmentId?: string): SocialInboxRequest {
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
    status,
    segmentId,
    note: status === "accepted" ? getAcceptedRequestNote(item, actionType, deadline.deadlineWeekNumber) : getDeclinedRequestNote(item),
    ...deadline,
  };
}

function getAcceptedRequestNote(item: MailActionInput, actionType: SocialInboxActionType, deadlineWeekNumber: number) {
  if (actionType === "rest") {
    return `${item.wrestlerName} expects a protected week now. Keep them off this week's card.`;
  }

  if (actionType === "title_shot") {
    return `${item.wrestlerName} expects title-scene booking by Week ${deadlineWeekNumber}.`;
  }

  if (actionType === "story_spot") {
    return `${item.wrestlerName} expects meaningful story attention by Week ${deadlineWeekNumber}.`;
  }

  return `${item.wrestlerName} expects useful TV time by Week ${deadlineWeekNumber}.`;
}

function getDeclinedRequestNote(item: MailActionInput) {
  return `${item.wrestlerName} heard the no. Morale and trust took an immediate hit.`;
}

function applyInboxDecisionStats(game: GameState, wrestlerId: string, decision: "accepted" | "declined") {
  const moraleDelta = decision === "accepted" ? 1 : -3;
  const trustDelta = decision === "accepted" ? 2 : -2;

  return game.wrestlers.map((wrestler) =>
    wrestler.id === wrestlerId
      ? {
          ...wrestler,
          morale: clamp(wrestler.morale + moraleDelta),
          trust: clamp((wrestler.trust ?? 50) + trustDelta),
        }
      : wrestler,
  );
}

function replaceCurrentRequest(requests: SocialInboxRequest[], nextRequest: SocialInboxRequest) {
  return [
    ...requests.filter(
      (request) => {
        const sameAcceptedAction =
          request.status === "accepted" &&
          request.wrestlerId === nextRequest.wrestlerId &&
          request.actionType === nextRequest.actionType &&
          request.createdSeasonNumber === nextRequest.createdSeasonNumber &&
          request.createdWeekNumber === nextRequest.createdWeekNumber;
        const sameMailDecision =
          request.mailId === nextRequest.mailId &&
          request.wrestlerId === nextRequest.wrestlerId &&
          request.createdSeasonNumber === nextRequest.createdSeasonNumber &&
          request.createdWeekNumber === nextRequest.createdWeekNumber &&
          (request.status === "accepted" || request.status === "declined");

        return !sameAcceptedAction && !sameMailDecision;
      },
    ),
    nextRequest,
  ];
}

export function acceptSocialInboxRest(game: GameState, item: MailActionInput): GameState {
  const request = buildRequest(game, item, "rest", "accepted");
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
    wrestlers: applyInboxDecisionStats(game, item.wrestlerId, "accepted"),
    socialInbox: {
      requests: replaceCurrentRequest(game.socialInbox.requests, request),
    },
    currentShow,
  };
}

export function acceptSocialInboxPromise(game: GameState, item: MailActionInput, actionType: Exclude<SocialInboxActionType, "rest">): GameState {
  const request = buildRequest(game, item, actionType, "accepted");

  return {
    ...game,
    wrestlers: applyInboxDecisionStats(game, item.wrestlerId, "accepted"),
    socialInbox: {
      requests: replaceCurrentRequest(game.socialInbox.requests, request),
    },
  };
}

export function declineSocialInboxRequest(game: GameState, item: MailActionInput, actionType: SocialInboxActionType): GameState {
  const request = buildRequest(game, item, actionType, "declined");

  return {
    ...game,
    wrestlers: applyInboxDecisionStats(game, item.wrestlerId, "declined"),
    socialInbox: {
      requests: replaceCurrentRequest(game.socialInbox.requests, request),
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

  const label = request.actionType === "title_shot" ? "title-scene booking" : request.actionType === "story_spot" ? "story attention" : "TV time";

  return status === "fulfilled"
    ? `${request.wrestlerName} got the promised ${label}.`
    : `${request.wrestlerName} did not get the promised ${label} before the window closed.`;
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
        : result.segmentResults.some((segment) => {
            if (!segment.participantIds.includes(request.wrestlerId)) {
              return false;
            }

            if (request.actionType === "title_shot") {
              return Boolean(segment.championshipId);
            }

            if (request.actionType === "story_spot") {
              return Boolean(segment.rivalryId) || segment.type === "Backstage Angle" || segment.type === "Contract Signing" || segment.type === "Promo";
            }

            return true;
          });
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
