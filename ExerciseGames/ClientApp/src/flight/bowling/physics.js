import {
  PIN_COM_Y,
  PIN_HEIGHT,
  PIN_MASS,
  PIN_SPHERES,
  PLANE_HULLS,
} from "./dimensions";

const GRAVITY = 9.81;
const RESTITUTION = 0.28;
const PIN_FRICTION = 0.35;
const GROUND_FRICTION = 1.8;
const ANGULAR_DAMP = 0.28;
const LINEAR_DAMP = 0.12;
const PLANE_RESTITUTION = 0.18;
const MAX_PLANE_DV = 22;
const STANDING_DOT = 0.55;
const SUBSTEP = 1 / 90;

const I_BODY = inertia();

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const d = len(a) || 1;
  return scale(a, 1 / d);
};

const quatMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

const quatNorm = (q) => {
  const d = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / d, q[1] / d, q[2] / d, q[3] / d];
};

const rotate = (q, v) => {
  const qv = [v[0], v[1], v[2], 0];
  const qi = [-q[0], -q[1], -q[2], q[3]];
  const r = quatMul(quatMul(q, qv), qi);
  return [r[0], r[1], r[2]];
};

const rotateInv = (q, v) => rotate([-q[0], -q[1], -q[2], q[3]], v);

function inertia() {
  const r = PIN_SPHERES[1].radius;
  const h = PIN_HEIGHT;
  const ix = (PIN_MASS / 12) * (3 * r * r + h * h);
  const iy = 0.5 * PIN_MASS * r * r;
  return [ix, iy, ix];
}

export const createPinBody = (x, z) => ({
  rest: [x, PIN_COM_Y, z],
  p: [x, PIN_COM_Y, z],
  q: [0, 0, 0, 1],
  v: [0, 0, 0],
  w: [0, 0, 0],
  mass: PIN_MASS,
  invMass: 1 / PIN_MASS,
});

export const resetPin = (pin) => {
  pin.p = [...pin.rest];
  pin.q = [0, 0, 0, 1];
  pin.v = [0, 0, 0];
  pin.w = [0, 0, 0];
};

export const pinFallen = (pin) => rotate(pin.q, [0, 1, 0])[1] < STANDING_DOT;

export const sphereWorld = (pin, sphere) => {
  const local = [0, sphere.y - PIN_COM_Y, 0];
  return add(pin.p, rotate(pin.q, local));
};

export const planeVelocity = (state) => [
  Math.sin(state.heading) * (state.speed || 0),
  state.climbRate || 0,
  -Math.cos(state.heading) * (state.speed || 0),
];

