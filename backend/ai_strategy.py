"""
ai_strategy.py  –  WorldSim President AI Strategies
----------------------------------------------------
Five sovereign-nation RL president strategies, each with a distinct personality
and reward focus. Each president has:
  - A unique decision policy (heuristic approximating trained PPO)
  - A short action memory to avoid repetitive loops
  - Probabilistic noise to feel natural and non-deterministic
  - Observable context: own resources, neighbour averages, crime alert, weather
"""

from __future__ import annotations

import logging
import math
import random
from collections import deque
from typing import Dict, Any, Deque

logger = logging.getLogger(__name__)

# ── Action labels per spec ─────────────────────────────────────────────────────
ACTIONS = ["Conserve", "Trade", "Expand", "Conflict"]

# ── Shared helper ─────────────────────────────────────────────────────────────

def _avg(obs: Dict[str, float], keys: list[str]) -> float:
    vals = [obs.get(k, 0.5) for k in keys]
    return sum(vals) / max(len(vals), 1)


def _weighted_choice(weights: Dict[str, float]) -> str:
    """Choose an action proportionally to its weight."""
    total = sum(weights.values())
    if total == 0:
        return random.choice(ACTIONS)
    r = random.random() * total
    cum = 0.0
    for action, w in weights.items():
        cum += w
        if r <= cum:
            return action
    return list(weights.keys())[-1]


# ── Base ───────────────────────────────────────────────────────────────────────

class PresidentStrategy:
    """Abstract base for all 5 nation presidents."""

    name: str = "President"
    region_id: str = "UNKNOWN"

    def __init__(self) -> None:
        self._history: Deque[str] = deque(maxlen=8)
        self._tick = 0

    def get_action(self, obs: Dict[str, Any], tick: int) -> str:
        self._tick = tick
        action = self._decide(obs)
        self._history.append(action)
        return action

    def _decide(self, obs: Dict[str, Any]) -> str:
        raise NotImplementedError

    # ── shared helpers ────────────────────────────────────────────────────────

    def _own_avg(self, obs: Dict[str, Any]) -> float:
        return _avg(obs, ["own_water", "own_food", "own_energy", "own_land"])

    def _min_resource(self, obs: Dict[str, Any]) -> tuple[str, float]:
        r = {
            "own_water": obs.get("own_water", 0.5),
            "own_food":  obs.get("own_food",  0.5),
            "own_energy":obs.get("own_energy",0.5),
            "own_land":  obs.get("own_land",  0.5),
        }
        key = min(r, key=lambda k: r[k])
        return key, r[key]

    def _last_n(self, action: str, n: int = 3) -> int:
        """Count how many of the last n actions match."""
        recent = list(self._history)[-n:]
        return recent.count(action)

    def _noise(self, p: float = 0.15) -> bool:
        """Returns True with probability p — used to inject organic randomness."""
        return random.random() < p

    def _oscillate(self) -> float:
        """Slow sinusoidal personality oscillation (0..1). Makes decisions drift."""
        return 0.5 + 0.5 * math.sin(self._tick * 0.07 + hash(self.region_id) % 100)


# ── Aquilonia — The Fortress ───────────────────────────────────────────────────

class AquiloniaStrategy(PresidentStrategy):
    """
    Water-rich fortress. Reward focus: Resource Hoarding & Border Integrity.
    Prefers Conserve when well-stocked; escalates to Conflict when threatened.
    Occasionally trades from surplus but never willingly expands.
    """
    name = "President Aldric"
    region_id = "AQUILONIA"

    def _decide(self, obs: Dict[str, Any]) -> str:
        own_avg    = self._own_avg(obs)
        crime      = obs.get("crime_level", 0.3)
        nb_avg     = obs.get("nb_avg_resources", 0.5)
        weather    = obs.get("weather_state", 0.0)
        oscillate  = self._oscillate()

        # Crisis retaliation — if a neighbour just attacked (their avg dropped fast)
        # or crime is very high → launch Conflict
        if crime > 0.72 and own_avg > 0.45:
            if self._last_n("Conflict") < 2:
                return "Conflict"

        # If any single resource is dangerously low → Trade
        _, min_val = self._min_resource(obs)
        if min_val < 0.22:
            return "Trade"

        # Hoarding core: when resources are abundant → Conserve
        if own_avg > 0.55 and not self._noise(0.1):
            # Occasionally trade surplus water to bond with tribe-mate
            if obs.get("own_water", 0.5) > 0.75 and oscillate > 0.7:
                return "Trade"
            return "Conserve"

        # drought wartime: conserve harder
        if weather > 0.6:
            return "Conserve"

        # Neighbour is thriving while Aquilonia suffers → Conflict
        if nb_avg > own_avg + 0.25:
            if self._last_n("Conflict") < 3:
                return "Conflict"

        weights = {"Conserve": 0.52 + oscillate * 0.15, "Trade": 0.25,
                   "Expand": 0.05, "Conflict": 0.18}
        return _weighted_choice(weights)


