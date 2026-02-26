/**
 * WorldSim — HUD Scene
 * Overlay scene rendering UI elements: tick counter, population,
 * selected tile info, and control buttons.
 */

import Phaser from 'phaser';
import { WorldState, RegionState, TERRAIN_COLORS, STRATEGY_COLORS } from '../types/simulation';

export class HUDScene extends Phaser.Scene {
  // Top-left stats
  private tickText!: Phaser.GameObjects.Text;
  private popText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;

  // Selected tile panel
  private panelBg!: Phaser.GameObjects.Rectangle;
  private panelTexts: Phaser.GameObjects.Text[] = [];
  private selectedRegionKey: string | null = null;

  // Control buttons
  private startBtn!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Text;
  private resetBtn!: Phaser.GameObjects.Text;

  // Connection status
  private connText!: Phaser.GameObjects.Text;

  // Callbacks
  private onControl: ((action: 'start' | 'pause' | 'reset') => void) | null = null;

  private lastState: WorldState | null = null;

  constructor() {
    super({ key: 'HUDScene', active: true });
  }

  create(): void {
    const style = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' };
    const smallStyle = { fontFamily: 'monospace', fontSize: '12px', color: '#cccccc' };

    // Top-left stats
    this.tickText = this.add.text(10, 10, 'Tick: 0', style).setScrollFactor(0);
    this.popText = this.add.text(10, 28, 'Pop: 0', style).setScrollFactor(0);
    this.statusText = this.add.text(10, 46, 'Status: Paused', style).setScrollFactor(0);
    this.fpsText = this.add.text(10, 64, 'FPS: 0', smallStyle).setScrollFactor(0);

    // Connection indicator (top-right)
    this.connText = this.add.text(
      this.cameras.main.width - 10, 10, '● Connecting',
      { ...style, color: '#f39c12' }
    ).setOrigin(1, 0).setScrollFactor(0);

    // Control buttons (bottom-center)
    const btnY = this.cameras.main.height - 40;
    const centerX = this.cameras.main.width / 2;
    const btnStyle = {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
      backgroundColor: '#333333', padding: { x: 12, y: 6 },
    };

    this.startBtn = this.add.text(centerX - 120, btnY, '▶ Start', btnStyle)
      .setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onControl?.('start'))
      .on('pointerover', () => this.startBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => this.startBtn.setStyle({ backgroundColor: '#333333' }));

    this.pauseBtn = this.add.text(centerX, btnY, '⏸ Pause', btnStyle)
      .setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onControl?.('pause'))
      .on('pointerover', () => this.pauseBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => this.pauseBtn.setStyle({ backgroundColor: '#333333' }));

    this.resetBtn = this.add.text(centerX + 120, btnY, '↻ Reset', btnStyle)
      .setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onControl?.('reset'))
      .on('pointerover', () => this.resetBtn.setStyle({ backgroundColor: '#444444' }))
      .on('pointerout', () => this.resetBtn.setStyle({ backgroundColor: '#333333' }));

    // Selected tile panel (right side, initially hidden)
    const panelW = 220;
    const panelH = 260;
    const panelX = this.cameras.main.width - panelW - 10;
    const panelY = 40;

    this.panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.85)
      .setOrigin(0, 0).setScrollFactor(0).setVisible(false);
    this.panelBg.setStrokeStyle(1, 0x444466);

    // Pre-create panel text lines
    for (let i = 0; i < 14; i++) {
      const t = this.add.text(panelX + 10, panelY + 8 + i * 18, '', smallStyle)
        .setScrollFactor(0).setVisible(false);
      this.panelTexts.push(t);
    }
  }

  setControlCallback(cb: (action: 'start' | 'pause' | 'reset') => void): void {
    this.onControl = cb;
  }

  updateWorldState(state: WorldState): void {
    this.lastState = state;

    this.tickText.setText(`Tick: ${state.tick}`);
    this.popText.setText(`Pop: ${state.total_population.toLocaleString()}`);

    if (state.ended) {
      this.statusText.setText('Status: COLLAPSED').setColor('#ff4444');
    } else if (state.running) {
      this.statusText.setText('Status: Running').setColor('#2ecc71');
    } else {
      this.statusText.setText('Status: Paused').setColor('#f39c12');
    }

    // Update selected tile if one is selected
    if (this.selectedRegionKey && state.regions[this.selectedRegionKey]) {
      this.showTileInfo(this.selectedRegionKey, state.regions[this.selectedRegionKey]);
    }
  }

  updateConnectionStatus(status: string): void {
    const colors: Record<string, string> = {
      connecting: '#f39c12',
      connected: '#2ecc71',
      disconnected: '#e74c3c',
      error: '#e74c3c',
    };
    this.connText.setText(`● ${status.charAt(0).toUpperCase() + status.slice(1)}`);
    this.connText.setColor(colors[status] || '#ffffff');
  }

  selectTile(regionKey: string | null): void {
    this.selectedRegionKey = regionKey;
    if (!regionKey || !this.lastState) {
      this.panelBg.setVisible(false);
      this.panelTexts.forEach(t => t.setVisible(false));
      return;
    }
    const region = this.lastState.regions[regionKey];
    if (region) {
      this.showTileInfo(regionKey, region);
    }
  }

  private showTileInfo(key: string, region: RegionState): void {
    this.panelBg.setVisible(true);

    const lines = [
      `═ Region ${key} ═`,
      `Terrain: ${region.terrain}`,
      `Climate: ${region.climate_zone}`,
      ``,
      `Population: ${region.population.count}/${region.population.max_capacity}`,
      `Health: ${(region.population.health * 100).toFixed(1)}%`,
      `Births/Deaths: +${region.population.births}/-${region.population.deaths}`,
      ``,
      `Food: ${region.resources.food.pct.toFixed(1)}%${region.resources.food.is_critical ? ' ⚠' : ''}`,
      `Water: ${region.resources.water.pct.toFixed(1)}%${region.resources.water.is_critical ? ' ⚠' : ''}`,
      ``,
      region.governor ? `Governor: ${region.governor.name}` : 'No Governor',
      region.governor ? `Strategy: ${region.governor.strategy}` : '',
      region.governor ? `Reward: ${region.governor.total_reward.toFixed(1)}` : '',
    ];

    for (let i = 0; i < this.panelTexts.length; i++) {
      if (i < lines.length) {
        this.panelTexts[i].setText(lines[i]).setVisible(true);
        // Color code critical resources
        if (lines[i].includes('⚠')) {
          this.panelTexts[i].setColor('#ff4444');
        } else {
          this.panelTexts[i].setColor('#cccccc');
        }
      } else {
        this.panelTexts[i].setVisible(false);
      }
    }
  }

  update(): void {
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
  }
}
