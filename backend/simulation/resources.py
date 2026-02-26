"""
Resource management for WorldSim simulation.
Defines resource types and their behavior.
"""

from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class Resource:
    """Represents a single resource type with value and regeneration."""

    name: str
    initial_value: float
    max_value: float
    depletion_rate: float = 0.0  # Amount consumed per tick
    regeneration_rate: float = 0.0  # Amount regenerated per tick
    current_value: float = field(init=False)

    def __post_init__(self):
        self.current_value = self.initial_value

    def consume(self, amount: float = 0.0) -> float:
        """Consume resource. Returns actual amount consumed."""
        actual_consumed = min(amount, self.current_value)
        self.current_value -= actual_consumed
        return actual_consumed

    def regenerate(self) -> float:
        """Regenerate resource. Returns actual amount regenerated."""
        actual_regenerated = min(
            self.regeneration_rate, self.max_value - self.current_value
        )
        self.current_value += actual_regenerated
        return actual_regenerated

    def apply_event(self, change: float) -> float:
        """Apply a change to the resource (positive or negative)."""
        self.current_value = max(0.0, min(self.max_value, self.current_value + change))
        return self.current_value

    def to_dict(self) -> Dict:
        """Return resource state as dictionary."""
        return {
            "name": self.name,
            "current": self.current_value,
            "initial": self.initial_value,
            "max": self.max_value,
            "depletion_rate": self.depletion_rate,
            "regeneration_rate": self.regeneration_rate,
        }

    @property
    def is_critical(self) -> bool:
        """Check if resource is at critical level (< 20%)."""
        return self.current_value < (self.max_value * 0.2)

    @property
    def is_empty(self) -> bool:
        """Check if resource is depleted."""
        return self.current_value <= 0


class ResourceManager:
    """Manages multiple resource types for a region or agent."""

    def __init__(self, resources_config: Optional[Dict] = None):
        self.resources: Dict[str, Resource] = {}

        default_config = {
            "water": {
                "initial": 1000,
                "max": 1000,
                "regeneration_rate": 5.0,
            },
            "food": {
                "initial": 1000,
                "max": 1000,
                "regeneration_rate": 5.0,
            },
            "energy": {
                "initial": 1000,
                "max": 1000,
                "regeneration_rate": 5.0,
            },
            "land": {
                "initial": 100,
                "max": 100,
                "regeneration_rate": 0.1,
            },
        }

        config = resources_config or default_config

        for name, settings in config.items():
            self.resources[name] = Resource(
                name=name,
                initial_value=settings.get("initial", 1000),
                max_value=settings.get("max", 1000),
                regeneration_rate=settings.get("regeneration_rate", 0.0),
            )

    def get(self, name: str) -> Resource:
        """Get a specific resource."""
        return self.resources[name]

    def consume(self, name: str, amount: float) -> float:
        """Consume a specific resource."""
        return self.resources[name].consume(amount)

    def regenerate_all(self):
        """Regenerate all resources."""
        for resource in self.resources.values():
            resource.regenerate()

    def apply_event(self, name: str, change: float):
        """Apply an event change to a resource."""
        self.resources[name].apply_event(change)

    def get_all(self) -> Dict:
        """Get all resources as dictionary."""
        return {name: resource.to_dict() for name, resource in self.resources.items()}

    def to_dict(self) -> Dict:
        """Return all resource states."""
        return self.get_all()

    def total_resources(self) -> float:
        """Get sum of all resource values."""
        return sum(r.current_value for r in self.resources.values())
