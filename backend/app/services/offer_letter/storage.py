from __future__ import annotations

import os
import secrets
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class StoredFile:
    path: Path
    key: str
    created_at: float
    expires_at: float
    size: int


def get_storage_dir() -> Path:
    # keep inside backend working tree by default (private, not served)
    base = Path(os.getenv("OFFER_STORAGE_DIR") or "backend/storage/offer_letters")
    if not base.is_absolute():
        # resolve relative to cwd
        base = Path.cwd() / base
    base.mkdir(parents=True, exist_ok=True)
    return base


def save_upload(data: bytes, *, suffix: str, ttl_seconds: int = 24 * 3600) -> StoredFile:
    storage = get_storage_dir()
    key = secrets.token_hex(16)
    safe_suffix = suffix if suffix in {".pdf", ".png", ".jpg", ".jpeg"} else ".bin"
    path = storage / f"{key}{safe_suffix}"
    # write bytes
    with open(path, "wb") as f:
        f.write(data)
    now = time.time()
    return StoredFile(
        path=path,
        key=key,
        created_at=now,
        expires_at=now + ttl_seconds,
        size=len(data),
    )


def delete_file(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except Exception:
        # best-effort; never crash on cleanup
        pass


def cleanup_expired(ttl_seconds: int = 24 * 3600) -> int:
    storage = get_storage_dir()
    now = time.time()
    removed = 0
    try:
        for p in storage.iterdir():
            if not p.is_file():
                continue
            try:
                age = now - p.stat().st_mtime
                if age > ttl_seconds:
                    p.unlink()
                    removed += 1
            except Exception:
                continue
    except Exception:
        return removed
    return removed
