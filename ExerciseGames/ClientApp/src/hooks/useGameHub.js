import { HubConnectionBuilder, HttpTransportType } from "@microsoft/signalr";
import { useRef, useState } from "react";
import { useLifeCycle } from "./useLifeCycle";

export const useGameHub = () => {
  const connection = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState(null);

  useLifeCycle({
    onMount: () => {
      connection.current = new HubConnectionBuilder()
        .withUrl("/gameHub", { transport: HttpTransportType.WebSockets })
        .withAutomaticReconnect()
        .build();

      connection.current.on("hello", (message) => {
        setConnectionId(message?.connectionId ?? null);
      });
      connection.current.onclose(() => setIsConnected(false));
      connection.current.onreconnecting(() => setIsConnected(false));
      connection.current.onreconnected(() => setIsConnected(true));

      connection.current
        .start()
        .then(async () => {
          setIsConnected(true);
          await connection.current.invoke("Hello");
        })
        .catch(() => setIsConnected(false));
    },
    onUnMount: () => {
      connection.current?.stop();
    },
  });

  const sendPose = (pose) => {
    if (!connection.current || !isConnected) {
      return;
    }

    connection.current.send("Pose", pose);
  };

  return { isConnected, connectionId, sendPose };
};
