from __future__ import annotations

import hashlib
import hmac
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models.community_report import CommunityReport
from app.db.models.job_posting import JobPosting
from app.db.models.network import NetworkEntity, NetworkEvidence, NetworkRelationship

SIMILARITY_ALERT_THRESHOLD = 0.6
SHINGLE_SIZE = 3
NUM_HASHES = 64


def _hmac_hash(value: str, key: str | None = None) -> str:
    secret = (key or get_settings().network_hmac_key).encode("utf-8")
    return hmac.new(secret, value.encode("utf-8"), hashlib.sha256).hexdigest()


def normalize_email_domain(email_or_domain: str | None) -> str | None:
    if not email_or_domain:
        return None
    v = email_or_domain.strip().lower()
    if "@" in v:
        v = v.rsplit("@", 1)[-1]
    v = v.strip().strip(".")
    return v or None


def normalize_website_domain(url_or_domain: str | None) -> str | None:
    if not url_or_domain:
        return None
    v = url_or_domain.strip().lower()
    v = re.sub(r"^https?://", "", v)
    v = v.split("/")[0].split(":")[0].strip(".")
    return v or None


def normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    # basic E.164-ish normalization: assume India default if 10 digits
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    if phone.strip().startswith("+") and 8 <= len(digits) <= 15:
        return "+" + digits
    return "+" + digits if digits else None


def normalize_handle(handle: str | None) -> str | None:
    if not handle:
        return None
    v = unicodedata.normalize("NFKC", handle).strip().lower()
    v = re.sub(r"\s+", "", v)
    v = v.lstrip("@")
    return v or None


