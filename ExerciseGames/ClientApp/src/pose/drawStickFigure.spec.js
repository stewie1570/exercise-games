import { drawMirroredVideo, drawStickFigure } from "./drawStickFigure";
import { Landmark } from "./landmarks";

const mockContext = () => {
  const calls = [];
  const ctx = {
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    stroke: () => calls.push(["stroke"]),
    fill: () => calls.push(["fill"]),
    arc: (...args) => calls.push(["arc", ...args]),
    strokeText: (...args) => calls.push(["strokeText", ...args]),
    fillText: (...args) => calls.push(["fillText", ...args]),
    translate: (...args) => calls.push(["translate", ...args]),
    scale: (...args) => calls.push(["scale", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    lineJoin: "",
    lineCap: "",
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
  };
  return { ctx, calls };
};

const point = (x, y) => ({ x, y, visibility: 1 });

const landmarks = () => {
  const list = Array.from({ length: 33 }, () => point(0, 0));
  list[Landmark.nose] = point(0.5, 0.2);
  list[Landmark.leftEar] = point(0.58, 0.22);
  list[Landmark.rightEar] = point(0.42, 0.22);
  list[Landmark.leftShoulder] = point(0.62, 0.4);
  list[Landmark.rightShoulder] = point(0.38, 0.4);
  list[Landmark.leftElbow] = point(0.7, 0.55);
  list[Landmark.rightElbow] = point(0.3, 0.55);
  list[Landmark.leftWrist] = point(0.78, 0.7);
  list[Landmark.rightWrist] = point(0.22, 0.7);
  list[Landmark.leftHip] = point(0.58, 0.75);
  list[Landmark.rightHip] = point(0.42, 0.75);
  return list;
};

test("drawStickFigure traces head and both arms", () => {
  const { ctx, calls } = mockContext();

  drawStickFigure(ctx, landmarks(), {
    width: 100,
    height: 100,
    mirror: false,
    angles: {
      head: { tiltDeg: 5, turnDeg: 0 },
      leftArm: { upperArmDeg: 20, elbowDeg: 160 },
      rightArm: { upperArmDeg: 18, elbowDeg: 150 },
    },
  });

  const moveAndLine = calls.filter(([name]) => name === "moveTo" || name === "lineTo");
  expect(moveAndLine.length).toBeGreaterThan(8);
  expect(calls.some(([name]) => name === "arc")).toBe(true);
  expect(calls.some(([, text]) => text === "tilt 5°  turn 0°")).toBe(true);
  expect(calls.some(([, text]) => text === "160°")).toBe(true);
  expect(calls.some(([, text]) => text === "150°")).toBe(true);
});

test("drawStickFigure mirrors landmark x when requested", () => {
  const { ctx, calls } = mockContext();
  drawStickFigure(ctx, landmarks(), { width: 100, height: 100, mirror: true });

  const leftShoulderMove = calls.find(
    ([name, x, y]) => name === "moveTo" && x === 38 && y === 40
  );
  expect(leftShoulderMove).toBeTruthy();
});

test("drawMirroredVideo flips the camera frame", () => {
  const { ctx, calls } = mockContext();
  const video = {};
  drawMirroredVideo(ctx, video, 200, 100);

  expect(calls).toEqual([
    ["save"],
    ["translate", 200, 0],
    ["scale", -1, 1],
    ["drawImage", video, 0, 0, 200, 100],
    ["restore"],
  ]);
});
