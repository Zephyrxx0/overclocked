"""
simulation.py  –  WorldSim 2.0 Mesa 3.5-compatible simulation
-------------------------------------------------------------
Five Sovereign Nations, each with a distinct President AI strategy.

Nations:
  AQUILONIA   – Water-rich. Fortress. Hoarding & Border Integrity.
  VERDANTIS   – Food-rich.  Equilibrium. Resource Balance.
  IGNIS_CORE  – Energy-rich. Expansionist. Max Energy & Population Growth.
  TERRANOVA   – Land-rich.  Parasite. Conflict & Steal.
  THE_NEXUS   – Balanced.   Collaborator. Global Stability.

Key systems:
  • 4-action space: Conserve | Trade | Expand | Conflict
  • Tribe bonus: -15% trade energy cost when Tribe matches (IRON: Aquilonia+Terranova)
  • Energy Entropy: crime_alert > 0.7 drains extra 5% energy per tick
  • Climate Engine: every ~50 ticks cycles Drought / Solar Flare / Blight
  • Neighbor context fed into each president's observation
  • Natural oscillating behavior via personality drift in ai_strategy
"""

from __future__ import annotations

import asyncio
import logging
import math
import random
import threading
import time
from typing import Any, Dict, List, Optional

import mesa
import numpy as np

from ai_strategy import make_strategy, PresidentStrategy

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Nation definitions
# ──────────────────────────────────────────────────────────────────────────────

NATION_PROFILES: List[Dict[str, Any]] = [
    {
        "id":         "AQUILONIA",
        "name":       "The_Hoarder",
        "title":      "Water Dominance · Hoard & Defend",
        "color_hint": "#4A9EFF",
        "tribe":      "IRON",
        "position":   "NW",
        # Water-rich, Energy-poor
        "resources":  {"water": 0.90, "food": 0.55, "energy": 0.20, "land": 0.60},
        "crime_rate": 0.18,
        "population": 4_800_000,
    },
    {
        "id":         "VERDANTIS",
        "name":       "The_Sustainist",
        "title":      "Food Surplus · Balance All 4",
        "color_hint": "#4CAF50",
        "tribe":      "LEAF",
        "position":   "NE",
        # Food-rich, Water-poor
        "resources":  {"water": 0.20, "food": 0.90, "energy": 0.58, "land": 0.65},
        "crime_rate": 0.14,
        "population": 5_200_000,
    },
    {
        "id":         "IGNIS_CORE",
        "name":       "The_Industrialist",
        "title":      "Energy Powerhouse · Expand & Burn",
        "color_hint": "#FF7043",
        "tribe":      "FIRE",
        "position":   "CENTER",
        # Energy-rich, Food-poor
        "resources":  {"water": 0.48, "food": 0.20, "energy": 0.92, "land": 0.55},
        "crime_rate": 0.42,
        "population": 7_100_000,
    },
    {
        "id":         "TERRANOVA",
        "name":       "The_Opportunist",
        "title":      "Vast Landmass · Conflict & Steal",
        "color_hint": "#A08040",
        "tribe":      "IRON",       # same tribe as Aquilonia → trade bonus
        "position":   "SW",
        # Land-rich, Water-poor
        "resources":  {"water": 0.20, "food": 0.50, "energy": 0.60, "land": 0.91},
        "crime_rate": 0.61,
        "population": 3_900_000,
    },
    {
        "id":         "THE_NEXUS",
        "name":       "The_Integrator",
        "title":      "Balanced Hub · Trade & Stability",
        "color_hint": "#AB7FE0",
        "tribe":      "NEXUS",
        "position":   "SE",
        # Balanced start
        "resources":  {"water": 0.60, "food": 0.60, "energy": 0.60, "land": 0.60},
        "crime_rate": 0.22,
        "population": 6_300_000,
    },
]

# ──────────────────────────────────────────────────────────────────────────────
# Climate Engine
# ──────────────────────────────────────────────────────────────────────────────

CLIMATE_TYPES = ["Drought", "SolarFlare", "Blight", None]

