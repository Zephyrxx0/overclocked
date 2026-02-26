import React from 'react'
import { useWorldStore, RegionState, ClimateEvent } from '../store/useWorldStore'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ── Nation config ─────────────────────────────────────────────────────────────
const NATION_META: Record<string, { flag: string; strategy: string; tribe: string; color: string; bg: string }> = {
  AQUILONIA:  { flag:'🛡️', strategy:'Fortress',      tribe:'IRON',  color:'#4A9EFF', bg:'rgba(74,158,255,0.07)' },
  VERDANTIS:  { flag:'🌿', strategy:'Equilibrium',   tribe:'LEAF',  color:'#4CAF50', bg:'rgba(76,175,80,0.07)'  },
  IGNIS_CORE: { flag:'🔥', strategy:'Expansionist',  tribe:'FIRE',  color:'#FF7043', bg:'rgba(255,112,67,0.07)' },
  TERRANOVA:  { flag:'⚔️', strategy:'Parasite',      tribe:'IRON',  color:'#A08040', bg:'rgba(160,128,64,0.07)' },
  THE_NEXUS:  { flag:'🔮', strategy:'Collaborator',  tribe:'NEXUS', color:'#AB7FE0', bg:'rgba(171,127,224,0.07)'},
}

const ACTION_COLORS: Record<string, string> = {
  Conserve: '#4fc3f7', Trade: '#66ee88', Expand: '#ffcc44', Conflict: '#ff5555'
}
const ACTION_ICONS: Record<string, string> = {
  Conserve: '🛡️', Trade: '🤝', Expand: '⬆️', Conflict: '⚔️'
}

const CLIMATE_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  Drought:    { icon: '☀️', label: 'DROUGHT',     color: '#ff9944', bg: 'rgba(180,80,0,0.25)'   },
  SolarFlare: { icon: '⚡', label: 'SOLAR FLARE', color: '#ffee44', bg: 'rgba(160,120,0,0.25)'  },
  Blight:     { icon: '🍂', label: 'BLIGHT',      color: '#88bb44', bg: 'rgba(40,80,0,0.25)'    },
}

// ── Resource bar ──────────────────────────────────────────────────────────────
function ResourceBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7a8899', marginBottom: 2, fontFamily: 'JetBrains Mono, monospace' }}>
        <span>{label}</span><span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ background: '#1a1f2a', borderRadius: 3, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ── Region card ───────────────────────────────────────────────────────────────
function RegionCard({ r }: { r: RegionState }) {
  const meta = NATION_META[r.id]
  if (!meta) return null

  const crimePct = Math.round(r.crime_rate * 100)
  const isHighCrime = r.crime_rate > 0.65

  return (
    <div style={{
      background: meta.bg,
      border: `1px solid ${meta.color}33`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 8, padding: '8px 10px', marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 16 }}>{meta.flag}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, fontFamily: 'Inter, sans-serif' }}>{r.name}</div>
          <div style={{ fontSize: 9, color: '#606880', fontFamily: 'monospace' }}>{r.title} · Tribe: {r.tribe}</div>
        </div>
        <div style={{
          fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
          background: `${ACTION_COLORS[r.last_action]}22`, color: ACTION_COLORS[r.last_action],
          padding: '2px 5px', borderRadius: 4, border: `1px solid ${ACTION_COLORS[r.last_action]}44`,
        }}>
          {ACTION_ICONS[r.last_action]} {r.last_action}
        </div>
      </div>

      {/* Resources */}
      <ResourceBar label="💧 Water"  value={r.resources.water}  color="#4A9EFF" />
      <ResourceBar label="🌾 Food"   value={r.resources.food}   color="#4CAF50" />
      <ResourceBar label="⚡ Energy" value={r.resources.energy} color="#FF7043" />
      <ResourceBar label="🏔️ Land"   value={r.resources.land}   color="#A08040" />

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 9, color: '#606880', fontFamily: 'monospace' }}>
        <span style={{ color: isHighCrime ? '#ff5555' : '#66cc66' }}>
          {isHighCrime ? '🚨' : '✅'} {crimePct}% crime
        </span>
        <span>👥 {(r.population / 1_000_000).toFixed(1)}M</span>
      </div>
    </div>
  )
}

// ── Climate banner ────────────────────────────────────────────────────────────
function ClimateBanner({ event }: { event: ClimateEvent }) {
  if (!event.type) return null
  const meta = CLIMATE_META[event.type]
  if (!meta) return null

  return (
    <div style={{
      background: meta.bg,
      border: `1px solid ${meta.color}55`,
      borderRadius: 8, padding: '7px 10px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'pulse 1s ease infinite',
    }}>
      <span style={{ fontSize: 18 }}>{meta.icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, fontFamily: 'Inter, sans-serif', letterSpacing: 1 }}>
          {meta.label} ACTIVE
        </div>
        <div style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>
          {event.duration_remaining} ticks remaining
        </div>
      </div>
    </div>
  )
}

