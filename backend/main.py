"""
WorldSim — FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import routes, websocket as ws_module
from .config import SimConfig
from .simulation.world import WorldModel

_world_model: WorldModel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _world_model

    cfg = SimConfig()
    print(f"Initializing WorldSim: {cfg.grid.width}x{cfg.grid.height} grid, {cfg.num_agents} agents")
    _world_model = WorldModel(cfg)

    routes.set_world_model(_world_model)
    ws_module.set_world_model(_world_model)
    ws_module.set_tick_interval(cfg.tick_interval)
    ws_module.start_broadcast()

    print("WorldSim ready")
    yield

    print("Shutting down WorldSim...")
    ws_module.stop_broadcast()
    _world_model = None


app = FastAPI(
    title="WorldSim API",
    description="Adaptive Resource Scarcity & Agent Strategy Simulator",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)
app.include_router(ws_module.router)

# Serve frontend build if static/ dir exists
import os
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
