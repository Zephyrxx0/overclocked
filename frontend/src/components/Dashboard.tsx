import React from 'react'
import { useWorldStore, RegionState, ClimateEvent } from '../store/useWorldStore'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ── Nation config ─────────────────────────────────────────────────────────────
const NATION_META: Record<string, {
  emoji:string; tag:string; specialty:string; tribe:string
  color:string; slotBg:string; slotBorder:string
  signatureResource:string; scarceResource:string
}> = {
  AQUILONIA:  { emoji:'💧', tag:'The_Hoarder',       specialty:'Hoard & Defend',    tribe:'IRON',  color:'#2aafcc', slotBg:'#0a2030', slotBorder:'#2aafcc', signatureResource:'water',  scarceResource:'energy' },
  VERDANTIS:  { emoji:'🌾', tag:'The_Sustainist',    specialty:'Balance All 4',     tribe:'LEAF',  color:'#7acc55', slotBg:'#0a1e08', slotBorder:'#7acc55', signatureResource:'food',   scarceResource:'water'  },
  IGNIS_CORE: { emoji:'⚡', tag:'The_Industrialist', specialty:'Expand & Burn',     tribe:'FIRE',  color:'#ff7722', slotBg:'#1e0a02', slotBorder:'#ff7722', signatureResource:'energy', scarceResource:'food'   },
  TERRANOVA:  { emoji:'🪨', tag:'The_Opportunist',   specialty:'Conflict & Steal',  tribe:'IRON',  color:'#aaaaaa', slotBg:'#141414', slotBorder:'#aaaaaa', signatureResource:'land',   scarceResource:'water'  },
  THE_NEXUS:  { emoji:'⚖️', tag:'The_Integrator',   specialty:'Trade & Stability', tribe:'NEXUS', color:'#ffee66', slotBg:'#1a1608', slotBorder:'#ffee66', signatureResource:'water',  scarceResource:'land'   },
}

const ACTION_COLORS: Record<string,string> = { Conserve:'#44aaff', Trade:'#44ee88', Expand:'#ffcc44', Conflict:'#ff5544' }
const ACTION_ICONS:  Record<string,string> = { Conserve:'[DEF]',   Trade:'[TRD]',   Expand:'[EXP]',  Conflict:'[WAR]'   }

const CLIMATE_META: Record<string,{icon:string;label:string;color:string;bg:string}> = {
  Drought:    { icon:'☀️', label:'DROUGHT',     color:'#ffaa33', bg:'#2a1200' },
  SolarFlare: { icon:'⚡', label:'SOLAR FLARE', color:'#ffee44', bg:'#1a1000' },
  Blight:     { icon:'☣️', label:'BLIGHT',      color:'#cc44ff', bg:'#1a0022' },
}

const RES_CONFIG = [
  { key:'water',  icon:'💧', label:'WATER',  color:'#2aafcc', low:'#ff2200', fill:'#2aafcc' },
  { key:'food',   icon:'🌾', label:'FOOD',   color:'#7acc55', low:'#ff2200', fill:'#7acc55' },
  { key:'energy', icon:'⚡', label:'ENERGY', color:'#ff7722', low:'#ff2200', fill:'#ff7722' },
  { key:'land',   icon:'🏔', label:'LAND',   color:'#aaaaaa', low:'#ff2200', fill:'#aaaaaa' },
] as const

const CHART_COLORS: Record<string,string> = {
  AQUILONIA:'#2aafcc', VERDANTIS:'#7acc55', IGNIS_CORE:'#ff7722', TERRANOVA:'#aaaaaa', THE_NEXUS:'#ffee66',
}
const IDS = ['AQUILONIA','VERDANTIS','IGNIS_CORE','TERRANOVA','THE_NEXUS']

// ── Minecraft slot-style resource bar ─────────────────────────────────────────
function McBar({ label, icon, value, fill }: { label:string; icon:string; value:number; fill:string }) {
  const pct = Math.round(value * 100)
  const critical = value < 0.25
  const abundant = value > 0.75
  const barColor = critical ? '#ff2200' : fill
  return (
    <div style={{ marginBottom:5 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2, fontFamily:'"Press Start 2P",monospace', fontSize:6 }}>
        <span style={{ color:'#aaa' }}>{icon} {label}</span>
        <span style={{ color: critical?'#ff4422': abundant?'#aaffcc':fill, fontWeight:'bold' }}>
          {pct}%{critical?' ⚠':''}
        </span>
      </div>
      {/* mc-bar-track styled */}
      <div style={{
        height:8, background:'#373737',
        borderTop:'2px solid #1a1a1a', borderLeft:'2px solid #1a1a1a',
        borderRight:'2px solid #666', borderBottom:'2px solid #666',
        overflow:'hidden',
      }}>
        <div style={{
          width:`${pct}%`, height:'100%', background:barColor,
          borderRight: abundant?`1px solid ${fill}`:undefined,
          transition:'width 0.4s steps(10, end)',
          boxShadow: abundant?`0 0 6px ${fill}66`:undefined,
        }} />
      </div>
    </div>
  )
}

