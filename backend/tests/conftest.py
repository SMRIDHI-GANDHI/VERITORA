from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import limiter
from app.db.session import get_db
from app.main import create_app


@dataclass
class FakeResult:
    row: Any = None
    rows: list[Any] = field(default_factory=list)

    def scalar_one_or_none(self):
        return self.row

    def scalar(self):
        return self.row

    def scalars(self):
        return self

    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, store: dict[str, dict[Any, Any]]):
        self.store = store
        self.new: list[Any] = []

    async def get(self, model, ident):
        return self.store[model.__tablename__].get(ident)

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        if getattr(obj, "created_at", None) is None and hasattr(obj, "created_at"):
            obj.created_at = datetime.now(UTC)
        if getattr(obj, "updated_at", None) is None and hasattr(obj, "updated_at"):
            obj.updated_at = datetime.now(UTC)
        self.new.append(obj)

    async def flush(self):
        for obj in self.new:
            table = obj.__tablename__
            self.store[table][obj.id] = obj
        self.new = []

    async def commit(self):
        await self.flush()

    async def rollback(self):
        self.new = []

    async def refresh(self, obj):
        return obj

    async def execute(self, stmt, *args, **kwargs):
        # handle simple select/update used in auth
        _ = str(stmt)
        # try to interpret common patterns by inspecting statement
        try:
            from sqlalchemy.sql.dml import Update
            from sqlalchemy.sql.selectable import Select

            if isinstance(stmt, Select):
                # determine model
                entity = stmt.column_descriptions[0]["entity"]
                table = entity.__tablename__
                items = list(self.store[table].values())
                # apply very limited where conditions
                where = stmt.whereclause
                if where is not None:
                    items = self._filter(items, where)
                row = items[0] if items else None
                return FakeResult(row=row, rows=items)
            if isinstance(stmt, Update):
                entity = stmt.entity_description["entity"]
                table = entity.__tablename__
                items = list(self.store[table].values())
                where = stmt.whereclause
                if where is not None:
                    items = self._filter(items, where)
                # extract values from _values
                compiled_vals = {}
                if hasattr(stmt, "_values"):
                    for col, bind in stmt._values.items():
                        key = getattr(col, "key", str(col))
                        # bind may be BindParameter with value/effective_value
                        if hasattr(bind, "value"):
                            compiled_vals[key] = bind.value
                        elif hasattr(bind, "effective_value"):
                            compiled_vals[key] = bind.effective_value
                        else:
                            compiled_vals[key] = bind
                for it in items:
                    for k, v in compiled_vals.items():
                        setattr(it, k, v)
                return FakeResult(rows=items)
        except Exception:
            pass
        return FakeResult()

    def _filter(self, items, where):
        # very small subset: equality and is_ / and_
        try:
            from sqlalchemy.sql.elements import BinaryExpression, BooleanClauseList

            if isinstance(where, BooleanClauseList):
                for c in where.clauses:
                    items = self._filter(items, c)
                return items
            if isinstance(where, BinaryExpression):
                left = where.left
                right = where.right
                key = getattr(left, "key", None)
                op = (
                    where.operator.__name__
                    if hasattr(where.operator, "__name__")
                    else str(where.operator)
                )
                # resolve right value
                if hasattr(right, "value"):
                    rval = right.value
                elif hasattr(right, "effective_value"):
                    rval = right.effective_value
                else:
                    rval = getattr(right, "key", None)
                if op in ("eq",):
                    items = [i for i in items if getattr(i, key, None) == rval]
                elif op in ("is_", "is"):
                    items = [i for i in items if getattr(i, key, "X") is None]
                elif op in ("ne",):
                    items = [i for i in items if getattr(i, key, None) != rval]
                return items
        except Exception:
            pass
        return items


def make_store():
    return {
        "users": {},
        "audit_logs": {},
        "refresh_tokens": {},
        "companies": {},
        "job_postings": {},
        "job_analyses": {},
        "risk_factors": {},
        "safety_recommendations": {},
        "verification_checks": {},
        "community_reports": {},
        "experience_ratings": {},
        "report_evidence": {},
        "moderation_actions": {},
        "network_entities": {},
        "network_evidence": {},
        "network_relationships": {},
        "watchlist_entries": {},
        "watchlist_appeals": {},
        "saved_opportunities": {},
        "checklist_progress": {},
        "trust_passports": {},
        "chat_sessions": {},
        "chat_messages": {},
    }


@pytest.fixture
def store():
    return make_store()


@pytest_asyncio.fixture
async def app_and_client(store):
    limiter.reset()
    app = create_app()

    async def override_db():
        session = FakeSession(store)
        yield session

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield app, ac
    app.dependency_overrides.clear()
    limiter.reset()
