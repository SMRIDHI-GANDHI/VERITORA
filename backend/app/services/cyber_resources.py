from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CyberResource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: str
    label: str
    url: str | None = None
    tel: str | None = None
    href: str | None = None
    email: str | None = None
    primary: bool | None = None


class CyberResourcesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    country: str
    disclaimer_key: str
    reviewed_at: str
    resources: list[CyberResource] = Field(min_length=1)


def resolve_resources_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p
    # resolve relative to backend/ (cwd when running backend) or to package root
    if p.exists():
        return p
    alt = Path(__file__).resolve().parents[2] / path_str
    return alt if alt.exists() else p


def load_cyber_resources(path_str: str) -> dict[str, Any]:
    path = resolve_resources_path(path_str)
    data = json.loads(path.read_text(encoding="utf-8"))
    payload = CyberResourcesPayload.model_validate(data)
    return payload.model_dump(exclude_none=True)


def validate_cyber_resources_config(path_str: str) -> None:
    # raises on malformed/missing config
    load_cyber_resources(path_str)
