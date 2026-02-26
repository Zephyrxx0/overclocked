import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useWorldStore, RegionState } from '../store/useWorldStore'

const RC: Record<string, string> = {
  CBD_CORE:'#FF4444', WATERFRONT:'#4488FF', INDUSTRIAL:'#FFCC00',
  SLUMS:'#AA2222', HILLY_SUBURBS:'#996633',
}
const AC: Record<string,string> = {
  Trade:'text-emerald-400 border-emerald-700', Hoard:'text-amber-400 border-amber-700',
  Migrate:'text-sky-400 border-sky-700', Idle:'text-slate-500 border-slate-700',
}

function StatBar({ label, value, color }: { label:string; value:number; color:string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
        <span>{label}</span><span className="font-mono">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width:`${Math.round(value)}%`, background:color }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const regions    = useWorldStore(s => s.regions)
  const tick       = useWorldStore(s => s.tick)
  const history    = useWorldStore(s => s.history)
  const connected  = useWorldStore(s => s.connected)
  const isRunning  = useWorldStore(s => s.isRunning)
  const toggleRunning = useWorldStore(s => s.toggleRunning)
  const player     = useWorldStore(s => s.player)

  return (
    <aside className="flex flex-col h-full gap-3 overflow-y-auto p-3">

      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-black tracking-wide text-white flex-1">🌐 WorldSim</h1>
        <span className={`inline-flex items-center gap-1 text-[10px] font-mono ${connected?'text-emerald-400':'text-red-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected?'bg-emerald-400 animate-pulse':'bg-red-500'}`}/>
          {connected?'LIVE':'OFFLINE'}
        </span>
      </div>

      {/* Start / Stop button */}
      <button
        onClick={toggleRunning}
        className={`w-full py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200
          ${isRunning
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'
          }`}
      >
        {isRunning ? '⏹ Stop Simulation' : '▶ Start Simulation'}
      </button>

      {/* Tick */}
      <div className="glass rounded-xl px-3 py-2 flex items-center">
        <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">Tick</span>
        <span className="ml-auto font-mono text-xl font-bold text-white">{tick}</span>
        <span className={`ml-2 text-xs px-2 py-0.5 rounded font-mono border ${isRunning?'text-emerald-400 border-emerald-800 bg-emerald-950/60':'text-amber-400 border-amber-800 bg-amber-950/60'}`}>
          {isRunning?'RUNNING':'PAUSED'}
        </span>
      </div>

      {/* Player stats */}
      <div className="glass rounded-xl p-3 border border-blue-900/40">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-blue-400 text-lg">🧍</span>
          <span className="text-xs font-bold text-blue-300">Citizen</span>
          <span className="ml-auto text-[10px] font-mono text-slate-500">
            📍 {player.currentRegion?.replace('_',' ') ?? '—'}
          </span>
          {player.isMoving && <span className="text-[10px] text-sky-400 animate-pulse">moving…</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <StatBar label="⚡ Energy"  value={player.energy}    color="#FFCC00" />
          <StatBar label="🍖 Hunger"  value={player.hunger}    color="#22cc77" />
          <StatBar label="💧 Thirst"  value={player.thirst}    color="#4488FF" />
          <StatBar label="🛡 Safety"  value={player.safety}    color="#cc44ff" />
          <StatBar label="😊 Happiness" value={player.happiness} color="#ff8844" />
        </div>
      </div>

      {/* Region cards */}
      {regions.map((r: RegionState) => (
        <div key={r.id} className="glass rounded-xl p-3 border-l-4" style={{ borderColor:RC[r.id] }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">{r.name}</span>
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${AC[r.last_action]??AC['Idle']}`}>
              {r.last_action}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(r.resources).map(([k,v])=>(
              <div key={k}>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span className="capitalize">{k}</span>
                  <span>{Math.round((v as number)*100)}%</span>
                </div>
                <div className="h-1 rounded-full bg-slate-800">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width:`${Math.round((v as number)*100)}%`, background:RC[r.id] }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-2 text-[10px] font-mono">
            <span className="text-rose-400">⚠ {Math.round(r.crime_rate*100)}%</span>
            <span className="text-slate-400">👥 {(r.population/1000).toFixed(0)}k</span>
          </div>
        </div>
      ))}

      {/* Crime history */}
      {history.length > 1 && (
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] text-slate-500 mb-2 font-mono uppercase tracking-widest">Crime History</p>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={history} margin={{top:0,right:0,bottom:0,left:-24}}>
              <XAxis dataKey="tick" tick={{fontSize:8,fill:'#64748b'}}/>
              <YAxis domain={[0,1]} tick={{fontSize:8,fill:'#64748b'}}/>
              <Tooltip contentStyle={{background:'#0f172a',border:'none',fontSize:9}} labelStyle={{color:'#94a3b8'}}/>
              {regions.map(r=>(
                <Line key={r.id} type="monotone" dataKey={r.id} name={r.name}
                  dot={false} strokeWidth={1.5} stroke={RC[r.id]} isAnimationActive={false}/>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </aside>
  )
}
