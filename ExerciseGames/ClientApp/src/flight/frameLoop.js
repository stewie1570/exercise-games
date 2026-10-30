export const ACTIVE_FRAME_MS = 1000 / 60;
export const IDLE_FRAME_MS = 1000 / 30;

export const startPacedLoop = (step, {
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (id) => cancelAnimationFrame(id),
} = {}) => {
  let lastStep = 0;
  let next = 0;
  let started = false;
  let stopped = false;
  let frameId = 0;

  const loop = (timestamp) => {
    if (stopped) {
      return;
    }
    frameId = requestFrame(loop);
    if (!started) {
      started = true;
      lastStep = timestamp;
      next = timestamp;
    }
    if (timestamp + 0.5 < next) {
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (timestamp - lastStep) / 1000));
    lastStep = timestamp;
    const requested = Number(step(dt, timestamp));
    const frameMs = requested > 0 ? requested : ACTIVE_FRAME_MS;
    next += frameMs;
    if (next < timestamp + 1) {
      next = timestamp + frameMs;
    }
  };

  frameId = requestFrame(loop);
  return () => {
    stopped = true;
    cancelFrame(frameId);
  };
};
