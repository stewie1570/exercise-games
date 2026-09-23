import React, { useState } from "react";
import styled from "styled-components";
import { AppNav } from "../components/AppNav";
import { useRoomSession } from "../hooks/useRoomSession";
import { CollaborativeFlight } from "./CollaborativeFlight";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const Layout = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
`;

const Code = styled.p`
  margin: 0.25rem 0 0;
  font-size: 2rem;
  letter-spacing: 0.35rem;
  font-weight: 700;
`;

const normalizeCode = (value) => value
  .toUpperCase()
  .split("")
  .filter((character) => CODE_ALPHABET.includes(character))
  .join("")
  .slice(0, 4);

export const TogetherPage = () => {
  const session = useRoomSession();
  const [code, setCode] = useState("");
  const inRoom = Boolean(session.room && session.connectionId);

  const join = (event) => {
    event.preventDefault();
    if (code.length === 4) {
      session.joinRoom(code);
    }
  };

  return (
    <div className="container">
      <AppNav current="together" />
      <div className="card mb-3">
        <div className="card-body">
          <h1 className="mb-2">Play together</h1>
          {inRoom ? (
            <>
              <p className="mb-2" style={{ color: "var(--color-text-secondary)" }}>
                {session.isHost
                  ? "You are the host. Pins and the scoreboard live on your machine and are sent to the room."
                  : "You joined the host's lane. Your plane is local. Pin hits are sent to the host, who sends back each pin's trajectory."}
                {" "}
                Plane positions go out about ten times a second, and immediately when someone hits a pin.
              </p>
              <p className="mb-1">Room code</p>
              <Code>{session.room.code}</Code>
              <p className="mb-3" style={{ color: "var(--color-text-secondary)" }}>
                {session.room.players.length} in this game
              </p>
              <button className="btn btn-secondary" type="button" onClick={session.leaveRoom}>
                Leave game
              </button>
            </>
          ) : (
            <>
              <p className="mb-3" style={{ color: "var(--color-text-secondary)" }}>
                Host a lane or join with a 4-character code. Each pilot flies their own ultralight.
                The host keeps the pins and the scoreboard.
              </p>
              <Layout>
                <div>
                  <h2 className="h5">Host</h2>
                  <p style={{ color: "var(--color-text-secondary)" }}>
                    Start a new code and share it. You own the pins.
                  </p>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={session.hostRoom}
                    disabled={!session.isConnected}
                  >
                    Host a game
                  </button>
                </div>
                <form onSubmit={join}>
                  <h2 className="h5">Join</h2>
                  <label className="form-label" htmlFor="room-code">
                    4-character code
                  </label>
                  <input
                    id="room-code"
                    className="form-control mb-2"
                    value={code}
                    maxLength={4}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setCode(normalizeCode(event.target.value))}
                  />
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!session.isConnected || code.length !== 4}
                  >
                    Join game
                  </button>
                </form>
              </Layout>
            </>
          )}
          {!session.isConnected && <p className="mt-3 mb-0">Connecting...</p>}
          {session.error && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {session.error}
            </div>
          )}
        </div>
      </div>
      {inRoom && <CollaborativeFlight session={session} />}
    </div>
  );
};
