"""
WorldSim — Climate System
Climate zones, stochastic events, and their effects on regions.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from ..config import CLIMATE_EVENT_EFFECTS, ClimateConfig


@dataclass
class ClimateEvent:
    """An active climate event affecting a region."""
    name: str
    severity: float
    duration: int  # ticks remaining
    initial_duration: int

    @property
    def intensity(self) -> float:
        """Linearly decreasing intensity as event fades."""
        if self.initial_duration <= 0:
            return 0.0
        return self.severity * (self.duration / self.initial_duration)

    @property
    def is_active(self) -> bool:
        return self.duration > 0

    def tick(self) -> Dict[str, float]:
        """
        Process one tick. Returns resource effects dict.
        Keys: 'food', 'water' with float multipliers to apply.
        """
        if not self.is_active:
            return {}

        effects = CLIMATE_EVENT_EFFECTS.get(self.name, {})
        result = {}
        for resource, base_effect in effects.items():
            result[resource] = base_effect * self.intensity

        self.duration -= 1
        return result

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "severity": round(self.severity, 3),
            "duration": self.duration,
            "initial_duration": self.initial_duration,
            "intensity": round(self.intensity, 3),
        }


class ClimateSystem:
    """Manages climate events across the world grid."""

    def __init__(self, cfg: ClimateConfig):
        self.cfg = cfg
        # region_key -> list of active events
        self.active_events: Dict[str, List[ClimateEvent]] = {}

    def maybe_spawn_event(self, region_key: str, climate_zone: str) -> ClimateEvent | None:
        """Roll for a new climate event at a region. Returns event if spawned."""
        if random.random() > self.cfg.event_probability:
            return None

        # Climate zone influences which events are more likely
        event_type = self._pick_event_for_zone(climate_zone)
        severity = random.uniform(self.cfg.min_severity, self.cfg.max_severity)
        duration = random.randint(self.cfg.min_duration, self.cfg.max_duration)

        event = ClimateEvent(
            name=event_type,
            severity=severity,
            duration=duration,
            initial_duration=duration,
        )

        if region_key not in self.active_events:
            self.active_events[region_key] = []
        self.active_events[region_key].append(event)
        return event

    def _pick_event_for_zone(self, zone: str) -> str:
        """Weighted event selection based on climate zone."""
        zone_weights = {
            "tropical":     {"drought": 0.1, "flood": 0.35, "heatwave": 0.25, "frost": 0.05, "storm": 0.25},
            "arid":         {"drought": 0.45, "flood": 0.05, "heatwave": 0.30, "frost": 0.05, "storm": 0.15},
            "temperate":    {"drought": 0.15, "flood": 0.20, "heatwave": 0.15, "frost": 0.20, "storm": 0.30},
            "continental":  {"drought": 0.15, "flood": 0.15, "heatwave": 0.15, "frost": 0.35, "storm": 0.20},
            "polar":        {"drought": 0.05, "flood": 0.10, "heatwave": 0.05, "frost": 0.50, "storm": 0.30},
        }
        weights = zone_weights.get(zone, zone_weights["temperate"])
        events = list(weights.keys())
        probs = [weights[e] for e in events]
        return random.choices(events, weights=probs, k=1)[0]

    def tick_region(self, region_key: str) -> Dict[str, float]:
        """
        Process all active events for a region.
        Returns cumulative resource effects: {'food': delta, 'water': delta}.
        """
        if region_key not in self.active_events:
            return {}

        cumulative: Dict[str, float] = {}
        still_active = []

        for event in self.active_events[region_key]:
            effects = event.tick()
            for resource, delta in effects.items():
                cumulative[resource] = cumulative.get(resource, 0.0) + delta
            if event.is_active:
                still_active.append(event)

        self.active_events[region_key] = still_active
        return cumulative

    def get_region_events(self, region_key: str) -> List[dict]:
        """Get serialized active events for a region."""
        return [e.to_dict() for e in self.active_events.get(region_key, [])]

    def reset(self) -> None:
        self.active_events.clear()
