import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

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
}

export interface SimulationState {
  tick: number
  running: boolean
  width: number
  height: number
  num_agents: number
  regions: Record<string, RegionState>
  agents: AgentState[]
  loading: boolean
  error: string | null
}

export interface SimulationActions {
  connect: () => void
  disconnect: () => void
  startSimulation: () => void
  pauseSimulation: () => void
  resetSimulation: () => void
}

export const useSimulationStore = create<SimulationState & SimulationActions>((set, get) => ({
  tick: 0,
  running: false,
  width: 5,
  height: 5,
  num_agents: 5,
  regions: {},
  agents: [],
  loading: true,
  error: null,

  connect: () => {
    const socket = io('http://localhost:8000')

    socket.on('connect', () => {
      console.log('WebSocket connected')
      set({ error: null })
    })

    socket.on('initial_state', (data) => {
      const state = data.data
      set({
        tick: state.tick,
        running: state.running,
        width: state.width,
        height: state.height,
        num_agents: state.num_agents,
        regions: state.regions,
        agents: state.agents,
        loading: false,
      })
    })

    socket.on('state_update', (data) => {
      const state = data.data
      set((prev) => ({
        tick: state.tick,
        running: state.running,
        regions: state.regions,
        agents: state.agents,
      }))
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      set({ error: 'Disconnected from server' })
    })

    socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      set({ error: error.message })
    })

    // Store socket for later use
    ;(get() as any).socket = socket
  },

  disconnect: () => {
    const socket = (get() as any).socket
    if (socket) {
      socket.disconnect()
    }
  },

  startSimulation: () => {
    const socket = (get() as any).socket
    if (socket) {
      socket.emit('control', { action: 'start' })
    }
  },

  pauseSimulation: () => {
    const socket = (get() as any).socket
    if (socket) {
      socket.emit('control', { action: 'pause' })
    }
  },

  resetSimulation: () => {
    const socket = (get() as any).socket
    if (socket) {
      socket.emit('control', { action: 'reset' })
    }
  },
}))
