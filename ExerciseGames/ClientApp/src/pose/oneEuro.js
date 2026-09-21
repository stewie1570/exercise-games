const TAU_TWO_PI = 2 * Math.PI;

const alphaFromCutoff = (dt, cutoff) => {
  const tau = 1 / (TAU_TWO_PI * cutoff);
  return 1 / (1 + tau / dt);
};

const lowpass = (value, previous, alpha) => alpha * value + (1 - alpha) * previous;

export class OneEuroFilter {
  constructor({ minCutoff = 1, beta = 0.007, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }

  filter(value, timeMs) {
    if (value == null || Number.isNaN(value)) {
      return this.xPrev;
    }

    if (this.xPrev == null || this.tPrev == null) {
      this.xPrev = value;
      this.dxPrev = 0;
      this.tPrev = timeMs;
      return value;
    }

    const dt = Math.max((timeMs - this.tPrev) / 1000, 1e-3);
    const dx = (value - this.xPrev) / dt;
    const dxHat = lowpass(dx, this.dxPrev, alphaFromCutoff(dt, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = lowpass(value, this.xPrev, alphaFromCutoff(dt, cutoff));

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = timeMs;
    return xHat;
  }
}
