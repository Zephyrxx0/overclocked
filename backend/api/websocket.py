"""
WebSocket handler for WorldSim simulation.
Handles real-time client connections and state broadcasts.
"""

import asyncio
import json
import logging
from typing import Dict, List, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..simulation.world import WorldModel

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = logging.getLogger(__name__)

# Global state
subscriptions: Set[WebSocket] = set()
world_model: WorldModel | None = None
broadcast_task = None


def set_world_model(model: WorldModel):
    """Set the global simulation model."""
    global world_model
    world_model = model


async def broadcast_state():
    """Broadcast simulation state to all connected clients."""
    if world_model is None:
        return

    state = world_model.get_state()
    message = json.dumps({"type": "state_update", "data": state})

    disconnected = set()
    for client in subscriptions:
        try:
            await client.send_text(message)
        except Exception as e:
            logger.error(f"Error sending to client: {e}")
            disconnected.add(client)

    # Remove disconnected clients
    for client in disconnected:
        subscriptions.discard(client)


async def broadcast_tick_loop(interval: float = 1.0):
    """Background task to broadcast tick updates."""
    while True:
        await asyncio.sleep(interval)
        if subscriptions and world_model:
            await broadcast_state()


@router.websocket("/subscribe")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for client subscriptions."""
    await websocket.accept()
    subscriptions.add(websocket)
    logger.info(f"Client connected. Total subscribers: {len(subscriptions)}")

    try:
        # Send initial state
        if world_model:
            initial_state = world_model.get_state()
            await websocket.send_text(
                json.dumps({"type": "initial_state", "data": initial_state})
            )

        # Handle incoming messages
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                await handle_client_message(websocket, message)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Invalid JSON"})
                )

    except WebSocketDisconnect:
        subscriptions.discard(websocket)
        logger.info(f"Client disconnected. Total subscribers: {len(subscriptions)}")


async def handle_client_message(websocket: WebSocket, message: Dict):
    """Handle a message from a client."""
    msg_type = message.get("type", "")

    if msg_type == "request_state":
        if world_model:
            state = world_model.get_state()
            await websocket.send_text(
                json.dumps({"type": "state_update", "data": state})
            )

    elif msg_type == "control":
        action = message.get("action", "")
        if action == "start" and world_model:
            world_model.running = True
        elif action == "pause" and world_model:
            world_model.running = False
        elif action == "reset" and world_model:
            world_model.__init__(
                width=world_model.width,
                height=world_model.height,
                num_agents=world_model.num_agents,
            )

    else:
        await websocket.send_text(
            json.dumps({"type": "error", "message": f"Unknown message type: {msg_type}"})
        )


def start_broadcast():
    """Start the broadcast task."""
    global broadcast_task
    if broadcast_task is None:
        broadcast_task = asyncio.create_task(broadcast_tick_loop())


def stop_broadcast():
    """Stop the broadcast task."""
    global broadcast_task
    if broadcast_task:
        broadcast_task.cancel()
        broadcast_task = None
