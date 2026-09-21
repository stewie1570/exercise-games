import { PoseSmoother } from "./poseSmoother";

const landmark = (x, y, visibility = 1) => ({ x, y, z: 0, visibility });

const pose = (overrides = {}) =>
  Array.from({ length: 33 }, () => landmark(0.5, 0.5, 0)).map((point, index) =>
    overrides[index] ? { ...point, ...overrides[index] } : point
  );

test("missing a frame briefly keeps the last landmarks", () => {
  const smoother = new PoseSmoother();
  const first = smoother.apply(pose({ 0: landmark(0.4, 0.4) }), 0);
  const held = smoother.apply(undefined, 80);

  expect(held.landmarks).toBe(first.landmarks);
  expect(held.pose.detected).toBe(true);
});

test("a dropped pose expires after the hold window", () => {
  const smoother = new PoseSmoother();
  smoother.apply(pose({ 0: landmark(0.4, 0.4) }), 0);
  const expired = smoother.apply(undefined, 250);

  expect(expired.landmarks).toBeNull();
  expect(expired.pose.detected).toBe(false);
});

test("visibility uses hysteresis so landmarks do not pop in and out", () => {
  const smoother = new PoseSmoother();
  const shown = smoother.apply(pose({ 11: landmark(0.6, 0.4, 0.9) }), 0);
  expect(shown.landmarks[11].visibility).toBe(1);

  const stillShown = smoother.apply(pose({ 11: landmark(0.6, 0.4, 0.4) }), 33);
  expect(stillShown.landmarks[11].visibility).toBe(1);

  const hidden = smoother.apply(pose({ 11: landmark(0.6, 0.4, 0.2) }), 66);
  expect(hidden.landmarks[11].visibility).toBe(0);
});

test("noisy landmark positions are smoothed", () => {
  const smoother = new PoseSmoother();
  const xs = [0.5, 0.54, 0.46, 0.53, 0.47, 0.52, 0.48, 0.51];
  const smoothedXs = xs.map((x, index) =>
    smoother.apply(pose({ 0: landmark(x, 0.3) }), index * 33).landmarks[0].x
  );

  const inputSpread = Math.max(...xs) - Math.min(...xs);
  const outputSpread = Math.max(...smoothedXs.slice(3)) - Math.min(...smoothedXs.slice(3));
  expect(outputSpread).toBeLessThan(inputSpread);
});
