import { HubConnectionBuilder, HttpTransportType } from "@microsoft/signalr";
import { useCallback, useRef, useState } from "react";
import { createServerClock } from "../flight/multiplayer/planeSync";
import { useLifeCycle } from "./useLifeCycle";

const readRoom = (roster) => ({
  code: roster?.code ?? "",
  hostConnectionId: roster?.hostConnectionId ?? null,
  players: roster?.players ?? [],
});

export const useRoomSession = () => {
  const connection = useRef(null);
  const handlers = useRef({});
  const clock = useRef(createServerClock());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  useLifeCycle({
    onMount: () => {
      const hub = new HubConnectionBuilder()
        .withUrl("/gameHub", { transport: HttpTransportType.WebSockets })
        .withAutomaticReconnect()
        .build();
      connection.current = hub;

      hub.on("hello", (message) => {
        setConnectionId(message?.connectionId ?? null);
      });
      hub.on("roster", (roster) => {
        setRoom(readRoom(roster));
        setError(null);
      });
      hub.on("roomClosed", () => {
        setRoom(null);
        setError("The host ended the game.");
      });
      hub.on("plane", (message) => handlers.current.onPlane?.(message));
      hub.on("pinHit", (message) => handlers.current.onPinHit?.(message));
      hub.on("pinState", (message) => handlers.current.onPinState?.(message));
      hub.onclose(() => setIsConnected(false));
      hub.onreconnecting(() => setIsConnected(false));
      hub.onreconnected(() => setIsConnected(true));

      hub
        .start()
        .then(async () => {
          setIsConnected(true);
          await hub.invoke("Hello");
          const sent = Date.now();
          const server = await hub.invoke("Clock");
          clock.current.note(sent, Date.now(), server);
        })
        .catch(() => {
          setIsConnected(false);
          setError("Could not connect to the game server.");
        });
    },
    onUnMount: () => {
      connection.current?.stop();
    },
  });

  const subscribe = useCallback((next) => {
    handlers.current = next ?? {};
  }, []);

  const hostRoom = async () => {
    setError(null);
    try {
      const session = await connection.current.invoke("HostRoom");
      if (!session?.code) {
        setError("Could not start a game.");
        return null;
      }
      setConnectionId(session.connectionId ?? connectionId);
      setRoom(readRoom(session));
      return session;
    } catch {
      setError("Could not start a game.");
      return null;
    }
  };

  const joinRoom = async (code) => {
    setError(null);
    try {
      const session = await connection.current.invoke("JoinRoom", code);
      if (!session?.code) {
        setError("No game is using that code.");
        return null;
      }
      setConnectionId(session.connectionId ?? connectionId);
      setRoom(readRoom(session));
      return session;
    } catch {
      setError("Could not join that game.");
      return null;
    }
  };

  const leaveRoom = async () => {
    try {
      await connection.current?.invoke("LeaveRoom");
    } catch {
      // The lobby is local either way.
    }
    setRoom(null);
    setError(null);
  };

  const send = (method, payload) => {
    if (!connection.current || connection.current.state !== "Connected") {
      return;
    }
    connection.current.send(method, payload).catch(() => {});
  };

  const sendPlane = (state) => send("Plane", state);
  const sendPinHit = (hit) => send("PinHit", hit);
  const sendPinState = (state) => send("PinState", state);

  const isHost = Boolean(room && connectionId && room.hostConnectionId === connectionId);

  return {
    isConnected,
    connectionId,
    room,
    error,
    isHost,
    now: () => clock.current.now(),
    subscribe,
    hostRoom,
    joinRoom,
    leaveRoom,
    sendPlane,
    sendPinHit,
    sendPinState,
  };
};
