"""
WorldSim — Population Model
Birth, death, health, and migration dynamics.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..config import PopulationConfig


@dataclass
class Population:
    """Population state for a single region."""
    count: int = 50
    health: float = 1.0  # 0.0 = dead, 1.0 = perfect health
    max_capacity: int = 500

    # Per-tick tracking
    births: int = 0
    deaths: int = 0
    migrants_in: int = 0
    migrants_out: int = 0

    @property
    def is_alive(self) -> bool:
        return self.count > 0

    @property
    def density(self) -> float:
        """Population as fraction of carrying capacity."""
        return self.count / max(1, self.max_capacity)

    def tick(
        self,
        food_available: float,
        water_available: float,
        food_needed: float,
        water_needed: float,
        cfg: PopulationConfig,
    ) -> tuple[float, float]:
        """
        Process one tick of population dynamics.
        Returns (food_consumed, water_consumed).
        """
        if self.count <= 0:
            self.health = 0.0
            self.births = self.deaths = 0
            return 0.0, 0.0

        # Resource consumption: each person needs a base amount
        food_per_person = food_needed / max(1, self.count)
        water_per_person = water_needed / max(1, self.count)

        food_ratio = min(1.0, food_available / max(1.0, food_needed))
        water_ratio = min(1.0, water_available / max(1.0, water_needed))

        food_consumed = min(food_available, food_needed)
        water_consumed = min(water_available, water_needed)

        # Health dynamics
        if food_ratio < 0.5:
            self.health -= cfg.health_decay_no_food * (1.0 - food_ratio)
        if water_ratio < 0.5:
            self.health -= cfg.health_decay_no_water * (1.0 - water_ratio)
        if food_ratio > 0.7 and water_ratio > 0.7:
            self.health += cfg.health_regen_rate

        self.health = max(0.0, min(1.0, self.health))

        # Death rate: base + starvation/dehydration modifiers
        death_rate = cfg.base_death_rate
        if food_ratio < 0.3:
            death_rate += cfg.starvation_death_rate * (1.0 - food_ratio)
        if water_ratio < 0.3:
            death_rate += cfg.dehydration_death_rate * (1.0 - water_ratio)
        # Low health increases death rate
        if self.health < 0.3:
            death_rate += 0.02 * (1.0 - self.health)

        self.deaths = int(self.count * death_rate)

        # Birth rate: modulated by health and resource availability
        effective_birth = cfg.base_birth_rate * self.health * min(food_ratio, water_ratio)
        # Density-dependent: births slow as population approaches capacity
        density_penalty = 1.0 - (self.density ** 2)
        effective_birth *= max(0.0, density_penalty)

        self.births = int(self.count * effective_birth)

        # Apply changes
        self.count = max(0, self.count + self.births - self.deaths)

        return food_consumed, water_consumed

    def emigrate(self, count: int) -> int:
        """Remove migrants from this region. Returns actual number removed."""
        actual = min(count, max(0, self.count - 1))  # keep at least 1
        self.count -= actual
        self.migrants_out = actual
        return actual

    def immigrate(self, count: int) -> None:
        """Add migrants to this region."""
        space = max(0, self.max_capacity - self.count)
        actual = min(count, space)
        self.count += actual
        self.migrants_in = actual

    def to_dict(self) -> dict:
        return {
            "count": self.count,
            "health": round(self.health, 3),
            "max_capacity": self.max_capacity,
            "density": round(self.density, 3),
            "births": self.births,
            "deaths": self.deaths,
            "migrants_in": self.migrants_in,
            "migrants_out": self.migrants_out,
        }