class ClimateEngine:
    """Periodically fires climate events that affect all regions."""

    def __init__(self) -> None:
        self.event_type: Optional[str] = None
        self.duration: int = 0
        self._next_event_in: int = random.randint(35, 60)

    def tick(self, tick: int) -> None:
        if self.duration > 0:
            self.duration -= 1
            if self.duration == 0:
                logger.info("Climate event %s ended at tick %d", self.event_type, tick)
                self.event_type = None
        else:
            self._next_event_in -= 1
            if self._next_event_in <= 0:
                self._trigger(tick)
                self._next_event_in = random.randint(40, 70)

    def _trigger(self, tick: int) -> None:
        self.event_type = random.choice(["Drought", "SolarFlare", "Blight"])
        self.duration   = random.randint(6, 14)
        logger.info("Climate event %s started at tick %d for %d ticks",
                    self.event_type, tick, self.duration)

    def apply_to_resources(self, resources: Dict[str, float]) -> Dict[str, float]:
        r = dict(resources)
        if self.event_type == "Drought":
            r["water"] = max(0.0, r["water"] - 0.025)
        elif self.event_type == "SolarFlare":
            r["energy"] = min(1.0, r["energy"] + 0.018)
        elif self.event_type == "Blight":
            r["food"] = max(0.0, r["food"] - 0.022)
        return r

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type":               self.event_type,
            "duration_remaining": self.duration,
        }


# ──────────────────────────────────────────────────────────────────────────────
# NationAgent  (Mesa 3.x — no positional unique_id)
# ──────────────────────────────────────────────────────────────────────────────

# Natural decay rates per resource per tick (at 2 Hz → ~0.5 s/tick)
_BASE_DECAY = {"water": 0.0038, "food": 0.0045, "energy": 0.0060, "land": 0.0010}

