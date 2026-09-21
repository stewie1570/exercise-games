const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const FLIGHT = {
  airspeed: 42,
  groundDecel: 14,
  stopSpeed: 0.45,
  maintainThrottle: 0.42,
  maxClimbRate: 11,
  maxDescendRate: 15,
  maxTurnRate: 0.95,
  climbTau: 1.15,
  minAltitude: 1.4,
  maxAltitude: 240,
};

const onGround = (altitude) => altitude <= FLIGHT.minAltitude + 1e-6;

export const createAircraftState = () => ({
  x: 0,
  z: 160,
  altitude: 2.2,
  heading: 0,
  throttle: 0,
  climbRate: 0,
  speed: 0,
  moving: false,
});

const currentSpeed = (state) => state.speed ?? (state.moving ? FLIGHT.airspeed : 0);

export const targetClimbRate = (throttle) => {
  const offset = clamp(throttle, 0, 1) - FLIGHT.maintainThrottle;
  if (offset >= 0) {
    return (offset / (1 - FLIGHT.maintainThrottle)) * FLIGHT.maxClimbRate;
  }
  return (offset / FLIGHT.maintainThrottle) * FLIGHT.maxDescendRate;
};

const expFollow = (current, target, dt, tau) => {
  if (dt <= 0) {
    return current;
  }
  if (tau <= 1e-6) {
    return target;
  }
  return target + (current - target) * Math.exp(-dt / tau);
};

const expFollowIntegral = (current, target, dt, tau) => {
  if (dt <= 0) {
    return 0;
  }
  if (tau <= 1e-6) {
    return target * dt;
  }
  return target * dt + (current - target) * tau * (1 - Math.exp(-dt / tau));
};

export const stepAircraft = (state, { throttle, turn, flapping }, dt) => {
  const nextThrottle = clamp(throttle ?? 0, 0, 1);
  const nextTurn = clamp(turn ?? 0, -1, 1);
  const powered = nextThrottle > 0 || Boolean(flapping);
  const grounded = onGround(state.altitude);
  let speed = currentSpeed(state);

  if (!powered && speed <= FLIGHT.stopSpeed && (grounded || !state.moving)) {
    return {
      ...state,
      altitude: grounded ? FLIGHT.minAltitude : state.altitude,
      throttle: nextThrottle,
      climbRate: 0,
      turn: 0,
      speed: 0,
      moving: false,
    };
  }

  const heading = speed > FLIGHT.stopSpeed || powered
    ? state.heading + nextTurn * FLIGHT.maxTurnRate * dt
    : state.heading;

  let climbRate = 0;
  let altitude = state.altitude;

  if (powered || !grounded) {
    const targetClimb = targetClimbRate(nextThrottle);
    const dh = expFollowIntegral(state.climbRate, targetClimb, dt, FLIGHT.climbTau);
    altitude = clamp(state.altitude + dh, FLIGHT.minAltitude, FLIGHT.maxAltitude);
    climbRate = expFollow(state.climbRate, targetClimb, dt, FLIGHT.climbTau);
    if (onGround(altitude) && climbRate < 0) {
      climbRate = 0;
    }
    if (altitude >= FLIGHT.maxAltitude && climbRate > 0) {
      climbRate = 0;
    }
    if (!powered && onGround(altitude)) {
      speed = Math.max(0, speed - FLIGHT.groundDecel * dt);
    } else {
      speed = FLIGHT.airspeed;
    }
  } else {
    speed = Math.max(0, speed - FLIGHT.groundDecel * dt);
    altitude = FLIGHT.minAltitude;
    climbRate = expFollow(state.climbRate, 0, dt, FLIGHT.climbTau * 0.45);
  }

  if (!powered && onGround(altitude) && speed <= FLIGHT.stopSpeed) {
    speed = 0;
  }

  return {
    x: state.x + Math.sin(heading) * speed * dt,
    z: state.z - Math.cos(heading) * speed * dt,
    altitude,
    heading,
    throttle: nextThrottle,
    climbRate,
    turn: speed > 0 ? nextTurn : 0,
    speed,
    moving: speed > 0,
  };
};
