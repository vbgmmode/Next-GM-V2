import type { ChampionshipHistoryEvent, RivalryHistoryEvent, ShowResult } from "@game/types";
import type { LiveDeskFixture } from "./shared";
import { createFixtureBase, withGamePatch } from "./shared";

export const postShowFalloutFixture: LiveDeskFixture = (() => {
  const base = createFixtureBase({
    gmName: "Sam Rivera",
    brandName: "NXT",
    brandStyle: "NXT",
  });

  const w = base.wrestlers;
  const rivalry = base.rivalries[0];
  const championship = base.championships[0];

  const titleHistoryEvents: ChampionshipHistoryEvent[] = championship
    ? [
        {
          id: "fallout-title-change",
          championshipId: championship.id,
          championshipName: championship.name,
          eventType: "title_change",
          championIds: [w[2]?.id ?? ""],
          previousChampionIds: [w[1]?.id ?? ""],
          weekNumber: 2,
          seasonNumber: 1,
          showName: "Neon Harbor TV",
          showType: "tv",
          segmentId: "fallout-main",
          note: (w[2]?.name ?? "Challenger") + " captured the " + championship.name + " in a heated main-event finish.",
        },
      ]
    : [];

  const rivalryHistoryEvents: RivalryHistoryEvent[] = rivalry
    ? [
        {
          id: "fallout-rivalry-advanced",
          rivalryId: rivalry.id,
          rivalryName: rivalry.name,
          participantIds: rivalry.participantIds,
          weekNumber: 2,
          seasonNumber: 1,
          showName: "Neon Harbor TV",
          showType: "tv",
          eventType: "heated_up",
          note: rivalry.name + " escalated after the title scene spilled into the back.",
        },
      ]
    : [];

  const result: ShowResult = {
    id: "fallout-result-week-2",
    seasonNumber: 1,
    week: 2,
    brandName: base.brandName,
    showName: "Neon Harbor TV",
    showType: "tv",
    plannedRuntimeMinutes: 118,
    actualRuntimeMinutes: 126,
    broadcastOverrunMinutes: 8,
    broadcastOverrunLevel: "moderate",
    broadcastOverrunNotes: ["The main event ran long after the title celebration spilled into a brawl."],
    totalScore: 86,
    segmentResults: [
      {
        segmentId: "fallout-promo",
        type: "Promo",
        participantNames: [w[0]?.name ?? ""],
        participantIds: [w[0]?.id ?? ""],
        score: 78,
        momentumChanges: { [w[0]?.id ?? ""]: 3 },
        fatigueChanges: { [w[0]?.id ?? ""]: 2 },
        rivalryNote: (rivalry?.name ?? "The rivalry") + " opened the show with a direct challenge.",
        recapNote: "The promo set the stakes before the title scene.",
      },
      {
        segmentId: "fallout-main",
        type: "Match",
        participantNames: [w[1]?.name ?? "", w[2]?.name ?? ""],
        participantIds: [w[1]?.id ?? "", w[2]?.id ?? ""],
        score: 91,
        winnerId: w[2]?.id,
        championshipId: championship?.id,
        rivalryId: rivalry?.id,
        titleNote: (w[2]?.name ?? "New champion") + " won the " + (championship?.name ?? "title") + ".",
        rivalryNote: (rivalry?.name ?? "The rivalry") + " boiled over at the bell.",
        momentumChanges: { [w[2]?.id ?? ""]: 9, [w[1]?.id ?? ""]: -2 },
        fatigueChanges: { [w[2]?.id ?? ""]: 11, [w[1]?.id ?? ""]: 13 },
        recapNote: "The main event delivered the broadcast peak with a title change.",
      },
      {
        segmentId: "fallout-open",
        type: "Open Challenge",
        participantNames: [w[3]?.name ?? "", w[6]?.name ?? ""],
        participantIds: [w[3]?.id ?? "", w[6]?.id ?? ""],
        score: 84,
        resolvedOpponentId: w[6]?.id,
        resolvedOpponentName: w[6]?.name,
        momentumChanges: { [w[3]?.id ?? ""]: 5, [w[6]?.id ?? ""]: 6 },
        fatigueChanges: { [w[3]?.id ?? ""]: 8, [w[6]?.id ?? ""]: 7 },
        recapNote: (w[6]?.name ?? "The challenger") + " answered the Open Challenge and stole the closing beat.",
      },
    ],
    biggestMomentumGain: { name: w[2]?.name ?? "Standout", amount: 9 },
    biggestFatigueIncrease: { name: w[1]?.name ?? "Workhorse", amount: 13 },
    titleNotes: [(w[2]?.name ?? "New champion") + " is the new " + (championship?.name ?? "champion") + "."],
    rivalryNotes: [(rivalry?.name ?? "The rivalry") + " is white-hot after the title spill."],
    titleHistoryEvents,
    rivalryHistoryEvents,
    lockerRoomFallout: {
      moraleDrops: [{ wrestlerId: w[1]?.id ?? "", wrestlerName: w[1]?.name ?? "", note: "Lost the title in a brutal main event.", moraleChange: -8 }],
      moraleBoosts: [{ wrestlerId: w[2]?.id ?? "", wrestlerName: w[2]?.name ?? "", note: "New champion energy in the locker room.", moraleChange: 10 }],
      overuseWarnings: [{ wrestlerId: w[1]?.id ?? "", wrestlerName: w[1]?.name ?? "", note: "Carried another heavy main-event load." }],
      underuseWarnings: [],
      injuryNotes: [
        {
          wrestlerId: w[4]?.id ?? "",
          wrestlerName: w[4]?.name ?? "",
          status: "minor",
          description: "Bruised ribs",
          weeksRemaining: 1,
          note: "Took a bad bump during the post-main brawl.",
        },
      ],
    },
  };

  const game = withGamePatch(base, {
    currentWeek: 2,
    currentShow: [],
    showHistory: [result],
    wrestlers: base.wrestlers.map((wrestler, index) =>
      index === 1
        ? { ...wrestler, momentum: wrestler.momentum - 4, morale: wrestler.morale - 6, fatigue: 72 }
        : index === 2
          ? { ...wrestler, momentum: wrestler.momentum + 9, morale: wrestler.morale + 8 }
          : index === 4
            ? {
                ...wrestler,
                injuryStatus: "minor" as const,
                injuryDescription: "Bruised ribs",
                injuryWeeksRemaining: 1,
                injuryOccurredWeek: 2,
              }
            : wrestler,
    ),
    championships: base.championships.map((title) =>
      title.id === championship?.id ? { ...title, championIds: [w[2]?.id ?? ""], defenses: 0, reignStartWeek: 2 } : title,
    ),
    championshipHistory: titleHistoryEvents,
    rivalryHistory: rivalryHistoryEvents,
  });

  return {
    id: "post-show-fallout",
    label: "Post-Show Fallout",
    description: "Resolved broadcast recap with title change, rivalry heat, and injury fallout.",
    defaultScene: "recap",
    game,
    result,
  };
})();
