import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { DiagnosticsPage } from "./DiagnosticsPage";

vi.mock("../hooks/useGameHub", () => ({
  useGameHub: () => ({ isConnected: true, connectionId: "abc", sendPose: vi.fn() }),
}));

vi.mock("../hooks/usePoseCamera", () => ({
  usePoseCamera: () => ({
    status: "idle",
    error: null,
    pose: {
      detected: false,
      head: { tiltDeg: null, turnDeg: null, pitchDeg: null },
      body: { tiltDeg: null },
      leftArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
      rightArm: { upperArmDeg: null, elbowDeg: null, forearmDeg: null },
    },
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
  }),
}));

test("diagnostics page shows start camera and angle panels", () => {
  render(
    <MemoryRouter>
      <DiagnosticsPage />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: "Pose diagnostics" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start camera" })).toBeInTheDocument();
  expect(screen.getByText("SignalR connected")).toBeInTheDocument();
  expect(screen.getByText("Left arm")).toBeInTheDocument();
  expect(screen.getByText("Right arm")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Flap / throttle" })).toBeInTheDocument();
  expect(screen.getByText("Arms out")).toBeInTheDocument();
  expect(screen.getByText("Throttle")).toBeInTheDocument();
  expect(screen.getByText("Flaps")).toBeInTheDocument();
  expect(screen.getByText("Climb")).toBeInTheDocument();
});
