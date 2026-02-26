"""
WorldSim — WebSocket Handler
Native FastAPI WebSocket with state broadcasting and control.
"""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

if TYPE_CHECKING:
    from ..simulation.world import WorldModel

router = APIRouter()

_world: WorldModel | None = None
_subscribers: Set[WebSocket] = set()
_broadcast_task: asyncio.Task | None = None
_tick_interval: float = 1.0


def set_world_model(model: WorldModel) -> None:
    global _world
    _world = model


def set_tick_interval(interval: float) -> None:
    global _tick_interval
    _tick_interval = interval


def start_broadcast() -> None:
    global _broadcast_task
    if _broadcast_task is None or _broadcast_task.done():
        _broadcast_task = asyncio.create_task(_broadcast_loop())


def stop_broadcast() -> None:
    global _broadcast_task
    if _broadcast_task and not _broadcast_task.done():
        _broadcast_task.cancel()
        _broadcast_task = None


async def _broadcast_loop() -> None:
    """Main loop: step simulation + broadcast state to all subscribers."""
    while True:
        try:
            await asyncio.sleep(_tick_interval)

            if _world is None:
                continue

            # Step simulation if running
            if _world.running:
                _world.step()

            if not _subscribers:
                continue

            # Broadcast compact state for efficiency
            state = _world.get_compact_state()
            message = json.dumps({"type": "state_update", "data": state})

            dead: Set[WebSocket] = set()
            for ws in _subscribers:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.add(ws)

            _subscribers -= dead

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Broadcast error: {e}")
            await asyncio.sleep(1)


async def _handle_client_message(ws: WebSocket, raw: str) -> None:
    """Handle incoming client messages."""
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        await ws.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
        return

    msg_type = msg.get("type", "")

    if msg_type == "request_state" and _world:
        state = _world.get_state()
        await ws.send_text(json.dumps({"type": "state_update", "data": state}))

    elif msg_type == "control" and _world:
        action = msg.get("action", "")
        if action == "start":
            _world.start()
        elif action == "pause":
            _world.pause()
        elif action == "reset":
            _world.reset()
        else:
            await ws.send_text(json.dumps({"type": "error", "message": f"Unknown action: {action}"}))
            return
        await ws.send_text(json.dumps({"type": "control_ack", "action": action}))

    else:
        await ws.send_text(json.dumps({"type": "error", "message": f"Unknown message type: {msg_type}"}))


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _subscribers.add(ws)

    try:
        # Send initial state
        if _world:
            state = _world.get_state()
            await ws.send_text(json.dumps({"type": "initial_state", "data": state}))

        # Listen for client messages
        while True:
            raw = await ws.receive_text()
            await _handle_client_message(ws, raw)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        _subscribers.discard(ws)
