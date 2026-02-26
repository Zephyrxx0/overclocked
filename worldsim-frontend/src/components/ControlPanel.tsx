import React from "react";
import { WorldState, REGION_META, WEATHER_LABELS } from "../types";
import "./ControlPanel.css";

interface ControlPanelProps {
  isConnected: boolean;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  worldState: WorldState | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isConnected, isRunning, onStart, onStop, onReset, worldState,
}) => {
  const hasLowMorale = worldState
    ? Object.values(worldState.regions).some((r) => r.morale < 0.3)
    : false;

  return (
    <div className="control-panel">

      {/* ── Morale Alert ─────────────────────────── */}
      <div className={`crime-alert${hasLowMorale ? " active" : ""}`}>
        ⚠ MORALE CRITICAL: REBELLION RISK
      </div>

      {/* ── Simulation Controls ──────────────────── */}
      <section className="panel-section">
        <h3>▶ Sim Controls</h3>
        <div className="button-group">
          <button className="btn btn-primary" onClick={onStart} disabled={!isConnected || isRunning}>▶ START</button>
          <button className="btn btn-secondary" onClick={onStop} disabled={!isConnected || !isRunning}>⏸ PAUSE</button>
          <button className="btn btn-danger" onClick={onReset} disabled={!isConnected}>↺ RESET</button>
        </div>
      </section>

      {/* ── Global Stats ───────────────────────────────── */}
      <section className="panel-section">
        <h3>📊 World Stats</h3>
        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">Step</span>
            <span className="stat-value">{worldState?.step ?? 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Status</span>
            <span className="stat-value">{isRunning ? "▶ RUN" : "■ STOP"}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Weather</span>
            <span className="stat-value weather-value">
              {worldState?.active_weather ? WEATHER_LABELS[worldState.active_weather] || "Clear" : "Clear"}
            </span>
          </div>

          {worldState && (
            <>
              <div className="stat-item">
                <span className="stat-label">Avg Morale</span>
                <span className="stat-value">
                  {(
                    Object.values(worldState.regions).reduce((s, r) => s + r.morale, 0)
                    / Object.values(worldState.regions).length * 100
                  ).toFixed(0)}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Global Trades</span>
                <span className="stat-value">
                  {Object.values(worldState.regions).reduce((s, r) => s + r.total_trades, 0) / 2}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Environment Rules ──────────────────────────────── */}
      <section className="panel-section">
        <h3>🧬 RL Actions</h3>
        <div className="tribes-section">
          <div className="tribe-row"><div className="tribe-dot" style={{ background: "#aaaaaa" }}></div><span>Hold/Conserve</span></div>
          <div className="tribe-row"><div className="tribe-dot" style={{ background: "#44aaff" }}></div><span>Propose Trade</span></div>
          <div className="tribe-row"><div className="tribe-dot" style={{ background: "#44ff88" }}></div><span>Expand Infra</span></div>
          <div className="tribe-row"><div className="tribe-dot" style={{ background: "#ff4444" }}></div><span>Steal/Conflict</span></div>
        </div>
      </section>

      {/* ── Zone Legend ──────────────────────────── */}
      <section className="panel-section">
        <h3>🗺 Sovereign Nations</h3>
        <div className="legend">
          {Object.values(REGION_META).map((z) => (
            <div key={z.id} className="legend-item">
              <div className={`color-box ${z.theme}`}></div>
              <span>{z.emoji} {z.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Climate Events ───────────────────────── */}
      <section className="panel-section">
        <h3>⚡ Climate Log</h3>
        <div className="events-log">
          {worldState?.climate_events.slice(-5).reverse().map((ev, i) => (
            <div key={i} className="event-item">
              <span className="event-type">{WEATHER_LABELS[ev.type] || ev.type}</span>
              <span className="event-region">{ev.region === "global" ? "Global" : REGION_META[ev.region]?.name || ev.region}</span>
            </div>
          ))}
          {(!worldState?.climate_events || worldState.climate_events.length === 0) && (
            <p className="no-events">No climate anomalies recorded...</p>
          )}
        </div>
      </section>

    </div>
  );
};

export default ControlPanel;
