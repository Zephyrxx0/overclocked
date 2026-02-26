/**
 * IsoScene.ts — 2D Natural World Scene
 * Renders 5 geographically placed regions with decorations.
 * A citizen moves autonomously between regions based on personal stats.
 */
import Phaser from 'phaser'
import { RegionState, PlayerStats, useWorldStore } from '../store/useWorldStore'

// ─── Region layout (fractions of canvas) ─────────────────────────────────────
interface RLayout { fx:number; fy:number; fw:number; fh:number; fill:number; stroke:number; label:string }
const LAYOUTS: Record<string, RLayout> = {
  WATERFRONT:    { fx:0.01, fy:0.02, fw:0.33, fh:0.44, fill:0x071c14, stroke:0x2277dd, label:'#4af' },
  INDUSTRIAL:    { fx:0.66, fy:0.02, fw:0.33, fh:0.44, fill:0x141208, stroke:0xbb8800, label:'#fc0' },
  CBD_CORE:      { fx:0.36, fy:0.28, fw:0.28, fh:0.44, fill:0x0a0303, stroke:0xcc2222, label:'#f44' },
  SLUMS:         { fx:0.01, fy:0.54, fw:0.33, fh:0.44, fill:0x0f0406, stroke:0x882020, label:'#a22' },
  HILLY_SUBURBS: { fx:0.66, fy:0.54, fw:0.33, fh:0.44, fill:0x0f0d04, stroke:0x7a5522, label:'#964' },
}

// Stat deltas per 500ms spent in each region
const STAT_DELTA: Record<string, Partial<PlayerStats>> = {
  CBD_CORE:      { energy:5,  hunger:-2, thirst:-2, safety:-5 },
  WATERFRONT:    { energy:-1, hunger:2,  thirst:5,  safety:4  },
  INDUSTRIAL:    { energy:-1, hunger:5,  thirst:-1, safety:-1 },
  SLUMS:         { energy:-4, hunger:-4, thirst:-4, safety:-8 },
  HILLY_SUBURBS: { energy:1,  hunger:2,  thirst:2,  safety:3  },
}

function clamp(v:number,mn:number,mx:number){ return Math.max(mn,Math.min(mx,v)) }
function sr(n:number){ const x=Math.sin(n+7)*43758.5; return x-Math.floor(x) }  // seeded rand

interface Smoke { x:number; y:number; bx:number; alpha:number; vy:number; r:number }

export class IsoScene extends Phaser.Scene {
  private staticGfx!: Phaser.GameObjects.Graphics
  private animGfx!:   Phaser.GameObjects.Graphics
  private playerGfx!: Phaser.GameObjects.Graphics
  private uiContainer!: Phaser.GameObjects.Container
  private regionLabels: Map<string,Phaser.GameObjects.Text> = new Map()
  private regionBadges: Map<string,Phaser.GameObjects.Text> = new Map()
  private playerLabel!: Phaser.GameObjects.Text
  private statBars: Phaser.GameObjects.Graphics[] = []
  private statLabels: Phaser.GameObjects.Text[] = []

  private smokes: Smoke[] = []
  private neonPhase = 0
  private wavePhase = 0

  private playerX = 0
  private playerY = 0
  private currentRegion = 'WATERFRONT'
  private playerStats: PlayerStats = {
    energy:80, hunger:75, thirst:80, safety:85, happiness:80,
    currentRegion:'WATERFRONT', isMoving:false,
  }
  private running = true
  private pendingRegions: RegionState[] | null = null

  constructor(){ super({ key:'IsoScene' }) }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  create(){
    const { width, height } = this.scale
    this.staticGfx = this.add.graphics()
    this.animGfx   = this.add.graphics()
    this.playerGfx = this.add.graphics()

    this._drawWorld(width, height)
    this._createPlayerUI(width, height)
    this._initSmoke(width, height)

    const initPos = this._center('WATERFRONT', width, height)
    this.playerX = initPos.x
    this.playerY = initPos.y

    this.time.addEvent({ delay:500,  callback:this._statTick,   callbackScope:this, loop:true })
    this.time.addEvent({ delay:3800, callback:this._decideMove, callbackScope:this, loop:true })
    this.scale.on('resize', (_:unknown, gSize:Phaser.Structs.Size) => {
      this._onResize(gSize.width, gSize.height)
    })
  }