# ── Verdantis — The Equilibrium ───────────────────────────────────────────────

class VerdantisStrategy(PresidentStrategy):
    """
    Food-rich balanced nation. Reward focus: Balance across all 4 resources.
    Trades to fill gaps, conserves when balanced, rarely conflicts.
    """
    name = "President Sylvara"
    region_id = "VERDANTIS"

    def _decide(self, obs: Dict[str, Any]) -> str:
        own_water  = obs.get("own_water",  0.5)
        own_food   = obs.get("own_food",   0.7)
        own_energy = obs.get("own_energy", 0.5)
        own_land   = obs.get("own_land",   0.5)
        crime      = obs.get("crime_level", 0.2)
        weather    = obs.get("weather_state", 0.0)
        oscillate  = self._oscillate()

        resources  = [own_water, own_food, own_energy, own_land]
        avg        = sum(resources) / 4
        spread     = max(resources) - min(resources)

        # If spread is too large → imbalance → must Trade
        if spread > 0.3:
            return "Trade"

        # Blight: food threatened → conserve food reserves
        if weather > 0.7 and own_food < 0.45:
            return "Conserve"

        # If all resources quite good → allow gentle expand for growth
        if avg > 0.65 and crime < 0.35 and oscillate > 0.6:
            return "Expand"

        # If crime high → Trade with safe neighbours to reduce tension
        if crime > 0.6:
            return "Trade"

        # Occasionally probe Conflict to test borders (rare)
        if self._noise(0.05) and avg > 0.55 and self._last_n("Conflict") == 0:
            return "Conflict"

        # Default: gentle balancing oscillation between Trade and Conserve
        weights = {"Conserve": 0.3 + (1 - spread) * 0.2,
                   "Trade": 0.4 + spread * 0.3,
                   "Expand": 0.15 * oscillate,
                   "Conflict": 0.05}
        return _weighted_choice(weights)


# ── Ignis Core — The Expansionist ─────────────────────────────────────────────

class IgnisStrategy(PresidentStrategy):
    """
    Energy-rich expansionist. Reward focus: Maximum energy use & population growth.
    Prefers Expand aggressively; burns energy fast; Conflicts when blocked.
    """
    name = "President Ignar"
    region_id = "IGNIS_CORE"

    def _decide(self, obs: Dict[str, Any]) -> str:
        own_energy = obs.get("own_energy", 0.8)
        own_food   = obs.get("own_food",   0.5)
        own_land   = obs.get("own_land",   0.5)
        crime      = obs.get("crime_level", 0.4)
        nb_avg     = obs.get("nb_avg_resources", 0.5)
        weather    = obs.get("weather_state", 0.0)
        oscillate  = self._oscillate()

        # Solar Flare bonus → maximum expansion
        if weather > 0.65:
            if own_energy > 0.5:
                return "Expand"

        # Energy is the fuel — as long as it's there, EXPAND
        if own_energy > 0.5 and own_land > 0.35:
            if self._last_n("Expand") < 4:
                return "Expand"

        # Land scarce → Conflict to grab
        if own_land < 0.3 and crime < 0.6:
            if self._last_n("Conflict") < 2:
                return "Conflict"

        # Food running out → trade energy for food
        if own_food < 0.25:
            return "Trade"

        # Energy very low → must Conserve
        if own_energy < 0.2:
            return "Conserve"

        # Richly stocked neighbours? Raid them
        if nb_avg > 0.6 and self._last_n("Conflict") < 2:
            return "Conflict"

        weights = {
            "Conserve": 0.1,
            "Trade":    0.15 + (1 - oscillate) * 0.15,
            "Expand":   0.55 + oscillate * 0.1,
            "Conflict": 0.2
        }
        return _weighted_choice(weights)


