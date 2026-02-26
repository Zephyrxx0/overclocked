"""
main.py  –  WorldSim FastAPI backend (FastAPI 0.133 / uvicorn 0.41)
--------------------------------------------------------------------
Uses the modern `lifespan` context manager instead of deprecated
@app.on_event("startup") / @app.on_event("shutdown") handlers.
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Set

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simulation import start_simulation, stop_simulation, pause_simulation, resume_simulation

# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
logger = logging.getLogger("worldsim.main")

_state_queue: asyncio.Queue = asyncio.Queue(maxsize=50)
_clients: Set[WebSocket] = set()
_is_running: bool = True


# ──────────────────────────────────────────────────────────────────────────────
# Broadcaster coroutine (drains queue → fans out to all WS clients)
# ──────────────────────────────────────────────────────────────────────────────

async def broadcaster() -> None:
    while True:
        state = await _state_queue.get()
        if not _clients:
            continue
        payload = json.dumps(state)
        dead: Set[WebSocket] = set()
        for ws in list(_clients):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        _clients.difference_update(dead)


# ──────────────────────────────────────────────────────────────────────────────
# Lifespan (FastAPI 0.93+ recommended approach)
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    start_simulation(_state_queue, loop)
    task = asyncio.create_task(broadcaster(), name="broadcaster")
    logger.info("WorldSim backend started — simulation running.")
    yield
    stop_simulation()
    task.cancel()
    logger.info("WorldSim backend shut down.")


# ──────────────────────────────────────────────────────────────────────────────
# App
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="WorldSim API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket endpoint
# ──────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    _clients.add(websocket)
    client = websocket.client
    logger.info("Client connected: %s  (total: %d)", client, len(_clients))
    try:
        while True:
            # Keep alive – we push; client just needs to stay connected
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("WS error: %s", e)
    finally:
        _clients.discard(websocket)
        logger.info("Client disconnected. (remaining: %d)", len(_clients))


# ──────────────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "clients": len(_clients), "running": _is_running}


@app.get("/status")
async def status() -> dict:
    return {"running": _is_running}


@app.post("/control")
async def control(body: dict) -> dict:
    global _is_running
    action = body.get("action", "")
    if action == "stop":
        _is_running = False
        pause_simulation()
        return {"running": False}
    elif action == "start":
        _is_running = True
        resume_simulation()
        return {"running": True}
    return {"error": "Unknown action"}


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
