import { createAircraftState } from "../physics";
import {
  adoptPlaneSnapshot,
  createRemotePilot,
  createServerClock,
  extrapolatePilot,
  pilotTint,
  snapshotAircraft,
  spawnAircraft,
} from "./planeSync";

test("pilots spawn apart and keep a stable color", () => {
  const first = spawnAircraft(0);
  const second = spawnAircraft(1);
  expect(second.x - first.x).toBe(18);
  expect(pilotTint(0)).toEqual(pilotTint(8));
  expect(pilotTint(1).body).not.toBe(pilotTint(0).body);
});

test("a remote plane keeps flying on the last controls until the next snapshot", () => {
  const pilot = createRemotePilot("other");
  const state = {
    ...createAircraftState(),
    x: 0,
    z: 0,
    altitude: 30,
    heading: 0,
    throttle: 1,
    climbRate: 0,
    climbCommand: 0,
    speed: 42,
    turn: 0,
    moving: true,
  };
  adoptPlaneSnapshot(pilot, snapshotAircraft(state, 1000));
  extrapolatePilot(pilot, 1);
  expect(pilot.state.z).toBeLessThan(0);
  expect(pilot.state.speed).toBeGreaterThan(0);

  adoptPlaneSnapshot(pilot, snapshotAircraft({ ...state, x: 12, z: 4 }, 2000), 2000);
  expect(pilot.state.x).toBe(12);
  expect(pilot.state.z).toBe(4);

  adoptPlaneSnapshot(pilot, snapshotAircraft(state, 3000), 4000);
  expect(pilot.state.z).toBeLessThan(state.z);
});

test("the server clock estimates offset from a round trip", () => {
  const clock = createServerClock();
  clock.note(1_000, 1_200, 5_000);
  expect(clock.now() - Date.now()).toBeCloseTo(3900, -2);
});
