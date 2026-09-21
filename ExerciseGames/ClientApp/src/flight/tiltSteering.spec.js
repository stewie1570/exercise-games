import { steeringFromTilt } from "./tiltSteering";

test("small tilts inside the deadzone do not turn", () => {
  expect(steeringFromTilt({ headTiltDeg: 4, bodyTiltDeg: 3 })).toBe(0);
});

test("tilting right steers right", () => {
  expect(steeringFromTilt({ headTiltDeg: 30, bodyTiltDeg: 30 })).toBeGreaterThan(0);
});

test("tilting left steers left", () => {
  expect(steeringFromTilt({ headTiltDeg: -24, bodyTiltDeg: -20 })).toBeLessThan(0);
});

test("uses whichever of head or body tilt is available", () => {
  expect(steeringFromTilt({ headTiltDeg: 40, bodyTiltDeg: null })).toBeGreaterThan(0);
  expect(steeringFromTilt({ headTiltDeg: null, bodyTiltDeg: null })).toBe(0);
});
