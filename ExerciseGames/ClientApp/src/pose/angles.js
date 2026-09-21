import { Landmark, getLandmark, isVisible, midpoint } from "./landmarks";

const DOWN = { x: 0, y: 1, z: 0 };

export const vectorBetween = (from, to) => {
  if (!from || !to) {
    return null;
  }

  return {
    x: to.x - from.x,
    y: to.y - from.y,
    z: (to.z ?? 0) - (from.z ?? 0),
  };
};

export const magnitude = (vector) => {
  if (!vector) {
    return 0;
  }

  return Math.hypot(vector.x, vector.y, vector.z ?? 0);
};

export const angleBetweenDeg = (u, v) => {
  const mag = magnitude(u) * magnitude(v);
  if (!u || !v || mag === 0) {
    return null;
  }

  const dot = u.x * v.x + u.y * v.y + (u.z ?? 0) * (v.z ?? 0);
  const clamped = Math.min(1, Math.max(-1, dot / mag));
  return (Math.acos(clamped) * 180) / Math.PI;
};

export const signedAngle2dDeg = (from, to) => {
  if (!from || !to) {
    return null;
  }

  const cross = from.x * to.y - from.y * to.x;
  const dot = from.x * to.x + from.y * to.y;
  if (cross === 0 && dot === 0) {
    return null;
  }

  return (Math.atan2(cross, dot) * 180) / Math.PI;
};

export const roundAngle = (value) => {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const requiredVisible = (...points) => points.every((point) => isVisible(point));

// Image y grows downward. The result points toward the feet, perpendicular to the shoulders.
export const bodyDownVector = (landmarks) => {
  const left = getLandmark(landmarks, Landmark.leftShoulder);
  const right = getLandmark(landmarks, Landmark.rightShoulder);
  if (!requiredVisible(left, right)) {
    return DOWN;
  }

  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) {
    return DOWN;
  }

  return { x: -dy / mag, y: dx / mag, z: 0 };
};

export const computeHeadAngles = (landmarks) => {
  const nose = getLandmark(landmarks, Landmark.nose);
  const leftEar = getLandmark(landmarks, Landmark.leftEar);
  const rightEar = getLandmark(landmarks, Landmark.rightEar);
  const leftEye = getLandmark(landmarks, Landmark.leftEye);
  const rightEye = getLandmark(landmarks, Landmark.rightEye);

  const left = isVisible(leftEar) ? leftEar : leftEye;
  const right = isVisible(rightEar) ? rightEar : rightEye;

  if (!requiredVisible(left, right)) {
    return { tiltDeg: null, turnDeg: null, pitchDeg: null };
  }

  // Image x grows to the right of the camera frame. A person facing the camera
  // has their anatomical left on the +x side of the image.
  // 0° is level. Positive tilt is toward the person's right shoulder.
  const tiltDeg = roundAngle(
    -((Math.atan2(left.y - right.y, left.x - right.x) * 180) / Math.PI)
  );

  const earMid = midpoint(left, right);
  const earSpan = left.x - right.x;
  const noseVisible = isVisible(nose);

  // 0° is facing the camera. Positive turn is toward the person's right.
  const turnDeg = noseVisible && Math.abs(earSpan) > 1e-6
    ? roundAngle(((earMid.x - nose.x) / (earSpan / 2)) * (45 / 1))
    : null;

  // 0° is looking straight. Positive pitch is looking up.
  const pitchDeg = noseVisible && Math.abs(earSpan) > 1e-6
    ? roundAngle(((earMid.y - nose.y) / (Math.abs(earSpan) / 2)) * 45)
    : null;

  return { tiltDeg, turnDeg, pitchDeg };
};

export const computeArmAngles = (landmarks, side, bodyDown) => {
  const shoulder = getLandmark(
    landmarks,
    side === "left" ? Landmark.leftShoulder : Landmark.rightShoulder
  );
  const elbow = getLandmark(
    landmarks,
    side === "left" ? Landmark.leftElbow : Landmark.rightElbow
  );
  const wrist = getLandmark(
    landmarks,
    side === "left" ? Landmark.leftWrist : Landmark.rightWrist
  );

  const upperArm = vectorBetween(shoulder, elbow);
  const forearm = vectorBetween(elbow, wrist);
  const down = bodyDown ?? bodyDownVector(landmarks);

  // 0° hangs down along the torso, 90° is out to the side, 180° is straight up.
  const upperArmDeg = requiredVisible(shoulder, elbow)
    ? roundAngle(angleBetweenDeg(down, upperArm))
    : null;

  // 180° is a straight arm, smaller values are a tighter bend.
  const elbowDeg = requiredVisible(shoulder, elbow, wrist)
    ? roundAngle(angleBetweenDeg(vectorBetween(elbow, shoulder), forearm))
    : null;

  const forearmDeg = requiredVisible(elbow, wrist)
    ? roundAngle(angleBetweenDeg(down, forearm))
    : null;

  return { upperArmDeg, elbowDeg, forearmDeg };
};

export const computeBodyTiltDeg = (landmarks) => {
  const left = getLandmark(landmarks, Landmark.leftShoulder);
  const right = getLandmark(landmarks, Landmark.rightShoulder);

  if (!requiredVisible(left, right)) {
    return null;
  }

  return roundAngle(
    -((Math.atan2(left.y - right.y, left.x - right.x) * 180) / Math.PI)
  );
};

export const computePoseAngles = (landmarks) => {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return {
      detected: false,
      head: { tiltDeg: null, turnDeg: null, pitchDeg: null },
      body: { tiltDeg: null },
      leftArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
      rightArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
    };
  }

  const bodyDown = bodyDownVector(landmarks);
  return {
    detected: true,
    head: computeHeadAngles(landmarks),
    body: { tiltDeg: computeBodyTiltDeg(landmarks) },
    leftArm: computeArmAngles(landmarks, "left", bodyDown),
    rightArm: computeArmAngles(landmarks, "right", bodyDown),
  };
};