  update(_t: number, delta: number){
    if (!this.running) return
    this.neonPhase += delta * 0.003
    this.wavePhase  += delta * 0.002
    this._animFrame(this.scale.width, this.scale.height)
    this._drawPlayer()
  }

  // ── Public API ───────────────────────────────────────────────────────────

  applyWorldState(regions: RegionState[]){ this.pendingRegions = regions; this._applyRegions(regions) }
  setRunning(r: boolean){ this.running = r }

  // ── World Drawing ────────────────────────────────────────────────────────

  private _drawWorld(W: number, H: number){
    this.staticGfx.clear()
    this._drawRoads(W, H)
    for (const id of Object.keys(LAYOUTS)) this._drawRegion(id, W, H)
    this._drawDecorations(W, H)
  }

  private _drawRoads(W: number, H: number){
    const g = this.staticGfx
    g.lineStyle(14, 0x1a1a1a, 1)
    // Road strips between regions
    const cbd = this._center('CBD_CORE', W, H)
    for (const id of ['WATERFRONT','INDUSTRIAL','SLUMS','HILLY_SUBURBS']){
      const c = this._center(id, W, H)
      g.lineBetween(c.x, c.y, cbd.x, cbd.y)
    }
    g.lineStyle(5, 0x2a2a2a, 1)
    for (const id of ['WATERFRONT','INDUSTRIAL','SLUMS','HILLY_SUBURBS']){
      const c = this._center(id, W, H)
      g.lineBetween(c.x, c.y, cbd.x, cbd.y)
    }
  }

  private _drawRegion(id: string, W: number, H: number){
    const l = LAYOUTS[id]
    const x=l.fx*W, y=l.fy*H, w=l.fw*W, h=l.fh*H
    const g = this.staticGfx
    // Fill
    g.fillStyle(l.fill, 1)
    g.fillRoundedRect(x, y, w, h, 10)
    // Border glow (outer)
    g.lineStyle(3, l.stroke, 0.9)
    g.strokeRoundedRect(x, y, w, h, 10)
    g.lineStyle(8, l.stroke, 0.15)
    g.strokeRoundedRect(x-3, y-3, w+6, h+6, 13)

    // Region name
    const cx = x + w/2
    const existing = this.regionLabels.get(id)
    if (existing) existing.destroy()
    const txt = this.add.text(cx, y+14, ['WATERFRONT','INDUSTRIAL','CBD_CORE','SLUMS','HILLY_SUBURBS']
      .includes(id) ? LAYOUTS[id].label && this._regionName(id) : id, {
      fontSize:'13px', color: l.label, fontFamily:'JetBrains Mono, monospace',
      stroke:'#000', strokeThickness:3,
    }).setOrigin(0.5, 0).setDepth(10)
    txt.setText(this._regionName(id))
    this.regionLabels.set(id, txt)

    // Crime badge
    const badge = this.add.text(cx, y+30, '', {
      fontSize:'10px', color:'#ff6666', fontFamily:'JetBrains Mono, monospace',
    }).setOrigin(0.5, 0).setDepth(10)
    this.regionBadges.set(id, badge)
  }

  private _regionName(id: string){
    const names: Record<string,string> = {
      WATERFRONT:'🌊 Waterfront', INDUSTRIAL:'🏭 Industrial', CBD_CORE:'🌆 CBD Core',
      SLUMS:'💀 Slums', HILLY_SUBURBS:'🏡 Hilly Suburbs',
    }
    return names[id] ?? id
  }

  private _drawDecorations(W: number, H: number){
    const g = this.staticGfx
    this._drawWaterfront(g, W, H)
    this._drawIndustrial(g, W, H)
    this._drawCBD(g, W, H)
    this._drawSlums(g, W, H)
    this._drawSuburbs(g, W, H)
  }

