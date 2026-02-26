"""
WorldSim — REST API Routes
Clean endpoints with proper error handling.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException

from ..models.schemas import ControlResponse, HealthResponse, WorldSummary

if TYPE_CHECKING:
    from ..simulation.world import WorldModel

router = APIRouter(prefix="/api/v1", tags=["simulation"])

_world: WorldModel | None = None


def set_world_model(model: WorldModel) -> None:
    global _world
    _world = model


def _get_world() -> WorldModel:
    if _world is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    return _world


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        simulation_running=_world is not None and _world.running,
    )


@router.get("/status", response_model=WorldSummary)
async def status():
    world = _get_world()
    return WorldSummary(**world.get_summary())


@router.get("/state")
async def full_state():
    world = _get_world()
    return world.get_state()


@router.post("/start", response_model=ControlResponse)
async def start():
    world = _get_world()
    if world.ended:
        return ControlResponse(success=False, message="Simulation has ended. Reset first.")
    world.start()
    return ControlResponse(success=True, message="Simulation started")


@router.post("/pause", response_model=ControlResponse)
async def pause():
    world = _get_world()
    world.pause()
    return ControlResponse(success=True, message="Simulation paused")


@router.post("/reset", response_model=ControlResponse)
async def reset():
    world = _get_world()
    world.reset()
    return ControlResponse(success=True, message="Simulation reset")


@router.get("/agents")
async def list_agents():
    world = _get_world()
    return [a.to_dict() for a in world.agents]


@router.get("/regions/{region_key}")
async def get_region(region_key: str):
    world = _get_world()
    region = world.regions.get(region_key)
    if region is None:
        raise HTTPException(status_code=404, detail=f"Region {region_key} not found")
    return region.to_dict()
