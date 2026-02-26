import React, { useEffect } from 'react'
import Dashboard from './components/Dashboard'
import GameView from './components/GameView'
import { useWorldStore } from './store/useWorldStore'

export default function App() {
  const connect = useWorldStore(s => s.connect)
  const tick    = useWorldStore(s => s.tick)
  const connected = useWorldStore(s => s.connected)
  const isRunning = useWorldStore(s => s.isRunning)

  useEffect(() => { connect() }, [connect])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <div className="flex-none overflow-y-auto border-r border-slate-800/60" style={{ width:'320px' }}>
        <Dashboard />
      </div>

      {/* ── Main canvas ───────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {/* HUD bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-4 px-4 py-2
                        bg-gray-950/80 backdrop-blur border-b border-slate-800/50">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">World Map</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500">Tick #{tick.toLocaleString()}</span>
            <span className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border
              ${connected ? 'text-emerald-400 border-emerald-800 bg-emerald-950/40' : 'text-red-400 border-red-900 bg-red-950/40'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}/>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Phaser canvas */}
        <div className="absolute inset-0 pt-9">
          <GameView />
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 glass rounded-xl p-2.5 flex flex-col gap-1">
          {[
            ['CBD Core','#FF4444','🌆 High energy · High crime'],
            ['Waterfront','#4488FF','🌊 Safe haven · Water rich'],
            ['Industrial','#FFCC00','🏭 Food abundant · Factories'],
            ['Slums','#AA2222','💀 Dangerous · Flee zone'],
            ['Hilly Suburbs','#996633','🏡 Balanced · Low crime'],
          ].map(([name,color,desc])=>(
            <div key={name} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-sm flex-none" style={{ background:color }}/>
              <div>
                <span className="text-[11px] text-slate-200 font-medium">{name}</span>
                <span className="text-[9px] text-slate-500 ml-1">{desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Paused overlay */}
        {!isRunning && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="glass rounded-2xl px-10 py-5 text-center border border-amber-800/40">
              <div className="text-4xl mb-2">⏸</div>
              <div className="text-amber-400 font-bold text-lg">Simulation Paused</div>
              <div className="text-slate-500 text-xs mt-1">Press Start to resume</div>
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="absolute bottom-3 right-3 z-10 text-[10px] font-mono text-slate-700">
          Autonomous AI · 2 ticks/sec
        </div>
      </div>
    </div>
  )
}
