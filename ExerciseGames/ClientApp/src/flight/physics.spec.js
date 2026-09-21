import { createAircraftState, FLIGHT, stepAircraft, targetClimbRate } from "./physics";

test("medium throttle holds altitude", () => {
  const started = { ...createAircraftState(), altitude: 40, moving: true };
  const next = stepAircraft(started, { throttle: FLIGHT.maintainThrottle, turn: 0 }, 1);
  expect(next.altitude).toBeCloseTo(40, 5);
  expect(next.climbRate).toBeCloseTo(0, 5);
});

test("full throttle climbs and zero throttle descends", () => {
  const started = { ...createAircraftState(), altitude: 40, moving: true, speed: FLIGHT.airspeed };
  const climbing = stepAircraft(started, { throttle: 1, turn: 0 }, 1);
  const descending = stepAircraft(started, { throttle: 0, turn: 0 }, 1);
  expect(climbing.altitude).toBeGreaterThan(40);
  expect(descending.altitude).toBeLessThan(40);
  expect(climbing.climbRate).toBeGreaterThan(0);
  expect(climbing.climbRate).toBeLessThan(FLIGHT.maxClimbRate);
});

test("a short throttle pulse does not jump a flap-sized step of altitude", () => {
  const started = { ...createAircraftState(), altitude: 40, moving: true, speed: FLIGHT.airspeed };
  const pulsed = stepAircraft(started, { throttle: 1, turn: 0 }, 0.25);
  expect(pulsed.altitude - started.altitude).toBeLessThan(1.2);
  expect(pulsed.climbRate).toBeLessThan(targetClimbRate(1));

  let held = started;
  for (let i = 0; i < 30; i += 1) {
    held = stepAircraft(held, { throttle: 1, turn: 0 }, 0.1);
  }
  expect(held.altitude - started.altitude).toBeGreaterThan(8);
});

test("vertical speed accelerates instead of jumping to the climb target", () => {
  const started = {
    ...createAircraftState(),
    altitude: 40,
    moving: true,
    speed: FLIGHT.airspeed,
  };
  const first = stepAircraft(started, { throttle: 1, turn: 0 }, 0.05);
  const second = stepAircraft(first, { throttle: 1, turn: 0 }, 0.05);
  const target = targetClimbRate(1);

  expect(first.climbRate).toBeGreaterThan(0);
  expect(first.climbRate).toBeLessThan(target * 0.15);
  expect(second.climbRate - first.climbRate).toBeGreaterThan(first.climbRate - started.climbRate);
  expect(second.climbRate).toBeLessThan(target * 0.3);
});

test("airspeed stays constant while heading follows right tilt", () => {
  const started = { ...createAircraftState(), moving: true };
  const next = stepAircraft(started, { throttle: FLIGHT.maintainThrottle, turn: 1 }, 1);
  const distance = Math.hypot(next.x - started.x, next.z - started.z);
  expect(distance).toBeCloseTo(FLIGHT.airspeed, 5);
  expect(next.heading).toBeGreaterThan(started.heading);
});

test("stays parked until flapping is sensed", () => {
  const started = createAircraftState();
  const parked = stepAircraft(started, { throttle: 0, turn: 1, flapping: false }, 1);
  expect(parked.x).toBe(started.x);
  expect(parked.z).toBe(started.z);
  expect(parked.altitude).toBe(started.altitude);
  expect(parked.heading).toBe(started.heading);
  expect(parked.moving).toBe(false);

  const rolling = stepAircraft(started, { throttle: 0, turn: 0, flapping: true }, 1);
  expect(rolling.moving).toBe(true);
  expect(Math.hypot(rolling.x - started.x, rolling.z - started.z)).toBeCloseTo(FLIGHT.airspeed, 5);
  expect(rolling.z).toBeLessThan(started.z);
});

test("right turn flies toward +X, never reversing along the nose", () => {
  const started = { ...createAircraftState(), heading: Math.PI / 2, moving: true, altitude: 40 };
  const next = stepAircraft(started, { throttle: FLIGHT.maintainThrottle, turn: 0 }, 1);
  expect(next.x).toBeGreaterThan(started.x);
  expect(next.z).toBeCloseTo(started.z, 5);
});

test("touching the ground without throttle rolls to a stop", () => {
  const started = {
    ...createAircraftState(),
    altitude: FLIGHT.minAltitude,
    moving: true,
    speed: FLIGHT.airspeed,
  };
  const rolling = stepAircraft(started, { throttle: 0, turn: 0, flapping: false }, 1);
  expect(rolling.moving).toBe(true);
  expect(rolling.speed).toBeCloseTo(FLIGHT.airspeed - FLIGHT.groundDecel, 5);
  expect(rolling.altitude).toBe(FLIGHT.minAltitude);
  expect(Math.hypot(rolling.x - started.x, rolling.z - started.z)).toBeGreaterThan(0);

  let state = rolling;
  for (let i = 0; i < 20; i += 1) {
    state = stepAircraft(state, { throttle: 0, turn: 0, flapping: false }, 0.25);
  }
  expect(state.moving).toBe(false);
  expect(state.speed).toBe(0);
  expect(state.altitude).toBe(FLIGHT.minAltitude);
});
