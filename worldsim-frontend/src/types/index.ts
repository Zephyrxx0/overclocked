// ─── Resource types ─────────────────────────────────────────────────────────
export interface Resources {
  water: number;
  food: number;
  energy: number;
  land: number;
}

// ─── Region state (from backend) ──────────────────────────────────────────────
export interface RegionState {
  region_id: string;
  name: string;
  visual_theme: string;   // "blue" | "green" | "orange" | "brown" | "silver"
  resources: Resources;
  president_action: number;   // 0=hold 1=trade 2=expand 3=steal
  president_strategy: string;
  morale: number;   // 0–1
  trade_partners: string[];
  active_weather: string;   // "none"|"drought"|"solar_flare"|"blight"|"rain"|"calm"
  total_trades: number;
  total_conflicts: number;
  infrastructure: number;
  // legacy compat
  crime_level: number;
  tribe_distribution: Record<string, number>;
  energy_demand: number;
  energy_production: number;
  population: number;
}

// ─── President agent ──────────────────────────────────────────────────────────
export interface PresidentAgent {
  agent_id: string;
  region_id: string;
  action: number;
  strategy: string;
  total_reward: number;
  last_reward: number;
  q_values: number[];
  satisfaction: number;
  // legacy compat
  tribe: string;
  resources_held: number;
  hunger: number;
  fear: number;
}

// ─── World state ──────────────────────────────────────────────────────────────
export interface WorldState {
  step: number;
  regions: Record<string, RegionState>;
  agents: Record<string, PresidentAgent>;
  climate_events: ClimateEvent[];
  trade_network: Record<string, string[]>;
  active_weather: string;
  weather_region: string;
}

// ─── Climate event ────────────────────────────────────────────────────────────
export interface ClimateEvent {
  step: number;
  type: string;
  region: string;
  magnitude?: number;
  description: string;
}

// ─── WebSocket message envelope ───────────────────────────────────────────────
export interface SimulationMessage {
  type: "state_update" | "simulation_reset" | "control_ack" | "pong" | "error";
  data?: WorldState | Record<string, unknown>;
}

// ─── Region metadata (static UI) ─────────────────────────────────────────────
export interface RegionMeta {
  id: string;
  name: string;
  fullName: string;
  lore: string;
  emoji: string;
  theme: string; // CSS colour key
}

export const REGION_META: Record<string, RegionMeta> = {
  aquilonia: { id: "aquilonia", name: "Aquilonia", fullName: "The Sapphire Archipelago", lore: "Water-rich, Energy-poor", emoji: "🌊", theme: "blue" },
  verdantis: { id: "verdantis", name: "Verdantis", fullName: "The Demeter Basin", lore: "Food-rich, Land-poor", emoji: "🌿", theme: "green" },
  ignis_core: { id: "ignis_core", name: "Ignis Core", fullName: "The Voltarian Hub", lore: "Energy-rich, Water-poor", emoji: "⚡", theme: "orange" },
  terranova: { id: "terranova", name: "Terranova", fullName: "The Obsidian Steppes", lore: "Land-rich, Food-poor", emoji: "🗻", theme: "brown" },
  nexus: { id: "nexus", name: "The Nexus", fullName: "The Crossroads", lore: "Balanced Trade Hub", emoji: "✦", theme: "silver" },
};

export const ACTION_LABELS: Record<number, string> = {
  0: "Hold/Conserve",
  1: "Propose Trade",
  2: "Expand Infra",
  3: "Steal/Conflict",
};

export const ACTION_COLORS: Record<number, string> = {
  0: "#aaaaaa",
  1: "#44aaff",
  2: "#44ff88",
  3: "#ff4444",
};

export const WEATHER_LABELS: Record<string, string> = {
  none: "☀ Clear",
  drought: "🌵 Drought",
  solar_flare: "☀ Solar Flare",
  blight: "☠ Blight",
  rain: "🌧 Rain",
  calm: "🕊 Calm",
};