  private _rect(id:string, W:number, H:number){ const l=LAYOUTS[id]; return {x:l.fx*W,y:l.fy*H,w:l.fw*W,h:l.fh*H} }

  private _drawWaterfront(g: Phaser.GameObjects.Graphics, W:number, H:number){
    const {x,y,w,h} = this._rect('WATERFRONT',W,H)
    // Water strip at bottom
    g.fillStyle(0x0a3f7a, 0.7)
    g.fillRoundedRect(x+4, y+h*0.72, w-8, h*0.26, {bl:8,br:8,tl:0,tr:0})
    // Wave lines
    g.lineStyle(2, 0x2288cc, 0.5)
    for (let i=0;i<3;i++){
      const wy = y+h*0.76 + i*8
      for (let wx=x+10;wx<x+w-10;wx+=20)
        g.lineBetween(wx, wy, wx+10, wy-4)
    }
    // Trees
    const tpos = [[0.15,0.25],[0.4,0.18],[0.65,0.28],[0.25,0.48],[0.55,0.52],[0.78,0.42],[0.12,0.58]]
    tpos.forEach(([tx,ty],i)=>{
      const px=x+tx*w, py=y+ty*h, s=9+sr(i*3)*7
      g.fillStyle(0x0d4a1e,1); g.fillCircle(px,py+s*0.4,s*0.5)
      g.fillStyle(0x165c28,1); g.fillCircle(px,py,s)
      g.fillStyle(0x1a7a30,0.6); g.fillCircle(px-s*0.2,py-s*0.3,s*0.6)
    })
    // Houses
    const hpos=[[0.3,0.36],[0.6,0.38]]
    hpos.forEach(([hx,hy])=>{
      const px=x+hx*w, py=y+hy*h
      g.fillStyle(0xc8b89a,1); g.fillRect(px-12,py-8,24,16)
      g.fillStyle(0x8b4513,1)
      g.fillTriangle(px-14,py-8, px+14,py-8, px,py-22)
    })
  }

  private _drawIndustrial(g: Phaser.GameObjects.Graphics, W:number, H:number){
    const {x,y,w,h} = this._rect('INDUSTRIAL',W,H)
    // Ground: concrete
    g.fillStyle(0x1e1b10, 1); g.fillRoundedRect(x+4,y+4,w-8,h-8,8)
    // Rails
    g.lineStyle(3, 0x444430, 1)
    g.lineBetween(x+10, y+h*0.78, x+w-10, y+h*0.78)
    g.lineBetween(x+10, y+h*0.82, x+w-10, y+h*0.82)
    for (let xi=x+15;xi<x+w-10;xi+=18)
      g.lineBetween(xi, y+h*0.78, xi, y+h*0.82)
    // Factory buildings + chimneys
    const buildings=[[0.1,0.35,0.22,0.55],[0.35,0.25,0.22,0.65],[0.62,0.30,0.20,0.58]]
    buildings.forEach(([bx,bw2,by,bh2],i)=>{
      const px=x+bx*w, pw=bw2*w, py=y+by*h, ph=bh2*h
      g.fillStyle(0x2a2520,1); g.fillRect(px,py,pw,ph)
      g.lineStyle(1,0x554433,0.5); g.strokeRect(px,py,pw,ph)
      // Windows
      g.fillStyle(0x667733,0.6)
      for (let wy=py+8;wy<py+ph-4;wy+=14)
        for (let wx2=px+6;wx2<px+pw-4;wx2+=10)
          g.fillRect(wx2,wy,6,8)
      // Chimney
      const cx2=px+pw*0.7; g.fillStyle(0x3a3028,1); g.fillRect(cx2,py-20,8,22)
      void i
    })
  }