class NationAgent(mesa.Agent):
    """Represents one of the 5 sovereign nations."""

    def __init__(
        self,
        model: "WorldModel",
        profile: Dict[str, Any],
        strategy: PresidentStrategy,
    ) -> None:
        super().__init__(model)   # Mesa 3.x: only model required
        self.nation_id:   str  = profile["id"]
        self.name:        str  = profile["name"]
        self.title:       str  = profile["title"]
        self.color_hint:  str  = profile["color_hint"]
        self.tribe:       str  = profile["tribe"]
        self.position:    str  = profile["position"]
        self.strategy:    PresidentStrategy = strategy

        self.resources:   Dict[str, float] = dict(profile["resources"])
        self.crime_rate:  float = profile["crime_rate"]
        self.population:  int   = profile["population"]
        self.last_action: str   = "Conserve"

        # Base crime attractor from profile (mean-reversion target)
        self._crime_attractor: float = profile["crime_rate"]
        # Smooth resource memory for trend calculation
        self._prev_resources: Dict[str, float] = dict(self.resources)

    # ------------------------------------------------------------------
    # Observation
    # ------------------------------------------------------------------

    def _build_obs(self, neighbours: List["NationAgent"],
                   climate: ClimateEngine, all_agents: List["NationAgent"]) -> Dict[str, Any]:
        nb_avg = (
            sum(sum(n.resources.values()) / 4 for n in neighbours) / max(len(neighbours), 1)
        )
        global_avg = (
            sum(sum(a.resources.values()) / 4 for a in all_agents) / max(len(all_agents), 1)
        )
        global_crime = sum(a.crime_rate for a in all_agents) / max(len(all_agents), 1)
        weather_state = 0.0
        if climate.event_type == "Drought":   weather_state = 0.75
        elif climate.event_type == "SolarFlare": weather_state = 0.85
        elif climate.event_type == "Blight":  weather_state = 0.80

        return {
            "own_water":           self.resources["water"],
            "own_food":            self.resources["food"],
            "own_energy":          self.resources["energy"],
            "own_land":            self.resources["land"],
            "nb_avg_resources":    nb_avg,
            "global_avg_resources":global_avg,
            "global_avg_crime":    global_crime,
            "crime_level":         self.crime_rate,
            "weather_state":       weather_state,
        }

    # ------------------------------------------------------------------
    # Step
    # ------------------------------------------------------------------

    def step(self) -> None:
        all_agents: List[NationAgent] = list(self.model.agents)
        neighbours: List[NationAgent] = [a for a in all_agents if a is not self]

        self._apply_decay(self.model.climate)
        obs    = self._build_obs(neighbours, self.model.climate, all_agents)
        action = self.strategy.get_action(obs, self.model.tick)
        self.last_action = action
        self._apply_action(action, neighbours)
        self._apply_energy_entropy()
        self._clamp()

    # ------------------------------------------------------------------
    # Decay
    # ------------------------------------------------------------------

    def _apply_decay(self, climate: ClimateEngine) -> None:
        # Natural resource depletion with micro-noise
        for k, base in _BASE_DECAY.items():
            noise = np.random.uniform(-0.002, 0.002)
            self.resources[k] -= float(base + noise)

        # Climate modifier
        self.resources = climate.apply_to_resources(self.resources)

        # Crime mean-reversion + random walk
        drift = 0.008 * (self._crime_attractor - self.crime_rate)
        shock = random.gauss(0, 0.012)
        self.crime_rate = float(np.clip(self.crime_rate + drift + shock, 0.0, 1.0))

    # ------------------------------------------------------------------
    # Action effects
    # ------------------------------------------------------------------

    def _apply_action(self, action: str, neighbours: List["NationAgent"]) -> None:
        if action == "Conserve":
            self._do_conserve()
        elif action == "Trade":
            self._do_trade(neighbours)
        elif action == "Expand":
            self._do_expand()
        elif action == "Conflict":
            self._do_conflict(neighbours)

    def _do_conserve(self) -> None:
        """Save resources — small bonus across the board."""
        bonus = random.uniform(0.01, 0.025)
        for k in self.resources:
            self.resources[k] += bonus * random.uniform(0.5, 1.5)
        self.crime_rate -= random.uniform(0.005, 0.015)

    def _do_trade(self, neighbours: List["NationAgent"]) -> None:
        """Trade scarce resource for abundant neighbour surplus.
        Tribe bonus: same-tribe trade costs 15% less energy.
        """
        if not neighbours:
            return
        # Pick partner (prefer tribe-mate for discount)
        tribe_mates = [n for n in neighbours if n.tribe == self.tribe]
        partner: NationAgent = (
            random.choice(tribe_mates) if tribe_mates and random.random() < 0.6
            else random.choice(neighbours)
        )

        # Determine scarce/abundant resources BEFORE any modifications
        own_min_k  = min(self.resources, key=lambda k: self.resources[k])
        own_max_k  = max(self.resources, key=lambda k: self.resources[k])
        part_max_k = max(partner.resources, key=lambda k: partner.resources[k])

        # 15% reduction in energy trade cost for matching tribes
        energy_cost = 0.05
        if partner.tribe == self.tribe:
            energy_cost *= 0.85
        self.resources["energy"] = max(0.0, self.resources["energy"] - energy_cost)

        gain = random.uniform(0.04, 0.09)
        cost = random.uniform(0.03, 0.07)

        self.resources[own_min_k]     = min(1.0, self.resources[own_min_k]     + gain)
        partner.resources[part_max_k] = max(0.0, partner.resources[part_max_k] - cost * 0.6)
        # Partner gets some of our most abundant in return (fair trade)
        partner.resources[own_max_k]  = min(1.0, partner.resources[own_max_k]  + cost * 0.55)

        self.crime_rate -= random.uniform(0.003, 0.01)

    def _do_expand(self) -> None:
        """Grow population; costs energy and land; raises crime slightly."""
        if self.resources["energy"] < 0.12 or self.resources["land"] < 0.10:
            # Can't expand without fuel → fall back to conserve
            self._do_conserve()
            return
        growth = int(self.population * random.uniform(0.005, 0.025))
        self.population += growth
        self.resources["energy"] -= random.uniform(0.03, 0.06)
        self.resources["land"]   -= random.uniform(0.01, 0.025)
        self.resources["food"]   -= random.uniform(0.015, 0.03)
        self.crime_rate          += random.uniform(0.003, 0.012)

    def _do_conflict(self, neighbours: List["NationAgent"]) -> None:
        """Attempt to steal a resource chunk from a weaker neighbour."""
        if not neighbours:
            return
        # Target the weakest/richest as appropriate
        target: NationAgent = min(
            neighbours,
            key=lambda n: n.resources.get("energy", 0.5) + n.crime_rate * 0.5
        )
        # Steal success chance depends on our crime rate (aggression capacity)
        success_prob = 0.45 + self.crime_rate * 0.35
        if random.random() < success_prob:
            stolen_k = max(target.resources, key=lambda k: target.resources[k])
            steal_amt = random.uniform(0.04, 0.12)
            target.resources[stolen_k] = max(0.0, target.resources[stolen_k] - steal_amt)
            self.resources[stolen_k]   = min(1.0, self.resources[stolen_k]   + steal_amt * 0.8)
            target.crime_rate          += random.uniform(0.015, 0.04)  # victim destabilised
            self.crime_rate            += random.uniform(0.005, 0.02)  # attacker also affected
        else:
            # Failed conflict — costs energy and raises own crime
            self.resources["energy"] -= random.uniform(0.02, 0.05)
            self.crime_rate          += random.uniform(0.01, 0.03)

    # ------------------------------------------------------------------
    # Energy Entropy
    # ------------------------------------------------------------------

    def _apply_energy_entropy(self) -> None:
        """High crime alert triggers extra -5% energy drain."""
        if self.crime_rate > 0.70:
            self.resources["energy"] = max(
                0.0, self.resources["energy"] - self.resources["energy"] * 0.05
            )

    # ------------------------------------------------------------------
    def _clamp(self) -> None:
        for k in self.resources:
            self.resources[k] = float(np.clip(self.resources[k], 0.0, 1.0))
        self.crime_rate = float(np.clip(self.crime_rate, 0.0, 1.0))
        self.population = max(100_000, self.population)

    # ------------------------------------------------------------------
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id":          self.nation_id,
            "name":        self.name,
            "title":       self.title,
            "color_hint":  self.color_hint,
            "tribe":       self.tribe,
            "position":    self.position,
            "resources":   {k: round(v, 4) for k, v in self.resources.items()},
            "crime_rate":  round(self.crime_rate, 4),
            "population":  self.population,
            "last_action": self.last_action,
        }


