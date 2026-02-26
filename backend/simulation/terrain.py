"""
WorldSim — Procedural Terrain Generation
Generates a 2D grid of terrain types using value noise with climate zones.
"""

from __future__ import annotations

import math
import random
from typing import Dict, List, Tuple

import numpy as np

from ..config import (
    CLIMATE_TERRAIN_WEIGHTS,
    TERRAIN_TYPES,
    GridConfig,
    ClimateConfig,
)


def _value_noise_2d(width: int, height: int, scale: float = 0.08, seed: int = 0) -> np.ndarray:
    """Simple value noise for terrain generation."""
    rng = np.random.RandomState(seed)
    # Low-res noise grid, then bilinear interpolate
    lw = max(2, int(width * scale) + 2)
    lh = max(2, int(height * scale) + 2)
    coarse = rng.rand(lh, lw)

    # Bilinear interpolation to full size
    out = np.zeros((height, width), dtype=np.float64)
    for y in range(height):
        for x in range(width):
            fx = x * scale
            fy = y * scale
            ix = int(fx) % lw
            iy = int(fy) % lh
            ix1 = (ix + 1) % lw
            iy1 = (iy + 1) % lh
            dx = fx - int(fx)
            dy = fy - int(fy)
            top = coarse[iy, ix] * (1 - dx) + coarse[iy, ix1] * dx
            bot = coarse[iy1, ix] * (1 - dx) + coarse[iy1, ix1] * dx
            out[y, x] = top * (1 - dy) + bot * dy
    return out


def generate_climate_zones(
    width: int, height: int, zones: List[str], seed: int = 0
) -> np.ndarray:
    """Assign climate zones using latitude bands + noise perturbation."""
    noise = _value_noise_2d(width, height, scale=0.04, seed=seed + 100)
    n_zones = len(zones)
    zone_grid = np.empty((height, width), dtype=object)

    for y in range(height):
        # Base latitude band
        lat_frac = y / max(1, height - 1)  # 0=top(polar) -> 1=bottom(polar)
        # Map to zone index with noise perturbation
        base_idx = lat_frac * (n_zones - 1)
        perturbed = base_idx + (noise[y, :] - 0.5) * 1.5
        perturbed = np.clip(perturbed, 0, n_zones - 1)
        for x in range(width):
            zone_grid[y, x] = zones[int(round(perturbed[x]))]

    return zone_grid


def generate_terrain(
    grid_cfg: GridConfig,
    climate_cfg: ClimateConfig,
    seed: int | None = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate terrain grid and climate zone grid.
    Returns (terrain_grid, climate_grid) both shape (height, width) with string values.
    """
    if seed is None:
        seed = random.randint(0, 2**31)

    w, h = grid_cfg.width, grid_cfg.height
    rng = np.random.RandomState(seed)

    # Generate climate zones
    climate_grid = generate_climate_zones(w, h, climate_cfg.climate_zones, seed)

    # For each cell, pick terrain based on climate zone weights
    terrain_grid = np.empty((h, w), dtype=object)
    terrain_names = list(TERRAIN_TYPES.keys())

    # Also use elevation noise to bias toward mountains at high elevations
    elevation = _value_noise_2d(w, h, scale=0.06, seed=seed + 200)
    moisture = _value_noise_2d(w, h, scale=0.07, seed=seed + 300)

    for y in range(h):
        for x in range(w):
            zone = climate_grid[y, x]
            weights = CLIMATE_TERRAIN_WEIGHTS.get(zone, CLIMATE_TERRAIN_WEIGHTS["temperate"])

            # Modify weights based on elevation/moisture noise
            elev = elevation[y, x]
            moist = moisture[y, x]

            adjusted = {}
            for t in terrain_names:
                w_base = weights.get(t, 0.0)
                # Mountains more likely at high elevation
                if t == "mountains" and elev > 0.7:
                    w_base *= 3.0
                elif t == "hilly" and elev > 0.5:
                    w_base *= 2.0
                # Water features more likely at high moisture
                if t in ("river", "lake", "swamp") and moist > 0.6:
                    w_base *= 2.5
                # Desert less likely at high moisture
                if t == "desert" and moist > 0.5:
                    w_base *= 0.3
                adjusted[t] = max(w_base, 0.01)

            total = sum(adjusted.values())
            probs = [adjusted[t] / total for t in terrain_names]
            terrain_grid[y, x] = rng.choice(terrain_names, p=probs)

    return terrain_grid, climate_grid


def get_terrain_modifiers(terrain_type: str) -> Dict[str, float]:
    """Get resource modifiers for a terrain type."""
    return TERRAIN_TYPES.get(terrain_type, TERRAIN_TYPES["plains"])
