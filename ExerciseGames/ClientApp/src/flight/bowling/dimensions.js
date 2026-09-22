export const PLANE_WINGSPAN = 11.2;

// USBC pin: 4.766" belly, 15" height, 12" centers, 2.03" base, ~2.55" head.
const BELLY_IN = 4.766;
const HEIGHT_IN = 15;
const SPACING_IN = 12;
const BASE_IN = 2.03;
const HEAD_IN = 2.55;

export const PIN_BELLY = PLANE_WINGSPAN / 3;
export const PIN_HEIGHT = (PIN_BELLY * HEIGHT_IN) / BELLY_IN;
export const PIN_SPACING = (PIN_BELLY * SPACING_IN) / BELLY_IN;
export const PIN_BASE = (PIN_BELLY * BASE_IN) / BELLY_IN;
export const PIN_HEAD = (PIN_BELLY * HEAD_IN) / BELLY_IN;
export const PIN_RESET_DELAY = 6;

export const PIN_SPHERES = [
  { y: PIN_HEIGHT * 0.08, radius: PIN_BASE * 0.5 },
  { y: PIN_HEIGHT * 0.32, radius: PIN_BELLY * 0.5 },
  { y: PIN_HEIGHT * 0.86, radius: PIN_HEAD * 0.5 },
];

export const PIN_COM_Y = PIN_HEIGHT * 0.38;
export const PIN_MASS = 90;

export const pinSlots = (spacing = PIN_SPACING) => {
  const slots = [];
  for (let row = 0; row < 4; row += 1) {
    const count = row + 1;
    const z = -row * spacing * Math.sqrt(3) / 2;
    const x0 = -((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i += 1) {
      slots.push({ x: x0 + i * spacing, z, index: slots.length });
    }
  }
  return slots;
};

export const PLANE_HULLS = [
  { center: [0, 1.62, -0.15], half: [5.6, 0.28, 0.95] },
  { center: [0, 0.55, -0.15], half: [0.52, 0.52, 1.65] },
  { center: [0, 0.55, -1.52], half: [0.4, 0.4, 0.45] },
  { center: [0, 0.58, 3.55], half: [1.3, 0.22, 0.4] },
];
