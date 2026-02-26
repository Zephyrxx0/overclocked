import { useEffect, useState } from "react";
import "./App.css";
import GameCanvas from "./components/GameCanvas";
import ControlPanel from "./components/ControlPanel";
import InfoPanel from "./components/InfoPanel";
import WebSocketService from "./services/WebSocketService";
import SimulationStateService from "./services/SimulationStateService";
import type { WorldState } from "./types";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [worldState, setWorldState] = useState<WorldState | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    WebSocketService.connect("ws://localhost:8000/ws")
      .then(() => setIsConnected(true))
      .catch((error) => {
        console.error("Failed to connect:", error);
        setIsConnected(false);
      });

    // Listen for state updates
    const handleStateUpdate = (data: WorldState) => {
      SimulationStateService.setState(data);
      setWorldState(data);
    };

    WebSocketService.on("state_update", handleStateUpdate);
    WebSocketService.on("simulation_reset", (data: WorldState) => {
      SimulationStateService.setState(data);
      setWorldState(data);
      setIsRunning(false);
    });

    WebSocketService.on("connected", (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        // Request initial state
        WebSocketService.requestState();
      }
    });

    return () => {
      WebSocketService.disconnect();
    };
  }, []);

  const handleStartSimulation = () => {
    WebSocketService.startSimulation();
    setIsRunning(true);
  };

  const handleStopSimulation = () => {
    WebSocketService.stopSimulation();
    setIsRunning(false);
  };

  const handleResetSimulation = () => {
    WebSocketService.resetSimulation();
    setIsRunning(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>
          🌍 WorldSim - Adaptive Resource Scarcity & Agent Strategy Simulator
        </h1>
        <div className="connection-status">
          <span
            className={`status-indicator ${isConnected ? "connected" : "disconnected"}`}
          ></span>
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </header>

      <div className="app-content">
        <div className="main-area">
          <GameCanvas worldState={worldState} />
          <InfoPanel worldState={worldState} />
        </div>

        <ControlPanel
          isConnected={isConnected}
          isRunning={isRunning}
          onStart={handleStartSimulation}
          onStop={handleStopSimulation}
          onReset={handleResetSimulation}
          worldState={worldState}
        />
      </div>
    </div>
  );
}

export default App;
