/**
 * WorldSim — Simulation type definitions
 * Mirrors backend Pydantic schemas
 */

export interface ResourceState {
  value: number;
  max_value: number;
  pct: number;
  is_critical: boolean;
}

export interface ResourcesState {
  food: ResourceState;
  water: ResourceState;
}

export interface PopulationState {
  count: number;
  health: number;
  max_capacity: number;
  density: number;
  births: number;
  deaths: number;
  migrants_in: number;
  migrants_out: number;
}

export interface AgentState {
  agent_id: number;
  name: string;
  region_key: string;
  strategy: string;
  epsilon: number;
  total_reward: number;
  decisions: number;
}

export interface ClimateEventState {
  name: string;
  severity: number;
  duration: number;
  initial_duration: number;
  intensity: number;
}

export interface RegionState {
  x: number;
  y: number;
  terrain: string;
  climate_zone: string;
  resources: ResourcesState;
  population: PopulationState;
  governor: AgentState | null;
}

export interface WorldState {
  tick: number;
  running: boolean;
  ended: boolean;
  width: number;
  height: number;
  num_agents: number;
  total_population: number;
  regions: Record<string, RegionState>;
  agents: AgentState[];
  climate_events: Record<string, ClimateEventState[]>;
}

/** Compact state format for efficient WebSocket broadcast */
export interface CompactWorldState {
  tick: number;
  running: boolean;
  ended: boolean;
  width: number;
  height: number;
  total_population: number;
  r_keys: string[];
  r_terrain: string[];  // first char of terrain type
  r_food: number[];     // food pct
  r_water: number[];    // water pct
  r_pop: number[];      // population count
  r_health: number[];   // health 0-1
  agents: AgentState[];
  climate_events: Record<string, ClimateEventState[]>;
}

// Terrain first-char to full name mapping
const TERRAIN_CHAR_MAP: Record<string, string> = {
  m: 'mountains', h: 'hilly', p: 'plains', d: 'desert',
  s: 'swamp', r: 'river', l: 'lake',
};

/** Convert compact state to full WorldState */
export function expandCompactState(compact: CompactWorldState, existing?: WorldState): WorldState {
  const regions: Record<string, RegionState> = {};

  for (let i = 0; i < compact.r_keys.length; i++) {
    const key = compact.r_keys[i];
    const parts = key.split('-');
    const x = parseInt(parts[0]);
    const y = parseInt(parts[1]);
    const terrain = TERRAIN_CHAR_MAP[compact.r_terrain[i]] || 'plains';

    // Reuse existing region data for fields not in compact format
    const prev = existing?.regions[key];

    regions[key] = {
      x, y,
      terrain,
      climate_zone: prev?.climate_zone || '',
      resources: {
        food: { value: 0, max_value: 1000, pct: compact.r_food[i], is_critical: compact.r_food[i] < 20 },
        water: { value: 0, max_value: 1000, pct: compact.r_water[i], is_critical: compact.r_water[i] < 20 },
      },
      population: {
        count: compact.r_pop[i],
        health: compact.r_health[i],
        max_capacity: prev?.population.max_capacity || 500,
        density: prev ? compact.r_pop[i] / Math.max(1, prev.population.max_capacity) : 0,
        births: 0, deaths: 0, migrants_in: 0, migrants_out: 0,
      },
      governor: null,
    };
  }

  // Assign governors
  for (const agent of compact.agents) {
    if (regions[agent.region_key]) {
      regions[agent.region_key].governor = agent;
    }
  }

  return {
    tick: compact.tick,
    running: compact.running,
    ended: compact.ended,
    width: compact.width,
    height: compact.height,
    num_agents: compact.agents.length,
    total_population: compact.total_population,
    regions,
    agents: compact.agents,
    climate_events: compact.climate_events,
  };
}

export interface WSMessage {
  type: 'initial_state' | 'state_update' | 'control_ack' | 'error';
  data?: WorldState | CompactWorldState;
  action?: string;
  message?: string;
}

// Terrain colors for isometric rendering
export const TERRAIN_COLORS: Record<string, number> = {
  mountains:  0x8B8B8B,
  hilly:      0xA0B060,
  plains:     0x6DBE45,
  desert:     0xE8D174,
  swamp:      0x5A7247,
  river:      0x4A90D9,
  lake:       0x3B7DD8,
};

// Strategy colors for agent indicators
export const STRATEGY_COLORS: Record<string, number> = {
  focus_food:         0x2ECC71,
  focus_water:        0x3498DB,
  balance_resources:  0xF39C12,
  trade:              0xE67E22,
  migrate_out:        0xE74C3C,
  stockpile:          0x9B59B6,
  exploring:          0x95A5A6,
};
