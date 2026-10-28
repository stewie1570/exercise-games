import { flightPixelRatio, flightRendererParameters } from "./flightRender";

test("pixel ratio stays at 1 for normal windows and drops on huge viewports", () => {
  expect(flightPixelRatio(1100, 700, 2)).toBe(1);
  expect(flightPixelRatio(1100, 700, 1)).toBe(1);
  expect(flightPixelRatio(2560, 1440, 1)).toBeCloseTo(1920 / 2560);
  expect(flightPixelRatio(0, 0, 2)).toBe(1);
});

test("the flight renderer does not request the high-power GPU or a stencil buffer", () => {
  expect(flightRendererParameters()).toMatchObject({
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: "low-power",
  });
});
