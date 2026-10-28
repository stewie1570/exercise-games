export const OVERLAY_MAX_EDGE = 640;
export const DETECT_MAX_EDGE = 640;

export const overlayBitmapSize = ({
  clientWidth = 0,
  videoWidth,
  videoHeight,
  dpr = 1,
} = {}) => {
  const srcW = Math.max(1, videoWidth || 1);
  const srcH = Math.max(1, videoHeight || 1);
  const safeDpr = Math.min(Math.max(dpr || 1, 1), 1.5);
  const cssWidth = clientWidth > 0 ? clientWidth : Math.min(srcW, OVERLAY_MAX_EDGE);
  let width = Math.round(cssWidth * safeDpr);
  width = Math.max(1, Math.min(width, srcW, OVERLAY_MAX_EDGE));
  const longEdge = Math.max(width, Math.round(width * (srcH / srcW)));
  if (longEdge > OVERLAY_MAX_EDGE) {
    width = Math.max(1, Math.round(width * (OVERLAY_MAX_EDGE / longEdge)));
  }
  return {
    width,
    height: Math.max(1, Math.round(width * (srcH / srcW))),
  };
};

// Null means the video frame is already small enough to pass to the landmarker.
export const detectionSize = (videoWidth, videoHeight, maxEdge = DETECT_MAX_EDGE) => {
  const width = Math.max(0, videoWidth || 0);
  const height = Math.max(0, videoHeight || 0);
  const edge = Math.max(width, height);
  if (!edge || edge <= maxEdge) {
    return null;
  }
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};
