/**
 * Phaser 3 Config for WorldSim
 * ----------------------------
 * pixelArt mode + device-pixel-ratio resolution = crisp pixel fonts.
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
    antialias: false,          // off → pixel-crisp edges
    pixelArt: true,            // no texture smoothing
    roundPixels: true,         // snap to whole pixels
  },
}
