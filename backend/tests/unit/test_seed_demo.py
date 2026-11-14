from __future__ import annotations

import pytest
from pydantic import EmailStr, TypeAdapter

from app.scripts.seed_demo import DEMO_USERS, LEGACY_EMAIL_SUFFIX

_email = TypeAdapter(EmailStr)


@pytest.mark.parametrize("email,_name,_role", DEMO_USERS)
def test_seed_demo_emails_pass_api_email_validation(email, _name, _role):
    """Seeded accounts must be log-in-able.

    The API validates emails with `pydantic.EmailStr`, which rejects
    special-use/reserved domains such as `.local`. A seed script that creates
    such accounts produces users that can never sign in.
    """
    _email.validate_python(email)


def test_seed_demo_users_have_unique_emails():
    emails = [e for e, _n, _r in DEMO_USERS]
    assert len(emails) == len(set(emails))


def test_legacy_email_suffix_is_a_reserved_domain():
    """Guard the reason the legacy domain was replaced."""
    with pytest.raises(ValueError):
        _email.validate_python(f"someone{LEGACY_EMAIL_SUFFIX}")


def test_seed_demo_emails_are_not_using_legacy_domain():
    for email, _name, _role in DEMO_USERS:
        assert not email.endswith(LEGACY_EMAIL_SUFFIX)
