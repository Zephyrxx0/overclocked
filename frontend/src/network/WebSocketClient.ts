/**
 * WorldSim — WebSocket Client
 * Connects to backend, receives state updates, sends control commands.
 */

import { WorldState, CompactWorldState, WSMessage, expandCompactState } from '../types/simulation';

export type StateCallback = (state: WorldState) => void;
export type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onState: StateCallback;
  private onStatus: StatusCallback;
  private reconnectTimer: number | null = null;
  private reconnectDelay = 2000;
  private lastFullState: WorldState | null = null;

  constructor(url: string, onState: StateCallback, onStatus: StatusCallback) {
    this.url = url;
    this.onState = onState;
    this.onStatus = onStatus;
  }

  connect(): void {
    this.onStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.onStatus('connected');
        this.reconnectDelay = 2000;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === 'initial_state' && msg.data) {
            // Full state on initial connect
            this.lastFullState = msg.data as WorldState;
            this.onState(this.lastFullState);
          } else if (msg.type === 'state_update' && msg.data) {
            // Could be compact or full — check for r_keys (compact marker)
            const data = msg.data as any;
            if (data.r_keys) {
              // Compact state — expand using previous full state
              this.lastFullState = expandCompactState(data as CompactWorldState, this.lastFullState || undefined);
            } else {
              this.lastFullState = data as WorldState;
            }
            this.onState(this.lastFullState);
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.onStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.onStatus('error');
      };
    } catch (e) {
      this.onStatus('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10000);
  }

  send(type: string, payload: Record<string, string> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  control(action: 'start' | 'pause' | 'reset'): void {
    this.send('control', { action });
  }

  requestState(): void {
    this.send('request_state');
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
