import { vi } from "vitest";
import { cameraErrorMessage, openCameraStream, stopMediaStream } from "./camera";

test("NotReadableError mentions the browser could not start the camera", () => {
  expect(
    cameraErrorMessage({ name: "NotReadableError", message: "Starting videoinput failed" })
  ).toMatch(/couldn't start the camera/i);
});

test("permission and missing-device errors stay specific", () => {
  expect(cameraErrorMessage({ name: "NotAllowedError", message: "denied" })).toMatch(/permission/);
  expect(cameraErrorMessage({ name: "NotFoundError", message: "Requested device not found" })).toMatch(
    /No camera was found/
  );
});

test("stopMediaStream stops every track", () => {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  stopMediaStream({ getTracks: () => tracks });
  expect(tracks[0].stop).toHaveBeenCalledTimes(1);
  expect(tracks[1].stop).toHaveBeenCalledTimes(1);
});

test("openCameraStream retries NotReadableError then succeeds", async () => {
  const stream = { id: "cam" };
  const getUserMedia = vi
    .fn()
    .mockRejectedValueOnce({ name: "NotReadableError", message: "Starting videoinput failed" })
    .mockResolvedValueOnce(stream);
  const enumerateDevices = vi.fn().mockResolvedValue([]);
  const delay = vi.fn().mockResolvedValue();

  await expect(
    openCameraStream({ getUserMedia, enumerateDevices, delay, retries: 3, retryDelayMs: 250 })
  ).resolves.toBe(stream);

  expect(getUserMedia).toHaveBeenCalledTimes(2);
  expect(delay).toHaveBeenCalledWith(250);
  expect(enumerateDevices).toHaveBeenCalledTimes(1);
});

test("openCameraStream does not retry permission errors", async () => {
  const getUserMedia = vi.fn().mockRejectedValue({ name: "NotAllowedError", message: "denied" });

  await expect(openCameraStream({ getUserMedia, retries: 3 })).rejects.toMatchObject({
    name: "NotAllowedError",
  });
  expect(getUserMedia).toHaveBeenCalledTimes(1);
});
