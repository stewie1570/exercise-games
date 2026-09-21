import { computePoseAngles, roundAngle } from "./angles";
import { OneEuroFilter } from "./oneEuro";

const LANDMARK_FILTER = { minCutoff: 0.7, beta: 0.08, dCutoff: 1 };
const ANGLE_FILTER = { minCutoff: 0.55, beta: 0.05, dCutoff: 1 };
const SHOW_VISIBILITY = 0.6;
const HIDE_VISIBILITY = 0.35;
const HOLD_MS = 200;

const scoreOf = (landmark) => landmark?.visibility ?? landmark?.presence ?? 1;

const createLandmarkState = () => ({
  x: new OneEuroFilter(LANDMARK_FILTER),
  y: new OneEuroFilter(LANDMARK_FILTER),
  z: new OneEuroFilter(LANDMARK_FILTER),
  visible: false,
});

const createAngleFilters = () => ({
  tiltDeg: new OneEuroFilter(ANGLE_FILTER),
  turnDeg: new OneEuroFilter(ANGLE_FILTER),
  pitchDeg: new OneEuroFilter(ANGLE_FILTER),
  upperArmDeg: new OneEuroFilter(ANGLE_FILTER),
  elbowDeg: new OneEuroFilter(ANGLE_FILTER),
  forearmDeg: new OneEuroFilter(ANGLE_FILTER),
});

const emptyPose = {
  detected: false,
  head: { tiltDeg: null, turnDeg: null, pitchDeg: null },
  leftArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
  rightArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
};

const filterAngle = (filter, value, timeMs) => {
  if (value == null) {
    return roundAngle(filter.xPrev);
  }

  return roundAngle(filter.filter(value, timeMs));
};

export class PoseSmoother {
  constructor(landmarkCount = 33) {
    this.landmarkCount = landmarkCount;
    this.reset();
  }

  reset() {
    this.points = Array.from({ length: this.landmarkCount }, createLandmarkState);
    this.angles = {
      head: createAngleFilters(),
      leftArm: createAngleFilters(),
      rightArm: createAngleFilters(),
    };
    this.lastLandmarks = null;
    this.lastPose = emptyPose;
    this.lastGoodAt = 0;
  }

  apply(rawLandmarks, timeMs) {
    const landmarks = this.smoothLandmarks(rawLandmarks, timeMs);
    if (!landmarks) {
      return { landmarks: null, pose: emptyPose };
    }

    const pose = this.smoothAngles(computePoseAngles(landmarks), timeMs);
    this.lastLandmarks = landmarks;
    this.lastPose = pose;
    this.lastGoodAt = timeMs;
    return { landmarks, pose };
  }

  smoothLandmarks(rawLandmarks, timeMs) {
    if (!Array.isArray(rawLandmarks) || rawLandmarks.length === 0) {
      if (this.lastLandmarks && timeMs - this.lastGoodAt < HOLD_MS) {
        return this.lastLandmarks;
      }
      return null;
    }

    return rawLandmarks.map((landmark, index) => {
      const state = this.points[index] ?? createLandmarkState();
      this.points[index] = state;
      const score = scoreOf(landmark);
      state.visible = state.visible ? score >= HIDE_VISIBILITY : score >= SHOW_VISIBILITY;

      if (!state.visible) {
        return {
          ...landmark,
          visibility: 0,
        };
      }

      return {
        ...landmark,
        x: state.x.filter(landmark.x, timeMs),
        y: state.y.filter(landmark.y, timeMs),
        z: state.z.filter(landmark.z ?? 0, timeMs),
        visibility: 1,
      };
    });
  }

  smoothAngles(pose, timeMs) {
    return {
      detected: pose.detected,
      head: {
        tiltDeg: filterAngle(this.angles.head.tiltDeg, pose.head.tiltDeg, timeMs),
        turnDeg: filterAngle(this.angles.head.turnDeg, pose.head.turnDeg, timeMs),
        pitchDeg: filterAngle(this.angles.head.pitchDeg, pose.head.pitchDeg, timeMs),
      },
      leftArm: {
        upperArmDeg: filterAngle(this.angles.leftArm.upperArmDeg, pose.leftArm.upperArmDeg, timeMs),
        elbowDeg: filterAngle(this.angles.leftArm.elbowDeg, pose.leftArm.elbowDeg, timeMs),
        forearmDeg: filterAngle(this.angles.leftArm.forearmDeg, pose.leftArm.forearmDeg, timeMs),
      },
      rightArm: {
        upperArmDeg: filterAngle(this.angles.rightArm.upperArmDeg, pose.rightArm.upperArmDeg, timeMs),
        elbowDeg: filterAngle(this.angles.rightArm.elbowDeg, pose.rightArm.elbowDeg, timeMs),
        forearmDeg: filterAngle(this.angles.rightArm.forearmDeg, pose.rightArm.forearmDeg, timeMs),
      },
    };
  }
}
