import { create } from 'zustand'

export interface ResourceMap {
  energy: number; water: number; food: number; land: number
}
export interface RegionState {
  id: string; name: string; position: string; color_hint: string
  resources: ResourceMap; crime_rate: number; population: number; last_action: string
}
export interface PlayerStats {
  energy: number; hunger: number; thirst: number; safety: number; happiness: number
  currentRegion: string; isMoving: boolean
}
interface WorldStore {
  tick: number
  regions: RegionState[]
  connected: boolean
  isRunning: boolean
  player: PlayerStats
  history: { tick: number; [k: string]: number }[]
  connect: () => void
  toggleRunning: () => void
  setPlayer: (p: Partial<PlayerStats>) => void
}

const DEFAULT_PLAYER: PlayerStats = {
  energy: 80, hunger: 75, thirst: 80, safety: 85, happiness: 80,
  currentRegion: 'WATERFRONT', isMoving: false,
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  tick: 0, regions: [], connected: false, isRunning: true,
  player: DEFAULT_PLAYER, history: [],

  connect() {
    if (get().connected) return
    const ws = new WebSocket('ws://localhost:8000/ws')
    ws.onopen = () => set({ connected: true })
    ws.onclose = () => { set({ connected: false }); setTimeout(() => get().connect(), 2000) }
    ws.onerror = () => ws.close()
    ws.onmessage = (e: MessageEvent) => {
      try {
        const data: { tick: number; regions: RegionState[] } = JSON.parse(e.data)
        const entry: Record<string, number> = { tick: data.tick }
        for (const r of data.regions) entry[r.id] = r.crime_rate
        set(s => ({
          tick: data.tick,
          regions: data.regions,
          history: [...s.history.slice(-59), entry as WorldStore['history'][number]],
        }))
      } catch {}
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
    } catch {}
    set({ isRunning: running })
  },

  setPlayer(p) {
    set(s => ({ player: { ...s.player, ...p } }))
  },
}))
