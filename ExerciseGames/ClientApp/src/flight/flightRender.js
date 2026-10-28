export const MAX_PIXEL_RATIO = 1;
export const MAX_RENDER_EDGE = 1920;

export const flightPixelRatio = (cssWidth, cssHeight, deviceRatio = 1) => {
  const safeDevice = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  let ratio = Math.min(safeDevice, MAX_PIXEL_RATIO);
  const edge = Math.max(cssWidth || 0, cssHeight || 0);
  if (edge > 0 && edge * ratio > MAX_RENDER_EDGE) {
    ratio = MAX_RENDER_EDGE / edge;
  }
  return Math.max(ratio, 0.35);
};

export const flightRendererParameters = () => ({
  antialias: true,
  alpha: false,
  stencil: false,
  depth: true,
  // Low-poly scene: avoid pinning a discrete GPU at high clocks.
  powerPreference: "low-power",
});
