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
)

router = APIRouter(prefix="/api/v1", tags=["patients"])


def _summary(item: dict) -> dict:
    record = item["record"]
    inputs = record["inputs"]
    return {
        "patient_id": record["patient_id"],
        "age": inputs.get("age"),
        "latest_observation_id": record["id"],
        "last_observed_at": record["created_at"],
        "observation_count": item["observation_count"],
        "latest_inputs": inputs,
        "latest_prediction": record["prediction"],
        "model_version": record["model_version"],
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
    items = [_summary(row) for row in rows]
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
    return _summary({"record": latest, "observation_count": count})


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
