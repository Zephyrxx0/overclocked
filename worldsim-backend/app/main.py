"""
WorldSim FastAPI Server — Decoupled asyncio Architecture
  • Mesa step() runs in a dedicated asyncio background task
  • Results pushed to asyncio.Queue (thread-safe)
  • FastAPI reader task drains queue and broadcasts at ≤2 Hz
  • WebSocket clients control start/stop/reset via JSON messages
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import logging
from typing import Set
from contextlib import asynccontextmanager

from app.simulation.agents import WorldSimModel
from app.simulation.models import REGION_CONFIGS
from app.api.routes import router as api_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s | %(message)s")
logger = logging.getLogger("worldsim.main")

# ─── Shared state ──────────────────────────────────────────────────────────────

class SimState:
    def __init__(self):
        self.model: WorldSimModel = WorldSimModel(REGION_CONFIGS)
        self.running:   bool      = False
        self.sim_task:  asyncio.Task | None = None
        self.broadcast_task: asyncio.Task | None = None
        # Queue that decouples Mesa loop from WebSocket broadcast
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=8)

sim = SimState()


# ─── WebSocket Connection Manager ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.add(ws)
        logger.info(f"WS client connected  (total={len(self.connections)})")

    def disconnect(self, ws: WebSocket):
        self.connections.discard(ws)
        logger.info(f"WS client disconnected (total={len(self.connections)})")

    async def broadcast(self, payload: dict):
        dead = set()
        for ws in list(self.connections):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to(self, ws: WebSocket, payload: dict):
        try:
            await ws.send_json(payload)
        except Exception:
            self.disconnect(ws)


manager = ConnectionManager()


# ─── Background tasks ──────────────────────────────────────────────────────────

async def _simulation_loop():
    """
    Runs the Mesa model step() in a tight asyncio loop.
    Yields control every 150 ms so the event loop stays responsive.
    Pushes world state snapshots to the asyncio.Queue (drops oldest if full).
    """
    logger.info("Simulation loop STARTED")
    while sim.running:
        try:
            sim.model.step()
            snapshot = sim.model.get_world_state()

            # Non-blocking put — drop oldest frame if queue is full
            if sim.queue.full():
                try:
                    sim.queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            sim.queue.put_nowait(snapshot)

        except Exception as exc:
            logger.error(f"Error in sim loop: {exc}", exc_info=True)

        await asyncio.sleep(0.15)   # ~6.7 steps/s max; capped by broadcast

    logger.info("Simulation loop STOPPED")


async def _broadcast_loop():
    """
    Drains the asyncio.Queue at ≤ 2 frames/s and broadcasts to all WS clients.
    """
    logger.info("Broadcast loop STARTED")
    interval = 0.5   # 2 Hz
    while True:
        await asyncio.sleep(interval)
        if not sim.running:
            continue
        try:
            snapshot = sim.queue.get_nowait()
            await manager.broadcast({"type": "state_update", "data": snapshot})
        except asyncio.QueueEmpty:
            pass
        except Exception as exc:
            logger.error(f"Broadcast error: {exc}", exc_info=True)


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("WorldSim server starting …")
    # Start the permanent broadcast task
    sim.broadcast_task = asyncio.create_task(_broadcast_loop(), name="broadcast")
    yield
    logger.info("WorldSim server shutting down …")
    sim.running = False
    if sim.sim_task:
        sim.sim_task.cancel()
    if sim.broadcast_task:
        sim.broadcast_task.cancel()


# ─── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="WorldSim API",
    description="Autonomous Resource Scarcity & RL Strategy Simulator",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


# ─── Internal helpers ──────────────────────────────────────────────────────────

async def _start():
    if not sim.running:
        sim.running = True
        sim.sim_task = asyncio.create_task(_simulation_loop(), name="simulation")
        logger.info("Simulation STARTED")
        return {"status": "started"}
    return {"status": "already_running"}


async def _stop():
    sim.running = False
    if sim.sim_task:
        sim.sim_task.cancel()
        sim.sim_task = None
    logger.info("Simulation STOPPED")
    return {"status": "stopped"}


async def _reset():
    await _stop()
    sim.model = WorldSimModel(REGION_CONFIGS)
    snapshot  = sim.model.get_world_state()
    await manager.broadcast({"type": "simulation_reset", "data": snapshot})
    logger.info("Simulation RESET")
    return {"status": "reset", "data": snapshot}


# ─── REST endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":     "ok",
        "running":    sim.running,
        "step":       sim.model.step_count,
        "clients":    len(manager.connections),
        "weather":    sim.model.weather_engine.active_event_name,
    }


@app.post("/simulation/start")
async def start_simulation():
    return await _start()


@app.post("/simulation/stop")
async def stop_simulation():
    return await _stop()


@app.post("/simulation/reset")
async def reset_simulation():
    return await _reset()


@app.get("/simulation/state")
async def get_state():
    return sim.model.get_world_state()


@app.get("/regions")
async def get_regions():
    return {rid: cfg.to_dict() for rid, cfg in REGION_CONFIGS.items()}


# ─── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    # Send initial state immediately on connect
    await manager.send_to(websocket, {
        "type": "state_update",
        "data": sim.model.get_world_state(),
    })

    try:
        while True:
            raw  = await websocket.receive_text()
            msg  = json.loads(raw)
            kind = msg.get("type", "")

            if kind == "start":
                result = await _start()
                await manager.send_to(websocket, {"type": "control_ack", "data": result})

            elif kind == "stop":
                result = await _stop()
                await manager.send_to(websocket, {"type": "control_ack", "data": result})

            elif kind == "reset":
                await _reset()

            elif kind == "get_state":
                await manager.send_to(websocket, {
                    "type": "state_update",
                    "data": sim.model.get_world_state(),
                })

            elif kind == "ping":
                await manager.send_to(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.error(f"WS error: {exc}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
