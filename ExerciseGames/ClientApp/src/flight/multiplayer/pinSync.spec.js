import { PIN_HEIGHT } from "../bowling/dimensions";
import { createBowlingGame, stepBowlingGame } from "../bowling/game";
import { createPinBody } from "../bowling/physics";
import {
  applyPinBroadcast,
  buildPinBroadcast,
  createPinHistory,
  shouldApplyPinState,
} from "./pinSync";

const parked = {
  x: 80,
  z: 80,
  altitude: 40,
  heading: 0,
  speed: 0,
  climbRate: 0,
  throttle: 0,
  turn: 0,
  moving: false,
  climbCommand: 0,
};

test("a guest hit is replayed from the timestamp and then broadcast as pin trajectories", () => {
  const pin = createPinBody(0, -2);
  const game = createBowlingGame([pin]);
  const history = createPinHistory();
  history.record({ t: 1000, dt: 0.016, host: parked, game });
  expect(stepBowlingGame(game, { state: parked, dt: 0.016 })).toBe(false);

  history.applyHit(game, {
    hitId: "guest:1",
    t: 1000,
    dt: 0.016,
    plane: {
      x: 0,
      z: -2 + 0.15,
      altitude: PIN_HEIGHT * 0.32 - 0.55,
      heading: 0,
      speed: 42,
      climbRate: 0,
      throttle: 1,
      turn: 0,
      moving: true,
    },
  }, { now: 1100, host: parked });

  expect(history.appliedHitIds).toContain("guest:1");
  expect(Math.hypot(pin.v[0], pin.v[1], pin.v[2])).toBeGreaterThan(1);
  expect(game.phase).toBe("settling");

  const broadcast = buildPinBroadcast({
    revision: 2,
    t: 1100,
    game,
    appliedHitIds: history.appliedHitIds,
    reason: "hit",
  });
  const otherPin = createPinBody(0, -2);
  const other = createBowlingGame([otherPin]);
  expect(shouldApplyPinState({
    payload: broadcast,
    lastRevision: 0,
    pendingHitIds: ["guest:1"],
  })).toBe(true);
  applyPinBroadcast(other, broadcast);
  expect(otherPin.v[0]).toBeCloseTo(pin.v[0]);
  expect(otherPin.v[2]).toBeCloseTo(pin.v[2]);
  expect(broadcast.score.settling).toBe(true);
});

test("pin snapshots wait until the host has acknowledged a local hit", () => {
  const early = {
    revision: 4,
    appliedHitIds: [],
    pins: [],
  };
  expect(shouldApplyPinState({
    payload: early,
    lastRevision: 3,
    pendingHitIds: ["guest:9"],
  })).toBe(false);
  expect(shouldApplyPinState({
    payload: { revision: 3, appliedHitIds: ["guest:9"], pins: [] },
    lastRevision: 3,
    pendingHitIds: [],
  })).toBe(false);
  expect(shouldApplyPinState({
    payload: { revision: 5, appliedHitIds: ["guest:9"], pins: [] },
    lastRevision: 3,
    pendingHitIds: ["guest:9"],
  })).toBe(true);
});
