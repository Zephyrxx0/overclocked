"""
WorldSim — Pydantic schemas for API responses.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel


class ResourceState(BaseModel):
    value: float
    max_value: float
    pct: float
    is_critical: bool


class ResourcesState(BaseModel):
    food: ResourceState
    water: ResourceState


class PopulationState(BaseModel):
    count: int
    health: float
    max_capacity: int
    density: float
    births: int
    deaths: int
    migrants_in: int
    migrants_out: int


class AgentState(BaseModel):
    agent_id: int
    name: str
    region_key: str
    strategy: str
    epsilon: float
    total_reward: float
    decisions: int


class ClimateEventState(BaseModel):
    name: str
    severity: float
    duration: int
    initial_duration: int
    intensity: float


class RegionState(BaseModel):
    x: int
    y: int
    terrain: str
    climate_zone: str
    resources: ResourcesState
    population: PopulationState
    governor: Optional[AgentState] = None


class WorldState(BaseModel):
    tick: int
    running: bool
    ended: bool
    width: int
    height: int
    num_agents: int
    total_population: int
    regions: Dict[str, RegionState]
    agents: List[AgentState]
    climate_events: Dict[str, List[ClimateEventState]]


class WorldSummary(BaseModel):
    tick: int
    running: bool
    ended: bool
    width: int
    height: int
    num_agents: int
    total_population: int
    alive_regions: int
    total_regions: int


class HealthResponse(BaseModel):
    status: str
    simulation_running: bool


class ControlResponse(BaseModel):
    success: bool
    message: str
