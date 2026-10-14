"""Patient views derived only from persisted synthetic observations."""
from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from .storage import (
    get_latest_observation,
    list_alert_audit,
    list_alerts,
    list_observations,
    list_patient_summaries,
    list_patient_progress_samples,
)

router = APIRouter(prefix="/api/v1", tags=["patients"])


def _progress(records: list[dict]) -> dict:
    """Build compact descriptive trend series from saved synthetic readings."""
    scores = [
        float(record["prediction"].get("risk_score", 0))
        for record in records
        if isinstance(record["prediction"].get("risk_score"), (int, float))
    ]
    previous = scores[-2] if len(scores) >= 2 else None
    delta = round(scores[-1] - previous, 2) if previous is not None else None
    direction = (
        "insufficient_data" if delta is None
        else "stable" if abs(delta) < 0.01
        else "increasing" if delta > 0
        else "decreasing"
    )
    return {
        "sample_count": len(records),
        "risk_scores": [round(score, 2) for score in scores],
        "heart_rates": [record["inputs"].get("heart_rate") for record in records],
        "spo2_values": [record["inputs"].get("spo2") for record in records],
        "systolic_bp_values": [record["inputs"].get("systolic_bp") for record in records],
        "timestamps": [record["created_at"] for record in records],
        "previous_risk_score": round(previous, 2) if previous is not None else None,
        "risk_delta": delta,
        "risk_direction": direction,
        "first_observed_at": records[0]["created_at"] if records else None,
        "last_observed_at": records[-1]["created_at"] if records else None,
        "description": "Recent observed values only; not a forecast or clinical interpretation.",
    }


def _summary(item: dict, progress_records: list[dict] | None = None) -> dict:
    record = item["record"]
    inputs = record["inputs"]
    records = progress_records if progress_records is not None else [record]
    return {
        "patient_id": record["patient_id"],
        "age": inputs.get("age"),
        "latest_observation_id": record["id"],
        "last_observed_at": record["created_at"],
        "observation_count": item["observation_count"],
        "latest_inputs": inputs,
        "latest_prediction": record["prediction"],
        "model_version": record["model_version"],
        "progress": _progress(records),
        "demo_only": True,
    }


def _vital_item(record: dict) -> dict:
    values = record["inputs"]
    prediction = record["prediction"]
    return {
        "observation_id": record["id"],
        "patient_id": record["patient_id"],
        "timestamp": record["created_at"],
        **values,
        "risk_score": prediction.get("risk_score"),
        "risk_level": prediction.get("risk_level"),
        "model_probability": prediction.get("model_probability"),
        "model_version": record["model_version"],
        "demo_only": True,
    }


@router.get("/patients")
def patients(limit: int = Query(default=100, ge=1, le=100)):
    rows = list_patient_summaries(limit=limit)
    patient_ids = [row["record"]["patient_id"] for row in rows]
    samples = list_patient_progress_samples(patient_ids, per_patient_limit=12)
    items = [
        _summary(row, samples.get(row["record"]["patient_id"], []))
        for row in rows
    ]
    return {
        "items": items,
        "count": len(items),
        "limit": limit,
        "demo_only": True,
        "disclaimer": "Only patient IDs with persisted synthetic observations appear here.",
    }


@router.get("/patients/{patient_id}")
def patient_detail(patient_id: str):
    latest = get_latest_observation(patient_id)
    if latest is None:
        raise HTTPException(status_code=404, detail="No persisted demo observations found for this patient ID.")
    count = len(list_observations(patient_id=patient_id, limit=100))
    samples = list_patient_progress_samples([patient_id], per_patient_limit=12)
    return _summary(
        {"record": latest, "observation_count": count},
        samples.get(patient_id, []),
    )


@router.get("/patients/{patient_id}/vitals")
def patient_vitals(
    patient_id: str,
    limit: int = Query(default=100, ge=1, le=100),
):
    records = list_observations(patient_id=patient_id, limit=limit)
    # Return oldest to newest for charting. The general history endpoint remains newest first.
    items = [_vital_item(record) for record in reversed(records)]
    return {
        "patient_id": patient_id,
        "items": items,
        "count": len(items),
        "limit": limit,
        "demo_only": True,
        "disclaimer": "Persisted synthetic observations only; no clinical records.",
    }


@router.get("/patients/{patient_id}/vitals/latest")
def latest_patient_vitals(patient_id: str):
    latest = get_latest_observation(patient_id)
    if latest is None:
        raise HTTPException(status_code=404, detail="No persisted demo observations found for this patient ID.")
    return _vital_item(latest)


@router.get("/patients/{patient_id}/timeline")
def patient_timeline(
    patient_id: str,
    limit: int = Query(default=30, ge=1, le=100),
):
    observations = list_observations(patient_id=patient_id, limit=limit)
    alerts = list_alerts(patient_id=patient_id, limit=limit)
    events: list[dict] = []
    for row in observations:
        prediction = row["prediction"]
        events.append({
            "event_id": f"observation-{row['id']}",
            "type": "observation",
            "occurred_at": row["created_at"],
            "patient_id": patient_id,
            "summary": f"Synthetic prediction scored {prediction.get('risk_score', '—')}/100",
            "observation_id": row["id"],
            "risk_score": prediction.get("risk_score"),
            "risk_level": prediction.get("risk_level"),
            "model_version": row["model_version"],
            "demo_only": True,
        })
    for alert in alerts:
        events.append({
            "event_id": f"alert-{alert['id']}",
            "type": "alert",
            "occurred_at": alert["created_at"],
            "patient_id": patient_id,
            "summary": alert["title"],
            "alert_id": alert["id"],
            "severity": alert["severity"],
            "status": alert["status"],
            "demo_only": True,
        })
        for audit in list_alert_audit(alert["id"]):
            events.append({
                "event_id": f"alert-audit-{alert['id']}-{audit['id']}",
                "type": "alert_audit",
                "occurred_at": audit["created_at"],
                "patient_id": patient_id,
                "summary": f"Alert {audit['action'].replace('_', ' ')}",
                "alert_id": alert["id"],
                "action": audit["action"],
                "actor": audit["actor"],
                "demo_only": True,
            })
    events.sort(key=lambda item: item["occurred_at"] or "", reverse=True)
    available = len(events)
    page = events[:limit]
    return {
        "patient_id": patient_id,
        "items": page,
        "count": len(page),
        "available_event_count": available,
        "limit": limit,
        "demo_only": True,
        "disclaimer": "Persisted synthetic observations and demonstration alert audit events only.",
    }
