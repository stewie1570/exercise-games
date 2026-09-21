import { Landmark, getLandmark, isVisible } from "../pose/landmarks";

const MIN_AMPLITUDE = 0.016;
export const FULL_FLAPS_PER_SEC = 2;
const MIN_INTERVAL_MS = 120;
const MAX_INTERVAL_MS = 1500;
const DUAL_ARM_DEBOUNCE_MS = 90;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const THROTTLE_TAU = 0.55;

export class FlapDetector {
  constructor() {
    this.reset();
  }

  reset() {
    this.left = new WristMotion();
    this.right = new WristMotion();
    this.beats = [];
    this.lastBeatAt = 0;
    this.lastTickAt = 0;
    this.throttle = 0;
    this.flapsPerSec = 0;
    this.sensed = false;
  }

  update(landmarks, timeMs) {
    const leftAmp = this.left.sample(wristHeight(landmarks, Landmark.leftWrist));
    const rightAmp = this.right.sample(wristHeight(landmarks, Landmark.rightWrist));
    const amplitude = Math.max(leftAmp, rightAmp);
    if (amplitude >= MIN_AMPLITUDE && timeMs - this.lastBeatAt >= DUAL_ARM_DEBOUNCE_MS) {
      this.registerBeat(timeMs);
    }

    return this.tick(timeMs);
  }

  registerBeat(timeMs) {
    this.beats.push(timeMs);
    this.lastBeatAt = timeMs;
    this.sensed = true;
  }

  tick(timeMs) {
    this.refresh(timeMs);
    this.lastTickAt = timeMs;
    return this.throttle;
  }

  refresh(timeMs) {
    const dt = this.lastTickAt ? Math.max(0, (timeMs - this.lastTickAt) / 1000) : 0;
    this.beats = this.beats.filter((beat) => timeMs - beat <= MAX_INTERVAL_MS);
    this.flapsPerSec = measuredFlapsPerSec(this.beats, timeMs);
    const target = clamp(this.flapsPerSec / FULL_FLAPS_PER_SEC, 0, 1);
    this.throttle = expFollow(this.throttle, target, dt, THROTTLE_TAU);
    if (target === 0 && this.throttle < 0.01) {
      this.throttle = 0;
    }
  }
}

export const wristHeight = (landmarks, landmark) => {
  const point = getLandmark(landmarks, landmark);
  if (!isVisible(point)) {
    return null;
  }

  // Image y grows downward, so invert so flapping up increases this value.
  return 1 - point.y;
};

class WristMotion {
  constructor() {
    this.reset();
  }

  reset() {
    this.prevY = null;
    this.prevDy = 0;
    this.lastValleyY = null;
  }

  sample(y) {
    if (y == null) {
      return 0;
    }

    if (this.prevY == null) {
      this.prevY = y;
      return 0;
    }

    const dy = y - this.prevY;
    const peaked = this.prevDy > 0 && dy <= 0;
    const valleied = this.prevDy < 0 && dy >= 0;
    if (valleied) {
      this.lastValleyY = y;
    }

    let amplitude = 0;
    if (peaked && this.lastValleyY != null) {
      amplitude = Math.abs(y - this.lastValleyY);
    }

    this.prevDy = dy;
    this.prevY = y;
    return amplitude;
  }
}

const measuredFlapsPerSec = (beats, timeMs) => {
  if (beats.length < 2) {
    return 0;
  }

  const last = beats[beats.length - 1];
  const prev = beats[beats.length - 2];
  const interval = last - prev;
  const sinceLast = timeMs - last;
  const overdue = Math.max(interval * 1.3, 400);
  if (sinceLast > overdue) {
    return 0;
  }

  const intervals = [];
  for (let i = 1; i < beats.length; i += 1) {
    const gap = beats[i] - beats[i - 1];
    if (gap >= MIN_INTERVAL_MS && gap <= MAX_INTERVAL_MS) {
      intervals.push(gap);
    }
  }
  if (!intervals.length) {
    return 0;
  }

  return 1000 / median(intervals);
};

const expFollow = (current, target, dt, tau) => {
  if (dt <= 0) {
    return current;
  }
  if (tau <= 1e-6) {
    return target;
  }
  return target + (current - target) * Math.exp(-dt / tau);
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
