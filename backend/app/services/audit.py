from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit_log import AuditLog


def hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


class AuditLogger:
    @staticmethod
    async def log(
        db: AsyncSession,
        *,
        actor_id: Any | None,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        ip: str | None = None,
        request_id: str | None = None,
    ) -> None:
        entry = AuditLog(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            ip_hash=hash_ip(ip),
            request_id=request_id,
        )
        db.add(entry)
        await db.flush()
