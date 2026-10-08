import { arrowControlsEnabled, createArrowControls, stepArrowControls } from "./arrowControls";

const held = { up: false, left: false, right: false };

test("the toggle is on only for a true env value", () => {
  expect(arrowControlsEnabled({ VITE_ARROW_CONTROLS: "true" })).toBe(true);
  expect(arrowControlsEnabled({ VITE_ARROW_CONTROLS: "1" })).toBe(true);
  expect(arrowControlsEnabled({ VITE_ARROW_CONTROLS: "false" })).toBe(false);
  expect(arrowControlsEnabled({})).toBe(false);
});

test("arrow keys cancel scrolling, including key repeat and down", () => {
  const arrows = createArrowControls();
  try {
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      const repeat = new KeyboardEvent("keydown", { key, repeat: true, cancelable: true });
      window.dispatchEvent(repeat);
      expect(repeat.defaultPrevented).toBe(true);
      const release = new KeyboardEvent("keyup", { key, cancelable: true });
      window.dispatchEvent(release);
      expect(release.defaultPrevented).toBe(true);
    }
  } finally {
    arrows.dispose();
  }
});

test("holding up reaches full throttle in 1.25 seconds and release returns to zero", () => {
  let state = { throttle: 0, turn: 0 };
  state = stepArrowControls(state, { ...held, up: true }, 1.25);
  expect(state.throttle).toBeCloseTo(1);
  state = stepArrowControls(state, held, 0.625);
  expect(state.throttle).toBeCloseTo(0.5);
  state = stepArrowControls(state, held, 0.625);
  expect(state.throttle).toBeCloseTo(0);
});

test("holding a direction reaches full roll in 1.25 seconds and release levels out", () => {
  let state = { throttle: 0, turn: 0 };
  state = stepArrowControls(state, { ...held, right: true }, 1.25);
  expect(state.turn).toBeCloseTo(1);
  state = stepArrowControls(state, { ...held, left: true }, 1.25);
  expect(state.turn).toBeCloseTo(0);
  state = stepArrowControls(state, { ...held, left: true }, 1.25);
  expect(state.turn).toBeCloseTo(-1);
  state = stepArrowControls(state, held, 1.25);
  expect(state.turn).toBeCloseTo(0);
});
