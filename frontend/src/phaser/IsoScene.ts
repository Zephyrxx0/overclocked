/**
 * IsoScene.ts — WorldSim 2.0  •  Isometric Voxel Renderer
 *
 * True 2D isometric projection (no Three.js). Each region is a cluster of
 * drawn iso-blocks (top + left + right faces) forming biome-themed structures:
 *
 *  AQUILONIA  — Prismarine Ocean Monument (blue/cyan deep-water blocks)
 *  VERDANTIS  — Farmland + Dark Oak Village (green/brown farm structures)
 *  IGNIS CORE — Magma + Iron Factory (orange/grey chimney stacks)
 *  TERRANOVA  — Cobblestone Mountain Outpost (grey stone fortifications)
 *  THE NEXUS  — Quartz + Gold Trade HQ (white/gold multi-story hub)
 *
 * Dynamic effects:
 *  • Trade  → glowing particle "minecart" trails along beam paths
 *  • Conflict → TNT flash + debris particles at target border
 *  • Drought  → affected tiles shift sandy-brown
 *  • Blight   → purple mycelium overlay on farmland tiles
 *  • Crime Pulse → red iso-ring around hot regions
 */
import Phaser from 'phaser'
import { RegionState, ClimateEvent, useWorldStore } from '../store/useWorldStore'

// ─── Isometric math ───────────────────────────────────────────────────────────
const TW = 36   // tile width  (2:1 ratio)
const TH = 18   // tile height

function isoToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TW / 2),
    y: (col + row) * (TH / 2),
  }
}

// Draw one iso block (top + left + right face)
function drawBlock(g: Phaser.GameObjects.Graphics, cx: number, cy: number,
  topCol: number, leftCol: number, rightCol: number, alpha = 1) {
  const hw = TW / 2, hh = TH / 2
  // top face (diamond)
  g.fillStyle(topCol, alpha)
  g.fillTriangle(cx, cy - hh, cx + hw, cy, cx, cy + hh)
  g.fillTriangle(cx, cy - hh, cx - hw, cy, cx, cy + hh)
  // left face
  g.fillStyle(leftCol, alpha)
  g.fillTriangle(cx - hw, cy, cx, cy + hh, cx, cy + hh + TH)
  g.fillTriangle(cx - hw, cy, cx - hw, cy + TH, cx, cy + hh + TH)
  // right face
  g.fillStyle(rightCol, alpha)
  g.fillTriangle(cx + hw, cy, cx, cy + hh, cx, cy + hh + TH)
  g.fillTriangle(cx + hw, cy, cx + hw, cy + TH, cx, cy + hh + TH)
}

function drawIsoOutline(g: Phaser.GameObjects.Graphics, cx: number, cy: number, col: number, alpha: number) {
  const hw = TW / 2, hh = TH / 2
  g.lineStyle(1, col, alpha)
  g.strokeTriangle(cx, cy - hh, cx + hw, cy, cx, cy + hh)
  g.strokeTriangle(cx, cy - hh, cx - hw, cy, cx, cy + hh)
}

// ─── Biome palettes ───────────────────────────────────────────────────────────
interface Palette { top: number; left: number; right: number; accent: number }

const BIOMES: Record<string, Palette[]> = {
  AQUILONIA: [
    { top:0x1a6b8a, left:0x0d3d52, right:0x0a2e3e, accent:0x2aafcc }, // prismarine
    { top:0x115577, left:0x0a3344, right:0x06222e, accent:0x1a8aaa }, // dark prismarine
    { top:0x22ddee, left:0x0a8899, right:0x066677, accent:0x55ffee }, // sea lantern glow
  ],
  VERDANTIS: [
    { top:0x5a8a3a, left:0x3d5c27, right:0x2e4420, accent:0x7acc55 }, // grass
    { top:0x7c5c38, left:0x4a3822, right:0x362a18, accent:0xa07848 }, // farmland / dirt
    { top:0x2a4a1a, left:0x1a3010, right:0x10200a, accent:0x4a8a2a }, // dark oak
  ],
  IGNIS_CORE: [
    { top:0xcc4400, left:0x882200, right:0x661800, accent:0xff7722 }, // magma
    { top:0x888888, left:0x555555, right:0x3a3a3a, accent:0xbbbbbb }, // iron
    { top:0xdd6600, left:0x994400, right:0x663300, accent:0xff9944 }, // hot stone
  ],
  TERRANOVA: [
    { top:0x7a7a7a, left:0x4a4a4a, right:0x303030, accent:0xaaaaaa }, // stone
    { top:0x606060, left:0x3a3a3a, right:0x252525, accent:0x909090 }, // cobblestone
    { top:0x5a4a3a, left:0x3a2e26, right:0x28201c, accent:0x8a7a6a }, // gravel
  ],
  THE_NEXUS: [
    { top:0xeeeeee, left:0xaaaaaa, right:0x888888, accent:0xffffff }, // quartz
    { top:0xddcc44, left:0xaa8822, right:0x886611, accent:0xffee66 }, // gold
    { top:0xccddee, left:0x8899aa, right:0x667788, accent:0xddeeff }, // quartz pillar
  ],
}

// ─── Region cluster definitions ───────────────────────────────────────────────
// Each entry: [col, row, paletteIndex, heightStacks]
type BlockDef = [number, number, number, number]

