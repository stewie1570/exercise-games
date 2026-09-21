import { bodyDownVector, computeArmAngles } from "../pose/angles";
import { Landmark, getLandmark, isVisible } from "../pose/landmarks";

const MIN_AMPLITUDE = 0.016;
export const FULL_FLAPS_PER_SEC = 2;
export const ARMS_OUT_DEG = 40;
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
    this.armsOut = false;
  }

  update(landmarks, timeMs, pose) {
    this.armsOut = armsAreOut(landmarks, pose);
    const leftAmp = this.left.sample(wristHeight(landmarks, Landmark.leftWrist));
    const rightAmp = this.right.sample(wristHeight(landmarks, Landmark.rightWrist));
    const amplitude = Math.max(leftAmp, rightAmp);
    if (
      this.armsOut &&
      amplitude >= MIN_AMPLITUDE &&
      timeMs - this.lastBeatAt >= DUAL_ARM_DEBOUNCE_MS
    ) {
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
    this.flapsPerSec = this.armsOut ? measuredFlapsPerSec(this.beats, timeMs) : 0;
    const target = clamp(this.flapsPerSec / FULL_FLAPS_PER_SEC, 0, 1);
    this.throttle = expFollow(this.throttle, target, dt, THROTTLE_TAU);
    if (target === 0 && this.throttle < 0.01) {
      this.throttle = 0;
    }
  }
}

export const armsAreOut = (landmarks, pose) => {
  const left = pose?.leftArm?.upperArmDeg ?? computeArmAngles(landmarks, "left").upperArmDeg;
  const right = pose?.rightArm?.upperArmDeg ?? computeArmAngles(landmarks, "right").upperArmDeg;
  return left != null && right != null && left > ARMS_OUT_DEG && right > ARMS_OUT_DEG;
};

export const wristHeight = (landmarks, landmark) => {
  const point = getLandmark(landmarks, landmark);
  if (!isVisible(point)) {
    return null;
  }

  const shoulderIndex =
    landmark === Landmark.leftWrist ? Landmark.leftShoulder : Landmark.rightShoulder;
  const shoulder = getLandmark(landmarks, shoulderIndex);
  const down = bodyDownVector(landmarks);
  const origin = isVisible(shoulder) ? shoulder : { x: 0, y: 0 };
  const rx = point.x - origin.x;
  const ry = point.y - origin.y;
  // Height along the torso, opposite body-down, so flapping up increases this value.
  return -(rx * down.x + ry * (down.y ?? 0));
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
