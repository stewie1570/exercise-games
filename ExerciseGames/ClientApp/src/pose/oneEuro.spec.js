import { OneEuroFilter } from "./oneEuro";

test("the first sample is returned unchanged", () => {
  const filter = new OneEuroFilter();
  expect(filter.filter(10, 0)).toBe(10);
});

test("high-frequency noise around a constant is reduced", () => {
  const filter = new OneEuroFilter({ minCutoff: 0.7, beta: 0.05 });
  const noisy = [1, 1.08, 0.93, 1.06, 0.94, 1.04, 0.97, 1.02, 0.96, 1.01];
  const smoothed = noisy.map((value, index) => filter.filter(value, index * 33));
  const last = smoothed[smoothed.length - 1];
  const noiseSpread = Math.max(...noisy) - Math.min(...noisy);
  const smoothSpread = Math.max(...smoothed.slice(4)) - Math.min(...smoothed.slice(4));

  expect(last).toBeGreaterThan(0.9);
  expect(last).toBeLessThan(1.1);
  expect(smoothSpread).toBeLessThan(noiseSpread);
});
