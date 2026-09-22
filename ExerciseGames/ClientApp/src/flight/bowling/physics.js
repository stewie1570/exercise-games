import {
  PIN_COM_Y,
  PIN_HEIGHT,
  PIN_MASS,
  PIN_SPACING,
  PIN_SPHERES,
  PLANE_HULLS,
} from "./dimensions";

const GRAVITY = 9.81;
const RESTITUTION = 0.1;
const GROUND_FRICTION = 4.5;
const ANGULAR_DAMP = 2.8;
const LINEAR_DAMP = 1.2;
const ROLLING_DAMP = 4.8;
const ROLLING_SPEED2 = 4 * 4;
const GROUND_SPIN_DAMP = 6;
const PLANE_RESTITUTION = 0.14;
const MAX_PLANE_DV = 22;
const STANDING_DOT = 0.55;
const SUBSTEP = 1 / 48;
const MAX_SUBSTEPS = 2;
const SLEEP_SPEED2 = 0.5 * 0.5;
const SLEEP_SPIN2 = 0.7 * 0.7;
const SLEEP_TIME = 0;
const PAIR_RANGE2 = (PIN_SPACING * 1.35) ** 2;
const PLANE_RANGE2 = 18 * 18;
const I_BODY = inertia();
const INV_I = [1 / I_BODY[0], 1 / I_BODY[1], 1 / I_BODY[2]];
const UP = [0, 0, 0];
const TMP = [0, 0, 0];
const TMP2 = [0, 0, 0];
const ORIGIN = [0, 0, 0];
const PLANE_VEL = [0, 0, 0];
const PLANE_Q = [0, 0, 0, 1];
const PLANE_Q_INV = [0, 0, 0, 1];
const LOCAL = [0, 0, 0];
const CLOSEST = [0, 0, 0];
const CONTACT = [0, 0, 0];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hypot2 = (x, y, z) => x * x + y * y + z * z;

function inertia() {
  const r = PIN_SPHERES[1].radius;
  const h = PIN_HEIGHT;
  const ix = (PIN_MASS / 12) * (3 * r * r + h * h);
  const iy = 0.5 * PIN_MASS * r * r;
  return [ix, iy, ix];
}

const rotateLocalY = (q, y, out) => {
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  const twoY = y + y;
  out[0] = twoY * (qy * qx - qw * qz);
  out[1] = y - twoY * (qz * qz + qx * qx);
  out[2] = twoY * (qw * qx + qy * qz);
  return out;
};

const rotateInto = (q, vx, vy, vz, out) => {
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + qy * tz - qz * ty;
  out[1] = vy + qw * ty + qz * tx - qx * tz;
  out[2] = vz + qw * tz + qx * ty - qy * tx;
  return out;
};

export const pinFallen = (pin) => rotateLocalY(pin.q, 1, UP)[1] < STANDING_DOT;

export const sphereWorld = (pin, sphere) => {
  const localY = sphere.y - PIN_COM_Y;
  const out = [0, 0, 0];
  rotateLocalY(pin.q, localY, out);
  out[0] += pin.p[0];
  out[1] += pin.p[1];
  out[2] += pin.p[2];
  return out;
};

const writeSpheres = (pin) => {
  const px = pin.p[0];
  const py = pin.p[1];
  const pz = pin.p[2];
  for (let i = 0; i < PIN_SPHERES.length; i += 1) {
    const out = pin.sw[i];
    rotateLocalY(pin.q, PIN_SPHERES[i].y - PIN_COM_Y, out);
    out[0] += px;
    out[1] += py;
    out[2] += pz;
  }
};

export const planeVelocity = (state) => [
  Math.sin(state.heading) * (state.speed || 0),
  state.climbRate || 0,
  -Math.cos(state.heading) * (state.speed || 0),
];

const yawQuat = (heading, out) => {
  const half = -heading * 0.5;
  out[0] = 0;
  out[1] = Math.sin(half);
  out[2] = 0;
  out[3] = Math.cos(half);
  return out;
};

const wake = (pin) => {
  pin.sleeping = false;
  pin.still = 0;
};

export const createPinBody = (x, z) => {
  const pin = {
    rest: [x, PIN_COM_Y, z],
    p: [x, PIN_COM_Y, z],
    q: [0, 0, 0, 1],
    v: [0, 0, 0],
    w: [0, 0, 0],
    sw: PIN_SPHERES.map((sphere) => [x, sphere.y, z]),
    mass: PIN_MASS,
    invMass: 1 / PIN_MASS,
    sleeping: true,
    still: 0,
    dirty: true,
  };
  writeSpheres(pin);
  return pin;
};

