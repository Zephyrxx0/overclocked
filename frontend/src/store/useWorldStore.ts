import { create } from 'zustand'

export interface ResourceMap {
  water: number
  food: number
  energy: number
  land: number
}

export interface RegionState {
  id: string
  name: string
  title: string
  color_hint: string
  tribe: string
  position: string
  resources: ResourceMap
  crime_rate: number
  population: number
  last_action: 'Conserve' | 'Trade' | 'Expand' | 'Conflict'
}

export interface ClimateEvent {
  type: 'Drought' | 'SolarFlare' | 'Blight' | null
  duration_remaining: number
}

interface WorldStore {
  tick: number
  regions: RegionState[]
  connected: boolean
  isRunning: boolean
  climateEvent: ClimateEvent
  history: { tick: number; [k: string]: number }[]
  connect: () => void
  toggleRunning: () => void
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  tick: 0,
  regions: [],
  connected: false,
  isRunning: true,
  climateEvent: { type: null, duration_remaining: 0 },
  history: [],

  connect() {
    if (get().connected) return
    // Try new endpoint first, fall back to legacy /ws
    const ws = new WebSocket('ws://localhost:8000/ws/world-state')
    ws.onopen = () => set({ connected: true })
    ws.onclose = () => {
      set({ connected: false })
      setTimeout(() => get().connect(), 2000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (e: MessageEvent) => {
      try {
        const data: {
          tick: number
          regions: RegionState[]
          climate_event: ClimateEvent
        } = JSON.parse(e.data)

        const entry: Record<string, number> = { tick: data.tick }
        for (const r of data.regions) {
          entry[r.id + '_crime'] = r.crime_rate
          entry[r.id + '_energy'] = r.resources.energy
        }

        set(s => ({
          tick: data.tick,
          regions: data.regions,
          climateEvent: data.climate_event ?? { type: null, duration_remaining: 0 },
          history: [...s.history.slice(-79), entry as WorldStore['history'][number]],
        }))
      } catch { /* ignore malformed */ }
    }
  },

  async toggleRunning() {
    const running = !get().isRunning
    try {
      await fetch('http://localhost:8000/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: running ? 'start' : 'stop' }),
      })
    } catch { /* offline */ }
    set({ isRunning: running })
  },
}))
