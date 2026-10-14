"""Descriptive observation trend and feed-quality endpoints."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query

from .storage import list_observations, list_patient_summaries

router = APIRouter(prefix="/api/v1/observations", tags=["observation-analytics"])
METRICS = ("heart_rate", "spo2", "systolic_bp", "temperature", "respiratory_rate", "risk_score")
REQUIRED_INPUTS = ("age", "heart_rate", "spo2", "systolic_bp", "diastolic_bp", "temperature", "respiratory_rate")


def _time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except (TypeError, ValueError):
        return None


@router.get("/trends")
def observation_trends(
    patient_id: str = Query(min_length=1, max_length=64),
    limit: int = Query(default=50, ge=1, le=100),
):
    newest_first = list_observations(patient_id=patient_id, limit=limit)
    records = list(reversed(newest_first))
    trends = []
    for metric in METRICS:
        values: list[float] = []
        for record in records:
            source = record["prediction"] if metric == "risk_score" else record["inputs"]
            raw = source.get(metric)
            if isinstance(raw, (int, float)):
                values.append(float(raw))
        if len(values) < 2:
            trends.append({
                "metric": metric,
                "sample_count": len(values),
                "status": "insufficient_data",
            })
            continue
        first, latest = values[0], values[-1]
        change = latest - first
        direction = "stable" if abs(change) < 0.01 else ("increasing" if change > 0 else "decreasing")
        trends.append({
            "metric": metric,
            "sample_count": len(values),
            "status": "ok",
            "first_value": round(first, 2),
            "latest_value": round(latest, 2),
            "absolute_change": round(change, 2),
            "slope_per_observation": round(change / (len(values) - 1), 3),
            "direction": direction,
        })
    return {
        "patient_id": patient_id,
        "observation_count": len(records),
        "first_observed_at": records[0]["created_at"] if records else None,
        "last_observed_at": records[-1]["created_at"] if records else None,
        "trends": trends,
        "method": "Endpoint delta and change per observation; records ordered by persisted ID.",
        "interpretation": "Descriptive summary of stored synthetic values only, not a forecast or clinical interpretation.",
        "demo_only": True,
        "clinically_validated": False,
    }


@router.get("/quality")
def observation_quality(
    stale_after_seconds: int = Query(default=300, ge=1, le=86_400),
    limit: int = Query(default=100, ge=1, le=100),
):
    now = datetime.now(timezone.utc)
    rows = list_patient_summaries(limit=limit)
    items = []
    for item in rows:
        record = item["record"]
        inputs = record["inputs"]
        missing = [name for name in REQUIRED_INPUTS if inputs.get(name) is None]
        observed = _time(record.get("created_at"))
        age_seconds = max(0, int((now - observed).total_seconds())) if observed else None
        if observed is None:
            status = "unknown"
        elif missing:
            status = "incomplete"
        elif age_seconds is not None and age_seconds > stale_after_seconds:
            status = "stale"
        else:
            status = "fresh"
        items.append({
            "patient_id": record["patient_id"],
            "latest_observation_id": record["id"],
            "last_observed_at": record.get("created_at"),
            "age_seconds": age_seconds,
            "status": status,
            "missing_fields": missing,
        })
    return {
        "items": items,
        "count": len(items),
        "stale_after_seconds": stale_after_seconds,
        "demo_only": True,
        "disclaimer": "Data freshness and field completeness checks apply only to persisted synthetic observations.",
    }
