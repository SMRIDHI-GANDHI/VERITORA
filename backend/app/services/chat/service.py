"""Chat session orchestration."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.job_analysis import JobAnalysis
from app.services.chat.evidence import load_evidence_pack
from app.services.chat.responder import ChatAnswer, answer
from app.services.chat.sanitize import (
    CREDENTIAL_WARNING,
    INJECTION_NOTICE,
    SanitizedInput,
    sanitize_message,
)
from app.services.cyber_resources import load_cyber_resources

MAX_SESSIONS_PER_USER = 50


async def create_session(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    analysis_id: uuid.UUID | None = None,
    title: str | None = None,
) -> ChatSession:
    session = ChatSession(
        user_id=user_id,
        analysis_id=analysis_id,
        title=(title or "").strip()[:200] or None,
    )
    db.add(session)
    await db.flush()
    return session


async def get_session(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ChatSession | None:
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user_id:
        return None
    return session


async def list_sessions(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 20,
) -> list[ChatSession]:
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
        .limit(max(1, min(limit, MAX_SESSIONS_PER_USER)))
    )
    res = await db.execute(stmt)
    rows = res.scalars().all() if hasattr(res, "scalars") else []
    return list(rows)


async def list_messages(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    res = await db.execute(stmt)
    rows = res.scalars().all() if hasattr(res, "scalars") else []
    return list(rows)


async def _load_analysis(
    db: AsyncSession,
    *,
    analysis_id: uuid.UUID | None,
    user_id: uuid.UUID,
) -> JobAnalysis | None:
    if analysis_id is None:
        return None
    analysis = await db.get(JobAnalysis, analysis_id)
    if not analysis or analysis.user_id != user_id:
        return None
    return analysis


def _serialize(message: ChatMessage) -> dict[str, Any]:
    return {
        "id": str(message.id),
        "session_id": str(message.session_id),
        "role": message.role,
        "content": message.content,
        "citations": list(message.source_references or []),
        "statement_types": list(message.statement_types or []),
        "mode": message.mode,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def serialize_message(message: ChatMessage) -> dict[str, Any]:
    return _serialize(message)


async def post_message(
    db: AsyncSession,
    *,
    session: ChatSession,
    user_id: uuid.UUID,
    raw_text: str,
    llm_client: Any = None,
) -> dict[str, Any]:
    """Store a user message (if safe) and return a grounded assistant reply.

    A message that contains credentials is never persisted; the caller receives
    a warning instead. An injection-style message is stored with the
    instruction-like lines removed.
    """
    sanitized: SanitizedInput = sanitize_message(raw_text)

    if sanitized.has_credentials:
        # Nothing is written to the database: the sensitive text is discarded.
        return {
            "stored": False,
            "warning": CREDENTIAL_WARNING,
            "user_message": None,
            "assistant_message": {
                "role": "assistant",
                "content": CREDENTIAL_WARNING,
                "citations": [],
                "statement_types": ["ai_interpretation"],
                "mode": "templated",
                "created_at": None,
            },
            "injection_detected": False,
        }

    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=sanitized.safe_text,
        source_references=None,
        statement_types=None,
        mode=None,
    )
    db.add(user_message)
    await db.flush()

    analysis = await _load_analysis(
        db, analysis_id=session.analysis_id, user_id=user_id
    )
    resources = load_cyber_resources(_resources_path())
    pack = await load_evidence_pack(db, analysis=analysis, resources=resources)

    result: ChatAnswer = await answer(sanitized.safe_text, pack, client=llm_client)

    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=result.answer,
        source_references=list(result.citations),
        statement_types=list(result.statement_types),
        mode=result.mode,
    )
    db.add(assistant_message)
    await db.flush()

    warning = INJECTION_NOTICE if sanitized.injection_detected else None
    if sanitized.truncated and not warning:
        warning = "Your message was shortened because it was longer than the maximum length."

    return {
        "stored": True,
        "warning": warning,
        "user_message": _serialize(user_message),
        "assistant_message": _serialize(assistant_message),
        "injection_detected": sanitized.injection_detected,
    }


def _resources_path() -> str:
    from app.config import get_settings

    return get_settings().cybercrime_resources_file


__all__ = [
    "MAX_SESSIONS_PER_USER",
    "create_session",
    "get_session",
    "list_messages",
    "list_sessions",
    "post_message",
    "serialize_message",
]
