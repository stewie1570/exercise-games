import { PIN_RESET_DELAY } from "./dimensions";
import { capturePin, countFallen, pinFallen, resetPin, restorePin, stepPins } from "./physics";
import {
  createScorecard,
  currentFrameIndex,
  frameTotals,
  gameTotal,
  isFrameClosed,
  isGameOver,
  recordRoll,
  rollMarks,
} from "./score";

export const createBowlingGame = (pins) => ({
  pins,
  card: createScorecard(),
  phase: "ready",
  settleIn: 0,
  fallenAtBallStart: 0,
});

export const stepBowlingGame = (game, { state, dt }) => {
  const hit = stepPins(game.pins, {
    state,
    dt,
    planeHit: true,
  });

  if (hit && game.phase === "ready") {
    if (game.startNext) {
      game.card = createScorecard();
      game.startNext = false;
    }
    game.phase = "settling";
    game.settleIn = PIN_RESET_DELAY;
  }

  if (game.phase === "settling") {
    game.settleIn = Math.max(0, game.settleIn - dt);
    if (game.settleIn === 0) {
      finishBall(game);
    }
  }

  return hit;
};

const finishBall = (game) => {
  const fallen = countFallen(activePins(game));
  const knocked = Math.max(0, fallen - game.fallenAtBallStart);
  const frame = currentFrameIndex(game.card.frames);
  game.card = recordRoll(game.card, knocked);
  const closed = isFrameClosed(game.card.frames, frame);

  if (isGameOver(game.card.frames)) {
    game.pins.forEach((pin) => {
      pin.inactive = false;
      resetPin(pin);
    });
    game.fallenAtBallStart = 0;
    game.phase = "ready";
    game.startNext = true;
    return;
  }

  if (closed) {
    game.pins.forEach((pin) => {
      pin.inactive = false;
      resetPin(pin);
    });
    game.fallenAtBallStart = 0;
  } else {
    sweepFallen(game);
    game.fallenAtBallStart = 0;
  }
  game.phase = "ready";
};

const activePins = (game) => game.pins.filter((pin) => !pin.inactive);

const sweepFallen = (game) => {
  game.pins.forEach((pin) => {
    if (pin.inactive || !pinFallen(pin)) {
      return;
    }
    pin.inactive = true;
    pin.v = [0, 0, 0];
    pin.w = [0, 0, 0];
  });
};

export const pinsInPlay = (game) => game.pins.filter((pin) => !pin.inactive);

export const bowlingHud = (game) => ({
  frames: game.card.frames,
  marks: rollMarks(game.card.frames),
  totals: frameTotals(game.card.frames),
  total: gameTotal(game.card.frames),
  frame: currentFrameIndex(game.card.frames) + 1,
  settling: game.phase === "settling",
  resetIn: game.settleIn,
  gameOver: isGameOver(game.card.frames) || Boolean(game.startNext),
  delay: PIN_RESET_DELAY,
});

export const captureBowling = (game) => ({
  pins: game.pins.map(capturePin),
  card: { frames: game.card.frames.map((rolls) => [...rolls]) },
  phase: game.phase,
  settleIn: game.settleIn,
  fallenAtBallStart: game.fallenAtBallStart,
  startNext: Boolean(game.startNext),
});

export const restoreBowling = (game, snap) => {
  snap.pins.forEach((pin, index) => {
    if (game.pins[index]) {
      restorePin(game.pins[index], pin);
    }
  });
  game.card = { frames: snap.card.frames.map((rolls) => [...rolls]) };
  game.phase = snap.phase;
  game.settleIn = snap.settleIn;
  game.fallenAtBallStart = snap.fallenAtBallStart;
  game.startNext = Boolean(snap.startNext);
};
