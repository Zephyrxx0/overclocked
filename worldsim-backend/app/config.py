"""
Configuration and settings for WorldSim
"""
import os
from typing import Optional

# Server settings
HOST = os.getenv("WORLDSIM_HOST", "0.0.0.0")
PORT = int(os.getenv("WORLDSIM_PORT", 8000))
RELOAD = os.getenv("WORLDSIM_RELOAD", "true").lower() == "true"

# CORS settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Simulation settings
SIMULATION_STEP_INTERVAL = 0.1  # seconds between steps
INITIAL_AGENTS_PER_REGION = 50
SIMULATION_MAX_AGENTS = 300

# Logging
LOG_LEVEL = os.getenv("WORLDSIM_LOG_LEVEL", "info").upper()