# ── Terranova — The Parasite ──────────────────────────────────────────────────

class TerranovaStrategy(PresidentStrategy):
    """
    Land-rich parasite. Reward focus: Success in Steal/Conflict actions.
    Will Trade when weak to build trust, then Conflict to drain neighbours.
    Has a cycle: Trade → build relations → Conflict → steal → repeat.
    """
    name = "President Vorn"
    region_id = "TERRANOVA"

    def __init__(self) -> None:
        super().__init__()
        self._patience = 0       # ticks of "fake peace"

    def _decide(self, obs: Dict[str, Any]) -> str:
        own_avg    = self._own_avg(obs)
        own_land   = obs.get("own_land",   0.7)
        crime      = obs.get("crime_level", 0.6)
        nb_avg     = obs.get("nb_avg_resources", 0.5)
        oscillate  = self._oscillate()
        self._patience += 1

        # When very weak — fake peace, Trade to recover
        if own_avg < 0.3:
            self._patience = 0
            return "Trade"

        # Cycle: after building up resources for ~N ticks → strike
        cycle_pos = self._patience % 14
        if cycle_pos < 6:
            # Recovery / trust-building phase
            if own_avg < 0.55:
                return "Trade"
            return "Conserve"

        # Strike phase: Conflict to steal
        if nb_avg > 0.35 and crime < 0.85:
            if self._last_n("Conflict") < 3:
                return "Conflict"

        # After a streak of conflicts — cool off briefly
        if self._last_n("Conflict") >= 3:
            return "Trade"

        # Land surplus → Expand to secure territory
        if own_land > 0.8 and self._noise(0.3):
            return "Expand"

        weights = {
            "Conserve": 0.12,
            "Trade":    0.25 + (1 - oscillate) * 0.1,
            "Expand":   0.13,
            "Conflict": 0.50 + oscillate * 0.1
        }
        return _weighted_choice(weights)


# ── The Nexus — The Collaborator ─────────────────────────────────────────────

class NexusStrategy(PresidentStrategy):
    """
    Balanced global observer. Reward focus: Global System Stability.
    Monitors average prosperity of ALL regions. Intervenes through Trade
    to stabilise the world. Avoids Conflict almost entirely.
    """
    name = "President Aura"
    region_id = "THE_NEXUS"

    def _decide(self, obs: Dict[str, Any]) -> str:
        own_avg       = self._own_avg(obs)
        global_avg    = obs.get("global_avg_resources", 0.5)
        global_crime  = obs.get("global_avg_crime", 0.3)
        crime         = obs.get("crime_level", 0.3)
        weather       = obs.get("weather_state", 0.0)
        oscillate     = self._oscillate()

        # World crisis (blight/drought) → emergency Trade to help all
        if weather > 0.7 or global_avg < 0.3:
            return "Trade"

        # Global crime spike → Trade to de-escalate tensions
        if global_crime > 0.65:
            return "Trade"

        # Own resources low → Conserve first
        if own_avg < 0.35:
            return "Conserve"

        # Stable, prosperous world → gentle Expand to strengthen ties
        if global_avg > 0.6 and own_avg > 0.55 and crime < 0.35:
            if oscillate > 0.65:
                return "Expand"

        # Default: active Trade to maintain balance
        weights = {
            "Conserve": 0.15 + (1 - global_avg) * 0.1,
            "Trade":    0.60 + global_avg * 0.1,
            "Expand":   0.15 * oscillate,
            "Conflict": 0.02   # Nexus almost never conflicts
        }
        return _weighted_choice(weights)


# ── Factory ───────────────────────────────────────────────────────────────────

def make_strategy(region_id: str) -> PresidentStrategy:
    mapping = {
        "AQUILONIA":  AquiloniaStrategy,
        "VERDANTIS":  VerdantisStrategy,
        "IGNIS_CORE": IgnisStrategy,
        "TERRANOVA":  TerranovaStrategy,
        "THE_NEXUS":  NexusStrategy,
    }
    cls = mapping.get(region_id, NexusStrategy)
    strat = cls()
    logger.info("Created strategy %s for region %s", cls.__name__, region_id)
    return strat
