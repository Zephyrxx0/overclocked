"""
API routes for WorldSim
"""
from fastapi import APIRouter, HTTPException
from app.simulation import REGION_CONFIGS

router = APIRouter(prefix="/api", tags=["regions"])


@router.get("/regions")
async def list_regions():
    """Get all regions"""
    return {
        region_id: {
            "id": config.region_id,
            "name": config.name,
            "type": config.type,
            "position": {"x": config.x, "y": config.y},
            "dominant_tribe": config.dominant_tribe.value,
        }
        for region_id, config in REGION_CONFIGS.items()
    }


@router.get("/regions/{region_id}")
async def get_region_config(region_id: str):
    """Get specific region configuration"""
    if region_id not in REGION_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Region {region_id} not found")
    
    config = REGION_CONFIGS[region_id]
    return config.to_dict()
