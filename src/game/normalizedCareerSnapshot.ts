import { getResolvedShowCauseLinks } from "./causeLinking";
import type { GameState, MarketContract, MarketTransaction, RivalBrandWeeklyResult, Segment, SegmentResult } from "./types";

export type NormalizedLinkSource = "direct" | "derived" | "missing";

export type NormalizedCareerSnapshot = {
  brands: Array<{
    id: string;
    ownerType: "player" | "cpu";
    name: string;
  }>;
  wrestlers: Array<{
    id: string;
    name: string;
  }>;
  brandRosterMembers: Array<{
    brandId: string;
    wrestlerId: string;
    source: "player_roster" | "cpu_roster";
  }>;
  championships: Array<{
    id: string;
    brandId: string;
    championIds: string[];
  }>;
  titleHistoryEvents: Array<{
    id: string;
    championshipId: string;
    resultId?: string;
    eventId?: string;
    linkSource: NormalizedLinkSource;
  }>;
  rivalries: Array<{
    id: string;
    participantIds: string[];
  }>;
  rivalryParticipants: Array<{
    rivalryId: string;
    wrestlerId: string;
  }>;
  bookingSegments: Array<
    Pick<Segment, "id" | "type" | "participantIds" | "championshipId" | "rivalryId" | "segmentCatalogId" | "stipulationId">
  >;
  showResults: Array<{
    id: string;
    seasonNumber: number;
    week: number;
    eventId?: string;
  }>;
  segmentResults: Array<
    Pick<SegmentResult, "segmentId" | "type" | "participantIds" | "championshipId" | "rivalryId" | "segmentCatalogId" | "stipulationId" | "winnerId"> & {
      resultId: string;
    }
  >;
  financeReports: Array<{
    id: string;
    resultId?: string;
    eventId?: string;
    linkSource: NormalizedLinkSource;
  }>;
  socialPosts: Array<{
    id: string;
    resultId?: string;
    eventId?: string;
    segmentId?: string;
  }>;
  durableEvents: GameState["eventLedger"];
  marketContracts: MarketContract[];
  marketTransactions: MarketTransaction[];
  cpuBrands: Array<{
    id: string;
    brandName: string;
    rosterWrestlerIds: string[];
  }>;
  cpuWeeklyResults: Array<RivalBrandWeeklyResult & { brandId: string }>;
};

function getLinkSource(resultId?: string, eventId?: string): NormalizedLinkSource {
  if (resultId || eventId) {
    return "direct";
  }

  return "missing";
}