def normalize_payment_handle(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    # UPI-like or generic payment id
    v = re.sub(r"\s+", "", v)
    return v or None


def text_shingles(text: str, k: int = SHINGLE_SIZE) -> set[str]:
    t = unicodedata.normalize("NFKC", (text or "").lower())
    t = re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", t)).strip()
    tokens = t.split()
    if not tokens:
        return set()
    if len(tokens) < k:
        return {" ".join(tokens)}
    return {" ".join(tokens[i : i + k]) for i in range(len(tokens) - k + 1)}


@dataclass
class MinHashSig:
    values: tuple[int, ...]


def minhash_signature(text: str, num_hashes: int = NUM_HASHES, k: int = SHINGLE_SIZE) -> MinHashSig:
    shingles = text_shingles(text, k=k)
    if not shingles:
        return MinHashSig(tuple([2**32 - 1] * num_hashes))
    vals: list[int] = []
    # deterministic family: sha256 of (seed, shingle)
    for i in range(num_hashes):
        mmin = None
        seed = str(i).encode("utf-8")
        for sh in shingles:
            h = hashlib.sha256(seed + b"|" + sh.encode("utf-8")).digest()
            hv = int.from_bytes(h[:8], "big", signed=False)
            if mmin is None or hv < mmin:
                mmin = hv
        vals.append(mmin or 0)
    return MinHashSig(tuple(vals))


def minhash_similarity(a: MinHashSig, b: MinHashSig) -> float:
    if len(a.values) != len(b.values) or not a.values:
        return 0.0
    eq = sum(1 for x, y in zip(a.values, b.values, strict=False) if x == y)
    return eq / len(a.values)


def description_fingerprint(text: str) -> str:
    # stable coarse fingerprint for exact/near grouping hints
    return hashlib.sha256(" ".join(sorted(text_shingles(text))).encode("utf-8")).hexdigest()


async def _get_or_create_entity(
    db: AsyncSession, entity_type: str, protected_hash: str
) -> NetworkEntity:
    # simple get-or-create (compatible with basic session patterns)
    try:
        res = await db.execute(
            select(NetworkEntity).where(
                NetworkEntity.entity_type == entity_type,
                NetworkEntity.protected_value_hash == protected_hash,
            )
        )
        existing = res.scalar_one_or_none()
        if existing:
            return existing
    except Exception:
        pass
    ent = NetworkEntity(
        entity_type=entity_type,
        protected_value_hash=protected_hash,
        visibility_level="restricted",
    )
    db.add(ent)
    try:
        await db.flush()
    except Exception:
        # in case of race/unique in real DB, try fetch again
        try:
            await db.rollback()
            res = await db.execute(
                select(NetworkEntity).where(
                    NetworkEntity.entity_type == entity_type,
                    NetworkEntity.protected_value_hash == protected_hash,
                )
            )
            existing = res.scalar_one_or_none()
            if existing:
                return existing
        except Exception:
            pass
        raise
    return ent


async def _ensure_relationship(
    db: AsyncSession,
    source: NetworkEntity,
    target: NetworkEntity,
    relationship_type: str,
    evidence: NetworkEvidence | None,
    confidence: float | None,
    review_status: str = "pending",
) -> None:
    # avoid duplicates best-effort
    try:
        res = await db.execute(
            select(NetworkRelationship).where(
                NetworkRelationship.source_entity_id == source.id,
                NetworkRelationship.target_entity_id == target.id,
                NetworkRelationship.relationship_type == relationship_type,
            )
        )
        if res.scalar_one_or_none():
            return
    except Exception:
        pass
    rel = NetworkRelationship(
        source_entity_id=source.id,
        target_entity_id=target.id,
        relationship_type=relationship_type,
        evidence_id=evidence.id if evidence else None,
        confidence=confidence,
        review_status=review_status,
    )
    db.add(rel)
    try:
        await db.flush()
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass


async def process_job_posting_for_network(
    db: AsyncSession,
    posting: JobPosting,
    company_name: str | None = None,
    recruiter_contact: str | None = None,
    company_website: str | None = None,
) -> None:
    """Create/update network entities and relationships for a job posting.
    Stores only HMAC-hashed identifiers and fingerprints (no raw contact values)."""
    try:
        desc = posting.description or ""
        if desc:
            posting.description_fingerprint = description_fingerprint(desc)

        entities: list[NetworkEntity] = []
        job_hash = _hmac_hash(str(posting.id), get_settings().network_hmac_key)
        job_ent = await _get_or_create_entity(db, "job", job_hash)
        entities.append(job_ent)

        dom = normalize_website_domain(company_website or posting.source_url)
        if dom:
            dom_ent = await _get_or_create_entity(db, "website_domain", _hmac_hash(dom))
            ev = NetworkEvidence(
                kind="shared_domain",
                similarity=1.0,
                detail={"entity_type": "website_domain"},
                record_refs={"job_posting_id": str(posting.id)},
            )
            db.add(ev)
            await db.flush()
            await _ensure_relationship(db, job_ent, dom_ent, "uses_domain", ev, 1.0)

        if recruiter_contact:
            # classify roughly: email domain / phone / handle
            if "@" in recruiter_contact:
                ed = normalize_email_domain(recruiter_contact)
                if ed:
                    e_ent = await _get_or_create_entity(db, "email_domain", _hmac_hash(ed))
                    ev = NetworkEvidence(
                        kind="shared_identifier",
                        similarity=1.0,
                        detail={"entity_type": "email_domain"},
                        record_refs={"job_posting_id": str(posting.id)},
                    )
                    db.add(ev)
                    await db.flush()
                    await _ensure_relationship(db, job_ent, e_ent, "has_contact_domain", ev, 1.0)
            phone_n = normalize_phone(recruiter_contact)
            if phone_n and len(re.sub(r"\D", "", phone_n)) >= 10 and "@" not in recruiter_contact:
                p_ent = await _get_or_create_entity(db, "phone", _hmac_hash(phone_n))
                ev = NetworkEvidence(
                    kind="shared_identifier",
                    similarity=1.0,
                    detail={"entity_type": "phone"},
                    record_refs={"job_posting_id": str(posting.id)},
                )
                db.add(ev)
                await db.flush()
                await _ensure_relationship(db, job_ent, p_ent, "has_phone", ev, 1.0)

        # near-duplicate template detection against recent postings (best-effort, limited)
        try:
            res = await db.execute(select(JobPosting))
            all_posts = res.scalars().all() if hasattr(res, "scalars") else []
            others = [p for p in all_posts if p.id != posting.id]
            # limit comparisons
            others = others[-50:]
            sig_new = minhash_signature(desc)
            for other in others:
                if not other.description:
                    continue
                sim = minhash_similarity(sig_new, minhash_signature(other.description))
                if sim >= SIMILARITY_ALERT_THRESHOLD:
                    other_hash = _hmac_hash(str(other.id))
                    other_ent = await _get_or_create_entity(db, "job", other_hash)
                    ev = NetworkEvidence(
                        kind="near_duplicate_template",
                        similarity=sim,
                        detail={"threshold": SIMILARITY_ALERT_THRESHOLD},
                        record_refs={
                            "job_posting_ids": [str(posting.id), str(other.id)],
                        },
                    )
                    db.add(ev)
                    await db.flush()
                    conf = min(0.99, max(0.5, sim))
                    await _ensure_relationship(
                        db, job_ent, other_ent, "similar_template", ev, conf, "pending"
                    )
        except Exception:
            # similarity scan is best-effort; do not fail main flow
            pass
    except Exception:
        # network processing must not break core flows
        try:
            await db.rollback()
        except Exception:
            pass


async def process_report_for_network(db: AsyncSession, report: CommunityReport) -> None:
    try:
        report_hash = _hmac_hash(str(report.id))
        r_ent = await _get_or_create_entity(db, "report", report_hash)
        if report.company_id:
            c_ent = await _get_or_create_entity(db, "company", _hmac_hash(str(report.company_id)))
            ev = NetworkEvidence(
                kind="report_link",
                similarity=1.0,
                detail={"entity_type": "company"},
                record_refs={"report_id": str(report.id), "company_id": str(report.company_id)},
            )
            db.add(ev)
            await db.flush()
            # if report approved/substantiated, mark for alerting relevance
            review_status = "pending"
            await _ensure_relationship(db, r_ent, c_ent, "reported_company", ev, 1.0, review_status)
        # job link if any
        if getattr(report, "job_id", None):
            j_ent = await _get_or_create_entity(db, "job", _hmac_hash(str(report.job_id)))
            ev = NetworkEvidence(
                kind="report_link",
                similarity=1.0,
                detail={"entity_type": "job"},
                record_refs={"report_id": str(report.id), "job_id": str(report.job_id)},
            )
            db.add(ev)
            await db.flush()
            await _ensure_relationship(db, r_ent, j_ent, "reported_job", ev, 1.0, "pending")
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass


def detect_report_spikes(
    reports: Iterable[Any], *, days: int = 7, threshold: int = 3
) -> list[dict[str, Any]]:
    """Simple spike detection: companies with >= threshold reports in recent window.
    Counts by company_id/company_name hashable key (no raw identifiers in output)."""
    from datetime import UTC, datetime, timedelta

    now = datetime.now(UTC)
    cutoff = now - timedelta(days=days)
    counts: dict[str, int] = {}
    for r in reports:
        created = getattr(r, "created_at", None)
        if created is None:
            continue
        try:
            if created.tzinfo is None:
                created = created.replace(tzinfo=UTC)
        except Exception:
            pass
        if created < cutoff:
            continue
        key = str(getattr(r, "company_id", None) or getattr(r, "company_name", "unknown"))
        counts[key] = counts.get(key, 0) + 1
    spikes = []
    for key, count in counts.items():
        if count >= threshold:
            spikes.append({"entity_ref_hash": _hmac_hash(key), "count": count, "window_days": days})
    return spikes


async def list_network_alerts(db: AsyncSession) -> list[dict[str, Any]]:
    """Return alert-like relationships for moderator view.
    Criteria: similarity >= threshold OR involves approved/substantiated report (best-effort)."""
    try:
        rel_res = await db.execute(select(NetworkRelationship))
        rels = rel_res.scalars().all() if hasattr(rel_res, "scalars") else []
        ev_ids = [r.evidence_id for r in rels if r.evidence_id]
        evid_map: dict[Any, NetworkEvidence] = {}
        if ev_ids:
            try:
                stmt_ev = select(NetworkEvidence).where(NetworkEvidence.id.in_(ev_ids))
                e_res = await db.execute(stmt_ev)
                ev_rows = e_res.scalars().all() if hasattr(e_res, "scalars") else []
                evid_map = {e.id: e for e in ev_rows}
            except Exception:
                e_res = await db.execute(select(NetworkEvidence))
                ev_rows = e_res.scalars().all() if hasattr(e_res, "scalars") else []
                evid_map = {e.id: e for e in ev_rows}

        # approved report ids for alert relevance
        approved_report_ids: set[str] = set()
        reports_for_spike: list[Any] = []
        try:
            rep_res = await db.execute(select(CommunityReport))
            reports = rep_res.scalars().all() if hasattr(rep_res, "scalars") else []
            for r in reports:
                reports_for_spike.append(r)
                status = getattr(r, "moderation_status", None)
                has_summary = getattr(r, "public_summary", None)
                if status in {"substantiated", "inconclusive"} and has_summary:
                    approved_report_ids.add(str(r.id))
        except Exception:
            pass

        alerts: list[dict[str, Any]] = []
        for rel in rels:
            ev = evid_map.get(rel.evidence_id) if rel.evidence_id else None
            sim = ev.similarity if ev and ev.similarity is not None else rel.confidence
            refs = (ev.record_refs if ev else None) or {}
            involves_approved = False
            if isinstance(refs, dict):
                rid = refs.get("report_id")
                rids = refs.get("report_ids") or []
                if rid and str(rid) in approved_report_ids:
                    involves_approved = True
                if isinstance(rids, list) and any(str(x) in approved_report_ids for x in rids):
                    involves_approved = True
            if (sim is not None and sim >= SIMILARITY_ALERT_THRESHOLD) or involves_approved:
                alerts.append(
                    {
                        "relationship_id": str(rel.id),
                        "relationship_type": rel.relationship_type,
                        "confidence": rel.confidence,
                        "review_status": rel.review_status,
                        "evidence": {
                            "kind": ev.kind if ev else None,
                            "similarity": ev.similarity if ev else None,
                            "detail": ev.detail if ev else {},
                            "record_refs": refs,
                        },
                        "entities": [
                            {"id": str(rel.source_entity_id)},
                            {"id": str(rel.target_entity_id)},
                        ],
                    }
                )
        # append spike alerts (best-effort)
        try:
            for spike in detect_report_spikes(reports_for_spike):
                alerts.append(
                    {
                        "relationship_id": None,
                        "relationship_type": "report_spike",
                        "confidence": min(0.99, 0.5 + 0.1 * spike["count"]),
                        "review_status": "pending",
                        "evidence": {
                            "kind": "spike_detection",
                            "similarity": None,
                            "detail": spike,
                            "record_refs": {},
                        },
                        "entities": [{"id": None, "entity_ref_hash": spike["entity_ref_hash"]}],
                    }
                )
        except Exception:
            pass
        return alerts
    except Exception:
        return []


async def search_network_patterns(db: AsyncSession, query: str | None = None) -> dict[str, Any]:
    """Moderator search view: returns relationships/alerts without raw identifiers.
    Public-facing use must not expose identifiers; this endpoint is moderator-scoped."""
    alerts = await list_network_alerts(db)
    # simple text filter on relationship_type/kind
    if query:
        q = query.lower()
        alerts = [
            a
            for a in alerts
            if q in str(a.get("relationship_type", "")).lower()
            or q in str((a.get("evidence") or {}).get("kind") or "").lower()
        ]
    return {
        "items": alerts,
        "notice": "lead_for_review_not_proof",
    }