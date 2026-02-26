/**
 * Phaser 3 Config for WorldSim
 * ----------------------------
 * Uses the AUTO renderer (WebGL preferred, Canvas fallback).
 * The IsoScene is injected at runtime.
 */

import Phaser from 'phaser'

export const PHASER_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#030712',
  parent: 'phaser-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
}
