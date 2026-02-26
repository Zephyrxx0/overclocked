/**
 * WorldSim — Phaser Game Entry Point
 */

import Phaser from 'phaser';
import { WorldScene } from './game/WorldScene';
import { HUDScene } from './game/HUDScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [WorldScene, HUDScene],
  input: {
    mouse: {
      preventDefaultWheel: true,
    },
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
};

new Phaser.Game(config);
