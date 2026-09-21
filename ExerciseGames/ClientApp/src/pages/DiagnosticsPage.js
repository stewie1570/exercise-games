import React, { useMemo, useRef } from "react";
import styled from "styled-components";
import { AppNav } from "../components/AppNav";
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

const Legend = styled.ul`
  margin: 0;
  padding-left: 1.1rem;
  color: var(--color-text-secondary);
  font-size: 0.92rem;
`;

const formatDeg = (value) => (value == null ? "—" : `${Math.round(value)}°`);

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
  const lastSentRef = useRef(0);
  const { isConnected, sendPose } = useGameHub();
  const { status, error, pose, startCamera, stopCamera } = usePoseCamera({
    videoRef,
    canvasRef,
    onPose: (nextPose) => {
      const now = performance.now();
      if (now - lastSentRef.current < 100) {
        return;
      }
      lastSentRef.current = now;
      sendPose({
        head: nextPose.head,
        body: nextPose.body,
        leftArm: nextPose.leftArm,
        rightArm: nextPose.rightArm,
      });
    },
  });

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
            Point a camera at yourself. The overlay traces a stick figure to match your
            head and arm angles so later games can use the same live pose stream.
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
            <li>Upper arm / forearm: 0° hangs down, 90° is out to the side, 180° is up.</li>
            <li>Elbow: 180° is straight. Smaller values mean a tighter bend.</li>
          </Legend>
        </div>
      </div>
    </div>
  );
};
