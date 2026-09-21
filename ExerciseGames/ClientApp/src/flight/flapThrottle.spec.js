import { ARMS_OUT_DEG, FlapDetector, FULL_FLAPS_PER_SEC } from "./flapThrottle";
import { Landmark } from "../pose/landmarks";

const poseLandmarks = ({ wristY, leftLift = 90, rightLift = 90 }) => {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.8, visibility: 0 }));
  const upper = 0.18;
  const placeArm = (shoulder, outward, liftDeg) => {
    const lift = (liftDeg * Math.PI) / 180;
    return {
      elbow: {
        x: shoulder.x + Math.sin(lift) * upper * outward,
        y: shoulder.y + Math.cos(lift) * upper,
        visibility: 1,
      },
    };
  };

  const leftShoulder = { x: 0.62, y: 0.4, visibility: 1 };
  const rightShoulder = { x: 0.38, y: 0.4, visibility: 1 };
  const left = placeArm(leftShoulder, 1, leftLift);
  const right = placeArm(rightShoulder, -1, rightLift);

  points[Landmark.leftShoulder] = leftShoulder;
  points[Landmark.rightShoulder] = rightShoulder;
  points[Landmark.leftElbow] = left.elbow;
  points[Landmark.rightElbow] = right.elbow;
  points[Landmark.leftWrist] = { x: left.elbow.x, y: wristY, visibility: 1 };
  points[Landmark.rightWrist] = { x: right.elbow.x, y: wristY, visibility: 1 };
  return points;
};

const rotateAround = (pt, origin, tiltDeg) => {
  const rad = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = pt.x - origin.x;
  const y = pt.y - origin.y;
  return {
    x: origin.x + x * cos - y * sin,
    y: origin.y + x * sin + y * cos,
    visibility: pt.visibility ?? 1,
  };
};

const tiltedPose = ({ tiltDeg, leftLift, rightLift, flap }) => {
  const origin = { x: 0.5, y: 0.4 };
  const level = poseLandmarks({
    wristY: 0.55 + flap,
    leftLift,
    rightLift,
  });
  const indices = [
    Landmark.leftShoulder,
    Landmark.rightShoulder,
    Landmark.leftElbow,
    Landmark.rightElbow,
    Landmark.leftWrist,
    Landmark.rightWrist,
  ];
  indices.forEach((index) => {
    level[index] = rotateAround(level[index], origin, -tiltDeg);
  });
  return level;
};

const wave = (hz, detector, samples = 40, lifts = {}) => {
  for (let i = 0; i < samples; i += 1) {
    const t = i * 50;
    const y = 0.55 + Math.sin((t / 1000) * hz * Math.PI * 2) * 0.12;
    detector.update(poseLandmarks({ wristY: y, ...lifts }), t);
  }
};

test("two flaps per second is full throttle and still is zero", () => {
  const cruise = new FlapDetector();
  wave(FULL_FLAPS_PER_SEC, cruise, 80);
  expect(cruise.flapsPerSec).toBeCloseTo(FULL_FLAPS_PER_SEC, 0);
  expect(cruise.throttle).toBeCloseTo(1, 1);
  expect(cruise.armsOut).toBe(true);

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

test("flaps only register when both arms are raised past 40 degrees", () => {
  const hanging = new FlapDetector();
  wave(FULL_FLAPS_PER_SEC, hanging, 80, { leftLift: 0, rightLift: 0 });
  expect(hanging.armsOut).toBe(false);
  expect(hanging.sensed).toBe(false);
  expect(hanging.throttle).toBe(0);

  const oneArm = new FlapDetector();
  wave(FULL_FLAPS_PER_SEC, oneArm, 80, { leftLift: 90, rightLift: 10 });
  expect(oneArm.armsOut).toBe(false);
  expect(oneArm.sensed).toBe(false);

  const justOut = new FlapDetector();
  wave(FULL_FLAPS_PER_SEC, justOut, 80, {
    leftLift: ARMS_OUT_DEG + 5,
    rightLift: ARMS_OUT_DEG + 5,
  });
  expect(justOut.armsOut).toBe(true);
  expect(justOut.sensed).toBe(true);
  expect(justOut.throttle).toBeGreaterThan(0.15);
});

test("dropping both arms stops measuring flaps immediately", () => {
  const detector = new FlapDetector();
  wave(FULL_FLAPS_PER_SEC, detector, 80);
  expect(detector.flapsPerSec).toBeGreaterThan(1);

  detector.update(poseLandmarks({ wristY: 0.55, leftLift: 0, rightLift: 0 }), 4000);
  expect(detector.armsOut).toBe(false);
  expect(detector.flapsPerSec).toBe(0);
});

test("tilting the body does not count as flapping or raising the arms", () => {
  const hanging = new FlapDetector();
  hanging.update(tiltedPose({ tiltDeg: 40, leftLift: 0, rightLift: 0, flap: 0 }), 0);
  expect(hanging.armsOut).toBe(false);

  const detector = new FlapDetector();
  for (let i = 0; i < 50; i += 1) {
    const tiltDeg = Math.sin(i / 5) * 35;
    detector.update(tiltedPose({ tiltDeg, leftLift: 90, rightLift: 90, flap: 0 }), i * 50);
  }
  expect(detector.armsOut).toBe(true);
  expect(detector.sensed).toBe(false);
  expect(detector.throttle).toBe(0);
});

test("flapping still registers while the body is tilted", () => {
  const detector = new FlapDetector();
  for (let i = 0; i < 80; i += 1) {
    const t = i * 50;
    const flap = Math.sin((t / 1000) * FULL_FLAPS_PER_SEC * Math.PI * 2) * 0.12;
    detector.update(tiltedPose({ tiltDeg: 30, leftLift: 90, rightLift: 90, flap }), t);
  }
  expect(detector.armsOut).toBe(true);
  expect(detector.sensed).toBe(true);
  expect(detector.throttle).toBeGreaterThan(0.15);
});