const CLUSTERS: Record<string, BlockDef[]> = {
  AQUILONIA: [
    // Ocean Monument base
    [-2,0,0,1],[-1,0,0,2],[0,0,2,3],[1,0,0,2],[2,0,0,1],
    [-2,1,0,1],[-1,1,1,2],[0,1,0,4],[1,1,1,2],[2,1,0,1],
    [-1,2,0,1],[0,2,2,2],[1,2,0,1],
    [0,3,2,1],
    // Side towers
    [-3,-1,1,3],[3,-1,1,3],[-3,2,1,2],[3,2,1,2],
  ],
  VERDANTIS: [
    // Farm field base
    [-2,0,1,1],[-1,0,1,1],[0,0,1,1],[1,0,1,1],[2,0,1,1],
    [-2,1,0,1],[-1,1,0,1],[0,1,0,1],[1,1,0,1],[2,1,0,1],
    [-2,2,1,1],[-1,2,1,1],[0,2,1,1],[1,2,1,1],[2,2,1,1],
    // Farmhouse
    [-1,-1,2,2],[0,-1,2,3],[1,-1,2,2],
    // Spruce trees
    [-3,0,2,3],[-3,1,2,2],[3,0,2,3],[3,2,2,2],
  ],
  IGNIS_CORE: [
    // Factory floor
    [-2,0,2,1],[-1,0,0,1],[0,0,0,1],[1,0,2,1],[2,0,0,1],
    [-2,1,0,1],[-1,1,0,1],[0,1,0,1],[1,1,0,1],[2,1,0,1],
    [0,2,0,1],[1,2,0,1],
    // Chimneys (tall stacks)
    [-1,-1,1,5],[0,-1,1,7],[1,-1,1,5],
    [-2,-1,2,3],[2,-1,2,3],
    // Industrial shed
    [-2,0,1,2],[2,0,1,2],
  ],
  TERRANOVA: [
    // Mountain base
    [-1,1,0,1],[0,1,1,2],[1,1,0,1],
    [-2,0,1,1],[-1,0,0,3],[0,0,0,5],[1,0,1,3],[2,0,0,1],
    [-2,-1,0,2],[-1,-1,1,4],[0,-1,0,6],[1,-1,0,4],[2,-1,1,2],
    [-1,-2,0,3],[0,-2,1,5],[1,-2,0,3],
    [0,-3,0,4],
    // Outpost walls
    [-3,0,1,2],[3,0,1,2],[-3,-1,0,3],[3,-1,0,3],
  ],
  THE_NEXUS: [
    // Trade hub foundation
    [-2,0,0,1],[-1,0,2,2],[0,0,0,1],[1,0,2,2],[2,0,0,1],
    [-1,1,0,1],[0,1,1,2],[1,1,0,1],
    // Main tower
    [-1,-1,2,3],[0,-1,0,6],[1,-1,2,3],
    [0,-2,0,4],[-1,-2,2,2],[1,-2,2,2],
    [0,-3,1,5],[0,-4,2,3],
    // Gold pillars
    [-2,-1,1,4],[2,-1,1,4],[-2,-2,1,2],[2,-2,1,2],
  ],
}

// ─── Layout: where each region cluster is centered on screen ─────────────────
interface NLayout { fx:number; fy:number; fw:number; fh:number; border:number; labelCol:string }

const LAYOUTS: Record<string, NLayout> = {
  AQUILONIA:  { fx:0.01, fy:0.02, fw:0.32, fh:0.44, border:0x2aafcc, labelCol:'#7bddef' },
  VERDANTIS:  { fx:0.67, fy:0.02, fw:0.32, fh:0.44, border:0x7acc55, labelCol:'#9dff77' },
  IGNIS_CORE: { fx:0.34, fy:0.26, fw:0.32, fh:0.44, border:0xff7722, labelCol:'#ff9a7a' },
  TERRANOVA:  { fx:0.01, fy:0.53, fw:0.32, fh:0.44, border:0xaaaaaa, labelCol:'#cccccc' },
  THE_NEXUS:  { fx:0.67, fy:0.53, fw:0.32, fh:0.44, border:0xffee66, labelCol:'#ffee99' },
}

const NATION_HEADER: Record<string, { line1:string; line2:string; line3:string }> = {
  AQUILONIA:  { line1:'💧 THE HOARDER',      line2:'Water Dominance',   line3:'Hoard & Defend'    },
  VERDANTIS:  { line1:'🌾 THE SUSTAINIST',   line2:'Food Surplus',      line3:'Balance All 4'     },
  IGNIS_CORE: { line1:'⚡ THE INDUSTRIALIST',line2:'Energy Powerhouse', line3:'Expand & Burn'     },
  TERRANOVA:  { line1:'🪨 THE OPPORTUNIST',  line2:'Vast Landmass',     line3:'Conflict & Steal'  },
  THE_NEXUS:  { line1:'⚖️ THE INTEGRATOR',  line2:'Balanced Hub',      line3:'Trade & Stability' },
}

const PRESIDENT_NAMES: Record<string, string> = {
  AQUILONIA:'The_Hoarder', VERDANTIS:'The_Sustainist', IGNIS_CORE:'The_Industrialist', TERRANOVA:'The_Opportunist', THE_NEXUS:'The_Integrator',
}

const RES_KEYS  = ['water','food','energy','land'] as const
const RES_LABEL = ['💧W','🌾F','⚡E','🏔L']
const RES_COLS  = [0x2aafcc, 0x7acc55, 0xff7722, 0xaaaaaa]
const RES_STR   = ['#2aafcc','#7acc55','#ff7722','#cccccc']

// ─── Particle types ───────────────────────────────────────────────────────────
interface Particle { x:number; y:number; vx:number; vy:number; alpha:number; r:number; color:number; life:number; square?:boolean }

