import type { LiveDeskFixture } from "./shared";
import { createFixtureBase, createSegment, withGamePatch } from "./shared";

export const goHomePleFixture: LiveDeskFixture = (() => {
  const base = createFixtureBase({
    gmName: "Jordan Hayes",
    brandName: "SmackDown",
    brandStyle: "SmackDown",
  });

  const rivalry = base.rivalries[0];
  const championship = base.championships[0];
  const w = base.wrestlers;

  const game = withGamePatch(base, {
    currentWeek: 3,
    money: 1625000,
    currentShow: [
      createSegment("go-home-promo", "Promo", [w[0]?.id ?? ""], { rivalryId: rivalry?.id }),
      createSegment("go-home-match", "Match", [w[1]?.id ?? "", w[2]?.id ?? ""], {
        rivalryId: rivalry?.id,
        championshipId: championship?.id,
      }),
      createSegment("go-home-angle", "Backstage Angle", [w[3]?.id ?? "", w[4]?.id ?? ""]),
      createSegment("go-home-open", "Open Challenge", [w[5]?.id ?? ""]),
      createSegment("go-home-invalid", "Match", [w[6]?.id ?? ""]),
    ],
    rivalries: base.rivalries.map((item, index) =>
      index === 0 ? { ...item, heat: 88, freshness: 69, status: "rising" as const, weeksActive: 3 } : item,
    ),
  });

  return {
    id: "go-home-ple",
    label: "Go-Home PLE",
    description: "Final TV stop before Collision Course with a nearly-ready card.",
    defaultScene: "rundown",
    game,
  };
})();