export const resetPin = (pin) => {
  pin.p[0] = pin.rest[0];
  pin.p[1] = pin.rest[1];
  pin.p[2] = pin.rest[2];
  pin.q[0] = 0;
  pin.q[1] = 0;
  pin.q[2] = 0;
  pin.q[3] = 1;
  pin.v[0] = 0;
  pin.v[1] = 0;
  pin.v[2] = 0;
  pin.w[0] = 0;
  pin.w[1] = 0;
  pin.w[2] = 0;
  pin.sleeping = true;
  pin.still = 0;
  pin.dirty = true;
  writeSpheres(pin);
};

export const stepPins = (pins, { state, dt, planeHit }) => {
  const steps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(dt / SUBSTEP)));
  const h = dt / steps;
  let hit = false;
  let moving = false;

  for (let i = 0; i < pins.length; i += 1) {
    const pin = pins[i];
    if (pin.inactive) {
      continue;
    }
    if (pin.sleeping && hypot2(pin.v[0], pin.v[1], pin.v[2]) <= SLEEP_SPEED2
      && hypot2(pin.w[0], pin.w[1], pin.w[2]) <= SLEEP_SPIN2) {
      continue;
    }
    pin.sleeping = false;
    moving = true;
  }

  let planeNear = false;
  if (planeHit && state) {
    yawQuat(state.heading || 0, PLANE_Q);
    ORIGIN[0] = state.x;
    ORIGIN[1] = state.altitude;
    ORIGIN[2] = state.z;
    PLANE_VEL[0] = Math.sin(state.heading || 0) * (state.speed || 0);
    PLANE_VEL[1] = state.climbRate || 0;
    PLANE_VEL[2] = -Math.cos(state.heading || 0) * (state.speed || 0);
    for (let i = 0; i < pins.length; i += 1) {
      const pin = pins[i];
      if (pin.inactive) {
        continue;
      }
      const dx = pin.p[0] - ORIGIN[0];
      const dy = pin.p[1] - ORIGIN[1];
      const dz = pin.p[2] - ORIGIN[2];
      if (dx * dx + dy * dy + dz * dz < PLANE_RANGE2) {
        wake(pin);
        planeNear = true;
        moving = true;
      }
    }
  }

  if (!moving) {
    return false;
  }

  for (let step = 0; step < steps; step += 1) {
    integrate(pins, h);
    if (planeNear && collidePlane(pins, ORIGIN, PLANE_Q, PLANE_VEL)) {
      hit = true;
    }
    collidePins(pins);
    collideGround(pins, h);
    trySleep(pins, h);
  }
  return hit;
};

const integrate = (pins, dt) => {
  const lin = Math.exp(-LINEAR_DAMP * dt);
  const ang = Math.exp(-ANGULAR_DAMP * dt);
  const half = 0.5 * dt;
  for (let i = 0; i < pins.length; i += 1) {
    const pin = pins[i];
    if (pin.inactive || pin.sleeping) {
      continue;
    }
    pin.v[1] -= GRAVITY * dt;
    pin.v[0] *= lin;
    pin.v[1] *= lin;
    pin.v[2] *= lin;
    pin.w[0] *= ang;
    pin.w[1] *= ang;
    pin.w[2] *= ang;
    pin.p[0] += pin.v[0] * dt;
    pin.p[1] += pin.v[1] * dt;
    pin.p[2] += pin.v[2] * dt;

    const w0 = pin.w[0];
    const w1 = pin.w[1];
    const w2 = pin.w[2];
    const q0 = pin.q[0];
    const q1 = pin.q[1];
    const q2 = pin.q[2];
    const q3 = pin.q[3];
    const nq0 = q0 + (w1 * q2 - w2 * q1 + w0 * q3) * half;
    const nq1 = q1 + (w2 * q0 - w0 * q2 + w1 * q3) * half;
    const nq2 = q2 + (w0 * q1 - w1 * q0 + w2 * q3) * half;
    const nq3 = q3 + (-w0 * q0 - w1 * q1 - w2 * q2) * half;
    const d = Math.hypot(nq0, nq1, nq2, nq3) || 1;
    pin.q[0] = nq0 / d;
    pin.q[1] = nq1 / d;
    pin.q[2] = nq2 / d;
    pin.q[3] = nq3 / d;
    writeSpheres(pin);
  }
};

const applyImpulse = (pin, at, ix, iy, iz) => {
  wake(pin);
  pin.v[0] += ix * pin.invMass;
  pin.v[1] += iy * pin.invMass;
  pin.v[2] += iz * pin.invMass;
  const rx = at[0] - pin.p[0];
  const ry = at[1] - pin.p[1];
  const rz = at[2] - pin.p[2];
  pin.w[0] += (ry * iz - rz * iy) * INV_I[0];
  pin.w[1] += (rz * ix - rx * iz) * INV_I[1];
  pin.w[2] += (rx * iy - ry * ix) * INV_I[2];
};

