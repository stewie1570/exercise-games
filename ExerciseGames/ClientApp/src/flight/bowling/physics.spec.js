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

test("a moving pin knocks into a neighbor", () => {
  const a = createPinBody(0, 0);
  const b = createPinBody(PIN_SPACING * 0.92, 0);
  a.v = [18, 0, 0];
  for (let i = 0; i < 50; i += 1) {
    stepPins([a, b], { state: null, dt: 0.016, planeHit: false });
  }
  expect(Math.hypot(b.v[0], b.v[1], b.v[2])).toBeGreaterThan(0.5);
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
