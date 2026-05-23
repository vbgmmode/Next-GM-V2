import type { LiveDeskFixture, LiveDeskFixtureId } from "./shared";
import { goHomePleFixture } from "./goHomePle";
import { postShowFalloutFixture } from "./postShowFallout";
import { weekPressureFixture } from "./weekPressure";

export type { LiveDeskFixture, LiveDeskFixtureId, LiveDeskScene } from "./shared";
export { weekPressureFixture, goHomePleFixture, postShowFalloutFixture };

export const liveDeskFixtures: LiveDeskFixture[] = [weekPressureFixture, goHomePleFixture, postShowFalloutFixture];

export function getFixture(id: LiveDeskFixtureId): LiveDeskFixture {
  const fixture = liveDeskFixtures.find((item) => item.id === id);
  if (!fixture) {
    throw new Error(`Unknown fixture: ${id}`);
  }
  return fixture;
}
