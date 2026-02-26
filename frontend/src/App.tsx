import React, { useEffect } from 'react'
import Dashboard from './components/Dashboard'
import GameView from './components/GameView'
import { useWorldStore } from './store/useWorldStore'

const CLIMATE_BANNERS: Record<string, { label: string; color: string; bg: string }> = {
  Drought:    { label: '☀️  DROUGHT — Water reserves dropping across all nations', color: '#ff9944', bg: '#3d1500' },
  SolarFlare: { label: '⚡  SOLAR FLARE — Energy surging, crime destabilising',    color: '#ffee44', bg: '#2d2000' },
  Blight:     { label: '🍂  BLIGHT — Food supplies failing across the continent',   color: '#88bb44', bg: '#1a2200' },
}

export default function App() {
  const connect      = useWorldStore(s => s.connect)
  const tick         = useWorldStore(s => s.tick)
  const connected    = useWorldStore(s => s.connected)
  const isRunning    = useWorldStore(s => s.isRunning)
  const climate      = useWorldStore(s => s.climateEvent)

  useEffect(() => { connect() }, [connect])

  const banner = climate.type ? CLIMATE_BANNERS[climate.type] : null

  return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', overflow:'hidden', background:'#020508', fontFamily:'Inter, sans-serif' }}>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <div style={{ flexShrink:0, width:310, overflowY:'auto', borderRight:'1px solid #131825' }}>
        <Dashboard />
      </div>

      {/* ── Main canvas ────────────────────────────────────────── */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

        {/* HUD bar */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:10,
          display:'flex', alignItems:'center', gap:12, padding:'6px 14px',
          background:'rgba(2,5,10,0.85)', backdropFilter:'blur(8px)',
          borderBottom:'1px solid #131825',
        }}>
          <span style={{ fontSize:11, fontFamily:'JetBrains Mono, monospace', color:'#2a3a4a', letterSpacing:2, textTransform:'uppercase' }}>
            Sovereign Nations · World Map
          </span>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'#2a3a55' }}>
              Tick #{tick.toLocaleString()}
            </span>
            <span style={{
              fontSize:10, fontFamily:'monospace', padding:'2px 8px', borderRadius:99, border:'1px solid',
              color:      connected ? '#44ee88' : '#ff5555',
              borderColor:connected ? '#44ee8855' : '#ff555555',
              background: connected ? 'rgba(68,238,136,0.07)' : 'rgba(255,85,85,0.07)',
            }}>
              <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%',
                background: connected ? '#44ee88' : '#ff5555',
                animation: connected ? 'none' : undefined, marginRight:5, verticalAlign:'middle' }} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Climate banner */}
        {banner && (
          <div style={{
            position:'absolute', top:36, left:0, right:0, zIndex:10,
            background:banner.bg, borderBottom:`1px solid ${banner.color}44`,
            padding:'4px 14px', fontSize:11, fontFamily:'JetBrains Mono, monospace',
            color:banner.color, fontWeight:600, letterSpacing:0.5,
          }}>
            {banner.label} — {climate.duration_remaining} ticks remaining
          </div>
        )}

        {/* Phaser canvas */}
        <div style={{ position:'absolute', inset:0, paddingTop: banner ? 68 : 36 }}>
          <GameView />
        </div>



        {/* Paused overlay */}
        {!isRunning && (
          <div style={{ position:'absolute', inset:0, zIndex:20, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            <div style={{ background:'rgba(5,8,18,0.85)', border:'1px solid #3a4a2a', borderRadius:16, padding:'24px 40px', textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>⏸</div>
              <div style={{ color:'#ccaa44', fontWeight:700, fontSize:18 }}>Simulation Paused</div>
              <div style={{ color:'#445566', fontSize:11, marginTop:4, fontFamily:'monospace' }}>Press Resume in sidebar to continue</div>
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div style={{ position:'absolute', bottom:12, right:14, zIndex:10, fontSize:9, fontFamily:'monospace', color:'#1a2535' }}>
          Autonomous AI · 2 ticks/sec · Mesa 3.5 + PPO
        </div>
      </div>
    </div>
  )
}
