import { useEffect } from 'react'
import { useSimulationStore } from './hooks/useSimulation'
import GridVisualizer from './components/GridVisualizer'
import AnalyticsPanel from './components/AnalyticsPanel'

function App() {
  const connect = useSimulationStore((state) => state.connect)

  useEffect(() => {
    connect()
    return () => {
      // Disconnect on unmount
      const disconnect = useSimulationStore.getState().disconnect
      disconnect()
    }
  }, [connect])

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>WorldSim</h1>
        <p>Adaptive Resource Scarcity & Agent Strategy Simulator</p>
      </header>

      <div className="main-content">
        <GridVisualizer />
        <AnalyticsPanel />
      </div>

      <div className="status-bar">
        <StatusIndicator />
        <Controls />
      </div>
    </div>
  )
}

function StatusIndicator() {
  const { running, tick, loading, error } = useSimulationStore()

  if (loading) return <span className="status loading">Connecting...</span>
  if (error) return <span className="status error">Error: {error}</span>

  return (
    <div className="status-info">
      <span className={`status ${running ? 'running' : 'paused'}`}>
        {running ? 'Running' : 'Paused'}
      </span>
      <span className="tick">Tick: {tick}</span>
    </div>
  )
}

function Controls() {
  const { running, startSimulation, pauseSimulation, resetSimulation } =
    useSimulationStore()

  return (
    <div className="controls">
      <button onClick={running ? pauseSimulation : startSimulation}>
        {running ? 'Pause' : 'Start'}
      </button>
      <button onClick={resetSimulation}>Reset</button>
    </div>
  )
}

export default App
