import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { AppNav } from "../components/AppNav";
import { createFlightWorld } from "../flight/createFlightWorld";
import { BowlingScoreboard } from "../flight/bowling/BowlingScoreboard";
import { FlapDetector } from "../flight/flapThrottle";
import { arrowControlsEnabled, createArrowControls } from "../flight/arrowControls";
import { createAircraftState, FLIGHT, stepAircraft } from "../flight/physics";
import { steeringFromTilt } from "../flight/tiltSteering";
import { useFullscreen } from "../hooks/useFullscreen";
import { usePoseCamera } from "../hooks/usePoseCamera";

const Stage = styled.div`
  position: relative;
  height: min(72vh, 720px);
  min-height: 420px;
  overflow: hidden;
  background: #87b7e0;

  &:fullscreen,
  &:-webkit-full-screen {
    width: 100%;
    height: 100%;
    min-height: 100%;
    max-height: none;
    border-radius: 0;
    border: none;
    box-shadow: none;
    margin: 0;
  }
`;

const WorldHost = styled.div`
  position: absolute;
  inset: 0;
`;

const Hud = styled.div`
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 8.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  pointer-events: none;
  color: #f8fafc;
  text-shadow: 0 1px 2px rgba(15, 23, 42, 0.8);
  font-variant-numeric: tabular-nums;
`;

const Pip = styled.div`
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  width: min(220px, 36%);
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(248, 250, 252, 0.25);
  background: #020617;
`;

const HiddenVideo = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  pointer-events: none;
`;

const OverlayCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: auto;
`;

const ThrottleTrack = styled.div`
  position: relative;
  width: 160px;
  height: 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.45);
  overflow: hidden;
`;

const ThrottleFill = styled.div`
  height: 100%;
  width: ${(props) => `${Math.round(props.$value * 100)}%`};
  background: linear-gradient(90deg, #38bdf8, #34d399);
`;

const MaintainMark = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${Math.round(FLIGHT.maintainThrottle * 100)}%;
  width: 2px;
  background: #fbbf24;
`;

const FullscreenButton = styled.button`
  pointer-events: auto;
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  border: 1px solid rgba(248, 250, 252, 0.35);
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  background: rgba(15, 23, 42, 0.55);
  color: #f8fafc;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(15, 23, 42, 0.75);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const FlightPage = () => {
  const worldHostRef = useRef(null);
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const aircraftRef = useRef(createAircraftState());
  const flapRef = useRef(new FlapDetector());
  const controlsRef = useRef({ throttle: 0, turn: 0, flapsPerSec: 0 });
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } =
    useFullscreen(stageRef);
  const [hud, setHud] = useState({
    throttle: 0,
    altitude: aircraftRef.current.altitude,
    heading: 0,
    climbRate: 0,
    flapsPerSec: 0,
    moving: false,
    bowling: null,
  });

  const { status, error, startCamera, stopCamera } = usePoseCamera({
    videoRef,
    canvasRef,
    autoStart: true,
    onFrame: (overlay) => {
      if (arrowControlsEnabled()) {
        return;
      }
      const throttle = flapRef.current.update(
        overlay?.landmarks,
        performance.now(),
        overlay?.pose
      );
      const turn = steeringFromTilt({
        headTiltDeg: overlay?.pose?.head?.tiltDeg,
        bodyTiltDeg: overlay?.pose?.body?.tiltDeg,
      });
      controlsRef.current = {
        throttle,
        turn,
        flapsPerSec: flapRef.current.flapsPerSec,
        flapping: throttle > 0,
      };
    },
  });

  useEffect(() => {
    const host = worldHostRef.current;
    if (!host) {
      return undefined;
    }

    const world = createFlightWorld(host);
    worldRef.current = world;
    world.update(aircraftRef.current, 0.016);
    const onResize = () => world.setSize();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    document.addEventListener("webkitfullscreenchange", onResize);

    let last = performance.now();
    let lastHud = 0;
    let frameId = 0;
    const arrows = arrowControlsEnabled() ? createArrowControls() : null;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const controls = controlsRef.current;
      if (arrows) {
        Object.assign(controls, arrows.step(dt));
      } else {
        flapRef.current.tick(now);
        controls.throttle = flapRef.current.throttle;
        controls.flapsPerSec = flapRef.current.flapsPerSec;
        controls.flapping = flapRef.current.throttle > 0;
      }
      aircraftRef.current = stepAircraft(aircraftRef.current, controls, dt);
      const bowling = world.update(aircraftRef.current, dt);
      if (now - lastHud > 100) {
        lastHud = now;
        setHud({
          throttle: aircraftRef.current.throttle,
          altitude: aircraftRef.current.altitude,
          heading: aircraftRef.current.heading,
          climbRate: aircraftRef.current.climbRate,
          flapsPerSec: controls.flapsPerSec,
          moving: aircraftRef.current.moving,
          bowling,
        });
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => {
      arrows?.dispose();
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
      document.removeEventListener("webkitfullscreenchange", onResize);
      world.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    worldRef.current?.setSize();
  }, [isFullscreen]);

  const running = status === "running";
  const headingDeg = ((hud.heading * 180) / Math.PI + 360) % 360;

  return (
    <div className="container">
      <AppNav current="fly" />
      <div className="card mb-3">
        <div className="card-body">
          <h1 className="mb-2">Ultralight flight</h1>
          <p className="mb-2" style={{ color: "var(--color-text-secondary)" }}>
            The camera starts automatically. Hold both arms out past 40°, then flap to take off:
            two flaps per second is full throttle, and staying still is none. Faster flapping
            climbs. A steady medium flap holds altitude. Stop flapping and you glide down. Tilt
            your body or neck to turn. A bowling alley sits east of the runway — fly through the
            pins to knock them down and keep score.
          </p>
          {running ? (
            <button className="btn btn-secondary" type="button" onClick={stopCamera}>
              Stop camera
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              onClick={startCamera}
              disabled={status === "loading"}
            >
              {status === "loading" ? "Starting..." : "Start camera"}
            </button>
          )}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={toggleFullscreen}
            disabled={!fullscreenSupported}
            style={{ marginLeft: "0.5rem" }}
          >
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <Stage ref={stageRef} className="card mb-3">
        <WorldHost ref={worldHostRef} />
        <Hud>
          <div>
            Throttle
            <ThrottleTrack>
              <ThrottleFill $value={hud.throttle} />
              <MaintainMark />
            </ThrottleTrack>
          </div>
          <BowlingScoreboard bowling={hud.bowling} />
          <div>Alt {Math.round(hud.altitude)} m</div>
          <div>HDG {headingDeg.toFixed(0).padStart(3, "0")}</div>
          <div>
            {!hud.moving
              ? "Parked"
              : hud.altitude <= FLIGHT.minAltitude + 0.05
                ? "Rollout"
                : hud.climbRate >= 0.3
                  ? "Climb"
                  : hud.climbRate <= -0.3
                    ? "Descend"
                    : "Level"}
          </div>
          <div>Flaps {hud.flapsPerSec.toFixed(1)} /s</div>
        </Hud>
        <FullscreenButton
          type="button"
          onClick={toggleFullscreen}
          disabled={!fullscreenSupported}
        >
          {isFullscreen ? "Exit full screen" : "Full screen"}
        </FullscreenButton>
        <Pip>
          <HiddenVideo ref={videoRef} playsInline muted />
          <OverlayCanvas ref={canvasRef} />
        </Pip>
      </Stage>
    </div>
  );
};