// ── Resource state badge ──────────────────────────────────────────────────────
function StateBadge({ label, state }: { label:string; state:'abundant'|'scarce'|'normal' }) {
  if(state==='normal') return null
  const cfg = state==='abundant'
    ? {bg:'#1a3a1a', border:'#44ee44', color:'#66ff66', text:'★ '+label.toUpperCase()}
    : {bg:'#3a1a1a', border:'#ee4444', color:'#ff6666', text:'▼ '+label.toUpperCase()}
  return (
    <span style={{
      fontFamily:'"Press Start 2P",monospace', fontSize:5, letterSpacing:0,
      background:cfg.bg, color:cfg.color, padding:'2px 4px',
      border:`1px solid ${cfg.border}`, marginRight:2, display:'inline-block', marginBottom:2,
    }}>{cfg.text}</span>
  )
}

// ── Region card (Minecraft inventory slot) ────────────────────────────────────
function RegionCard({ r }: { r:RegionState }) {
  const meta = NATION_META[r.id]; if(!meta) return null
  const crimePct = Math.round(r.crime_rate*100)
  const isHighCrime = r.crime_rate>0.65
  const getBadge = (key:string): 'abundant'|'scarce'|'normal' => {
    const v = r.resources[key as keyof typeof r.resources]
    return v>0.72?'abundant':v<0.28?'scarce':'normal'
  }
  return (
    <div style={{
      background: meta.slotBg,
      borderTop:`2px solid ${meta.slotBorder}88`,
      borderLeft:`2px solid ${meta.slotBorder}88`,
      borderRight:`2px solid ${meta.slotBorder}44`,
      borderBottom:`2px solid ${meta.slotBorder}44`,
      marginBottom:6, padding:'7px 8px',
    }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5 }}>
        <div>
          <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:8, color:meta.color, marginBottom:3 }}>
            {meta.emoji} {r.name.toUpperCase()}
          </div>
          <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:5, color:meta.color, opacity:0.7, marginBottom:1 }}>
            {meta.tag}
          </div>
          <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:5, color:'#666' }}>
            {meta.specialty}
          </div>
        </div>
        <div style={{
          fontFamily:'"Press Start 2P",monospace', fontSize:7, fontWeight:'bold',
          color: ACTION_COLORS[r.last_action],
          background:'#1a1a1a', padding:'3px 5px',
          borderTop:'2px solid #555', borderLeft:'2px solid #555',
          borderRight:'2px solid #111', borderBottom:'2px solid #111',
          whiteSpace:'nowrap',
        }}>
          {ACTION_ICONS[r.last_action]}
        </div>
      </div>

      {/* Resource badges */}
      <div style={{ marginBottom:5 }}>
        {(['water','food','energy','land'] as const).map(k=>(
          <StateBadge key={k} label={k} state={getBadge(k)} />
        ))}
      </div>

      {/* Resource bars */}
      {RES_CONFIG.map(rc=>(
        <McBar key={rc.key} label={rc.label} icon={rc.icon}
          value={r.resources[rc.key]} fill={rc.fill} />
      ))}

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:5,
        fontFamily:'"Press Start 2P",monospace', fontSize:6 }}>
        <span style={{ color: isHighCrime?'#ff3322':'#44bb44' }}>
          {isHighCrime?'⚠':''} {crimePct}% CRIME
        </span>
        <span style={{ color:'#888' }}>
          {(r.population/1e6).toFixed(1)}M POP
        </span>
      </div>
    </div>
  )
}

// ── Climate banner ────────────────────────────────────────────────────────────
function ClimateBanner({ event }: { event:ClimateEvent }) {
  if(!event.type) return null
  const meta = CLIMATE_META[event.type]; if(!meta) return null
  return (
    <div style={{
      background:meta.bg, marginBottom:8, padding:'6px 8px',
      borderTop:`2px solid ${meta.color}`,
      borderLeft:`2px solid ${meta.color}`,
      borderRight:`2px solid ${meta.color}44`,
      borderBottom:`2px solid ${meta.color}44`,
      animation:'mc-pulse 1s ease infinite',
    }}>
      <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:7, color:meta.color }}>
        {meta.icon} {meta.label} ACTIVE
      </div>
      <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:5, color:'#888', marginTop:3 }}>
        {event.duration_remaining} TICKS REMAINING
      </div>
    </div>
  )
}

// ── Metric chart ──────────────────────────────────────────────────────────────
type ChartMode = 'crime'|'energy'

