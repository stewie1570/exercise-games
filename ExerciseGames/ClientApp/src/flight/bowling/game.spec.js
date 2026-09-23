import { PIN_RESET_DELAY, pinSlots } from "./dimensions";
import { createBowlingGame, stepBowlingGame } from "./game";
import { createPinBody, pinFallen } from "./physics";
import { recordRoll } from "./score";

test("the first plane hit starts a six second reset timer", () => {
  const pins = pinSlots().map((slot) => createPinBody(slot.x, slot.z));
  const game = createBowlingGame(pins);
  const state = { x: 0, z: 6, altitude: 1.6, heading: 0, speed: 42, climbRate: 0 };

  let hit = false;
  for (let i = 0; i < 30 && !hit; i += 1) {
    state.z -= state.speed * 0.02;
    hit = stepBowlingGame(game, { state, dt: 0.02 });
  }
  expect(hit).toBe(true);
  expect(game.phase).toBe("settling");
  expect(game.settleIn).toBeGreaterThan(5);

  stepBowlingGame(game, { state, dt: PIN_RESET_DELAY });
  expect(game.phase).toBe("ready");
  expect(game.card.frames[0].length).toBe(1);
});

test("fallen pins stay down for the second ball", () => {
  const pins = pinSlots().map((slot) => createPinBody(slot.x, slot.z));
  pins.slice(0, 7).forEach((pin) => {
    pin.q = [0.7, 0, 0, 0.7];
  });
  const game = createBowlingGame(pins);
  game.phase = "settling";
  game.settleIn = 0;
  stepBowlingGame(game, { state: { x: 0, z: 40, altitude: 10, heading: 0, speed: 0, climbRate: 0 }, dt: 0.016 });
  expect(game.card.frames[0]).toEqual([7]);
  expect(pins.filter((pin) => pin.inactive).length).toBe(7);
  expect(pins.filter((pin) => !pin.inactive && !pinFallen(pin)).length).toBe(3);
});

test("a strike resets the full rack", () => {
  let card = { frames: Array.from({ length: 10 }, () => []) };
  card = recordRoll(card, 10);
  expect(card.frames[0]).toEqual([10]);
});
