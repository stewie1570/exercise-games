import { PIN_HEIGHT, PIN_RESET_DELAY, PIN_SPACING } from "../bowling/dimensions";
import { createBowlingGame, stepBowlingGame } from "../bowling/game";
import { createPinBody, stepPins } from "../bowling/physics";
import {
  acceptPinRevision,
  applyPinBroadcast,
  buildPinBroadcast,
  releaseSleepingPins,
} from "./pinSync";

const hittingPlane = {
  x: 0,
  z: -2 + 0.15,
  altitude: PIN_HEIGHT * 0.32 - 0.55,
  heading: 0,
  speed: 42,
  climbRate: 0,
  throttle: 1,
  turn: 0,
  moving: true,
};

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
};

test("the pilot who hits a pin owns it and the pins it knocks into", () => {
  const struck = createPinBody(0, 0);
  const neighbor = createPinBody(PIN_SPACING * 0.92, 0);
  struck.owner = "guest";
  struck.v = [18, 0, 0];
  struck.sleeping = false;
  let peak = 0;
  for (let i = 0; i < 40; i += 1) {
    stepPins([struck, neighbor], {
      state: null,
      dt: 0.016,
      planeHit: false,
      authority: "guest",
      simulateUnowned: false,
    });
    peak = Math.max(peak, Math.hypot(neighbor.v[0], neighbor.v[1], neighbor.v[2]));
  }
  expect(neighbor.owner).toBe("guest");
  expect(peak).toBeGreaterThan(0.5);
});

test("a guest hit is scored from the pins that guest owns", () => {
  const guestPin = createPinBody(0, -2);
  const guest = createBowlingGame([guestPin]);
  stepPins(guest.pins, {
    state: hittingPlane,
    dt: 0.05,
    planeHit: true,
    authority: "guest",
    simulateUnowned: false,
  });
  expect(guestPin.owner).toBe("guest");
  const lean = (20 * Math.PI) / 180;
  guestPin.q = [Math.sin(lean / 2), 0, 0, Math.cos(lean / 2)];

  const host = createBowlingGame([createPinBody(0, -2)]);
  const payload = buildPinBroadcast({
    revision: 1,
    t: 1000,
    from: "guest",
    game: guest,
  });
  applyPinBroadcast(host, payload, { localId: "host" });
  expect(host.pins[0].owner).toBe("guest");
  host.phase = "settling";
  host.settleIn = 0;
  stepBowlingGame(host, {
    state: parked,
    dt: PIN_RESET_DELAY,
    authority: "host",
    simulateUnowned: true,
  });
  expect(host.card.frames[0][0]).toBe(1);
});

test("a local owner keeps a pin while it is moving", () => {
  const pin = createPinBody(0, 0);
  pin.owner = "guest";
  pin.v = [4, 0, 1];
  pin.sleeping = false;
  const game = createBowlingGame([pin]);
  const stale = createBowlingGame([createPinBody(0, 0)]);
  const payload = buildPinBroadcast({
    revision: 2,
    t: 1000,
    from: "host",
    game: stale,
  });
  applyPinBroadcast(game, payload, { localId: "guest" });
  expect(pin.owner).toBe("guest");
  expect(pin.v[0]).toBeCloseTo(4);

  pin.sleeping = true;
  const released = releaseSleepingPins(game.pins, "guest");
  const done = buildPinBroadcast({
    revision: 3,
    t: 1100,
    from: "guest",
    game,
    released,
  });
  const host = createBowlingGame([createPinBody(9, 9)]);
  host.pins[0].owner = "guest";
  applyPinBroadcast(host, done, { localId: "host" });
  expect(host.pins[0].owner).toBeNull();
  expect(host.pins[0].p[0]).toBeCloseTo(pin.p[0]);
});

test("pin snapshots from one pilot do not block another pilot", () => {
  const seen = new Map();
  expect(acceptPinRevision(seen, { from: "host", revision: 1 })).toBe(true);
  expect(acceptPinRevision(seen, { from: "host", revision: 1 })).toBe(false);
  expect(acceptPinRevision(seen, { from: "guest", revision: 1 })).toBe(true);
});