function MetricChart({ history, mode }: { history:{tick:number;[k:string]:number}[]; mode:ChartMode }) {
  const data = history.slice(-40)
  const suffix = mode==='crime'?'_crime':'_energy'
  const mapped = data.map(h=>{
    const row:Record<string,number>={tick:h.tick}
    for(const id of IDS) row[id]=+(h[id+suffix]??0)
    return row
  })
  return (
    <div style={{ height:85 }}>
      <ResponsiveContainer width="100%" height={85}>
        <LineChart data={mapped} style={{ background:'transparent' }}>
          <XAxis dataKey="tick" hide />
          <YAxis domain={[0,1]} hide />
          <Tooltip contentStyle={{
            background:'#1a1a1a', border:'2px solid #555',
            fontFamily:'"Press Start 2P",monospace', fontSize:6, color:'#ccc',
          }} formatter={(v:number)=>[`${Math.round(v*100)}%`]} />
          {IDS.map(id=>(
            <Line key={id} type="stepAfter" dataKey={id} dot={false}
              stroke={CHART_COLORS[id]} strokeWidth={1.5} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const regions      = useWorldStore(s=>s.regions)
  const tick         = useWorldStore(s=>s.tick)
  const connected    = useWorldStore(s=>s.connected)
  const isRunning    = useWorldStore(s=>s.isRunning)
  const toggleRun    = useWorldStore(s=>s.toggleRunning)
  const climateEvent = useWorldStore(s=>s.climateEvent)
  const history      = useWorldStore(s=>s.history)
  const [chartMode, setChartMode] = React.useState<ChartMode>('crime')

  return (
    <div style={{
      width:'100%', height:'100%', overflowY:'auto', overflowX:'hidden',
      // Main Minecraft GUI background — dark stone texture simulation
      background:'#2a2a2a',
      borderRight:'4px solid #111',
      color:'#c0c8d8',
    }}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background:'#1a1a1a', padding:'10px 10px 8px',
        borderBottom:'3px solid #444',
      }}>
        <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:10, color:'#fcfc54', textShadow:'2px 2px #555', marginBottom:4 }}>
          ☽ WORLDSIM 2.0
        </div>
        <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:6, color:'#888' }}>
          5 NATIONS · AUTONOMOUS RL
        </div>
      </div>

      <div style={{ padding:'8px 8px', boxSizing:'border-box' }}>
        {/* ─── Status + Controls ────────────────────────────────────────── */}
        <div style={{ display:'flex', gap:5, marginBottom:8, alignItems:'center' }}>
          <div style={{
            flex:1, fontFamily:'"Press Start 2P",monospace', fontSize:6,
            color: connected?'#44ee88':'#ff4444',
            background:'#1a1a1a', padding:'4px 6px',
            borderTop:'2px solid #444', borderLeft:'2px solid #444',
            borderRight:'2px solid #111', borderBottom:'2px solid #111',
          }}>
            {connected?'● LIVE':'○ OFF'} T#{tick}
          </div>
          <button
            className={`mc-btn ${isRunning?'mc-btn-red':'mc-btn-green'}`}
            onClick={toggleRun}
          >
            {isRunning?'⏸ PAUSE':'▶ START'}
          </button>
        </div>

        {/* ─── Tribe bonus panel ───────────────────────────────────────── */}
        <div style={{
          fontFamily:'"Press Start 2P",monospace', fontSize:5, color:'#888', marginBottom:8,
          padding:'5px 6px', background:'#1a1a1a',
          borderTop:'2px solid #444', borderLeft:'2px solid #444',
          borderRight:'2px solid #111', borderBottom:'2px solid #111',
          lineHeight:1.8,
        }}>
          IRON TRIBE (AQ+TN): -15% TRADE COST{'\n'}⚡ CRIME &gt;70%: -5% ENERGY/TICK
        </div>

        {/* ─── Climate ─────────────────────────────────────────────────── */}
        <ClimateBanner event={climateEvent} />

        {/* ─── Nation inventory slots ───────────────────────────────────── */}
        {regions.map(r=><RegionCard key={r.id} r={r} />)}

        {/* ─── Chart toggle ─────────────────────────────────────────────── */}
        <div style={{ marginTop:6 }}>
          <div style={{ display:'flex', gap:4, marginBottom:5 }}>
            {(['crime','energy'] as ChartMode[]).map(m=>(
              <button key={m}
                className={`mc-btn ${chartMode===m?'mc-btn-blue':''}`}
                onClick={()=>setChartMode(m)}
                style={{ fontSize:6 }}
              >
                {m==='crime'?'⚠ CRIME':'⚡ ENRGY'}
              </button>
            ))}
            <span style={{ fontFamily:'"Press Start 2P",monospace', fontSize:5, color:'#555', alignSelf:'center', marginLeft:4 }}>
              LAST 40 TICKS
            </span>
          </div>
          <MetricChart history={history} mode={chartMode} />
        </div>

        {/* ─── Legend ───────────────────────────────────────────────────── */}
        <div style={{
          marginTop:8, fontFamily:'"Press Start 2P",monospace', fontSize:5,
          color:'#555', lineHeight:2, padding:'5px 6px', background:'#1a1a1a',
          borderTop:'2px solid #333', borderLeft:'2px solid #333',
          borderRight:'2px solid #111', borderBottom:'2px solid #111',
        }}>
          [DEF]=CONSERVE [TRD]=TRADE{'\n'}[EXP]=EXPAND  [WAR]=CONFLICT{'\n'}
          ★=ABUNDANT(&gt;72%) ▼=SCARCE(&lt;28%)
        </div>
      </div>
    </div>
  )
}
