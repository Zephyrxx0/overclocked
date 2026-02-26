"""
WorldSim — Resource System
Food, Water with terrain-modified regeneration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass
class Resource:
    """Single resource with value, max, and terrain-modified regen."""
    value: float
    max_value: float
    base_regen: float
    regen_multiplier: float = 1.0

    @property
    def pct(self) -> float:
        return (self.value / self.max_value * 100.0) if self.max_value > 0 else 0.0

    @property
    def is_critical(self) -> bool:
        return self.pct < 20.0

    @property
    def is_empty(self) -> bool:
        return self.value <= 0.0

    @property
    def effective_regen(self) -> float:
        return self.base_regen * self.regen_multiplier

    def consume(self, amount: float) -> float:
        """Consume resource. Returns actual amount consumed."""
        actual = min(amount, self.value)
        self.value = max(0.0, self.value - amount)
        return actual

    def regenerate(self) -> float:
        """Regenerate resource up to max. Returns amount regenerated."""
        if self.value >= self.max_value:
            return 0.0
        regen = min(self.effective_regen, self.max_value - self.value)
        self.value += regen
        return regen

    def apply_event(self, change: float) -> None:
        """Apply a climate event change (positive or negative)."""
        self.value = max(0.0, min(self.max_value, self.value + change))

    def to_dict(self) -> dict:
        return {
            "value": round(self.value, 2),
            "max_value": self.max_value,
            "pct": round(self.pct, 2),
            "is_critical": self.is_critical,
        }


class RegionResources:
    """Manages food and water for a single region."""

    def __init__(
        self,
        food_max: float,
        food_regen: float,
        water_max: float,
        water_regen: float,
        food_mult: float = 1.0,
        water_mult: float = 1.0,
    ):
        self.food = Resource(
            value=food_max * food_mult,
            max_value=food_max,
            base_regen=food_regen,
            regen_multiplier=food_mult,
        )
        self.water = Resource(
            value=water_max * water_mult,
            max_value=water_max,
            base_regen=water_regen,
            regen_multiplier=water_mult,
        )

    def regenerate_all(self) -> None:
        self.food.regenerate()
        self.water.regenerate()

    def consume_food(self, amount: float) -> float:
        return self.food.consume(amount)

    def consume_water(self, amount: float) -> float:
        return self.water.consume(amount)

    @property
    def total_value(self) -> float:
        return self.food.value + self.water.value

    @property
    def has_critical(self) -> bool:
        return self.food.is_critical or self.water.is_critical

    def to_dict(self) -> Dict[str, dict]:
        return {"food": self.food.to_dict(), "water": self.water.to_dict()}
