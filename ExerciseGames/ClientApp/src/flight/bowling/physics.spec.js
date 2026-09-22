import { PIN_BELLY, PIN_HEIGHT, PIN_SPACING, PLANE_WINGSPAN, pinSlots } from "./dimensions";
import { countFallen, createPinBody, pinFallen, resetPin, stepPins } from "./physics";

test("pin size is one third of the ultralight wingspan", () => {
  expect(PIN_BELLY).toBeCloseTo(PLANE_WINGSPAN / 3);
  expect(PIN_HEIGHT).toBeGreaterThan(PIN_BELLY);
  expect(PIN_SPACING).toBeGreaterThan(PIN_BELLY);
});

test("ten pins sit in a bowling triangle", () => {
  const slots = pinSlots();
  expect(slots).toHaveLength(10);
  expect(slots[0].x).toBeCloseTo(0);
  expect(slots[0].z).toBeCloseTo(0);
  expect(slots[9].z).toBeCloseTo(-3 * PIN_SPACING * Math.sqrt(3) / 2);
});

test("the plane knocks a pin down without changing its own speed", () => {
  const pin = createPinBody(0, -2);
  const state = { x: 0, z: 4, altitude: 1.6, heading: 0, speed: 42, climbRate: 0 };
  const speed = state.speed;
  let hit = false;
  for (let i = 0; i < 40; i += 1) {
    state.z -= state.speed * 0.016;
    hit = stepPins([pin], { state, dt: 0.016, planeHit: true }) || hit;
  }
  expect(hit).toBe(true);
  expect(state.speed).toBe(speed);
  expect(Math.hypot(pin.v[0], pin.v[1], pin.v[2])).toBeGreaterThan(1);
});

test("a fuselage buried in the pin belly still counts as a hit", () => {
  const pin = createPinBody(0, -2);
  const state = {
    x: 0,
    z: -2 + 0.15,
    altitude: PIN_HEIGHT * 0.32 - 0.55,
    heading: 0,
    speed: 42,
    climbRate: 0,
  };
  const hit = stepPins([pin], { state, dt: 0.016, planeHit: true });
  expect(hit).toBe(true);
  expect(Math.hypot(pin.v[0], pin.v[1], pin.v[2])).toBeGreaterThan(1);
});

test("the wing registers a hit on the pin neck", () => {
  const pin = createPinBody(0, -2);
  const state = {
    x: 0,
    z: -2 + 0.15,
    altitude: PIN_HEIGHT * 0.55 - 1.62,
    heading: 0,
    speed: 42,
    climbRate: 0,
  };
  const hit = stepPins([pin], { state, dt: 0.016, planeHit: true });
  expect(hit).toBe(true);
  expect(Math.hypot(pin.v[0], pin.v[1], pin.v[2])).toBeGreaterThan(1);
});

test("a fast sweep still knocks a pin the prop passes through", () => {
  const pin = createPinBody(0, 0);
  const dt = 0.12;
  const travel = 42 * dt;
  const endZ = 1.78 - 2.5;
  const state = {
    x: 0,
    z: endZ,
    altitude: PIN_HEIGHT * 0.32 - 0.55,
    heading: 0,
    speed: 42,
    climbRate: 0,
  };
  const startPropZ = endZ - travel - 1.78;
  const endPropZ = endZ - 1.78;
  expect(Math.abs(startPropZ)).toBeGreaterThan(PIN_BELLY * 0.5 + 0.4);
  expect(Math.abs(endPropZ)).toBeGreaterThan(PIN_BELLY * 0.5 + 0.4);
  const hit = stepPins([pin], { state, dt, planeHit: true });
  expect(hit).toBe(true);
  expect(Math.hypot(pin.v[0], pin.v[1], pin.v[2])).toBeGreaterThan(1);
});

test("a moving pin knocks into a neighbor", () => {
  const a = createPinBody(0, 0);
  const b = createPinBody(PIN_SPACING * 0.92, 0);
  a.v = [18, 0, 0];
  a.sleeping = false;
  let peak = 0;
  for (let i = 0; i < 50; i += 1) {
    stepPins([a, b], { state: null, dt: 0.016, planeHit: false });
    peak = Math.max(peak, Math.hypot(b.v[0], b.v[1], b.v[2]));
  }
  expect(peak).toBeGreaterThan(0.5);
});

test("a kicked pin settles and sleeps within about a second", () => {
  const pin = createPinBody(0, 0);
  pin.v = [8, 2, 0];
  pin.w = [1.2, 0, 0.4];
  pin.sleeping = false;
  for (let i = 0; i < 75; i += 1) {
    stepPins([pin], { state: null, dt: 0.016, planeHit: false });
  }
  expect(pin.sleeping).toBe(true);
  expect(Math.hypot(pin.v[0], pin.v[1], pin.v[2])).toBeLessThan(0.5);
});

test("a tipped pin counts as fallen and reset stands it back up", () => {
  const pin = createPinBody(0, 0);
  pin.q = [0.7, 0, 0, 0.7];
  expect(pinFallen(pin)).toBe(true);
  expect(countFallen([pin])).toBe(1);
  resetPin(pin);
  expect(pinFallen(pin)).toBe(false);
  expect(pin.p[1]).toBeCloseTo(pin.rest[1]);
});