const yawQuat = (heading) => {
  const half = -heading * 0.5;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

export const stepPins = (pins, { state, dt, planeHit }) => {
  const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
  const h = dt / steps;
  const live = pins.filter((pin) => !pin.inactive);
  let hit = false;
  for (let i = 0; i < steps; i += 1) {
    integrate(live, h);
    if (collidePlane(live, state, h, planeHit)) {
      hit = true;
    }
    collidePins(live);
    collideGround(live, h);
  }
  return hit;
};

const integrate = (pins, dt) => {
  pins.forEach((pin) => {
    pin.v = add(pin.v, [0, -GRAVITY * dt, 0]);
    pin.v = scale(pin.v, Math.max(0, 1 - LINEAR_DAMP * dt));
    pin.w = scale(pin.w, Math.max(0, 1 - ANGULAR_DAMP * dt));
    pin.p = add(pin.p, scale(pin.v, dt));
    const dq = quatMul([pin.w[0], pin.w[1], pin.w[2], 0], pin.q);
    pin.q = quatNorm([
      pin.q[0] + dq[0] * 0.5 * dt,
      pin.q[1] + dq[1] * 0.5 * dt,
      pin.q[2] + dq[2] * 0.5 * dt,
      pin.q[3] + dq[3] * 0.5 * dt,
    ]);
  });
};

const applyImpulse = (pin, at, impulse) => {
  pin.v = add(pin.v, scale(impulse, pin.invMass));
  const r = sub(at, pin.p);
  const torque = cross(r, impulse);
  pin.w = add(pin.w, [torque[0] / I_BODY[0], torque[1] / I_BODY[1], torque[2] / I_BODY[2]]);
};

const velocityAt = (pin, at) => add(pin.v, cross(pin.w, sub(at, pin.p)));

const collidePins = (pins) => {
  for (let i = 0; i < pins.length; i += 1) {
    for (let j = i + 1; j < pins.length; j += 1) {
      PIN_SPHERES.forEach((sa) => {
        PIN_SPHERES.forEach((sb) => {
          const pa = sphereWorld(pins[i], sa);
          const pb = sphereWorld(pins[j], sb);
          const delta = sub(pa, pb);
          const dist = len(delta);
          const min = sa.radius + sb.radius;
          if (dist >= min || dist < 1e-6) {
            return;
          }
          const n = norm(delta);
          const penetration = min - dist;
          pins[i].p = add(pins[i].p, scale(n, penetration * 0.5));
          pins[j].p = add(pins[j].p, scale(n, -penetration * 0.5));
          const contact = scale(add(pa, pb), 0.5);
          const rel = sub(velocityAt(pins[i], contact), velocityAt(pins[j], contact));
          const closing = dot(rel, n);
          if (closing >= 0) {
            return;
          }
          const jn = (-(1 + RESTITUTION) * closing) / (pins[i].invMass + pins[j].invMass);
          const impulse = scale(n, jn);
          applyImpulse(pins[i], contact, impulse);
          applyImpulse(pins[j], contact, scale(impulse, -1));
        });
      });
    }
  }
};

const collideGround = (pins, dt) => {
  pins.forEach((pin) => {
    PIN_SPHERES.forEach((sphere) => {
      const p = sphereWorld(pin, sphere);
      const bottom = p[1] - sphere.radius;
      if (bottom >= 0) {
        return;
      }
      pin.p = [pin.p[0], pin.p[1] - bottom, pin.p[2]];
      const contact = [p[0], 0, p[2]];
      const rel = velocityAt(pin, contact);
      if (rel[1] < 0) {
        applyImpulse(pin, contact, [0, -rel[1] * pin.mass * (1 + RESTITUTION * 0.2), 0]);
      }
      const tangent = [rel[0], 0, rel[2]];
      const slide = len(tangent);
      if (slide > 1e-4) {
        const friction = Math.min(GROUND_FRICTION * pin.mass * GRAVITY * dt, slide * pin.mass);
        applyImpulse(pin, contact, scale(norm(tangent), -friction));
      }
    });
  });
};

const collidePlane = (pins, state, dt, enabled) => {
  if (!enabled || !state) {
    return false;
  }
  const q = yawQuat(state.heading || 0);
  const origin = [state.x, state.altitude, state.z];
  const planeVel = planeVelocity(state);
  let hit = false;

  pins.forEach((pin) => {
    PIN_SPHERES.forEach((sphere) => {
      const world = sphereWorld(pin, sphere);
      PLANE_HULLS.forEach((hull) => {
        const local = rotateInv(q, sub(world, origin));
        const closestLocal = [
          clamp(local[0], hull.center[0] - hull.half[0], hull.center[0] + hull.half[0]),
          clamp(local[1], hull.center[1] - hull.half[1], hull.center[1] + hull.half[1]),
          clamp(local[2], hull.center[2] - hull.half[2], hull.center[2] + hull.half[2]),
        ];
        const closest = add(origin, rotate(q, closestLocal));
        const delta = sub(world, closest);
        const dist = len(delta);
        if (dist >= sphere.radius || dist < 1e-6) {
          return;
        }
        const n = norm(delta);
        const penetration = sphere.radius - dist;
        pin.p = add(pin.p, scale(n, penetration));
        const contact = closest;
        const rel = sub(velocityAt(pin, contact), planeVel);
        const closing = dot(rel, n);
        if (closing >= 0) {
          hit = true;
          return;
        }
        let jn = -(1 + PLANE_RESTITUTION) * closing * pin.mass;
        const maxJ = pin.mass * MAX_PLANE_DV;
        if (jn > maxJ) {
          jn = maxJ;
        }
        applyImpulse(pin, contact, scale(n, jn));
        hit = true;
      });
    });
  });
  return hit;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const countFallen = (pins) => pins.reduce((sum, pin) => sum + (pinFallen(pin) ? 1 : 0), 0);
