import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { BowlingScoreboard } from "../flight/bowling/BowlingScoreboard";
import { createFlightWorld } from "../flight/createFlightWorld";
import { FlapDetector } from "../flight/flapThrottle";
import {
  PLANE_BROADCAST_MS,
  adoptPlaneSnapshot,
  createRemotePilot,
  extrapolatePilot,
  pilotTint,
  snapshotAircraft,
  spawnAircraft,
} from "../flight/multiplayer/planeSync";
import {
  applyPinBroadcast,
  buildPinBroadcast,
  createPinHistory,
  predictLocalPins,
  shouldApplyPinState,
} from "../flight/multiplayer/pinSync";
import { stepBowlingGame } from "../flight/bowling/game";
import { stepPins } from "../flight/bowling/physics";
import { FLIGHT, stepAircraft } from "../flight/physics";
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
`;

export const CollaborativeFlight = ({ session }) => {
  const worldHostRef = useRef(null);
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const aircraftRef = useRef(null);
  const flapRef = useRef(new FlapDetector());
  const controlsRef = useRef({ throttle: 0, turn: 0, flapsPerSec: 0 });
  const sessionRef = useRef(session);
  const pilotsRef = useRef(new Map());
  const historyRef = useRef(createPinHistory());
  const pendingHitsRef = useRef([]);
  const lastRevisionRef = useRef(0);
  const revisionRef = useRef(0);
  const hostScoreRef = useRef(null);
  const contactRef = useRef(false);
  const publishPinsRef = useRef(() => {});
  sessionRef.current = session;

  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } =
    useFullscreen(stageRef);
  const [hud, setHud] = useState({
    throttle: 0,
    altitude: 2.2,
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

    const current = sessionRef.current;
    const players = current.room?.players ?? [];
    const slot = Math.max(0, players.indexOf(current.connectionId));
    const aircraft = spawnAircraft(slot);
    aircraftRef.current = aircraft;
    const world = createFlightWorld(host, { localTint: pilotTint(slot) });
    worldRef.current = world;
    world.update(aircraft, 0.016, { simulateBowling: false });

    const onResize = () => world.setSize();
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    document.addEventListener("webkitfullscreenchange", onResize);

    let last = performance.now();
    let lastHud = 0;
    let lastPlane = 0;
    let lastPins = 0;
    let announced = "";
    let frameId = 0;

    const publishPlane = (force, at) => {
      const live = sessionRef.current;
      if (!force && at - lastPlane < PLANE_BROADCAST_MS) {
        return;
      }
      lastPlane = at;
      live.sendPlane(snapshotAircraft(aircraftRef.current, at));
    };

    const publishPins = (reason) => {
      const live = sessionRef.current;
      const game = worldRef.current?.bowling?.game;
      if (!live.isHost || !game) {
        return;
      }
      const at = live.now();
      if (reason === "cadence" && at - lastPins < PLANE_BROADCAST_MS) {
        return;
      }
      lastPins = at;
      revisionRef.current += 1;
      live.sendPinState(buildPinBroadcast({
        revision: revisionRef.current,
        t: at,
        game,
        appliedHitIds: historyRef.current.appliedHitIds,
        reason,
        plane: snapshotAircraft(aircraftRef.current, at),
      }));
    };
    publishPinsRef.current = publishPins;

    const loop = (nowMs) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const live = sessionRef.current;
      flapRef.current.tick(nowMs);
      const controls = controlsRef.current;
      controls.throttle = flapRef.current.throttle;
      controls.flapsPerSec = flapRef.current.flapsPerSec;
      controls.flapping = flapRef.current.throttle > 0;
      aircraftRef.current = stepAircraft(aircraftRef.current, controls, dt);
      const at = live.now();
      const game = world.bowling.game;

      const players = live.room?.players ?? [];
      const playerKey = players.join("|");
      for (const id of pilotsRef.current.keys()) {
        if (!players.includes(id) || id === live.connectionId) {
          pilotsRef.current.delete(id);
        }
      }
      const remotes = [];
      players.forEach((id, index) => {
        if (id === live.connectionId) {
          return;
        }
        let pilot = pilotsRef.current.get(id);
        if (!pilot) {
          pilot = createRemotePilot(id);
          adoptPlaneSnapshot(pilot, snapshotAircraft(spawnAircraft(index), at), at);
          pilotsRef.current.set(id, pilot);
        }
        if (!pilot.state) {
          return;
        }
        extrapolatePilot(pilot, dt);
        remotes.push({ id, state: pilot.state, tint: pilotTint(index) });
      });

      let bowlingHud = hostScoreRef.current;
      if (live.isHost) {
        historyRef.current.record({
          t: at,
          dt,
          host: aircraftRef.current,
          game,
        });
        const beforePhase = game.phase;
        const beforeCard = game.card;
        const beforeNext = Boolean(game.startNext);
        const hit = stepBowlingGame(game, { state: aircraftRef.current, dt });
        const changed = hit
          || game.phase !== beforePhase
          || game.card !== beforeCard
          || Boolean(game.startNext) !== beforeNext;
        if (hit && !contactRef.current) {
          contactRef.current = true;
          publishPlane(true, at);
          publishPins("hit");
        } else if (!hit) {
          contactRef.current = false;
          if (changed) {
            publishPins("score");
          }
        }
        if (playerKey !== announced) {
          announced = playerKey;
          publishPins("join");
        }
        publishPins("cadence");
        bowlingHud = world.bowling.hud();
      } else {
        const hit = predictLocalPins(game.pins, aircraftRef.current, dt);
        if (hit && !contactRef.current) {
          contactRef.current = true;
          const hitId = `${live.connectionId}:${at}`;
          pendingHitsRef.current = [...pendingHitsRef.current, hitId];
          const plane = snapshotAircraft(aircraftRef.current, at);
          publishPlane(true, at);
          live.sendPinHit({ hitId, t: at, dt, plane });
        } else if (!hit) {
          contactRef.current = false;
        }
      }

      publishPlane(false, at);
      const shown = world.update(aircraftRef.current, dt, {
        simulateBowling: false,
        remotes,
        bowlingHud,
      });
      if (nowMs - lastHud > 100) {
        lastHud = nowMs;
        setHud({
          throttle: aircraftRef.current.throttle,
          altitude: aircraftRef.current.altitude,
          heading: aircraftRef.current.heading,
          climbRate: aircraftRef.current.climbRate,
          flapsPerSec: controls.flapsPerSec,
          moving: aircraftRef.current.moving,
          bowling: shown,
        });
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
      document.removeEventListener("webkitfullscreenchange", onResize);
      world.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    session.subscribe({
      onPlane: (message) => {
        const id = message?.connectionId;
        const live = sessionRef.current;
        if (!id || id === live.connectionId) {
          return;
        }
        let pilot = pilotsRef.current.get(id);
        if (!pilot) {
          pilot = createRemotePilot(id);
          pilotsRef.current.set(id, pilot);
        }
        adoptPlaneSnapshot(pilot, message.state, live.now());
      },
      onPinHit: (message) => {
        const live = sessionRef.current;
        const game = worldRef.current?.bowling?.game;
        if (!live.isHost || !game || !message?.hit?.plane) {
          return;
        }
        historyRef.current.applyHit(game, message.hit, {
          now: live.now(),
          host: aircraftRef.current,
        });
        publishPinsRef.current("hit");
      },
      onPinState: (payload) => {
        const live = sessionRef.current;
        const game = worldRef.current?.bowling?.game;
        if (live.isHost || !game) {
          return;
        }
        if (!shouldApplyPinState({
          payload,
          lastRevision: lastRevisionRef.current,
          pendingHitIds: pendingHitsRef.current,
        })) {
          return;
        }
        applyPinBroadcast(game, payload);
        if (payload.plane && live.room?.hostConnectionId) {
          const hostId = live.room.hostConnectionId;
          let pilot = pilotsRef.current.get(hostId);
          if (!pilot) {
            pilot = createRemotePilot(hostId);
            pilotsRef.current.set(hostId, pilot);
          }
          adoptPlaneSnapshot(pilot, payload.plane, live.now());
        }
        const late = Math.min(0.5, Math.max(0, (live.now() - payload.t) / 1000));
        if (late > 0) {
          stepPins(game.pins, { state: null, dt: late, planeHit: false });
        }
        lastRevisionRef.current = payload.revision;
        pendingHitsRef.current = [];
        hostScoreRef.current = payload.score;
      },
    });
  }, [session]);

  useEffect(() => {
    worldRef.current?.setSize();
  }, [isFullscreen]);

  const running = status === "running";
  const headingDeg = ((hud.heading * 180) / Math.PI + 360) % 360;
  const others = Math.max(0, (session.room?.players.length ?? 1) - 1);

  return (
    <>
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
          <div>{others === 1 ? "1 other pilot" : `${others} other pilots`}</div>
        </Hud>
        <FullscreenButton type="button" onClick={toggleFullscreen} disabled={!fullscreenSupported}>
          {isFullscreen ? "Exit full screen" : "Full screen"}
        </FullscreenButton>
        <Pip>
          <HiddenVideo ref={videoRef} playsInline muted />
          <OverlayCanvas ref={canvasRef} />
        </Pip>
      </Stage>
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
    </>
  );
};
