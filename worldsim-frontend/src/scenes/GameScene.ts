import Phaser from "phaser";
import type { WorldState, RegionState, PresidentAgent } from "../types";

// ─── Isometric helpers ────────────────────────────────────────────────────────
const TILE_W = 64; // rendered tile width  (2× the 32px logical size)
const TILE_H = 32; // rendered tile height
const ISO_ORIGIN_X = 600;
const ISO_ORIGIN_Y = 80;

function toIso(col: number, row: number): { x: number; y: number } {
  return {
    x: ISO_ORIGIN_X + (col - row) * (TILE_W / 2),
    y: ISO_ORIGIN_Y + (col + row) * (TILE_H / 2),
  };
}

// ─── Region definitions ────────────────────────────────────────────────────────
interface RegionDef {
  id: string;
  label: string;
  zone: string;
  tileColor: number;
  overlayColor: number;
  borderColor: number;
  centerCol: number;
  centerRow: number;
  radius: number;
}

const REGIONS: RegionDef[] = [
  { id: "aquilonia", label: "🌊 AQUILONIA", zone: "WATER RICH", tileColor: 0x0a2a4a, overlayColor: 0x0066ff, borderColor: 0x4a9eff, centerCol: 4, centerRow: 3, radius: 3 },
  { id: "verdantis", label: "🌿 VERDANTIS", zone: "FOOD RICH", tileColor: 0x0a3a0a, overlayColor: 0x00aa44, borderColor: 0x66cc44, centerCol: 14, centerRow: 3, radius: 3 },
  { id: "ignis_core", label: "⚡ IGNIS CORE", zone: "ENERGY RICH", tileColor: 0x3a1a05, overlayColor: 0xff8800, borderColor: 0xffaa00, centerCol: 9, centerRow: 7, radius: 4 },
  { id: "terranova", label: "🗻 TERRANOVA", zone: "LAND RICH", tileColor: 0x2a1a1a, overlayColor: 0x884400, borderColor: 0xcc6600, centerCol: 4, centerRow: 11, radius: 3 },
  { id: "nexus", label: "✦ THE NEXUS", zone: "BALANCED HUB", tileColor: 0x3a3a4a, overlayColor: 0xffffff, borderColor: 0xaabbcc, centerCol: 14, centerRow: 11, radius: 3 },
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
  body: Phaser.GameObjects.Rectangle;
  head: Phaser.GameObjects.Rectangle;
  tag: Phaser.GameObjects.Text;
}

export default class GameScene extends Phaser.Scene {
  private crimeOverlays: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private weatherOverlays: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private rainEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();

  private presidents: Map<string, PresidentSprite> = new Map();

  private smokeEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private fireEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private neonWindows: Phaser.GameObjects.Rectangle[] = [];
  private windmillBlades: Phaser.GameObjects.Container[] = [];
  private waterRipples: Phaser.GameObjects.Ellipse[] = [];

  private groundLayer!: Phaser.GameObjects.Graphics;
  private buildingLayer!: Phaser.GameObjects.Graphics;
  private uiLayer!: Phaser.GameObjects.Graphics;

  constructor() {
    super("GameScene");
  }

