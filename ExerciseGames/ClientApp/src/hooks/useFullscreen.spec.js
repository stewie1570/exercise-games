import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { useFullscreen } from "./useFullscreen";

const installFullscreen = () => {
  let current = null;
  const listeners = new Set();

  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => current,
  });
  document.exitFullscreen = vi.fn(() => {
    current = null;
    listeners.forEach((listener) => listener());
    return Promise.resolve();
  });
  Element.prototype.requestFullscreen = vi.fn(function requestFullscreen() {
    current = this;
    listeners.forEach((listener) => listener());
    return Promise.resolve();
  });
  document.addEventListener = vi.fn((type, listener) => {
    if (type === "fullscreenchange") {
      listeners.add(listener);
    }
  });
  document.removeEventListener = vi.fn((type, listener) => {
    listeners.delete(listener);
  });
};

test("toggles full screen on the referenced element", async () => {
  installFullscreen();
  const element = document.createElement("div");
  const { result } = renderHook(() => {
    const ref = useRef(element);
    return useFullscreen(ref);
  });

  expect(result.current.supported).toBe(true);
  expect(result.current.isFullscreen).toBe(false);

  await act(async () => {
    await result.current.toggle();
  });
  expect(element.requestFullscreen).toHaveBeenCalled();
  expect(result.current.isFullscreen).toBe(true);

  await act(async () => {
    await result.current.toggle();
  });
  expect(document.exitFullscreen).toHaveBeenCalled();
  expect(result.current.isFullscreen).toBe(false);
});
