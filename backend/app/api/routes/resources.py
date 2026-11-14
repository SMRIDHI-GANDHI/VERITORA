from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response

from app.config import get_settings
from app.services.cyber_resources import load_cyber_resources

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])


@router.get("/cybercrime")
async def get_cybercrime_resources(response: Response) -> dict[str, Any]:
    settings = get_settings()
    data = load_cyber_resources(settings.cybercrime_resources_file)
    # public, cacheable
    response.headers["Cache-Control"] = "public, max-age=3600"
    return data
