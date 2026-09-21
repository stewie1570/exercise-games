import { useCallback, useEffect, useState } from "react";

export const fullscreenElement = () =>
  document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

export const fullscreenEnabled = () =>
  Boolean(
    document.fullscreenEnabled ??
      document.webkitFullscreenEnabled ??
      document.documentElement?.requestFullscreen ??
      document.documentElement?.webkitRequestFullscreen
  );

export const requestFullscreenOn = (element) => {
  const request = element?.requestFullscreen ?? element?.webkitRequestFullscreen;
  if (!element || !request) {
    return Promise.resolve();
  }
  return Promise.resolve(request.call(element));
};

export const exitFullscreen = () => {
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  if (!exit || !fullscreenElement()) {
    return Promise.resolve();
  }
  return Promise.resolve(exit.call(document));
};

export const useFullscreen = (elementRef) => {
  const [active, setActive] = useState(false);
  const supported = fullscreenEnabled();

  useEffect(() => {
    const sync = () => {
      setActive(fullscreenElement() === elementRef.current);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [elementRef]);

  const toggle = useCallback(() => {
    const element = elementRef.current;
    if (!element) {
      return Promise.resolve();
    }
    if (fullscreenElement() === element) {
      return exitFullscreen();
    }
    return requestFullscreenOn(element);
  }, [elementRef]);

  return { isFullscreen: active, toggle, supported };
};
