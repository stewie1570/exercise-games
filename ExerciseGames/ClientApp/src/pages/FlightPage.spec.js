import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { usePoseCamera } from "../hooks/usePoseCamera";
import { FlightPage } from "./FlightPage";

vi.mock("../hooks/usePoseCamera", () => ({
  usePoseCamera: vi.fn(() => ({
    status: "loading",
    error: null,
    pose: {
      detected: false,
      head: { tiltDeg: null },
      body: { tiltDeg: null },
    },
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
  })),
}));

vi.mock("../flight/createFlightWorld", () => ({
  createFlightWorld: () => ({
    setSize: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  }),
}));

test("flight page explains arm flaps and tilt steering", () => {
  render(
    <MemoryRouter>
      <FlightPage />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: "Ultralight flight" })).toBeInTheDocument();
  expect(usePoseCamera).toHaveBeenCalledWith(expect.objectContaining({ autoStart: true }));
  expect(screen.getByRole("button", { name: "Starting..." })).toBeInTheDocument();
  expect(screen.getByText(/camera starts automatically/i)).toBeInTheDocument();
  expect(screen.getByText(/both arms out past 40/i)).toBeInTheDocument();
  expect(screen.getByText(/bowling alley sits east of the runway/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Bowling scoreboard")).toBeInTheDocument();
  expect(screen.getByText("Parked")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Full screen" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
});
