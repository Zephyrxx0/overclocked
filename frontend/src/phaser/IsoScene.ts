/**
 * IsoScene.ts — WorldSim 2.0 Sovereign Nations Renderer
 *
 * Five sovereign nations on a pentagonal layout with:
 *  • Distinct tile textures/colors per nation
 *  • Crime Pulse: animating red halo on high-crime regions
 *  • Energy Beams: sparkle lines between trading nations
 *  • Climate Particles: rain / solar flare / blight spores
 *  • President Sprites: icon shape changes by action (Conserve/Trade/Expand/Conflict)
 *  • Micro-animations: water shimmer, heat distortion, territory cracks, orbiting rings
 */
import Phaser from 'phaser'
import { RegionState, ClimateEvent, useWorldStore } from '../store/useWorldStore'

// ─── Layout: pentagonal arrangement ──────────────────────────────────────────
interface NLayout {
  fx: number; fy: number; fw: number; fh: number
  fill: number; border: number; labelCol: string
  accentFill: number
}
const LAYOUTS: Record<string, NLayout> = {
  AQUILONIA:  { fx:0.01, fy:0.02, fw:0.32, fh:0.44, fill:0x071428, border:0x4A9EFF, labelCol:'#7bbfff', accentFill:0x0a2a5c },
  VERDANTIS:  { fx:0.67, fy:0.02, fw:0.32, fh:0.44, fill:0x071408, border:0x4CAF50, labelCol:'#7ddf85', accentFill:0x0d3a12 },
  IGNIS_CORE: { fx:0.34, fy:0.26, fw:0.32, fh:0.44, fill:0x1c0803, border:0xFF7043, labelCol:'#ff9a7a', accentFill:0x3d1008 },
  TERRANOVA:  { fx:0.01, fy:0.53, fw:0.32, fh:0.44, fill:0x12100a, border:0xA08040, labelCol:'#c8a052', accentFill:0x2a2010 },
  THE_NEXUS:  { fx:0.67, fy:0.53, fw:0.32, fh:0.44, fill:0x0d0814, border:0xAB7FE0, labelCol:'#c9a5f7', accentFill:0x1d1230 },
}

const NATION_NAMES: Record<string, string> = {
  AQUILONIA:  '🛡️ Aquilonia',
  VERDANTIS:  '🌿 Verdantis',
  IGNIS_CORE: '🔥 Ignis Core',
  TERRANOVA:  '⚔️ Terranova',
  THE_NEXUS:  '🔮 The Nexus',
}

const PRESIDENT_NAMES: Record<string, string> = {
  AQUILONIA:  'Pres. Aldric',
  VERDANTIS:  'Pres. Sylvara',
  IGNIS_CORE: 'Pres. Ignar',
  TERRANOVA:  'Pres. Vorn',
  THE_NEXUS:  'Pres. Aura',
}

// ─── Particle types ───────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; alpha: number; r: number; color: number; life: number }

