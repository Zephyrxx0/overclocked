"""
API Routes for WorldSim simulation.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

from ..simulation.world import WorldModel

router = APIRouter(prefix="/api/v1", tags=["simulation"])

# Global simulation instance (set by main.py)
world_model: WorldModel | None = None


def set_world_model(model: WorldModel):
    """Set the global simulation model (called by main.py)."""
    global world_model
    world_model = model


@router.get("/health")
async def health():
    """Health check."""
    return {"status": "ok"}


@router.get("/status")
async def get_status():
    """Get simulation status."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    return {
        "running": world_model.running,
        "tick": world_model.current_tick,
        "width": world_model.width,
        "height": world_model.height,
        "num_agents": len(world_model.agents),
    }


@router.get("/state")
async def get_state():
    """Get full simulation state."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    return world_model.get_state()


@router.post("/start")
async def start_simulation():
    """Start the simulation."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    world_model.running = True
    return {"status": "started", "tick": world_model.current_tick}


@router.post("/pause")
async def pause_simulation():
    """Pause the simulation."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    world_model.running = False
    return {"status": "paused", "tick": world_model.current_tick}


@router.post("/reset")
async def reset_simulation():
    """Reset the simulation."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    # Reinitialize the model
    from ..simulation.world import WorldModel

    world_model.__init__(
        width=world_model.width,
        height=world_model.height,
        num_agents=world_model.num_agents,
    )

    return {"status": "reset", "tick": world_model.current_tick}


@router.get("/regions")
async def get_regions():
    """Get all regions."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    return {
        "regions": [
            {"x": r.x, "y": r.y, "resources": r.resource_manager.get_all()}
            for r in world_model.regions.values()
        ]
    }


@router.get("/agents")
async def get_agents():
    """Get all agents."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    return {"agents": [agent.to_dict() for agent in world_model.agents]}
