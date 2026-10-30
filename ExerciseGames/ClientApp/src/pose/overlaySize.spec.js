import { detectionSize, overlayBitmapSize } from "./overlaySize";

test("overlay bitmap stays within the preview and the camera frame", () => {
  expect(overlayBitmapSize({
    clientWidth: 220,
    videoWidth: 640,
    videoHeight: 480,
    dpr: 2,
  })).toEqual({ width: 330, height: 248 });

  expect(overlayBitmapSize({
    clientWidth: 900,
    videoWidth: 1280,
    videoHeight: 720,
    dpr: 2,
  }).width).toBeLessThanOrEqual(640);

  expect(overlayBitmapSize({
    clientWidth: 900,
    videoWidth: 480,
    videoHeight: 360,
    dpr: 2,
  }).width).toBe(480);
});

test("detection is downscaled only when the camera frame is larger than the model needs", () => {
  expect(detectionSize(640, 480)).toBeNull();
  expect(detectionSize(1280, 720)).toEqual({ width: 640, height: 360 });
});
