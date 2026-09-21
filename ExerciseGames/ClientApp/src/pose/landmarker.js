import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export const MEDIAPIPE_VERSION = "1.0.1";
export const WASM_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const createLandmarker = async (vision, delegate) =>
  PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

export const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  try {
    return await createLandmarker(vision, "GPU");
  } catch {
    return createLandmarker(vision, "CPU");
  }
};