# ──────────────────────────────────────────────────────────────────────────────
# WorldModel
# ──────────────────────────────────────────────────────────────────────────────

class WorldModel(mesa.Model):
    """Mesa model containing all 5 sovereign NationAgents + climate engine."""

    def __init__(self) -> None:
        super().__init__()
        self.tick: int = 0
        self.climate = ClimateEngine()

        for profile in NATION_PROFILES:
            strategy = make_strategy(profile["id"])
            NationAgent(self, profile, strategy)   # auto-registered to self.agents

        logger.info("WorldModel initialised with %d sovereign nations.", len(list(self.agents)))

    def step(self) -> None:
        self.climate.tick(self.tick)
        # Mesa 3.x: shuffle_do gives random activation order each tick
        self.agents.shuffle_do("step")
        self.tick += 1
        if self.tick % 20 == 0:
            logger.info("Tick %d — climate: %s", self.tick, self.climate.event_type)

    def get_state(self) -> Dict[str, Any]:
        return {
            "tick":          self.tick,
            "regions":       [a.to_dict() for a in self.agents],
            "climate_event": self.climate.to_dict(),
        }


# ──────────────────────────────────────────────────────────────────────────────
# Background simulation runner
# ──────────────────────────────────────────────────────────────────────────────

_sim_thread: Optional[threading.Thread] = None
_stop_event  = threading.Event()
_pause_event = threading.Event()
_pause_event.set()   # unpaused by default


def run_simulation(queue: asyncio.Queue, loop: asyncio.AbstractEventLoop) -> None:
    """
    Background thread: ticks WorldModel at ~2 Hz and pushes JSON
    state dicts onto the asyncio queue owned by the main event loop.
    """
    model = WorldModel()
    logger.info("Simulation thread started.")
    while not _stop_event.is_set():
        _pause_event.wait()
        if _stop_event.is_set():
            break
        t0 = time.perf_counter()
        model.step()
        state = model.get_state()
        asyncio.run_coroutine_threadsafe(queue.put(state), loop)
        elapsed = time.perf_counter() - t0
        time.sleep(max(0.0, 0.5 - elapsed))
    logger.info("Simulation thread stopped.")


def start_simulation(queue: asyncio.Queue, loop: asyncio.AbstractEventLoop) -> None:
    global _sim_thread
    _stop_event.clear()
    _sim_thread = threading.Thread(
        target=run_simulation, args=(queue, loop), daemon=True, name="SimThread"
    )
    _sim_thread.start()


def stop_simulation() -> None:
    _stop_event.set()


def pause_simulation() -> None:
    _pause_event.clear()
    logger.info("Simulation paused.")


def resume_simulation() -> None:
    _pause_event.set()
    logger.info("Simulation resumed.")