function seededRand(n: number) { const x = Math.sin(n + 13) * 92834.5; return x - Math.floor(x) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function clamp(v: number, mn: number, mx: number) { return Math.max(mn, Math.min(mx, v)) }

export class IsoScene extends Phaser.Scene {
  private bgGfx!: Phaser.GameObjects.Graphics     // static background
  private dynGfx!: Phaser.GameObjects.Graphics    // animated overlays
  private beamGfx!: Phaser.GameObjects.Graphics   // energy beams
  private particleGfx!: Phaser.GameObjects.Graphics
  private presidentGfx!: Phaser.GameObjects.Graphics

  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map()
  private crimeLabels: Map<string, Phaser.GameObjects.Text> = new Map()
  private actionLabels: Map<string, Phaser.GameObjects.Text> = new Map()
  private presidentLabels: Map<string, Phaser.GameObjects.Text> = new Map()

  private phase = 0         // master animation phase
  private regions: RegionState[] = []
  private climate: ClimateEvent = { type: null, duration_remaining: 0 }
  private particles: Particle[] = []
  private running = true

  // Per-nation animated state
  private crimeAlphas: Record<string, number> = {}
  private beamAlphas: Record<string, number> = {}  // keyed as "A-B"

  constructor() { super({ key: 'IsoScene' }) }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    const { width: W, height: H } = this.scale

    this.bgGfx        = this.add.graphics()
    this.dynGfx       = this.add.graphics()
    this.beamGfx      = this.add.graphics()
    this.particleGfx  = this.add.graphics()
    this.presidentGfx = this.add.graphics()

    this._drawBackground(W, H)
    this._createLabels(W, H)

    this.scale.on('resize', (_: unknown, gSize: Phaser.Structs.Size) => {
      this._onResize(gSize.width, gSize.height)
    })

    // Subscribe to Zustand store
    useWorldStore.subscribe(state => {
      this.regions = state.regions
      this.climate = state.climateEvent
    })
  }

  update(_t: number, delta: number) {
    if (!this.running) return
    this.phase += delta * 0.001
    const { width: W, height: H } = this.scale
    this._drawDynamic(W, H)
    this._drawBeams(W, H)
    this._drawParticles(W, H, delta)
    this._drawPresidents(W, H)
    this._updateLabels(W, H)
  }

  setRunning(r: boolean) { this.running = r }
  applyWorldState(regions: RegionState[]) { this.regions = regions }

  // ── Background ───────────────────────────────────────────────────────────

  private _drawBackground(W: number, H: number) {
    const g = this.bgGfx
    g.clear()

    // Deep space background gradient (dark)
    g.fillGradientStyle(0x000510, 0x000510, 0x05020a, 0x05020a, 1)
    g.fillRect(0, 0, W, H)

    // Star field
    for (let i = 0; i < 120; i++) {
      const sx = seededRand(i * 3.7) * W
      const sy = seededRand(i * 2.9) * H
      const sr2 = 0.5 + seededRand(i * 5.1) * 1.5
      const sa = 0.3 + seededRand(i * 7.3) * 0.5
      g.fillStyle(0xffffff, sa)
      g.fillCircle(sx, sy, sr2)
    }

    // Draw road connections between all nations
    this._drawRoads(g, W, H)

    // Draw each nation tile
    for (const id of Object.keys(LAYOUTS)) {
      this._drawNationTile(id, W, H)
    }
  }

  private _drawRoads(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    const centers: Record<string, { x: number; y: number }> = {}
    for (const id of Object.keys(LAYOUTS)) centers[id] = this._center(id, W, H)

    const pairs = [
      ['AQUILONIA',  'IGNIS_CORE'],
      ['VERDANTIS',  'IGNIS_CORE'],
      ['IGNIS_CORE', 'TERRANOVA'],
      ['IGNIS_CORE', 'THE_NEXUS'],
      ['AQUILONIA',  'TERRANOVA'],
      ['VERDANTIS',  'THE_NEXUS'],
    ]

    g.lineStyle(12, 0x111118, 1)
    for (const [a, b] of pairs) g.lineBetween(centers[a].x, centers[a].y, centers[b].x, centers[b].y)
    g.lineStyle(3, 0x222235, 0.8)
    for (const [a, b] of pairs) g.lineBetween(centers[a].x, centers[a].y, centers[b].x, centers[b].y)
  }

  private _drawNationTile(id: string, W: number, H: number) {
    const l = LAYOUTS[id]
    const x = l.fx * W, y = l.fy * H, w = l.fw * W, h = l.fh * H
    const g = this.bgGfx

    // Base fill
    g.fillStyle(l.fill, 1)
    g.fillRoundedRect(x, y, w, h, 12)

    // Inner accent fill
    g.fillStyle(l.accentFill, 0.5)
    g.fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 8)

    // Outer border glow
    g.lineStyle(2, l.border, 0.9)
    g.strokeRoundedRect(x, y, w, h, 12)
    g.lineStyle(10, l.border, 0.08)
    g.strokeRoundedRect(x - 5, y - 5, w + 10, h + 10, 17)

    // Nation-specific decorations
    this._drawNationDecorations(id, g, x, y, w, h)
  }

  private _drawNationDecorations(id: string, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    if (id === 'AQUILONIA') {
      // Water ripple at bottom
      g.fillStyle(0x0a2a5c, 0.7)
      g.fillRoundedRect(x + 6, y + h * 0.7, w - 12, h * 0.27, { bl: 8, br: 8, tl: 0, tr: 0 })
      // Battlements (top wall details)
      const bw = 10, bh = 8, gap = 14
      for (let bx = x + 10; bx < x + w - 10; bx += bw + gap) {
        g.fillStyle(0x1a3a6c, 0.8); g.fillRect(bx, y + 4, bw, bh)
      }
      // Towers at corners
      const towerPositions = [[x + 8, y + 8], [x + w - 22, y + 8], [x + 8, y + h - 22], [x + w - 22, y + h - 22]]
      for (const [tx, ty] of towerPositions) {
        g.fillStyle(0x1e4580, 0.9); g.fillRect(tx, ty, 14, 14)
        g.lineStyle(1, 0x4A9EFF, 0.5); g.strokeRect(tx, ty, 14, 14)
      }
    } else if (id === 'VERDANTIS') {
      // Dense forest floor
      const trees = [[0.1,0.4],[0.25,0.32],[0.5,0.28],[0.72,0.38],[0.85,0.45],
                     [0.15,0.62],[0.4,0.7],[0.65,0.65],[0.88,0.7],[0.55,0.5]]
      trees.forEach(([tx, ty], i) => {
        const px = x + tx * w, py = y + ty * h, s = 8 + seededRand(i * 4) * 9
        g.fillStyle(0x0d3a12, 1); g.fillCircle(px, py + s * 0.4, s * 0.55)
        g.fillStyle(0x165c1e, 1); g.fillCircle(px, py, s)
        g.fillStyle(0x20882a, 0.5); g.fillCircle(px - s * 0.3, py - s * 0.3, s * 0.6)
      })
      // Farm fields
      g.fillStyle(0x1a5c20, 0.22)
      g.fillRect(x + w * 0.3, y + h * 0.55, w * 0.35, h * 0.28)
      g.lineStyle(1, 0x2a7a2a, 0.3)
      for (let fy = y + h * 0.55; fy < y + h * 0.83; fy += 8)
        g.lineBetween(x + w * 0.3, fy, x + w * 0.65, fy)
    } else if (id === 'IGNIS_CORE') {
      // Lava cracks
      g.lineStyle(2, 0xff4400, 0.35)
      const cracks = [[0.1,0.3,0.4,0.6],[0.5,0.2,0.7,0.5],[0.2,0.7,0.5,0.9],[0.6,0.6,0.9,0.8]]
      for (const [x1, y1, x2, y2] of cracks)
        g.lineBetween(x + x1 * w, y + y1 * h, x + x2 * w, y + y2 * h)
      // Industrial chimneys
      const chimPos = [[0.15,0.35],[0.45,0.28],[0.75,0.38]]
      chimPos.forEach(([cx2, cy2]) => {
        const px = x + cx2 * w, py = y + cy2 * h
        g.fillStyle(0x2a1208, 1); g.fillRect(px - 6, py - 28, 12, 30)
        g.lineStyle(1, 0xff7043, 0.4); g.strokeRect(px - 6, py - 28, 12, 30)
      })
      // Factory blocks
      g.fillStyle(0x1c0e06, 1); g.fillRect(x + w * 0.1, y + h * 0.55, w * 0.8, h * 0.28)
      g.lineStyle(1, 0x663322, 0.4); g.strokeRect(x + w * 0.1, y + h * 0.55, w * 0.8, h * 0.28)
    } else if (id === 'TERRANOVA') {
      // Cracked earth texture
      g.lineStyle(1, 0x604020, 0.5)
      const terrainLines = [[0.1,0.2,0.6,0.4],[0.3,0.5,0.9,0.7],[0.05,0.65,0.5,0.8],
                            [0.4,0.2,0.8,0.45],[0.15,0.4,0.7,0.3]]
      for (const [x1,y1,x2,y2] of terrainLines)
        g.lineBetween(x+x1*w, y+y1*h, x+x2*w, y+y2*h)
      // Boulders
      const boulders = [[0.15,0.35,12],[0.55,0.45,9],[0.8,0.3,14],[0.35,0.7,10],[0.7,0.65,8]]
      boulders.forEach(([bx, by, bs]) => {
        g.fillStyle(0x3a2a10, 1); g.fillEllipse(x+bx*w, y+by*h, bs*2.5, bs * 1.5)
        g.lineStyle(1, 0x604020, 0.8); g.strokeEllipse(x+bx*w, y+by*h, bs*2.5, bs*1.5)
      })
      // Skull markers (Parasite territory marks)
      g.fillStyle(0x664422, 0.6)
      g.fillTriangle(x+w*0.5, y+h*0.15, x+w*0.45, y+h*0.25, x+w*0.55, y+h*0.25)
    } else if (id === 'THE_NEXUS') {
      // Central hub circle
      const cx3 = x + w / 2, cy3 = y + h / 2
      g.lineStyle(2, 0xAB7FE0, 0.25)
      for (let r2 = 20; r2 < 80; r2 += 18) g.strokeCircle(cx3, cy3, r2)
      // Connecting grid lines
      g.lineStyle(1, 0x6a4aaa, 0.2)
      for (let gx = x + 10; gx < x + w; gx += 22) g.lineBetween(gx, y, gx, y + h)
      for (let gy = y + 10; gy < y + h; gy += 22) g.lineBetween(x, gy, x + w, gy)
      // Glowing core
      g.fillStyle(0x3a1a6a, 0.8); g.fillCircle(cx3, cy3, 18)
      g.lineStyle(2, 0xAB7FE0, 0.6); g.strokeCircle(cx3, cy3, 18)
    }
  }

  // ── Labels ───────────────────────────────────────────────────────────────

  private _createLabels(W: number, H: number) {
    for (const id of Object.keys(LAYOUTS)) {
      const l = LAYOUTS[id]
      const x = (l.fx + l.fw / 2) * W
      const y = l.fy * H

      const nameLabel = this.add.text(x, y + 14, NATION_NAMES[id] ?? id, {
        fontSize: '14px', fontFamily: 'Inter, JetBrains Mono, monospace',
        color: l.labelCol, stroke: '#000', strokeThickness: 4, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setDepth(50)
      this.nameLabels.set(id, nameLabel)

      const presLabel = this.add.text(x, y + 33, PRESIDENT_NAMES[id] ?? '', {
        fontSize: '10px', fontFamily: 'Inter, monospace',
        color: '#888899', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 0).setDepth(50)
      this.presidentLabels.set(id, presLabel)

      const crimeLabel = this.add.text(x, y + 48, '', {
        fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
        color: '#ff6655', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 0).setDepth(50)
      this.crimeLabels.set(id, crimeLabel)

      const actionLabel = this.add.text(x, y + h(l, H) - 22, '', {
        fontSize: '11px', fontFamily: 'Inter, monospace',
        color: '#ffeeaa', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(50)
      this.actionLabels.set(id, actionLabel)
    }

    function h(l: NLayout, H: number) { return l.fh * H }
  }

  private _updateLabels(W: number, H: number) {
    for (const r of this.regions) {
      const l = LAYOUTS[r.id]
      if (!l) continue
      const cx = (l.fx + l.fw / 2) * W
      const ty = l.fy * H

      this.nameLabels.get(r.id)?.setPosition(cx, ty + 14)
      this.presidentLabels.get(r.id)?.setPosition(cx, ty + 33)
      this.crimeLabels.get(r.id)?.setPosition(cx, ty + 48)
      this.actionLabels.get(r.id)?.setPosition(cx, ty + l.fh * H - 22)

      const cLabel = this.crimeLabels.get(r.id)
      if (cLabel) {
        const pct = Math.round(r.crime_rate * 100)
        cLabel.setText(`⚠ ${pct}% crime   pop ${(r.population / 1_000_000).toFixed(1)}M`)
        cLabel.setColor(r.crime_rate > 0.65 ? '#ff4444' : r.crime_rate > 0.4 ? '#ffaa44' : '#66cc66')
      }

      const aLabel = this.actionLabels.get(r.id)
      if (aLabel) {
        const icons: Record<string, string> = { Conserve:'🛡️', Trade:'🤝', Expand:'⬆️', Conflict:'⚔️' }
        aLabel.setText(`${icons[r.last_action] ?? ''}  ${r.last_action}`)
        const actionColors: Record<string, string> = {
          Conserve: '#88cce8', Trade: '#66ee88', Expand: '#ffcc44', Conflict: '#ff5555'
        }
        aLabel.setColor(actionColors[r.last_action] ?? '#ffffff')
      }
    }
  }

  // ── Dynamic overlays ─────────────────────────────────────────────────────

  private _drawDynamic(W: number, H: number) {
    const g = this.dynGfx; g.clear()

    for (const r of this.regions) {
      const l = LAYOUTS[r.id]; if (!l) continue
      const x = l.fx * W, y = l.fy * H, w = l.fw * W, h2 = l.fh * H
      const cx = x + w / 2, cy = y + h2 / 2

      // ── Crime Pulse (red breathing halo) ────────────────────────────────
      if (r.crime_rate > 0.45) {
        const intensity = clamp((r.crime_rate - 0.45) / 0.55, 0, 1)
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(this.phase * 3.5 + hash(r.id)))
        const alpha = intensity * pulse * 0.45
        const radius = 20 + intensity * 60 + pulse * 15
        g.fillStyle(0xff2200, alpha * 0.35); g.fillCircle(cx, cy, radius * 1.3)
        g.lineStyle(3, 0xff3300, alpha); g.strokeCircle(cx, cy, radius)
        g.lineStyle(1, 0xff6644, alpha * 0.6); g.strokeCircle(cx - 1, cy - 1, radius * 1.15)
      }

      // ── Nation-specific micro-animations ────────────────────────────────
      if (r.id === 'AQUILONIA') {
        // Water shimmer
        const waterY = y + h2 * 0.75
        g.lineStyle(2, 0x4A9EFF, 0.4)
        for (let wi = 0; wi < 4; wi++) {
          const wy = waterY + wi * 7
          for (let xi = x + 12; xi < x + w - 12; xi += 22) {
            const yo = Math.sin((xi * 0.09) + this.phase * 2.8 + wi) * 3
            g.lineBetween(xi, wy + yo, xi + 11, wy - yo)
          }
        }
      } else if (r.id === 'IGNIS_CORE') {
        // Heat distortion shimmer (orange flicker lines)
        g.lineStyle(1, 0xFF7043, 0.2)
        for (let hi = 0; hi < 6; hi++) {
          const hx = x + (0.1 + seededRand(hi) * 0.8) * w
          const hy1 = y + h2 * 0.5 + Math.sin(this.phase * 4 + hi * 1.5) * 8
          const hy2 = hy1 - 20 - seededRand(this.phase + hi) * 12
          g.lineBetween(hx, hy1, hx + Math.sin(this.phase * 3 + hi) * 6, hy2)
        }
        // Lava pulse
        const lavaPulse = 0.15 + 0.1 * Math.sin(this.phase * 2)
        g.fillStyle(0xff4400, lavaPulse)
        g.fillRoundedRect(x + 4, y + h2 * 0.55 - 4, w - 8, h2 * 0.28 + 4, 6)
      } else if (r.id === 'VERDANTIS') {
        // Wind ripple across fields
        g.lineStyle(1, 0x4CAF50, 0.18)
        for (let fi = 0; fi < 5; fi++) {
          const fy2 = y + h2 * 0.6 + fi * 10
          const fphase = this.phase * 1.5 + fi * 0.6
          for (let fx2 = x + w * 0.3; fx2 < x + w * 0.65; fx2 += 12) {
            const fy3 = fy2 + Math.sin(fphase + fx2 * 0.1) * 2.5
            g.lineBetween(fx2, fy3, fx2 + 5, fy3 - 3)
          }
        }
      } else if (r.id === 'TERRANOVA') {
        // Cracking earth — dark fissures pulse
        const crackIntensity = 0.1 + r.crime_rate * 0.2
        g.lineStyle(2, 0x301810, crackIntensity + 0.05 * Math.sin(this.phase * 1.5))
        g.lineBetween(x + w * 0.2, y + h2 * 0.35, x + w * 0.7, y + h2 * 0.55)
        g.lineBetween(x + w * 0.4, y + h2 * 0.2, x + w * 0.65, y + h2 * 0.72)
      } else if (r.id === 'THE_NEXUS') {
        // Orbiting signal rings
        for (let oi = 0; oi < 3; oi++) {
          const orbitR = 30 + oi * 22
          const orbitPhase = this.phase * (1.2 - oi * 0.25) + oi * 2.1
          const ox = cx + Math.cos(orbitPhase) * orbitR
          const oy = cy + Math.sin(orbitPhase) * orbitR * 0.55
          g.fillStyle(0xAB7FE0, 0.6 - oi * 0.15); g.fillCircle(ox, oy, 4 - oi * 0.8)
        }
        // Nexus core pulse
        const nexusPulse = 0.3 + 0.3 * Math.sin(this.phase * 2.5)
        g.fillStyle(0xAB7FE0, nexusPulse); g.fillCircle(cx, cy, 14)
      }
    }
  }

  // ── Energy Beams ─────────────────────────────────────────────────────────

  private _drawBeams(W: number, H: number) {
    const g = this.beamGfx; g.clear()
    if (this.regions.length === 0) return

    // Build a set of trading nations
    const tradeSet = new Set(
      this.regions.filter(r => r.last_action === 'Trade').map(r => r.id)
    )

    const pairs: [string, string][] = [
      ['AQUILONIA',  'IGNIS_CORE'], ['VERDANTIS', 'IGNIS_CORE'],
      ['IGNIS_CORE', 'TERRANOVA'], ['IGNIS_CORE', 'THE_NEXUS'],
      ['AQUILONIA',  'TERRANOVA'], ['VERDANTIS',  'THE_NEXUS'],
    ]

    for (const [a, b] of pairs) {
      const key = `${a}-${b}`
      const bothTrading = tradeSet.has(a) && tradeSet.has(b)

      // Ease the beam in/out
      const current = this.beamAlphas[key] ?? 0
      this.beamAlphas[key] = clamp(current + (bothTrading ? 0.06 : -0.04), 0, 1)
      const alpha = this.beamAlphas[key]
      if (alpha < 0.02) continue

      const ca = this._center(a, W, H), cb = this._center(b, W, H)

      // Beam glow layers
      g.lineStyle(12, 0x66aaff, alpha * 0.08)
      g.lineBetween(ca.x, ca.y, cb.x, cb.y)
      g.lineStyle(4, 0x88ccff, alpha * 0.25)
      g.lineBetween(ca.x, ca.y, cb.x, cb.y)
      g.lineStyle(1.5, 0xeeffff, alpha * 0.8)
      g.lineBetween(ca.x, ca.y, cb.x, cb.y)

      // Sparkle particles along the beam
      const numSparks = 6
      for (let si = 0; si < numSparks; si++) {
        const t = ((this.phase * 0.8 + si / numSparks) % 1)
        const sx = lerp(ca.x, cb.x, t)
        const sy = lerp(ca.y, cb.y, t)
        g.fillStyle(0xaaddff, alpha * (0.5 + 0.5 * Math.sin(this.phase * 8 + si)))
        g.fillCircle(sx, sy, 3)
      }
    }
  }

  // ── Climate Particles ─────────────────────────────────────────────────────

  private _drawParticles(W: number, H: number, delta: number) {
    const g = this.particleGfx; g.clear()
    const ct = this.climate?.type

    // Spawn new particles based on climate
    if (ct && this.particles.length < 150) {
      const count = ct === 'Drought' ? 2 : ct === 'SolarFlare' ? 3 : 2
      for (let i = 0; i < count; i++) this._spawnClimateParticle(ct, W, H)
    }

    // Update and draw
    this.particles = this.particles.filter(p => p.life > 0)
    for (const p of this.particles) {
      p.x += p.vx * delta * 0.06
      p.y += p.vy * delta * 0.06
      p.alpha -= 0.003
      p.life -= delta * 0.06

      g.fillStyle(p.color, Math.max(0, p.alpha))
      g.fillCircle(p.x, p.y, p.r)
    }

    // Clear particles when no climate event
    if (!ct) this.particles = this.particles.filter(p => p.life > 0 && p.life < 20)

    // Solar Flare overlay
    if (ct === 'SolarFlare') {
      const flareAlpha = 0.05 + 0.04 * Math.sin(this.phase * 4)
      g.fillStyle(0xffdd44, flareAlpha)
      g.fillRect(0, 0, W, H)
      // Burst rays from top
      g.lineStyle(3, 0xffee88, 0.15)
      for (let ri = 0; ri < 12; ri++) {
        const ang = (ri / 12) * Math.PI + this.phase * 0.3
        g.lineBetween(W / 2, -20, W / 2 + Math.cos(ang) * 600, Math.sin(ang) * 600)
      }
    }

    // Drought overlay
    if (ct === 'Drought') {
      g.fillStyle(0x884400, 0.06 + 0.03 * Math.sin(this.phase * 2))
      g.fillRect(0, 0, W, H)
    }

    // Blight overlay
    if (ct === 'Blight') {
      g.fillStyle(0x334400, 0.07 + 0.02 * Math.sin(this.phase * 1.5))
      g.fillRect(0, 0, W, H)
    }
  }

  private _spawnClimateParticle(type: string, W: number, H: number) {
    const x = Math.random() * W
    let p: Particle
    if (type === 'Drought') {
      // Orange-yellow dust motes drifting across
      p = { x, y: Math.random() * H * 0.5,
        vx: 1.5 + Math.random() * 1.5, vy: 0.2 + Math.random() * 0.5,
        alpha: 0.5 + Math.random() * 0.3, r: 1.5 + Math.random() * 2,
        color: 0xcc8833, life: 80 + Math.random() * 60 }
    } else if (type === 'SolarFlare') {
      // White-gold sparks from above
      p = { x, y: -5,
        vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 2.5,
        alpha: 0.7 + Math.random() * 0.3, r: 1 + Math.random() * 2.5,
        color: 0xffee88, life: 50 + Math.random() * 40 }
    } else {
      // Blight: dark brown spores falling
      p = { x, y: -5,
        vx: (Math.random() - 0.5) * 0.8, vy: 1.2 + Math.random() * 1.5,
        alpha: 0.4 + Math.random() * 0.4, r: 2 + Math.random() * 3,
        color: 0x554422, life: 90 + Math.random() * 50 }
    }
    this.particles.push(p)
  }

  // ── President Sprites ────────────────────────────────────────────────────

  private _drawPresidents(W: number, H: number) {
    const g = this.presidentGfx; g.clear()

    for (const r of this.regions) {
      const l = LAYOUTS[r.id]; if (!l) continue
      const cx = (l.fx + l.fw / 2) * W
      const cy = (l.fy + l.fh * 0.54) * H  // slightly below center
      const action = r.last_action
      const col = parseInt(r.color_hint.replace('#', '0x')) || 0xffffff
      const breathe = 1 + 0.04 * Math.sin(this.phase * 2 + hash(r.id))

      // Shadow
      g.fillStyle(0x000000, 0.2); g.fillEllipse(cx, cy + 15, 30, 8)

      // Body (circle, color = nation color)
      g.fillStyle(col, 0.9); g.fillCircle(cx, cy, 12 * breathe)
      g.lineStyle(2, 0xffffff, 0.5); g.strokeCircle(cx, cy, 12 * breathe)

      // Head
      g.fillStyle(0xffd0a0, 1); g.fillCircle(cx, cy - 16, 7)

      // Action icon drawn as graphics shape
      this._drawActionIcon(g, cx, cy, action, col)
    }
  }

  private _drawActionIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, action: string, col: number) {
    const iconY = cy - 34
    const pulse = 0.7 + 0.3 * Math.abs(Math.sin(this.phase * 3))

    if (action === 'Conserve') {
      // Shield shape
      g.fillStyle(0x4488ff, 0.8 * pulse)
      g.fillTriangle(cx - 8, iconY, cx + 8, iconY, cx, iconY + 14)
      g.lineStyle(2, 0x88aaff, 0.9); g.strokeTriangle(cx - 8, iconY, cx + 8, iconY, cx, iconY + 14)
    } else if (action === 'Trade') {
      // Exchange arrows
      g.lineStyle(3, 0x44ee88, 0.9 * pulse)
      g.lineBetween(cx - 10, iconY + 4, cx + 10, iconY + 4)
      g.lineBetween(cx - 10, iconY + 10, cx + 10, iconY + 10)
      // Arrow heads
      g.fillStyle(0x44ee88, 0.9)
      g.fillTriangle(cx + 8, iconY + 1, cx + 12, iconY + 4, cx + 8, iconY + 7)
      g.fillTriangle(cx - 8, iconY + 7, cx - 12, iconY + 10, cx - 8, iconY + 13)
    } else if (action === 'Expand') {
      // Outward burst / star
      g.lineStyle(2, 0xffcc44, 0.9 * pulse)
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + this.phase * 1.5
        g.lineBetween(cx, iconY + 7, cx + Math.cos(ang) * 11, iconY + 7 + Math.sin(ang) * 10)
      }
      g.fillStyle(0xffcc44, 0.8); g.fillCircle(cx, iconY + 7, 4)
    } else if (action === 'Conflict') {
      // X / crossed swords
      const sw = 9
      g.lineStyle(3, 0xff3333, 1.0 * pulse)
      g.lineBetween(cx - sw, iconY, cx + sw, iconY + 14)
      g.lineBetween(cx + sw, iconY, cx - sw, iconY + 14)
      // Red glow
      g.fillStyle(0xff1111, 0.15 * pulse); g.fillCircle(cx, iconY + 7, 14)
    }

    void col  // reserved for future nation-tinted icons
  }

  // ── Resize ───────────────────────────────────────────────────────────────

  private _onResize(W: number, H: number) {
    this.bgGfx.clear()
    this.nameLabels.forEach(l => l.destroy()); this.nameLabels.clear()
    this.crimeLabels.forEach(l => l.destroy()); this.crimeLabels.clear()
    this.actionLabels.forEach(l => l.destroy()); this.actionLabels.clear()
    this.presidentLabels.forEach(l => l.destroy()); this.presidentLabels.clear()
    this.particles = []
    this._drawBackground(W, H)
    this._createLabels(W, H)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _center(id: string, W: number, H: number) {
    const l = LAYOUTS[id]
    return { x: (l.fx + l.fw / 2) * W, y: (l.fy + l.fh / 2) * H }
  }
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h) % 100
}
