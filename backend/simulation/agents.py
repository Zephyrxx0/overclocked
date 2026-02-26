"""
AI Agent classes for WorldSim simulation.
Agents govern regions and make strategy decisions.
"""

import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple

from mesa import Agent

from .resources import Resource, ResourceManager


class AgentStrategy(Enum):
    """Possible strategies for AI agents."""

    DEFENSIVE = "defensive"  # Focus on preservation and conservation
    EXPANSIVE = "expansive"  # Focus on growth and acquisition
    NEGOTIATOR = "negotiator"  # Focus on trade and diplomacy
    EXTRACTIVE = "extractive"  # Focus on maximum resource extraction


@dataclass
class AgentDecision:
    """Represents a decision made by an agent."""

    action: str
    target: str
    resource: str
    amount: float
    confidence: float = 0.0


class AIAgent(Agent):
    """
    Autonomous AI Agent that governs a region.
    Learns strategies through reinforcement learning.
    """

    def __init__(
        self,
        unique_id: int,
        model,
        region_id: int,
        name: str,
        strategy: AgentStrategy = AgentStrategy.DEFENSIVE,
    ):
        super().__init__(unique_id, model)
        self.region_id = region_id
        self.name = name
        self.strategy = strategy

        # Learning state
        self.rewards: Dict[str, float] = field(default_factory=dict)
        self.strategy_scores: Dict[AgentStrategy, float] = field(default_factory=dict)

        # Action history
        self.history: List[AgentDecision] = []

        # Initialize strategy scores
        for strategy in AgentStrategy:
            self.strategy_scores[strategy] = 100.0

        # Create resource manager for this agent's region
        self.resources = ResourceManager()

    def step(self):
        """Execute one tick of the simulation."""
        # 1. Assess current state
        assessment = self.assess_state()

        # 2. Choose action based on strategy and state
        decision = self.make_decision(assessment)

        # 3. Execute decision
        self.execute_decision(decision)

        # 4. Update history
        self.history.append(decision)

        # 5. Regenerate resources
        self.resources.regenerate_all()

    def assess_state(self) -> Dict:
        """Assess current simulation state."""
        resources = self.resources.get_all()

        return {
            "total_resources": self.resources.total_resources(),
            "resource_breakdown": resources,
            "critical_resources": [
                name for name, r in resources.items() if r["current"] < r["max"] * 0.2
            ],
            "tick": self.model.current_tick,
        }

    def make_decision(self, assessment: Dict) -> AgentDecision:
        """Make a decision based on assessment and strategy."""

        # Get critical resources that need attention
        critical = assessment["critical_resources"]

        if self.strategy == AgentStrategy.DEFENSIVE:
            if critical:
                return AgentDecision(
                    action="conserve",
                    target=f"region_{self.region_id}",
                    resource=critical[0],
                    amount=self.resources.get(critical[0]).current_value * 0.1,
                    confidence=0.8,
                )
            return AgentDecision(
                action="maintain",
                target=f"region_{self.region_id}",
                resource="energy",
                amount=10.0,
                confidence=0.7,
            )

        elif self.strategy == AgentStrategy.EXPANSIVE:
            return AgentDecision(
                action="develop",
                target=f"region_{self.region_id}",
                resource="land",
                amount=1.0,
                confidence=0.6,
            )

        elif self.strategy == AgentStrategy.NEGOTIATOR:
            return AgentDecision(
                action="trade",
                target="network",
                resource=random.choice(list(self.resources.resources.keys())),
                amount=20.0,
                confidence=0.5,
            )

        elif self.strategy == AgentStrategy.EXTRACTIVE:
            return AgentDecision(
                action="extract",
                target=f"region_{self.region_id}",
                resource=random.choice(["water", "food", "energy"]),
                amount=50.0,
                confidence=0.7,
            )

        # Default decision
        return AgentDecision(
            action="idle",
            target=f"region_{self.region_id}",
            resource="water",
            amount=0.0,
            confidence=0.0,
        )

    def execute_decision(self, decision: AgentDecision):
        """Execute a decision."""
        if decision.action == "conserve":
            resource = self.resources.get(decision.resource)
            resource.consume(decision.amount * 0.5)  # Reduced consumption

        elif decision.action == "extract":
            resource = self.resources.get(decision.resource)
            resource.consume(decision.amount)

        elif decision.action == "develop":
            resource = self.resources.get("land")
            resource.consume(decision.amount)
            # Land development improves future regeneration
            for r in self.resources.resources.values():
                r.regeneration_rate += 0.1

        elif decision.action == "trade":
            # Trade affects resources indirectly
            resource = self.resources.get(decision.resource)
            resource.apply_event(decision.amount * 0.3)

        # Update strategy score based on action type
        self.strategy_scores[self.strategy] += 0.5

    def receive_reward(self, reward: float, resource_name: str):
        """Receive reward for resource changes."""
        key = f"{self.region_id}_{resource_name}"
        self.rewards[key] = self.rewards.get(key, 0.0) + reward

    def adjust_strategy(self):
        """Adjust strategy based on performance."""
        best_strategy = max(
            self.strategy_scores.keys(), key=lambda s: self.strategy_scores[s]
        )
        if best_strategy != self.strategy:
            self.strategy = best_strategy

    def to_dict(self) -> Dict:
        """Return agent state as dictionary."""
        return {
            "id": self.unique_id,
            "name": self.name,
            "region_id": self.region_id,
            "strategy": self.strategy.value,
            "resources": self.resources.get_all(),
            "history_length": len(self.history),
            "strategy_scores": {k.value: v for k, v in self.strategy_scores.items()},
        }


class AgentFactory:
    """Factory for creating AI agents."""

    strategy_names = {
        AgentStrategy.DEFENSIVE: "Guardian",
        AgentStrategy.EXPANSIVE: "Pioneer",
        AgentStrategy.NEGOTIATOR: "Diplomat",
        AgentStrategy.EXTRACTIVE: "Industrialist",
    }

    @classmethod
    def create_agent(
        cls, unique_id: int, model, region_id: int, strategy: AgentStrategy
    ) -> AIAgent:
        """Create an AI agent with given strategy."""
        name = f"{cls.strategy_names[strategy]}-{region_id}"
        return AIAgent(unique_id, model, region_id, name, strategy)
