import { create } from 'zustand'

export interface WebSocketState {
  socket: any
  connected: boolean
  connect: () => void
  disconnect: () => void
  send: (event: string, data: any) => void
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  connected: false,

  connect: () => {
    const socket = io('http://localhost:8000')

    socket.on('connect', () => {
      console.log('WebSocket connected')
      set({ connected: true, socket })
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      set({ connected: false, socket: null })
    })

    socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error)
      set({ connected: false, socket: null })
    })

    set({ socket })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, connected: false })
    }
  },

  send: (event: string, data: any) => {
    const { socket } = get()
    if (socket) {
      socket.emit(event, data)
    }
  },
}))
