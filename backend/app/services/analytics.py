"""Trend analytics for the moderator dashboard.

Weekly counts of moderator-approved community reports, plus the categories
whose volume is rising week over week. Everything here is derived from
**approved** reports only; pending or rejected submissions never influence a
trend.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.community_report import CommunityReport

DEFAULT_WEEKS = 8
MIN_WEEKS = 1
MAX_WEEKS = 52
# A category is "rising" when it gains at least this many reports versus the
# previous week, or when it more than doubles with at least 2 reports.
MIN_ABSOLUTE_RISE = 2
MIN_RELATIVE_RISE = 2.0
MIN_RELATIVE_BASE = 1


def week_start(value: date) -> date:
    """Monday of the ISO week containing ``value``."""
    return value - timedelta(days=value.weekday())


def _bucket(counts: dict[date, int], start: date, weeks: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i in range(weeks):
        w = start + timedelta(weeks=i)
        out.append({"week_start": w.isoformat(), "count": counts.get(w, 0)})
    return out


async def _load_approved_reports(db: AsyncSession) -> list[CommunityReport]:
    try:
        stmt = select(CommunityReport).where(CommunityReport.moderation_status == "approved")
        res = await db.execute(stmt)
        rows = res.scalars().all() if hasattr(res, "scalars") else []
        return list(rows)
    except Exception:
        return []


def _report_date(report: Any) -> date:
    created = getattr(report, "created_at", None)
    if isinstance(created, datetime):
        if created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        return created.date()
    if isinstance(created, date):
        return created
    return datetime.now(UTC).date()


def compute_trends(reports: list[Any], *, weeks: int = DEFAULT_WEEKS) -> dict[str, Any]:
    """Compute weekly counts and rising categories from approved reports."""
    weeks = max(MIN_WEEKS, min(int(weeks), MAX_WEEKS))
    today = datetime.now(UTC).date()
    # The current (incomplete) week is excluded so trends compare full weeks.
    current_week = week_start(today)
    first_week = current_week - timedelta(weeks=weeks)

    weekly_counts: dict[date, int] = {}
    weekly_categories: dict[date, dict[str, int]] = {}
    for report in reports:
        d = _report_date(report)
        if d < first_week or d >= current_week:
            continue
        bucket = week_start(d)
        weekly_counts[bucket] = weekly_counts.get(bucket, 0) + 1
        cats = weekly_categories.setdefault(bucket, {})
        cat = str(getattr(report, "category", "other") or "other")
        cats[cat] = cats.get(cat, 0) + 1

    series = _bucket(weekly_counts, first_week, weeks)

    # Rising patterns: compare the last complete week with the one before it.
    rising: list[dict[str, Any]] = []
    if weeks >= 2:
        last = current_week - timedelta(weeks=1)
        prev = current_week - timedelta(weeks=2)
        last_cats = weekly_categories.get(last, {})
        prev_cats = weekly_categories.get(prev, {})
        for cat, count in sorted(last_cats.items()):
            before = prev_cats.get(cat, 0)
            delta = count - before
            is_rising = delta >= MIN_ABSOLUTE_RISE and (
                before == 0 or count >= before * MIN_RELATIVE_RISE
            )
            if is_rising:
                rising.append(
                    {
                        "category": cat,
                        "previous_count": before,
                        "current_count": count,
                        "delta": delta,
                    }
                )
        rising.sort(key=lambda r: (-r["delta"], r["category"]))

    totals: dict[str, int] = {}
    for report in reports:
        cat = str(getattr(report, "category", "other") or "other")
        totals[cat] = totals.get(cat, 0) + 1

    return {
        "window_weeks": weeks,
        "week_start": first_week.isoformat(),
        "generated_at": datetime.now(UTC).isoformat(),
        "approved_report_total": len(reports),
        "weekly": series,
        "total_by_category": dict(sorted(totals.items())),
        "rising_categories": rising,
        "notes": [
            "Counts include moderator-approved reports only.",
            "The current (incomplete) week is excluded from the weekly series.",
        ],
    }


async def report_trends(db: AsyncSession, *, weeks: int = DEFAULT_WEEKS) -> dict[str, Any]:
    reports = await _load_approved_reports(db)
    return compute_trends(reports, weeks=weeks)


__all__ = [
    "DEFAULT_WEEKS",
    "compute_trends",
    "report_trends",
    "week_start",
]
