/**
 * WorldSim — Main World Scene
 * Isometric world with camera controls, tile selection, and state updates.
 */

import Phaser from 'phaser';
import { IsometricMap } from './IsometricMap';
import { CameraController } from './CameraController';
import { HUDScene } from './HUDScene';
import { WebSocketClient } from '../network/WebSocketClient';
import { WorldState } from '../types/simulation';

export class WorldScene extends Phaser.Scene {
  private isoMap!: IsometricMap;
  private camCtrl!: CameraController;
  private wsClient!: WebSocketClient;
  private hudScene!: HUDScene;
  private worldState: WorldState | null = null;
  private initialized = false;
  private selectedTileKey: string | null = null;
  // Highlight ring for selected tile
  private selectionRing: Phaser.GameObjects.Arc | null = null;

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    this.isoMap = new IsometricMap(this);
    this.camCtrl = new CameraController(this);

    // Get HUD scene
    this.hudScene = this.scene.get('HUDScene') as HUDScene;
    this.hudScene.setControlCallback((action) => {
      this.wsClient.control(action);
    });

    // Connect WebSocket
    const wsUrl = `ws://${window.location.hostname}:${window.location.port || '8000'}/ws`;
    this.wsClient = new WebSocketClient(
      wsUrl,
      (state) => this.onStateUpdate(state),
      (status) => this.hudScene.updateConnectionStatus(status),
    );
    this.wsClient.connect();

    // Tile click selection
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !pointer.rightButtonDown()) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const key = this.isoMap.getRegionAtScreen(worldPoint.x, worldPoint.y);
        this.selectTile(key);
      }
    });

    // Right-click context menu prevention
    this.input.mouse?.disableContextMenu();
  }

  private onStateUpdate(state: WorldState): void {
    this.worldState = state;

    if (!this.initialized) {
      // First state received — build the grid
      this.isoMap.buildGrid(state);

      // Set camera bounds and center
      const bounds = this.isoMap.getWorldBounds();
      this.camCtrl.setBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);

      // Center camera on middle of map
      const center = this.isoMap.gridToIso(
        Math.floor(state.width / 2),
        Math.floor(state.height / 2)
      );
      this.camCtrl.centerOn(center.x, center.y);
      this.cameras.main.setZoom(1.0);

      this.initialized = true;
    }

    // Update visuals
    this.isoMap.updateState(state);
    this.hudScene.updateWorldState(state);
  }

  private selectTile(key: string | null): void {
    this.selectedTileKey = key;

    // Remove old selection ring
    if (this.selectionRing) {
      this.selectionRing.destroy();
      this.selectionRing = null;
    }

    if (key && this.worldState?.regions[key]) {
      const region = this.worldState.regions[key];
      const { x, y } = this.isoMap.gridToIso(region.x, region.y);
      this.selectionRing = this.add.circle(x, y, 10, 0x000000, 0)
        .setStrokeStyle(2, 0xFFFFFF, 1);
    }

    this.hudScene.selectTile(key);
  }

  update(): void {
    this.camCtrl.update();
  }

  shutdown(): void {
    this.wsClient?.disconnect();
  }
}
