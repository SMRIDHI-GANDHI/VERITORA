from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rate_limit import limiter
from app.db.models.job_analysis import JobAnalysis
from app.db.models.user import User
from app.db.session import get_db
from app.services.chat.service import (
    create_session,
    get_session,
    list_messages,
    list_sessions,
    post_message,
    serialize_message,
)
from app.services.llm import get_llm_client

router = APIRouter(prefix="/api/v1", tags=["chat"])

MAX_MESSAGE_CHARS = 4000


@router.post("/chat/sessions", status_code=201)
@limiter.limit("20/minute")
async def create_chat_session(
    request: Request,
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    analysis_id: uuid.UUID | None = None
    raw_analysis_id = payload.get("analysis_id")
    if raw_analysis_id:
        try:
            analysis_id = uuid.UUID(str(raw_analysis_id))
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid analysis_id") from None
        analysis = await db.get(JobAnalysis, analysis_id)
        if not analysis or analysis.user_id != user.id:
            # 404 rather than 403: do not reveal that another user's analysis exists.
            raise HTTPException(status_code=404, detail="Not found")

    title = payload.get("title")
    session = await create_session(
        db,
        user_id=user.id,
        analysis_id=analysis_id,
        title=str(title) if title else None,
    )
    await db.commit()
    await db.refresh(session)
    return {
        "id": str(session.id),
        "analysis_id": str(session.analysis_id) if session.analysis_id else None,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/chat/sessions")
@limiter.limit("60/minute")
async def list_chat_sessions(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    sessions = await list_sessions(db, user_id=user.id)
    return {
        "items": [
            {
                "id": str(s.id),
                "analysis_id": str(s.analysis_id) if s.analysis_id else None,
                "title": s.title,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sessions
        ]
    }


@router.get("/chat/sessions/{session_id}")
@limiter.limit("60/minute")
async def get_chat_session(
    request: Request,
    session_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        sid = uuid.UUID(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    session = await get_session(db, session_id=sid, user_id=user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    messages = await list_messages(db, session_id=sid)
    return {
        "id": str(session.id),
        "analysis_id": str(session.analysis_id) if session.analysis_id else None,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "messages": [serialize_message(m) for m in messages],
    }


@router.post("/chat/sessions/{session_id}/messages")
@limiter.limit("30/minute")
async def post_chat_message(
    request: Request,
    session_id: str,
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        sid = uuid.UUID(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    session = await get_session(db, session_id=sid, user_id=user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Not found")

    text = payload.get("message")
    if text is None:
        text = payload.get("content")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=422, detail="message is required")
    if len(text) > MAX_MESSAGE_CHARS * 2:
        raise HTTPException(status_code=422, detail="message is too long")

    result = await post_message(
        db,
        session=session,
        user_id=user.id,
        raw_text=text,
        llm_client=get_llm_client(),
    )
    await db.commit()
    return {
        "session_id": str(session.id),
        "stored": result["stored"],
        "warning": result["warning"],
        "injection_detected": result["injection_detected"],
        "user_message": result["user_message"],
        "assistant_message": result["assistant_message"],
    }
