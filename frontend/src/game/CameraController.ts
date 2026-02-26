/**
 * WorldSim — Camera Controller
 * Pan with WASD/arrows/mouse-drag, zoom with scroll wheel.
 */

import Phaser from 'phaser';

export class CameraController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private panSpeed = 8;
  private zoomSpeed = 0.05;
  private minZoom = 0.3;
  private maxZoom = 3.0;
  private bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.setupKeys();
    this.setupMouse();
  }

  private setupKeys(): void {
    if (!this.scene.input.keyboard) return;
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private setupMouse(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.isDragging = true;
        this.dragStart.x = pointer.x;
        this.dragStart.y = pointer.y;
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = (this.dragStart.x - pointer.x) / this.cam.zoom;
        const dy = (this.dragStart.y - pointer.y) / this.cam.zoom;
        this.cam.scrollX += dx;
        this.cam.scrollY += dy;
        this.dragStart.x = pointer.x;
        this.dragStart.y = pointer.y;
        this.clampCamera();
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown() && !pointer.middleButtonDown()) {
        this.isDragging = false;
      }
    });

    // Scroll zoom
    this.scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: any, _gx: number, _gy: number, deltaY: number) => {
      const newZoom = Phaser.Math.Clamp(
        this.cam.zoom - deltaY * this.zoomSpeed * 0.01,
        this.minZoom,
        this.maxZoom
      );
      this.cam.setZoom(newZoom);
      this.clampCamera();
    });
  }

  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.bounds = { minX, minY, maxX, maxY };
  }

  update(): void {
    const speed = this.panSpeed / this.cam.zoom;

    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      this.cam.scrollX -= speed;
    }
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      this.cam.scrollX += speed;
    }
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      this.cam.scrollY -= speed;
    }
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      this.cam.scrollY += speed;
    }

    this.clampCamera();
  }

  private clampCamera(): void {
    if (!this.bounds) return;
    const b = this.bounds;
    const halfW = this.cam.width / (2 * this.cam.zoom);
    const halfH = this.cam.height / (2 * this.cam.zoom);

    this.cam.scrollX = Phaser.Math.Clamp(this.cam.scrollX, b.minX - halfW, b.maxX - halfW);
    this.cam.scrollY = Phaser.Math.Clamp(this.cam.scrollY, b.minY - halfH, b.maxY - halfH);
  }

  centerOn(x: number, y: number): void {
    this.cam.centerOn(x, y);
    this.clampCamera();
  }
}
