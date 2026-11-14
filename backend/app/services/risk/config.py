from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]


def _load_yaml(name: str) -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "config" / name
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data or {}


@lru_cache(maxsize=1)
def load_weights() -> dict[str, Any]:
    return _load_yaml("weights.yaml")


@lru_cache(maxsize=1)
def load_recommendations_config() -> dict[str, Any]:
    return _load_yaml("recommendations.yaml")


@lru_cache(maxsize=1)
def load_signals_meta() -> dict[str, Any]:
    return _load_yaml("signals.yaml")


def rules_version() -> str:
    meta = load_signals_meta()
    return str(meta.get("version") or "rules-2026.11.1")
