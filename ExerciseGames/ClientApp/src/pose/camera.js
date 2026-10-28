export const cameraErrorMessage = (err) => {
  const name = err?.name;
  const detail = [name, err?.message].filter(Boolean).join(": ");

  if (name === "NotFoundError" || /requested device not found/i.test(err?.message || "")) {
    return "No camera was found. Connect a camera and try again.";
  }
  if (name === "NotAllowedError") {
    return "Camera permission was blocked. Allow camera access and try again.";
  }
  if (name === "NotReadableError") {
    return `The browser couldn't start the camera${detail ? ` (${detail})` : "."}`;
  }
  return detail || "Could not start the camera.";
};

export const stopMediaStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const defaultGetUserMedia = (constraints) => navigator.mediaDevices.getUserMedia(constraints);
const defaultEnumerateDevices = () =>
  navigator.mediaDevices.enumerateDevices?.() ?? Promise.resolve([]);
const defaultDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The lite pose model resamples every frame to 256px. A 720p capture spends
// camera and GPU time on pixels that never reach the tracker.
export const CAMERA_VIDEO_CONSTRAINTS = {
  width: { ideal: 640, max: 640 },
  height: { ideal: 480, max: 480 },
  frameRate: { ideal: 30, max: 30 },
};

export const RELAXED_CAMERA_VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30 },
};

const constraintProfiles = [
  CAMERA_VIDEO_CONSTRAINTS,
  RELAXED_CAMERA_VIDEO_CONSTRAINTS,
  true,
];

const isOverConstrained = (err) =>
  err?.name === "OverconstrainedError" || err?.name === "ConstraintNotSatisfiedError";

const openWithRetries = async (constraints, {
  getUserMedia,
  enumerateDevices,
  delay,
  retries,
  retryDelayMs,
}) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      if (attempt > 1) {
        await delay(retryDelayMs * (attempt - 1));
        await enumerateDevices().catch(() => {});
      }
      return await getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      const retryable = err?.name === "NotReadableError" || err?.name === "AbortError";
      if (!retryable || attempt === retries) {
        throw err;
      }
    }
  }
  throw lastError;
};

export const openCameraStream = async ({
  getUserMedia = defaultGetUserMedia,
  enumerateDevices = defaultEnumerateDevices,
  delay = defaultDelay,
  retries = 3,
  retryDelayMs = 250,
} = {}) => {
  let lastError;

  for (let profile = 0; profile < constraintProfiles.length; profile += 1) {
    try {
      return await openWithRetries(
        { audio: false, video: constraintProfiles[profile] },
        { getUserMedia, enumerateDevices, delay, retries, retryDelayMs }
      );
    } catch (err) {
      lastError = err;
      const canLoosen = profile < constraintProfiles.length - 1 && isOverConstrained(err);
      if (!canLoosen) {
        throw err;
      }
    }
  }

  throw lastError;
};

export const waitForVideo = (video) =>
  new Promise((resolve, reject) => {
    if (!video) {
      reject(new Error("Camera view is not ready."));
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      resolve(video);
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the camera stream."));
    }, 8000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };

    const onReady = () => {
      cleanup();
      resolve(video);
    };

    const onError = () => {
      cleanup();
      reject(video.error || new Error("The camera stream failed to start."));
    };

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
  });
