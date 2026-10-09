const RAMP_SECONDS = 1.25;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const readFlag = (value) => {
  const text = String(value ?? "").toLowerCase();
  return text === "1" || text === "true";
};

let runtimeFlag = null;

export const arrowControlsEnabled = (env) => {
  if (env) {
    return readFlag(env.VITE_ARROW_CONTROLS);
  }
  if (runtimeFlag != null) {
    return runtimeFlag;
  }
  return readFlag(import.meta.env.VITE_ARROW_CONTROLS);
};

export const loadArrowControls = async () => {
  try {
    const response = await fetch("/api/features");
    if (response.ok) {
      const body = await response.json();
      runtimeFlag = Boolean(body.arrowControls);
      return runtimeFlag;
    }
  } catch {
    // The build-time flag still covers local Vite.
  }
  runtimeFlag = readFlag(import.meta.env.VITE_ARROW_CONTROLS);
  return runtimeFlag;
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
  };

  const onArrow = (event, down) => {
    if (
      event.key !== "ArrowUp"
      && event.key !== "ArrowDown"
      && event.key !== "ArrowLeft"
      && event.key !== "ArrowRight"
    ) {
      return;
    }
    event.preventDefault();
    if (down && event.repeat) return;
    setHeld(event.key, down);
  };

  const onKeyDown = (event) => onArrow(event, true);
  const onKeyUp = (event) => onArrow(event, false);
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
