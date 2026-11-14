import uuid

import pytest

from app.core.rate_limit import limiter


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_register_login_and_me(app_and_client):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        r = await ac.post(
            "/api/v1/auth/register",
            json={"name": "Test User", "email": "test@example.com", "password": "password123"},
        )
        assert r.status_code == 201
        body = r.json()
        assert "access_token" in body
        assert body["user"]["email"] == "test@example.com"
        assert body["user"]["role"] == "user"
        assert "password" not in body["user"]
        assert "password_hash" not in body["user"]

        token = body["access_token"]
        me = await ac.get("/api/v1/me", headers=_auth(token))
        assert me.status_code == 200
        assert me.json()["email"] == "test@example.com"

        # login
        r2 = await ac.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
        assert r2.status_code == 200
        assert "access_token" in r2.json()

        # wrong password generic
        bad = await ac.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert bad.status_code == 401
        assert bad.json().get("detail") == "Invalid credentials"
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_register_duplicate_email_is_actionable(app_and_client):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        body = {"name": "Dupe User", "email": "dupe@example.com", "password": "password123"}
        first = await ac.post("/api/v1/auth/register", json=body)
        assert first.status_code == 201

        second = await ac.post("/api/v1/auth/register", json=body)
        assert second.status_code == 400
        payload = second.json()
        assert payload["code"] == "HTTP_ERROR"
        assert "already exists" in payload["detail"].lower()
        assert "sign" in payload["detail"].lower()
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_patch_and_delete_me_anonymizes(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        r = await ac.post(
            "/api/v1/auth/register",
            json={"name": "Del User", "email": "del@example.com", "password": "password123"},
        )
        token = r.json()["access_token"]
        uid = r.json()["user"]["id"]

        p = await ac.patch(
            "/api/v1/me",
            headers=_auth(token),
            json={"preferred_language": "hi", "theme": "dark", "name": "New Name"},
        )
        assert p.status_code == 200
        assert p.json()["preferred_language"] == "hi"
        assert p.json()["theme"] == "dark"

        d = await ac.delete("/api/v1/me", headers=_auth(token))
        assert d.status_code == 204

        # user anonymized but row kept (for audit actor id)
        users = list(store["users"].values())
        assert len(users) == 1
        u = users[0]
        assert u.is_active is False
        assert u.email != "del@example.com"
        assert str(u.id) == uid
        # audit logs should include delete action with actor id
        audits = list(store["audit_logs"].values())
        actions = [a.action for a in audits]
        assert "user.delete_requested" in actions
        del_audits = [a for a in audits if a.action == "user.delete_requested"]
        assert any(str(a.actor_id) == uid for a in del_audits)
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_refresh_rotation_invalidates_reused_token(app_and_client):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        r = await ac.post(
            "/api/v1/auth/register",
            json={"name": "R User", "email": "r@example.com", "password": "password123"},
        )
        assert r.status_code == 201
        old_cookie = ac.cookies.get("refresh_token")
        assert old_cookie

        # first refresh -> rotates
        r1 = await ac.post("/api/v1/auth/refresh")
        assert r1.status_code == 200
        new_cookie = ac.cookies.get("refresh_token")
        assert new_cookie and new_cookie != old_cookie

        # reuse old cookie -> should fail and invalidate family
        ac.cookies.set("refresh_token", old_cookie, path="/api/v1/auth")
        r2 = await ac.post("/api/v1/auth/refresh")
        assert r2.status_code == 401

        # new cookie should also be invalidated after reuse detection
        ac.cookies.set("refresh_token", new_cookie, path="/api/v1/auth")
        r3 = await ac.post("/api/v1/auth/refresh")
        assert r3.status_code == 401
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_authz_matrix_b02_routes(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        # create users with different roles directly in store
        from app.core.security import hash_password
        from app.db.models.user import User

        def mk(role, email):
            u = User(
                id=uuid.uuid4(),
                name=role,
                email=email,
                password_hash=hash_password("password123"),
                role=role,
                is_active=True,
            )
            store["users"][u.id] = u
            return u

        user = mk("user", "u@example.com")
        mod = mk("moderator", "m@example.com")
        admin = mk("admin", "a@example.com")

        from app.core.security import create_access_token

        t_user = create_access_token(str(user.id), "user")
        t_mod = create_access_token(str(mod.id), "moderator")
        t_admin = create_access_token(str(admin.id), "admin")

        # anon
        assert (await ac.get("/api/v1/me")).status_code == 401
        assert (await ac.patch("/api/v1/me", json={"name": "x"})).status_code == 401
        assert (await ac.delete("/api/v1/me")).status_code == 401

        # user/mod/admin can access own /me
        for tok in (t_user, t_mod, t_admin):
            assert (await ac.get("/api/v1/me", headers=_auth(tok))).status_code == 200
            assert (
                await ac.patch("/api/v1/me", headers=_auth(tok), json={"name": "n"})
            ).status_code == 200

        # logout without cookie still 204
        assert (await ac.post("/api/v1/auth/logout")).status_code == 204
        # refresh without cookie 401
        ac.cookies.clear()
        assert (await ac.post("/api/v1/auth/refresh")).status_code == 401
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_rate_limit_login(app_and_client):
    app, ac = app_and_client
    limiter.reset()
    limiter.enabled = True
    try:
        # 5/min limit on login
        codes = []
        limited = None
        for _ in range(6):
            r = await ac.post(
                "/api/v1/auth/login",
                json={"email": "none@example.com", "password": "bad"},
            )
            codes.append(r.status_code)
            if r.status_code == 429 and limited is None:
                limited = r
        assert 429 in codes
        # Rejections must follow the documented problem-JSON contract, not
        # slowapi's default {"error": ...} shape.
        assert limited is not None
        body = limited.json()
        assert body["status"] == 429
        assert body["code"] == "RATE_LIMITED"
        assert body["title"] == "Too many requests"
        assert limited.headers.get("Retry-After") == "60"
    finally:
        limiter.enabled = True
        limiter.reset()
