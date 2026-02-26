"""
WorldSim — World Model
Mesa-based simulation orchestrator: terrain, agents, population, climate, tick loop.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from ..config import SimConfig, TERRAIN_TYPES
from .agents import GovernorAgent
from .climate import ClimateSystem
from .population import Population
from .resources import RegionResources
from .terrain import generate_terrain, get_terrain_modifiers


@dataclass
class Region:
    """A single grid cell with terrain, resources, population, and optional governor."""
    x: int
    y: int
    terrain: str
    climate_zone: str
    resources: RegionResources
    population: Population
    governor: Optional[GovernorAgent] = None

    @property
    def key(self) -> str:
        return f"{self.x}-{self.y}"

    def to_dict(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "terrain": self.terrain,
            "climate_zone": self.climate_zone,
            "resources": self.resources.to_dict(),
            "population": self.population.to_dict(),
            "governor": self.governor.to_dict() if self.governor else None,
        }


class WorldModel:
    """
    The main simulation model.
    Manages a grid of regions with resources, populations, governors, and climate.
    """

    def __init__(self, cfg: SimConfig | None = None):
        self.cfg = cfg or SimConfig()
        self.width = self.cfg.grid.width
        self.height = self.cfg.grid.height
        self.current_tick: int = 0
        self.running: bool = False
        self.ended: bool = False

        self.regions: Dict[str, Region] = {}
        self.agents: List[GovernorAgent] = []
        self.climate: ClimateSystem = ClimateSystem(self.cfg.climate)

        self._build_world()

    def _build_world(self) -> None:
        """Generate terrain, create regions, place agents."""
        terrain_grid, climate_grid = generate_terrain(
            self.cfg.grid, self.cfg.climate
        )

        # Create regions
        for y in range(self.height):
            for x in range(self.width):
                terrain_type = terrain_grid[y, x]
                climate_zone = climate_grid[y, x]
                mods = get_terrain_modifiers(terrain_type)

                resources = RegionResources(
                    food_max=self.cfg.resources.food_max,
                    food_regen=self.cfg.resources.food_regen,
                    water_max=self.cfg.resources.water_max,
                    water_regen=self.cfg.resources.water_regen,
                    food_mult=mods["food_mult"],
                    water_mult=mods["water_mult"],
                )

                pop_capacity = int(
                    self.cfg.population.max_per_region * mods["capacity_mult"]
                )
                initial_pop = min(
                    self.cfg.population.initial_per_region,
                    pop_capacity,
                )

                population = Population(
                    count=initial_pop,
                    health=1.0,
                    max_capacity=pop_capacity,
                )

                region = Region(
                    x=x, y=y,
                    terrain=terrain_type,
                    climate_zone=climate_zone,
                    resources=resources,
                    population=population,
                )
                self.regions[region.key] = region

        # Place governor agents on random regions
        region_keys = list(self.regions.keys())
        num_agents = min(self.cfg.num_agents, len(region_keys))
        chosen = random.sample(region_keys, num_agents)

        for i, rk in enumerate(chosen):
            agent = GovernorAgent(
                agent_id=i,
                region_key=rk,
                cfg=self.cfg.rl,
            )
            self.agents.append(agent)
            self.regions[rk].governor = agent

    def step(self) -> None:
        """Execute one simulation tick."""
        if not self.running or self.ended:
            return

        self.current_tick += 1

        # 1. Agent decisions
        for agent in self.agents:
            region = self.regions.get(agent.region_key)
            if region and region.population.is_alive:
                agent.step(region.resources, region.population, self.current_tick)

        # 2. Population tick for every region
        for region in self.regions.values():
            if not region.population.is_alive:
                continue

            # Compute food/water needs: 1 unit per person per tick
            pop = region.population.count
            food_needed = pop * 1.0
            water_needed = pop * 1.0

            food_consumed, water_consumed = region.population.tick(
                food_available=region.resources.food.value,
                water_available=region.resources.water.value,
                food_needed=food_needed,
                water_needed=water_needed,
                cfg=self.cfg.population,
            )

            # Deduct consumed resources
            region.resources.consume_food(food_consumed)
            region.resources.consume_water(water_consumed)

        # 3. Climate events
        for region in self.regions.values():
            # Maybe spawn new event
            self.climate.maybe_spawn_event(region.key, region.climate_zone)

            # Process active events
            effects = self.climate.tick_region(region.key)
            if "food" in effects:
                delta = effects["food"] * region.resources.food.max_value * 0.1
                region.resources.food.apply_event(delta)
            if "water" in effects:
                delta = effects["water"] * region.resources.water.max_value * 0.1
                region.resources.water.apply_event(delta)

        # 4. Resource regeneration
        for region in self.regions.values():
            region.resources.regenerate_all()

        # 5. Migration: agents requesting migrate_out move pop to best neighbor
        self._process_migration()

        # 6. Check end condition
        dead_regions = sum(
            1 for r in self.regions.values() if not r.population.is_alive
        )
        total = len(self.regions)
        if total > 0 and dead_regions / total >= self.cfg.collapse_threshold:
            self.ended = True
            self.running = False

    def _process_migration(self) -> None:
        """Handle population migration between regions."""
        cfg = self.cfg.population

        for region in self.regions.values():
            if not region.population.is_alive:
                continue

            should_migrate = False

            # Governor-requested migration
            if region.governor and region.governor.last_action == "migrate_out":
                should_migrate = True

            # Health-triggered migration
            if region.population.health < cfg.migration_threshold:
                should_migrate = True

            if not should_migrate:
                region.population.migrants_out = 0
                continue

            # Find best neighbor
            neighbors = self._get_neighbors(region.x, region.y)
            if not neighbors:
                continue

            # Pick neighbor with highest food+water per capita
            best = max(
                neighbors,
                key=lambda n: (
                    (n.resources.total_value / max(1, n.population.count))
                    if n.population.count < n.population.max_capacity
                    else 0
                ),
            )

            if best.population.count >= best.population.max_capacity:
                continue

            migrants = region.population.emigrate(
                int(region.population.count * cfg.migration_rate)
            )
            best.population.immigrate(migrants)

    def _get_neighbors(self, x: int, y: int) -> List[Region]:
        """Get adjacent regions (4-directional)."""
        neighbors = []
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            key = f"{nx}-{ny}"
            if key in self.regions:
                neighbors.append(self.regions[key])
        return neighbors

    def start(self) -> None:
        self.running = True

    def pause(self) -> None:
        self.running = False

    def reset(self) -> None:
        """Fully reinitialize the world."""
        self.current_tick = 0
        self.running = False
        self.ended = False
        self.regions.clear()
        self.agents.clear()
        self.climate.reset()
        self._build_world()

    def get_state(self) -> dict:
        """Full serialized world state for WebSocket broadcast."""
        return {
            "tick": self.current_tick,
            "running": self.running,
            "ended": self.ended,
            "width": self.width,
            "height": self.height,
            "num_agents": len(self.agents),
            "total_population": sum(
                r.population.count for r in self.regions.values()
            ),
            "regions": {
                key: region.to_dict()
                for key, region in self.regions.items()
            },
            "agents": [a.to_dict() for a in self.agents],
            "climate_events": {
                key: self.climate.get_region_events(key)
                for key in self.regions
                if self.climate.get_region_events(key)
            },
        }

    def get_compact_state(self) -> dict:
        """
        Compact state for efficient WebSocket broadcast.
        Regions as flat arrays instead of nested objects (~5x smaller).
        """
        # Pack region data into parallel arrays for minimal JSON size
        keys = []
        terrains = []
        food_pcts = []
        water_pcts = []
        pops = []
        healths = []

        for key, region in self.regions.items():
            keys.append(key)
            terrains.append(region.terrain[0])  # first char: m/h/p/d/s/r/l
            food_pcts.append(round(region.resources.food.pct, 1))
            water_pcts.append(round(region.resources.water.pct, 1))
            pops.append(region.population.count)
            healths.append(round(region.population.health, 2))

        return {
            "tick": self.current_tick,
            "running": self.running,
            "ended": self.ended,
            "width": self.width,
            "height": self.height,
            "total_population": sum(pops),
            "r_keys": keys,
            "r_terrain": terrains,
            "r_food": food_pcts,
            "r_water": water_pcts,
            "r_pop": pops,
            "r_health": healths,
            "agents": [a.to_dict() for a in self.agents],
            "climate_events": {
                key: self.climate.get_region_events(key)
                for key in self.regions
                if self.climate.get_region_events(key)
            },
        }

    def get_summary(self) -> dict:
        """Lightweight status for polling."""
        alive = sum(1 for r in self.regions.values() if r.population.is_alive)
        total_pop = sum(r.population.count for r in self.regions.values())
        return {
            "tick": self.current_tick,
            "running": self.running,
            "ended": self.ended,
            "width": self.width,
            "height": self.height,
            "num_agents": len(self.agents),
            "total_population": total_pop,
            "alive_regions": alive,
            "total_regions": len(self.regions),
        }

    # Backward-compat stubs used by old main.py during transition
    def load_config(self) -> None:
        pass

    def run(self) -> None:
        self.start()
