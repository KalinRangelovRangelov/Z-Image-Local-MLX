import { useEffect, useCallback, useMemo } from "react";
import { useStore } from "./store";
import { useWebSocket } from "./hooks/useWebSocket";
import { api } from "./api";
import { InitPage } from "./components/InitPage";
import { GeneratePage } from "./components/GeneratePage";
import type { WebSocketMessage, ModelStatusMessage } from "./types";

function App() {
  const {
    currentView,
    setConnectionStatus,
    updateModelStatus,
    fetchModels,
    fetchSystemInfo,
  } = useStore();

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "initial_state": {
          // Refresh models to get full data
          fetchModels();
          break;
        }

        case "model_status": {
          const statusMsg = message as ModelStatusMessage;
          updateModelStatus(
            statusMsg.model_id,
            statusMsg.state,
            statusMsg.progress,
            statusMsg.error
          );
          break;
        }

        case "generation_start":
        case "generation_complete":
        case "generation_error":
        case "heartbeat":
        case "pong":
          // Handled elsewhere or keep-alive
          break;

        default:
          console.log("Unknown WebSocket message:", message);
      }
    },
    [updateModelStatus, fetchModels]
  );

  const handleConnect = useCallback(() => {
    setConnectionStatus(true);
    fetchModels();
    fetchSystemInfo();
  }, [setConnectionStatus, fetchModels, fetchSystemInfo]);

  const handleDisconnect = useCallback(() => {
    setConnectionStatus(false);
  }, [setConnectionStatus]);

  const wsOptions = useMemo(
    () => ({
      onMessage: handleWebSocketMessage,
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
    }),
    [handleWebSocketMessage, handleConnect, handleDisconnect]
  );

  const { isConnected, connectionError } = useWebSocket(
    api.getWebSocketUrl(),
    wsOptions
  );

  useEffect(() => {
    setConnectionStatus(isConnected, connectionError);
  }, [isConnected, connectionError, setConnectionStatus]);

  // Initial data fetch
  useEffect(() => {
    fetchSystemInfo();
    fetchModels();
  }, [fetchSystemInfo, fetchModels]);

  return (
    <>
      {currentView === "init" && <InitPage />}
      {currentView === "generate" && <GeneratePage />}
    </>
  );
}

export default App;
