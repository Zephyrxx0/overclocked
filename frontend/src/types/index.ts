// Shared types for WorldSim

export interface ResourceState {
  name: string
  current: number
  max: number
  depletion_rate: number
  regeneration_rate: number
}

export interface RegionState {
  x: number
  y: number
  resources: Record<string, ResourceState>
  has_agent: boolean
  agent_strategy: string | null
  climate_events: string[]
}

export interface AgentState {
  id: number
  name: string
  region_id: number
  strategy: string
  resources: Record<string, ResourceState>
  history_length: number
  strategy_scores: Record<string, number>
}

export interface SimulationState {
  tick: number
  running: boolean
  width: number
  height: number
  num_agents: number
  regions: Record<string, RegionState>
  agents: AgentState[]
}

export interface SimulationStatus {
  running: boolean
  tick: number
  width: number
  height: number
  num_agents: number
}

export type AgentStrategy = 'defensive' | 'expansive' | 'negotiator' | 'extractive'

export interface ClimateEvent {
  name: string
  severity: number
  affected_resources: string[]
  duration: number
}
