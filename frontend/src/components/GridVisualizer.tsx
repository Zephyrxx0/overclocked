import { useRef, useEffect } from 'react'
import { useSimulationStore } from '../hooks/useSimulation'
import { RegionState } from '../types'

interface GridVisualizerProps {
  cellSize?: number
}

const GridVisualizer: React.FC<GridVisualizerProps> = ({ cellSize = 80 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { regions, width, height, loading } = useSimulationStore()

  // Get resource color based on level
  const getResourceColor = (current: number, max: number, type: string): string => {
    const ratio = current / max
    if (type === 'water') {
      return `rgba(0, 100, 255, ${0.3 + ratio * 0.7})`
    } else if (type === 'food') {
      return `rgba(50, 205, 50, ${0.3 + ratio * 0.7})`
    } else if (type === 'energy') {
      return `rgba(255, 215, 0, ${0.3 + ratio * 0.7})`
    } else {
      // land
      return `rgba(139, 69, 19, ${0.3 + ratio * 0.7})`
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || loading) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Calculate grid dimensions
    const gridWidth = width * cellSize
    const gridHeight = height * cellSize
    const offsetX = (canvas.width - gridWidth) / 2
    const offsetY = (canvas.height - gridHeight) / 2

    // Draw regions
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = `${x}-${y}`
        const region = regions[key] as RegionState | undefined

        const posX = offsetX + x * cellSize
        const posY = offsetY + y * cellSize

        // Draw cell background
        ctx.fillStyle = '#2a2a3a'
        ctx.fillRect(posX, posY, cellSize, cellSize)

        // Draw border
        ctx.strokeStyle = '#444'
        ctx.lineWidth = 2
        ctx.strokeRect(posX, posY, cellSize, cellSize)

        if (region) {
          // Draw resource indicators
          const resources = region.resources
          const cellCenter = cellSize / 2

          // Water (top left)
          ctx.fillStyle = getResourceColor(
            resources.water.current,
            resources.water.max,
            'water'
          )
          ctx.fillRect(posX + 4, posY + 4, 18, 18)

          // Food (top right)
          ctx.fillStyle = getResourceColor(
            resources.food.current,
            resources.food.max,
            'food'
          )
          ctx.fillRect(posX + cellSize - 22, posY + 4, 18, 18)

          // Energy (bottom left)
          ctx.fillStyle = getResourceColor(
            resources.energy.current,
            resources.energy.max,
            'energy'
          )
          ctx.fillRect(posX + 4, posY + cellSize - 22, 18, 18)

          // Land (bottom right)
          ctx.fillStyle = getResourceColor(
            resources.land.current,
            resources.land.max,
            'land'
          )
          ctx.fillRect(posX + cellSize - 22, posY + cellSize - 22, 18, 18)

          // Draw agent indicator
          if (region.has_agent) {
            ctx.fillStyle = '#fff'
            ctx.beginPath()
            ctx.arc(
              posX + cellCenter,
              posY + cellCenter,
              cellSize * 0.15,
              0,
              Math.PI * 2
            )
            ctx.fill()

            // Strategy indicator ring
            ctx.strokeStyle = getStrategyColor(region.agent_strategy)
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(
              posX + cellCenter,
              posY + cellCenter,
              cellSize * 0.25,
              0,
              Math.PI * 2
            )
            ctx.stroke()
          }
        }
      }
    }
  }, [regions, width, height, loading, cellSize])

  return (
    <div className="grid-visualizer">
      <h2>World Grid</h2>
      <div className="grid-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="simulation-canvas"
        />
      </div>
      <div className="legend">
        <div className="legend-item">
          <div className="legend-color water"></div>
          <span>Water</span>
        </div>
        <div className="legend-item">
          <div className="legend-color food"></div>
          <span>Food</span>
        </div>
        <div className="legend-item">
          <div className="legend-color energy"></div>
          <span>Energy</span>
        </div>
        <div className="legend-item">
          <div className="legend-color land"></div>
          <span>Land</span>
        </div>
        <div className="legend-item">
          <div className="legend-color agent"></div>
          <span>Agent</span>
        </div>
      </div>
    </div>
  )
}

function getStrategyColor(strategy: string | null): string {
  switch (strategy) {
    case 'defensive':
      return '#4a90e2'
    case 'expansive':
      return '#50e3c2'
    case 'negotiator':
      return '#f5a623'
    case 'extractive':
      return '#d0021b'
    default:
      return '#999'
  }
}

export default GridVisualizer
