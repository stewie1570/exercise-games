import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { AppNav } from "../components/AppNav";
import { ARMS_OUT_DEG, FlapDetector } from "../flight/flapThrottle";
import { createAircraftState, FLIGHT, stepAircraft } from "../flight/physics";
import { useGameHub } from "../hooks/useGameHub";
import { usePoseCamera } from "../hooks/usePoseCamera";

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
  margin-bottom: 1rem;
`;

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
`;

const CameraCard = styled.div`
  position: relative;
  overflow: hidden;
  background: var(--color-camera-bg);
  min-height: 320px;
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
  background: var(--color-camera-bg);
`;

const Placeholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #cbd5e1;
`;

const StatusDot = styled.span`
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  margin-right: 0.5rem;
  background: ${(props) => props.$color};
`;

const AngleGrid = styled.div`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const AngleCard = styled.div`
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: var(--color-input-bg);
`;

const AngleValue = styled.div`
  font-size: 1.15rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
`;

const ThrottleTrack = styled.div`
  position: relative;
  width: 100%;
  height: 12px;
  margin-top: 0.4rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.18);
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
  background: #f59e0b;
`;

const FlapGrid = styled.div`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
`;

const Legend = styled.ul`
  margin: 0;
  padding-left: 1.1rem;
  color: var(--color-text-secondary);
  font-size: 0.92rem;
`;

const formatDeg = (value) => (value == null ? "—" : `${Math.round(value)}°`);

