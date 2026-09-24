import { bowlingHud, captureBowling, restoreBowling, stepBowlingGame } from "../bowling/game";
import { capturePin, restorePin, stepPins } from "../bowling/physics";

export const PIN_HISTORY_MS = 2500;

const aircraftFromHit = (plane) => ({
  x: plane.x,
  z: plane.z,
  altitude: plane.altitude,
  heading: plane.heading,
  speed: plane.speed || 0,
  climbRate: plane.climbRate || 0,
  throttle: plane.throttle || 0,
  turn: plane.turn || 0,
  moving: Boolean(plane.moving),
  climbCommand: plane.climbCommand || 0,
});

export const createPinHistory = () => {
  const frames = [];
  const appliedHitIds = [];

  const remember = (hitId) => {
    if (!hitId || appliedHitIds.includes(hitId)) {
      return;
    }
    appliedHitIds.push(hitId);
    if (appliedHitIds.length > 40) {
      appliedHitIds.splice(0, appliedHitIds.length - 40);
    }
  };

  const baseline = (game, now, host) => {
    frames.length = 0;
    frames.push({
      t: now,
      dt: 0,
      host: { ...host },
      snap: captureBowling(game),
    });
  };

  return {
    appliedHitIds,
    record({ t, dt, host, game }) {
      frames.push({
        t,
        dt,
        host: { ...host },
        snap: captureBowling(game),
      });
      const cutoff = t - PIN_HISTORY_MS;
      while (frames.length > 1 && frames[0].t < cutoff) {
        frames.shift();
      }
    },
    applyHit(game, hit, { now, host }) {
      const aircraft = aircraftFromHit(hit.plane);
      const contact = hit.dt > 0 ? hit.dt : 0.016;
      let from = 0;
      for (let i = frames.length - 1; i >= 0; i -= 1) {
        if (frames[i].t <= hit.t) {
          from = i;
          break;
        }
      }

      if (!frames.length || hit.t < frames[0].t) {
        stepBowlingGame(game, { state: aircraft, dt: contact });
      } else {
        restoreBowling(game, frames[from].snap);
        let applied = false;
        for (let i = from; i < frames.length; i += 1) {
          const frame = frames[i];
          if (!(frame.dt > 0)) {
            continue;
          }
          if (!applied && hit.t <= frame.t + frame.dt) {
            const pre = Math.max(0, hit.t - frame.t);
            if (pre > 0) {
              stepBowlingGame(game, { state: frame.host, dt: pre });
            }
            stepBowlingGame(game, { state: aircraft, dt: contact });
            const post = Math.max(0, frame.dt - pre);
            if (post > 0) {
              stepBowlingGame(game, { state: frame.host, dt: post });
            }
            applied = true;
          } else {
            stepBowlingGame(game, { state: frame.host, dt: frame.dt });
          }
        }
        if (!applied) {
          stepBowlingGame(game, { state: aircraft, dt: contact });
        }
      }

      remember(hit.hitId);
      baseline(game, now, host);
      return true;
    },
  };
};

export const buildPinBroadcast = ({ revision, t, game, appliedHitIds, reason, plane }) => ({
  revision,
  t,
  pins: game.pins.map(capturePin),
  score: bowlingHud(game),
  appliedHitIds: [...appliedHitIds],
  reason,
  plane: plane ?? null,
});

export const shouldApplyPinState = ({ payload, lastRevision, pendingHitIds }) => {
  if (!payload || !(payload.revision > lastRevision)) {
    return false;
  }
  const applied = payload.appliedHitIds ?? [];
  return pendingHitIds.every((id) => applied.includes(id));
};

export const applyPinBroadcast = (game, payload) => {
  payload.pins.forEach((pin, index) => {
    if (game.pins[index]) {
      restorePin(game.pins[index], pin);
    }
  });
};

export const predictLocalPins = (pins, state, dt) => stepPins(pins, {
  state,
  dt,
  planeHit: true,
});
