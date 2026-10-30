import { cameraErrorMessage, openCameraStream, stopMediaStream, waitForVideo } from "../pose/camera";
import { drawMirroredVideo, drawStickFigure } from "../pose/drawStickFigure";
import { createPoseLandmarker } from "../pose/landmarker";
import { detectionSize, overlayBitmapSize } from "../pose/overlaySize";
import { PoseSmoother } from "../pose/poseSmoother";
import { useCallback, useEffect, useRef, useState } from "react";

const emptyPose = {
  detected: false,
  head: { tiltDeg: null, turnDeg: null, pitchDeg: null },
  body: { tiltDeg: null },
  leftArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
  rightArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
};

const UI_UPDATE_MS = 100;

const detectionSource = (video, cache) => {
  const size = detectionSize(video.videoWidth, video.videoHeight);
  if (!size) {
    return video;
  }
  if (!cache.canvas) {
    cache.canvas = document.createElement("canvas");
    cache.ctx = cache.canvas.getContext("2d", { alpha: false });
  }
  if (cache.canvas.width !== size.width || cache.canvas.height !== size.height) {
    cache.canvas.width = size.width;
    cache.canvas.height = size.height;
  }
  cache.ctx.drawImage(video, 0, 0, size.width, size.height);
  return cache.canvas;
};

export const usePoseCamera = ({
  videoRef,
  canvasRef,
  onPose,
  onFrame,
  autoStart = false,
  annotate = true,
  publishPose = true,
}) => {
  const landmarkerRef = useRef(null);
  const smootherRef = useRef(new PoseSmoother());
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const lastUiUpdateRef = useRef(0);
  const bitmapRef = useRef(null);
  const detectCacheRef = useRef({ canvas: null, ctx: null });
  const onPoseRef = useRef(onPose);
  const onFrameRef = useRef(onFrame);
  const annotateRef = useRef(annotate);
  const publishPoseRef = useRef(publishPose);
  onPoseRef.current = onPose;
  onFrameRef.current = onFrame;
  annotateRef.current = annotate;
  publishPoseRef.current = publishPose;

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

    const frameChanged = video.currentTime !== lastVideoTimeRef.current;
    if (!frameChanged && bitmapRef.current) {
      frameRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    if (frameChanged) {
      lastVideoTimeRef.current = video.currentTime;
    }

    const cached = bitmapRef.current;
    if (!cached || cached.pendingLayout || cached.videoWidth !== width || cached.videoHeight !== height) {
      const cssWidth = canvas.clientWidth;
      const next = overlayBitmapSize({
        clientWidth: cssWidth,
        videoWidth: width,
        videoHeight: height,
        dpr: window.devicePixelRatio || 1,
      });
      bitmapRef.current = {
        ...next,
        videoWidth: width,
        videoHeight: height,
        pendingLayout: cssWidth <= 0,
      };
      if (canvas.width !== next.width || canvas.height !== next.height) {
        canvas.width = next.width;
        canvas.height = next.height;
      }
    }

    const bitmap = bitmapRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });
    drawMirroredVideo(ctx, video, bitmap.width, bitmap.height);

    if (frameChanged) {
      try {
        const result = landmarker.detectForVideo(
          detectionSource(video, detectCacheRef.current),
          performance.now()
        );
        overlayRef.current = smootherRef.current.apply(
          result?.landmarks?.[0],
          performance.now()
        );
        onFrameRef.current?.(overlayRef.current);

        const now = performance.now();
        if (
          (publishPoseRef.current || onPoseRef.current)
          && now - lastUiUpdateRef.current >= UI_UPDATE_MS
        ) {
          lastUiUpdateRef.current = now;
          if (publishPoseRef.current) {
            setPose(overlayRef.current.pose);
          }
          onPoseRef.current?.(overlayRef.current.pose);
        }
      } catch (err) {
        setError(err?.message || "Pose detection failed.");
      }
    }

    const overlay = overlayRef.current;
    if (overlay?.landmarks) {
      drawStickFigure(ctx, overlay.landmarks, {
        width: bitmap.width,
        height: bitmap.height,
        mirror: true,
        angles: annotateRef.current ? overlay.pose : undefined,
      });
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
      smootherRef.current.reset();
      overlayRef.current = null;
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
    bitmapRef.current = null;
    overlayRef.current = null;
    smootherRef.current.reset();
    setPose(emptyPose);
    setStatus("idle");
  }, [canvasRef, releaseStream, stopLoop]);

  useEffect(() => {
    const invalidate = () => {
      bitmapRef.current = null;
    };
    window.addEventListener("resize", invalidate);
    document.addEventListener("fullscreenchange", invalidate);
    document.addEventListener("webkitfullscreenchange", invalidate);
    return () => {
      window.removeEventListener("resize", invalidate);
      document.removeEventListener("fullscreenchange", invalidate);
      document.removeEventListener("webkitfullscreenchange", invalidate);
    };
  }, []);

  const didAutoStartRef = useRef(false);
  useEffect(() => {
    if (!autoStart || didAutoStartRef.current) {
      return undefined;
    }
    didAutoStartRef.current = true;
    startCamera();
    return undefined;
  }, [autoStart, startCamera]);

  useEffect(() => () => {
    stopCamera();
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
  }, [stopCamera]);

  return { status, error, pose, startCamera, stopCamera };
};