const formatClimb = (value) => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)} m/s`;
};

const AngleReadout = ({ title, color, rows }) => (
  <AngleCard>
    <div style={{ fontWeight: 700, color, marginBottom: "0.35rem" }}>{title}</div>
    {rows.map((row) => (
      <div key={row.label} className="d-flex justify-content-between">
        <span>{row.label}</span>
        <AngleValue style={{ color }}>{formatDeg(row.value)}</AngleValue>
      </div>
    ))}
  </AngleCard>
);

export const DiagnosticsPage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const flapRef = useRef(new FlapDetector());
  const aircraftRef = useRef(createAircraftState());
  const { isConnected } = useGameHub();
  const [flapHud, setFlapHud] = useState({
    throttle: 0,
    flapsPerSec: 0,
    armsOut: false,
    climbRate: 0,
    altitude: aircraftRef.current.altitude,
  });
  const { status, error, pose, startCamera, stopCamera } = usePoseCamera({
    videoRef,
    canvasRef,
    onFrame: (overlay) => {
      flapRef.current.update(overlay?.landmarks, performance.now(), overlay?.pose);
    },
  });

  useEffect(() => {
    let last = performance.now();
    let lastHud = 0;
    let frameId = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      flapRef.current.tick(now);
      const throttle = flapRef.current.throttle;
      aircraftRef.current = stepAircraft(
        aircraftRef.current,
        { throttle, turn: 0, flapping: throttle > 0 },
        dt
      );
      if (now - lastHud > 80) {
        lastHud = now;
        setFlapHud({
          throttle,
          flapsPerSec: flapRef.current.flapsPerSec,
          armsOut: flapRef.current.armsOut,
          climbRate: aircraftRef.current.climbRate,
          altitude: aircraftRef.current.altitude,
        });
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const running = status === "running";
  const cameraLabel = useMemo(() => {
    if (status === "loading") {
      return "Loading pose model...";
    }
    if (running) {
      return pose.detected ? "Tracking head and arms" : "Stand in frame";
    }
    return "Camera off";
  }, [pose.detected, running, status]);

  return (
    <div className="container">
      <AppNav current="diagnostics" />
      <div className="card mb-4">
        <div className="card-body">
          <h1 className="mb-2">Pose diagnostics</h1>
          <p className="mb-0" style={{ color: "var(--color-text-secondary)" }}>
            Point a camera at yourself. The overlay traces a stick figure, and the flap/throttle
            panel uses the same detector as flight so you can tune arm-out flapping without the
            3D world.
          </p>
        </div>
      </div>

      <Toolbar>
        <StatusRow>
          <div>
            <StatusDot $color={running ? "#34d399" : "#94a3b8"} />
            {cameraLabel}
          </div>
          <div>
            <StatusDot $color={isConnected ? "#34d399" : "#f87171"} />
            SignalR {isConnected ? "connected" : "disconnected"}
          </div>
        </StatusRow>
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
      </Toolbar>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <CameraCard className="card mb-4">
        <HiddenVideo ref={videoRef} playsInline muted />
        <OverlayCanvas ref={canvasRef} />
        {!running && (
          <Placeholder>
            {status === "loading"
              ? "Starting camera and loading the pose model..."
              : "Start the camera to trace your head and arms."}
          </Placeholder>
        )}
      </CameraCard>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="mt-0" style={{ fontSize: "1.05rem" }}>Flap / throttle</h2>
          <FlapGrid>
            <AngleCard>
              <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Arms out</div>
              <AngleValue style={{ color: flapHud.armsOut ? "#059669" : "#b45309" }}>
                {flapHud.armsOut ? "Yes" : "No"}
              </AngleValue>
              <div className="d-flex justify-content-between">
                <span>Left</span>
                <AngleValue>{formatDeg(pose.leftArm.upperArmDeg)}</AngleValue>
              </div>
              <div className="d-flex justify-content-between">
                <span>Right</span>
                <AngleValue>{formatDeg(pose.rightArm.upperArmDeg)}</AngleValue>
              </div>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                Both upper arms must be above {ARMS_OUT_DEG}°.
              </div>
            </AngleCard>
            <AngleCard>
              <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Throttle</div>
              <AngleValue>{Math.round(flapHud.throttle * 100)}%</AngleValue>
              <ThrottleTrack>
                <ThrottleFill $value={flapHud.throttle} />
                <MaintainMark />
              </ThrottleTrack>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                Yellow mark is level flight.
              </div>
            </AngleCard>
            <AngleCard>
              <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Flaps</div>
              <AngleValue>{flapHud.flapsPerSec.toFixed(1)} /s</AngleValue>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                Two flaps per second is full throttle.
              </div>
            </AngleCard>
            <AngleCard>
              <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Climb</div>
              <AngleValue>{formatClimb(flapHud.climbRate)}</AngleValue>
              <div className="d-flex justify-content-between">
                <span>Altitude</span>
                <AngleValue>{Math.round(flapHud.altitude)} m</AngleValue>
              </div>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                Vertical speed ramps; it does not jump to the target.
              </div>
            </AngleCard>
          </FlapGrid>
        </div>
      </div>

      <AngleGrid className="mb-4">
        <AngleReadout
          title="Head"
          color="var(--color-text-primary)"
          rows={[
            { label: "Tilt", value: pose.head.tiltDeg },
            { label: "Turn", value: pose.head.turnDeg },
            { label: "Pitch", value: pose.head.pitchDeg },
          ]}
        />
        <AngleReadout
          title="Body"
          color="var(--color-text-primary)"
          rows={[{ label: "Tilt", value: pose.body?.tiltDeg }]}
        />
        <AngleReadout
          title="Left arm"
          color="#38bdf8"
          rows={[
            { label: "Upper arm", value: pose.leftArm.upperArmDeg },
            { label: "Elbow", value: pose.leftArm.elbowDeg },
            { label: "Forearm", value: pose.leftArm.forearmDeg },
          ]}
        />
        <AngleReadout
          title="Right arm"
          color="#fb7185"
          rows={[
            { label: "Upper arm", value: pose.rightArm.upperArmDeg },
            { label: "Elbow", value: pose.rightArm.elbowDeg },
            { label: "Forearm", value: pose.rightArm.forearmDeg },
          ]}
        />
      </AngleGrid>

      <div className="card">
        <div className="card-body">
          <h3 className="mt-0" style={{ fontSize: "1rem" }}>How to read the numbers</h3>
          <Legend>
            <li>Head tilt: 0° is level. Positive tilts toward your right shoulder.</li>
            <li>Body tilt: 0° is shoulders level. Positive tilts toward your right.</li>
            <li>Head turn: 0° faces the camera. Positive turns toward your right.</li>
            <li>Head pitch: 0° looks straight. Positive looks up.</li>
            <li>
              Upper arm / forearm: 0° hangs down along your torso, 90° is out to the side, 180° is
              up. These follow the body, so leaning to turn does not look like the arms moved.
            </li>
            <li>Elbow: 180° is straight. Smaller values mean a tighter bend.</li>
            <li>Flaps only count when both arms are out past {ARMS_OUT_DEG}°. Hanging arms are ignored.</li>
            <li>Climb is a simulated vertical speed from the same flight physics, without the 3D world.</li>
          </Legend>
        </div>
      </div>
    </div>
  );
};
