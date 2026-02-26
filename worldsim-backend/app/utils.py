"""
Utility functions for WorldSim
"""
import json
from datetime import datetime
from typing import Any, Dict


def serialize_world_state(world_state: Dict[str, Any]) -> str:
    """Serialize world state to JSON with custom encoders"""
    return json.dumps(world_state, default=serialize_helper)


def serialize_helper(obj: Any) -> Any:
    """Helper for JSON serialization"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, '__dict__'):
        return obj.__dict__
    return str(obj)


def log_event(event_type: str, details: str) -> None:
    """Log simulation events"""
    timestamp = datetime.now().isoformat()
    print(f"[{timestamp}] {event_type}: {details}")
