import { createAircraftState, stepAircraft } from "../physics";

export const PLANE_BROADCAST_MS = 1000;

export const PILOT_TINTS = [
  { body: 0xf59e0b, stripe: 0x0369a1 },
  { body: 0x38bdf8, stripe: 0xf8fafc },
  { body: 0xf472b6, stripe: 0x831843 },
  { body: 0xa3e635, stripe: 0x14532d },
  { body: 0xfbbf24, stripe: 0x7c2d12 },
  { body: 0xc084fc, stripe: 0x4c1d95 },
  { body: 0xfb7185, stripe: 0x881337 },
  { body: 0x2dd4bf, stripe: 0x134e4a },
];

export const pilotTint = (slot) => PILOT_TINTS[Math.abs(slot) % PILOT_TINTS.length];

export const spawnAircraft = (slot) => {
  const state = createAircraftState();
  return { ...state, x: state.x + Math.max(0, slot) * 18 };
};

export const createServerClock = () => {
  let offset = 0;
  return {
    note(sentAt, receivedAt, serverAt) {
      const latency = Math.max(0, (receivedAt - sentAt) / 2);
      offset = serverAt - (sentAt + latency);
    },
    now() {
      return Date.now() + offset;
    },
  };
};

export const snapshotAircraft = (state, t) => ({
  t,
  x: state.x,
  z: state.z,
  altitude: state.altitude,
  heading: state.heading,
  throttle: state.throttle || 0,
  climbRate: state.climbRate || 0,
  climbCommand: state.climbCommand || 0,
  speed: state.speed || 0,
  turn: state.turn || 0,
  moving: Boolean(state.moving),
});

const aircraftFromSnapshot = (snapshot) => ({
  x: snapshot.x,
  z: snapshot.z,
  altitude: snapshot.altitude,
  heading: snapshot.heading,
  throttle: snapshot.throttle || 0,
  climbRate: snapshot.climbRate || 0,
  climbCommand: snapshot.climbCommand || 0,
  speed: snapshot.speed || 0,
  turn: snapshot.turn || 0,
  moving: Boolean(snapshot.moving),
});

export const createRemotePilot = (id) => ({
  id,
  state: null,
  controls: { throttle: 0, turn: 0, flapping: false },
});

export const adoptPlaneSnapshot = (pilot, snapshot, now = snapshot?.t) => {
  if (!snapshot) {
    return;
  }
  pilot.state = aircraftFromSnapshot(snapshot);
  pilot.controls = {
    throttle: pilot.state.throttle,
    turn: pilot.state.turn,
    flapping: pilot.state.throttle > 0,
  };
  const elapsed = Math.min(1.5, Math.max(0, ((now ?? snapshot.t) - snapshot.t) / 1000));
  if (elapsed > 0) {
    extrapolatePilot(pilot, elapsed);
  }
};

export const extrapolatePilot = (pilot, dt) => {
  if (!pilot.state || !(dt > 0)) {
    return pilot.state;
  }
  pilot.state = stepAircraft(pilot.state, pilot.controls, dt);
  return pilot.state;
};