function seededRand(n:number){ const x=Math.sin(n+13)*92834.5; return x-Math.floor(x) }
function lerp(a:number,b:number,t:number){ return a+(b-a)*t }
function clamp(v:number,mn:number,mx:number){ return Math.max(mn,Math.min(mx,v)) }
function hash(s:string){ let h=0; for(let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0; return Math.abs(h)%100 }

export class IsoScene extends Phaser.Scene {
  private bgGfx!:        Phaser.GameObjects.Graphics  // static voxel scene
  private clusterGfx!:   Phaser.GameObjects.Graphics  // animated cluster overlays (drought/blight)
  private beamGfx!:      Phaser.GameObjects.Graphics  // trade beams + conflict
  private particleGfx!:  Phaser.GameObjects.Graphics  // particles (TNT, minecart, weather)
  private resBarGfx!:    Phaser.GameObjects.Graphics  // resource bars
  private overlayGfx!:   Phaser.GameObjects.Graphics  // crime halos, dominance rings
  private climateGfx!:   Phaser.GameObjects.Graphics  // climate calamity panel (no-man's-land)

  private nameLine1:    Map<string,Phaser.GameObjects.Text> = new Map()
  private nameLine2:    Map<string,Phaser.GameObjects.Text> = new Map()
  private nameLine3:    Map<string,Phaser.GameObjects.Text> = new Map()
  private presLabels:   Map<string,Phaser.GameObjects.Text> = new Map()
  private crimeLabels:  Map<string,Phaser.GameObjects.Text> = new Map()
  private actionLabels: Map<string,Phaser.GameObjects.Text> = new Map()
  private resIconLbls:  Map<string,Phaser.GameObjects.Text> = new Map()
  private resPctLbls:   Map<string,Phaser.GameObjects.Text> = new Map()

  // Climate panel texts (in no-man's-land)
  private climateIcon!:   Phaser.GameObjects.Text
  private climateName!:   Phaser.GameObjects.Text
  private climateDesc!:   Phaser.GameObjects.Text
  private climateSub!:    Phaser.GameObjects.Text
  private climateTicks!:  Phaser.GameObjects.Text

  private phase   = 0
  private regions: RegionState[] = []
  private climate: ClimateEvent  = { type:null, duration_remaining:0 }
  private particles: Particle[]  = []
  private running = true
  private tntTargets: Record<string,number> = {}  // region -> tnt flash ticks remaining
  private _unsub: (()=>void)|null = null
  private beamAlphas: Record<string,number> = {}

  constructor(){ super({ key:'IsoScene' }) }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(){
    const { width:W, height:H } = this.scale
    this.bgGfx       = this.add.graphics()
    this.clusterGfx  = this.add.graphics()
    this.beamGfx     = this.add.graphics()
    this.particleGfx = this.add.graphics()
    this.resBarGfx   = this.add.graphics()
    this.overlayGfx  = this.add.graphics()
    this.climateGfx  = this.add.graphics()
    this._drawVoxelScene(W, H)
    this._createLabels(W, H)
    this._createClimatePanel(W, H)
    this.scale.on('resize', (_:unknown, gs:Phaser.Structs.Size) => this._onResize(gs.width, gs.height))
    this._unsub = useWorldStore.subscribe(s => { this.regions=s.regions; this.climate=s.climateEvent })
  }

  update(_t:number, delta:number){
    this.phase += delta*0.001
    const { width:W, height:H } = this.scale
    if(!this.running){
      [this.clusterGfx,this.beamGfx,this.particleGfx,this.resBarGfx,this.overlayGfx].forEach(g=>g.clear())
      return
    }
    this._drawClusterOverlays(W,H)
    this._drawBeamsAndConflict(W,H,delta)
    this._updateParticles(W,H,delta)
    this._drawResourceBars(W,H)
    this._drawOverlays(W,H)
    this._updateLabels(W,H)
    this._drawClimatePanel(W,H)
  }

  shutdown(){ this._unsub?.(); this._unsub=null }
  setRunning(r:boolean){ this.running=r }
  applyWorldState(r:RegionState[]){ this.regions=r }

  // ── Static Voxel Scene ─────────────────────────────────────────────────────

  private _drawVoxelScene(W:number, H:number){
    const g = this.bgGfx; g.clear()
    // Void background — deep dark like Minecraft underground
    g.fillGradientStyle(0x050810,0x050810,0x080510,0x080510,1)
    g.fillRect(0,0,W,H)
    // Pixel star field
    for(let i=0;i<100;i++){
      g.fillStyle(0xffffff, 0.15+seededRand(i*7)*0.4)
      g.fillRect(Math.floor(seededRand(i*3.7)*W), Math.floor(seededRand(i*2.9)*H), 1, 1)
    }
    // Ground plane grid (isometric)
    this._drawGroundPlane(g,W,H)
    // Draw region tile areas
    for(const id of Object.keys(LAYOUTS)) this._drawRegionArea(id,g,W,H)
    // Draw voxel clusters for each region
    for(const id of Object.keys(LAYOUTS)) this._drawCluster(id,g,W,H)
  }

  private _drawGroundPlane(g:Phaser.GameObjects.Graphics, W:number, H:number){
    g.lineStyle(1,0x1a2030,0.4)
    // Horizontal iso lines
    for(let row=-2;row<12;row++){
      const p1=isoToScreen(-6,row), p2=isoToScreen(6,row)
      g.lineBetween(W/2+p1.x,H/2+p1.y,W/2+p2.x,H/2+p2.y)
    }
    // Vertical iso lines
    for(let col=-6;col<=6;col++){
      const p1=isoToScreen(col,-2), p2=isoToScreen(col,11)
      g.lineBetween(W/2+p1.x,H/2+p1.y,W/2+p2.x,H/2+p2.y)
    }
  }

  private _drawRegionArea(id:string, g:Phaser.GameObjects.Graphics, W:number, H:number){
    const l=LAYOUTS[id]
    const x=l.fx*W, y=l.fy*H, w=l.fw*W, h=l.fh*H
    // Dark area tile frame
    g.fillStyle(0x050a12,0.65); g.fillRect(x,y,w,h)
    g.lineStyle(2,l.border,0.7); g.strokeRect(x,y,w,h)
    g.lineStyle(6,l.border,0.1); g.strokeRect(x-3,y-3,w+6,h+6)
    // Inner checkerboard hint (iso floor)
    for(let row=0;row<3;row++){
      for(let col=0;col<4;col++){
        if((col+row)%2===0){
          g.fillStyle(0x0a101e,0.4)
          g.fillRect(x+col*(w/4),y+h*0.55+row*(h*0.15),w/4,h*0.15)
        }
      }
    }
  }

  private _drawCluster(id:string, g:Phaser.GameObjects.Graphics, W:number, H:number){
    const l=LAYOUTS[id]
    const cx=(l.fx+l.fw/2)*W, cy=(l.fy+l.fh*0.52)*H
    const palette=BIOMES[id]
    const blocks=CLUSTERS[id]

    // Sort back-to-front (painter's algorithm for isometric)
    const sorted=[...blocks].sort(([c1,r1],[c2,r2])=>(c1+r1)-(c2+r2))

    for(const [col,row,palIdx,stacks] of sorted){
      const pal=palette[palIdx%palette.length]
      const iso=isoToScreen(col,row)
      const bx=cx+iso.x, by=cy+iso.y

      for(let s=0;s<stacks;s++){
        const stackOff=s*TH
        const dimFactor=1-s*0.07
        const top  =this._dimColor(pal.top,dimFactor)
        const left =this._dimColor(pal.left,dimFactor)
        const right=this._dimColor(pal.right,dimFactor)
        drawBlock(g, bx, by-stackOff, top, left, right)
      }
      // Block edge lines (pixel art crispness)
      drawIsoOutline(g, bx, by-((stacks-1)*TH), pal.accent, 0.3)
    }
  }

  private _dimColor(col:number, factor:number):number {
    const r=Math.floor(((col>>16)&0xff)*factor)
    const gv=Math.floor(((col>>8)&0xff)*factor)
    const b=Math.floor((col&0xff)*factor)
    return (r<<16)|(gv<<8)|b
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  private _createLabels(W:number, H:number){
    const RES = window.devicePixelRatio || 1
    const FONT = '"Press Start 2P",monospace'
    for(const id of Object.keys(LAYOUTS)){
      const l=LAYOUTS[id], nh=NATION_HEADER[id]
      const cx=(l.fx+l.fw/2)*W, ty=l.fy*H

      this.nameLine1.set(id, this.add.text(cx,ty+8,nh.line1,
        {fontSize:'11px',fontFamily:FONT,color:l.labelCol,stroke:'#000',strokeThickness:3,resolution:RES}
      ).setOrigin(0.5,0).setDepth(50))

      this.nameLine2.set(id, this.add.text(cx,ty+26,nh.line2,
        {fontSize:'8px',fontFamily:FONT,color:l.labelCol,stroke:'#000',strokeThickness:2,resolution:RES}
      ).setOrigin(0.5,0).setDepth(50))

      this.nameLine3.set(id, this.add.text(cx,ty+40,nh.line3,
        {fontSize:'8px',fontFamily:FONT,color:'#778899',stroke:'#000',strokeThickness:2,resolution:RES}
      ).setOrigin(0.5,0).setDepth(50))

      this.presLabels.set(id, this.add.text(cx,ty+54,PRESIDENT_NAMES[id]??'',
        {fontSize:'8px',fontFamily:FONT,color:'#556677',stroke:'#000',strokeThickness:2,resolution:RES}
      ).setOrigin(0.5,0).setDepth(50))

      this.crimeLabels.set(id, this.add.text(cx,ty+68,'',
        {fontSize:'8px',fontFamily:FONT,color:'#ff5544',stroke:'#000',strokeThickness:2,resolution:RES}
      ).setOrigin(0.5,0).setDepth(50))

      this.actionLabels.set(id, this.add.text(cx,ty+l.fh*H-8,'',
        {fontSize:'9px',fontFamily:FONT,color:'#ffdd44',stroke:'#000',strokeThickness:3,resolution:RES}
      ).setOrigin(0.5,1).setDepth(50))

      for(let i=0;i<4;i++){
        this.resIconLbls.set(`${id}_${i}`, this.add.text(0,0,RES_LABEL[i],
          {fontSize:'8px',fontFamily:FONT,color:RES_STR[i],stroke:'#000',strokeThickness:2,resolution:RES}
        ).setOrigin(0,0.5).setDepth(55))
        this.resPctLbls.set(`${id}_${i}`, this.add.text(0,0,'0%',
          {fontSize:'8px',fontFamily:FONT,color:RES_STR[i],stroke:'#000',strokeThickness:2,resolution:RES}
        ).setOrigin(1,0.5).setDepth(55))
      }
    }
  }

  private _updateLabels(W:number, H:number){
    for(const r of this.regions){
      const l=LAYOUTS[r.id]; if(!l) continue
      const cx=(l.fx+l.fw/2)*W, ty=l.fy*H, th=l.fh*H

      this.nameLine1.get(r.id)?.setPosition(cx,ty+8)
      this.nameLine2.get(r.id)?.setPosition(cx,ty+24)
      this.nameLine3.get(r.id)?.setPosition(cx,ty+36)
      this.presLabels.get(r.id)?.setPosition(cx,ty+50)
      this.crimeLabels.get(r.id)?.setPosition(cx,ty+62)
      this.actionLabels.get(r.id)?.setPosition(cx,ty+th-8)

      const cl=this.crimeLabels.get(r.id)
      if(cl){
        cl.setText(`⚠ ${Math.round(r.crime_rate*100)}%  👥${(r.population/1e6).toFixed(1)}M`)
        cl.setColor(r.crime_rate>0.65?'#ff3322':r.crime_rate>0.4?'#ffaa33':'#55cc55')
      }
      const al=this.actionLabels.get(r.id)
      if(al){
        const ic:Record<string,string>={Conserve:'[DEF]',Trade:'[TRD]',Expand:'[EXP]',Conflict:'[WAR]'}
        al.setText(ic[r.last_action]??r.last_action)
        al.setColor({Conserve:'#44aaff',Trade:'#44ee88',Expand:'#ffcc44',Conflict:'#ff4444'}[r.last_action]??'#fff')
      }

      // Resource bar label positions
      const BAR_H=6,BAR_GAP=5,ICON_W=26,VAL_W=22
      const totalH=4*(BAR_H+BAR_GAP)
      const startY=ty+th-totalH-10
      const bX=l.fx*W+8+ICON_W, bW=l.fw*W-16-ICON_W-VAL_W
      for(let i=0;i<4;i++){
        const byC=startY+i*(BAR_H+BAR_GAP)+BAR_H/2
        this.resIconLbls.get(`${r.id}_${i}`)?.setPosition(l.fx*W+8,byC)
        const val=r.resources[RES_KEYS[i]], pct=Math.round(val*100)
        const vl=this.resPctLbls.get(`${r.id}_${i}`)
        if(vl){ vl.setPosition(l.fx*W+l.fw*W-8,byC); vl.setText(`${pct}%`); vl.setColor(val<0.25?'#ff3322':val>0.75?'#aaffcc':RES_STR[i]) }
      }
    }
  }

  // ── Cluster Dynamic Overlays (Drought/Blight) ──────────────────────────────

  private _drawClusterOverlays(W:number, H:number){
    const g=this.clusterGfx; g.clear()
    const ct=this.climate?.type
    if(!ct) return
    for(const id of Object.keys(LAYOUTS)){
      const l=LAYOUTS[id]
      const cx=(l.fx+l.fw/2)*W, cy=(l.fy+l.fh*0.52)*H
      if(ct==='Drought'){
        // Sandy brown overlay on ground blocks
        for(const [col,row,,stacks] of CLUSTERS[id]){
          const iso=isoToScreen(col,row)
          const bx=cx+iso.x, by=cy+iso.y-(stacks-1)*TH
          const pulse=0.25+0.15*Math.sin(this.phase*2+hash(id))
          drawBlock(g,bx,by,0xcc8833,0x8a5522,0x663311,pulse)
        }
      } else if(ct==='Blight' && id==='VERDANTIS'){
        // Purple mycelium overlay on farmland
        for(const [col,row,,stacks] of CLUSTERS[id]){
          const iso=isoToScreen(col,row)
          const bx=cx+iso.x, by=cy+iso.y-(stacks-1)*TH
          const pulse=0.3+0.15*Math.sin(this.phase*1.5+hash(id))
          drawBlock(g,bx,by,0x883399,0x551166,0x330044,pulse)
        }
      } else if(ct==='SolarFlare'){
        // Warm shimmer on ignis
        const flare=0.1+0.08*Math.sin(this.phase*3)
        g.fillStyle(0xffaa22,flare); g.fillRect(l.fx*W,l.fy*H,l.fw*W,l.fh*H)
      }
    }
  }

  // ── Trade Beams & Conflict TNT ─────────────────────────────────────────────

  private _drawBeamsAndConflict(W:number, H:number, delta:number){
    const g=this.beamGfx; g.clear()
    if(!this.regions.length) return

    const tradeSet=new Set(this.regions.filter(r=>r.last_action==='Trade').map(r=>r.id))
    const conflictSet=new Set(this.regions.filter(r=>r.last_action==='Conflict').map(r=>r.id))

    const PAIRS:[string,string][]=[
      ['AQUILONIA','IGNIS_CORE'],['VERDANTIS','IGNIS_CORE'],
      ['IGNIS_CORE','TERRANOVA'],['IGNIS_CORE','THE_NEXUS'],
      ['AQUILONIA','TERRANOVA'],['VERDANTIS','THE_NEXUS'],
    ]

    for(const [a,b] of PAIRS){
      const key=`${a}-${b}`
      const trading=tradeSet.has(a)||tradeSet.has(b)
      this.beamAlphas[key]=clamp((this.beamAlphas[key]??0)+(trading?0.07:-0.04),0,1)
      const alpha=this.beamAlphas[key]; if(alpha<0.02) continue

      const ca=this._regionCenter(a,W,H), cb=this._regionCenter(b,W,H)

      // Resource color: pick the most abundant resource of whichever nation is trading
      // This reflects the resource being offered/shared across the beam
      const traderA = this.regions.find(r=>r.id===a)
      const traderB = this.regions.find(r=>r.id===b)
      const maxRes = (r: RegionState|undefined): {idx:number; val:number} => {
        if(!r) return {idx:0,val:0}
        const vals = [r.resources.water, r.resources.food, r.resources.energy, r.resources.land]
        const mx   = Math.max(...vals)
        return {idx:vals.indexOf(mx), val:mx}
      }
      const resA=maxRes(traderA), resB=maxRes(traderB)
      // Prefer the trading nation's resource; fallback to first
      const beamResIdx = tradeSet.has(a) ? resA.idx : resB.idx
      const beamColHex = RES_COLS[beamResIdx]   // e.g. 0x2aafcc for water
      const beamColStr = RES_STR[beamResIdx]    // e.g. '#2aafcc'

      // Beam — wide glow + thin bright core in resource color
      g.lineStyle(10, beamColHex, alpha*0.07); g.lineBetween(ca.x,ca.y,cb.x,cb.y)
      g.lineStyle(3,  beamColHex, alpha*0.35); g.lineBetween(ca.x,ca.y,cb.x,cb.y)
      g.lineStyle(1,  beamColHex, alpha*0.95); g.lineBetween(ca.x,ca.y,cb.x,cb.y)

      // Voxel minecart squares in resource color, travelling along beam
      for(let si=0;si<4;si++){
        const t=((this.phase*0.5+si/4)%1)
        const mx=lerp(ca.x,cb.x,t), my=lerp(ca.y,cb.y,t)
        g.fillStyle(beamColHex,alpha*0.85); g.fillRect(mx-4,my-3,8,5)
        g.lineStyle(1,0xffffff,alpha*0.5); g.strokeRect(mx-4,my-3,8,5)
        // Wheels
        g.fillStyle(0xffffff,alpha*0.7); g.fillRect(mx-2,my+2,3,2); g.fillRect(mx+1,my+2,3,2)
      }
      void beamColStr  // suppress unused warning if needed
    }

    // TNT conflict flash on targets
    for(const id of conflictSet){
      const l=LAYOUTS[id]
      // Trigger TNT if not already active
      if(!this.tntTargets[id]) this.tntTargets[id]=8
    }

    for(const [id,remaining] of Object.entries(this.tntTargets)){
      if(remaining<=0){ delete this.tntTargets[id]; continue }
      const l=LAYOUTS[id]
      const cx=(l.fx+l.fw/2)*W, cy=(l.fy+l.fh/2)*H
      const flash=(remaining%2===0)?0.5:0.0
      g.fillStyle(0xff3300,flash); g.fillRect(l.fx*W,l.fy*H,l.fw*W,l.fh*H)
      // TNT debris blocks
      for(let d=0;d<8;d++){
        const ang=(d/8)*Math.PI*2+(this.phase*4)
        const dist=(8-remaining)*12
        g.fillStyle(0xff4422,0.7); g.fillRect(cx+Math.cos(ang)*dist-3,cy+Math.sin(ang)*dist-3,6,6)
        g.fillStyle(0xffaa44,0.5); g.fillRect(cx+Math.cos(ang)*dist-1,cy+Math.sin(ang)*dist-1,2,2)
      }
      this.tntTargets[id]=remaining-1
      // Spawn explosion particles
      if(remaining===8) this._spawnExplosion(cx,cy)
    }

    // Decrement tnt each frame
    void delta
  }

  private _spawnExplosion(cx:number, cy:number){
    for(let i=0;i<20;i++){
      const ang=Math.random()*Math.PI*2
      const spd=1.5+Math.random()*3
      this.particles.push({
        x:cx,y:cy,
        vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
        alpha:0.9,r:3+Math.random()*3,
        color:[0xff4422,0xff8833,0xffcc44,0x884422][Math.floor(Math.random()*4)],
        life:30+Math.random()*20, square:true,
      })
    }
  }

  // ── Particle System ───────────────────────────────────────────────────────

  private _updateParticles(W:number, H:number, delta:number){
    const g=this.particleGfx; g.clear()
    const ct=this.climate?.type

    // Climate weather particles
    if(ct&&this.particles.filter(p=>!p.square).length<120){
      const count=ct==='Drought'?2:ct==='SolarFlare'?3:2
      for(let i=0;i<count;i++) this._spawnWeatherParticle(ct,W,H)
    }

    this.particles=this.particles.filter(p=>p.life>0)
    for(const p of this.particles){
      p.x+=p.vx*(delta*0.06); p.y+=p.vy*(delta*0.06)
      p.alpha-=0.003+(p.square?0.012:0); p.life-=delta*0.06*1.5
      const a=Math.max(0,p.alpha)
      g.fillStyle(p.color,a)
      if(p.square) g.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2)
      else         g.fillCircle(p.x,p.y,p.r)
    }
    if(!ct) this.particles=this.particles.filter(p=>p.square&&p.life>0 || p.life>0&&p.life<20)

    // Global climate overlays
    if(ct==='SolarFlare'){ g.fillStyle(0xffdd44,0.04+0.03*Math.sin(this.phase*4)); g.fillRect(0,0,W,H) }
    if(ct==='Drought')   { g.fillStyle(0xcc7722,0.05+0.02*Math.sin(this.phase*2)); g.fillRect(0,0,W,H) }
    if(ct==='Blight')    { g.fillStyle(0x441166,0.06+0.02*Math.sin(this.phase*1.5)); g.fillRect(0,0,W,H) }
  }

  private _spawnWeatherParticle(type:string, W:number, H:number){
    const x=Math.random()*W
    this.particles.push(type==='Drought'
      ? {x,y:Math.random()*H*0.5, vx:2+Math.random()*1.5,vy:0.3+Math.random()*0.5,alpha:0.5,r:2,color:0xcc8833,life:80+Math.random()*60}
      : type==='SolarFlare'
      ? {x,y:-4, vx:(Math.random()-0.5)*1.5,vy:2+Math.random()*2,alpha:0.7,r:2,color:0xffee88,life:50+Math.random()*40}
      : {x,y:-4, vx:(Math.random()-0.5)*0.8,vy:1.2+Math.random()*1.5,alpha:0.5,r:3,color:0x882299,life:90+Math.random()*50,square:true}
    )
  }

  // ── Resource Bars ──────────────────────────────────────────────────────────

  private _drawResourceBars(W:number, H:number){
    const g=this.resBarGfx; g.clear()
    if(!this.regions.length) return

    for(const r of this.regions){
      const l=LAYOUTS[r.id]; if(!l) continue
      const tx=l.fx*W, ty=l.fy*H, tw=l.fw*W, th=l.fh*H
      const BAR_H=6,BAR_GAP=5,ICON_W=26,VAL_W=22
      const totalH=4*(BAR_H+BAR_GAP)
      const startY=ty+th-totalH-10
      const barX=tx+8+ICON_W, barW=tw-16-ICON_W-VAL_W

      // Minecraft inventory-style panel background
      g.fillStyle(0x373737,0.9); g.fillRect(tx+4,startY-5,tw-8,totalH+10)
      g.lineStyle(2,0x1a1a1a,1); g.strokeRect(tx+4,startY-5,tw-8,totalH+10)
      g.lineStyle(1,0x555555,0.8); g.strokeRect(tx+5,startY-4,tw-10,totalH+8)

      for(let i=0;i<4;i++){
        const by=startY+i*(BAR_H+BAR_GAP)
        const val=r.resources[RES_KEYS[i]]
        const fillW=Math.max(0,val*barW)
        const fillCol=val<0.25?0xff2200:val<0.4?0xcc5500:RES_COLS[i]

        // Slot background (mc-slot style)
        g.fillStyle(0x8b8b8b,0.4); g.fillRect(barX,by,barW,BAR_H)
        g.lineStyle(1,0x373737,0.8); g.strokeRect(barX,by,barW,BAR_H)

        // Fill (segmented pixel art look)
        if(fillW>0){
          g.fillStyle(fillCol,0.95); g.fillRect(barX,by,fillW,BAR_H)
          // Pixel highlight top
          g.fillStyle(0xffffff,0.15); g.fillRect(barX,by,fillW,2)
        }
        // Critical warning
        if(val<0.22){
          g.lineStyle(1,0xff2200,0.5+0.5*Math.sin(this.phase*8))
          g.strokeRect(barX-1,by-1,barW+2,BAR_H+2)
        }
        // Abundance glow
        if(val>0.75){
          g.lineStyle(1,RES_COLS[i],0.35); g.strokeRect(barX,by,fillW,BAR_H)
        }
      }
    }
  }

  // ── Crime Halos & Dominance Rings ─────────────────────────────────────────

  private _drawOverlays(W:number, H:number){
    const g=this.overlayGfx; g.clear()
    for(const r of this.regions){
      const l=LAYOUTS[r.id]; if(!l) continue
      const cx=(l.fx+l.fw/2)*W, cy=(l.fy+l.fh/2)*H

      // Crime: red square "danger zone" around region
      if(r.crime_rate>0.45){
        const intensity=clamp((r.crime_rate-0.45)/0.55,0,1)
        const pulse=0.4+0.6*Math.abs(Math.sin(this.phase*3+hash(r.id)))
        const sz=30+intensity*50+pulse*15
        g.lineStyle(3,0xff2200,intensity*pulse*0.7); g.strokeRect(cx-sz,cy-sz,sz*2,sz*2)
        g.fillStyle(0xff2200,intensity*pulse*0.06); g.fillRect(cx-sz,cy-sz,sz*2,sz*2)
      }

      // Dominance: signature resource glow
      const SIG: Record<string,{k:keyof RegionState['resources'];col:number;th:number}> = {
        AQUILONIA:{k:'water',col:0x2aafcc,th:0.65},VERDANTIS:{k:'food',col:0x7acc55,th:0.65},
        IGNIS_CORE:{k:'energy',col:0xff7722,th:0.65},TERRANOVA:{k:'land',col:0xaaaaaa,th:0.65},
        THE_NEXUS:{k:'water',col:0xffee66,th:0.55},
      }
      const sig=SIG[r.id]; if(!sig) continue
      const val=r.resources[sig.k]; if(val<sig.th) continue
      const strength=clamp((val-sig.th)/(1-sig.th),0,1)
      const pulse=0.5+0.5*Math.sin(this.phase*1.8+hash(r.id))
      const sz=60+strength*25+pulse*10
      g.lineStyle(2,sig.col,strength*pulse*0.5); g.strokeRect(cx-sz/2,cy-sz/2,sz,sz)
      g.lineStyle(6,sig.col,strength*pulse*0.1); g.strokeRect(cx-sz/2-4,cy-sz/2-4,sz+8,sz+8)
    }
  }

  // ── Climate Calamity Panel (Top-Centre No Man's Land) ─────────────────────

  // Top-centre gap: X 33%–67%, Y 2%–24% of canvas
  // (between Aquilonia left-tile and Verdantis right-tile, above Ignis Core)
  private _panelCX(W:number){ return W * 0.50 }
  private _panelCY(H:number){ return H * 0.13 }

  private readonly CLIMATE_INFO: Record<string,{
    icon:string; name:string; col:number; colStr:string
    desc:string; sub:string; affects:string
  }> = {
    Drought: {
      icon: '☀️', name: 'DROUGHT',
      col: 0xff9933, colStr: '#ff9933',
      desc: 'Extreme heat scorches the land.\nWater reserves drain 2× faster.\nCrop yields drop by 20% each tick.',
      sub: 'Rivers are drying up. Reservoirs at critical levels.',
      affects: 'Affects: All Nations — 💧 Water −2×  🌾 Food −20%',
    },
    SolarFlare: {
      icon: '🌞', name: 'SOLAR FLARE',
      col: 0xffee44, colStr: '#ffee44',
      desc: 'Massive EM pulse from the sun.\nEnergy grids disrupted — output −30%.\nCrime spikes as power fails.',
      sub: 'Communication networks offline. Trade disrupted.',
      affects: 'Affects: All Nations — ⚡ Energy −30%  ⚠ Crime +15%',
    },
    Blight: {
      icon: '☣️', name: 'BLIGHT',
      col: 0xcc44ff, colStr: '#cc44ff',
      desc: 'Fungal plague spreads through crops.\nVerdantis farmlands contaminated.\nFood exports halted world-wide.',
      sub: 'Mycelium spreading rapidly. Quarantine advised.',
      affects: 'Affects: Verdantis worst — 🌾 Food −40%  All: −10%',
    },
  }

  private _createClimatePanel(W:number, H:number){
    const cx = this._panelCX(W), cy = this._panelCY(H)
    const FONT = '"Press Start 2P",monospace'
    const RES  = window.devicePixelRatio || 1

    this.climateIcon  = this.add.text(cx, cy-44, '', { fontSize:'26px', fontFamily:FONT, resolution:RES }).setOrigin(0.5).setDepth(80)
    this.climateName  = this.add.text(cx, cy-12, '', { fontSize:'11px', fontFamily:FONT, color:'#fff', stroke:'#000', strokeThickness:3, fontStyle:'bold', resolution:RES }).setOrigin(0.5).setDepth(80)
    this.climateDesc  = this.add.text(cx, cy+10, '', { fontSize:'8px',  fontFamily:FONT, color:'#ddd', stroke:'#000', strokeThickness:2, align:'center', wordWrap:{width:W*0.29}, resolution:RES }).setOrigin(0.5,0).setDepth(80)
    this.climateSub   = this.add.text(cx, cy+54, '', { fontSize:'8px',  fontFamily:FONT, color:'#aaa', stroke:'#000', strokeThickness:2, align:'center', wordWrap:{width:W*0.28}, resolution:RES }).setOrigin(0.5,0).setDepth(80)
    this.climateTicks = this.add.text(cx, cy+72, '', { fontSize:'8px',  fontFamily:FONT, color:'#888', stroke:'#000', strokeThickness:2, align:'center', resolution:RES }).setOrigin(0.5,0).setDepth(80)
  }

  private _drawClimatePanel(W:number, H:number){
    const g = this.climateGfx; g.clear()
    const ct = this.climate?.type
    const cx = this._panelCX(W), cy = this._panelCY(H)

    if(!ct){
      // Hide all texts
      ;[this.climateIcon,this.climateName,this.climateDesc,this.climateSub,this.climateTicks].forEach(t=>{ t?.setVisible(false) })
      // Subtle "no event" label
      g.fillStyle(0x0a0e18,0.6)
      g.fillRect(cx - W*0.16, cy - 22, W*0.32, 34)
      g.lineStyle(1,0x1a2535,0.6); g.strokeRect(cx-W*0.16,cy-22,W*0.32,34)
      // Draw inactive world peace text directly
      if(!this.climateName.visible){
        this.climateName.setVisible(true)
        this.climateName.setPosition(cx, cy-8)
        this.climateName.setText('⚖ WORLD STABLE')
        this.climateName.setColor('#334455')
        this.climateName.setFontSize('7px')
        this.climateTicks.setVisible(true)
        this.climateTicks.setPosition(cx, cy+10)
        this.climateTicks.setText('No active calamity')
        this.climateTicks.setColor('#223344')
        this.climateIcon.setVisible(false)
        this.climateDesc.setVisible(false)
        this.climateSub.setVisible(false)
      }
      return
    }

    const info = this.CLIMATE_INFO[ct]; if(!info) return

    // Animated glow panel background
    const pulse = 0.5 + 0.5 * Math.sin(this.phase * 2.5)
    const panW = W * 0.32, panH = H * 0.22
    const px = cx - panW/2, py = cy - panH/2

    // Outer glow
    g.fillStyle(info.col, 0.06 + 0.04 * pulse); g.fillRect(px-8,py-8,panW+16,panH+16)
    g.lineStyle(3, info.col, 0.3 + 0.3*pulse); g.strokeRect(px-8,py-8,panW+16,panH+16)

    // Main panel — dark inventory-style box
    g.fillStyle(0x080c14, 0.92); g.fillRect(px,py,panW,panH)
    g.lineStyle(3, info.col, 0.8 + 0.2*pulse); g.strokeRect(px,py,panW,panH)
    // Inner highlight top-left
    g.lineStyle(2,0xffffff,0.06); g.lineBetween(px+1,py+1,px+panW-1,py+1)
    g.lineBetween(px+1,py+1,px+1,py+panH-1)
    // Separator line under name
    g.lineStyle(1,info.col,0.35); g.lineBetween(px+10,py+30,px+panW-10,py+30)
    // Tick progress bar
    const maxTicks = 30  // assumption for display
    const remaining = clamp(this.climate.duration_remaining/maxTicks,0,1)
    const barY = py+panH-10, barX=px+10, barW=panW-20
    g.fillStyle(0x1a1a1a,0.9); g.fillRect(barX,barY-5,barW,5)
    g.fillStyle(info.col, 0.85); g.fillRect(barX,barY-5,barW*remaining,5)
    g.lineStyle(1,info.col,0.4); g.strokeRect(barX,barY-5,barW,5)

    // Update text objects
    this.climateIcon.setVisible(true).setPosition(cx, py+8).setText(info.icon).setFontSize('22px')
    this.climateName.setVisible(true).setPosition(cx, py+34).setText(info.name).setColor(info.colStr).setFontSize('9px')
    this.climateDesc.setVisible(true).setPosition(cx, py+50).setText(info.desc).setFontSize('9px').setColor('#dddddd')
    this.climateSub.setVisible(true).setPosition(cx, py+panH-52).setText(info.affects).setFontSize('8px').setColor(info.colStr)
    this.climateTicks.setVisible(true).setPosition(cx, py+panH-26)
      .setText(`${this.climate.duration_remaining} TICKS REMAINING`).setColor('#999999').setFontSize('8px')
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private _onResize(W:number, H:number){
    this.bgGfx.clear()
    ;[this.nameLine1,this.nameLine2,this.nameLine3,this.presLabels,
      this.crimeLabels,this.actionLabels,this.resIconLbls,this.resPctLbls
    ].forEach(m=>{ m.forEach(t=>t.destroy()); m.clear() })
    ;[this.climateIcon,this.climateName,this.climateDesc,this.climateSub,this.climateTicks].forEach(t=>t?.destroy())
    this.particles=[]
    this._drawVoxelScene(W,H)
    this._createLabels(W,H)
    this._createClimatePanel(W,H)
  }

  private _regionCenter(id:string,W:number,H:number){
    const l=LAYOUTS[id]
    return {x:(l.fx+l.fw/2)*W, y:(l.fy+l.fh/2)*H}
  }
}