const velocityAt = (pin, at, out) => {
  const rx = at[0] - pin.p[0];
  const ry = at[1] - pin.p[1];
  const rz = at[2] - pin.p[2];
  out[0] = pin.v[0] + pin.w[1] * rz - pin.w[2] * ry;
  out[1] = pin.v[1] + pin.w[2] * rx - pin.w[0] * rz;
  out[2] = pin.v[2] + pin.w[0] * ry - pin.w[1] * rx;
  return out;
};

const collidePins = (pins) => {
  for (let i = 0; i < pins.length; i += 1) {
    const a = pins[i];
    if (a.inactive) {
      continue;
    }
    for (let j = i + 1; j < pins.length; j += 1) {
      const b = pins[j];
      if (b.inactive || (a.sleeping && b.sleeping)) {
        continue;
      }
      const dx = a.p[0] - b.p[0];
      const dy = a.p[1] - b.p[1];
      const dz = a.p[2] - b.p[2];
      if (dx * dx + dy * dy + dz * dz > PAIR_RANGE2) {
        continue;
      }
      for (let sa = 0; sa < PIN_SPHERES.length; sa += 1) {
        const pa = a.sw[sa];
        for (let sb = 0; sb < PIN_SPHERES.length; sb += 1) {
          const pb = b.sw[sb];
          const ddx = pa[0] - pb[0];
          const ddy = pa[1] - pb[1];
          const ddz = pa[2] - pb[2];
          const dist2 = ddx * ddx + ddy * ddy + ddz * ddz;
          const min = PIN_SPHERES[sa].radius + PIN_SPHERES[sb].radius;
          if (dist2 >= min * min || dist2 < 1e-12) {
            continue;
          }
          const dist = Math.sqrt(dist2);
          const inv = 1 / dist;
          const nx = ddx * inv;
          const ny = ddy * inv;
          const nz = ddz * inv;
          const penetration = min - dist;
          a.p[0] += nx * penetration * 0.5;
          a.p[1] += ny * penetration * 0.5;
          a.p[2] += nz * penetration * 0.5;
          b.p[0] -= nx * penetration * 0.5;
          b.p[1] -= ny * penetration * 0.5;
          b.p[2] -= nz * penetration * 0.5;
          CONTACT[0] = (pa[0] + pb[0]) * 0.5;
          CONTACT[1] = (pa[1] + pb[1]) * 0.5;
          CONTACT[2] = (pa[2] + pb[2]) * 0.5;
          velocityAt(a, CONTACT, TMP);
          velocityAt(b, CONTACT, TMP2);
          const closing = (TMP[0] - TMP2[0]) * nx + (TMP[1] - TMP2[1]) * ny + (TMP[2] - TMP2[2]) * nz;
          if (closing >= 0) {
            writeSpheres(a);
            writeSpheres(b);
            continue;
          }
          const jn = (-(1 + RESTITUTION) * closing) / (a.invMass + b.invMass);
          applyImpulse(a, CONTACT, nx * jn, ny * jn, nz * jn);
          applyImpulse(b, CONTACT, -nx * jn, -ny * jn, -nz * jn);
          writeSpheres(a);
          writeSpheres(b);
        }
      }
    }
  }
};

const collideGround = (pins, dt) => {
  for (let i = 0; i < pins.length; i += 1) {
    const pin = pins[i];
    if (pin.inactive || pin.sleeping) {
      continue;
    }
    let touched = false;
    for (let s = 0; s < PIN_SPHERES.length; s += 1) {
      const p = pin.sw[s];
      const radius = PIN_SPHERES[s].radius;
      const bottom = p[1] - radius;
      if (bottom >= 0) {
        continue;
      }
      touched = true;
      pin.p[1] -= bottom;
      writeSpheres(pin);
      CONTACT[0] = p[0];
      CONTACT[1] = 0;
      CONTACT[2] = p[2];
      velocityAt(pin, CONTACT, TMP);
      if (TMP[1] < 0) {
        applyImpulse(pin, CONTACT, 0, -TMP[1] * pin.mass, 0);
        pin.v[1] = 0;
      }
      const slide2 = TMP[0] * TMP[0] + TMP[2] * TMP[2];
      if (slide2 > 1e-8) {
        const slide = Math.sqrt(slide2);
        const friction = Math.min(GROUND_FRICTION * pin.mass * GRAVITY * dt, slide * pin.mass);
        const inv = -friction / slide;
        applyImpulse(pin, CONTACT, TMP[0] * inv, 0, TMP[2] * inv);
      }
    }
    if (touched) {
      const spin = Math.exp(-GROUND_SPIN_DAMP * dt);
      pin.w[0] *= spin;
      pin.w[1] *= spin;
      pin.w[2] *= spin;
      const speed2 = hypot2(pin.v[0], pin.v[1], pin.v[2]);
      if (speed2 < ROLLING_SPEED2) {
        const roll = Math.exp(-ROLLING_DAMP * dt);
        pin.v[0] *= roll;
        pin.v[2] *= roll;
      }
      writeSpheres(pin);
    }
  }
};

