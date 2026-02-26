/**
 * WorldSim — Isometric Tile Map Renderer
 * Renders 64x64 grid as isometric diamond tiles with terrain colors,
 * resource indicators, and population/agent overlays.
 */

import Phaser from 'phaser';
import { RegionState, WorldState, TERRAIN_COLORS, STRATEGY_COLORS } from '../types/simulation';

// Isometric tile dimensions
const TILE_W = 32;
const TILE_H = 16;

export class IsometricMap {
  private scene: Phaser.Scene;
  private tileGroup: Phaser.GameObjects.Group;
  private overlayGroup: Phaser.GameObjects.Group;
  private tiles: Map<string, Phaser.GameObjects.Polygon> = new Map();
  private popDots: Map<string, Phaser.GameObjects.Arc> = new Map();
  private agentMarkers: Map<string, Phaser.GameObjects.Arc> = new Map();
  private resourceBars: Map<string, { food: Phaser.GameObjects.Rectangle; water: Phaser.GameObjects.Rectangle }> = new Map();
  private gridWidth = 0;
  private gridHeight = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.tileGroup = scene.add.group();
    this.overlayGroup = scene.add.group();
  }

  /** Convert grid coords to isometric screen position */
  gridToIso(gx: number, gy: number): { x: number; y: number } {
    return {
      x: (gx - gy) * (TILE_W / 2),
      y: (gx + gy) * (TILE_H / 2),
    };
  }

  /** Convert screen position to grid coords */
  isoToGrid(sx: number, sy: number): { gx: number; gy: number } {
    const gx = Math.floor(sx / TILE_W + sy / TILE_H) ;
    const gy = Math.floor(sy / TILE_H - sx / TILE_W);
    return { gx, gy };
  }

  /** Build the initial tile grid from world state */
  buildGrid(state: WorldState): void {
    this.gridWidth = state.width;
    this.gridHeight = state.height;

    // Diamond polygon points (relative to center)
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    for (const [key, region] of Object.entries(state.regions)) {
      const { x, y } = this.gridToIso(region.x, region.y);
      const color = TERRAIN_COLORS[region.terrain] ?? 0x888888;

      // Create diamond tile
      const tile = this.scene.add.polygon(x, y, [
        { x: 0, y: -hh },   // top
        { x: hw, y: 0 },    // right
        { x: 0, y: hh },    // bottom
        { x: -hw, y: 0 },   // left
      ], color, 0.9);
      tile.setStrokeStyle(1, 0x000000, 0.3);
      tile.setData('regionKey', key);
      tile.setInteractive(
        new Phaser.Geom.Polygon([
          { x: 0, y: -hh },
          { x: hw, y: 0 },
          { x: 0, y: hh },
          { x: -hw, y: 0 },
        ]),
        Phaser.Geom.Polygon.Contains
      );

      this.tileGroup.add(tile);
      this.tiles.set(key, tile);

      // Resource bars (tiny indicators on each tile)
      const foodBar = this.scene.add.rectangle(x - 5, y + 4, 4, 2, 0x2ECC71, 1);
      const waterBar = this.scene.add.rectangle(x + 5, y + 4, 4, 2, 0x3498DB, 1);
      this.overlayGroup.add(foodBar);
      this.overlayGroup.add(waterBar);
      this.resourceBars.set(key, { food: foodBar, water: waterBar });

      // Population dot (size scales with population)
      const popDot = this.scene.add.circle(x, y - 2, 1, 0xFFFFFF, 0.7);
      this.overlayGroup.add(popDot);
      this.popDots.set(key, popDot);
    }
  }

  /** Update tile visuals from new state */
  updateState(state: WorldState): void {
    for (const [key, region] of Object.entries(state.regions)) {
      this.updateTile(key, region);
    }

    // Update agent markers
    this.updateAgentMarkers(state);
  }

  private updateTile(key: string, region: RegionState): void {
    const tile = this.tiles.get(key);
    if (!tile) return;

    // Adjust tile color based on resource health
    const baseColor = TERRAIN_COLORS[region.terrain] ?? 0x888888;
    const healthFactor = region.population.health;
    const dimmedColor = this.dimColor(baseColor, 0.3 + healthFactor * 0.7);
    tile.setFillStyle(dimmedColor, 0.9);

    // Critical regions get a red stroke
    if (region.resources.food.is_critical || region.resources.water.is_critical) {
      tile.setStrokeStyle(1, 0xFF4444, 0.8);
    } else {
      tile.setStrokeStyle(1, 0x000000, 0.3);
    }

    // Update resource bars
    const bars = this.resourceBars.get(key);
    if (bars) {
      const foodPct = region.resources.food.pct / 100;
      const waterPct = region.resources.water.pct / 100;
      bars.food.setScale(foodPct, 1);
      bars.food.setAlpha(0.3 + foodPct * 0.7);
      bars.water.setScale(waterPct, 1);
      bars.water.setAlpha(0.3 + waterPct * 0.7);
    }

    // Update population dot
    const popDot = this.popDots.get(key);
    if (popDot) {
      const popRatio = region.population.count / Math.max(1, region.population.max_capacity);
      const radius = Math.max(0.5, popRatio * 4);
      popDot.setRadius(radius);
      popDot.setAlpha(region.population.count > 0 ? 0.8 : 0);

      // Color based on health
      if (region.population.health > 0.7) {
        popDot.setFillStyle(0xFFFFFF, 0.8);
      } else if (region.population.health > 0.3) {
        popDot.setFillStyle(0xFFCC00, 0.8);
      } else {
        popDot.setFillStyle(0xFF4444, 0.8);
      }
    }
  }

  private updateAgentMarkers(state: WorldState): void {
    // Remove old markers
    for (const marker of this.agentMarkers.values()) {
      marker.destroy();
    }
    this.agentMarkers.clear();

    // Create markers for agents
    for (const agent of state.agents) {
      const region = state.regions[agent.region_key];
      if (!region) continue;

      const { x, y } = this.gridToIso(region.x, region.y);
      const color = STRATEGY_COLORS[agent.strategy] ?? 0xFFFFFF;

      const marker = this.scene.add.circle(x, y - 6, 3, color, 1);
      marker.setStrokeStyle(1, 0xFFFFFF, 0.9);
      this.overlayGroup.add(marker);
      this.agentMarkers.set(agent.region_key, marker);
    }
  }

  /** Dim a hex color by a factor (0-1) */
  private dimColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xFF) * factor);
    const g = Math.floor(((color >> 8) & 0xFF) * factor);
    const b = Math.floor((color & 0xFF) * factor);
    return (r << 16) | (g << 8) | b;
  }

  /** Get world bounds for camera clamping */
  getWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const topLeft = this.gridToIso(0, this.gridHeight - 1);
    const topRight = this.gridToIso(this.gridWidth - 1, 0);
    const bottomLeft = this.gridToIso(0, 0);
    const bottomRight = this.gridToIso(this.gridWidth - 1, this.gridHeight - 1);

    return {
      minX: topLeft.x - TILE_W,
      maxX: topRight.x + TILE_W,
      minY: Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) - TILE_H * 2,
      maxY: Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + TILE_H * 2,
    };
  }

  /** Get region key at a screen position */
  getRegionAtScreen(worldX: number, worldY: number): string | null {
    const { gx, gy } = this.isoToGrid(worldX, worldY);
    if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
      return `${gx}-${gy}`;
    }
    return null;
  }
}
