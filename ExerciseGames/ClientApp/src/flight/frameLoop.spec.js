import { ACTIVE_FRAME_MS, startPacedLoop } from "./frameLoop";

test("paced loop skips callbacks inside the frame budget", () => {
  const steps = [];
  let queued = null;
  const stop = startPacedLoop((dt, now) => {
    steps.push([now, dt]);
    return now === 1000 ? ACTIVE_FRAME_MS : 40;
  }, {
    requestFrame: (callback) => {
      queued = callback;
      return 7;
    },
    cancelFrame: () => {},
  });

  queued(1000);
  queued(1010);
  queued(1000 + ACTIVE_FRAME_MS);
  expect(steps.map(([now]) => now)).toEqual([1000, 1000 + ACTIVE_FRAME_MS]);
  expect(steps[1][1]).toBeCloseTo(ACTIVE_FRAME_MS / 1000);

  const third = 1000 + ACTIVE_FRAME_MS + 40;
  queued(third - 10);
  queued(third);
  expect(steps[2][0]).toBe(third);
  expect(steps[2][1]).toBeCloseTo(0.04);
  stop();
  queued(third + 500);
  expect(steps).toHaveLength(3);
});