  private _drawCBD(g: Phaser.GameObjects.Graphics, W:number, H:number){
    const {x,y,w,h} = this._rect('CBD_CORE',W,H)
    // Street grid
    g.lineStyle(1, 0x1a1a1a, 0.8)
    for (let gx=x+20;gx<x+w;gx+=28) g.lineBetween(gx,y,gx,y+h)
    for (let gy=y+20;gy<y+h;gy+=28) g.lineBetween(x,gy,x+w,gy)
    // Skyscrapers
    const sk=[[0.1,0.7,0.12,0.1],[0.25,0.65,0.12,0.1],[0.44,0.5,0.12,0.1],
              [0.62,0.6,0.12,0.1],[0.78,0.72,0.12,0.1]]
    sk.forEach(([sx,sh2,sw2])=>{
      const bx=x+sx*w, bw2=sw2*w, bh2=sh2*h, by=y+(h-bh2)
      g.fillStyle(0x0f0f1e,1); g.fillRect(bx,by,bw2,bh2)
      // Windows (lit yellow)
      g.fillStyle(0xffdd00,0.7)
      for (let wy=by+4;wy<by+bh2-4;wy+=7)
        for (let wx=bx+3;wx<bx+bw2-3;wx+=5)
          if (Math.random()>0.4) g.fillRect(wx,wy,3,4)
    })
  }

  private _drawSlums(g: Phaser.GameObjects.Graphics, W:number, H:number){
    const {x,y,w,h} = this._rect('SLUMS',W,H)
    // Broken buildings
    const bl=[[0.08,0.25,0.28,0.52],[0.4,0.30,0.25,0.48],[0.7,0.22,0.22,0.58]]
    bl.forEach(([bx,bw2,by,bh2])=>{
      const px=x+bx*w,pw=bw2*w,py=y+by*h,ph=bh2*h
      g.fillStyle(0x260c0c,1); g.fillRect(px,py,pw,ph)
      g.lineStyle(1,0x441010,1); g.strokeRect(px,py,pw,ph)
      // Cracked windows
      g.fillStyle(0x1a0808,1)
      for (let wy=py+8;wy<py+ph-4;wy+=16)
        for (let wx=px+6;wx<px+pw-4;wx+=12){
          g.fillRect(wx,wy,8,10)
          // crack line
          g.lineStyle(1,0x661111,0.8); g.lineBetween(wx+2,wy,wx+6,wy+10)
        }
    })
    // Graffiti strokes
    const gcols=[0xff2244,0x22ff44,0x4444ff,0xffff22]
    for (let i=0;i<12;i++){
      const gx=x+sr(i*5)*w, gy=y+sr(i*5+1)*h*0.9+h*0.05
      g.lineStyle(3+sr(i)*2, gcols[i%4], 0.6+sr(i*2)*0.4)
      g.lineBetween(gx,gy,gx+sr(i*3)*30-15,gy+sr(i*4)*20-10)
    }
  }

  private _drawSuburbs(g: Phaser.GameObjects.Graphics, W:number, H:number){
    const {x,y,w,h} = this._rect('HILLY_SUBURBS',W,H)
    // Hills (arcs)
    const hills=[[0.15,0.65,0.3],[0.5,0.60,0.35],[0.8,0.68,0.28]]
    hills.forEach(([hx,hy,hr])=>{
      const px=x+hx*w, py=y+hy*h, r=hr*w
      g.fillStyle(0x1a3010,0.7)
      g.fillEllipse(px, py+r*0.5, r*2, r)
    })
    // Houses with roofs
    const houses=[[0.15,0.35],[0.42,0.28],[0.7,0.33],[0.28,0.55],[0.65,0.52]]
    houses.forEach(([hx,hy],i)=>{
      const px=x+hx*w, py=y+hy*h, s=8+sr(i*7)*6
      g.fillStyle(0xd4b896,1); g.fillRect(px-s,py,s*2,s*1.5)
      const cols=[0x8b2020,0x204080,0x205020,0x806020]
      g.fillStyle(cols[i%4],1)
      g.fillTriangle(px-s-2,py, px+s+2,py, px,py-s*1.4)
    })
    // Green trees
    const tpos=[[0.08,0.42],[0.55,0.70],[0.85,0.44],[0.35,0.72]]
    tpos.forEach(([tx,ty],i)=>{
      const px=x+tx*w, py=y+ty*h, s=7+sr(i*11)*5
      g.fillStyle(0x124a1a,1); g.fillCircle(px,py,s)
      g.fillStyle(0x1a6626,0.6); g.fillCircle(px,py-s*0.4,s*0.7)
    })
  }

