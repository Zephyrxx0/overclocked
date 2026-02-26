import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { PHASER_CONFIG } from '../phaser/config'
import { IsoScene } from '../phaser/IsoScene'
import { useWorldStore } from '../store/useWorldStore'

export default function GameView() {
  const gameRef  = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<IsoScene | null>(null)
  const regions   = useWorldStore(s => s.regions)
  const isRunning = useWorldStore(s => s.isRunning)

  useEffect(() => {
    const scene = new IsoScene()
    sceneRef.current = scene
    gameRef.current = new Phaser.Game({ ...PHASER_CONFIG, scene: [scene] })
    return () => { gameRef.current?.destroy(true); gameRef.current = null; sceneRef.current = null }
  }, [])

  useEffect(() => {
    if (regions.length && sceneRef.current) sceneRef.current.applyWorldState(regions)
  }, [regions])

  useEffect(() => {
    sceneRef.current?.setRunning(isRunning)
  }, [isRunning])

  return <div id="phaser-container" className="w-full h-full" style={{ background:'#0d1117' }} />
}
