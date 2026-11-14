from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    new_uuid_str,
    verify_password,
)
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.auth import AuthResponse, LoginRequest, ProfileUpdate, RegisterRequest, UserOut
from app.services.audit import AuditLogger

router = APIRouter(prefix="/api/v1", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_DAYS = 14


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        preferred_language=user.preferred_language,
        explanation_language=user.explanation_language,
        theme=user.theme,
    )


def _cookie_secure() -> bool:
    # Secure cookies in non-development environments; allow http in dev/test
    try:
        from app.config import get_settings

        env = get_settings().app_env.lower()
        return env not in {"development", "dev", "test", "local"}
    except Exception:
        return False


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite="strict",
        max_age=REFRESH_DAYS * 24 * 3600,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path="/api/v1/auth",
        httponly=True,
        secure=_cookie_secure(),
        samesite="strict",
    )


async def _issue_refresh(db: AsyncSession, user: User, family_id: str | None = None) -> str:
    fid = family_id or new_uuid_str()
    jti = new_uuid_str()
    token = create_refresh_token(str(user.id), fid, jti, days=REFRESH_DAYS)
    rec = RefreshToken(
        user_id=user.id,
        family_id=fid,
        jti=jti,
        token_hash=hash_token(token),
        expires_at=datetime.now(UTC) + timedelta(days=REFRESH_DAYS),
    )
    db.add(rec)
    await db.flush()
    return token


@router.post("/auth/register", status_code=201)
@limiter.limit("10/minute")
async def register(
    request: Request,
    payload: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        # Registration is allowed to say this: the user cannot proceed without
        # knowing, and it matches the behaviour users expect. Login keeps its
        # generic message so it does not reveal whether an account exists.
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists. Try signing in instead.",
        )
    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="user",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    access = create_access_token(str(user.id), user.role)
    refresh = await _issue_refresh(db, user)
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="user.register",
        resource_type="user",
        resource_id=str(user.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    _set_refresh_cookie(response, refresh)
    return AuthResponse(access_token=access, user=_user_out(user))


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    # generic message to avoid enumeration
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        await AuditLogger.log(
            db,
            actor_id=user.id if user else None,
            action="auth.login_failed",
            resource_type="user",
            resource_id=str(user.id) if user else None,
            ip=request.client.host if request.client else None,
            request_id=getattr(request.state, "request_id", None),
        )
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token(str(user.id), user.role)
    refresh = await _issue_refresh(db, user)
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="auth.login",
        resource_type="user",
        resource_id=str(user.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    _set_refresh_cookie(response, refresh)
    return AuthResponse(access_token=access, user=_user_out(user))


@router.post("/auth/refresh")
@limiter.limit("30/minute")
async def refresh_tokens(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from None
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    jti = str(payload.get("jti") or "")
    family = str(payload.get("family") or "")
    sub = str(payload.get("sub") or "")
    try:
        user_id = uuid.UUID(sub)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token") from None

    result = await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    record = result.scalar_one_or_none()
    if not record or record.user_id != user_id or record.family_id != family:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if record.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    # reuse detection: token already revoked/replaced
    if record.revoked_at is not None or record.replaced_by_jti is not None:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
        await db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")

    # rotate
    record.revoked_at = datetime.now(UTC)
    new_refresh = await _issue_refresh(db, user, family_id=family)
    # link replaced_by_jti to new one
    new_jti = decode_token(new_refresh).get("jti")
    record.replaced_by_jti = str(new_jti) if new_jti else None
    access = create_access_token(str(user.id), user.role)
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="auth.refresh",
        resource_type="user",
        resource_id=str(user.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    _set_refresh_cookie(response, new_refresh)
    return AuthResponse(access_token=access, user=_user_out(user))


@router.post("/auth/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        try:
            payload = decode_token(token)
            jti = str(payload.get("jti") or "")
            family = str(payload.get("family") or "")
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == family)
                .values(revoked_at=datetime.now(UTC))
            )
            await AuditLogger.log(
                db,
                actor_id=None,
                action="auth.logout",
                resource_type="refresh_token",
                resource_id=jti or None,
                ip=request.client.host if request.client else None,
                request_id=getattr(request.state, "request_id", None),
            )
            await db.commit()
        except Exception:
            await db.rollback()
    _clear_refresh_cookie(response)
    return Response(status_code=204)


@router.get("/me")
async def get_me(user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return _user_out(user)


@router.patch("/me")
async def patch_me(
    request: Request,
    payload: ProfileUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(user, k, v)
    await db.flush()
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="user.profile_update",
        resource_type="user",
        resource_id=str(user.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.delete("/me", status_code=204)
async def delete_me(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    # anonymize and deactivate, keep row for audit actor reference
    anon_email = f"deleted+{user.id}@deleted.local"
    user.name = None
    user.email = anon_email
    user.password_hash = hash_password(new_uuid_str() + new_uuid_str())
    user.preferred_language = None
    user.explanation_language = None
    user.theme = None
    user.is_active = False
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="user.delete_requested",
        resource_type="user",
        resource_id=str(user.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    resp = Response(status_code=204)
    _clear_refresh_cookie(resp)
    return resp
