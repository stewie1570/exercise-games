import { cameraErrorMessage, openCameraStream, stopMediaStream, waitForVideo } from "../pose/camera";
import { computePoseAngles } from "../pose/angles";
import { drawMirroredVideo, drawStickFigure } from "../pose/drawStickFigure";
import { createPoseLandmarker } from "../pose/landmarker";
import { useCallback, useEffect, useRef, useState } from "react";

const emptyPose = {
  detected: false,
  head: { tiltDeg: null, turnDeg: null, pitchDeg: null },
  leftArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
  rightArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
};

const UI_UPDATE_MS = 100;

export const usePoseCamera = ({ videoRef, canvasRef, onPose }) => {
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const lastUiUpdateRef = useRef(0);
  const onPoseRef = useRef(onPose);
  onPoseRef.current = onPose;

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [pose, setPose] = useState(emptyPose);

  const stopLoop = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, [videoRef]);

  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      frameRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    drawMirroredVideo(ctx, video, width, height);

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result?.landmarks?.[0];
        const nextPose = computePoseAngles(landmarks);

        if (landmarks) {
          drawStickFigure(ctx, landmarks, {
            width,
            height,
            mirror: true,
            angles: nextPose,
          });
        }

        const now = performance.now();
        if (now - lastUiUpdateRef.current >= UI_UPDATE_MS) {
          lastUiUpdateRef.current = now;
          setPose(nextPose);
          onPoseRef.current?.(nextPose);
        }
      } catch (err) {
        setError(err?.message || "Pose detection failed.");
      }
    }

    frameRef.current = requestAnimationFrame(renderLoop);
  }, [canvasRef, videoRef]);

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus("loading");
    releaseStream();

    try {
      const stream = await openCameraStream();
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Camera view is not ready.");
      }

      video.srcObject = stream;
      if (video.paused) {
        await video.play();
      }
      await waitForVideo(video);

      if (!landmarkerRef.current) {
        landmarkerRef.current = await createPoseLandmarker();
      }

      setStatus("running");
      stopLoop();
      frameRef.current = requestAnimationFrame(renderLoop);
    } catch (err) {
      stopLoop();
      releaseStream();
      setStatus("idle");
      setError(cameraErrorMessage(err));
    }
  }, [releaseStream, renderLoop, stopLoop, videoRef]);

  const stopCamera = useCallback(() => {
    stopLoop();
    releaseStream();
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    lastVideoTimeRef.current = -1;
    setPose(emptyPose);
    setStatus("idle");
  }, [canvasRef, releaseStream, stopLoop]);

  useEffect(() => () => {
    stopCamera();
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
  }, [stopCamera]);

  return { status, error, pose, startCamera, stopCamera };
};
