import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { TogetherPage } from "./TogetherPage";

const session = vi.hoisted(() => ({
  isConnected: true,
  connectionId: "me",
  room: null,
  error: null,
  isHost: false,
  now: () => 0,
  subscribe: vi.fn(),
  hostRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  sendPlane: vi.fn(),
  sendPinHit: vi.fn(),
  sendPinState: vi.fn(),
}));

vi.mock("../hooks/useRoomSession", () => ({
  useRoomSession: () => session,
}));

vi.mock("../hooks/usePoseCamera", () => ({
  usePoseCamera: () => ({
    status: "idle",
    error: null,
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
  }),
}));

vi.mock("../flight/createFlightWorld", () => ({
  createFlightWorld: () => ({
    setSize: vi.fn(),
    update: vi.fn(() => null),
    dispose: vi.fn(),
    bowling: {
      game: {
        pins: [],
        card: { frames: [] },
        phase: "ready",
        settleIn: 0,
        fallenAtBallStart: 0,
        startNext: false,
      },
      syncMeshes: vi.fn(),
      hud: () => null,
    },
  }),
}));

beforeEach(() => {
  session.isConnected = true;
  session.connectionId = "me";
  session.room = null;
  session.error = null;
  session.isHost = false;
  session.hostRoom.mockClear();
  session.joinRoom.mockClear();
  session.leaveRoom.mockClear();
});

test("the lobby hosts or joins with a 4-character code", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <TogetherPage />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: "Play together" })).toBeInTheDocument();
  expect(screen.getByText(/host keeps the pins and the scoreboard/i)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Host a game" }));
  expect(session.hostRoom).toHaveBeenCalled();

  const code = screen.getByLabelText("4-character code");
  await user.type(code, "abco");
  expect(code).toHaveValue("ABC");
  expect(screen.getByRole("button", { name: "Join game" })).toBeDisabled();

  await user.type(code, "d");
  expect(code).toHaveValue("ABCD");
  await user.click(screen.getByRole("button", { name: "Join game" }));
  expect(session.joinRoom).toHaveBeenCalledWith("ABCD");
});

test("a joined room shows the code and the shared lane", () => {
  session.room = { code: "K7QP", hostConnectionId: "me", players: ["me", "them"] };
  session.isHost = true;
  render(
    <MemoryRouter>
      <TogetherPage />
    </MemoryRouter>
  );

  expect(screen.getByText("K7QP")).toBeInTheDocument();
  expect(screen.getByText("2 in this game")).toBeInTheDocument();
  expect(screen.getByText(/you are the host/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Bowling scoreboard")).toBeInTheDocument();
  expect(screen.getByText("1 other pilot")).toBeInTheDocument();
});
