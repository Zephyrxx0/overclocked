"""
WorldSim - Adaptive Resource Scarcity & Agent Strategy Simulator
FastAPI Backend Application
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import routes
from .api import websocket as ws_module
from .simulation.world import WorldModel


# Global simulation instance
world_model: WorldModel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown."""
    global world_model

    # Startup: Initialize simulation
    print("Initializing WorldSim simulation...")
    world_model = WorldModel(width=5, height=5, num_agents=5)
    world_model.load_config()

    # Set world model for routes and websocket
    routes.set_world_model(world_model)
    ws_module.set_world_model(world_model)

    # Start broadcast task
    ws_module.start_broadcast()

    print("WorldSim simulation initialized successfully")
    yield

    # Shutdown: Cleanup
    print("Shutting down WorldSim...")
    ws_module.stop_broadcast()
    world_model = None


app = FastAPI(
    title="WorldSim API",
    description="Adaptive Resource Scarcity & Agent Strategy Simulator",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "simulation_running": world_model is not None}


@app.get("/api/v1/status")
async def get_status():
    """Get current simulation status."""
    if world_model is None:
        return {"error": "Simulation not initialized"}

    return {
        "running": world_model.running,
        "tick": world_model.current_tick,
        "width": world_model.width,
        "height": world_model.height,
        "num_agents": len(world_model.agents),
    }


# Include API routes
app.include_router(routes.router)
app.include_router(ws_module.router)


# Serve static files (for React build)
app.mount("/", StaticFiles(directory="static", html=True), name="static")


def start_simulation():
    """Start the simulation loop."""
    if world_model:
        world_model.run()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
