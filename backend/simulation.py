"""
simulation.py  –  WorldSim Mesa 3.5-compatible simulation
----------------------------------------------------------
Key Mesa 3.x changes applied:
  - No more mesa.time / RandomActivation (removed in Mesa 3.x)
  - Agents registered via model.agents (AgentSet); stepped with
    model.agents.shuffle_do("step")
  - Agent __init__ signature: (model, **kwargs) — unique_id is
    auto-assigned by Mesa 3.x; no positional unique_id arg.
"""

from __future__ import annotations

import asyncio
import logging
import random
import threading
import time
from typing import Any, Dict, List, Optional

import mesa
import numpy as np

from ai_strategy import PPOStrategyWrapper

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Region definitions
# ──────────────────────────────────────────────────────────────────────────────

REGION_PROFILES: List[Dict[str, Any]] = [
    {
        "id": "CBD_CORE",
        "name": "CBD Core",
        "position": "CENTER",
        "color_hint": "#FF4444",
        "resources": {"energy": 0.9, "water": 0.4, "food": 0.5, "land": 0.3},
        "crime_rate": 0.75,
        "population": 850_000,
    },
    {
        "id": "WATERFRONT",
        "name": "Waterfront",
        "position": "NW",
        "color_hint": "#4488FF",
        "resources": {"energy": 0.4, "water": 0.95, "food": 0.8, "land": 0.7},
        "crime_rate": 0.15,
        "population": 320_000,
    },
    {
        "id": "INDUSTRIAL",
        "name": "Industrial Zone",
        "position": "NE",
        "color_hint": "#FFCC00",
        "resources": {"energy": 0.6, "water": 0.5, "food": 0.85, "land": 0.6},
        "crime_rate": 0.45,
        "population": 510_000,
    },
    {
        "id": "SLUMS",
        "name": "Slums",
        "position": "SW",
        "color_hint": "#AA2222",
        "resources": {"energy": 0.2, "water": 0.25, "food": 0.2, "land": 0.3},
        "crime_rate": 0.88,
        "population": 640_000,
    },
    {
        "id": "HILLY_SUBURBS",
        "name": "Hilly Suburbs",
        "position": "SE",
        "color_hint": "#996633",
        "resources": {"energy": 0.5, "water": 0.6, "food": 0.65, "land": 0.9},
        "crime_rate": 0.22,
        "population": 290_000,
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# RegionAgent  (Mesa 3.x – no positional unique_id)
# ──────────────────────────────────────────────────────────────────────────────

class RegionAgent(mesa.Agent):
    """Represents one of the 5 world regions."""

    def __init__(self, model: "WorldModel", profile: Dict[str, Any], strategy: PPOStrategyWrapper) -> None:
        super().__init__(model)          # Mesa 3.x: only model required
        self.region_id: str           = profile["id"]
        self.name: str                = profile["name"]
        self.position: str            = profile["position"]
        self.color_hint: str          = profile["color_hint"]
        self.strategy                 = strategy

        self.resources: Dict[str, float] = dict(profile["resources"])
        self.crime_rate: float        = profile["crime_rate"]
        self.population: int          = profile["population"]
        self.last_action: str         = "Idle"
        # Keep track of profile index for crime attractor
        self._profile                 = profile

    # ------------------------------------------------------------------
    def _obs(self) -> Dict[str, float]:
        return {
            "energy":     self.resources["energy"],
            "water":      self.resources["water"],
            "food":       self.resources["food"],
            "land":       self.resources["land"],
            "crime_rate": self.crime_rate,
            "population": float(np.clip(self.population / 1_000_000, 0.0, 1.0)),
        }

    # ------------------------------------------------------------------
    def step(self) -> None:
        self._apply_decay()
        action = self.strategy.get_action(self._obs())
        self.last_action = action
        self._apply_action(action)
        self._clamp()

    # ------------------------------------------------------------------
    def _apply_decay(self) -> None:
        decay = np.array([0.005, 0.004, 0.006, 0.002])
        noise = np.random.uniform(-0.003, 0.003, size=4)
        for i, k in enumerate(["energy", "water", "food", "land"]):
            self.resources[k] -= float(decay[i] + noise[i])

        attractor = self._profile["crime_rate"]
        self.crime_rate += 0.01 * (attractor - self.crime_rate) + random.uniform(-0.02, 0.02)

    # ------------------------------------------------------------------
    def _apply_action(self, action: str) -> None:
        if action == "Trade":
            keys    = list(self.resources.keys())
            scarce  = min(keys, key=lambda k: self.resources[k])
            abundant = max(keys, key=lambda k: self.resources[k])
            self.resources[scarce]   += random.uniform(0.03, 0.07)
            self.resources[abundant] -= random.uniform(0.02, 0.05)

        elif action == "Hoard":
            for k in self.resources:
                self.resources[k] += random.uniform(0.01, 0.03)
            self.crime_rate += random.uniform(0.01, 0.04)

        elif action == "Migrate":
            flee = int(self.population * random.uniform(0.01, 0.03))
            self.population = max(10_000, self.population - flee)
            self.crime_rate -= random.uniform(0.005, 0.02)
            # Mesa 3.x: model.agents is an AgentSet
            others: List[RegionAgent] = [a for a in self.model.agents if a is not self]
            if others:
                dest: RegionAgent = random.choice(others)
                dest.population += flee

    # ------------------------------------------------------------------
    def _clamp(self) -> None:
        for k in self.resources:
            self.resources[k] = float(np.clip(self.resources[k], 0.0, 1.0))
        self.crime_rate = float(np.clip(self.crime_rate, 0.0, 1.0))

    # ------------------------------------------------------------------
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id":          self.region_id,
            "name":        self.name,
            "position":    self.position,
            "color_hint":  self.color_hint,
            "resources":   {k: round(v, 4) for k, v in self.resources.items()},
            "crime_rate":  round(self.crime_rate, 4),
            "population":  self.population,
            "last_action": self.last_action,
        }


# ──────────────────────────────────────────────────────────────────────────────
# WorldModel
# ──────────────────────────────────────────────────────────────────────────────

class WorldModel(mesa.Model):
    """Mesa model containing all 5 RegionAgents."""

    def __init__(self) -> None:
        super().__init__()
        self.tick: int = 0
        strategy = PPOStrategyWrapper()

        for profile in REGION_PROFILES:
            RegionAgent(self, profile, strategy)   # auto-registered to self.agents

        logger.info("WorldModel initialised with %d region agents.", len(list(self.agents)))

    def step(self) -> None:
        # Mesa 3.x: shuffle_do replaces RandomActivation
        self.agents.shuffle_do("step")
        self.tick += 1

    def get_state(self) -> Dict[str, Any]:
        return {
            "tick": self.tick,
            "regions": [a.to_dict() for a in self.agents],
        }


# ──────────────────────────────────────────────────────────────────────────────
# Background simulation runner
# ──────────────────────────────────────────────────────────────────────────────

_sim_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_paused_event = threading.Event()
_paused_event.set()  # unpaused by default


def run_simulation(queue: asyncio.Queue, loop: asyncio.AbstractEventLoop) -> None:
    """
    Background thread: ticks WorldModel at ~2 Hz and pushes JSON
    state dicts onto the asyncio queue owned by the main event loop.
    """
    model = WorldModel()
    logger.info("Simulation thread started.")
    while not _stop_event.is_set():
        _paused_event.wait()  # blocks when paused
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
    _paused_event.clear()
    logger.info("Simulation paused.")


def resume_simulation() -> None:
    _paused_event.set()
    logger.info("Simulation resumed.")
