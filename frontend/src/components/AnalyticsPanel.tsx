import { useSimulationStore } from '../hooks/useSimulation'
import { RegionState } from '../types'

const AnalyticsPanel: React.FC = () => {
  const { agents, regions, tick } = useSimulationStore()

  // Calculate aggregate statistics
  const getAggregateStats = () => {
    const regionList = Object.values(regions) as RegionState[]
    const totalResources = regionList.reduce((sum, region) => {
      return sum + Object.values(region.resources).reduce((rSum, r) => rSum + r.current, 0)
    }, 0)

    const avgResources = regionList.length
      ? totalResources / regionList.length
      : 0

    const criticalRegions = regionList.filter((r) =>
      Object.values(r.resources).some((res) => res.current < res.max * 0.2)
    ).length

    return {
      totalResources,
      avgResources,
      criticalRegions,
      regionCount: regionList.length,
    }
  }

  const stats = getAggregateStats()

  return (
    <div className="analytics-panel">
      <h2>Analytics</h2>

      <div className="stats-grid">
        <StatCard title="Total Resources" value={stats.totalResources.toFixed(0)} />
        <StatCard
          title="Avg Resources/Region"
          value={stats.avgResources.toFixed(0)}
        />
        <StatCard
          title="Critical Regions"
          value={stats.criticalRegions.toString()}
          highlight={stats.criticalRegions > 0}
        />
        <StatCard title="Active Agents" value={agents.length.toString()} />
      </div>

      <div className="agents-list">
        <h3>Agent Status</h3>
        <div className="agents-grid">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      <div className="ticks-counter">
        <h3>Simulation Ticks</h3>
        <div className="tick-counter-display">{tick}</div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  highlight?: boolean
}

const StatCard: React.FC<StatCardProps> = ({ title, value, highlight }) => (
  <div className={`stat-card ${highlight ? 'highlight' : ''}`}>
    <div className="stat-title">{title}</div>
    <div className="stat-value">{value}</div>
  </div>
)

interface AgentCardProps {
  agent: any
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const getStrategyColor = (strategy: string) => {
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

  const getResourceStatus = (resources: any) => {
    const total = Object.values(resources).reduce(
      (sum: number, r: any) => sum + r.current,
      0
    )
    const max = Object.values(resources).reduce(
      (sum: number, r: any) => sum + r.max,
      0
    )
    return Math.round((total / max) * 100)
  }

  const resourceStatus = getResourceStatus(agent.resources)

  return (
    <div className="agent-card">
      <div
        className="agent-indicator"
        style={{ backgroundColor: getStrategyColor(agent.strategy) }}
      >
        {agent.name}
      </div>
      <div className="agent-stats">
        <div className="resource-bar">
          <div
            className="resource-fill"
            style={{ width: `${resourceStatus}%` }}
          ></div>
        </div>
        <div className="resource-text">
          Resources: {resourceStatus}% of capacity
        </div>
      </div>
      <div className="agent-region">Region: {agent.region_id}</div>
    </div>
  )
}

export default AnalyticsPanel
