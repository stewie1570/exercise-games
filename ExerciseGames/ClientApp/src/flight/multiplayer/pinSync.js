import { noteRemoteHit } from "../bowling/game";
import { capturePin, restorePin, stepPins } from "../bowling/physics";

export const MOTION_BROADCAST_MS = 100;

export const releaseSleepingPins = (pins, ownerId) => {
  const released = [];
  pins.forEach((pin, index) => {
    if (pin.owner === ownerId && pin.sleeping) {
      pin.owner = null;
      released.push(index);
    }
  });
  return released;
};

export const coastForeignPins = (pins, localId, dt) => {
  const owners = new Set();
  pins.forEach((pin) => {
    if (pin.owner && pin.owner !== localId) {
      owners.add(pin.owner);
    }
  });
  owners.forEach((owner) => {
    stepPins(pins, {
      state: null,
      dt,
      planeHit: false,
      coastOwner: owner,
    });
  });
};

export const buildPinBroadcast = ({
  revision,
  t,
  from,
  game,
  released = [],
  authoritative = false,
  reason,
  plane = null,
  score = null,
  players = null,
}) => ({
  revision,
  t,
  from,
  pins: game.pins.map(capturePin),
  released: [...released],
  authoritative: Boolean(authoritative),
  reason,
  plane,
  score,
  players,
});

export const acceptPinRevision = (seen, payload) => {
  if (!payload?.from || !(payload.revision > (seen.get(payload.from) ?? 0))) {
    return false;
  }
  seen.set(payload.from, payload.revision);
  return true;
};

export const applyPinBroadcast = (game, payload, { localId } = {}) => {
  const released = new Set(payload.released ?? []);
  const authoritative = Boolean(payload.authoritative);
  payload.pins.forEach((data, index) => {
    const pin = game.pins[index];
    if (!pin) {
      return;
    }
    const fromOwner = Boolean(data.owner) && data.owner === payload.from;
    const gaveBack = released.has(index);
    if (authoritative || fromOwner || gaveBack) {
      restorePin(pin, data);
      return;
    }
    if (localId && pin.owner === localId) {
      return;
    }
    if (!pin.owner && !data.owner) {
      restorePin(pin, data);
    }
  });
};

export const remoteHitNeedsScore = (payload, localId) => {
  const ownsSome = (payload.pins ?? []).some((pin) => pin.owner && pin.owner !== localId);
  return ownsSome || (payload.released ?? []).length > 0;
};

export const scoreRemoteHit = (game) => {
  noteRemoteHit(game);
};
