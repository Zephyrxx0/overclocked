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

// Module-level WS ref — prevents duplicate connections across React StrictMode double-invocations
let _ws: WebSocket | null = null

export const useWorldStore = create<WorldStore>((set, get) => ({
  tick: 0,
  regions: [],
  connected: false,
  isRunning: true,
  climateEvent: { type: null, duration_remaining: 0 },
  history: [],

  connect() {
    // Already have a live connection — skip
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return

    _ws = new WebSocket('ws://localhost:8000/ws/world-state')

    _ws.onopen = () => set({ connected: true })

    _ws.onclose = () => {
      set({ connected: false })
      _ws = null
      // Reconnect after 2 s
      setTimeout(() => get().connect(), 2000)
    }

    _ws.onerror = () => {
      _ws?.close()
      _ws = null
    }

    _ws.onmessage = (e: MessageEvent) => {
      try {
        const data: {
          tick: number
          regions: RegionState[]
          climate_event: ClimateEvent
        } = JSON.parse(e.data)

        // Build history entry: crime + energy per nation
        const entry: Record<string, number> = { tick: data.tick }
        for (const r of data.regions) {
          entry[r.id + '_crime']  = r.crime_rate
          entry[r.id + '_energy'] = r.resources.energy
        }

        set(s => ({
          tick: data.tick,
          regions: data.regions,
          climateEvent: data.climate_event ?? { type: null, duration_remaining: 0 },
          history: [...s.history.slice(-99), entry as WorldStore['history'][number]],
        }))
      } catch { /* ignore malformed frame */ }
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
    } catch { /* backend offline — still toggle local state */ }
    set({ isRunning: running })
  },
}))