  // ── Animated elements ────────────────────────────────────────────────────

  private _initSmoke(W:number, H:number){
    this.smokes = []
    const {x,y,w,h} = this._rect('INDUSTRIAL',W,H)
    const chimneyX=[x+w*0.2, x+w*0.45, x+w*0.72]
    chimneyX.forEach(cx=>{
      for (let i=0;i<4;i++) this.smokes.push({
        x:cx+Math.random()*6-3, y:y+h*0.3-Math.random()*20,
        bx:cx, alpha:0.4+Math.random()*0.3, vy:0.4+Math.random()*0.3, r:4+Math.random()*5
      })
    })
  }

  private _animFrame(W:number, H:number){
    const g = this.animGfx; g.clear()
    if (!this.running) return

    // Smoke particles (INDUSTRIAL)
    this.smokes.forEach(s=>{
      s.y -= s.vy; s.alpha -= 0.005; s.r += 0.03
      if (s.alpha <= 0 || s.y < LAYOUTS['INDUSTRIAL'].fy*H - 30){
        const {x,y,w,h} = this._rect('INDUSTRIAL',W,H)
        void h
        const chimneys=[x+w*0.2, x+w*0.45, x+w*0.72]
        s.bx = chimneys[Math.floor(Math.random()*chimneys.length)]
        s.x=s.bx+Math.random()*6-3; s.y=y+LAYOUTS['INDUSTRIAL'].fh*H*0.28
        s.alpha=0.35+Math.random()*0.2; s.vy=0.3+Math.random()*0.3; s.r=4+Math.random()*4
      }
      g.fillStyle(0xaaaaaa, s.alpha); g.fillCircle(s.x, s.y, s.r)
    })

    // Neon flicker (CBD)
    const {x:cx,y:cy,w:cw,h:ch} = this._rect('CBD_CORE',W,H)
    void ch
    const neonCols=[0xff4444,0xff8800,0xcc00cc,0x00ccff]
    for (let i=0;i<5;i++){
      const nx=cx+sr(i*3)*cw, ny=cy+sr(i*3+1)*ch*0.8+cy*0.05
      const alpha=0.5+0.5*Math.sin(this.neonPhase+i*1.3)
      g.fillStyle(neonCols[i%4], alpha*0.8); g.fillRect(nx,ny,20+sr(i)*15,4)
    }

    // Water wave (Waterfront)
    const {x:wx,y:wy,w:ww,h:wh} = this._rect('WATERFRONT',W,H)
    g.lineStyle(2,0x4499ee,0.55)
    for (let wi=0;wi<3;wi++){
      const ry=wy+wh*0.78+wi*7
      for (let xi=wx+10;xi<wx+ww-10;xi+=18){
        const yo=Math.sin((xi+this.wavePhase*60)*0.12)*3
        g.lineBetween(xi,ry+yo,xi+9,ry-yo)
      }
    }
  }

  // ── Player ───────────────────────────────────────────────────────────────

  private _createPlayerUI(W: number, H: number){
    void W; void H
    this.playerLabel = this.add.text(0,0,'', {
      fontSize:'11px', color:'#ffffff', fontFamily:'JetBrains Mono, monospace',
      stroke:'#000', strokeThickness:3, align:'center',
    }).setOrigin(0.5,1).setDepth(200)
    // 5 stat bars created dynamically each frame
  }

