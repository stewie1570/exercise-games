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

export const openCameraStream = async ({
  getUserMedia = defaultGetUserMedia,
  enumerateDevices = defaultEnumerateDevices,
  delay = defaultDelay,
  retries = 3,
  retryDelayMs = 250,
} = {}) => {
  const constraints = { audio: false, video: true };
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
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
