import type { WorldState, RegionState } from "../types";

class SimulationStateService {
  private state: WorldState | null = null;

  setState(newState: WorldState) {
    this.state = newState;
  }

  getState(): WorldState | null {
    return this.state;
  }

  getRegion(regionId: string): RegionState | null {
    if (!this.state) return null;
    return this.state.regions[regionId] || null;
  }

  getRegionsList(): RegionState[] {
    if (!this.state) return [];
    return Object.values(this.state.regions);
  }

  getStep(): number {
    return this.state?.step || 0;
  }

  getTotalPopulation(): number {
    if (!this.state) return 0;
    return Object.values(this.state.regions).reduce(
      (sum, region) => sum + region.population,
      0,
    );
  }

  getAverageMorale(): number {
    if (!this.state) return 0;
    const regions = Object.values(this.state.regions);
    if (regions.length === 0) return 0;
    return (
      regions.reduce((sum, region) => sum + region.morale, 0) / regions.length
    );
  }

  getClimateEvents(limit: number = 10) {
    if (!this.state) return [];
    return this.state.climate_events.slice(-limit);
  }

  getTradeNetwork() {
    if (!this.state) return {};
    return this.state.trade_network;
  }
}

export default new SimulationStateService();
