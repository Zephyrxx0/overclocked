"""
WorldSim — Centralized Configuration
All simulation parameters in one place.
"""

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class GridConfig:
    width: int = 64
    height: int = 64


@dataclass
class ResourceDefaults:
    food_max: float = 1000.0
    food_regen: float = 5.0
    water_max: float = 1000.0
    water_regen: float = 5.0


@dataclass
class PopulationConfig:
    initial_per_region: int = 50
    max_per_region: int = 500
    base_birth_rate: float = 0.02
    base_death_rate: float = 0.01
    starvation_death_rate: float = 0.05
    dehydration_death_rate: float = 0.08
    health_decay_no_food: float = 0.03
    health_decay_no_water: float = 0.05
    health_regen_rate: float = 0.01
    migration_threshold: float = 0.3
    migration_rate: float = 0.1


@dataclass
class RLConfig:
    learning_rate: float = 0.1
    discount_factor: float = 0.95
    epsilon: float = 0.15
    epsilon_decay: float = 0.999
    epsilon_min: float = 0.01
    actions: List[str] = field(default_factory=lambda: [
        "focus_food",
        "focus_water",
        "balance_resources",
        "trade",
        "migrate_out",
        "stockpile",
    ])


@dataclass
class ClimateConfig:
    event_probability: float = 0.05
    event_types: List[str] = field(default_factory=lambda: [
        "drought", "flood", "heatwave", "frost", "storm",
    ])
    min_severity: float = 0.2
    max_severity: float = 0.8
    min_duration: int = 3
    max_duration: int = 12
    climate_zones: List[str] = field(default_factory=lambda: [
        "tropical", "arid", "temperate", "continental", "polar",
    ])


TERRAIN_TYPES: Dict[str, Dict[str, float]] = {
    "mountains":  {"food_mult": 0.3, "water_mult": 0.8, "capacity_mult": 0.3},
    "hilly":      {"food_mult": 0.6, "water_mult": 0.7, "capacity_mult": 0.5},
    "plains":     {"food_mult": 1.2, "water_mult": 0.8, "capacity_mult": 1.2},
    "desert":     {"food_mult": 0.2, "water_mult": 0.1, "capacity_mult": 0.2},
    "swamp":      {"food_mult": 0.5, "water_mult": 1.5, "capacity_mult": 0.4},
    "river":      {"food_mult": 0.9, "water_mult": 2.0, "capacity_mult": 0.8},
    "lake":       {"food_mult": 0.7, "water_mult": 2.5, "capacity_mult": 0.6},
}

CLIMATE_TERRAIN_WEIGHTS: Dict[str, Dict[str, float]] = {
    "tropical":     {"mountains": 0.05, "hilly": 0.10, "plains": 0.25, "desert": 0.05, "swamp": 0.30, "river": 0.15, "lake": 0.10},
    "arid":         {"mountains": 0.15, "hilly": 0.15, "plains": 0.15, "desert": 0.40, "swamp": 0.02, "river": 0.08, "lake": 0.05},
    "temperate":    {"mountains": 0.10, "hilly": 0.15, "plains": 0.35, "desert": 0.05, "swamp": 0.10, "river": 0.15, "lake": 0.10},
    "continental":  {"mountains": 0.20, "hilly": 0.20, "plains": 0.25, "desert": 0.10, "swamp": 0.05, "river": 0.10, "lake": 0.10},
    "polar":        {"mountains": 0.30, "hilly": 0.20, "plains": 0.15, "desert": 0.15, "swamp": 0.02, "river": 0.08, "lake": 0.10},
}

CLIMATE_EVENT_EFFECTS: Dict[str, Dict[str, float]] = {
    "drought":   {"food": -0.4, "water": -0.8},
    "flood":     {"food": -0.3, "water": 0.5},
    "heatwave":  {"food": -0.5, "water": -0.6},
    "frost":     {"food": -0.7, "water": -0.2},
    "storm":     {"food": -0.2, "water": 0.2},
}


@dataclass
class SimConfig:
    grid: GridConfig = field(default_factory=GridConfig)
    resources: ResourceDefaults = field(default_factory=ResourceDefaults)
    population: PopulationConfig = field(default_factory=PopulationConfig)
    rl: RLConfig = field(default_factory=RLConfig)
    climate: ClimateConfig = field(default_factory=ClimateConfig)
    num_agents: int = 20
    tick_interval: float = 1.0
    collapse_threshold: float = 0.8