export function toNormalizedCareerSnapshot(game: GameState): NormalizedCareerSnapshot {
  const playerBrandId = game.playerBrand.id;
  const showLinks = new Map(game.showHistory.map((result) => [result.id, getResolvedShowCauseLinks(game, result)]));
  const resultIdByFinanceId = new Map<string, string>();
  const eventIdByFinanceId = new Map<string, string | undefined>();
  const resultIdByTitleEventId = new Map<string, string>();
  const eventIdByTitleEventId = new Map<string, string | undefined>();
  const resultIdByRivalryEventId = new Map<string, string>();
  const eventIdByRivalryEventId = new Map<string, string | undefined>();

  showLinks.forEach((links, resultId) => {
    if (links.financeReport) {
      resultIdByFinanceId.set(links.financeReport.id, resultId);
      eventIdByFinanceId.set(links.financeReport.id, links.event?.id);
    }

    links.titleHistoryEvents.forEach((event) => {
      resultIdByTitleEventId.set(event.id, resultId);
      eventIdByTitleEventId.set(event.id, links.event?.id);
    });
    links.rivalryHistoryEvents.forEach((event) => {
      resultIdByRivalryEventId.set(event.id, resultId);
      eventIdByRivalryEventId.set(event.id, links.event?.id);
    });
  });

  return {
    brands: [
      { id: playerBrandId, ownerType: "player", name: game.playerBrand.name },
      ...game.rivalBrands.map((brand) => ({ id: brand.brandIdentity.id, ownerType: "cpu" as const, name: brand.brandName })),
    ],
    wrestlers: game.wrestlers.map((wrestler) => ({ id: wrestler.id, name: wrestler.name })),
    brandRosterMembers: [
      ...game.wrestlers.map((wrestler) => ({ brandId: playerBrandId, wrestlerId: wrestler.id, source: "player_roster" as const })),
      ...game.rivalBrands.flatMap((brand) =>
        brand.rosterWrestlerIds.map((wrestlerId) => ({ brandId: brand.brandIdentity.id, wrestlerId, source: "cpu_roster" as const })),
      ),
    ],
    championships: game.championships.map((championship) => ({
      id: championship.id,
      brandId: playerBrandId,
      championIds: [...championship.championIds],
    })),
    titleHistoryEvents: game.championshipHistory.map((event) => {
      const resultId = event.resultId ?? resultIdByTitleEventId.get(event.id);
      const eventId = event.eventId ?? eventIdByTitleEventId.get(event.id);

      return {
        id: event.id,
        championshipId: event.championshipId,
        resultId,
        eventId,
        linkSource: getLinkSource(event.resultId, event.eventId) === "direct" ? "direct" : resultId || eventId ? "derived" : "missing",
      };
    }),
    rivalries: game.rivalries.map((rivalry) => ({ id: rivalry.id, participantIds: [...rivalry.participantIds] })),
    rivalryParticipants: game.rivalries.flatMap((rivalry) => rivalry.participantIds.map((wrestlerId) => ({ rivalryId: rivalry.id, wrestlerId }))),
    bookingSegments: game.currentShow.map((segment) => ({
      id: segment.id,
      type: segment.type,
      participantIds: [...segment.participantIds],
      championshipId: segment.championshipId,
      rivalryId: segment.rivalryId,
      segmentCatalogId: segment.segmentCatalogId,
      stipulationId: segment.stipulationId,
    })),
    showResults: game.showHistory.map((result) => ({
      id: result.id,
      seasonNumber: result.seasonNumber,
      week: result.week,
      eventId: showLinks.get(result.id)?.event?.id,
    })),
    segmentResults: game.showHistory.flatMap((result) =>
      result.segmentResults.map((segmentResult) => ({
        resultId: result.id,
        segmentId: segmentResult.segmentId,
        type: segmentResult.type,
        participantIds: [...segmentResult.participantIds],
        championshipId: segmentResult.championshipId,
        rivalryId: segmentResult.rivalryId,
        segmentCatalogId: segmentResult.segmentCatalogId,
        stipulationId: segmentResult.stipulationId,
        winnerId: segmentResult.winnerId,
      })),
    ),
    financeReports: game.financeReports.map((report) => {
      const resultId = report.resultId ?? resultIdByFinanceId.get(report.id);
      const eventId = report.eventId ?? eventIdByFinanceId.get(report.id);

      return {
        id: report.id,
        resultId,
        eventId,
        linkSource: getLinkSource(report.resultId, report.eventId) === "direct" ? "direct" : resultId || eventId ? "derived" : "missing",
      };
    }),
    socialPosts: game.socialPosts.map((post) => ({
      id: post.id,
      resultId: post.resultId,
      eventId: post.eventId,
      segmentId: post.segmentId,
    })),
    durableEvents: [...(game.eventLedger ?? [])],
    marketContracts: [...game.marketState.playerContracts, ...game.rivalBrands.flatMap((brand) => brand.contracts)],
    marketTransactions: [...game.marketState.transactions, ...game.rivalBrands.flatMap((brand) => brand.marketTransactions)],
    cpuBrands: game.rivalBrands.map((brand) => ({
      id: brand.brandIdentity.id,
      brandName: brand.brandName,
      rosterWrestlerIds: [...brand.rosterWrestlerIds],
    })),
    cpuWeeklyResults: game.rivalBrands.flatMap((brand) => brand.weeklyResults.map((result) => ({ ...result, brandId: brand.brandIdentity.id }))),
  };
}
