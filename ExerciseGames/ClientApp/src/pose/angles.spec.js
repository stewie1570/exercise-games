import { computeArmAngles, computeBodyTiltDeg, computeHeadAngles, computePoseAngles } from "./angles";
import { Landmark } from "./landmarks";

const point = (x, y, extras = {}) => ({ x, y, z: 0, visibility: 1, ...extras });

const blankLandmarks = () => Array.from({ length: 33 }, () => point(0, 0, { visibility: 0 }));

const withPoints = (overrides) => {
  const landmarks = blankLandmarks();
  Object.entries(overrides).forEach(([name, value]) => {
    landmarks[Landmark[name]] = value;
  });
  return landmarks;
};

const rotateAround = (pt, origin, tiltDeg) => {
  const rad = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = pt.x - origin.x;
  const y = pt.y - origin.y;
  return point(origin.x + x * cos - y * sin, origin.y + x * sin + y * cos, {
    visibility: pt.visibility,
  });
};

const tiltBody = (overrides, origin, tiltDeg) => {
  const rotated = {};
  Object.entries(overrides).forEach(([name, value]) => {
    rotated[name] = rotateAround(value, origin, -tiltDeg);
  });
  return withPoints(rotated);
};

test("level facing head has zero tilt, turn, and pitch", () => {
  const landmarks = withPoints({
    nose: point(0.5, 0.3),
    leftEar: point(0.62, 0.3),
    rightEar: point(0.38, 0.3),
  });

  expect(computeHeadAngles(landmarks)).toEqual({
    tiltDeg: 0,
    turnDeg: 0,
    pitchDeg: 0,
  });
});

test("head tilt toward the person's right is positive", () => {
  const landmarks = withPoints({
    leftEar: point(0.6, 0.2),
    rightEar: point(0.4, 0.4),
  });

  expect(computeHeadAngles(landmarks).tiltDeg).toBe(45);
});

test("looking up reports positive pitch", () => {
  const landmarks = withPoints({
    nose: point(0.5, 0.24),
    leftEar: point(0.62, 0.3),
    rightEar: point(0.38, 0.3),
  });

  expect(computeHeadAngles(landmarks).pitchDeg).toBe(22.5);
});

test("head turn toward the person's right is positive", () => {
  const landmarks = withPoints({
    nose: point(0.44, 0.3),
    leftEar: point(0.6, 0.3),
    rightEar: point(0.4, 0.3),
  });

  expect(computeHeadAngles(landmarks).turnDeg).toBe(27);
});

test("a hanging straight left arm reports 0° upper arm and 180° elbow", () => {
  const landmarks = withPoints({
    leftShoulder: point(0.6, 0.4),
    leftElbow: point(0.6, 0.6),
    leftWrist: point(0.6, 0.8),
  });

  expect(computeArmAngles(landmarks, "left")).toEqual({
    upperArmDeg: 0,
    elbowDeg: 180,
    forearmDeg: 0,
  });
});

test("arm angles follow the torso so body tilt does not look like the arms moved", () => {
  const origin = { x: 0.5, y: 0.4 };
  const tiltDeg = 40;
  const hanging = tiltBody(
    {
      leftShoulder: point(0.62, 0.4),
      rightShoulder: point(0.38, 0.4),
      leftElbow: point(0.62, 0.58),
      leftWrist: point(0.62, 0.76),
      rightElbow: point(0.38, 0.58),
      rightWrist: point(0.38, 0.76),
    },
    origin,
    tiltDeg
  );

  expect(computeBodyTiltDeg(hanging)).toBeCloseTo(tiltDeg, 0);
  expect(computeArmAngles(hanging, "left").upperArmDeg).toBeCloseTo(0, 0);
  expect(computeArmAngles(hanging, "right").upperArmDeg).toBeCloseTo(0, 0);
  expect(computeArmAngles(hanging, "left").forearmDeg).toBeCloseTo(0, 0);

  const armsOut = tiltBody(
    {
      leftShoulder: point(0.62, 0.4),
      rightShoulder: point(0.38, 0.4),
      leftElbow: point(0.8, 0.4),
      leftWrist: point(0.98, 0.4),
      rightElbow: point(0.2, 0.4),
      rightWrist: point(0.02, 0.4),
    },
    origin,
    tiltDeg
  );

  expect(computeArmAngles(armsOut, "left").upperArmDeg).toBeCloseTo(90, 0);
  expect(computeArmAngles(armsOut, "right").upperArmDeg).toBeCloseTo(90, 0);
});

test("a left arm raised to the side reports about 90° from down", () => {
  const landmarks = withPoints({
    leftShoulder: point(0.6, 0.4),
    leftElbow: point(0.8, 0.4),
    leftWrist: point(1.0, 0.4),
  });

  expect(computeArmAngles(landmarks, "left").upperArmDeg).toBe(90);
  expect(computeArmAngles(landmarks, "left").elbowDeg).toBe(180);
});

test("a right-angle elbow reports 90°", () => {
  const landmarks = withPoints({
    rightShoulder: point(0.4, 0.4),
    rightElbow: point(0.4, 0.6),
    rightWrist: point(0.2, 0.6),
  });

  expect(computeArmAngles(landmarks, "right").elbowDeg).toBe(90);
});

test("computePoseAngles returns empty values when nobody is detected", () => {
  expect(computePoseAngles(undefined).detected).toBe(false);
  expect(computePoseAngles([]).detected).toBe(false);
});

test("body tilt toward the person's right is positive", () => {
  const landmarks = withPoints({
    leftShoulder: point(0.62, 0.38),
    rightShoulder: point(0.38, 0.5),
  });

  expect(computeBodyTiltDeg(landmarks)).toBeGreaterThan(0);
});

test("low-visibility landmarks are ignored", () => {
  const landmarks = withPoints({
    leftShoulder: point(0.6, 0.4, { visibility: 0.1 }),
    leftElbow: point(0.6, 0.6, { visibility: 0.1 }),
    leftWrist: point(0.6, 0.8, { visibility: 0.1 }),
  });

  expect(computeArmAngles(landmarks, "left")).toEqual({
    upperArmDeg: null,
    elbowDeg: null,
    forearmDeg: null,
  });
});
