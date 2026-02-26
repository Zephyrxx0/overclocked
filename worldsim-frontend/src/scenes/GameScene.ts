import Phaser from "phaser";
import type { WorldState } from "../types";

// ─── Isometric helpers ────────────────────────────────────────────────────────
const TILE_W = 64;
const TILE_H = 32;
const BLOCK_H = 16; // height of the block sides
const ISO_ORIGIN_X = 600;
const ISO_ORIGIN_Y = 120;

function toIso(col: number, row: number, height: number = 0): { x: number; y: number } {
  return {
    x: ISO_ORIGIN_X + (col - row) * (TILE_W / 2),
    y: ISO_ORIGIN_Y + (col + row) * (TILE_H / 2) - height * BLOCK_H,
  };
}

// ─── Region definitions ────────────────────────────────────────────────────────
interface RegionDef {
  id: string;
  label: string;
  zone: string;
  baseBlock: string;
  structureBlock: string;
  borderColor: number;
  centerCol: number;
  centerRow: number;
  radius: number;
}

const REGIONS: RegionDef[] = [
  { id: "aquilonia", label: "🌊 AQUILONIA", zone: "WATER RICH", baseBlock: "water_block", structureBlock: "prismarine_block", borderColor: 0x4a9eff, centerCol: 4, centerRow: 3, radius: 3 },
  { id: "verdantis", label: "🌿 VERDANTIS", zone: "FOOD RICH", baseBlock: "grass_block", structureBlock: "log_block", borderColor: 0x66cc44, centerCol: 14, centerRow: 3, radius: 3 },
  { id: "ignis_core", label: "⚡ IGNIS CORE", zone: "ENERGY RICH", baseBlock: "magma_block", structureBlock: "iron_block", borderColor: 0xffaa00, centerCol: 9, centerRow: 7, radius: 4 },
  { id: "terranova", label: "🗻 TERRANOVA", zone: "LAND RICH", baseBlock: "stone_block", structureBlock: "cobblestone_block", borderColor: 0xcc6600, centerCol: 4, centerRow: 11, radius: 3 },
  { id: "nexus", label: "✦ THE NEXUS", zone: "BALANCED HUB", baseBlock: "quartz_block", structureBlock: "gold_block", borderColor: 0xaabbcc, centerCol: 14, centerRow: 11, radius: 3 },
];

const ACTION_COLORS: Record<number, number> = {
  0: 0xaaaaaa, // hold
  1: 0x44aaff, // trade
  2: 0x44ff88, // expand
  3: 0xff4444, // steal
};

const ACTION_LABELS: Record<number, string> = {
  0: "HOLD",
  1: "TRADE",
  2: "EXPAND",
  3: "STEAL",
};

interface PresidentSprite {
  regionId: string;
  container: Phaser.GameObjects.Container;
  tag: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  aura: Phaser.GameObjects.Arc;
}

interface ResourceBars {
  water: Phaser.GameObjects.Rectangle;
  food: Phaser.GameObjects.Rectangle;
  energy: Phaser.GameObjects.Rectangle;
  land: Phaser.GameObjects.Rectangle;
}

export default class GameScene extends Phaser.Scene {
  private crimeOverlays: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private weatherOverlays: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private rainEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private blightEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private presidents: Map<string, PresidentSprite> = new Map();
  private groundBlocks: Map<string, Phaser.GameObjects.Image[]> = new Map();
  private smokeEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private tradeBeams: Phaser.GameObjects.Graphics | null = null;
  private actionBeams: Phaser.GameObjects.Graphics | null = null;
  private resourceBars: Map<string, ResourceBars> = new Map();
  private lastResources: Map<string, { water: number; food: number; energy: number; land: number }> = new Map();

  constructor() {
    super("GameScene");
  }

