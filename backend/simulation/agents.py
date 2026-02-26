"""
WorldSim — AI Governor Agents with Q-Learning
Each agent governs one or more regions, making resource allocation decisions.
"""

from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Dict, List, Tuple

import numpy as np

if TYPE_CHECKING:
    from ..config import RLConfig
    from .population import Population
    from .resources import RegionResources


def _discretize(value: float, bins: int = 5) -> int:
    """Discretize a 0-1 float into bins for Q-table indexing."""
    return min(bins - 1, max(0, int(value * bins)))


@dataclass
class AgentDecision:
    """Record of a single decision made by an agent."""
    tick: int
    action: str
    state: tuple
    reward: float


class GovernorAgent:
    """
    RL-based governor that manages a region.
    Uses Q-learning to learn resource allocation strategies.
    """

    _next_id: int = 0

    def __init__(self, agent_id: int, region_key: str, cfg: RLConfig):
        self.agent_id = agent_id
        self.region_key = region_key
        self.cfg = cfg
        self.name = f"Governor-{agent_id}"

        # Q-table: state -> action -> Q-value
        self.q_table: Dict[tuple, Dict[str, float]] = defaultdict(
            lambda: {a: 0.0 for a in cfg.actions}
        )
        self.epsilon = cfg.epsilon

        # Tracking
        self.last_state: tuple | None = None
        self.last_action: str | None = None
        self.last_population: int = 0
        self.last_health: float = 0.0
        self.total_reward: float = 0.0
        self.decision_history: List[AgentDecision] = []

    def get_state(self, resources: RegionResources, population: Population) -> tuple:
        """Discretize region state into a Q-table key."""
        return (
            _discretize(resources.food.pct / 100.0),
            _discretize(resources.water.pct / 100.0),
            _discretize(population.health),
            _discretize(population.density),
        )

    def choose_action(self, state: tuple) -> str:
        """Epsilon-greedy action selection."""
        if random.random() < self.epsilon:
            return random.choice(self.cfg.actions)

        q_values = self.q_table[state]
        max_q = max(q_values.values())
        best = [a for a, q in q_values.items() if q == max_q]
        return random.choice(best)

    def compute_reward(self, population: Population) -> float:
        """Reward = population growth + health improvement."""
        pop_delta = population.count - self.last_population
        health_delta = population.health - self.last_health
        pop_reward = pop_delta / max(1, population.max_capacity) * 10.0
        health_reward = health_delta * 5.0
        alive_bonus = 1.0 if population.count > 0 else -10.0
        return pop_reward + health_reward + alive_bonus

    def update_q(self, state: tuple, action: str, reward: float, next_state: tuple) -> None:
        """Q-learning update."""
        old_q = self.q_table[state][action]
        next_max = max(self.q_table[next_state].values())
        new_q = old_q + self.cfg.learning_rate * (
            reward + self.cfg.discount_factor * next_max - old_q
        )
        self.q_table[state][action] = new_q

    def step(
        self,
        resources: RegionResources,
        population: Population,
        tick: int,
    ) -> str:
        """
        Execute one decision cycle:
        1. Observe state
        2. Compute reward from last action
        3. Update Q-table
        4. Choose and execute new action
        """
        state = self.get_state(resources, population)

        # Update Q-table with previous transition
        if self.last_state is not None and self.last_action is not None:
            reward = self.compute_reward(population)
            self.update_q(self.last_state, self.last_action, reward, state)
            self.total_reward += reward

            self.decision_history.append(AgentDecision(
                tick=tick, action=self.last_action,
                state=self.last_state, reward=reward,
            ))
            if len(self.decision_history) > 200:
                self.decision_history = self.decision_history[-100:]

        # Choose action
        action = self.choose_action(state)

        # Execute action effects on resources
        self._execute_action(action, resources, population)

        # Save state for next tick
        self.last_state = state
        self.last_action = action
        self.last_population = population.count
        self.last_health = population.health

        # Decay epsilon
        self.epsilon = max(self.cfg.epsilon_min, self.epsilon * self.cfg.epsilon_decay)

        return action

    def _execute_action(
        self, action: str, resources: RegionResources, population: Population
    ) -> None:
        """Apply action effects to region resources."""
        if action == "focus_food":
            resources.food.regen_multiplier *= 1.3
            resources.water.regen_multiplier *= 0.9

        elif action == "focus_water":
            resources.water.regen_multiplier *= 1.3
            resources.food.regen_multiplier *= 0.9

        elif action == "balance_resources":
            resources.food.regen_multiplier = (resources.food.regen_multiplier + 1.0) / 2
            resources.water.regen_multiplier = (resources.water.regen_multiplier + 1.0) / 2

        elif action == "stockpile":
            resources.food.value += resources.food.effective_regen * 0.3
            resources.water.value += resources.water.effective_regen * 0.3
            population.health -= 0.005

        elif action == "trade":
            if resources.food.pct > resources.water.pct:
                transfer = resources.food.value * 0.05
                resources.food.consume(transfer)
                resources.water.apply_event(transfer * 0.7)
            else:
                transfer = resources.water.value * 0.05
                resources.water.consume(transfer)
                resources.food.apply_event(transfer * 0.7)

        elif action == "migrate_out":
            pass  # Migration handled by world step

    @property
    def current_strategy(self) -> str:
        """Most frequently chosen action in recent history."""
        if not self.decision_history:
            return "exploring"
        recent = self.decision_history[-20:]
        counts: Dict[str, int] = {}
        for d in recent:
            counts[d.action] = counts.get(d.action, 0) + 1
        return max(counts, key=counts.get)  # type: ignore

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "region_key": self.region_key,
            "strategy": self.current_strategy,
            "epsilon": round(self.epsilon, 4),
            "total_reward": round(self.total_reward, 2),
            "decisions": len(self.decision_history),
        }
