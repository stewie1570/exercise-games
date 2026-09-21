import { FlapDetector, FULL_FLAPS_PER_SEC } from "./flapThrottle";
import { Landmark } from "../pose/landmarks";

const wrist = (y) => {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.8, visibility: 0 }));
  points[Landmark.leftWrist] = { x: 0.4, y, visibility: 1 };
  points[Landmark.rightWrist] = { x: 0.6, y, visibility: 1 };
  return points;
};

const wave = (hz, detector, samples = 40) => {
  for (let i = 0; i < samples; i += 1) {
    const t = i * 50;
    const y = 0.55 + Math.sin((t / 1000) * hz * Math.PI * 2) * 0.12;
    detector.update(wrist(y), t);
  }
};

test("two flaps per second is full throttle and still is zero", () => {
  const cruise = new FlapDetector();
  wave(FULL_FLAPS_PER_SEC, cruise, 80);
  expect(cruise.flapsPerSec).toBeCloseTo(FULL_FLAPS_PER_SEC, 0);
  expect(cruise.throttle).toBeCloseTo(1, 1);

  const half = new FlapDetector();
  wave(1, half, 80);
  expect(half.throttle).toBeGreaterThan(0.15);
  expect(half.throttle).toBeLessThan(cruise.throttle);

  cruise.tick(12000);
  expect(cruise.throttle).toBeCloseTo(0, 1);
  expect(cruise.flapsPerSec).toBe(0);
});

test("faster flapping produces more throttle than slow flapping", () => {
  const slow = new FlapDetector();
  const fast = new FlapDetector();
  wave(1.2, slow, 80);
  wave(3.2, fast, 80);
  expect(fast.throttle).toBeGreaterThan(slow.throttle);
  expect(fast.throttle).toBeCloseTo(1, 1);
});

test("the first full flap stroke is sensed", () => {
  const detector = new FlapDetector();
  wave(2, detector, 20);
  expect(detector.sensed).toBe(true);
});
