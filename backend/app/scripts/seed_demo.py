import asyncio
import uuid

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models.company import Company
from app.db.models.job_analysis import JobAnalysis
from app.db.models.job_posting import JobPosting
from app.db.models.user import User
from app.db.session import SessionLocal
from app.services.analyzer.service import analyze

DEMO_USERS = [
    # NOTE: the email domain must be one that `pydantic.EmailStr` accepts.
    # Reserved/special-use domains such as `.local` are rejected by the
    # validator, which would make these accounts impossible to log into.
    ("demo-user@veritora.example.com", "Demo User", "user"),
    ("demo-mod@veritora.example.com", "Demo Moderator", "moderator"),
]

# Older revisions of this script used a `.local` domain that the API's email
# validator rejects. If such an account exists we rename it in place (keeping
# the same primary key) so seeded data stays usable and relationships hold.
LEGACY_EMAIL_SUFFIX = "@veritora.local"

DEMO_SCENARIOS = [
    {
        "key": "payment",
        "company": "Synthetic PayFirst Pvt Ltd",
        "title": "Remote Data Entry",
        "description": (
            "Congratulations, you are selected. Please pay Rs 1500 registration fee "
            "to confirm your selection."
        ),
    },
    {
        "key": "pressure",
        "company": "Synthetic UrgentHire",
        "title": "Sales Associate",
        "description": (
            "Final step: pay within 24 hours to secure this guaranteed placement. "
            "Reply immediately."
        ),
    },
    {
        "key": "legit",
        "company": "Synthetic GoodTech",
        "title": "Backend Engineer",
        "description": (
            "We are hiring a backend engineer. We never charge any fee from candidates. "
            "Apply via our careers page."
        ),
    },
]


async def seed_demo() -> None:
    async with SessionLocal() as db:
        # users
        user_ids: dict[str, uuid.UUID] = {}
        for email, name, role in DEMO_USERS:
            res = await db.execute(select(User).where(User.email == email))
            user = res.scalar_one_or_none()
            if not user:
                # Look for a legacy account created by an older revision of this
                # script and rename it in place (same primary key) so existing
                # analyses and relationships remain attached.
                legacy_email = email.replace("@veritora.example.com", LEGACY_EMAIL_SUFFIX)
                res_legacy = await db.execute(select(User).where(User.email == legacy_email))
                legacy_user = res_legacy.scalar_one_or_none()
                if legacy_user:
                    legacy_user.email = email
                    user = legacy_user
                    await db.flush()
            if not user:
                user = User(
                    id=uuid.uuid4(),
                    name=name,
                    email=email,
                    password_hash=hash_password("DemoPass123!"),
                    role=role,
                    is_active=True,
                )
                db.add(user)
                await db.flush()
            user_ids[role] = user.id

        # companies + postings + analyses (synthetic)
        for sc in DEMO_SCENARIOS:
            norm = " ".join(str(sc["company"]).lower().split())
            res_c = await db.execute(select(Company).where(Company.normalized_name == norm))
            company = res_c.scalar_one_or_none()
            if not company:
                company = Company(
                    id=uuid.uuid4(),
                    name=str(sc["company"]),
                    normalized_name=norm,
                    is_synthetic=True,
                    verification_status="not_checked",
                )
                db.add(company)
                await db.flush()

            # posting fingerprint simple
            fp = f"demo:{sc['key']}"
            res_p = await db.execute(
                select(JobPosting).where(JobPosting.description_fingerprint == fp)
            )
            posting = res_p.scalar_one_or_none()
            if not posting:
                posting = JobPosting(
                    id=uuid.uuid4(),
                    company_id=company.id,
                    title=str(sc["title"]),
                    description=str(sc["description"]),
                    description_fingerprint=fp,
                    submitted_by=user_ids.get("user"),
                )
                db.add(posting)
                await db.flush()

            res_a = await db.execute(
                select(JobAnalysis).where(JobAnalysis.job_id == posting.id)
            )
            if not res_a.scalar_one_or_none():
                result = analyze(
                    title=str(sc["title"]),
                    description=str(sc["description"]),
                    company_name=str(sc["company"]),
                )
                db.add(
                    JobAnalysis(
                        id=uuid.uuid4(),
                        user_id=user_ids.get("user"),
                        job_id=posting.id,
                        risk_score=result.get("risk_score"),
                        risk_band=result.get("risk_band") or "insufficient_information",
                        assessment_type="decision_support",
                        summary=result.get("summary"),
                        rules_version=result.get("rules_version") or "rules-2026.11.1",
                        result_json=result,
                    )
                )

        await db.commit()
        print("Seed demo completed (idempotent, synthetic).")


if __name__ == "__main__":
    asyncio.run(seed_demo())
