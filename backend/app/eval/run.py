from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.services.analyzer.service import analyze
from app.services.risk.config import rules_version


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def predict_positive(text: str) -> bool:
    r = analyze(title="Job", description=text, company_name="Example Co")
    band = r.get("risk_band")
    score = r.get("risk_score") or 0
    codes = {f.get("code") for f in (r.get("risk_factors") or [])}
    risky_codes = {"UPFRONT_PAYMENT", "SENSITIVE_DATA_REQUEST", "GUARANTEED_SELECTION"}
    if codes & risky_codes:
        return True
    if band in {"high_concern", "very_high_concern"}:
        return True
    if band == "moderate" and score >= 35:
        return True
    return False


def metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    tp = fp = tn = fn = 0
    per_lang: dict[str, dict[str, int]] = defaultdict(lambda: {"tp": 0, "fp": 0, "tn": 0, "fn": 0})
    fps_legit: list[str] = []
    fns: list[str] = []

    for row in rows:
        text = row.get("text", "")
        label = int(row.get("label", 0))
        lang = str(row.get("language", "unknown"))
        pred = predict_positive(text)
        if pred and label == 1:
            tp += 1
            per_lang[lang]["tp"] += 1
        elif pred and label == 0:
            fp += 1
            per_lang[lang]["fp"] += 1
            fps_legit.append(text[:120])
        elif (not pred) and label == 0:
            tn += 1
            per_lang[lang]["tn"] += 1
        else:
            fn += 1
            per_lang[lang]["fn"] += 1
            fns.append(text[:120])

    def prf(tpi: int, fpi: int, fni: int) -> dict[str, float]:
        prec = tpi / (tpi + fpi) if (tpi + fpi) else 0.0
        rec = tpi / (tpi + fni) if (tpi + fni) else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) else 0.0
        return {"precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4)}

    overall = prf(tp, fp, fn)
    lang_metrics = {}
    for lang, c in per_lang.items():
        lang_metrics[lang] = prf(c["tp"], c["fp"], c["fn"]) | {"support": sum(c.values())}

    return {
        "rules_version": rules_version(),
        "set": "payment_v1",
        "generated_at": datetime.now(UTC).isoformat(),
        "counts": {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "total": len(rows)},
        "confusion_matrix": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        **overall,
        "per_language": lang_metrics,
        "false_positives_legitimate": fps_legit[:20],
        "false_negatives": fns[:20],
        "note": "Synthetic labeled set; metrics are for reporting, not silent tuning.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", dest="set_name", default="payment_v1")
    parser.add_argument("--out", dest="out", default=None)
    args = parser.parse_args()

    base = Path(__file__).resolve().parents[2]
    data_path = base / "tests" / "fixtures" / "eval" / f"{args.set_name}.jsonl"
    rows = load_jsonl(data_path)
    report = metrics(rows)

    reports_dir = base / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out) if args.out else reports_dir / f"eval-{report['rules_version']}.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nWrote: {out_path}")


if __name__ == "__main__":
    main()
