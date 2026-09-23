import { PIN_RESET_DELAY } from "./dimensions";
import { countFallen, pinFallen, resetPin, stepPins } from "./physics";
import { createScorecard, currentFrameIndex, isFrameClosed, isGameOver, recordRoll } from "./score";

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
