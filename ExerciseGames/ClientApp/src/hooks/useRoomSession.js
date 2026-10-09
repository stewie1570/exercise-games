import { HubConnectionBuilder, HttpTransportType } from "@microsoft/signalr";
import { useCallback, useRef, useState } from "react";
import { createServerClock } from "../flight/multiplayer/planeSync";
import { createRoomCode, rememberedHostCode, rememberHostCode } from "../flight/multiplayer/roomCode";
import { useLifeCycle } from "./useLifeCycle";

const samePlayers = (left = [], right = []) => left.length === right.length
  && left.every((id, index) => id === right[index]);

export const useRoomSession = () => {
  const connection = useRef(null);
  const handlers = useRef({});
  const clock = useRef(createServerClock());
  const codeRef = useRef(null);
  const connectionIdRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  const noteConnection = (id) => {
    connectionIdRef.current = id;
    setConnectionId(id);
  };

  useLifeCycle({
    onMount: () => {
      const hub = new HubConnectionBuilder()
        .withUrl("/gameHub", { transport: HttpTransportType.WebSockets })
        .withAutomaticReconnect()
        .build();
      connection.current = hub;

      hub.on("hello", (message) => {
        noteConnection(message?.connectionId ?? null);
      });
      hub.on("plane", (message) => handlers.current.onPlane?.(message));
      hub.on("pinState", (message) => handlers.current.onPinState?.(message));
      hub.onclose(() => setIsConnected(false));
      hub.onreconnecting(() => setIsConnected(false));
      hub.onreconnected(() => {
        setIsConnected(true);
        const code = codeRef.current;
        if (code) {
          hub.invoke("JoinRoom", code).catch(() => {});
        }
      });

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
      const hub = connection.current;
      const code = codeRef.current;
      if (code) {
        hub?.invoke("LeaveRoom", code).catch(() => {});
      }
      hub?.stop();
    },
  });

  const subscribe = useCallback((next) => {
    handlers.current = next ?? {};
  }, []);

  const enter = async (code) => {
    const previous = codeRef.current;
    if (previous && previous !== code) {
      try {
        await connection.current?.invoke("LeaveRoom", previous);
      } catch {
        // The next join still moves this browser to the new code.
      }
    }
    const joined = await connection.current.invoke("JoinRoom", code);
    if (!joined) {
      return null;
    }
    codeRef.current = joined;
    const self = connectionIdRef.current;
    setRoom({ code: joined, players: self ? [self] : [] });
    setError(null);
    return joined;
  };

  const hostRoom = async () => {
    setError(null);
    try {
      const code = createRoomCode();
      rememberHostCode(code);
      const joined = await enter(code);
      if (!joined) {
        setError("Could not start a game.");
        return null;
      }
      console.log(`Multiplayer connect: hosted ${joined}`);
      return joined;
    } catch {
      setError("Could not start a game.");
      return null;
    }
  };

  const joinRoom = async (code) => {
    setError(null);
    try {
      const joined = await enter(code);
      if (!joined) {
        setError("Could not join that game.");
        return null;
      }
      console.log(`Multiplayer connect: joined ${joined}`);
      return joined;
    } catch {
      setError("Could not join that game.");
      return null;
    }
  };

  const leaveRoom = async () => {
    const code = codeRef.current;
    codeRef.current = null;
    try {
      if (code) {
        await connection.current?.invoke("LeaveRoom", code);
      }
    } catch {
      // The lobby is local either way.
    }
    console.log("Multiplayer disconnect: left room");
    setRoom(null);
    setError(null);
  };

  const setPlayers = useCallback((players) => {
    const next = (players ?? []).filter(Boolean);
    setRoom((current) => {
      if (!current || samePlayers(current.players, next)) {
        return current;
      }
      return { ...current, players: next };
    });
  }, []);

  const send = (method, ...args) => {
    if (!connection.current || connection.current.state !== "Connected") {
      return Promise.resolve();
    }
    return connection.current.send(method, ...args).catch(() => {});
  };

  const sendPlane = (state) => send("Plane", codeRef.current, state);
  const sendPinState = (state) => send("PinState", codeRef.current, state);

  const isHost = Boolean(room && rememberedHostCode() === room.code);

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
    setPlayers,
    sendPlane,
    sendPinState,
  };
};
