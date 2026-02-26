"""
WorldSim Data Models — 5 Sovereign Regions with 4 Resources
"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
from enum import Enum
import numpy as np


# ─── Enums ─────────────────────────────────────────────────────────────────────

class ActionType(Enum):
    HOLD_CONSERVE       = 0   # save resources, reduce consumption
    PROPOSE_TRADE       = 1   # request trade with a neighbour
    EXPAND_INFRA        = 2   # invest resources to grow production
    STEAL_CONFLICT      = 3   # take from weaker neighbour


class WeatherEvent(Enum):
    NONE        = "none"
    DROUGHT     = "drought"        # –20% Water globally
    SOLAR_FLARE = "solar_flare"    # +20% Energy, –10% Food
    BLIGHT      = "blight"         # –30% Food in one region
    RAIN        = "rain"           # +15% Water in one region
    CALM        = "calm"           # morale bonus


# ─── Resources ─────────────────────────────────────────────────────────────────

@dataclass
class Resources:
    water:  float = 100.0
    food:   float = 100.0
    energy: float = 100.0
    land:   float = 100.0

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)

    def total(self) -> float:
        return self.water + self.food + self.energy + self.land

    def as_array(self) -> np.ndarray:
        return np.array([self.water, self.food, self.energy, self.land], dtype=np.float32)

    def clamp(self, lo: float = 0.0, hi: float = 300.0):
        self.water  = float(np.clip(self.water,  lo, hi))
        self.food   = float(np.clip(self.food,   lo, hi))
        self.energy = float(np.clip(self.energy, lo, hi))
        self.land   = float(np.clip(self.land,   lo, hi))


# ─── Region Config ─────────────────────────────────────────────────────────────

@dataclass
class RegionConfig:
    region_id:           str
    name:                str
    lore:                str       # flavour text shown in UI
    visual_theme:        str       # for Phaser renderer
    initial_resources:   Resources
    regen_rates:         Resources  # per-tick resource regeneration
    population_capacity: int
    base_morale:         float = 0.6

    def to_dict(self) -> Dict:
        return {
            "region_id":           self.region_id,
            "name":                self.name,
            "lore":                self.lore,
            "visual_theme":        self.visual_theme,
            "initial_resources":   self.initial_resources.to_dict(),
            "regen_rates":         self.regen_rates.to_dict(),
            "population_capacity": self.population_capacity,
        }


# ─── 5 Sovereign Region Configs ────────────────────────────────────────────────

REGION_CONFIGS: Dict[str, RegionConfig] = {

    "aquilonia": RegionConfig(
        region_id="aquilonia",
        name="Aquilonia",
        lore="The Sapphire Archipelago — Water-rich, Energy-poor",
        visual_theme="blue",
        initial_resources=Resources(water=270, food=100, energy=60,  land=120),
        regen_rates=Resources      (water=3.0,  food=1.0, energy=0.4, land=0.1),
        population_capacity=400,
        base_morale=0.70,
    ),

    "verdantis": RegionConfig(
        region_id="verdantis",
        name="Verdantis",
        lore="The Demeter Basin — Food-rich, Land-poor",
        visual_theme="green",
        initial_resources=Resources(water=110, food=270, energy=80,  land=60),
        regen_rates=Resources      (water=1.0,  food=3.0, energy=0.6, land=0.1),
        population_capacity=350,
        base_morale=0.65,
    ),

    "ignis_core": RegionConfig(
        region_id="ignis_core",
        name="Ignis Core",
        lore="The Voltarian Hub — Energy-rich, Water-poor",
        visual_theme="orange",
        initial_resources=Resources(water=60,  food=100, energy=270, land=100),
        regen_rates=Resources      (water=0.4,  food=0.8, energy=3.0, land=0.1),
        population_capacity=450,
        base_morale=0.60,
    ),

    "terranova": RegionConfig(
        region_id="terranova",
        name="Terranova",
        lore="The Obsidian Steppes — Land-rich, Food-poor",
        visual_theme="brown",
        initial_resources=Resources(water=100, food=60,  energy=90,  land=270),
        regen_rates=Resources      (water=0.8,  food=0.4, energy=0.8, land=0.5),
        population_capacity=300,
        base_morale=0.55,
    ),

    "nexus": RegionConfig(
        region_id="nexus",
        name="The Nexus",
        lore="The Crossroads — Balanced, Natural Trade Hub",
        visual_theme="silver",
        initial_resources=Resources(water=150, food=150, energy=150, land=150),
        regen_rates=Resources      (water=1.2,  food=1.2, energy=1.2, land=0.2),
        population_capacity=500,
        base_morale=0.75,
    ),
}


# ─── Region State (runtime) ────────────────────────────────────────────────────

@dataclass
class RegionState:
    region_id:          str
    name:               str
    visual_theme:       str
    resources:          Resources
    president_action:   int   = 0    # last PPO action chosen
    president_strategy: str   = "hold"
    morale:             float = 0.65
    trade_partners:     List[str] = field(default_factory=list)
    active_weather:     str   = "none"
    weather_ticks_left: int   = 0
    total_trades:       int   = 0
    total_conflicts:    int   = 0
    infrastructure:     float = 1.0   # production multiplier

    def to_dict(self) -> Dict:
        return {
            "region_id":          self.region_id,
            "name":               self.name,
            "visual_theme":       self.visual_theme,
            "resources":          self.resources.to_dict(),
            "president_action":   self.president_action,
            "president_strategy": self.president_strategy,
            "morale":             self.morale,
            "trade_partners":     self.trade_partners,
            "active_weather":     self.active_weather,
            "total_trades":       self.total_trades,
            "total_conflicts":    self.total_conflicts,
            "infrastructure":     self.infrastructure,
            # crime_level for legacy frontend compatibility
            "crime_level":        max(0, 100 - self.morale * 100),
            # legacy resource aliases
            "tribe_distribution": {},
            "energy_demand":      100.0,
            "energy_production":  self.resources.energy,
            "population":         100,
        }


# ─── Climate Event record ──────────────────────────────────────────────────────

@dataclass
class ClimateEvent:
    step:   int
    type:   str
    region: str   # "global" or specific region_id
    magnitude: float = 1.0
    description: str = ""

    def to_dict(self) -> Dict:
        return {
            "step":        self.step,
            "type":        self.type,
            "region":      self.region,
            "magnitude":   self.magnitude,
            "description": self.description,
        }
