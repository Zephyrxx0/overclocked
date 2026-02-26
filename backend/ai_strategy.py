"""
ai_strategy.py
--------------
PPO Strategy Wrapper for WorldSim.

Attempts to load a pre-trained Stable-Baselines3 PPO model from disk.
If no model file is found, falls back to a deterministic heuristic policy
that mimics the output of a trained PPO agent — fully autonomous, zero user input.

A real SB3 model can be dropped in at `backend/ppo_worldsim.zip` at any time.
"""

from __future__ import annotations

import os
import logging
from typing import Dict, Any

import numpy as np

logger = logging.getLogger(__name__)

# Actions the policy can emit
ACTIONS = ["Trade", "Hoard", "Migrate"]

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "ppo_worldsim.zip")


class PPOStrategyWrapper:
    """
    Wraps SB3 PPO inference.  Falls back to a heuristic policy when no
    trained model is available.
    """

    def __init__(self) -> None:
        self._model = None
        self._try_load_model()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_action(self, obs: Dict[str, Any]) -> str:
        """
        Given an observation dict, return one of: "Trade", "Hoard", "Migrate".

        obs keys expected:
            energy (float 0-1), water (float 0-1), food (float 0-1),
            land (float 0-1), crime_rate (float 0-1), population (float 0-1)
        """
        if self._model is not None:
            return self._ppo_inference(obs)
        return self._heuristic_policy(obs)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _try_load_model(self) -> None:
        if not os.path.exists(_MODEL_PATH):
            logger.info(
                "No PPO model found at %s — using heuristic policy.", _MODEL_PATH
            )
            return
        try:
            from stable_baselines3 import PPO  # type: ignore

            self._model = PPO.load(_MODEL_PATH)
            logger.info("Loaded PPO model from %s", _MODEL_PATH)
        except Exception as exc:
            logger.warning("Failed to load PPO model: %s. Using heuristic.", exc)

    def _ppo_inference(self, obs: Dict[str, Any]) -> str:
        vec = np.array(
            [
                obs.get("energy", 0.5),
                obs.get("water", 0.5),
                obs.get("food", 0.5),
                obs.get("land", 0.5),
                obs.get("crime_rate", 0.5),
                obs.get("population", 0.5),
            ],
            dtype=np.float32,
        ).reshape(1, -1)
        action_idx, _ = self._model.predict(vec, deterministic=False)
        return ACTIONS[int(action_idx) % len(ACTIONS)]

    def _heuristic_policy(self, obs: Dict[str, Any]) -> str:
        """
        Deterministic rule-based policy that approximates trained PPO output.

        Priority logic:
          1. If crime_rate > 0.7 and any resource < 0.25  → Migrate
          2. If a resource average < 0.35                  → Trade
          3. If resource average > 0.70                    → Hoard
          4. Otherwise                                     → Trade
        """
        energy = obs.get("energy", 0.5)
        water = obs.get("water", 0.5)
        food = obs.get("food", 0.5)
        land = obs.get("land", 0.5)
        crime = obs.get("crime_rate", 0.3)

        resources = [energy, water, food, land]
        avg = float(np.mean(resources))
        min_res = float(np.min(resources))

        if crime > 0.7 and min_res < 0.25:
            return "Migrate"

        if avg < 0.35:
            return "Trade"

        if avg > 0.70:
            return "Hoard"

        # default: keep trading
        return "Trade"
