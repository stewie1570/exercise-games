const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const TILT_DEADZONE_DEG = 8;
export const TILT_SCALE_DEG = 28;

export const steeringFromTilt = ({ headTiltDeg, bodyTiltDeg }) => {
  const values = [headTiltDeg, bodyTiltDeg].filter((value) => value != null);
  if (!values.length) {
    return 0;
  }

  const combined = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (Math.abs(combined) < TILT_DEADZONE_DEG) {
    return 0;
  }

  const scaled = combined - Math.sign(combined) * TILT_DEADZONE_DEG;
  return clamp(scaled / TILT_SCALE_DEG, -1, 1);
};