  private _drawPlayer(){
    const g = this.playerGfx; g.clear()
    if (!this.running && this.playerStats.isMoving) return

    const px = this.playerX, py = this.playerY
    // Shadow
    g.fillStyle(0x000000,0.3); g.fillEllipse(px, py+12, 20, 6)
    // Body circle
    g.fillStyle(0x5588ff,1); g.fillCircle(px, py, 10)
    // Head
    g.fillStyle(0xffcc99,1); g.fillCircle(px, py-12, 6)
    // Safety indicator ring
    const safetyCol = this.playerStats.safety > 60 ? 0x44ff88 : this.playerStats.safety > 30 ? 0xffcc00 : 0xff3333
    g.lineStyle(2, safetyCol, 0.9); g.strokeCircle(px, py, 13)

    // Stats label above
    const { energy, hunger, thirst, safety } = this.playerStats
    const mood = (energy+hunger+thirst+safety)/4 > 60 ? '😊' : (energy+hunger+thirst+safety)/4 > 35 ? '😐' : '😟'
    this.playerLabel.setText(`${mood}\n⚡${Math.round(energy)} 🍖${Math.round(hunger)}\n💧${Math.round(thirst)} 🛡${Math.round(safety)}`)
    this.playerLabel.setPosition(px, py-22)
  }

  // ── Player stats tick ────────────────────────────────────────────────────

  private _statTick(){
    if (!this.running) return
    const delta = STAT_DELTA[this.currentRegion]
    const s = this.playerStats
    s.energy    = clamp((s.energy    ?? 80) + (delta?.energy    ?? 0), 0, 100)
    s.hunger    = clamp((s.hunger    ?? 75) + (delta?.hunger    ?? 0), 0, 100)
    s.thirst    = clamp((s.thirst    ?? 80) + (delta?.thirst    ?? 0), 0, 100)
    s.safety    = clamp((s.safety    ?? 85) + (delta?.safety    ?? 0), 0, 100)
    s.happiness = clamp((s.energy + s.hunger + s.thirst + s.safety) / 4, 0, 100)
    s.currentRegion = this.currentRegion
    this.playerStats = { ...s }
    // Push to store for Dashboard
    useWorldStore.getState().setPlayer(this.playerStats)
  }

  // ── Player movement decision ──────────────────────────────────────────────

  private _decideMove(){
    if (!this.running || this.playerStats.isMoving) return
    const { energy, hunger, thirst, safety } = this.playerStats
    const min = Math.min(energy, hunger, thirst, safety)
    let target = this.currentRegion

    if (safety < 30)         target = Math.random()>0.5 ? 'WATERFRONT' : 'HILLY_SUBURBS'
    else if (min === energy && energy < 40)  target = 'CBD_CORE'
    else if (min === hunger && hunger < 40)  target = 'INDUSTRIAL'
    else if (min === thirst && thirst < 40)  target = 'WATERFRONT'
    else {
      const others = Object.keys(LAYOUTS).filter(r=>r!==this.currentRegion)
      target = others[Math.floor(Math.random()*others.length)]
    }

    if (target !== this.currentRegion) this._movePlayerTo(target)
  }

  private _movePlayerTo(regionId: string){
    const { width, height } = this.scale
    const dest = this._center(regionId, width, height)
    this.playerStats.isMoving = true
    useWorldStore.getState().setPlayer({ isMoving: true, currentRegion: regionId })

    this.tweens.add({
      targets: this,
      playerX: dest.x,
      playerY: dest.y,
      duration: 1400 + Math.random()*600,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.currentRegion = regionId
        this.playerStats.isMoving = false
        useWorldStore.getState().setPlayer({ isMoving: false, currentRegion: regionId })
      },
    })
  }

  // ── Region info update ───────────────────────────────────────────────────

  private _applyRegions(regions: RegionState[]){
    for (const r of regions){
      const badge = this.regionBadges.get(r.id)
      if (badge) badge.setText(`⚠ ${Math.round(r.crime_rate*100)}% crime · ${r.last_action}`)
    }
  }

  // ── Resize ───────────────────────────────────────────────────────────────

  private _onResize(W:number, H:number){
    this.staticGfx.clear()
    this.regionLabels.forEach(l=>l.destroy()); this.regionLabels.clear()
    this.regionBadges.forEach(b=>b.destroy()); this.regionBadges.clear()
    this._drawWorld(W, H)
    this._initSmoke(W, H)
    const pos = this._center(this.currentRegion, W, H)
    this.playerX = pos.x; this.playerY = pos.y
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _center(id:string, W:number, H:number){ const l=LAYOUTS[id]; return { x:(l.fx+l.fw/2)*W, y:(l.fy+l.fh/2)*H } }
}
