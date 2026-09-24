const RAMP_SECONDS = 1.25;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const arrowControlsEnabled = (env = import.meta.env) => {
  const value = String(env.VITE_ARROW_CONTROLS ?? "").toLowerCase();
  return value === "1" || value === "true";
};

export const stepArrowControls = (state, held, dt) => {
  const ramp = Math.max(0, dt) / RAMP_SECONDS;
  const throttle = clamp(state.throttle + (held.up ? ramp : -ramp), 0, 1);
  const stick = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  let turn = state.turn;
  if (stick === 0) {
    turn = turn > 0 ? Math.max(0, turn - ramp) : Math.min(0, turn + ramp);
  } else {
    turn = clamp(turn + stick * ramp, -1, 1);
  }
  return { throttle, turn };
};

export const createArrowControls = () => {
  const held = { up: false, left: false, right: false };
  let throttle = 0;
  let turn = 0;

  const setHeld = (key, down) => {
    if (key === "ArrowUp") held.up = down;
    else if (key === "ArrowLeft") held.left = down;
    else if (key === "ArrowRight") held.right = down;
    else return false;
    return true;
  };

  const onKeyDown = (event) => {
    if (event.repeat || !setHeld(event.key, true)) return;
    event.preventDefault();
  };
  const onKeyUp = (event) => {
    if (!setHeld(event.key, false)) return;
    event.preventDefault();
  };
  const onBlur = () => {
    held.up = false;
    held.left = false;
    held.right = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    step(dt) {
      const next = stepArrowControls({ throttle, turn }, held, dt);
      throttle = next.throttle;
      turn = next.turn;
      return {
        throttle,
        turn,
        flapsPerSec: 0,
        flapping: throttle > 0,
      };
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
};
