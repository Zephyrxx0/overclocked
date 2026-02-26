import { Socket } from "socket.io-client";
import type { SimulationMessage } from "../types";

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(url: string = "ws://localhost:8000/ws") {
    return new Promise((resolve, reject) => {
      try {
        // Use regular WebSocket for better compatibility
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          resolve(true);
          this.emit("connected", true);
        };

        ws.onmessage = (event) => {
          try {
            const message: SimulationMessage = JSON.parse(event.data);
            this.emit(message.type, message.data);
          } catch (e) {
            console.error("Failed to parse message:", e);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected. Attempting to reconnect...");
          this.emit("connected", false);
          this.attemptReconnect();
        };

        this.socket = ws as any;
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  send(message: any) {
    if (this.socket && (this.socket as any).readyState === WebSocket.OPEN) {
      (this.socket as any).send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, message not sent:", message);
    }
  }

  startSimulation() {
    this.send({ type: "start" });
  }

  stopSimulation() {
    this.send({ type: "stop" });
  }

  resetSimulation() {
    this.send({ type: "reset" });
  }

  requestState() {
    this.send({ type: "get_state" });
  }

  ping() {
    this.send({ type: "ping" });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  disconnect() {
    if (this.socket) {
      (this.socket as any).close();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return (
      this.socket !== null && (this.socket as any).readyState === WebSocket.OPEN
    );
  }
}

export default new WebSocketService();
