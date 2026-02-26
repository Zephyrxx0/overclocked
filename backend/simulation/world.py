"""
World and Region classes for WorldSim simulation.
Defines the grid-based world structure.
"""

import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from mesa import AgentBasedModel, Grid
from mesa.time import RandomActivation

from .agents import AIAgent, AgentFactory, AgentStrategy
from .resources import ResourceManager


@dataclass
class ClimateEvent:
    """Represents a climate event affecting the world."""

    name: str
    severity: float  # 0.0 to 1.0
    affected_resources: List[str]
    duration: int  # ticks


class Region:
    """Represents a single region in the world grid."""

    def __init__(
        self,
        x: int,
        y: int,
        resource_config: Optional[Dict] = None,
    ):
        self.x = x
        self.y = y
        self.pos = (x, y)
        self.resource_manager = ResourceManager(resource_config)
        self.agent: Optional[AIAgent] = None
        self.climate_events: List[ClimateEvent] = []

    def step(self):
        """Execute one tick for this region."""
        # Handle climate events
        self._process_climate_events()

        # Regenerate resources
        self.resource_manager.regenerate_all()

    def _process_climate_events(self):
        """Process active climate events."""
        active_events = []
        for event in self.climate_events:
            for resource_name in event.affected_resources:
                change = -(
                    event.severity * 100 * (1 - event.duration / 10)
                )  # Decreasing effect
                self.resource_manager.apply_event(resource_name, change)
            event.duration -= 1
            if event.duration > 0:
                active_events.append(event)
        self.climate_events = active_events

    def add_climate_event(self, event: ClimateEvent):
        """Add a climate event to this region."""
        self.climate_events.append(event)

    def to_dict(self) -> Dict:
        """Return region state as dictionary."""
        return {
            "x": self.x,
            "y": self.y,
            "resources": self.resource_manager.get_all(),
            "has_agent": self.agent is not None,
            "agent_strategy": self.agent.strategy.value if self.agent else None,
            "climate_events": [e.name for e in self.climate_events],
        }


class WorldModel(AgentBasedModel):
    """
    Main simulation model - grid-based world with regions and agents.
    """

    def __init__(
        self,
        width: int = 5,
        height: int = 5,
        num_agents: int = 5,
        region_resources: Optional[Dict] = None,
    ):
        self.width = width
        self.height = height
        self.num_agents = min(num_agents, width * height)

        # Simulation state
        self.current_tick = 0
        self.running = True
        self.start_tick = 0

        # Mesa components
        self.grid = Grid(width, height, torus=False)
        self.scheduler = RandomActivation(self)

        # World components
        self.regions: Dict[Tuple[int, int], Region] = {}
        self.agents: List[AIAgent] = []

        # Configuration
        self.resource_config = region_resources
        self.climate_event_rate = 0.1  # 10% chance per tick per region

        # Initialize world
        self._initialize_world()

    def _initialize_world(self):
        """Initialize the world grid and agents."""
        # Create regions
        for x in range(self.width):
            for y in range(self.height):
                region = Region(x, y, self.resource_config)
                self.regions[(x, y)] = region

        # Create and place agents
        strategies = list(AgentStrategy)
        for i in range(self.num_agents):
            # Get random position
            x = i % self.width
            y = i // self.width

            if (x, y) in self.regions:
                # Create agent with random strategy
                strategy = random.choice(strategies)
                agent = AgentFactory.create_agent(
                    unique_id=i,
                    model=self,
                    region_id=i,
                    strategy=strategy,
                )

                self.regions[(x, y)].agent = agent
                self.scheduler.add(agent)
                self.agents.append(agent)

    def load_config(self):
        """Load configuration from file or defaults."""
        pass  # Placeholder for config loading

    def step(self):
        """Execute one tick of the simulation."""
        # 1. Schedule and run all agents
        self.scheduler.step()

        # 2. Update regions (climate events, regeneration)
        for region in self.regions.values():
            region.step()

        # 3. Check for climate events
        self._check_climate_events()

        # 4. Update tick counter
        self.current_tick += 1

        # 5. Check for end conditions
        if self._should_end():
            self.running = False

    def _check_climate_events(self):
        """Check for and create climate events."""
        if random.random() > self.climate_event_rate:
            return

        # Create a climate event
        event = ClimateEvent(
            name=random.choice(["drought", "flood", "heatwave", "frost", "storm"]),
            severity=random.uniform(0.3, 0.8),
            affected_resources=random.sample(
                ["water", "food", "energy", "land"], k=random.randint(1, 3)
            ),
            duration=random.randint(5, 15),
        )

        # Apply to random regions
        num_affected = random.randint(1, max(1, self.width * self.height // 3))
        positions = list(self.regions.keys())
        random.shuffle(positions)

        for i in range(num_affected):
            if i < len(positions):
                self.regions[positions[i]].add_climate_event(event)

    def _should_end(self) -> bool:
        """Check if simulation should end."""
        # End if all regions are collapsed
        collapsed = sum(
            1 for r in self.regions.values() if r.resource_manager.total_resources()
            < 10
        )
        return collapsed >= len(self.regions) * 0.8

    def get_state(self) -> Dict:
        """Get full simulation state."""
        return {
            "tick": self.current_tick,
            "running": self.running,
            "width": self.width,
            "height": self.height,
            "num_agents": len(self.agents),
            "regions": {
                f"{pos[0]}-{pos[1]}": region.to_dict()
                for pos, region in self.regions.items()
            },
            "agents": [agent.to_dict() for agent in self.agents],
        }

    def run(self, num_steps: int = 100):
        """Run the simulation for a number of steps."""
        for _ in range(num_steps):
            if not self.running:
                break
            self.step()