  preload() {
    // No external assets required
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Sky background ─────────────────────────────────────────────────────
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x0d0d2b, 0x0d0d2b, 0x0a1a0a, 0x0a1a0a, 1);
    sky.fillRect(0, 0, W, H);

    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, H * 0.35);
      const ss = Phaser.Math.FloatBetween(0.5, 2);
      const star = this.add.rectangle(sx, sy, ss, ss, 0xffffff, 0.8);
      this.tweens.add({ targets: star, alpha: 0.2, duration: 800 + Math.random() * 1200, yoyo: true, repeat: -1 });
    }

    this.groundLayer = this.add.graphics().setDepth(1);
    this.buildingLayer = this.add.graphics().setDepth(2);
    this.uiLayer = this.add.graphics().setDepth(100);

    // ── Draw the city ──────────────────────────────────────────────────────
    this.drawAllRegions();
    this.drawRegionLabels();
    this.drawHexagonBorders();
    this.addAnimatedElements();
    this.setupPresidents();

    // ── Title banner ───────────────────────────────────────────────────────
    this.add.text(W / 2, 10, "⚡ WORLDSIM AUTONOMOUS ENGINE ⚡", {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "14px",
      color: "#00ffff",
      stroke: "#003344",
      strokeThickness: 4,
      shadow: { offsetX: 2, offsetY: 2, color: "#ff00ff", blur: 8, fill: true },
    }).setOrigin(0.5, 0).setDepth(200);

    this.drawLegend();
  }

  private drawAllRegions() {
    REGIONS.forEach((r) => this.drawRegion(r));
  }

  private drawRegion(r: RegionDef) {
    const g = this.groundLayer;
    const bg = this.buildingLayer;

    for (let dc = -r.radius; dc <= r.radius; dc++) {
      for (let dr = -r.radius; dr <= r.radius; dr++) {
        if (Math.abs(dc) + Math.abs(dr) > r.radius) continue;
        const col = r.centerCol + dc;
        const row = r.centerRow + dr;
        const { x, y } = toIso(col, row);

        const groundColor = this.getGroundColor(r, dc, dr);
        g.fillStyle(groundColor, 1);
        g.fillPoints([
          { x: x, y: y - TILE_H / 2 },
          { x: x + TILE_W / 2, y: y },
          { x: x, y: y + TILE_H / 2 },
          { x: x - TILE_W / 2, y: y },
        ], true);

        g.lineStyle(1, 0x000000, 0.25);
        g.strokePoints([
          { x: x, y: y - TILE_H / 2 },
          { x: x + TILE_W / 2, y: y },
          { x: x, y: y + TILE_H / 2 },
          { x: x - TILE_W / 2, y: y },
        ], true);

        // Leave exact center empty for president
        if (dc !== 0 || dr !== 0) {
          this.drawBuildingOnTile(bg, r, dc, dr, x, y);
        }
      }
    }

    const { x: cx, y: cy } = toIso(r.centerCol, r.centerRow);
    const ow = (r.radius * 2 + 1) * TILE_W * 0.85;
    const oh = (r.radius * 2 + 1) * TILE_H * 1.2;

    // Base overlay (morale/climate effect)
    const overlay = this.add.rectangle(cx, cy, ow, oh, r.overlayColor, 0.05)
      .setDepth(49)
      .setOrigin(0.5, 0.5);
    this.crimeOverlays.set(r.id, overlay);

    // Weather overlay specifically for drought yellow tint
    const wOverlay = this.add.rectangle(cx, cy, ow, oh, 0xaa8800, 0.0)
      .setDepth(48)
      .setOrigin(0.5, 0.5);
    this.weatherOverlays.set(r.id, wOverlay);

    // Rain emitter
    if (!this.textures.exists("rain_particle")) {
      const p = this.make.graphics({ x: 0, y: 0 });
      p.fillStyle(0x88ccff, 0.8);
      p.fillRect(0, 0, 2, 8);
      p.generateTexture("rain_particle", 2, 8);
      p.destroy();
    }
    const rain = this.add.particles(cx, cy - 80, "rain_particle", {
      speedY: { min: 200, max: 300 },
      speedX: { min: -10, max: 10 },
      lifespan: 600,
      frequency: -1, // off by default
      quantity: 5,
      scale: { start: 1, end: 0.5 },
      alpha: { start: 0.5, end: 0 },
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-ow / 2, -50, ow, 100) }
    }).setDepth(50);
    this.rainEmitters.set(r.id, rain);
  }

  private getGroundColor(r: RegionDef, dc: number, dr: number): number {
    switch (r.id) {
      case "aquilonia": {
        const dist = Math.sqrt(dc * dc + dr * dr);
        if (dist >= r.radius - 0.5) return 0x0044aa; // water around
        return (dc + dr) % 2 === 0 ? 0x0a2a4a : 0x051a3a;
      }
      case "verdantis":
        return (dc + dr) % 2 === 0 ? 0x1a3a10 : 0x142e0c;
      case "ignis_core":
        return (dc + dr) % 2 === 0 ? 0x3a1a05 : 0x2a1000;
      case "terranova":
        return (dc + dr) % 2 === 0 ? 0x2a1a1a : 0x201010;
      case "nexus":
        return (dc + dr) % 2 === 0 ? 0x3a3a4a : 0x303040;
      default:
        return r.tileColor;
    }
  }

  private drawBuildingOnTile(g: Phaser.GameObjects.Graphics, r: RegionDef, dc: number, dr: number, x: number, y: number) {
    const dist = Math.abs(dc) + Math.abs(dr);

    switch (r.id) {
      case "ignis_core":
        if (dist <= 2 && (dc + dr) % 2 === 0) {
          const h = 40 + Math.abs(dc * 12 + dr * 8);
          this.drawSkyscraper(g, x, y, h);
        } else if (dist === 1) {
          this.drawFactory(g, x, y);
        }
        break;

      case "aquilonia":
        if (Math.abs(dc) + Math.abs(dr) >= r.radius) {
          if ((dc + dr) % 2 === 0) this.drawBoat(g, x, y + 8);
        } else if (dc === -1 && dr === 1) {
          this.drawWindmill(x, y);
        } else if ((dc + dr) % 2 === 0) {
          this.drawHouse(g, x, y);
        }
        break;

      case "verdantis":
        if ((dc + dr) % 3 === 0) this.drawTree(g, x, y);
        else if ((dc + dr) % 3 === 1) this.drawFarmTile(g, x, y);
        break;

      case "terranova":
        if ((dc + dr) % 2 === 0) this.drawMountain(g, x, y);
        else if (dist === 1) this.drawShack(g, x, y);
        break;

      case "nexus":
        if ((dc + dr) % 3 === 0) {
          this.drawWarehouse(g, x, y);
        } else if (dist === 2) {
          this.drawHouse(g, x, y);
        }
        break;
    }
  }

  // ── Building renderers ────────────────────────────────────────────────────

  private drawMountain(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x443333, 1);
    g.fillTriangle(x - 16, y, x + 16, y, x, y - 30);
    g.fillStyle(0x332222, 1);
    g.fillTriangle(x - 4, y, x + 16, y, x, y - 30);
    g.fillStyle(0xcccccc, 1); // snow peak
    g.fillTriangle(x - 5, y - 20, x + 5, y - 20, x, y - 30);
  }

  private drawSkyscraper(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number) {
    const bw = 20;
    g.fillStyle(0x1a1a3a, 1);
    g.fillRect(x - bw / 2 + bw, y - h, bw / 2, h);
    g.fillStyle(0x222255, 1);
    g.fillRect(x - bw / 2, y - h, bw, h);
    g.fillStyle(0x333377, 1);
    g.fillPoints([{ x: x - bw / 2, y: y - h }, { x: x + bw / 2 + bw / 2, y: y - h }, { x: x + bw, y: y - h + 6 }, { x: x - bw / 2 - 6, y: y - h + 6 }], true);

    const rows = Math.floor(h / 10);
    for (let wr = 0; wr < rows; wr++) {
      for (let wc = 0; wc < 3; wc++) {
        const wx = x - bw / 2 + 3 + wc * 6;
        const wy = y - h + 5 + wr * 10;
        const color = Math.random() > 0.5 ? 0x00ffff : 0xff00ff;
        const win = this.add.rectangle(wx, wy, 4, 5, color, 0.9).setDepth(3);
        this.neonWindows.push(win);
        this.tweens.add({ targets: win, alpha: Math.random() > 0.5 ? 0.1 : 0.9, duration: 400 + Math.random() * 800, yoyo: true, repeat: -1, delay: Math.random() * 1000 });
      }
    }
    g.lineStyle(2, 0xff00ff, 1);
    g.beginPath(); g.moveTo(x, y - h); g.lineTo(x, y - h - 12); g.strokePath();
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x5a3a1a, 1); g.fillRect(x - 3, y - 16, 6, 14);
    g.fillStyle(0x116622, 1); g.fillTriangle(x - 14, y - 12, x + 14, y - 12, x, y - 36);
    g.fillStyle(0x1a8833, 1); g.fillTriangle(x - 10, y - 22, x + 10, y - 22, x, y - 42);
    g.fillStyle(0x22aa44, 1); g.fillTriangle(x - 7, y - 32, x + 7, y - 32, x, y - 48);
  }

  private drawFarmTile(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    for (let row = 0; row < 3; row++) {
      g.fillStyle(0x44aa22, 1); g.fillRect(x - 18 + row * 12, y - 6, 4, 14);
      g.fillRect(x - 16 + row * 12, y - 10, 2, 6);
    }
  }

  private drawWindmill(x: number, y: number) {
    const blade = this.add.graphics().setDepth(4);
    blade.fillStyle(0xdddddd, 1);
    blade.fillStyle(0x888888, 1);
    blade.fillRect(x - 4, y - 40, 8, 40);

    const bladeContainer = this.add.container(x, y - 42).setDepth(5);
    const bladeGfx = this.add.graphics();
    bladeGfx.fillStyle(0xeeeeee, 1);
    bladeGfx.fillRect(-2, -18, 4, 36);
    bladeGfx.fillRect(-18, -2, 36, 4);
    bladeContainer.add(bladeGfx);
    this.windmillBlades.push(bladeContainer);
    this.tweens.add({ targets: bladeContainer, angle: 360, duration: 4000, repeat: -1, ease: "Linear" });
  }

  private drawBoat(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x8B6914, 1);
    g.fillPoints([{ x: x - 14, y: y }, { x: x + 14, y: y }, { x: x + 10, y: y + 8 }, { x: x - 10, y: y + 8 }], true);
    g.fillStyle(0xffeecc, 1); g.fillRect(x - 3, y - 14, 2, 14);
    g.fillStyle(0xff4444, 0.8); g.fillTriangle(x - 1, y - 14, x + 10, y - 8, x - 1, y - 2);
  }

  private drawFactory(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const bw = 32;
    g.fillStyle(0x2a2010, 1); g.fillRect(x - bw / 2 + bw, y - 28, 12, 28);
    g.fillStyle(0x3a3018, 1); g.fillRect(x - bw / 2, y - 28, bw, 28);
    g.fillStyle(0x4a4020, 1); g.fillRect(x - bw / 2, y - 30, bw + 12, 4);

    const stacks = [x - 10, x + 6];
    stacks.forEach((sx) => {
      g.fillStyle(0x333333, 1); g.fillRect(sx - 3, y - 50, 6, 22);
      g.fillStyle(0x555555, 1); g.fillRect(sx - 4, y - 52, 8, 4);
      this.addSmoke(sx, y - 54);
    });
    g.fillStyle(0xffcc00, 0.9);
    g.fillRect(x - 12, y - 22, 7, 7); g.fillRect(x + 4, y - 22, 7, 7);
  }

  private drawWarehouse(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x2e2416, 1); g.fillRect(x - 20, y - 18, 40, 18);
    g.fillStyle(0x3e3020, 1); g.fillEllipse(x, y - 18, 44, 14);
    g.fillStyle(0xccaa44, 0.7); g.fillRect(x - 5, y - 16, 8, 16);
  }

  private drawShack(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x3a2010, 1); g.fillRect(x - 16, y - 18, 32, 18);
    g.fillStyle(0x552a10, 1);
    g.fillPoints([{ x: x - 18, y: y - 18 }, { x: x + 4, y: y - 18 }, { x: x + 14, y: y - 32 }, { x: x - 8, y: y - 30 }], true);
    g.fillStyle(0x111111, 1); g.fillRect(x - 10, y - 14, 7, 7);
    g.fillStyle(0x220a00, 1); g.fillRect(x + 4, y - 14, 6, 14);
  }

  private drawHouse(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    const bw = 28;
    g.fillStyle(0x8b4513, 1); g.fillRect(x + bw / 2, y - 22, 10, 22);
    g.fillStyle(0xd2691e, 1); g.fillRect(x - bw / 2, y - 22, bw, 22);
    g.fillStyle(0x7a3010, 1);
    g.fillPoints([{ x: x - bw / 2 - 2, y: y - 22 }, { x: x + bw / 2 + 12, y: y - 22 }, { x: x + 8, y: y - 38 }, { x: x - 4, y: y - 38 }], true);
    g.fillStyle(0xffffaa, 0.9); g.fillRect(x - 12, y - 18, 7, 6); g.fillRect(x + 4, y - 18, 7, 6);
    g.fillStyle(0x5a2a00, 1); g.fillRect(x - 4, y - 12, 8, 12);
  }

  private addSmoke(x: number, y: number) {
    if (!this.textures.exists("smoke_particle")) {
      const sg = this.make.graphics({ x: 0, y: 0 });
      sg.fillStyle(0xaaaaaa, 0.6); sg.fillCircle(4, 4, 4);
      sg.generateTexture("smoke_particle", 8, 8); sg.destroy();
    }
    const emitter = this.add.particles(x, y, "smoke_particle", {
      speed: { min: 10, max: 25 }, angle: { min: 250, max: 290 }, scale: { start: 0.3, end: 1.2 },
      alpha: { start: 0.7, end: 0 }, lifespan: 2000, frequency: 300, quantity: 1, tint: [0x888888, 0xaaaaaa, 0x999966],
    });
    emitter.setDepth(20); this.smokeEmitters.push(emitter);
  }

  // ── Animated elements ─────────────────────────────────────────────────────

  private addAnimatedElements() {
    const waterRegion = REGIONS.find((r) => r.id === "aquilonia")!;
    for (let i = 0; i < 4; i++) {
      const { x, y } = toIso(
        waterRegion.centerCol + Phaser.Math.Between(-1, 1),
        waterRegion.centerRow + Phaser.Math.Between(-1, 1)
      );
      const ripple = this.add.ellipse(x, y + 8, 20, 8, 0x66ccff, 0.3).setDepth(6);
      this.waterRipples.push(ripple);
      this.tweens.add({ targets: ripple, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 2000, delay: i * 600, repeat: -1, ease: "Sine.easeOut" });
    }
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  private drawRegionLabels() {
    REGIONS.forEach((r) => {
      const { x, y } = toIso(r.centerCol, r.centerRow - r.radius - 1);
      this.add.text(x, y - 20, r.label, {
        fontFamily: "'Press Start 2P', monospace", fontSize: "7px",
        color: "#" + r.borderColor.toString(16).padStart(6, "0"),
        stroke: "#000000", strokeThickness: 3, shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 4, fill: true },
      }).setOrigin(0.5, 1).setDepth(110);
      this.add.text(x, y - 10, r.zone, {
        fontFamily: "'Press Start 2P', monospace", fontSize: "5px", color: "#aaaaaa",
      }).setOrigin(0.5, 1).setDepth(110);
    });
  }

  // ── Hexagonal-style borders between regions ───────────────────────────────

  private drawHexagonBorders() {
    const g = this.uiLayer;
    g.lineStyle(2, 0xffffff, 0.5);

    const pairs: [number, number][] = [
      [0, 1], [0, 2], [0, 3], [0, 4], [1, 3], [2, 4],
    ];

    pairs.forEach(([ai, bi]) => {
      const ra = REGIONS[ai];
      const rb = REGIONS[bi];
      const a = toIso(ra.centerCol, ra.centerRow);
      const b = toIso(rb.centerCol, rb.centerRow);

      const steps = 20;
      for (let s = 0; s < steps; s++) {
        if (s % 2 === 0) {
          const t0 = s / steps;
          const t1 = (s + 0.6) / steps;
          g.beginPath();
          g.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
          g.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
          g.strokePath();
        }
      }
    });

    REGIONS.forEach((r) => {
      const { x, y } = toIso(r.centerCol, r.centerRow);
      const pts: { x: number; y: number }[] = [];
      const rad = r.radius * TILE_W * 0.58;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        pts.push({ x: x + rad * Math.cos(angle), y: y + rad * Math.sin(angle) * 0.5 });
      }
      g.lineStyle(2, r.borderColor, 0.75);
      g.strokePoints(pts, true);
    });
  }

  // ── Single President per Region ───────────────────────────────────────────

  private setupPresidents() {
    REGIONS.forEach((r) => {
      const { x, y } = toIso(r.centerCol, r.centerRow);

      // A slightly larger entity
      const body = this.add.rectangle(x, y - 5, 8, 12, r.borderColor, 1).setDepth(40);
      const head = this.add.rectangle(x, y - 15, 6, 6, 0xffddaa, 1).setDepth(40);

      // Floating text for current action
      const tag = this.add.text(x, y - 25, "HOLD", {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "6px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(45);

      this.presidents.set(r.id, { regionId: r.id, body, head, tag });

      // Idle animation
      this.tweens.add({
        targets: [body, head, tag],
        y: "-=3",
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Math.random() * 1000,
      });
    });
  }

  // ── Legend ────────────────────────────────────────────────────────────────

  private drawLegend() {
    const items = [
      { label: "0=HOLD", color: "#aaaaaa" },
      { label: "1=TRADE", color: "#44aaff" },
      { label: "2=EXPAND", color: "#44ff88" },
      { label: "3=STEAL", color: "#ff4444" },
    ];
    const legendX = 12;
    const legendY = 68;

    this.add.rectangle(legendX + 80, legendY + items.length * 12 + 4, 162, items.length * 22 + 16, 0x000000, 0.65)
      .setDepth(200)
      .setOrigin(0.5, 0);

    items.forEach((item, i) => {
      this.add.text(legendX + 8, legendY + i * 22 + 10, item.label, {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "6px",
        color: item.color,
      }).setDepth(201);
    });
  }

  // ── React → Phaser state update ───────────────────────────────────────────

  updateWorldState(worldState: WorldState) {

    // 1. Update President Action Tags
    Object.entries(worldState.agents).forEach(([_, agent]) => {
      const pres = this.presidents.get(agent.region_id);
      if (pres) {
        pres.tag.setText(ACTION_LABELS[agent.action] || "HOLD");
        pres.tag.setColor(Phaser.Display.Color.IntegerToColor(ACTION_COLORS[agent.action] || 0xaaaaaa).rgba);
      }
    });

    // 2. Weather Engine execution (Tinting and Particles)
    Object.entries(worldState.regions).forEach(([regionId, regionState]) => {

      const weatherOverlay = this.weatherOverlays.get(regionId);
      const rainEmitter = this.rainEmitters.get(regionId);

      if (regionState.active_weather === "drought") {
        // Yellow/brown tint mapped onto the overlay
        if (weatherOverlay) {
          this.tweens.add({ targets: weatherOverlay, alpha: 0.4, duration: 2000 });
        }
      } else {
        if (weatherOverlay) {
          this.tweens.add({ targets: weatherOverlay, alpha: 0, duration: 1000 });
        }
      }

      if (regionState.active_weather === "rain") {
        if (rainEmitter && !rainEmitter.on) {
          rainEmitter.start();
        }
      } else {
        if (rainEmitter && rainEmitter.on) {
          rainEmitter.stop();
        }
      }

      // Base morale/crime pulse
      const overlay = this.crimeOverlays.get(regionId);
      if (overlay) {
        // Low morale = high crime tint (red)
        const crimeAlpha = Math.max(0, (1.0 - regionState.morale) * 0.4);
        this.tweens.add({ targets: overlay, alpha: crimeAlpha, duration: 1000 });
      }
    });
  }
}
