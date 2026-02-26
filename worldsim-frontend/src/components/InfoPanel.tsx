import React from "react";
import { WorldState, REGION_META, ACTION_LABELS, ACTION_COLORS } from "../types";
import "./InfoPanel.css";

interface InfoPanelProps {
  worldState: WorldState | null;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ worldState }) => {
  if (!worldState) {
    return (
      <div className="info-panel">
        <div className="info-panel-header">SOVEREIGN REGIONS</div>
        <div className="no-data">
          <p>⏳ Awaiting<br />simulation data...</p>
        </div>
      </div>
    );
  }

  // Ensure consistent order based on REGION_META keys
  const regions = Object.keys(REGION_META).map((id) => worldState.regions[id]).filter(Boolean);

  return (
    <div className="info-panel">
      <div className="info-panel-header">SOVEREIGN REGIONS</div>
      <div className="regions-grid">
        {regions.map((region) => {
          const meta = REGION_META[region.region_id] ?? { name: region.name, emoji: "📍", theme: "default" };
          const pres = worldState.agents[region.region_id];

          return (
            <div key={region.region_id} className="region-card" data-region={meta.theme}>
              <div className="region-header">
                <div className="region-name-wrap">
                  <span className="zone-emoji">{meta.emoji}</span>
                  <div>
                    <h4>{meta.name}</h4>
                    <div className="region-lore">{meta.lore}</div>
                  </div>
                </div>
              </div>

              <div className="resources-bars">
                {(["water", "food", "energy", "land"] as const).map((res) => (
                  <div className="resource-bar" key={res}>
                    <label>{res.charAt(0).toUpperCase() + res.slice(1)}</label>
                    <div className="bar-container">
                      <div
                        className={`bar-fill ${res}`}
                        style={{ width: `${Math.min(100, Math.max(0, (region.resources[res] / 300) * 100))}%` }}
                      />
                    </div>
                    <span className="value">{region.resources[res].toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div className="region-stats">
                <div className="stat">
                  <span>Morale:</span>
                  <strong className={region.morale < 0.4 ? "negative" : "positive"}>
                    {(region.morale * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="stat">
                  <span>Infra Mult:</span>
                  <strong>{region.infrastructure.toFixed(2)}x</strong>
                </div>
                <div className="stat">
                  <span>Diplomacy:</span>
                  <strong>{region.total_trades}T / {region.total_conflicts}C</strong>
                </div>
                {region.trade_partners.length > 0 && (
                  <div className="stat">
                    <span>Partners:</span>
                    <strong>{region.trade_partners.map(p => REGION_META[p]?.name || p).join(", ")}</strong>
                  </div>
                )}
              </div>

              {pres && (
                <div className="presidential-action">
                  <span
                    className="tribe-badge"
                    style={{
                      backgroundColor: ACTION_COLORS[pres.action] ? `#${ACTION_COLORS[pres.action].toString(16).padStart(6, '0')}33` : "#aaaaaa33",
                      borderColor: ACTION_COLORS[pres.action] ? `#${ACTION_COLORS[pres.action].toString(16).padStart(6, '0')}` : "#aaaaaa",
                      color: ACTION_COLORS[pres.action] ? `#${ACTION_COLORS[pres.action].toString(16).padStart(6, '0')}` : "#ffffff"
                    }}
                  >
                    Action: {ACTION_LABELS[pres.action] || "HOLD"}
                  </span>
                  <span className="pres-reward" title="Latest RL Reward">
                    R: {pres.last_reward > 0 ? "+" : ""}{pres.last_reward.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InfoPanel;