  preload() {
    // Particles placeholders (empty graphics)
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff); g.fillRect(0, 0, 2, 2); g.generateTexture("rain_particle", 2, 2);
    g.clear(); g.fillStyle(0x00ff00); g.fillRect(0, 0, 3, 3); g.generateTexture("blight_particle", 3, 3);
    g.clear(); g.fillStyle(0x555555, 0.5); g.fillCircle(4, 4, 4); g.generateTexture("smoke_particle", 8, 8);
    g.destroy();
  }

  create() {
    this.generateVoxelTextures();

    const W = this.scale.width;
    const H = this.scale.height;

    // Sky background
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x71b6f9, 0x71b6f9, 0xa1d5f2, 0xa1d5f2, 1);
    sky.fillRect(0, 0, W, H);

    // Voxel Clouds
    for (let i = 0; i < 8; i++) {
      const cx = Phaser.Math.Between(0, W);
      const cy = Phaser.Math.Between(0, H * 0.3);
      const cw = Phaser.Math.Between(40, 100);
      const ch = Phaser.Math.Between(20, 40);
      this.add.rectangle(cx, cy, cw, ch, 0xffffff, 0.7).setDepth(0);
    }

    this.tradeBeams = this.add.graphics().setDepth(150);
    this.actionBeams = this.add.graphics().setDepth(160);

    // Draw world
    this.drawAllRegions();
    this.drawRegionLabels();
    this.setupPresidents();

    // Banner
    this.add.text(W / 2, 15, "⛏ WORLDSIM: CRAFT-CORE EDITION ⛏", {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "14px", color: "#ffffff", stroke: "#000000", strokeThickness: 6,
      shadow: { offsetX: 3, offsetY: 3, color: "#444444", blur: 0, fill: true },
    }).setOrigin(0.5, 0).setDepth(300);

    this.drawLegend();
  }

  private generateVoxelTextures() {
    const blockTypes = [
      { name: 'grass_block', top: 0x55aa33, side: 0x795548, bottom: 0x5d4037, pattern: 'noise' },
      { name: 'stone_block', top: 0x888888, side: 0x777777, bottom: 0x666666, pattern: 'dots' },
      { name: 'cobblestone_block', top: 0x777777, side: 0x666666, bottom: 0x555555, pattern: 'grid' },
      { name: 'water_block', top: 0x3366ff, side: 0x2255ee, bottom: 0x1144dd, pattern: 'waves', alpha: 0.7 },
      { name: 'magma_block', top: 0xff4400, side: 0xcc3300, bottom: 0x882200, pattern: 'cracks' },
      { name: 'iron_block', top: 0xdddddd, side: 0xcccccc, bottom: 0xbbbbbb, pattern: 'none' },
      { name: 'quartz_block', top: 0xffffff, side: 0xeeeeee, bottom: 0xdddddd, pattern: 'none' },
      { name: 'gold_block', top: 0xffcc00, side: 0xeeaa00, bottom: 0xcc8800, pattern: 'none' },
      { name: 'prismarine_block', top: 0x44aaaa, side: 0x339999, bottom: 0x228888, pattern: 'grid' },
      { name: 'log_block', top: 0x5d4037, side: 0x3e2723, bottom: 0x3e2723, pattern: 'rings' },
      { name: 'leaves_block', top: 0x116622, side: 0x0a551a, bottom: 0x074412, pattern: 'dots' },
      { name: 'sand_block', top: 0xeeeebb, side: 0xddddaa, bottom: 0xcccc99, pattern: 'noise' },
      { name: 'mycelium_block', top: 0x884488, side: 0x663366, bottom: 0x5d4037, pattern: 'noise' },
      { name: 'farmland_block', top: 0x4e342e, side: 0x3e2723, bottom: 0x3e2723, pattern: 'rows' },
    ];
    blockTypes.forEach(bt => this.createBlockTexture(bt));
  }

  private createBlockTexture(bt: any) {
    if (this.textures.exists(bt.name)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = TILE_W, h = TILE_H + BLOCK_H;
    const cx = w / 2, cy = TILE_H / 2;

    g.fillStyle(bt.side, bt.alpha || 1);
    g.fillPoints([{ x: cx - TILE_W / 2, y: cy }, { x: cx, y: cy + TILE_H / 2 }, { x: cx, y: cy + TILE_H / 2 + BLOCK_H }, { x: cx - TILE_W / 2, y: cy + BLOCK_H }], true);
    g.fillStyle(bt.bottom, bt.alpha || 1);
    g.fillPoints([{ x: cx + TILE_W / 2, y: cy }, { x: cx, y: cy + TILE_H / 2 }, { x: cx, y: cy + TILE_H / 2 + BLOCK_H }, { x: cx + TILE_W / 2, y: cy + BLOCK_H }], true);
    g.fillStyle(bt.top, bt.alpha || 1);
    g.fillPoints([{ x: cx, y: 0 }, { x: cx + TILE_W / 2, y: cy }, { x: cx, y: cy * 2 }, { x: cx - TILE_W / 2, y: cy }], true);

    if (bt.pattern === 'noise' || bt.pattern === 'dots') {
      g.fillStyle(0x000000, 0.1);
      for (let i = 0; i < 20; i++) g.fillRect(Phaser.Math.Between(cx - 15, cx + 15), Phaser.Math.Between(0, cy * 2), 2, 2);
    }
    g.generateTexture(bt.name, w, h);
    g.destroy();
  }

  private drawAllRegions() { REGIONS.forEach((r) => this.drawRegion(r)); }

  private drawRegion(r: RegionDef) {
    for (let dc = -r.radius; dc <= r.radius; dc++) {
      for (let dr = -r.radius; dr <= r.radius; dr++) {
        if (Math.abs(dc) + Math.abs(dr) > r.radius) continue;
        const col = r.centerCol + dc, row = r.centerRow + dr;
        const pos = toIso(col, row);
        const block = this.add.image(pos.x, pos.y, r.baseBlock).setOrigin(0.5, 0).setDepth(pos.y / 100);
        if (!this.groundBlocks.has(r.id)) this.groundBlocks.set(r.id, []);
        this.groundBlocks.get(r.id)!.push(block);
        if (dc !== 0 || dr !== 0) this.drawVoxelBuilding(r, dc, dr, col, row);
      }
    }
    const { x: cx, y: cy } = toIso(r.centerCol, r.centerRow);
    const overlay = this.add.rectangle(cx, cy, (r.radius * 2 + 1) * TILE_W * 0.8, (r.radius * 2 + 1) * TILE_H * 1.2, 0xff0000, 0).setDepth(140).setOrigin(0.5);
    this.crimeOverlays.set(r.id, overlay);
    const wOverlay = this.add.rectangle(cx, cy, (r.radius * 2 + 1) * TILE_W * 0.8, (r.radius * 2 + 1) * TILE_H * 1.2, 0xaa8800, 0).setDepth(141).setOrigin(0.5);
    this.weatherOverlays.set(r.id, wOverlay);

    const rain = this.add.particles(cx, cy - 100, "rain_particle", {
      speedY: { min: 300, max: 400 }, lifespan: 600, frequency: 20, emitting: false,
      scale: 0.8, alpha: { start: 0.6, end: 0 },
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-100, -50, 200, 100) } as any
    }).setDepth(150);
    this.rainEmitters.set(r.id, rain);

    const blight = this.add.particles(cx, cy, "blight_particle", {
      speed: { min: 10, max: 30 }, lifespan: 1500, frequency: 50, emitting: false,
      scale: { start: 1, end: 2 }, alpha: { start: 0.4, end: 0 },
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 80) } as any
    }).setDepth(150);
    this.blightEmitters.set(r.id, blight);

    // Mini resource utilisation bars (W/F/E/L) floating above the region
    const barWidth = 6;
    const barMaxHeight = 22;
    const barGap = 3;
    const baseY = cy - (r.radius * TILE_H) - 20;

    const mkBar = (index: number, color: number): Phaser.GameObjects.Rectangle => {
      const x = cx + (index - 1.5) * (barWidth + barGap);
      const bg = this.add.rectangle(x, baseY, barWidth, barMaxHeight, 0x000000, 0.5).setOrigin(0.5, 1).setDepth(190);
      const fill = this.add.rectangle(x, baseY, barWidth - 2, 2, color, 0.9).setOrigin(0.5, 1).setDepth(191);
      return fill;
    };

    const waterBar = mkBar(0, 0x3399ff);
    const foodBar = mkBar(1, 0x66cc44);
    const energyBar = mkBar(2, 0xffdd00);
    const landBar = mkBar(3, 0xcc9966);

    this.resourceBars.set(r.id, { water: waterBar, food: foodBar, energy: energyBar, land: landBar });
  }

  private drawVoxelBuilding(r: RegionDef, dc: number, dr: number, col: number, row: number) {
    const pos = toIso(col, row);
    const dist = Math.abs(dc) + Math.abs(dr);
    switch (r.id) {
      case "aquilonia":
        if (dist === r.radius) this.add.image(pos.x, pos.y - 12, "prismarine_block").setScale(0.6).setOrigin(0.5, 0).setDepth(pos.y / 100 + 1);
        else if ((dc + dr) % 3 === 0) this.drawVoxelMonument(pos.x, pos.y);
        break;
      case "verdantis":
        if ((dc + dr) % 3 === 0) this.drawVoxelTree(pos.x, pos.y);
        else {
          this.add.image(pos.x, pos.y, "farmland_block").setOrigin(0.5, 0).setDepth(pos.y / 100 + 0.5);
          if ((dc * row) % 2 === 0) this.drawVoxelHouse(pos.x, pos.y);
        }
        break;
      case "ignis_core":
        if (dist <= 2) this.drawVoxelFactory(pos.x, pos.y, 2 + Math.abs(dc));
        else this.add.image(pos.x, pos.y, "iron_block").setOrigin(0.5, 0).setDepth(pos.y / 100 + 0.1);
        break;
      case "terranova":
        if ((dc + dr) % 2 === 0) this.drawVoxelMountain(pos.x, pos.y);
        else if (dist === 1) this.drawVoxelOutpost(pos.x, pos.y);
        break;
      case "nexus":
        if (dist <= 2) this.drawVoxelTradePost(pos.x, pos.y, (dc + dr) % 2 === 0);
        break;
    }
  }

  private drawVoxelTree(x: number, y: number) {
    this.add.image(x, y - 16, "log_block").setScale(0.5, 1).setOrigin(0.5, 0).setDepth(y / 100 + 1);
    this.add.image(x, y - 32, "leaves_block").setOrigin(0.5, 0).setDepth(y / 100 + 2);
    this.add.image(x, y - 44, "leaves_block").setScale(0.7).setOrigin(0.5, 0).setDepth(y / 100 + 3);
  }
  private drawVoxelHouse(x: number, y: number) {
    this.add.image(x, y - 16, "cobblestone_block").setScale(0.7).setOrigin(0.5, 0).setDepth(y / 100 + 1);
    this.add.image(x, y - 28, "log_block").setScale(0.8, 0.4).setOrigin(0.5, 0).setDepth(y / 100 + 2);
  }
  private drawVoxelFactory(x: number, y: number, height: number) {
    for (let i = 1; i <= height; i++) this.add.image(x, y - i * 16, "iron_block").setOrigin(0.5, 0).setDepth(y / 100 + i);
    const emitter = this.add.particles(x, y - height * 16, "smoke_particle", {
      speed: 20, lifespan: 1000, frequency: 400, scale: { start: 0.5, end: 1.5 }, alpha: { start: 0.5, end: 0 }
    }).setDepth(y / 100 + height + 1);
    this.smokeEmitters.push(emitter);
  }
  private drawVoxelMountain(x: number, y: number) {
    this.add.image(x, y - 16, "stone_block").setOrigin(0.5, 0).setDepth(y / 100 + 1);
    this.add.image(x, y - 32, "stone_block").setScale(0.7).setOrigin(0.5, 0).setDepth(y / 100 + 2);
  }
  private drawVoxelOutpost(x: number, y: number) {
    this.add.image(x, y - 16, "cobblestone_block").setOrigin(0.5, 0).setDepth(y / 100 + 1);
    this.add.image(x - 8, y - 32, "cobblestone_block").setScale(0.4).setOrigin(0.5, 0).setDepth(y / 100 + 2);
    this.add.image(x + 8, y - 32, "cobblestone_block").setScale(0.4).setOrigin(0.5, 0).setDepth(y / 100 + 2);
  }
  private drawVoxelMonument(x: number, y: number) {
    this.add.image(x, y - 16, "prismarine_block").setOrigin(0.5, 0).setDepth(y / 100 + 1);
    this.add.image(x, y - 24, "prismarine_block").setScale(0.6).setOrigin(0.5, 0).setDepth(y / 100 + 2);
  }
  private drawVoxelTradePost(x: number, y: number, golden: boolean) {
    this.add.image(x, y - 16, "quartz_block").setOrigin(0.5, 0).setDepth(y / 100 + 1);
    if (golden) this.add.image(x, y - 32, "gold_block").setScale(0.8).setOrigin(0.5, 0).setDepth(y / 100 + 2);
    else this.add.image(x, y - 32, "quartz_block").setScale(0.8).setOrigin(0.5, 0).setDepth(y / 100 + 2);
  }

  private setupPresidents() {
    REGIONS.forEach((r) => {
      const pos = toIso(r.centerCol, r.centerRow);
      const container = this.add.container(pos.x, pos.y - 12);

      const aura = this.add.circle(0, 0, 30, 0x0088ff, 0).setOrigin(0.5, 0.5);
      container.add(aura);

      const body = this.add.image(0, 0, "log_block").setScale(0.3, 0.5).setOrigin(0.5, 0);
      const head = this.add.image(0, -10, "quartz_block").setScale(0.2).setOrigin(0.5, 0);
      container.add([body, head]);
      container.setDepth(200);
      const tag = this.add.text(0, -20, "HOLD", {
        fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#ffffff", stroke: "#000000", strokeThickness: 2
      }).setOrigin(0.5, 1);
      container.add(tag);

      const bubbleContainer = this.add.container(pos.x, pos.y - 60).setDepth(250).setAlpha(0);
      const bubbleBg = this.add.graphics();
      bubbleBg.fillStyle(0xffffff, 0.9);
      bubbleBg.lineStyle(2, 0x000000, 1);
      bubbleBg.strokeRoundedRect(-50, -15, 100, 30, 4);
      bubbleBg.fillRoundedRect(-50, -15, 100, 30, 4);
      const bubbleText = this.add.text(0, 0, "", {
        fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "#000000", wordWrap: { width: 90 }, align: "center"
      }).setOrigin(0.5, 0.5);
      bubbleContainer.add([bubbleBg, bubbleText]);

      this.presidents.set(r.id, { regionId: r.id, container, tag, bubbleContainer, bubbleText, aura });
      this.tweens.add({ targets: container, y: "-=5", duration: 1000 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
  }

  private drawRegionLabels() {
    REGIONS.forEach((r) => {
      const { x, y } = toIso(r.centerCol, r.centerRow - r.radius - 1);
      this.add.text(x, y - 20, r.label, {
        fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
        color: "#" + r.borderColor.toString(16).padStart(6, "0"),
        stroke: "#000000", strokeThickness: 3
      }).setOrigin(0.5, 1).setDepth(210);
    });
  }

  private drawLegend() {
    const items = [{ label: "0=HOLD", color: "#aaaaaa" }, { label: "1=TRADE", color: "#44aaff" }, { label: "2=EXPAND", color: "#44ff88" }, { label: "3=STEAL", color: "#ff4444" }];
    this.add.rectangle(100, 150, 160, 100, 0x000000, 0.6).setDepth(200).setOrigin(0.5);
    items.forEach((item, i) => {
      this.add.text(30, 110 + i * 20, item.label, { fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: item.color }).setDepth(201);
    });
  }

  updateWorldState(worldState: WorldState) {
    Object.values(worldState.agents).forEach((agent) => {
      const pres = this.presidents.get(agent.region_id);
      if (pres) {
        pres.tag.setText(ACTION_LABELS[agent.action] || "HOLD");
        pres.tag.setColor(Phaser.Display.Color.IntegerToColor(ACTION_COLORS[agent.action] || 0xaaaaaa).rgba);

        // Aura
        if (agent.action === 0) { // HOLD
          if (pres.aura.alpha === 0) {
            pres.aura.setAlpha(0.5);
            this.tweens.add({ targets: pres.aura, scale: 2, alpha: 0, duration: 2000, repeat: -1 });
          }
        } else {
          pres.aura.setAlpha(0);
          this.tweens.killTweensOf(pres.aura);
          pres.aura.setScale(1);
        }

        if (agent.action === 3) { if (!this.tweens.isTweening(pres.container)) this.tweens.add({ targets: pres.container, scale: 1.5, duration: 100, yoyo: true, repeat: 3 }); }
      }
    });

    if (this.actionBeams) {
      this.actionBeams.clear();
    }

    Object.entries(worldState.regions).forEach(([regionId, regionState]) => {
      const pres = this.presidents.get(regionId);
      if (pres) {
        if (regionState.speech_bubble) {
          pres.bubbleText.setText(regionState.speech_bubble.substring(0, 40));
          pres.bubbleContainer.setAlpha(1);
          this.tweens.add({
            targets: pres.bubbleContainer,
            alpha: 0,
            duration: 500,
            delay: 2500
          });
        }
      }

      if (regionState.target_beams && this.actionBeams) {
        const sDef = REGIONS.find(r => r.id === regionId);
        if (sDef) {
          const sPos = toIso(sDef.centerCol, sDef.centerRow);
          regionState.target_beams.forEach((beam: any) => {
            const tDef = REGIONS.find(r => r.id === beam.target);
            if (tDef) {
              const tPos = toIso(tDef.centerCol, tDef.centerRow);
              const color = beam.type === 'trade' ? 0xffdd00 : 0xff0000;
              this.actionBeams!.lineStyle(4, color, 0.8);
              this.actionBeams!.beginPath();
              this.actionBeams!.moveTo(sPos.x, sPos.y - 12);

              const midX = (sPos.x + tPos.x) / 2;
              const midY = (sPos.y + tPos.y) / 2 - 50;

              this.actionBeams!.quadraticCurveTo(midX, midY, tPos.x, tPos.y - 12);
              this.actionBeams!.strokePath();

              if (!beam.success) {
                this.actionBeams!.lineStyle(2, 0xffaa00, 1);
                this.actionBeams!.beginPath();
                this.actionBeams!.moveTo(tPos.x - 10, tPos.y - 20);
                this.actionBeams!.lineTo(tPos.x + 10, tPos.y);
                this.actionBeams!.moveTo(tPos.x + 10, tPos.y - 20);
                this.actionBeams!.lineTo(tPos.x - 10, tPos.y);
                this.actionBeams!.strokePath();
              }
            }
          });
        }
      }
      const rain = this.rainEmitters.get(regionId);
      const blight = this.blightEmitters.get(regionId);
      const weatherOverlay = this.weatherOverlays.get(regionId);
      const crimeOverlay = this.crimeOverlays.get(regionId);
      const blocks = this.groundBlocks.get(regionId);
      const rDef = REGIONS.find(r => r.id === regionId);

      // Resource utilisation bars (W/F/E/L)
      const bars = this.resourceBars.get(regionId);
      if (bars) {
        const { water, food, energy, land } = regionState.resources;
        const maxVal = 300;
        const clampRatio = (v: number) => Phaser.Math.Clamp(v / maxVal, 0, 1);
        const maxHeight = 22;

        const setBar = (bar: Phaser.GameObjects.Rectangle, value: number) => {
          const ratio = clampRatio(value);
          const h = Math.max(2, maxHeight * ratio);
          bar.height = h;
        };

        const prev = this.lastResources.get(regionId);

        setBar(bars.water, water);
        setBar(bars.food, food);
        setBar(bars.energy, energy);
        setBar(bars.land, land);

        // Consumption pulse: flash the bar when that resource drops noticeably
        const maybePulse = (bar: Phaser.GameObjects.Rectangle, delta: number) => {
          if (delta < -1 && !this.tweens.isTweening(bar)) {
            this.tweens.add({
              targets: bar,
              alpha: { from: 1, to: 0.3 },
              duration: 120,
              yoyo: true,
              repeat: 1,
            });
          }
        };

        if (prev) {
          maybePulse(bars.water, water - prev.water);
          maybePulse(bars.food, food - prev.food);
          maybePulse(bars.energy, energy - prev.energy);
          maybePulse(bars.land, land - prev.land);
        }

        this.lastResources.set(regionId, { water, food, energy, land });
      }

      if (rain) rain.emitting = regionState.active_weather === "rain";
      if (blight) blight.emitting = regionState.active_weather === "blight";

      if (blocks && rDef) {
        let t = rDef.baseBlock;
        if (regionState.active_weather === "drought" && (rDef.baseBlock === "grass_block" || rDef.baseBlock === "water_block")) t = "sand_block";
        else if (regionState.active_weather === "blight" && rDef.id === "verdantis") t = "mycelium_block";
        blocks.forEach(b => { if (b.texture.key !== t) b.setTexture(t); });
      }

      if (weatherOverlay) {
        if (regionState.active_weather === "drought") weatherOverlay.setAlpha(0.2);
        else if (regionState.active_weather === "solar_flare") weatherOverlay.setFillStyle(0xffff00, 0.3).setAlpha(0.3);
        else weatherOverlay.setAlpha(0);
      }

      if (crimeOverlay) {
        const crimeAlpha = Math.max(0, (1.0 - regionState.morale) * 0.5);
        if (crimeAlpha > 0.3) {
          crimeOverlay.setAlpha(crimeAlpha);
          if (!this.tweens.isTweening(crimeOverlay)) this.tweens.add({ targets: crimeOverlay, alpha: crimeAlpha * 0.5, duration: 500, yoyo: true, repeat: -1 });
        } else { crimeOverlay.setAlpha(0); this.tweens.killTweensOf(crimeOverlay); }
      }
    });

    if (this.tradeBeams) {
      this.tradeBeams.clear();
      Object.entries(worldState.trade_network).forEach(([sourceId, partners]: [string, any]) => {
        const agent = Object.values(worldState.agents).find(a => a.region_id === sourceId);
        if (agent && agent.action === 1 && partners.length > 0) {
          const sDef = REGIONS.find(r => r.id === sourceId);
          if (!sDef) return;
          const sPos = toIso(sDef.centerCol, sDef.centerRow);
          partners.forEach((targetId: string) => {
            const tDef = REGIONS.find(r => r.id === targetId);
            if (!tDef) return;
            const tPos = toIso(tDef.centerCol, tDef.centerRow);
            if (this.time.now % 100 < 5) {
              const cart = this.add.container(sPos.x, sPos.y).setDepth(160);
              const box = this.add.image(0, 0, "log_block").setScale(0.2).setOrigin(0.5);
              cart.add(box);
              this.tweens.add({ targets: cart, x: tPos.x, y: tPos.y, duration: 2000, onComplete: () => cart.destroy() });
            }
          });
        }
      });
    }
  }
}
