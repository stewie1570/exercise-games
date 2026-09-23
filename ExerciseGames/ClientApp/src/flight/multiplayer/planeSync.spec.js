import { vi } from "vitest";
import { createAircraftState } from "../physics";
import {
  FORMATION_SPACING,
  PLANE_BROADCAST_MS,
  adoptPlaneSnapshot,
  createPlaneCadence,
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
  expect(second.x - first.x).toBe(FORMATION_SPACING);
  expect(second.z).toBeLessThan(first.z);
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

test("the next plane update waits until the previous send finishes, then 100ms", async () => {
  vi.useFakeTimers();
  try {
    const resolvers = [];
    const send = vi.fn(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));
    const cadence = createPlaneCadence({ send, intervalMs: PLANE_BROADCAST_MS });
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(1);

    resolvers[0]();
    await vi.advanceTimersByTimeAsync(99);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);

    resolvers[1]();
    await cadence.stop();
  } finally {
    vi.useRealTimers();
  }
});

test("a hit during the gap sends the plane without waiting out the rest", async () => {
  vi.useFakeTimers();
  try {
    const send = vi.fn(() => Promise.resolve());
    const cadence = createPlaneCadence({ send, intervalMs: PLANE_BROADCAST_MS });
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(40);
    cadence.requestImmediate();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);

    await cadence.stop();
  } finally {
    vi.useRealTimers();
  }
});

test("a hit sends the plane again without waiting out the gap", async () => {
  vi.useFakeTimers();
  try {
    const resolvers = [];
    const send = vi.fn(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));
    const cadence = createPlaneCadence({ send, intervalMs: PLANE_BROADCAST_MS });
    await vi.advanceTimersByTimeAsync(0);
    cadence.requestImmediate();
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(1);

    resolvers[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);

    resolvers[1]();
    await cadence.stop();
  } finally {
    vi.useRealTimers();
  }
});

test("the server clock estimates offset from a round trip", () => {
  const clock = createServerClock();
  clock.note(1_000, 1_200, 5_000);
  expect(clock.now() - Date.now()).toBeCloseTo(3900, -2);
  clock.note(1_000, 1_001, 5_000);
  expect(Number.isInteger(clock.now())).toBe(true);
});
