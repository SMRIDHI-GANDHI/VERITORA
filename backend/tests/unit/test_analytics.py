from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.analytics import compute_trends, week_start


def _current_week_start() -> datetime:
    today = datetime.now(UTC).date()
    return datetime.combine(week_start(today), datetime.min.time(), tzinfo=UTC)


def _report(category: str, weeks_ago: int, status: str = "approved") -> Any:
    """A report placed inside the complete week ``weeks_ago`` weeks back.

    Week 0 is the current (incomplete) week, which is excluded from the
    weekly series, so week 1 is the most recent complete week.
    """
    created = _current_week_start() - timedelta(weeks=weeks_ago) + timedelta(days=1)
    return type(
        "R",
        (),
        {
            "category": category,
            "moderation_status": status,
            "created_at": created,
        },
    )()


def test_week_start_is_monday():
    d = datetime(2026, 11, 12, tzinfo=UTC).date()  # a Thursday
    assert week_start(d).isoformat() == "2026-11-09"


def test_weekly_series_has_one_entry_per_week():
    result = compute_trends([], weeks=6)
    assert len(result["weekly"]) == 6
    assert result["approved_report_total"] == 0
    assert result["rising_categories"] == []


def test_reports_are_counted_per_week():
    # Two reports in week 1, one in week 2.
    result = compute_trends(
        [
            _report("payment_request", 1),
            _report("payment_request", 1),
            _report("suspicious_link", 2),
        ],
        weeks=6,
    )
    counts = [w["count"] for w in result["weekly"]]
    assert sum(counts) == 3
    assert counts[-1] == 2  # most recent complete week
    assert counts[-2] == 1
    assert result["approved_report_total"] == 3


def test_rising_categories_are_detected():
    # Week 1: 4 payment_request. Week 2: 1 payment_request.
    reports = [_report("payment_request", 1) for _ in range(4)]
    reports.append(_report("payment_request", 2))
    result = compute_trends(reports, weeks=4)
    rising = result["rising_categories"]
    assert rising
    top = rising[0]
    assert top["category"] == "payment_request"
    assert top["previous_count"] == 1
    assert top["current_count"] == 4
    assert top["delta"] == 3


def test_stable_categories_are_not_reported_as_rising():
    reports = [_report("payment_request", 1) for _ in range(2)]
    reports += [_report("payment_request", 2) for _ in range(2)]
    result = compute_trends(reports, weeks=4)
    assert result["rising_categories"] == []


def test_total_by_category_is_reported():
    result = compute_trends(
        [
            _report("payment_request", 1),
            _report("payment_request", 1),
            _report("other", 1),
        ],
        weeks=4,
    )
    assert result["total_by_category"]["payment_request"] == 2
    assert result["total_by_category"]["other"] == 1


def test_current_incomplete_week_is_excluded():
    # A report from the current week must not appear in the weekly series.
    result = compute_trends([_report("payment_request", 0)], weeks=4)
    assert sum(w["count"] for w in result["weekly"]) == 0
    assert result["approved_report_total"] == 1


def test_window_is_clamped():
    assert compute_trends([], weeks=0)["window_weeks"] == 1
    assert compute_trends([], weeks=999)["window_weeks"] == 52


def test_only_approved_reports_are_counted():
    # compute_trends receives already-approved reports; the filter happens in
    # report_trends(). Here we assert the helper ignores the status field.
    result = compute_trends([_report("other", 1, status="pending_review")], weeks=4)
    assert result["approved_report_total"] == 1