const collidePlane = (pins, origin, q, planeVel) => {
  let hit = false;
  PLANE_Q_INV[0] = -q[0];
  PLANE_Q_INV[1] = -q[1];
  PLANE_Q_INV[2] = -q[2];
  PLANE_Q_INV[3] = q[3];

  for (let i = 0; i < pins.length; i += 1) {
    const pin = pins[i];
    if (pin.inactive) {
      continue;
    }
    const pdx = pin.p[0] - origin[0];
    const pdy = pin.p[1] - origin[1];
    const pdz = pin.p[2] - origin[2];
    if (pdx * pdx + pdy * pdy + pdz * pdz > PLANE_RANGE2) {
      continue;
    }
    for (let s = 0; s < PIN_SPHERES.length; s += 1) {
      const world = pin.sw[s];
      const radius = PIN_SPHERES[s].radius;
      rotateInto(PLANE_Q_INV, world[0] - origin[0], world[1] - origin[1], world[2] - origin[2], LOCAL);
      for (let h = 0; h < PLANE_HULLS.length; h += 1) {
        const hull = PLANE_HULLS[h];
        CLOSEST[0] = clamp(LOCAL[0], hull.center[0] - hull.half[0], hull.center[0] + hull.half[0]);
        CLOSEST[1] = clamp(LOCAL[1], hull.center[1] - hull.half[1], hull.center[1] + hull.half[1]);
        CLOSEST[2] = clamp(LOCAL[2], hull.center[2] - hull.half[2], hull.center[2] + hull.half[2]);
        rotateInto(q, CLOSEST[0], CLOSEST[1], CLOSEST[2], CONTACT);
        CONTACT[0] += origin[0];
        CONTACT[1] += origin[1];
        CONTACT[2] += origin[2];
        const dx = world[0] - CONTACT[0];
        const dy = world[1] - CONTACT[1];
        const dz = world[2] - CONTACT[2];
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 >= radius * radius || dist2 < 1e-12) {
          continue;
        }
        const dist = Math.sqrt(dist2);
        const inv = 1 / dist;
        const nx = dx * inv;
        const ny = dy * inv;
        const nz = dz * inv;
        const penetration = radius - dist;
        pin.p[0] += nx * penetration;
        pin.p[1] += ny * penetration;
        pin.p[2] += nz * penetration;
        writeSpheres(pin);
        velocityAt(pin, CONTACT, TMP);
        const closing =
          (TMP[0] - planeVel[0]) * nx + (TMP[1] - planeVel[1]) * ny + (TMP[2] - planeVel[2]) * nz;
        hit = true;
        if (closing >= 0) {
          continue;
        }
        let jn = -(1 + PLANE_RESTITUTION) * closing * pin.mass;
        const maxJ = pin.mass * MAX_PLANE_DV;
        if (jn > maxJ) {
          jn = maxJ;
        }
        applyImpulse(pin, CONTACT, nx * jn, ny * jn, nz * jn);
        writeSpheres(pin);
      }
    }
  }
  return hit;
};

const trySleep = (pins, dt) => {
  for (let i = 0; i < pins.length; i += 1) {
    const pin = pins[i];
    if (pin.inactive || pin.sleeping) {
      continue;
    }
    let grounded = pin.p[1] < PIN_COM_Y + 0.85;
    for (let s = 0; s < PIN_SPHERES.length; s += 1) {
      if (pin.sw[s][1] - PIN_SPHERES[s].radius < 0.4) {
        grounded = true;
        break;
      }
    }
    const slow =
      hypot2(pin.v[0], pin.v[1], pin.v[2]) < SLEEP_SPEED2
      && hypot2(pin.w[0], pin.w[1], pin.w[2]) < SLEEP_SPIN2;
    if (grounded && slow) {
      pin.still += dt;
      if (pin.still >= SLEEP_TIME) {
        pin.v[0] = 0;
        pin.v[1] = 0;
        pin.v[2] = 0;
        pin.w[0] = 0;
        pin.w[1] = 0;
        pin.w[2] = 0;
        pin.sleeping = true;
        pin.still = 0;
      }
    } else {
      pin.still = 0;
    }
  }
};

export const countFallen = (pins) => {
  let sum = 0;
  for (let i = 0; i < pins.length; i += 1) {
    if (pinFallen(pins[i])) {
      sum += 1;
    }
  }
  return sum;
};
