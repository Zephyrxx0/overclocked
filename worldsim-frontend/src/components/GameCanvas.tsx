import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import GameScene from "../scenes/GameScene";
import type { WorldState } from "../types";
import "./GameCanvas.css";

interface GameCanvasProps {
  worldState: WorldState | null;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ worldState }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Phaser game
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
      backgroundColor: "#0a0a0a",
      scene: GameScene,
      render: {
        pixelArt: true,
        antialiasGL: false,
      },
      physics: {
        default: "arcade",
        arcade: {
          debug: false,
          gravity: { x: 0, y: 0 },
        },
      },
    };

    gameRef.current = new Phaser.Game(config);

    const handleWindowResize = () => {
      if (containerRef.current && gameRef.current) {
        gameRef.current.scale.resize(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight,
        );
      }
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Update world state in the game
  useEffect(() => {
    if (gameRef.current && worldState) {
      const scene = gameRef.current.scene.getScene("GameScene") as any;
      if (scene && scene.updateWorldState) {
        scene.updateWorldState(worldState);
      }
    }
  }, [worldState]);

  return (
    <div className="game-canvas-container">
      <div ref={containerRef} className="game-canvas" />
    </div>
  );
};

export default GameCanvas;