// ── Sidebar chart ─────────────────────────────────────────────────────────────
const CHART_COLORS: Record<string, string> = {
  AQUILONIA: '#4A9EFF', VERDANTIS: '#4CAF50', IGNIS_CORE: '#FF7043',
  TERRANOVA: '#A08040', THE_NEXUS: '#AB7FE0',
}

function CrimeChart({ history }: { history: { tick: number; [k: string]: number }[] }) {
  const data = history.slice(-40)
  const ids = ['AQUILONIA', 'VERDANTIS', 'IGNIS_CORE', 'TERRANOVA', 'THE_NEXUS']
  // Remap history keys
  const mapped = data.map(h => {
    const row: Record<string, number> = { tick: h.tick }
    for (const id of ids) row[id] = +(h[id + '_crime'] ?? 0)
    return row
  })

  return (
    <div style={{ marginTop: 4, height: 90 }}>
      <div style={{ fontSize: 10, color: '#445566', fontFamily: 'monospace', marginBottom: 4 }}>
        ↑ CRIME RATE (last 40 ticks)
      </div>
      <ResponsiveContainer width="100%" height={75}>
        <LineChart data={mapped}>
          <XAxis dataKey="tick" hide />
          <YAxis domain={[0, 1]} hide />
          <Tooltip
            contentStyle={{ background: '#0a0f1a', border: '1px solid #223', fontSize: 9, fontFamily: 'monospace' }}
            formatter={(v: number) => [`${Math.round(v * 100)}%`]}
          />
          {ids.map(id => (
            <Line key={id} type="monotone" dataKey={id} dot={false}
              stroke={CHART_COLORS[id]} strokeWidth={1.5} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const regions      = useWorldStore(s => s.regions)
  const tick         = useWorldStore(s => s.tick)
  const connected    = useWorldStore(s => s.connected)
  const isRunning    = useWorldStore(s => s.isRunning)
  const toggleRun    = useWorldStore(s => s.toggleRunning)
  const climateEvent = useWorldStore(s => s.climateEvent)
  const history      = useWorldStore(s => s.history)

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden',
      background: '#05080f', color: '#c0c8d8', fontFamily: 'Inter, sans-serif',
      padding: '12px 10px', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#d0d8f0', letterSpacing: 0.5 }}>
          🌍 WorldSim 2.0
        </div>
        <div style={{ fontSize: 9, color: '#445566', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>
          5 Sovereign Nations · Autonomous RL
        </div>
      </div>

      {/* Status strip */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <div style={{
          flex: 1, fontSize: 10, fontFamily: 'monospace',
          color: connected ? '#44ee88' : '#ff5555',
          background: connected ? 'rgba(68,238,136,0.08)' : 'rgba(255,85,85,0.08)',
          border: `1px solid ${connected ? '#44ee8844' : '#ff555544'}`,
          borderRadius: 5, padding: '3px 7px',
        }}>
          {connected ? '● LIVE' : '○ OFFLINE'} — Tick #{tick.toLocaleString()}
        </div>
        <button
          onClick={toggleRun}
          style={{
            background: isRunning ? 'rgba(255,100,100,0.15)' : 'rgba(68,238,136,0.15)',
            border: `1px solid ${isRunning ? '#ff644444' : '#44ee8844'}`,
            color: isRunning ? '#ff8888' : '#44ee88',
            borderRadius: 5, fontSize: 10, fontFamily: 'monospace',
            padding: '3px 10px', cursor: 'pointer',
          }}
        >
          {isRunning ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>

      {/* Climate event */}
      <ClimateBanner event={climateEvent} />

      {/* Tribe info */}
      <div style={{ fontSize: 9, color: '#334455', fontFamily: 'monospace', marginBottom: 8, padding: '5px 7px', background: 'rgba(255,255,255,0.02)', borderRadius: 5 }}>
        🏛 Tribe IRON (Aquilonia + Terranova): 15% Trade Bonus
      </div>

      {/* Nation cards */}
      {regions.map(r => <RegionCard key={r.id} r={r} />)}

      {/* Crime chart */}
      <CrimeChart history={history} />

      {/* Legend */}
      <div style={{ marginTop: 10, fontSize: 9, color: '#334455', fontFamily: 'monospace', lineHeight: 1.8 }}>
        🛡️ Conserve · 🤝 Trade · ⬆️ Expand · ⚔️ Conflict
        <br />Energy Entropy: crime &gt;70% → −5% energy/tick
      </div>
    </div>
  )
}
